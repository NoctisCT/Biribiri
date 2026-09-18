<?php

namespace App\Services\Clothing;

use App\Models\ClothingSubmission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use RuntimeException;
use Throwable;

/*
 * HISTORICAL NAME:
 * P11.5/P11.6 creó esta clase como sistema de reservas manuales.
 * Desde P11.8 NO existe reserva manual para diseñadores.
 *
 * La tabla se reutiliza como allocator interno estable:
 *   source_part_id (RAR/SWF origen) -> part_id (ID final Biribiri)
 *
 * El diseñador jamás tiene que conocer el rango Biribiri.
 */
class ClothingPartIdReservationService
{
    private const LOCK_NAME =
        'biribiri_clothing_part_id_allocate';

    public function validateSubmission(
        ClothingSubmission $submission,
        array $manifest
    ): array {
        $this->assertSchema();

        $errors = [];
        $warnings = [];

        $sourcePartIds =
            $this->normalizePartIds(
                is_array(
                    $manifest[
                        'figuredata'
                    ][
                        'part_ids'
                    ] ?? null
                )
                    ? $manifest[
                        'figuredata'
                    ][
                        'part_ids'
                    ]
                    : []
            );

        if ($sourcePartIds === []) {
            return [
                'valid' => false,
                'errors' => [
                    'El paquete no declara Part IDs de origen.',
                ],
                'warnings' => [],
                'source_part_ids' => [],
                'biribiri_part_ids' => [],
                'source_to_biribiri' => [],
            ];
        }

        $figureMapIds =
            $this->manifestFigureMapPartIds(
                $manifest
            );

        foreach (
            $this->ambiguousSourcePartIds(
                $manifest
            )
            as $message
        ) {
            $errors[] = $message;
        }

        $checkFigureData =
            $sourcePartIds;

        $checkFigureMap =
            $figureMapIds;

        sort($checkFigureData);
        sort($checkFigureMap);

        if ($checkFigureData !== $checkFigureMap) {
            $missingFromMap = array_values(
                array_diff(
                    $checkFigureData,
                    $checkFigureMap
                )
            );

            $missingFromData = array_values(
                array_diff(
                    $checkFigureMap,
                    $checkFigureData
                )
            );

            if ($missingFromMap !== []) {
                $errors[] =
                    'Part IDs presentes en FigureData pero no en FigureMap: ' .
                    implode(', ', $missingFromMap) .
                    '.';
            }

            if ($missingFromData !== []) {
                $errors[] =
                    'Part IDs presentes en FigureMap pero no en FigureData: ' .
                    implode(', ', $missingFromData) .
                    '.';
            }
        }

        if ($errors !== []) {
            return [
                'valid' => false,
                'errors' => $errors,
                'warnings' => $warnings,
                'source_part_ids' =>
                    $sourcePartIds,
                'biribiri_part_ids' => [],
                'source_to_biribiri' => [],
            ];
        }

        return $this->withLock(
            function () use (
                $submission,
                $sourcePartIds,
                $warnings
            ): array {
                return DB::transaction(
                    function () use (
                        $submission,
                        $sourcePartIds,
                        $warnings
                    ): array {
                        $table =
                            'clothing_part_id_reservations';

                        $existingRows =
                            DB::table($table)
                                ->where(
                                    'claimed_submission_id',
                                    (int) $submission->id
                                )
                                ->orderBy(
                                    'source_part_id'
                                )
                                ->lockForUpdate()
                                ->get();

                        $existingBySource = [];

                        foreach ($existingRows as $row) {
                            if ($row->source_part_id === null) {
                                throw new RuntimeException(
                                    'La submission #' .
                                    $submission->id .
                                    ' conserva una reserva manual antigua sin source_part_id. Ejecuta la migración P11.8 antes de restage.'
                                );
                            }

                            $source =
                                (int) $row->source_part_id;

                            $final =
                                (int) $row->part_id;

                            if (
                                $source <= 0 ||
                                $final <= 0
                            ) {
                                throw new RuntimeException(
                                    'Mapeo Part ID inválido ya guardado para submission #' .
                                    $submission->id .
                                    '.'
                                );
                            }

                            if (
                                isset(
                                    $existingBySource[
                                        (string) $source
                                    ]
                                )
                            ) {
                                throw new RuntimeException(
                                    'source_part_id duplicado en allocator interno: ' .
                                    $source .
                                    '.'
                                );
                            }

                            $existingBySource[
                                (string) $source
                            ] = $final;
                        }

                        if ($existingBySource !== []) {
                            $storedSources =
                                array_map(
                                    'intval',
                                    array_keys(
                                        $existingBySource
                                    )
                                );

                            sort($storedSources);

                            $currentSources =
                                $sourcePartIds;

                            sort($currentSources);

                            if ($storedSources !== $currentSources) {
                                throw new RuntimeException(
                                    'Los Part IDs de origen de la submission #' .
                                    $submission->id .
                                    ' han cambiado después de asignar IDs Biribiri. No se reutilizan mappings ambiguos.'
                                );
                            }
                        }

                        $start = (int) config(
                            'clothing_marketplace.installer.id_ranges.figure_part_start',
                            1800000000
                        );

                        $max = (int) config(
                            'clothing_marketplace.installer.id_ranges.figure_part_max',
                            1899999999
                        );

                        if (
                            $start <= 0 ||
                            $max < $start
                        ) {
                            throw new RuntimeException(
                                'Rango figure_part Biribiri inválido.'
                            );
                        }

                        $liveLookup =
                            array_fill_keys(
                                array_map(
                                    'strval',
                                    $this->livePartIds()
                                ),
                                true
                            );

                        $allocatedLookup = [];

                        foreach (
                            DB::table($table)
                                ->pluck('part_id')
                            as $value
                        ) {
                            $allocatedLookup[
                                (string) (int) $value
                            ] = true;
                        }

                        /*
                         * Un destino tampoco puede ser igual a un ID de origen
                         * del mismo paquete. Así el remapeo es siempre explícito
                         * y auditable, incluso si el source cae por casualidad en
                         * el rango Biribiri.
                         */
                        $sourceLookup =
                            array_fill_keys(
                                array_map(
                                    'strval',
                                    $sourcePartIds
                                ),
                                true
                            );

                        $maxAllocated =
                            (int) (
                                DB::table($table)
                                    ->whereBetween(
                                        'part_id',
                                        [
                                            $start,
                                            $max,
                                        ]
                                    )
                                    ->max('part_id')
                                ?? 0
                            );

                        $next = max(
                            $start,
                            $maxAllocated > 0
                                ? $maxAllocated + 1
                                : $start
                        );

                        $group =
                            $existingRows->isNotEmpty()
                                ? (string) $existingRows->first()->reservation_group
                                : (string) Str::uuid();

                        $now = now();
                        $rows = [];
                        $mapping =
                            $existingBySource;

                        foreach (
                            $sourcePartIds
                            as $sourcePartId
                        ) {
                            $sourceKey =
                                (string) $sourcePartId;

                            if (isset($mapping[$sourceKey])) {
                                continue;
                            }

                            while ($next <= $max) {
                                $candidateKey =
                                    (string) $next;

                                if (
                                    ! isset(
                                        $liveLookup[
                                            $candidateKey
                                        ]
                                    ) &&
                                    ! isset(
                                        $allocatedLookup[
                                            $candidateKey
                                        ]
                                    ) &&
                                    ! isset(
                                        $sourceLookup[
                                            $candidateKey
                                        ]
                                    )
                                ) {
                                    break;
                                }

                                $next++;
                            }

                            if ($next > $max) {
                                throw new RuntimeException(
                                    'No quedan Figure Part IDs libres en el rango Biribiri.'
                                );
                            }

                            $finalPartId =
                                $next;

                            $next++;

                            $mapping[
                                $sourceKey
                            ] = $finalPartId;

                            $allocatedLookup[
                                (string) $finalPartId
                            ] = true;

                            $rows[] = [
                                /*
                                 * part_id = ID FINAL BIRIBIRI.
                                 * source_part_id = ID original del RAR/SWF.
                                 */
                                'part_id' =>
                                    $finalPartId,
                                'source_part_id' =>
                                    $sourcePartId,
                                'reservation_group' =>
                                    $group,
                                'account_id' =>
                                    (int) $submission->account_id,
                                'creator_user_id' =>
                                    $submission->creator_user_id !== null
                                        ? (int) $submission->creator_user_id
                                        : null,
                                'claimed_submission_id' =>
                                    (int) $submission->id,
                                'source' =>
                                    'auto_remap',
                                'status' =>
                                    'allocated',
                                'created_at' =>
                                    $now,
                                'updated_at' =>
                                    $now,
                            ];
                        }

                        if ($rows !== []) {
                            DB::table($table)
                                ->insert($rows);
                        }

                        $orderedMap = [];

                        foreach ($sourcePartIds as $source) {
                            $key = (string) $source;

                            if (! isset($mapping[$key])) {
                                throw new RuntimeException(
                                    'Allocator incompleto para source Part ID ' .
                                    $source .
                                    '.'
                                );
                            }

                            $orderedMap[$key] =
                                (string) $mapping[$key];
                        }

                        $biribiriPartIds =
                            array_values(
                                $orderedMap
                            );

                        return [
                            'valid' => true,
                            'errors' => [],
                            'warnings' => array_values(
                                array_unique(
                                    array_merge(
                                        $warnings,
                                        [
                                            'Los Part IDs del RAR se tratan como IDs de origen y Biribiri los remapea automáticamente; no necesitan estar libres ni reservados previamente.',
                                        ]
                                    )
                                )
                            ),
                            'mode' =>
                                'automatic_remap',
                            'source_part_ids' =>
                                array_map(
                                    'strval',
                                    $sourcePartIds
                                ),
                            'biribiri_part_ids' =>
                                $biribiriPartIds,
                            'source_to_biribiri' =>
                                $orderedMap,
                            'new_allocations' =>
                                count($rows),
                            'reservation_group' =>
                                $group,
                        ];
                    }
                );
            }
        );
    }

