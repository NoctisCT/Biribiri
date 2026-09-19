<?php

namespace App\Services\Clothing;

use App\Models\ClothingSubmission;
use Illuminate\Support\Str;
use RuntimeException;

class ClothingGamedataInstaller
{
    public function __construct(
        private readonly ClothingNitroConverterService $converter,
        private readonly ClothingRedeemableNitroService $redeemableNitro,
        private readonly ClothingNitroPartIdRemapperService $partIdRemapper,
        private readonly ClothingBiribiriCodeService $biribiriCode
    ) {
    }

    public function prepare(
        ClothingSubmission $submission,
        int $publicBaseItemId,
        int $catalogItemId,
        ?string $previewWorkRoot = null
    ): array {
        $report = $submission->technical_report;

        if (
            ! is_array($report) ||
            ! ($report['valid'] ?? false)
        ) {
            throw new RuntimeException(
                'La solicitud no tiene QA técnico válido.'
            );
        }

        $manifest = is_array(
            $report['manifest'] ?? null
        )
            ? $report['manifest']
            : [];

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

        $partRemap = is_array(
            $report['part_id_remap'] ?? null
        )
            ? $report['part_id_remap']
            : [];

        $partIdMap = is_array(
            $partRemap['source_to_biribiri'] ?? null
        )
            ? $partRemap['source_to_biribiri']
            : [];

        if (
            ! ($partRemap['valid'] ?? false) ||
            $partIdMap === []
        ) {
            throw new RuntimeException(
                'La solicitud no tiene un mapping source Part ID -> Biribiri válido.'
            );
        }

        $stagingRelative = trim(
            (string) (
                $report['staging'][
                    'relative_root'
                ] ?? ''
            )
        );

        if ($stagingRelative === '') {
            throw new RuntimeException(
                'Falta la ruta de staging.'
            );
        }

        $staging = storage_path(
            'app/' .
            ltrim(
                str_replace(
                    '\\',
                    '/',
                    $stagingRelative
                ),
                '/'
            )
        );

        if (! is_dir($staging)) {
            throw new RuntimeException(
                'No existe el staging: ' .
                $staging
            );
        }

        $sourceRedeemableCode = trim(
            (string) (
                $identity[
                    'redeemable_furni_code'
                ] ?? ''
            )
        );

        if ($sourceRedeemableCode === '') {
            throw new RuntimeException(
                'Falta código técnico fuente del furni.'
            );
        }

        $redeemableCode =
            $this->biribiriCode
                ->redeemableCode(
                    $submission
                );

        $work =
            $previewWorkRoot !== null
                ? $this->previewWorkRoot(
                    $previewWorkRoot
                )
                : storage_path(
                    'app/clothing_importer/install-prepared/' .
                    $submission->id .
                    '/' .
                    Str::uuid()->toString()
                );

        $this->ensureDirectory($work);

        $files = [];
        $figureLibraryMap = [];

        foreach (
            is_array(
                $manifest[
                    'clothing_swfs'
                ] ?? null
            )
                ? $manifest[
                    'clothing_swfs'
                ]
                : []
            as $entry
        ) {
            $relative = trim(
                (string) (
                    $entry[
                        'relative_path'
                    ] ?? ''
                )
            );

            if ($relative === '') {
                continue;
            }

            $source = $this->safeStagingFile(
                $staging,
                $relative
            );

            $sourceClassName = pathinfo(
                $source,
                PATHINFO_FILENAME
            );

            $sourceCode =
                $this->sourceCodeForLibrary(
                    $pieces,
                    $sourceClassName
                );

            $className =
                $this->biribiriCode
                    ->figureLibraryCode(
                        $submission,
                        $sourceClassName,
                        $sourceCode
                    );

            if (
                isset(
                    $figureLibraryMap[
                        $sourceClassName
                    ]
                ) &&
                $figureLibraryMap[
                    $sourceClassName
                ] !== $className
            ) {
                throw new RuntimeException(
                    'Una library fuente produjo dos códigos Biribiri distintos.'
                );
            }

            $figureLibraryMap[
                $sourceClassName
            ] =
                $className;

            $figureDirectory = $work .
                DIRECTORY_SEPARATOR .
                'figure';

            $this->ensureDirectory(
                $figureDirectory
            );

            $rawPrepared = $figureDirectory .
                DIRECTORY_SEPARATOR .
                $sourceClassName .
                '.source.nitro';

            $prepared = $figureDirectory .
                DIRECTORY_SEPARATOR .
                $className .
                '.nitro';

            $this->converter->convert(
                $source,
                $rawPrepared
            );

            $library =
                $this->figureMapLibrary(
                    $manifest,
                    $sourceClassName
                );

            $librarySourceIds = [];

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

                $sourcePartId = trim(
                    (string) (
                        $part['id'] ?? ''
                    )
                );

                if ($sourcePartId !== '') {
                    $librarySourceIds[] =
                        $sourcePartId;
                }
            }

            $libraryMap =
                $this->subsetPartIdMap(
                    $partIdMap,
                    $librarySourceIds,
                    $sourceClassName
                );

            $remapResult =
                $this->partIdRemapper->remap(
                    $rawPrepared,
                    $prepared,
                    $libraryMap,
                    $sourceClassName,
                    $className
                );

            @unlink($rawPrepared);

            $files[] = [
                'kind' => 'new',
                'prepared' => $prepared,
                'target' => public_path(
                    'nitro-assets/bundled/figure/' .
                    $className .
                    '.nitro'
                ),
                'part_id_remap' =>
                    $remapResult,
            ];
        }

