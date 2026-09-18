<?php

namespace App\Services\Clothing;

use RuntimeException;

class ClothingSwfMetadataInspector
{
    private const MAX_SWF_BYTES = 52428800; // 50 MiB

    public function inspect(
        string $path
    ): array {
        if (! is_file($path)) {
            throw new RuntimeException(
                'No existe el SWF: ' . $path
            );
        }

        $size = filesize($path);

        if (
            $size === false ||
            $size < 8 ||
            $size > self::MAX_SWF_BYTES
        ) {
            throw new RuntimeException(
                'Tamaño SWF inválido: ' .
                basename($path)
            );
        }

        $bytes = file_get_contents($path);

        if ($bytes === false || strlen($bytes) < 8) {
            throw new RuntimeException(
                'No se pudo leer el SWF: ' .
                basename($path)
            );
        }

        $signature = substr($bytes, 0, 3);
        $version = ord($bytes[3]);

        $declared = unpack(
            'Vlength',
            substr($bytes, 4, 4)
        );

        $declaredLength = (int) (
            $declared['length'] ?? 0
        );

        if (
            ! in_array(
                $signature,
                ['FWS', 'CWS', 'ZWS'],
                true
            )
        ) {
            throw new RuntimeException(
                'Firma SWF no soportada: ' .
                basename($path)
            );
        }

        $searchBytes = null;
        $inspectionMode = 'full';

        if ($signature === 'FWS') {
            $searchBytes = substr($bytes, 8);
        } elseif ($signature === 'CWS') {
            if (! function_exists('gzuncompress')) {
                throw new RuntimeException(
                    'PHP no tiene zlib para inspeccionar CWS.'
                );
            }

            $inflated = @gzuncompress(
                substr($bytes, 8)
            );

            if ($inflated === false) {
                throw new RuntimeException(
                    'No se pudo descomprimir CWS: ' .
                    basename($path)
                );
            }

            $searchBytes = $inflated;
        } else {
            /*
             * ZWS usa LZMA. No intentamos reescribir ni descomprimir
             * a ciegas sin una librería dedicada.
             */
            $inspectionMode = 'limited_zws';
            $searchBytes = '';
        }

        $strings = [];

        if ($searchBytes !== '') {
            preg_match_all(
                '/[\x20-\x7E]{4,}/',
                $searchBytes,
                $matches
            );

            $strings = array_values(
                array_unique(
                    $matches[0] ?? []
                )
            );
        }

        $joined = implode(
            "\n",
            $strings
        );

        $libraries = $this->matches(
            '/<library\s+name=["\']([^"\']+)["\']/i',
            $joined
        );

        $objectDataTypes = $this->matches(
            '/<objectData\s+type=["\']([^"\']+)["\']/i',
            $joined
        );

        $visualizationTypes = $this->matches(
            '/<visualizationData\s+type=["\']([^"\']+)["\']/i',
            $joined
        );

        $objectTypes = $this->matches(
            '/<object\s+type=["\']([^"\']+)["\']/i',
            $joined
        );

        $builderMarkers = [];

        foreach (
            [
                'clothingbuilder.com',
                'furnibuilder.com',
            ]
            as $marker
        ) {
            if (
                stripos(
                    $joined,
                    $marker
                ) !== false
            ) {
                $builderMarkers[] = $marker;
            }
        }

        $candidateCodes = array_values(
            array_unique(
                array_filter(
                    array_merge(
                        $libraries,
                        $objectDataTypes,
                        $visualizationTypes,
                        $objectTypes
                    ),
                    fn ($value): bool =>
                        is_string($value) &&
                        trim($value) !== ''
                )
            )
        );

        $referenceCounts = [];

        foreach ($candidateCodes as $code) {
            $referenceCounts[$code] =
                $searchBytes === ''
                    ? null
                    : substr_count(
                        $searchBytes,
                        $code
                    );
        }

        return [
            'file' => basename($path),
            'signature' => $signature,
            'version' => $version,
            'file_size' => (int) $size,
            'declared_uncompressed_size' =>
                $declaredLength,
            'sha256' => hash(
                'sha256',
                $bytes
            ),
            'inspection_mode' =>
                $inspectionMode,
            'library_names' => $libraries,
            'object_data_types' =>
                $objectDataTypes,
            'visualization_types' =>
                $visualizationTypes,
            'object_types' =>
                $objectTypes,
            'builder_markers' =>
                $builderMarkers,
            'candidate_codes' =>
                $candidateCodes,
            'embedded_reference_counts' =>
                $referenceCounts,
        ];
    }

    private function matches(
        string $pattern,
        string $subject
    ): array {
        if ($subject === '') {
            return [];
        }

        preg_match_all(
            $pattern,
            $subject,
            $matches
        );

        return array_values(
            array_unique(
                array_map(
                    'trim',
                    $matches[1] ?? []
                )
            )
        );
    }
}