    /*
     * Compatibilidad defensiva: la reserva manual ya NO forma parte
     * del producto. Si quedase una llamada antigua, falla claramente.
     */
    public function reserve(
        int $accountId,
        ?int $creatorUserId,
        int $count
    ): array {
        throw new RuntimeException(
            'La reserva manual de Part IDs está desactivada. Biribiri remapea automáticamente los IDs del RAR.'
        );
    }

    private function ambiguousSourcePartIds(
        array $manifest
    ): array {
        $usage = [];

        foreach (
            is_array(
                $manifest[
                    'figuremap'
                ][
                    'part_mappings'
                ] ?? null
            )
                ? $manifest[
                    'figuremap'
                ][
                    'part_mappings'
                ]
                : []
            as $part
        ) {
            if (! is_array($part)) {
                continue;
            }

            $id = trim(
                (string) (
                    $part['id'] ?? ''
                )
            );

            if ($id === '') {
                continue;
            }

            $library = trim(
                (string) (
                    $part['library'] ?? ''
                )
            );

            $type = strtolower(
                trim(
                    (string) (
                        $part['type'] ?? ''
                    )
                )
            );

            $usage[$id][] = [
                'library' => $library,
                'type' => $type,
            ];
        }

        $errors = [];

        foreach ($usage as $id => $rows) {
            $libraries = [];
            $types = [];

            foreach ($rows as $row) {
                if ($row['library'] !== '') {
                    $libraries[] =
                        $row['library'];
                }

                if ($row['type'] !== '') {
                    $types[] =
                        $row['type'];
                }
            }

            $libraries = array_values(
                array_unique($libraries)
            );

            $types = array_values(
                array_unique($types)
            );

            if (
                count($libraries) > 1 ||
                count($types) > 1
            ) {
                $errors[] =
                    'El source Part ID ' .
                    $id .
                    ' se reutiliza de forma ambigua en el paquete (' .
                    implode(', ', $libraries) .
                    '; tipos ' .
                    implode(', ', $types) .
                    '). Cada capa/prenda debe tener su propio ID de origen para poder remapearla automáticamente.';
            }
        }

        return $errors;
    }