        $furniCandidates = is_array(
            $manifest[
                'redeemable_furni_candidates'
            ] ?? null
        )
            ? $manifest[
                'redeemable_furni_candidates'
            ]
            : [];

        if (count($furniCandidates) !== 1) {
            throw new RuntimeException(
                'Se esperaba exactamente un furni canjeable.'
            );
        }

        $furniRelative = trim(
            (string) (
                $furniCandidates[0][
                    'relative_path'
                ] ?? ''
            )
        );

        $furniSource =
            $this->safeStagingFile(
                $staging,
                $furniRelative
            );

        $furniDirectory = $work .
            DIRECTORY_SEPARATOR .
            'furniture';

        $this->ensureDirectory(
            $furniDirectory
        );

        $furniRaw = $furniDirectory .
            DIRECTORY_SEPARATOR .
            $redeemableCode .
            '.raw.nitro';

        $furniPrepared = $furniDirectory .
            DIRECTORY_SEPARATOR .
            $redeemableCode .
            '.nitro';

        $iconPrepared = $furniDirectory .
            DIRECTORY_SEPARATOR .
            $redeemableCode .
            '_icon.png';

        $this->converter->convert(
            $furniSource,
            $furniRaw
        );

        $comparatorClass = trim(
            (string) config(
                'clothing_marketplace.installer.redeemable_nitro_comparator_class',
                'clothing_r21_trainoutfit'
            )
        );

        $comparatorNitro = public_path(
            'nitro-assets/bundled/furniture/' .
            $comparatorClass .
            '.nitro'
        );

        $this->redeemableNitro->normalize(
            $furniRaw,
            $comparatorNitro,
            $furniPrepared,
            $iconPrepared,
            $redeemableCode,
            $sourceRedeemableCode
        );

        $files[] = [
            'kind' => 'new',
            'prepared' => $furniPrepared,
            'target' => public_path(
                'nitro-assets/bundled/furniture/' .
                $redeemableCode .
                '.nitro'
            ),
        ];

        $files[] = [
            'kind' => 'new',
            'prepared' => $iconPrepared,
            'target' => public_path(
                'swf/dcr/hof_furni/icons/' .
                $redeemableCode .
                '_icon.png'
            ),
        ];

        $figureMapPath = public_path(
            'nitro-assets/gamedata/FigureMap.json'
        );

        $figureDataPath = public_path(
            'nitro-assets/gamedata/FigureData.json'
        );

        $furnitureDataPath = public_path(
            'nitro-assets/gamedata/FurnitureData.json'
        );

        foreach ([
            $figureMapPath,
            $figureDataPath,
            $furnitureDataPath,
        ] as $path) {
            if (! is_file($path)) {
                throw new RuntimeException(
                    'Falta gamedata vivo: ' .
                    $path
                );
            }
        }

        $figureMap =
            $this->readJson(
                $figureMapPath
            );

        $figureData =
            $this->readJson(
                $figureDataPath
            );

        $furnitureData =
            $this->readJson(
                $furnitureDataPath
            );

        $this->mergeFigureMap(
            $figureMap,
            $manifest,
            $partIdMap,
            $figureLibraryMap
        );

        $figureMerge =
            $this->mergeFigureData(
                $figureData,
                $manifest,
                $pieces,
                $submission,
                $partIdMap
            );

        $resolvedPieces =
            $figureMerge['pieces'];

        $setIds =
            $figureMerge['set_ids'];

        if ($setIds === []) {
            throw new RuntimeException(
                'No se asignaron figure set IDs finales.'
            );
        }

