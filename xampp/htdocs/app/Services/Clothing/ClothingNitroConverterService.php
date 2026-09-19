<?php

namespace App\Services\Clothing;

use RuntimeException;

class ClothingNitroConverterService
{
    private const MAX_SWF_BYTES = 52428800; // 50 MiB
    private const MAX_NITRO_BYTES = 104857600; // 100 MiB
    private const MAX_PROCESS_OUTPUT_BYTES = 1048576; // 1 MiB
    private const PROCESS_TIMEOUT_SECONDS = 90;
    private const NODE_MAX_OLD_SPACE_MB = 384;

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

        $inputSize =
            filesize($inputSwf);

        if (
            $inputSize === false ||
            $inputSize < 8 ||
            $inputSize >
                self::MAX_SWF_BYTES
        ) {
            throw new RuntimeException(
                'El SWF a convertir tiene un tamaño inválido.'
            );
        }

        $handle = @fopen(
            $inputSwf,
            'rb'
        );

        if (! is_resource($handle)) {
            throw new RuntimeException(
                'No se pudo leer el SWF antes de convertirlo.'
            );
        }

        try {
            $header =
                (string) fread(
                    $handle,
                    8
                );
        } finally {
            fclose($handle);
        }

        if (strlen($header) < 8) {
            throw new RuntimeException(
                'Cabecera SWF incompleta.'
            );
        }

        $signature =
            substr(
                $header,
                0,
                3
            );

        if (
            ! in_array(
                $signature,
                ['FWS', 'CWS', 'ZWS'],
                true
            )
        ) {
            throw new RuntimeException(
                'Firma SWF no soportada.'
            );
        }

        $declared = unpack(
            'Vlength',
            substr(
                $header,
                4,
                4
            )
        );

        $declaredLength =
            (int) (
                $declared[
                    'length'
                ] ?? 0
            );

        if (
            $declaredLength < 8 ||
            $declaredLength >
                self::MAX_SWF_BYTES
        ) {
            throw new RuntimeException(
                'El SWF declara un tamaño descomprimido inválido.'
            );
        }

        $directory =
            dirname($outputNitro);

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
            '--max-old-space-size=' .
                self::NODE_MAX_OLD_SPACE_MB,
            base_path(
                'tools/clothing-converter/convert-swf.js'
            ),
            $this->converterRoot(),
            $inputSwf,
            $outputNitro,
        ];

        try {
            $this->runProcess(
                $command,
                self::PROCESS_TIMEOUT_SECONDS
            );
        } catch (\Throwable $exception) {
            @unlink($outputNitro);
            throw $exception;
        }

        $size =
            is_file($outputNitro)
                ? filesize($outputNitro)
                : false;

        if (
            $size === false ||
            $size <= 0 ||
            $size >
                self::MAX_NITRO_BYTES
        ) {
            @unlink($outputNitro);

            throw new RuntimeException(
                'Nitro Converter produjo un archivo vacío o demasiado grande.'
            );
        }

        return [
            'path' => $outputNitro,
            'bytes' => (int) $size,
            'sha256' =>
                hash_file(
                    'sha256',
                    $outputNitro
                ),
        ];
    }

    private function runProcess(
        array $command,
        int $timeoutSeconds
    ): void {
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

        stream_set_blocking(
            $pipes[1],
            false
        );

        stream_set_blocking(
            $pipes[2],
            false
        );

        $stdout = '';
        $stderr = '';
        $failure = null;
        $exitCode = null;
        $startedAt =
            microtime(true);

        while (true) {
            $stdout .= (string)
                stream_get_contents(
                    $pipes[1]
                );

            $stderr .= (string)
                stream_get_contents(
                    $pipes[2]
                );

            if (
                strlen($stdout) +
                strlen($stderr) >
                self::MAX_PROCESS_OUTPUT_BYTES
            ) {
                $failure =
                    'Nitro Converter generó demasiada salida.';
            }

            if (
                $failure === null &&
                microtime(true) -
                    $startedAt >
                    $timeoutSeconds
            ) {
                $failure =
                    'Nitro Converter superó el tiempo máximo de ' .
                    $timeoutSeconds .
                    ' segundos.';
            }

            $status =
                proc_get_status($process);

            if ($failure !== null) {
                if (
                    $status['running']
                    ?? false
                ) {
                    @proc_terminate(
                        $process
                    );
                }

                break;
            }

            if (
                ! (
                    $status['running']
                    ?? false
                )
            ) {
                $exitCode =
                    (int) (
                        $status[
                            'exitcode'
                        ] ?? -1
                    );

                break;
            }

            usleep(50000);
        }

        $stdout .= (string)
            stream_get_contents(
                $pipes[1]
            );

        $stderr .= (string)
            stream_get_contents(
                $pipes[2]
            );

        fclose($pipes[1]);
        fclose($pipes[2]);

        $closedExit =
            proc_close($process);

        if ($failure !== null) {
            throw new RuntimeException(
                $failure
            );
        }

        if (
            $exitCode === null ||
            $exitCode < 0
        ) {
            $exitCode = $closedExit;
        }

        if ($exitCode !== 0) {
            throw new RuntimeException(
                'Nitro Converter falló: ' .
                trim(
                    $stderr .
                    "\n" .
                    $stdout
                )
            );
        }
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
                $value =
                    getenv(
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