    private function manifestFigureMapPartIds(
        array $manifest
    ): array {
        $ids = [];

        foreach (
            is_array(
                $manifest[
                    'figuremap'
                ][
                    'part_mappings'
                ] ?? null
            )
                ? $manifest[
                    'figuremap'
                ][
                    'part_mappings'
                ]
                : []
            as $part
        ) {
            if (! is_array($part)) {
                continue;
            }

            $value = trim(
                (string) (
                    $part['id'] ?? ''
                )
            );

            if (
                $value !== '' &&
                ctype_digit($value)
            ) {
                $ids[] =
                    (int) $value;
            }
        }

        $ids = array_values(
            array_unique($ids)
        );

        sort($ids);

        return $ids;
    }

    private function normalizePartIds(
        array $partIds
    ): array {
        $normalized = [];

        foreach ($partIds as $value) {
            $text = trim(
                (string) $value
            );

            if (
                $text === '' ||
                ! ctype_digit($text)
            ) {
                throw new RuntimeException(
                    'Part ID de origen no numérico en el paquete: "' .
                    $text .
                    '".'
                );
            }

            $number = (int) $text;

            if ($number <= 0) {
                throw new RuntimeException(
                    'Part ID de origen inválido: ' .
                    $text .
                    '.'
                );
            }

            $normalized[] =
                $number;
        }

        $normalized =
            array_values(
                array_unique(
                    $normalized
                )
            );

        sort($normalized);

        return $normalized;
    }

