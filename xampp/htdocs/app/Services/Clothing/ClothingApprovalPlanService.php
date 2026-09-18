<?php

namespace App\Services\Clothing;

use App\Models\ClothingSubmission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

class ClothingApprovalPlanService
{
    public function __construct(
        private readonly ClothingDatabaseInstaller $database,
        private readonly ClothingGamedataInstaller $gamedata,
        private readonly ClothingBiribiriCodeService $codes,
        private readonly ClothingStaffCatalogService $staffCatalog
    ) {
    }

    public function buildSafe(
        ClothingSubmission $submission
    ): array {
        try {
            return [
                'ok' => true,
                'plan' =>
                    $this->build(
                        $submission
                    ),
            ];
        } catch (\Throwable $exception) {
            return [
                'ok' => false,
                'error' =>
                    $exception->getMessage(),
            ];
        }
    }

    public function build(
        ClothingSubmission $submission
    ): array {
        if (
            $submission->status !== 'pending' ||
            $submission->technical_status !== 'valid'
        ) {
            throw new RuntimeException(
                'La solicitud no está lista para un plan de aprobación.'
            );
        }

        if (
            (int) $submission->piece_count === 1 &&
            trim(
                (string)
                $submission->final_category
            ) === ''
        ) {
            throw new RuntimeException(
                'Aprobación bloqueada: confirma primero la Sección final desde "Revisar datos".'
            );
        }

        $redeemableCode =
            $this->codes
                ->redeemableCode(
                    $submission
                );

        $this->assertIdentityAvailable(
            $submission,
            $redeemableCode
        );

        /*
         * reserveIds() no reserva ni escribe:
         * calcula los próximos IDs libres mediante SELECT.
         */
        $ids =
            $this->database
                ->reserveIds();

        $this->staffCatalog
            ->assertReady();

        $previewRoot =
            storage_path(
                'app/clothing_importer/previews'
            );

        $submissionRoot =
            $previewRoot .
            DIRECTORY_SEPARATOR .
            $submission->id;

        $createdSubmissionRoot = false;

        if (! is_dir($previewRoot)) {
            if (
                ! mkdir(
                    $previewRoot,
                    0775,
                    true
                ) &&
                ! is_dir($previewRoot)
            ) {
                throw new RuntimeException(
                    'No se pudo crear el sandbox base de previews.'
                );
            }
        }

        if (! is_dir($submissionRoot)) {
            if (
                ! mkdir(
                    $submissionRoot,
                    0775,
                    true
                ) &&
                ! is_dir($submissionRoot)
            ) {
                throw new RuntimeException(
                    'No se pudo crear el sandbox de la solicitud.'
                );
            }

            $createdSubmissionRoot = true;
        }

        $workRoot =
            $submissionRoot .
            DIRECTORY_SEPARATOR .
            '_approval_plan_' .
            Str::uuid()->toString();

        $rawPlan = null;

        try {
            $rawPlan =
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
                        ],
                        $workRoot
                    );

            $this->assertUniqueTargets(
                $rawPlan
            );

            $setIds =
                array_values(
                    array_map(
                        'strval',
                        is_array(
                            $rawPlan[
                                'set_ids'
                            ] ?? null
                        )
                            ? $rawPlan[
                                'set_ids'
                            ]
                            : []
                    )
                );

            $files = [];

            foreach (
                is_array(
                    $rawPlan['files'] ?? null
                )
                    ? $rawPlan['files']
                    : []
                as $file
            ) {
                if (! is_array($file)) {
                    continue;
                }

                $files[] = [
                    'kind' =>
                        (string) (
                            $file[
                                'kind'
                            ] ?? ''
                        ),
                    'target' =>
                        (string) (
                            $file[
                                'target'
                            ] ?? ''
                        ),
                ];
            }

            $acquisitionMethod =
                (string)
                $submission
                    ->intended_acquisition_method;

            $publicId =
                (int)
                $ids[
                    'public_base_item_id'
                ];

            $designerId =
                (int)
                $ids[
                    'designer_base_item_id'
                ];

            $catalogItemId =
                (int)
                $ids[
                    'catalog_item_id'
                ];

            $staffPageId =
                $this->staffCatalog
                    ->pageIdFor(
                        $acquisitionMethod
                    );

            $staffSection =
                $this->staffCatalog
                    ->sectionFor(
                        $acquisitionMethod
                    );

