<?php

namespace App\Services\Clothing;

use App\Models\ClothingSubmission;
use App\Services\RconService;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ClothingLiveInstaller
{
    public function __construct(
        private readonly ClothingDatabaseInstaller $database,
        private readonly ClothingGamedataInstaller $gamedata,
        private readonly RconService $rcon
    ) {
    }

    public function install(
        ClothingSubmission $submission
    ): array {
        if (
            $submission->status !== 'pending' ||
            $submission->technical_status !==
                'valid'
        ) {
            throw new RuntimeException(
                'La solicitud no está lista para aprobación.'
            );
        }

        $lockName =
            'biribiri_clothing_live_install';

        $lock = DB::selectOne(
            'SELECT GET_LOCK(?, 30) AS acquired',
            [$lockName]
        );

        if (
            ! $lock ||
            (int) $lock->acquired !== 1
        ) {
            throw new RuntimeException(
                'No se pudo adquirir el lock del importer.'
            );
        }

        $applied = null;
        $plan = null;

        try {
            $ids =
                $this->database
                    ->reserveIds();

            /*
             * La variante del diseñador reutiliza sprite_id del
             * base público. Por tanto solo necesitamos un
             * FurnitureData/Nitro para el furni.
             */
            $plan =
                $this->gamedata
                    ->prepare(
                        $submission,
                        (int)
                        $ids[
                            'public_base_item_id'
                        ],
                        (int)
                        $ids[
                            'catalog_item_id'
                        ]
                    );

            $backupRoot = storage_path(
                'app/clothing_importer/install-backups/' .
                $submission->id .
                '/' .
                date('Ymd-His') .
                '-' .
                bin2hex(
                    random_bytes(4)
                )
            );

            $applied =
                $this->gamedata
                    ->apply(
                        $plan,
                        $backupRoot
                    );

            DB::beginTransaction();

            try {
                $databaseResult =
                    $this->database
                        ->install(
                            $submission,
                            $plan,
                            $ids
                        );

                $report =
                    is_array(
                        $submission
                            ->technical_report
                    )
                        ? $submission
                            ->technical_report
                        : [];

                $report['installation'] = [
                    'installed_at' =>
                        now()->toIso8601String(),
                    'backup_root' =>
                        $backupRoot,
                    'files' =>
                        array_map(
                            static fn (
                                array $entry
                            ): string =>
                                (string)
                                $entry['target'],
                            $applied[
                                'applied'
                            ] ?? []
                        ),
                    'database' =>
                        $databaseResult,
                    'restart_required' =>
                        true,
                ];

                $submission->forceFill([
                    'technical_report' =>
                        $report,
                ])->save();

                DB::commit();
            } catch (\Throwable $exception) {
                DB::rollBack();

                $this->gamedata->restore(
                    $applied
                );

                throw $exception;
            }

            $catalogReloadRequested = false;

            try {
                if ($this->rcon->isConnected) {
                    $this->rcon
                        ->updateCatalog();

                    $catalogReloadRequested =
                        true;
                }
            } catch (\Throwable) {
                /*
                 * La instalación ya está comprometida.
                 * No hacemos rollback por un refresh RCON.
                 */
            }

            return [
                'ok' => true,
                'submission_id' =>
                    $submission->id,
                'backup_root' =>
                    $applied[
                        'backup_root'
                    ],
                'catalog_reload_requested' =>
                    $catalogReloadRequested,

                /*
                 * items_base / FurnitureData nuevos pueden seguir
                 * cacheados por el emulador. Hasta añadir hot-reload
                 * específico, el primer test debe hacerse tras
                 * reiniciar el emulador.
                 */
                'emulator_restart_required' =>
                    true,
            ];
        } finally {
            try {
                DB::selectOne(
                    'SELECT RELEASE_LOCK(?) AS released',
                    [$lockName]
                );
            } catch (\Throwable) {
            }
        }
    }
}