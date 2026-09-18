<?php

namespace App\Services\Clothing;

use RuntimeException;
use ZipArchive;

class ClothingArchiveExtractor
{
    private const MAX_ARCHIVE_BYTES = 52428800; // 50 MiB
    private const MAX_FILES = 500;
    private const MAX_EXTRACTED_BYTES = 209715200; // 200 MiB

    public function extract(
        string $archivePath,
        string $destination
    ): array {
        if (! is_file($archivePath)) {
            throw new RuntimeException(
                'No existe el paquete de ropa.'
            );
        }

        $size = filesize($archivePath);

        if ($size === false || $size <= 0) {
            throw new RuntimeException(
                'El paquete está vacío o no se puede leer.'
            );
        }

        if ($size > self::MAX_ARCHIVE_BYTES) {
            throw new RuntimeException(
                'El paquete supera el máximo de 50 MiB.'
            );
        }

        $extension = strtolower(
            pathinfo($archivePath, PATHINFO_EXTENSION)
        );

        if (! in_array($extension, ['zip', 'rar'], true)) {
            throw new RuntimeException(
                'Solo se aceptan paquetes .zip o .rar.'
            );
        }

        $this->prepareDestination($destination);

        try {
            if ($extension === 'zip') {
                $files = $this->extractZip(
                    $archivePath,
                    $destination
                );
            } else {
                $files = $this->extractRar(
                    $archivePath,
                    $destination
                );
            }

            $this->validateExtractedTree($destination);

            return $files;
        } catch (\Throwable $exception) {
            $this->deleteTree($destination);
            throw $exception;
        }
    }

    private function extractZip(
        string $archivePath,
        string $destination
    ): array {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException(
                'PHP no tiene ZipArchive habilitado.'
            );
        }

        $zip = new ZipArchive();

        if ($zip->open($archivePath) !== true) {
            throw new RuntimeException(
                'No se pudo abrir el ZIP.'
            );
        }