            $databaseRows = [
                [
                    'table' => 'items_base',
                    'record' => [
                        'id' => $publicId,
                        'sprite_id' =>
                            $publicId,
                        'item_name' =>
                            $redeemableCode,
                        'public_name' =>
                            (string)
                            $submission
                                ->clothing_name,
                        'interaction_type' =>
                            'clothing',
                        'allow_trade' => 1,
                        'allow_gift' => 1,
                    ],
                ],
                [
                    'table' => 'items_base',
                    'record' => [
                        'id' => $designerId,
                        'sprite_id' =>
                            $publicId,
                        'item_name' =>
                            $redeemableCode,
                        'public_name' =>
                            (string)
                            $submission
                                ->clothing_name,
                        'interaction_type' =>
                            'clothing',
                        'allow_trade' => 0,
                        'allow_gift' => 0,
                    ],
                ],
                [
                    'table' =>
                        'catalog_clothing',
                    'record' => [
                        'name' =>
                            $redeemableCode,
                        'setid' =>
                            implode(
                                ',',
                                $setIds
                            ),
                    ],
                ],
                [
                    'table' =>
                        'catalog_items',
                    'record' => [
                        'id' =>
                            $catalogItemId,
                        'item_ids' =>
                            (string)
                            $publicId,
                        'page_id' =>
                            $staffPageId,
                        'catalog_name' =>
                            (string)
                            $submission
                                ->clothing_name,
                        'cost_credits' => 0,
                        'amount' => 1,
                    ],
                ],
                [
                    'table' =>
                        'clothing_products',
                    'record' => [
                        'id' => '(auto)',
                        'clothing_submission_id' =>
                            (int)
                            $submission->id,
                        'creator_user_id' =>
                            $submission
                                ->creator_user_id,
                        'name' =>
                            (string)
                            $submission
                                ->clothing_name,
                        'package_kind' =>
                            (string)
                            $submission
                                ->package_kind,
                        'piece_count' =>
                            (int)
                            $submission
                                ->piece_count,
                        'status' => 'draft',
                        'web_visible' => false,
                        'redeemable_base_item_id' =>
                            $publicId,
                        'designer_reward_base_item_id' =>
                            $designerId,
                        'staff_catalog_section' =>
                            $staffSection,
                    ],
                ],
                [
                    'table' =>
                        'biribiri_clothing_metadata',
                    'record' => [
                        'rows' =>
                            count(
                                $setIds
                            ),
                        'figure_set_ids' =>
                            $setIds,
                        'display_name' =>
                            (string)
                            $submission
                                ->clothing_name,
                        'source' =>
                            'importer',
                    ],
                ],
                [
                    'table' =>
                        'biribiri_clothing_tags',
                    'record' => [
                        'rows' =>
                            trim(
                                (string)
                                $submission->tag
                            ) === ''
                                ? 0
                                : count(
                                    $setIds
                                ),
                        'figure_set_ids' =>
                            $setIds,
                        'tag' =>
                            $submission->tag,
                    ],
                ],
                [
                    'table' =>
                        'clothing_submissions',
                    'record' => [
                        'id' =>
                            (int)
                            $submission->id,
                        'status' =>
                            'approved',
                        'clothing_catalog_id' =>
                            '(auto)',
                        'redeemable_base_item_id' =>
                            $publicId,
                        'designer_reward_base_item_id' =>
                            $designerId,
                        'approved_at' =>
                            '(momento de aprobación)',
                    ],
                ],
            ];