        $furnitureTemplateClass = trim(
            (string) config(
                'clothing_marketplace.installer.redeemable_furnituredata_template_class',
                'clothing_r21_trainoutfit'
            )
        );

        $this->cloneFurnitureTemplate(
            $furnitureData,
            $furnitureTemplateClass,
            $redeemableCode,
            $publicBaseItemId,
            $catalogItemId,
            (string) $submission->clothing_name,
            $setIds
        );

        $preparedGamedata =
            $work .
            DIRECTORY_SEPARATOR .
            'gamedata';

        $this->ensureDirectory(
            $preparedGamedata
        );

        foreach ([
            'FigureMap.json' => [
                $figureMap,
                $figureMapPath,
            ],
            'FigureData.json' => [
                $figureData,
                $figureDataPath,
            ],
            'FurnitureData.json' => [
                $furnitureData,
                $furnitureDataPath,
            ],
        ] as $name => $pair) {
            $prepared =
                $preparedGamedata .
                DIRECTORY_SEPARATOR .
                $name;

            $this->writeJson(
                $prepared,
                $pair[0]
            );

            $files[] = [
                'kind' => 'replace',
                'prepared' => $prepared,
                'target' => $pair[1],
            ];
        }

        foreach ($files as $file) {
            if (
                $file['kind'] === 'new' &&
                is_file($file['target'])
            ) {
                throw new RuntimeException(
                    'Asset destino ya existe: ' .
                    $file['target']
                );
            }
        }

