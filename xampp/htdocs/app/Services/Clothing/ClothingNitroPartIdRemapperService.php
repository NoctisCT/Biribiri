<?php

namespace App\Services\Clothing;

use RuntimeException;

class ClothingNitroPartIdRemapperService
{
    public function assertAvailable(): void
    {
        $tool = base_path(
            'tools/clothing-converter/remap-figure-part-ids.js'
        );

        if (! is_file($tool)) {
            throw new RuntimeException(
                'Falta remapper Nitro de Part IDs: ' .
                $tool
            );
        }

        if ($this->nodeBinary() === null) {
            throw new RuntimeException(
                'No se encontró node.exe para remapear Nitro.'
            );
        }
    }

    public function remap(
        string $inputNitro,
        string $outputNitro,
        array $sourceToBiribiri,
        ?string $sourceLibrary = null,
        ?string $finalLibrary = null
    ): array {
        $this->assertAvailable();

        if (! is_file($inputNitro)) {
            throw new RuntimeException(
                'No existe Nitro fuente para remapear: ' .
                $inputNitro
            );
        }

        $mapping = $this->normalizeMapping(
            $sourceToBiribiri
        );

        if ($mapping === []) {
            throw new RuntimeException(
                'Mapping Part ID vacío.'
            );
        }

        $sourceLibrary =
            trim(
                (string) $sourceLibrary
            );

        $finalLibrary =
            trim(
                (string) $finalLibrary
            );

        if (
            ($sourceLibrary === '') !==
            ($finalLibrary === '')
        ) {
            throw new RuntimeException(
                'sourceLibrary/finalLibrary deben venir juntos.'
            );
        }

        foreach ([
            'sourceLibrary' => $sourceLibrary,
            'finalLibrary' => $finalLibrary,
        ] as $label => $value) {
            if (
                $value !== '' &&
                preg_match(
                    '/^[A-Za-z0-9_]+$/',
                    $value
                ) !== 1
            ) {
                throw new RuntimeException(
                    $label .
                    ' contiene caracteres no permitidos: ' .
                    $value
                );
            }
        }

        if (
            $sourceLibrary !== '' &&
            $sourceLibrary === $finalLibrary
        ) {
            throw new RuntimeException(
                'La library final debe ser distinta de la fuente.'
            );
        }

        $directory = dirname(
            $outputNitro
        );

        if (
            ! is_dir($directory) &&
            ! mkdir(
                $directory,
                0775,
                true
            ) &&
            ! is_dir($directory)
        ) {
            throw new RuntimeException(
                'No se pudo crear directorio para Nitro remapeado.'
            );
        }

        if (is_file($outputNitro)) {
            @unlink($outputNitro);
        }

        $mappingFile =
            $directory .
            DIRECTORY_SEPARATOR .
            '.part-id-map-' .
            bin2hex(random_bytes(8)) .
            '.json';

        file_put_contents(
            $mappingFile,
            json_encode(
                $mapping,
                JSON_PRETTY_PRINT |
                JSON_UNESCAPED_SLASHES |
                JSON_THROW_ON_ERROR
            )
        );

        try {
            $command = [
                $this->nodeBinary(),
                base_path(
                    'tools/clothing-converter/remap-figure-part-ids.js'
                ),
                $inputNitro,
                $outputNitro,
                $mappingFile,
            ];

            if ($sourceLibrary !== '') {
                $command[] =
                    $sourceLibrary;

                $command[] =
                    $finalLibrary;
            }

            $descriptor = [
                0 => ['pipe', 'r'],
                1 => ['pipe', 'w'],
                2 => ['pipe', 'w'],
            ];

            $process = proc_open(
                $command,
                $descriptor,
                $pipes,
                base_path(),
                null,
                [
                    'bypass_shell' => true,
                ]
            );

            if (! is_resource($process)) {
                throw new RuntimeException(
                    'No se pudo iniciar el remapper Nitro.'
                );
            }

            fclose($pipes[0]);

            $stdout =
                stream_get_contents($pipes[1]);

            $stderr =
                stream_get_contents($pipes[2]);

            fclose($pipes[1]);
            fclose($pipes[2]);

            $exit = proc_close(
                $process
            );

            if (
                $exit !== 0 ||
                ! is_file($outputNitro) ||
                filesize($outputNitro) <= 0
            ) {
                @unlink($outputNitro);

                throw new RuntimeException(
                    'Remapper Nitro falló: ' .
                    trim(
                        (string) $stderr .
                        "\n" .
                        (string) $stdout
                    )
                );
            }

            $decoded = json_decode(
                trim((string) $stdout),
                true,
                512,
                JSON_THROW_ON_ERROR
            );

            if (
                ! is_array($decoded) ||
                ! ($decoded['valid'] ?? false)
            ) {
                @unlink($outputNitro);

                throw new RuntimeException(
                    'El remapper Nitro no confirmó un resultado válido.'
                );
            }

            return [
                'path' =>
                    $outputNitro,
                'bytes' =>
                    (int) filesize($outputNitro),
                'sha256' =>
                    hash_file(
                        'sha256',
                        $outputNitro
                    ),
                'mapping' =>
                    $mapping,
                'source_library' =>
                    $sourceLibrary !== ''
                        ? $sourceLibrary
                        : null,
                'final_library' =>
                    $finalLibrary !== ''
                        ? $finalLibrary
                        : null,
                'report' =>
                    $decoded,
            ];
        } finally {
            @unlink(
                $mappingFile
            );
        }
    }

    private function normalizeMapping(
        array $sourceToBiribiri
    ): array {
        $result = [];
        $targets = [];

        foreach (
            $sourceToBiribiri
            as $source => $target
        ) {
            $sourceText = trim(
                (string) $source
            );

            $targetText = trim(
                (string) $target
            );

            if (
                $sourceText === '' ||
                ! ctype_digit($sourceText) ||
                (int) $sourceText <= 0
            ) {
                throw new RuntimeException(
                    'Source Part ID inválido en mapping: ' .
                    $sourceText
                );
            }

            if (
                $targetText === '' ||
                ! ctype_digit($targetText) ||
                (int) $targetText <= 0
            ) {
                throw new RuntimeException(
                    'Biribiri Part ID inválido en mapping: ' .
                    $targetText
                );
            }

            if ($sourceText === $targetText) {
                throw new RuntimeException(
                    'El mapping no puede conservar el mismo Part ID: ' .
                    $sourceText
                );
            }

            if (isset($targets[$targetText])) {
                throw new RuntimeException(
                    'Biribiri Part ID destino duplicado: ' .
                    $targetText
                );
            }

            $targets[$targetText] = true;
            $result[$sourceText] =
                $targetText;
        }

        return $result;
    }

    private function nodeBinary(): ?string
    {
        $configured = trim(
            (string) config(
                'clothing_marketplace.installer.node_binary',
                ''
            )
        );

        if (
            $configured !== '' &&
            is_file($configured)
        ) {
            return $configured;
        }

        $path = getenv('PATH');

        if (! is_string($path)) {
            return null;
        }

        foreach (
            explode(
                PATH_SEPARATOR,
                $path
            )
            as $directory
        ) {
            foreach (
                PHP_OS_FAMILY === 'Windows'
                    ? ['node.exe', 'node']
                    : ['node']
                as $name
            ) {
                $candidate =
                    rtrim(
                        $directory,
                        '\\/'
                    ) .
                    DIRECTORY_SEPARATOR .
                    $name;

                if (is_file($candidate)) {
                    return $candidate;
                }
            }
        }

        return null;
    }
}