            return [
                'generated_at' =>
                    now()->toIso8601String(),
                'submission_id' =>
                    (int)
                    $submission->id,
                'clothing_name' =>
                    (string)
                    $submission
                        ->clothing_name,
                'tag' =>
                    $submission->tag,
                'package_kind' =>
                    (string)
                    $submission
                        ->package_kind,
                'piece_count' =>
                    (int)
                    $submission
                        ->piece_count,
                'final_category' =>
                    $submission
                        ->final_category,
                'acquisition_method' =>
                    $acquisitionMethod,
                'redeemable_code' =>
                    (string) (
                        $rawPlan[
                            'redeemable_code'
                        ] ??
                        $redeemableCode
                    ),
                'source_redeemable_code' =>
                    (string) (
                        $rawPlan[
                            'source_redeemable_code'
                        ] ?? ''
                    ),
                'ids' => [
                    'public_base_item_id' =>
                        $publicId,
                    'designer_base_item_id' =>
                        $designerId,
                    'catalog_item_id' =>
                        $catalogItemId,
                    'staff_catalog_page_id' =>
                        $staffPageId,
                ],
                'set_ids' =>
                    $setIds,
                'figure_set_map' =>
                    is_array(
                        $rawPlan[
                            'figure_set_map'
                        ] ?? null
                    )
                        ? $rawPlan[
                            'figure_set_map'
                        ]
                        : [],
                'part_id_map' =>
                    is_array(
                        $rawPlan[
                            'part_id_map'
                        ] ?? null
                    )
                        ? $rawPlan[
                            'part_id_map'
                        ]
                        : [],
                'figure_library_map' =>
                    is_array(
                        $rawPlan[
                            'figure_library_map'
                        ] ?? null
                    )
                        ? $rawPlan[
                            'figure_library_map'
                        ]
                        : [],
                'pieces' =>
                    is_array(
                        $rawPlan[
                            'pieces'
                        ] ?? null
                    )
                        ? $rawPlan[
                            'pieces'
                        ]
                        : [],
                'files' =>
                    $files,
                'database' =>
                    $databaseRows,
                'side_effects' => [
                    'database_writes' => 0,
                    'live_assets_written' =>
                        false,
                    'prepared_files_persisted' =>
                        false,
                ],
            ];
        } finally {
            $this->deleteTree(
                $workRoot
            );

            if (
                $createdSubmissionRoot &&
                is_dir(
                    $submissionRoot
                ) &&
                $this->directoryIsEmpty(
                    $submissionRoot
                )
            ) {
                @rmdir(
                    $submissionRoot
                );
            }
        }
    }

    private function assertIdentityAvailable(
        ClothingSubmission $submission,
        string $redeemableCode
    ): void {
        $lower =
            mb_strtolower(
                $redeemableCode
            );

        $itemBase =
            DB::table(
                'items_base'
            )
                ->whereRaw(
                    'LOWER(item_name) = ?',
                    [$lower]
                )
                ->first([
                    'id',
                    'item_name',
                ]);

        if ($itemBase !== null) {
            throw new RuntimeException(
                'Aprobación bloqueada: ya existe la identidad técnica "' .
                $redeemableCode .
                '" en items_base #' .
                $itemBase->id .
                '. Cambia el nombre de la ropa y vuelve a generar el plan.'
            );
        }

        $catalogClothing =
            DB::table(
                'catalog_clothing'
            )
                ->whereRaw(
                    'LOWER(name) = ?',
                    [$lower]
                )
                ->first([
                    'id',
                    'name',
                ]);

        if (
            $catalogClothing !== null
        ) {
            throw new RuntimeException(
                'Aprobación bloqueada: ya existe la identidad técnica "' .
                $redeemableCode .
                '" en catalog_clothing #' .
                $catalogClothing->id .
                '. Cambia el nombre de la ropa y vuelve a generar el plan.'
            );
        }

        $others =
            ClothingSubmission::query()
                ->whereKeyNot(
                    $submission->id
                )
                ->whereNotIn(
                    'status',
                    ['rejected']
                )
                ->get([
                    'id',
                    'clothing_name',
                    'created_at',
                ]);

        foreach ($others as $other) {
            try {
                $otherCode =
                    $this->codes
                        ->redeemableCode(
                            $other
                        );
            } catch (\Throwable) {
                continue;
            }

            if (
                strcasecmp(
                    $otherCode,
                    $redeemableCode
                ) !== 0
            ) {
                continue;
            }

            throw new RuntimeException(
                'Aprobación bloqueada: la solicitud #' .
                $other->id .
                ' ("' .
                $other->clothing_name .
                '") produce la misma identidad técnica "' .
                $redeemableCode .
                '". Cambia el nombre, por ejemplo añadiendo "II", y vuelve a generar el plan.'
            );
        }
    }

    private function assertUniqueTargets(
        array $plan
    ): void {
        $seen = [];

        foreach (
            is_array(
                $plan['files'] ?? null
            )
                ? $plan['files']
                : []
            as $file
        ) {
            if (! is_array($file)) {
                continue;
            }

            $target =
                strtolower(
                    str_replace(
                        '\\',
                        '/',
                        trim(
                            (string) (
                                $file[
                                    'target'
                                ] ?? ''
                            )
                        )
                    )
                );

            if ($target === '') {
                continue;
            }

            if (isset($seen[$target])) {
                throw new RuntimeException(
                    'Aprobación bloqueada: dos piezas del paquete producirían el mismo asset final. Revisa los nombres/códigos de las piezas.'
                );
            }

            $seen[$target] = true;
        }
    }

    private function deleteTree(
        string $path
    ): void {
        if (! is_dir($path)) {
            return;
        }

        $iterator =
            new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator(
                    $path,
                    \FilesystemIterator::SKIP_DOTS
                ),
                \RecursiveIteratorIterator::CHILD_FIRST
            );

        foreach ($iterator as $entry) {
            if ($entry->isDir()) {
                @rmdir(
                    $entry->getPathname()
                );
            } else {
                @unlink(
                    $entry->getPathname()
                );
            }
        }

        @rmdir(
            $path
        );
    }

    private function directoryIsEmpty(
        string $path
    ): bool {
        if (! is_dir($path)) {
            return true;
        }

        $iterator =
            new \FilesystemIterator(
                $path
            );

        return ! $iterator->valid();
    }
}
