<?php

namespace App\Services\Clothing;

use RuntimeException;

class ClothingTechnicalIdentityService
{
    public function __construct(
        private readonly ClothingSwfMetadataInspector $swfInspector
    ) {
    }

    public function analyze(
        array $manifest
    ): array {
        $root = $manifest['root'] ?? null;

        if (
            ! is_string($root) ||
            ! is_dir($root)
        ) {
            throw new RuntimeException(
                'El manifest no contiene un staging válido.'
            );
        }

        $errors = [];
        $warnings = [];

        $categories = is_array(
            $manifest['categories'] ?? null
        )
            ? $manifest['categories']
            : [];

        $logicalCodes = array_values(
            array_unique(
                array_filter(
                    array_map(
                        fn ($row) =>
                            is_array($row)
                                ? trim(
                                    (string)
                                    ($row['code'] ?? '')
                                )
                                : '',
                        $categories
                    ),
                    fn (string $value): bool =>
                        $value !== ''
                )
            )
        );

        if ($logicalCodes === []) {
            $errors[] =
                'No se pudo derivar el código lógico desde categories.txt.';
        }

        if (count($logicalCodes) > 1) {
            $warnings[] =
                'El paquete declara varios códigos lógicos; se conservarán todos en el informe técnico.';
        }

        $expectedLibraries = array_keys(
            is_array(
                $manifest['figuremap']['libraries']
                ?? null
            )
                ? $manifest['figuremap']['libraries']
                : []
        );

        $clothingEntries = is_array(
            $manifest['clothing_swfs'] ?? null
        )
            ? $manifest['clothing_swfs']
            : [];

        $clothingMetadata = [];
        $actualLibraries = [];

        foreach ($clothingEntries as $entry) {
            $relative = is_array($entry)
                ? (string) (
                    $entry['relative_path']
                    ?? ''
                )
                : '';

            if ($relative === '') {
                continue;
            }

            $absolute = $this->absolute(
                $root,
                $relative
            );

            $meta = $this->swfInspector
                ->inspect($absolute);

            $meta['relative_path'] =
                $relative;

            $clothingMetadata[] =
                $meta;

            foreach (
                $meta['library_names']
                as $library
            ) {
                $actualLibraries[] =
                    $library;
            }
        }

        $actualLibraries = array_values(
            array_unique($actualLibraries)
        );

        foreach ($expectedLibraries as $expected) {
            if (
                ! $this->containsIgnoreCase(
                    $actualLibraries,
                    (string) $expected
                )
            ) {
                $errors[] =
                    'La librería FigureMap "' .
                    $expected .
                    '" no aparece embebida en ningún SWF de ropa.';
            }
        }

        if ($clothingMetadata === []) {
            $errors[] =
                'No hay SWF de ropa analizables.';
        }

        $redeemableCandidates = is_array(
            $manifest[
                'redeemable_furni_candidates'
            ] ?? null
        )
            ? $manifest[
                'redeemable_furni_candidates'
            ]
            : [];

        $redeemableMetadata = null;
        $redeemableCode = null;

        if (count($redeemableCandidates) !== 1) {
            $errors[] =
                'Debe existir exactamente un SWF de furni canjeable antes de fijar identidad técnica.';
        } else {
            $relative = (string) (
                $redeemableCandidates[0][
                    'relative_path'
                ] ?? ''
            );

            if ($relative === '') {
                $errors[] =
                    'El furni canjeable no tiene ruta válida.';
            } else {
                $redeemableMetadata =
                    $this->swfInspector->inspect(
                        $this->absolute(
                            $root,
                            $relative
                        )
                    );

                $redeemableMetadata[
                    'relative_path'
                ] = $relative;

                $redeemableCode =
                    $this->chooseRedeemableCode(
                        $redeemableMetadata
                    );

                if ($redeemableCode === null) {
                    $errors[] =
                        'No se pudo derivar el código interno del furni canjeable.';
                }
            }
        }

        $sourceSetKeys = array_values(
            array_unique(
                array_filter(
                    array_map(
                        'strval',
                        is_array(
                            $manifest[
                                'figuredata'
                            ][
                                'source_keys'
                            ] ?? null
                        )
                            ? $manifest[
                                'figuredata'
                            ][
                                'source_keys'
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

        $declaredSetIds = array_values(
            array_map(
                'strval',
                is_array(
                    $manifest[
                        'figuredata'
                    ][
                        'set_ids'
                    ] ?? null
                )
                    ? $manifest[
                        'figuredata'
                    ][
                        'set_ids'
                    ]
                    : []
            )
        );

        if ($sourceSetKeys === []) {
            $errors[] =
                'No hay sets de figura fuente para asignar IDs Biribiri.';
        } else {
            $warnings[] =
                'Los IDs declarados por ClothingBuilder no se usarán como IDs finales; Biribiri los asignará automáticamente durante la aprobación.';
        }

        $allSwfMetadata =
            $clothingMetadata;

        if ($redeemableMetadata !== null) {
            $allSwfMetadata[] =
                $redeemableMetadata;
        }

        $builderMarkers = [];

        foreach ($allSwfMetadata as $meta) {
            foreach (
                $meta['builder_markers'] ?? []
                as $marker
            ) {
                $builderMarkers[] =
                    $marker;
            }
        }

        $builderMarkers = array_values(
            array_unique($builderMarkers)
        );

        /*
         * Decisión deliberada:
         * los códigos de ClothingBuilder/FurniBuilder se encuentran
         * dentro del SWF (ABC/constantes/XML embebido). Cambiar solo
         * nombre de archivo/DB rompería referencias.
         *
         * Biribiri tendrá nombres/slugs públicos propios, pero los
         * identificadores técnicos fuente se preservan hasta disponer
         * de builder/recompilador propio.
         */
        $renamePolicy =
            'preserve_embedded_source_codes';

        $fingerprintPayload = [
            'logical_codes' =>
                $logicalCodes,
            'libraries' =>
                $expectedLibraries,
            'redeemable_code' =>
                $redeemableCode,
            'source_set_keys' =>
                $sourceSetKeys,
            'declared_set_ids' =>
                $declaredSetIds,
            'swf_hashes' =>
                array_map(
                    fn (array $meta): string =>
                        (string)
                        ($meta['sha256'] ?? ''),
                    $allSwfMetadata
                ),
        ];

        $fingerprint = hash(
            'sha256',
            json_encode(
                $fingerprintPayload,
                JSON_UNESCAPED_SLASHES |
                JSON_UNESCAPED_UNICODE |
                JSON_THROW_ON_ERROR
            )
        );

        return [
            'valid' => $errors === [],
            'errors' => array_values(
                array_unique($errors)
            ),
            'warnings' => array_values(
                array_unique($warnings)
            ),

            'logical_clothing_code' =>
                count($logicalCodes) === 1
                    ? $logicalCodes[0]
                    : null,

            'logical_clothing_codes' =>
                $logicalCodes,

            'clothing_library_codes' =>
                array_values(
                    array_unique(
                        $expectedLibraries
                    )
                ),

            'redeemable_furni_code' =>
                $redeemableCode,

            /*
             * Compatibilidad/diagnóstico: estos son los IDs que
             * declaró el builder, NO IDs reservados por Biribiri.
             */
            'figure_set_ids' =>
                $declaredSetIds,

            'declared_figure_set_ids' =>
                $declaredSetIds,

            'source_set_keys' =>
                $sourceSetKeys,

            'builder_markers' =>
                $builderMarkers,

            'source_fingerprint' =>
                $fingerprint,

            'biribiri_public_key' =>
                'biri-clothing-' .
                substr(
                    $fingerprint,
                    0,
                    16
                ),

            'rename_policy' =>
                $renamePolicy,

            'automatic_code_rename_safe' =>
                false,

            'clothing_swfs' =>
                $clothingMetadata,

            'redeemable_furni_swf' =>
                $redeemableMetadata,
        ];
    }

    private function chooseRedeemableCode(
        array $metadata
    ): ?string {
        foreach (
            [
                'object_data_types',
                'object_types',
                'visualization_types',
                'library_names',
            ]
            as $field
        ) {
            $values = array_values(
                array_unique(
                    array_filter(
                        array_map(
                            'trim',
                            is_array(
                                $metadata[$field]
                                ?? null
                            )
                                ? $metadata[
                                    $field
                                ]
                                : []
                        ),
                        fn (string $value): bool =>
                            $value !== ''
                    )
                )
            );

            if (count($values) === 1) {
                return $values[0];
            }
        }

        return null;
    }

    private function containsIgnoreCase(
        array $values,
        string $needle
    ): bool {
        foreach ($values as $value) {
            if (
                strcasecmp(
                    (string) $value,
                    $needle
                ) === 0
            ) {
                return true;
            }
        }

        return false;
    }

    private function absolute(
        string $root,
        string $relative
    ): string {
        $relative = str_replace(
            ['/', '\\'],
            DIRECTORY_SEPARATOR,
            $relative
        );

        $absolute =
            rtrim(
                $root,
                '\\/'
            ) .
            DIRECTORY_SEPARATOR .
            ltrim(
                $relative,
                '\\/'
            );

        if (! is_file($absolute)) {
            throw new RuntimeException(
                'Falta archivo del staging: ' .
                $relative
            );
        }

        return $absolute;
    }
}