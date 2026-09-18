<?php

namespace App\Console\Commands;

use App\Services\Clothing\ClothingArchiveExtractor;
use App\Services\Clothing\ClothingPackageInspector;
use Illuminate\Console\Command;
use Illuminate\Support\Str;

class ClothingInspectPackageCommand extends Command
{
    protected $signature =
        'clothing:inspect-package {archive : Ruta al ZIP/RAR}';

    protected $description =
        'Extrae un paquete de ropa en staging temporal y ejecuta QA técnico sin importar nada.';

    public function handle(
        ClothingArchiveExtractor $extractor,
        ClothingPackageInspector $inspector
    ): int {
        $archive = (string) $this->argument(
            'archive'
        );

        if (! is_file($archive)) {
            $this->error(
                'No existe el archivo: ' .
                $archive
            );

            return self::FAILURE;
        }

        $destination = storage_path(
            'app/clothing_importer/audit/' .
            Str::uuid()->toString()
        );

        try {
            $extractor->extract(
                $archive,
                $destination
            );

            $report = $inspector->inspect(
                $destination
            );

            $this->line(
                json_encode(
                    $report,
                    JSON_PRETTY_PRINT |
                    JSON_UNESCAPED_UNICODE |
                    JSON_UNESCAPED_SLASHES
                )
            );

            return $report['valid']
                ? self::SUCCESS
                : self::FAILURE;
        } catch (\Throwable $exception) {
            $this->error(
                $exception->getMessage()
            );

            return self::FAILURE;
        } finally {
            $this->deleteTree(
                $destination
            );
        }
    }

    private function deleteTree(
        string $path
    ): void {
        if (! file_exists($path)) {
            return;
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(
                $path,
                \FilesystemIterator::SKIP_DOTS
            ),
            \RecursiveIteratorIterator::CHILD_FIRST
        );

        foreach ($iterator as $entry) {
            if ($entry->isDir() && ! $entry->isLink()) {
                @rmdir(
                    $entry->getPathname()
                );
            } else {
                @unlink(
                    $entry->getPathname()
                );
            }
        }

        @rmdir($path);
    }
}