    private function livePartIds(): array
    {
        $path = public_path(
            'nitro-assets/gamedata/FigureMap.json'
        );

        if (! is_file($path)) {
            throw new RuntimeException(
                'No existe FigureMap.json vivo: ' .
                $path
            );
        }

        $raw = file_get_contents(
            $path
        );

        if ($raw === false) {
            throw new RuntimeException(
                'No se pudo leer FigureMap.json vivo.'
            );
        }

        $data = json_decode(
            $raw,
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        $libraries = is_array(
            $data['libraries'] ?? null
        )
            ? $data['libraries']
            : [];

        $ids = [];

        foreach ($libraries as $library) {
            if (! is_array($library)) {
                continue;
            }

            foreach (
                is_array(
                    $library['parts'] ?? null
                )
                    ? $library['parts']
                    : []
                as $part
            ) {
                if (! is_array($part)) {
                    continue;
                }

                $value = trim(
                    (string) (
                        $part['id'] ?? ''
                    )
                );

                if (
                    $value !== '' &&
                    ctype_digit($value)
                ) {
                    $number =
                        (int) $value;

                    if ($number > 0) {
                        $ids[] =
                            $number;
                    }
                }
            }
        }

        return array_values(
            array_unique($ids)
        );
    }

    private function assertSchema(): void
    {
        if (
            ! Schema::hasTable(
                'clothing_part_id_reservations'
            ) ||
            ! Schema::hasColumn(
                'clothing_part_id_reservations',
                'source_part_id'
            )
        ) {
            throw new RuntimeException(
                'El allocator automático de Part IDs no está migrado.'
            );
        }
    }

    private function withLock(
        callable $callback
    ): mixed {
        $row = DB::selectOne(
            'SELECT GET_LOCK(?, 10) AS acquired',
            [
                self::LOCK_NAME,
            ]
        );

        if (
            $row === null ||
            (int) ($row->acquired ?? 0) !== 1
        ) {
            throw new RuntimeException(
                'No se pudo adquirir el bloqueo global del allocator de Part IDs.'
            );
        }

        try {
            return $callback();
        } catch (Throwable $exception) {
            throw $exception;
        } finally {
            DB::selectOne(
                'SELECT RELEASE_LOCK(?) AS released',
                [
                    self::LOCK_NAME,
                ]
            );
        }
    }
}