        try {
            if ($zip->numFiles > self::MAX_FILES) {
                throw new RuntimeException(
                    'El paquete contiene demasiados archivos.'
                );
            }

            $entries = [];
            $total = 0;

            for ($i = 0; $i < $zip->numFiles; $i++) {
                $stat = $zip->statIndex($i);

                if (! is_array($stat)) {
                    throw new RuntimeException(
                        'No se pudo leer una entrada del ZIP.'
                    );
                }

                $name = (string) ($stat['name'] ?? '');

                if ($name === '') {
                    continue;
                }

                $this->assertSafeRelativePath($name);

                $entrySize = (int) ($stat['size'] ?? 0);

                if ($entrySize < 0) {
                    throw new RuntimeException(
                        'Tamaño inválido en el ZIP.'
                    );
                }

                $total += $entrySize;

                if ($total > self::MAX_EXTRACTED_BYTES) {
                    throw new RuntimeException(
                        'El paquete expandido supera 200 MiB.'
                    );
                }

                $entries[] = [
                    'index' => $i,
                    'name' => $name,
                    'size' => $entrySize,
                ];
            }

            $files = [];

            foreach ($entries as $entry) {
                $name = $entry['name'];

                if (str_ends_with($name, '/')) {
                    $dir = $destination .
                        DIRECTORY_SEPARATOR .
                        str_replace(
                            ['/', '\\'],
                            DIRECTORY_SEPARATOR,
                            rtrim($name, '/\\')
                        );

                    if (
                        ! is_dir($dir) &&
                        ! mkdir($dir, 0775, true) &&
                        ! is_dir($dir)
                    ) {
                        throw new RuntimeException(
                            'No se pudo crear un directorio del ZIP.'
                        );
                    }

                    continue;
                }

                $target = $destination .
                    DIRECTORY_SEPARATOR .
                    str_replace(
                        ['/', '\\'],
                        DIRECTORY_SEPARATOR,
                        $name
                    );

                $parent = dirname($target);

                if (
                    ! is_dir($parent) &&
                    ! mkdir($parent, 0775, true) &&
                    ! is_dir($parent)
                ) {
                    throw new RuntimeException(
                        'No se pudo crear el staging.'
                    );
                }

                $stream = $zip->getStream($name);

                if (! is_resource($stream)) {
                    throw new RuntimeException(
                        'No se pudo leer ' . $name . '.'
                    );
                }

                $output = fopen($target, 'wb');

                if (! is_resource($output)) {
                    fclose($stream);

                    throw new RuntimeException(
                        'No se pudo escribir ' . $name . '.'
                    );
                }

                try {
                    stream_copy_to_stream(
                        $stream,
                        $output
                    );
                } finally {
                    fclose($stream);
                    fclose($output);
                }

                $files[] = $name;
            }

            return $files;
        } finally {
            $zip->close();
        }
    }

    private function extractRar(
        string $archivePath,
        string $destination
    ): array {
        if (class_exists('RarArchive')) {
            return $this->extractRarExtension(
                $archivePath,
                $destination
            );
        }

        return $this->extractRarExternal(
            $archivePath,
            $destination
        );
    }

    private function extractRarExtension(
        string $archivePath,
        string $destination
    ): array {
        $rar = \RarArchive::open($archivePath);

        if (! $rar) {
            throw new RuntimeException(
                'No se pudo abrir el RAR.'
            );
        }

        try {
            $entries = $rar->getEntries();

            if (! is_array($entries)) {
                throw new RuntimeException(
                    'No se pudieron leer las entradas del RAR.'
                );
            }

            if (count($entries) > self::MAX_FILES) {
                throw new RuntimeException(
                    'El paquete contiene demasiados archivos.'
                );
            }

            $total = 0;
            $files = [];

            foreach ($entries as $entry) {
                $name = (string) $entry->getName();

                $this->assertSafeRelativePath($name);

                $entrySize = (int) $entry->getUnpackedSize();
                $total += $entrySize;

                if ($total > self::MAX_EXTRACTED_BYTES) {
                    throw new RuntimeException(
                        'El paquete expandido supera 200 MiB.'
                    );
                }

                if (! $entry->isDirectory()) {
                    $files[] = $name;
                }
            }

            foreach ($entries as $entry) {
                if (! $entry->extract($destination)) {
                    throw new RuntimeException(
                        'Falló la extracción de ' .
                        $entry->getName() .
                        '.'
                    );
                }
            }

            return $files;
        } finally {
            $rar->close();
        }
    }

    private function extractRarExternal(
        string $archivePath,
        string $destination
    ): array {
        $binary = $this->findArchiveBinary();

        if ($binary === null) {
            throw new RuntimeException(
                'RAR necesita la extensión PHP rar o 7-Zip/UnRAR. ' .
                'Configura CLOTHING_ARCHIVER_BINARY si no está en PATH.'
            );
        }

        $kind = $this->archiveBinaryKind($binary);

        if ($kind === '7z') {
            $list = $this->runProcess([
                $binary,
                'l',
                '-slt',
                $archivePath,
            ]);

            $entries = $this->parse7zListing(
                $list,
                $archivePath
            );

            $this->validateArchiveEntryList($entries);

            $this->runProcess([
                $binary,
                'x',
                '-y',
                '-o' . $destination,
                $archivePath,
            ]);

            return $entries;
        }

        $list = $this->runProcess([
            $binary,
            'lb',
            $archivePath,
        ]);

        $entries = array_values(
            array_filter(
                array_map(
                    'trim',
                    preg_split(
                        '/\R/',
                        $list
                    ) ?: []
                ),
                fn (string $line): bool =>
                    $line !== ''
            )
        );

        $this->validateArchiveEntryList($entries);

        $this->runProcess([
            $binary,
            'x',
            '-o+',
            '-inul',
            $archivePath,
            rtrim(
                $destination,
                '\\/'
            ) . DIRECTORY_SEPARATOR,
        ]);

        return $entries;
    }

    private function validateArchiveEntryList(
        array $entries
    ): void {
        if (count($entries) > self::MAX_FILES) {
            throw new RuntimeException(
                'El paquete contiene demasiados archivos.'
            );
        }

        foreach ($entries as $entry) {
            $this->assertSafeRelativePath(
                (string) $entry
            );
        }
    }

    private function parse7zListing(
        string $output,
        string $archivePath
    ): array {
        $entries = [];
        $archiveNormalized = str_replace(
            '\\',
            '/',
            realpath($archivePath) ?: $archivePath
        );

        foreach (
            preg_split('/\R/', $output) ?: []
            as $line
        ) {
            if (! str_starts_with($line, 'Path = ')) {
                continue;
            }

            $value = trim(substr($line, 7));

            if ($value === '') {
                continue;
            }

            $normalized = str_replace(
                '\\',
                '/',
                $value
            );

            if (
                $normalized === $archiveNormalized ||
                basename($normalized) ===
                    basename($archiveNormalized) &&
                ! str_contains($normalized, '/')
            ) {
                continue;
            }

            $entries[] = $value;
        }

        return array_values(
            array_unique($entries)
        );
    }

    private function findArchiveBinary(): ?string
    {
        $configured = trim(
            (string) env(
                'CLOTHING_ARCHIVER_BINARY',
                ''
            )
        );

        if (
            $configured !== '' &&
            is_file($configured)
        ) {
            return $configured;
        }

        $windowsCandidates = [
            'C:\\Program Files\\7-Zip\\7z.exe',
            'C:\\Program Files (x86)\\7-Zip\\7z.exe',
            'C:\\Program Files\\WinRAR\\UnRAR.exe',
            'C:\\Program Files\\WinRAR\\WinRAR.exe',
        ];

        foreach ($windowsCandidates as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        foreach (
            ['7z', '7zz', '7za', 'unrar']
            as $candidate
        ) {
            $resolved = $this->resolveFromPath(
                $candidate
            );

            if ($resolved !== null) {
                return $resolved;
            }
        }

        return null;
    }

    private function resolveFromPath(
        string $binary
    ): ?string {
        $path = getenv('PATH');

        if (! is_string($path) || $path === '') {
            return null;
        }

        $extensions = PHP_OS_FAMILY === 'Windows'
            ? ['', '.exe']
            : [''];

        foreach (
            explode(PATH_SEPARATOR, $path)
            as $directory
        ) {
            foreach ($extensions as $extension) {
                $candidate =
                    rtrim($directory, '\\/') .
                    DIRECTORY_SEPARATOR .
                    $binary .
                    $extension;

                if (is_file($candidate)) {
                    return $candidate;
                }
            }
        }

        return null;
    }

    private function archiveBinaryKind(
        string $binary
    ): string {
        $name = strtolower(
            pathinfo($binary, PATHINFO_FILENAME)
        );

        return in_array(
            $name,
            ['7z', '7zz', '7za'],
            true
        )
            ? '7z'
            : 'unrar';
    }

    private function runProcess(
        array $command
    ): string {
        $descriptor = [
            0 => ['pipe', 'r'],
            1 => ['pipe', 'w'],
            2 => ['pipe', 'w'],
        ];

        $process = proc_open(
            $command,
            $descriptor,
            $pipes,
            null,
            null,
            ['bypass_shell' => true]
        );

        if (! is_resource($process)) {
            throw new RuntimeException(
                'No se pudo iniciar el descompresor.'
            );
        }

        fclose($pipes[0]);

        $stdout = stream_get_contents($pipes[1]);
        $stderr = stream_get_contents($pipes[2]);

        fclose($pipes[1]);
        fclose($pipes[2]);

        $exit = proc_close($process);

        if ($exit !== 0) {
            throw new RuntimeException(
                'El descompresor devolvió error ' .
                $exit .
                ': ' .
                trim((string) $stderr)
            );
        }

        return (string) $stdout;
    }

    private function assertSafeRelativePath(
        string $path
    ): void {
        $normalized = str_replace(
            '\\',
            '/',
            trim($path)
        );

        if (
            $normalized === '' ||
            str_starts_with($normalized, '/') ||
            preg_match(
                '/^[A-Za-z]:\//',
                $normalized
            ) === 1
        ) {
            throw new RuntimeException(
                'Ruta insegura en el paquete: ' .
                $path
            );
        }

        $segments = explode('/', $normalized);

        foreach ($segments as $segment) {
            if ($segment === '..') {
                throw new RuntimeException(
                    'Path traversal detectado: ' .
                    $path
                );
            }
        }
    }

    private function validateExtractedTree(
        string $destination
    ): void {
        $root = realpath($destination);

        if ($root === false) {
            throw new RuntimeException(
                'No existe el staging extraído.'
            );
        }

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(
                $root,
                \FilesystemIterator::SKIP_DOTS
            ),
            \RecursiveIteratorIterator::SELF_FIRST
        );

        $count = 0;
        $bytes = 0;

        foreach ($iterator as $file) {
            $count++;

            if ($count > self::MAX_FILES) {
                throw new RuntimeException(
                    'El staging contiene demasiadas entradas.'
                );
            }

            if ($file->isLink()) {
                throw new RuntimeException(
                    'No se permiten enlaces simbólicos.'
                );
            }

            $real = $file->getRealPath();

            if ($real === false) {
                throw new RuntimeException(
                    'No se pudo resolver un archivo del staging.'
                );
            }

            $relativeCheck = substr(
                $real,
                0,
                strlen($root)
            );

            if (
                strcasecmp(
                    $relativeCheck,
                    $root
                ) !== 0
            ) {
                throw new RuntimeException(
                    'Archivo extraído fuera del staging.'
                );
            }

            if ($file->isFile()) {
                $bytes += $file->getSize();

                if ($bytes > self::MAX_EXTRACTED_BYTES) {
                    throw new RuntimeException(
                        'El staging supera 200 MiB.'
                    );
                }
            }
        }
    }

    private function prepareDestination(
        string $destination
    ): void {
        if (file_exists($destination)) {
            $this->deleteTree($destination);
        }

        if (
            ! mkdir($destination, 0775, true) &&
            ! is_dir($destination)
        ) {
            throw new RuntimeException(
                'No se pudo crear el staging.'
            );
        }
    }

    private function deleteTree(
        string $path
    ): void {
        if (! file_exists($path)) {
            return;
        }

        if (is_file($path) || is_link($path)) {
            @unlink($path);
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
                @rmdir($entry->getPathname());
            } else {
                @unlink($entry->getPathname());
            }
        }

        @rmdir($path);
    }
}