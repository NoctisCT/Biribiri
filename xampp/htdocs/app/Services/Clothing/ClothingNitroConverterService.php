<?php

namespace App\Services\Clothing;

use RuntimeException;

class ClothingNitroConverterService
{
    public function isAvailable(): bool
    {
        try {
            $this->assertAvailable();

            return true;
        } catch (\Throwable) {
            return false;
        }
    }

    public function converterRoot(): string
    {
        $configured = trim(
            (string) config(
                'clothing_marketplace.installer.converter_root',
                ''
            )
        );

        if ($configured !== '') {
            return $this->expandEnvironment(
                $configured
            );
        }

        $localAppData =
            getenv('LOCALAPPDATA');

        if (
            ! is_string($localAppData) ||
            $localAppData === ''
        ) {
            throw new RuntimeException(
                'No existe LOCALAPPDATA y no se configuró CLOTHING_NITRO_CONVERTER_PATH.'
            );
        }

        return $localAppData .
            DIRECTORY_SEPARATOR .
            'BiribiriTools' .
            DIRECTORY_SEPARATOR .
            'nitro-converter';
    }

    public function assertAvailable(): void
    {
        $root = $this->converterRoot();

        foreach ([
            $root .
                DIRECTORY_SEPARATOR .
                'package.json',
            $root .
                DIRECTORY_SEPARATOR .
                'dist' .
                DIRECTORY_SEPARATOR .
                'Main.js',
            $root .
                DIRECTORY_SEPARATOR .
                'dist' .
                DIRECTORY_SEPARATOR .
                'swf' .
                DIRECTORY_SEPARATOR .
                'index.js',
            base_path(
                'tools/clothing-converter/convert-swf.js'
            ),
        ] as $required) {
            if (! is_file($required)) {
                throw new RuntimeException(
                    'Falta componente del converter: ' .
                    $required
                );
            }
        }

        if ($this->nodeBinary() === null) {
            throw new RuntimeException(
                'No se encontró node.exe.'
            );
        }
    }

    public function convert(
        string $inputSwf,
        string $outputNitro
    ): array {
        $this->assertAvailable();

        if (! is_file($inputSwf)) {
            throw new RuntimeException(
                'No existe el SWF a convertir: ' .
                $inputSwf
            );
        }

        if (
            strtolower(
                pathinfo(
                    $inputSwf,
                    PATHINFO_EXTENSION
                )
            ) !== 'swf'
        ) {
            throw new RuntimeException(
                'El input no es SWF.'
            );
        }

        $directory = dirname($outputNitro);

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
                'No se pudo crear el output Nitro.'
            );
        }

        if (is_file($outputNitro)) {
            @unlink($outputNitro);
        }

        $command = [
            $this->nodeBinary(),
            base_path(
                'tools/clothing-converter/convert-swf.js'
            ),
            $this->converterRoot(),
            $inputSwf,
            $outputNitro,
        ];

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
                'No se pudo iniciar Nitro Converter.'
            );
        }

        fclose($pipes[0]);

        $stdout =
            stream_get_contents($pipes[1]);
        $stderr =
            stream_get_contents($pipes[2]);

        fclose($pipes[1]);
        fclose($pipes[2]);

        $exit = proc_close($process);

        if (
            $exit !== 0 ||
            ! is_file($outputNitro) ||
            filesize($outputNitro) <= 0
        ) {
            @unlink($outputNitro);

            throw new RuntimeException(
                'Nitro Converter falló: ' .
                trim(
                    (string) $stderr .
                    "\n" .
                    (string) $stdout
                )
            );
        }

        return [
            'path' => $outputNitro,
            'bytes' =>
                (int) filesize($outputNitro),
            'sha256' =>
                hash_file(
                    'sha256',
                    $outputNitro
                ),
        ];
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

    private function expandEnvironment(
        string $path
    ): string {
        return preg_replace_callback(
            '/%([A-Za-z0-9_]+)%/',
            static function (
                array $match
            ): string {
                $value = getenv(
                    $match[1]
                );

                return is_string($value)
                    ? $value
                    : $match[0];
            },
            $path
        ) ?? $path;
    }
}