        return [
            'prepared_root' => $work,
            'files' => $files,
            'redeemable_code' =>
                $redeemableCode,
            'source_redeemable_code' =>
                $sourceRedeemableCode,
            'set_ids' => $setIds,
            'pieces' => $resolvedPieces,
            'part_id_map' => $partIdMap,
            'figure_library_map' =>
                $figureLibraryMap,
            'figure_set_map' =>
                is_array(
                    $figureMerge[
                        'source_to_final'
                    ] ?? null
                )
                    ? $figureMerge[
                        'source_to_final'
                    ]
                    : [],
        ];
    }

    public function apply(
        array $plan,
        string $backupRoot
    ): array {
        $this->ensureDirectory(
            $backupRoot
        );

        $applied = [];

        try {
            foreach (
                $plan['files'] ?? []
                as $file
            ) {
                $prepared =
                    (string) $file['prepared'];

                $target =
                    (string) $file['target'];

                $kind =
                    (string) $file['kind'];

                if (! is_file($prepared)) {
                    throw new RuntimeException(
                        'Falta archivo preparado: ' .
                        $prepared
                    );
                }

                $targetDirectory =
                    dirname($target);

                $this->ensureDirectory(
                    $targetDirectory
                );

                $relativeBackup =
                    hash(
                        'sha256',
                        $target
                    ) .
                    '-' .
                    basename($target);

                $backup = $backupRoot .
                    DIRECTORY_SEPARATOR .
                    $relativeBackup;

                $hadTarget =
                    is_file($target);

                if ($hadTarget) {
                    if (
                        ! copy(
                            $target,
                            $backup
                        )
                    ) {
                        throw new RuntimeException(
                            'No se pudo respaldar: ' .
                            $target
                        );
                    }
                } elseif ($kind === 'replace') {
                    throw new RuntimeException(
                        'Se esperaba archivo vivo para reemplazar: ' .
                        $target
                    );
                }

                if (
                    ! copy(
                        $prepared,
                        $target
                    )
                ) {
                    throw new RuntimeException(
                        'No se pudo instalar: ' .
                        $target
                    );
                }

                $applied[] = [
                    'target' => $target,
                    'backup' =>
                        $hadTarget
                            ? $backup
                            : null,
                    'was_new' =>
                        ! $hadTarget,
                ];
            }

            return [
                'backup_root' =>
                    $backupRoot,
                'applied' => $applied,
            ];
        } catch (\Throwable $exception) {
            $this->restore([
                'applied' => $applied,
            ]);

            throw $exception;
        }
    }

    public function restore(
        array $applied
    ): void {
        foreach (
            array_reverse(
                $applied['applied'] ?? []
            )
            as $entry
        ) {
            $target =
                (string) $entry['target'];

            $backup =
                $entry['backup'] ?? null;

            if (
                is_string($backup) &&
                is_file($backup)
            ) {
                @copy(
                    $backup,
                    $target
                );

                continue;
            }

            if (
                ($entry['was_new'] ?? false) &&
                is_file($target)
            ) {
                @unlink($target);
            }
        }
    }

    private function mergeFigureMap(
        array &$live,
        array $manifest,
        array $partIdMap,
        array $figureLibraryMap
    ): void {
        if (
            ! isset($live['libraries']) ||
            ! is_array($live['libraries']) ||
            ! array_is_list(
                $live['libraries']
            )
        ) {
            throw new RuntimeException(
                'FigureMap.json no tiene libraries[] esperado.'
            );
        }

        $existing = [];

        foreach (
            $live['libraries']
            as $library
        ) {
            if (
                is_array($library) &&
                isset($library['id'])
            ) {
                $existing[
                    strtolower(
                        (string) $library['id']
                    )
                ] = true;
            }
        }

        $incoming = is_array(
            $manifest[
                'figuremap'
            ][
                'libraries'
            ] ?? null
        )
            ? $manifest[
                'figuremap'
            ][
                'libraries'
            ]
            : [];

        foreach (
            $incoming
            as $libraryId => $library
        ) {
            $sourceLibraryId =
                (string) $libraryId;

            $finalLibraryId =
                trim(
                    (string) (
                        $figureLibraryMap[
                            $sourceLibraryId
                        ] ?? ''
                    )
                );

            if ($finalLibraryId === '') {
                throw new RuntimeException(
                    'Falta código Biribiri para FigureMap library: ' .
                    $sourceLibraryId
                );
            }

            $key = strtolower(
                $finalLibraryId
            );

            if (isset($existing[$key])) {
                throw new RuntimeException(
                    'FigureMap ya contiene la library Biribiri: ' .
                    $finalLibraryId
                );
            }

            $parts = [];

            foreach (
                is_array(
                    $library[
                        'parts'
                    ] ?? null
                )
                    ? $library[
                        'parts'
                    ]
                    : []
                as $part
            ) {
                if (! is_array($part)) {
                    continue;
                }

                $parts[] = [
                    'id' =>
                        $this->mappedPartId(
                            $part['id'] ?? 0,
                            $partIdMap
                        ),
                    'type' =>
                        (string) (
                            $part['type']
                            ?? ''
                        ),
                ];
            }

            $live['libraries'][] = [
                'id' =>
                    $finalLibraryId,
                'revision' => 1,
                'parts' => $parts,
            ];

            $existing[$key] = true;
        }
    }

    private function mergeFigureData(
        array &$live,
        array $manifest,
        array $pieceReport,
        ClothingSubmission $submission,
        array $partIdMap
    ): array {
        if (
            ! isset($live['setTypes']) ||
            ! is_array($live['setTypes']) ||
            ! array_is_list(
                $live['setTypes']
            )
        ) {
            throw new RuntimeException(
                'FigureData.json no tiene setTypes[] esperado.'
            );
        }

        $sourceSets = [];

        foreach (
            is_array(
                $manifest[
                    'figuredata'
                ][
                    'sets'
                ] ?? null
            )
                ? $manifest[
                    'figuredata'
                ][
                    'sets'
                ]
                : []
            as $index => $set
        ) {
            if (! is_array($set)) {
                continue;
            }

            $sourceKey = trim(
                (string) (
                    $set[
                        'source_key'
                    ] ??
                    (
                        'legacy-source-set-' .
                        ($index + 1)
                    )
                )
            );

            if ($sourceKey === '') {
                throw new RuntimeException(
                    'Un set fuente no tiene source_key.'
                );
            }

            if (isset($sourceSets[$sourceKey])) {
                throw new RuntimeException(
                    'source_key duplicado: ' .
                    $sourceKey
                );
            }

            $sourceSets[$sourceKey] =
                $set;
        }

        if ($sourceSets === []) {
            throw new RuntimeException(
                'No hay sets fuente en figuredata.'
            );
        }

        $existingIds = [];

        foreach (
            $live['setTypes']
            as $setType
        ) {
            foreach (
                is_array(
                    $setType['sets']
                    ?? null
                )
                    ? $setType['sets']
                    : []
                as $set
            ) {
                if (
                    is_array($set) &&
                    isset($set['id'])
                ) {
                    $existingIds[
                        (string) $set['id']
                    ] = true;
                }
            }
        }

        $pieces = is_array(
            $pieceReport[
                'pieces'
            ] ?? null
        )
            ? $pieceReport[
                'pieces'
            ]
            : [];

        $nextId = (int) config(
            'clothing_marketplace.installer.id_ranges.figure_set_start',
            1900000000
        );

        $maxId = (int) config(
            'clothing_marketplace.installer.id_ranges.figure_set_max',
            1999999999
        );

        if (
            $nextId <= 0 ||
            $maxId < $nextId
        ) {
            throw new RuntimeException(
                'Rango figure_set Biribiri inválido.'
            );
        }

        $allocated = [];

        $allocate = function (
            string $sourceKey
        ) use (
            &$allocated,
            &$existingIds,
            &$nextId,
            $maxId
        ): string {
            if (isset($allocated[$sourceKey])) {
                return $allocated[$sourceKey];
            }

            while (
                $nextId <= $maxId &&
                isset(
                    $existingIds[
                        (string) $nextId
                    ]
                )
            ) {
                $nextId++;
            }

            if ($nextId > $maxId) {
                throw new RuntimeException(
                    'No quedan figure set IDs libres en el rango Biribiri.'
                );
            }

            $assigned =
                (string) $nextId;

            $allocated[$sourceKey] =
                $assigned;

            $existingIds[$assigned] =
                true;

            $nextId++;

            return $assigned;
        };

        $resolved = [];
        $finalSetIds = [];
        $single =
            count($pieces) === 1;

        foreach ($pieces as $piece) {
            if (! is_array($piece)) {
                continue;
            }

            $category = strtolower(
                trim(
                    (string) (
                        $piece['category']
                        ?? ''
                    )
                )
            );

            if (
                $single &&
                trim(
                    (string)
                    $submission->final_category
                ) !== ''
            ) {
                $category = strtolower(
                    trim(
                        (string)
                        $submission->final_category
                    )
                );
            }

            if ($category === '') {
                throw new RuntimeException(
                    'Una prenda no tiene categoría final.'
                );
            }

            $targetIndex =
                $this->findSetTypeIndex(
                    $live['setTypes'],
                    $category
                );

            if ($targetIndex === null) {
                $paletteId =
                    $this->sourcePaletteId(
                        $manifest,
                        (string) (
                            $piece['category']
                            ?? $category
                        )
                    );

                $live['setTypes'][] = [
                    'type' => $category,
                    'paletteId' =>
                        $paletteId,
                    'sets' => [],
                ];

                $targetIndex =
                    array_key_last(
                        $live['setTypes']
                    );
            }

            $sourceKeys = array_values(
                array_unique(
                    array_filter(
                        array_map(
                            'strval',
                            is_array(
                                $piece[
                                    'source_set_keys'
                                ] ?? null
                            )
                                ? $piece[
                                    'source_set_keys'
                                ]
                                : []
                        ),
                        static fn (
                            string $value
                        ): bool =>
                            $value !== ''
                    )
                )
            );

            /*
             * Compatibilidad con staging previo a P8.
             * Solo se usa si no existen source_set_keys.
             */
            if ($sourceKeys === []) {
                $legacyDeclaredIds =
                    array_values(
                        array_map(
                            'strval',
                            is_array(
                                $piece[
                                    'declared_set_ids'
                                ] ??
                                $piece[
                                    'set_ids'
                                ] ??
                                null
                            )
                                ? (
                                    $piece[
                                        'declared_set_ids'
                                    ] ??
                                    $piece[
                                        'set_ids'
                                    ]
                                )
                                : []
                        )
                    );

                foreach (
                    $legacyDeclaredIds
                    as $declaredId
                ) {
                    foreach (
                        $sourceSets
                        as $sourceKey => $set
                    ) {
                        if (
                            (string) (
                                $set[
                                    'declared_id'
                                ] ??
                                $set['id'] ??
                                ''
                            ) === $declaredId
                        ) {
                            $sourceKeys[] =
                                $sourceKey;
                        }
                    }
                }

                $sourceKeys = array_values(
                    array_unique(
                        $sourceKeys
                    )
                );
            }

            if ($sourceKeys === []) {
                throw new RuntimeException(
                    'Una prenda no tiene sets fuente resueltos.'
                );
            }

            $resolvedPiece = $piece;
            $resolvedPiece[
                'installed_category'
            ] = $category;
            $resolvedPiece[
                'set_ids'
            ] = [];

            foreach (
                $sourceKeys
                as $sourceKey
            ) {
                if (
                    ! isset(
                        $sourceSets[
                            $sourceKey
                        ]
                    )
                ) {
                    throw new RuntimeException(
                        'No existe set fuente ' .
                        $sourceKey
                    );
                }

                $source =
                    $sourceSets[
                        $sourceKey
                    ];

                $finalSetId =
                    $allocate(
                        $sourceKey
                    );

                $colorable =
                    $this->boolValue(
                        $source[
                            'colorable'
                        ] ?? false
                    );

                $parts = [];

                foreach (
                    is_array(
                        $source[
                            'parts'
                        ] ?? null
                    )
                        ? $source[
                            'parts'
                        ]
                        : []
                    as $part
                ) {
                    if (! is_array($part)) {
                        continue;
                    }

                    $parts[] = [
                        'id' =>
                            $this->mappedPartId(
                                $part['id'] ?? 0,
                                $partIdMap
                            ),
                        'type' =>
                            (string) (
                                $part['type']
                                ?? ''
                            ),
                        'colorable' =>
                            $colorable,
                        'index' =>
                            (int) (
                                $part['index']
                                ?? 0
                            ),
                        'colorindex' =>
                            (int) (
                                $part[
                                    'colorindex'
                                ] ?? 0
                            ),
                    ];
                }

                $live['setTypes'][
                    $targetIndex
                ]['sets'][] = [
                    /*
                     * Este ID es SIEMPRE Biribiri.
                     * Nunca reutilizamos DEFINE_ID/rangos del builder.
                     */
                    'id' =>
                        $this->numeric(
                            $finalSetId
                        ),
                    'gender' =>
                        (string) (
                            $source[
                                'gender'
                            ] ?? 'U'
                        ),
                    'club' =>
                        (int) (
                            $source[
                                'club'
                            ] ?? 0
                        ),
                    'colorable' =>
                        $colorable,
                    'selectable' =>
                        $this->boolValue(
                            $source[
                                'selectable'
                            ] ?? true
                        ),
                    'preselectable' =>
                        false,
                    'sellable' => true,
                    'parts' => $parts,
                ];

                $resolvedPiece[
                    'set_ids'
                ][] =
                    $finalSetId;

                $finalSetIds[] =
                    $finalSetId;
            }

            $resolvedPiece[
                'set_ids'
            ] = array_values(
                array_unique(
                    $resolvedPiece[
                        'set_ids'
                    ]
                )
            );

            $resolved[] =
                $resolvedPiece;
        }

        $finalSetIds = array_values(
            array_unique(
                $finalSetIds
            )
        );

        return [
            'pieces' => $resolved,
            'set_ids' => $finalSetIds,
            'source_to_final' =>
                $allocated,
        ];
    }

    private function cloneFurnitureTemplate(
        array &$data,
        string $templateClass,
        string $newClass,
        int $newId,
        int $catalogItemId,
        string $displayName,
        array $setIds
    ): void {
        $replacements = [
            [
                'id' => $newId,
                'classname' => $newClass,
                'name' => $displayName,
                'description' =>
                    $displayName,
                'offerid' =>
                    $catalogItemId,
                'customparams' =>
                    implode(
                        ',',
                        array_map(
                            'strval',
                            $setIds
                        )
                    ),
                'specialtype' => 23,
            ],
        ];

        if (
            ! $this->appendTemplateClones(
                $data,
                ['classname', 'className'],
                $templateClass,
                $replacements
            )
        ) {
            throw new RuntimeException(
                'No se encontró el template FurnitureData "' .
                $templateClass .
                '".'
            );
        }
    }

    private function appendTemplateClones(
        array &$node,
        array $matchFields,
        string $templateValue,
        array $replacements
    ): bool {
        if (array_is_list($node)) {
            foreach ($node as $entry) {
                if (! is_array($entry)) {
                    continue;
                }

                if (
                    ! $this->entryMatches(
                        $entry,
                        $matchFields,
                        $templateValue
                    )
                ) {
                    continue;
                }

                foreach (
                    $replacements
                    as $replace
                ) {
                    $clone = $entry;

                    foreach (
                        $replace
                        as $field => $value
                    ) {
                        $this->setField(
                            $clone,
                            $field,
                            $value
                        );
                    }

                    $node[] = $clone;
                }

                return true;
            }
        }

        foreach ($node as &$child) {
            if (
                is_array($child) &&
                $this->appendTemplateClones(
                    $child,
                    $matchFields,
                    $templateValue,
                    $replacements
                )
            ) {
                unset($child);

                return true;
            }
        }

        unset($child);

        return false;
    }

    private function entryMatches(
        array $entry,
        array $fields,
        string $value
    ): bool {
        foreach ($entry as $key => $entryValue) {
            foreach ($fields as $field) {
                if (
                    strcasecmp(
                        (string) $key,
                        $field
                    ) === 0 &&
                    is_scalar($entryValue) &&
                    strcasecmp(
                        (string) $entryValue,
                        $value
                    ) === 0
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    private function setField(
        array &$entry,
        string $field,
        mixed $value
    ): void {
        foreach (
            array_keys($entry)
            as $key
        ) {
            if (
                strcasecmp(
                    (string) $key,
                    $field
                ) === 0
            ) {
                $entry[$key] = $value;

                return;
            }
        }

        /*
         * Solo añadimos las claves canónicas que Nitro conoce.
         */
        if (
            in_array(
                strtolower($field),
                [
                    'id',
                    'classname',
                    'name',
                    'description',
                    'customparams',
                    'specialtype',
                    'offerid',
                    'code',
                ],
                true
            )
        ) {
            $entry[$field] = $value;
        }
    }

    private function sourceCodeForLibrary(
        array $pieceReport,
        string $sourceLibrary
    ): string {
        $pieces =
            is_array(
                $pieceReport[
                    'pieces'
                ] ?? null
            )
                ? $pieceReport[
                    'pieces'
                ]
                : [];

        foreach ($pieces as $piece) {
            if (! is_array($piece)) {
                continue;
            }

            $libraries =
                is_array(
                    $piece[
                        'library_codes'
                    ] ?? null
                )
                    ? $piece[
                        'library_codes'
                    ]
                    : [];

            foreach ($libraries as $library) {
                if (
                    strcasecmp(
                        trim(
                            (string)
                            $library
                        ),
                        $sourceLibrary
                    ) !== 0
                ) {
                    continue;
                }

                $code =
                    trim(
                        (string) (
                            $piece['code']
                            ?? ''
                        )
                    );

                if ($code === '') {
                    throw new RuntimeException(
                        'La prenda de ' .
                        $sourceLibrary .
                        ' no tiene code de categories.txt.'
                    );
                }

                return $code;
            }
        }

        throw new RuntimeException(
            'No se pudo vincular la library fuente "' .
            $sourceLibrary .
            '" con categories.txt.'
        );
    }

    private function figureMapLibrary(
        array $manifest,
        string $className
    ): array {
        $libraries = is_array(
            $manifest[
                'figuremap'
            ][
                'libraries'
            ] ?? null
        )
            ? $manifest[
                'figuremap'
            ][
                'libraries'
            ]
            : [];

        foreach (
            $libraries
            as $libraryId => $library
        ) {
            if (
                strcasecmp(
                    (string) $libraryId,
                    $className
                ) === 0
            ) {
                if (! is_array($library)) {
                    break;
                }

                return $library;
            }
        }

        throw new RuntimeException(
            'No existe FigureMap library para el SWF "' .
            $className .
            '".'
        );
    }

    private function subsetPartIdMap(
        array $partIdMap,
        array $sourceIds,
        string $label
    ): array {
        $result = [];

        foreach (
            array_values(
                array_unique(
                    array_map(
                        'strval',
                        $sourceIds
                    )
                )
            )
            as $sourceId
        ) {
            $sourceId = trim(
                $sourceId
            );

            if ($sourceId === '') {
                continue;
            }

            if (! isset($partIdMap[$sourceId])) {
                throw new RuntimeException(
                    'Falta Part ID Biribiri para ' .
                    $sourceId .
                    ' en ' .
                    $label .
                    '.'
                );
            }

            $result[$sourceId] =
                (string) $partIdMap[$sourceId];
        }

        if ($result === []) {
            throw new RuntimeException(
                'La library "' .
                $label .
                '" no tiene Part IDs remapeables.'
            );
        }

        return $result;
    }

    private function mappedPartId(
        mixed $sourcePartId,
        array $partIdMap
    ): int {
        $source = trim(
            (string) $sourcePartId
        );

        if (
            $source === '' ||
            ! isset($partIdMap[$source])
        ) {
            throw new RuntimeException(
                'Falta mapping Biribiri para source Part ID ' .
                $source .
                '.'
            );
        }

        return $this->numeric(
            $partIdMap[$source]
        );
    }

    private function findSetTypeIndex(
        array $setTypes,
        string $type
    ): ?int {
        foreach (
            $setTypes
            as $index => $setType
        ) {
            if (
                is_array($setType) &&
                strcasecmp(
                    (string) (
                        $setType['type']
                        ?? ''
                    ),
                    $type
                ) === 0
            ) {
                return $index;
            }
        }

        return null;
    }

    private function sourcePaletteId(
        array $manifest,
        string $sourceType
    ): int {
        $setTypes = is_array(
            $manifest[
                'figuredata'
            ][
                'settypes'
            ] ?? null
        )
            ? $manifest[
                'figuredata'
            ][
                'settypes'
            ]
            : [];

        $entry =
            $setTypes[
                $sourceType
            ] ?? null;

        $value = is_array($entry)
            ? (
                $entry[
                    'palette_id'
                ] ?? 1
            )
            : 1;

        return max(
            0,
            (int) $value
        );
    }

    private function safeStagingFile(
        string $root,
        string $relative
    ): string {
        $rootReal =
            realpath($root);

        $candidate = $root .
            DIRECTORY_SEPARATOR .
            str_replace(
                ['/', '\\'],
                DIRECTORY_SEPARATOR,
                $relative
            );

        $real = realpath($candidate);

        if (
            $rootReal === false ||
            $real === false ||
            ! is_file($real)
        ) {
            throw new RuntimeException(
                'Falta archivo de staging: ' .
                $relative
            );
        }

        $prefix =
            rtrim(
                str_replace(
                    '\\',
                    '/',
                    $rootReal
                ),
                '/'
            ) .
            '/';

        $normalized =
            str_replace(
                '\\',
                '/',
                $real
            );

        if (
            ! str_starts_with(
                strtolower($normalized),
                strtolower($prefix)
            )
        ) {
            throw new RuntimeException(
                'Ruta fuera del staging.'
            );
        }

        return $real;
    }

    private function readJson(
        string $path
    ): array {
        $content =
            file_get_contents($path);

        if ($content === false) {
            throw new RuntimeException(
                'No se pudo leer ' .
                $path
            );
        }

        $decoded = json_decode(
            $content,
            true,
            512,
            JSON_THROW_ON_ERROR
        );

        if (! is_array($decoded)) {
            throw new RuntimeException(
                'JSON inesperado: ' .
                $path
            );
        }

        return $decoded;
    }

    private function writeJson(
        string $path,
        array $data
    ): void {
        $this->ensureDirectory(
            dirname($path)
        );

        $encoded = json_encode(
            $data,
            JSON_UNESCAPED_UNICODE |
            JSON_UNESCAPED_SLASHES |
            JSON_PRETTY_PRINT |
            JSON_THROW_ON_ERROR
        );

        if (
            file_put_contents(
                $path,
                $encoded
            ) === false
        ) {
            throw new RuntimeException(
                'No se pudo escribir ' .
                $path
            );
        }
    }

    private function previewWorkRoot(
        string $path
    ): string {
        $path = trim($path);

        if ($path === '') {
            throw new RuntimeException(
                'Preview work root vacío.'
            );
        }

        $allowedRoot =
            realpath(
                storage_path(
                    'app/clothing_importer/previews'
                )
            );

        $parent =
            realpath(
                dirname($path)
            );

        if (
            $allowedRoot === false ||
            $parent === false
        ) {
            throw new RuntimeException(
                'No se pudo resolver el sandbox de preview.'
            );
        }

        $allowed =
            rtrim(
                str_replace(
                    '\\',
                    '/',
                    $allowedRoot
                ),
                '/'
            );

        $normalizedParent =
            rtrim(
                str_replace(
                    '\\',
                    '/',
                    $parent
                ),
                '/'
            );

        if (
            strcasecmp(
                $normalizedParent,
                $allowed
            ) !== 0 &&
            ! str_starts_with(
                strtolower($normalizedParent),
                strtolower($allowed . '/')
            )
        ) {
            throw new RuntimeException(
                'Preview work root fuera del sandbox permitido.'
            );
        }

        $name = basename($path);

        if (
            $name === '' ||
            $name === '.' ||
            $name === '..'
        ) {
            throw new RuntimeException(
                'Nombre inválido para preview work root.'
            );
        }

        $resolved =
            $parent .
            DIRECTORY_SEPARATOR .
            $name;

        if (file_exists($resolved)) {
            throw new RuntimeException(
                'El preview work root ya existe.'
            );
        }

        return $resolved;
    }

    private function ensureDirectory(
        string $path
    ): void {
        if (
            ! is_dir($path) &&
            ! mkdir(
                $path,
                0775,
                true
            ) &&
            ! is_dir($path)
        ) {
            throw new RuntimeException(
                'No se pudo crear directorio: ' .
                $path
            );
        }
    }

    private function numeric(
        mixed $value
    ): int|string {
        $string =
            (string) $value;

        if (
            $string !== '' &&
            ctype_digit($string)
        ) {
            $integer =
                (int) $string;

            if (
                (string) $integer ===
                ltrim(
                    $string,
                    '0'
                )
            ) {
                return $integer;
            }
        }

        return $string;
    }

    private function boolValue(
        mixed $value
    ): bool {
        if (is_bool($value)) {
            return $value;
        }

        return in_array(
            strtolower(
                trim(
                    (string) $value
                )
            ),
            [
                '1',
                'true',
                'yes',
                'on',
            ],
            true
        );
    }
}