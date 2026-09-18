<?php

namespace App\Services\Clothing;

use App\Models\ClothingSubmission;
use Illuminate\Support\Str;
use RuntimeException;

class ClothingStagingService
{
    public function __construct(
        private readonly ClothingArchiveExtractor $extractor,
        private readonly ClothingPackageInspector $inspector,
        private readonly ClothingTechnicalIdentityService $identityService,
        private readonly ClothingCollisionService $collisionService,
        private readonly ClothingPackagePieceResolver $pieceResolver,
        private readonly ClothingPartIdReservationService $partIdReservations
    ) {
    }

    public function stage(
        ClothingSubmission $submission,
        string $archivePath
    ): array {
        if (
            ! in_array(
                $submission->status,
                ['pending', 'import_failed'],
                true
            )
        ) {
            throw new RuntimeException(
                'La solicitud no está en un estado que permita staging.'
            );
        }

        $token = Str::uuid()->toString();

        $destination = storage_path(
            'app/clothing_importer/staging/' .
            $submission->id .
            '/' .
            $token
        );

        $submission->forceFill([
            'technical_status' => 'checking',
            'technical_report' => null,
            'preview_manifest' => null,
        ])->save();

        try {
            $files = $this->extractor->extract(
                $archivePath,
                $destination
            );

            $report = $this->inspector->inspect(
                $destination
            );

            $report['staging'] = [
                'token' => $token,
                'relative_root' =>
                    'clothing_importer/staging/' .
                    $submission->id .
                    '/' .
                    $token,
                /*
                 * No persistimos los nombres devueltos por 7z/UnRAR:
                 * en Windows pueden venir en la codepage de consola y
                 * contaminar technical_report con bytes no UTF-8.
                 * Las rutas funcionales salen del manifest generado al
                 * recorrer el staging real.
                 */
                'extracted_file_count' => count($files),
            ];

            if ($report['valid']) {
                $identity =
                    $this->identityService->analyze(
                        $report['manifest']
                    );

                $report['identity'] = $identity;

                foreach (
                    $identity['warnings'] ?? []
                    as $warning
                ) {
                    $report['warnings'][] =
                        $warning;
                }

                if (! ($identity['valid'] ?? false)) {
                    $report['valid'] = false;

                    foreach (
                        $identity['errors'] ?? []
                        as $error
                    ) {
                        $report['errors'][] =
                            $error;
                    }
                }
            }

            if (
                $report['valid'] &&
                isset($report['identity']) &&
                is_array($report['identity'])
            ) {
                $pieces =
                    $this->pieceResolver->resolve(
                        $report['manifest'],
                        $report['identity']
                    );

                $report['pieces'] = $pieces;

                foreach (
                    $pieces['warnings'] ?? []
                    as $warning
                ) {
                    $report['warnings'][] =
                        $warning;
                }

                if (! ($pieces['valid'] ?? false)) {
                    $report['valid'] = false;

                    foreach (
                        $pieces['errors'] ?? []
                        as $error
                    ) {
                        $report['errors'][] =
                            $error;
                    }
                }
            }

            if (
                $report['valid'] &&
                isset($report['identity']) &&
                is_array($report['identity'])
            ) {
                $collisions =
                    $this->collisionService->check(
                        $report['identity'],
                        (int) $submission->id
                    );

                $report['collisions'] =
                    $collisions;

                foreach (
                    $collisions['warnings'] ?? []
                    as $warning
                ) {
                    $report['warnings'][] =
                        $warning;
                }

                if (
                    ! ($collisions['valid'] ?? false)
                ) {
                    $report['valid'] = false;

                    foreach (
                        $collisions['errors'] ?? []
                        as $error
                    ) {
                        $report['errors'][] =
                            $error;
                    }
                }
            }

            if ($report['valid']) {
                /*
                 * IMPORTER FIRST:
                 * los IDs que vienen en FigureData/FigureMap/SWF son
                 * IDs DE ORIGEN. No tienen que estar libres en Biribiri.
                 * Aquí se asigna un destino Biribiri estable para cada uno.
                 */
                $partRemap =
                    $this->partIdReservations
                        ->validateSubmission(
                            $submission,
                            $report['manifest']
                        );

                $report['part_id_remap'] =
                    $partRemap;

                foreach (
                    $partRemap['warnings'] ?? []
                    as $warning
                ) {
                    $report['warnings'][] =
                        $warning;
                }

                if (
                    ! (
                        $partRemap[
                            'valid'
                        ] ?? false
                    )
                ) {
                    $report['valid'] = false;

                    foreach (
                        $partRemap['errors'] ?? []
                        as $error
                    ) {
                        $report['errors'][] =
                            $error;
                    }
                } else {
                    $mapping = is_array(
                        $partRemap[
                            'source_to_biribiri'
                        ] ?? null
                    )
                        ? $partRemap[
                            'source_to_biribiri'
                        ]
                        : [];

                    if (
                        isset(
                            $report['pieces'][
                                'pieces'
                            ]
                        ) &&
                        is_array(
                            $report['pieces'][
                                'pieces'
                            ]
                        )
                    ) {
                        foreach (
                            $report['pieces'][
                                'pieces'
                            ]
                            as &$piece
                        ) {
                            if (! is_array($piece)) {
                                continue;
                            }

                            $sourceIds = array_values(
                                array_unique(
                                    array_map(
                                        'strval',
                                        is_array(
                                            $piece[
                                                'source_part_ids'
                                            ] ??
                                            $piece[
                                                'part_ids'
                                            ] ??
                                            null
                                        )
                                            ? (
                                                $piece[
                                                    'source_part_ids'
                                                ] ??
                                                $piece[
                                                    'part_ids'
                                                ]
                                            )
                                            : []
                                    )
                                )
                            );

                            $finalIds = [];
                            $pieceMap = [];

                            foreach (
                                $sourceIds
                                as $sourceId
                            ) {
                                if (
                                    ! isset(
                                        $mapping[
                                            $sourceId
                                        ]
                                    )
                                ) {
                                    throw new RuntimeException(
                                        'Falta mapping Biribiri para source Part ID ' .
                                        $sourceId .
                                        '.'
                                    );
                                }

                                $finalId =
                                    (string)
                                    $mapping[$sourceId];

                                $pieceMap[
                                    $sourceId
                                ] = $finalId;

                                $finalIds[] =
                                    $finalId;
                            }

                            $piece[
                                'source_part_ids'
                            ] = $sourceIds;

                            /*
                             * part_ids se deja como origen por compatibilidad
                             * de diagnóstico. Los IDs finales tienen un campo
                             * explícito para no mezclarlos nunca.
                             */
                            $piece[
                                'part_ids'
                            ] = $sourceIds;

                            $piece[
                                'biribiri_part_ids'
                            ] = $finalIds;

                            $piece[
                                'part_id_map'
                            ] = $pieceMap;

                            if (
                                isset(
                                    $piece['libraries']
                                ) &&
                                is_array(
                                    $piece['libraries']
                                )
                            ) {
                                foreach (
                                    $piece['libraries']
                                    as &$library
                                ) {
                                    if (! is_array($library)) {
                                        continue;
                                    }

                                    $librarySourceIds =
                                        array_values(
                                            array_unique(
                                                array_map(
                                                    'strval',
                                                    is_array(
                                                        $library[
                                                            'part_ids'
                                                        ] ?? null
                                                    )
                                                        ? $library[
                                                            'part_ids'
                                                        ]
                                                        : []
                                                )
                                            )
                                        );

                                    $libraryFinalIds = [];

                                    foreach (
                                        $librarySourceIds
                                        as $sourceId
                                    ) {
                                        if (
                                            ! isset(
                                                $mapping[
                                                    $sourceId
                                                ]
                                            )
                                        ) {
                                            throw new RuntimeException(
                                                'Falta mapping de library para source Part ID ' .
                                                $sourceId .
                                                '.'
                                            );
                                        }

                                        $libraryFinalIds[] =
                                            (string)
                                            $mapping[$sourceId];
                                    }

                                    $library[
                                        'source_part_ids'
                                    ] =
                                        $librarySourceIds;

                                    $library[
                                        'biribiri_part_ids'
                                    ] =
                                        $libraryFinalIds;
                                }

                                unset($library);
                            }
                        }

                        unset($piece);
                    }
                }
            }

            $identity = is_array(
                $report['identity'] ?? null
            )
                ? $report['identity']
                : [];

            $pieces = is_array(
                $report['pieces'] ?? null
            )
                ? $report['pieces']
                : [];

            $submission->forceFill([
                'technical_status' =>
                    $report['valid']
                        ? 'valid'
                        : 'invalid',
                'technical_report' =>
                    $report,

                /*
                 * El diseñador no introduce códigos.
                 * Se derivan del propio paquete.
                 */
                'clothing_code' =>
                    $identity[
                        'logical_clothing_code'
                    ] ?? null,

                'clothing_library_codes' =>
                    $identity[
                        'clothing_library_codes'
                    ] ?? null,

                'redeemable_furni_code' =>
                    $identity[
                        'redeemable_furni_code'
                    ] ?? null,

                'source_fingerprint' =>
                    $identity[
                        'source_fingerprint'
                    ] ?? null,

                /*
                 * Se deriva solo del paquete:
                 * 1 prenda = single
                 * 2+ prendas = set
                 */
                'package_kind' =>
                    $pieces[
                        'package_kind'
                    ] ?? 'single',

                'piece_count' =>
                    (int) (
                        $pieces[
                            'piece_count'
                        ] ?? 0
                    ),

                'piece_manifest' =>
                    $pieces,
            ])->save();

            $report['warnings'] =
                array_values(
                    array_unique(
                        $report['warnings'] ?? []
                    )
                );

            $report['errors'] =
                array_values(
                    array_unique(
                        $report['errors'] ?? []
                    )
                );

            return $report;
        } catch (\Throwable $exception) {
            $submission->forceFill([
                'technical_status' => 'invalid',
                'technical_report' => [
                    'valid' => false,
                    'errors' => [
                        $exception->getMessage(),
                    ],
                    'warnings' => [],
                ],
            ])->save();

            throw $exception;
        }
    }
}
