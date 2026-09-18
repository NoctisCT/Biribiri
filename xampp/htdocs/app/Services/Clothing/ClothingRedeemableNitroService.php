<?php

namespace App\Services\Clothing;

use RuntimeException;

class ClothingRedeemableNitroService
{
    public function normalize(
        string $rawNitro,
        string $comparatorNitro,
        string $outputNitro,
        string $outputIcon,
        string $expectedClass,
        ?string $sourceClass = null
    ): array {
        $sourceClass = trim(
            (string) (
                $sourceClass ??
                $expectedClass
            )
        );

        if ($sourceClass === '') {
            throw new RuntimeException(
                'El classname fuente del furni está vacío.'
            );
        }
        foreach ([
            $rawNitro,
            $comparatorNitro,
            base_path(
                'tools/clothing-converter/normalize-redeemable.js'
            ),
        ] as $required) {
            if (! is_file($required)) {
                throw new RuntimeException(
                    'Falta componente para normalizar furni: ' .
                    $required
                );
            }
        }

        $node = $this->nodeBinary();

        if ($node === null) {
            throw new RuntimeException(
                'No se encontró node.exe.'
            );
        }

        $this->ensureDirectory(
            dirname($outputNitro)
        );

        $this->ensureDirectory(
            dirname($outputIcon)
        );

        $nonce = bin2hex(
            random_bytes(6)
        );

        $tempNitro =
            $outputNitro .
            '.tmp-' .
            $nonce;

        $tempIcon =
            $outputIcon .
            '.tmp-' .
            $nonce;

        @unlink($tempNitro);
        @unlink($tempIcon);

        $command = [
            $node,
            base_path(
                'tools/clothing-converter/normalize-redeemable.js'
            ),
            $rawNitro,
            $comparatorNitro,
            $tempNitro,
            $tempIcon,
            $expectedClass,
            $sourceClass,
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
                'No se pudo iniciar el normalizador Nitro.'
            );
        }

        fclose($pipes[0]);

        $stdout =
            stream_get_contents(
                $pipes[1]
            );

        $stderr =
            stream_get_contents(
                $pipes[2]
            );

        fclose($pipes[1]);
        fclose($pipes[2]);

        $exit = proc_close(
            $process
        );

        if (
            $exit !== 0 ||
            ! is_file($tempNitro) ||
            filesize($tempNitro) <= 0 ||
            ! is_file($tempIcon) ||
            filesize($tempIcon) <= 0
        ) {
            @unlink($tempNitro);
            @unlink($tempIcon);

            throw new RuntimeException(
                'Normalización del furni clothing falló: ' .
                trim(
                    (string) $stderr .
                    "\n" .
                    (string) $stdout
                )
            );
        }

        $decoded = json_decode(
            trim(
                (string) $stdout
            ),
            true
        );

        if (
            ! is_array($decoded) ||
            ! ($decoded['ok'] ?? false) ||
            ($decoded['logicType'] ?? null) !==
                'furniture_purchasable_clothing' ||
            ($decoded['name'] ?? null) !==
                $expectedClass ||
            ($decoded['sourceName'] ?? null) !==
                $sourceClass
        ) {
            @unlink($tempNitro);
            @unlink($tempIcon);

            throw new RuntimeException(
                'Respuesta inesperada del normalizador Nitro.'
            );
        }

        @unlink($outputNitro);
        @unlink($outputIcon);

        if (
            ! rename(
                $tempNitro,
                $outputNitro
            )
        ) {
            @unlink($tempNitro);
            @unlink($tempIcon);

            throw new RuntimeException(
                'No se pudo publicar el Nitro normalizado.'
            );
        }

        if (
            ! rename(
                $tempIcon,
                $outputIcon
            )
        ) {
            @unlink($outputNitro);
            @unlink($tempIcon);

            throw new RuntimeException(
                'No se pudo publicar el icono del furni.'
            );
        }

        return [
            'nitro_path' =>
                $outputNitro,

            'icon_path' =>
                $outputIcon,

            'nitro_sha256' =>
                hash_file(
                    'sha256',
                    $outputNitro
                ),

            'icon_sha256' =>
                hash_file(
                    'sha256',
                    $outputIcon
                ),

            'logic_type' =>
                $decoded[
                    'logicType'
                ],

            'source_class' =>
                $sourceClass,

            'final_class' =>
                $expectedClass,

            'directions' =>
                $decoded[
                    'directions'
                ] ?? [],

            'icon_size' =>
                $decoded[
                    'icon'
                ] ?? null,
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
}
