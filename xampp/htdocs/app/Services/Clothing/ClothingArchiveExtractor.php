<?php

namespace App\Services\Clothing;

use RuntimeException;
use ZipArchive;

class ClothingArchiveExtractor
{
    private const MAX_ARCHIVE_BYTES = 52428800; // 50 MiB
    private const MAX_FILES = 500;
    private const MAX_EXTRACTED_BYTES = 209715200; // 200 MiB
    private const MAX_PROCESS_OUTPUT_BYTES = 1048576; // 1 MiB
    private const LIST_TIMEOUT_SECONDS = 20;
    private const EXTRACT_TIMEOUT_SECONDS = 90;

    private const ALLOWED_FILE_EXTENSIONS = [
        'txt',
        'xml',
        'swf',
        'png',
        'gif',
        'json',
    ];

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

            $this->validateExtractedTree(
                $destination
            );

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
            $seen = [];

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
                $this->assertUniqueArchivePath(
                    $name,
                    $seen
                );

                $normalized = str_replace(
                    '\\',
                    '/',
                    $name
                );

                $isDirectory =
                    str_ends_with(
                        $normalized,
                        '/'
                    );

                $entrySize =
                    (int) ($stat['size'] ?? 0);

                if ($entrySize < 0) {
                    throw new RuntimeException(
                        'Tamaño inválido en el ZIP.'
                    );
                }

                if (! $isDirectory) {
                    $this->assertAllowedFileType(
                        $name
                    );

                    $total += $entrySize;
                }

                if (
                    $total >
                    self::MAX_EXTRACTED_BYTES
                ) {
                    throw new RuntimeException(
                        'El paquete expandido supera 200 MiB.'
                    );
                }

                $entries[] = [
                    'name' => $name,
                    'size' => $entrySize,
                    'directory' =>
                        $isDirectory,
                ];
            }

            $files = [];

            foreach ($entries as $entry) {
                $name = $entry['name'];

                if ($entry['directory']) {
                    $dir =
                        $destination .
                        DIRECTORY_SEPARATOR .
                        str_replace(
                            ['/', '\\'],
                            DIRECTORY_SEPARATOR,
                            rtrim(
                                $name,
                                '/\\'
                            )
                        );

                    if (
                        ! is_dir($dir) &&
                        ! mkdir(
                            $dir,
                            0775,
                            true
                        ) &&
                        ! is_dir($dir)
                    ) {
                        throw new RuntimeException(
                            'No se pudo crear un directorio del ZIP.'
                        );
                    }

                    continue;
                }

                $target =
                    $destination .
                    DIRECTORY_SEPARATOR .
                    str_replace(
                        ['/', '\\'],
                        DIRECTORY_SEPARATOR,
                        $name
                    );

                $parent = dirname($target);

                if (
                    ! is_dir($parent) &&
                    ! mkdir(
                        $parent,
                        0775,
                        true
                    ) &&
                    ! is_dir($parent)
                ) {
                    throw new RuntimeException(
                        'No se pudo crear el staging.'
                    );
                }

                $stream =
                    $zip->getStream($name);

                if (! is_resource($stream)) {
                    throw new RuntimeException(
                        'No se pudo leer ' .
                        $name .
                        '.'
                    );
                }

                $output =
                    fopen(
                        $target,
                        'wb'
                    );

                if (! is_resource($output)) {
                    fclose($stream);

                    throw new RuntimeException(
                        'No se pudo escribir ' .
                        $name .
                        '.'
                    );
                }

                try {
                    $written =
                        stream_copy_to_stream(
                            $stream,
                            $output,
                            self::MAX_EXTRACTED_BYTES + 1
                        );

                    if (
                        $written === false ||
                        $written >
                            self::MAX_EXTRACTED_BYTES
                    ) {
                        throw new RuntimeException(
                            'Una entrada ZIP supera el límite de extracción.'
                        );
                    }
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

        return $this->extractRarWithSevenZip(
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
            $seen = [];

            foreach ($entries as $entry) {
                $name =
                    (string) $entry->getName();

                $this->assertSafeRelativePath($name);
                $this->assertUniqueArchivePath(
                    $name,
                    $seen
                );

                $entrySize =
                    (int) $entry->getUnpackedSize();

                if ($entrySize < 0) {
                    throw new RuntimeException(
                        'Tamaño RAR inválido.'
                    );
                }

                if (! $entry->isDirectory()) {
                    $this->assertAllowedFileType(
                        $name
                    );

                    $total += $entrySize;
                    $files[] = $name;
                }

                if (
                    $total >
                    self::MAX_EXTRACTED_BYTES
                ) {
                    throw new RuntimeException(
                        'El paquete expandido supera 200 MiB.'
                    );
                }
            }

            foreach ($entries as $entry) {
                if (
                    ! $entry->extract(
                        $destination
                    )
                ) {
                    throw new RuntimeException(
                        'Falló la extracción de ' .
                        $entry->getName() .
                        '.'
                    );
                }

                $this->assertTreeWithinLimits(
                    $destination
                );
            }

            return $files;
        } finally {
            $rar->close();
        }
    }

    private function extractRarWithSevenZip(
        string $archivePath,
        string $destination
    ): array {
        $binary =
            $this->findSevenZipBinary();

        if ($binary === null) {
            throw new RuntimeException(
                'Por seguridad, RAR requiere la extensión PHP rar o 7-Zip. UnRAR/WinRAR no se usa como fallback porque no permite esta validación previa de forma fiable.'
            );
        }

        $list = $this->runProcess(
            [
                $binary,
                'l',
                '-slt',
                '-bd',
                '-p__BIRIBIRI_REJECT_ENCRYPTED__',
                $archivePath,
            ],
            self::LIST_TIMEOUT_SECONDS
        );

        $entries =
            $this->parse7zListing(
                $list,
                $archivePath
            );

        $this->validate7zEntries(
            $entries
        );

        $files = array_values(
            array_map(
                static fn (array $entry): string =>
                    (string) $entry['name'],
                array_filter(
                    $entries,
                    static fn (array $entry): bool =>
                        ! ($entry['directory'] ?? false)
                )
            )
        );

        $this->runProcess(
            [
                $binary,
                'x',
                '-y',
                '-bd',
                '-bb0',
                '-p__BIRIBIRI_REJECT_ENCRYPTED__',
                '-o' . $destination,
                $archivePath,
            ],
            self::EXTRACT_TIMEOUT_SECONDS,
            $destination
        );

        return $files;
    }

    private function validate7zEntries(
        array $entries
    ): void {
        if ($entries === []) {
            throw new RuntimeException(
                'El RAR no contiene entradas.'
            );
        }

        if (count($entries) > self::MAX_FILES) {
            throw new RuntimeException(
                'El paquete contiene demasiados archivos.'
            );
        }

        $total = 0;
        $seen = [];

        foreach ($entries as $entry) {
            $name = trim(
                (string) (
                    $entry['name'] ?? ''
                )
            );

            if ($name === '') {
                throw new RuntimeException(
                    '7-Zip devolvió una entrada sin ruta.'
                );
            }

            $this->assertSafeRelativePath($name);
            $this->assertUniqueArchivePath(
                $name,
                $seen
            );

            if (
                $entry['encrypted'] ?? false
            ) {
                throw new RuntimeException(
                    'No se permiten RAR cifrados.'
                );
            }

            if (
                $entry['link'] ?? false
            ) {
                throw new RuntimeException(
                    'No se permiten enlaces dentro del RAR.'
                );
            }

            if (
                $entry['anti'] ?? false
            ) {
                throw new RuntimeException(
                    'No se permiten anti-items dentro del RAR.'
                );
            }

            if (
                $entry['directory'] ?? false
            ) {
                continue;
            }

            $this->assertAllowedFileType($name);

            if (
                ! array_key_exists(
                    'size',
                    $entry
                )
            ) {
                throw new RuntimeException(
                    '7-Zip no informó el tamaño de ' .
                    $name .
                    '.'
                );
            }

            $size = (int) $entry['size'];

            if ($size < 0) {
                throw new RuntimeException(
                    'Tamaño inválido en el listado 7-Zip.'
                );
            }

            $total += $size;

            if (
                $total >
                self::MAX_EXTRACTED_BYTES
            ) {
                throw new RuntimeException(
                    'El paquete expandido supera 200 MiB.'
                );
            }
        }
    }

    private function parse7zListing(
        string $output,
        string $archivePath
    ): array {
        $records = [];
        $current = [];

        $flush = static function () use (
            &$records,
            &$current
        ): void {
            if (
                isset($current['Path']) &&
                trim(
                    (string) $current['Path']
                ) !== ''
            ) {
                $records[] = $current;
            }

            $current = [];
        };

        foreach (
            preg_split('/\R/', $output) ?: []
            as $line
        ) {
            if (trim($line) === '') {
                $flush();
                continue;
            }

            $separator = strpos(
                $line,
                ' = '
            );

            if ($separator === false) {
                continue;
            }

            $key = substr(
                $line,
                0,
                $separator
            );

            $value = substr(
                $line,
                $separator + 3
            );

            if (
                $key === 'Path' &&
                isset($current['Path'])
            ) {
                $flush();
            }

            $current[$key] = $value;
        }

        $flush();

        $archiveNormalized = str_replace(
            '\\',
            '/',
            realpath($archivePath)
                ?: $archivePath
        );

        $entries = [];

        foreach ($records as $record) {
            $name = trim(
                (string) (
                    $record['Path'] ?? ''
                )
            );

            if ($name === '') {
                continue;
            }

            $normalized =
                str_replace(
                    '\\',
                    '/',
                    $name
                );

            if (
                $normalized ===
                    $archiveNormalized ||
                (
                    basename($normalized) ===
                        basename(
                            $archiveNormalized
                        ) &&
                    ! str_contains(
                        $normalized,
                        '/'
                    )
                )
            ) {
                continue;
            }

            $size = null;

            if (
                array_key_exists(
                    'Size',
                    $record
                )
            ) {
                $rawSize = trim(
                    (string) $record['Size']
                );

                if (
                    $rawSize !== '' &&
                    ! ctype_digit($rawSize)
                ) {
                    throw new RuntimeException(
                        '7-Zip devolvió un tamaño no numérico.'
                    );
                }

                if ($rawSize !== '') {
                    $size = (int) $rawSize;
                }
            }

            $attributes = strtoupper(
                trim(
                    (string) (
                        $record['Attributes']
                        ?? ''
                    )
                )
            );

            $directory =
                trim(
                    (string) (
                        $record['Folder']
                        ?? ''
                    )
                ) === '+' ||
                str_contains(
                    $attributes,
                    'D'
                );

            $link =
                trim(
                    (string) (
                        $record[
                            'Symbolic Link'
                        ] ?? ''
                    )
                ) !== '' ||
                trim(
                    (string) (
                        $record[
                            'Hard Link'
                        ] ?? ''
                    )
                ) !== '';

            $encrypted =
                trim(
                    (string) (
                        $record[
                            'Encrypted'
                        ] ?? ''
                    )
                ) === '+';

            $anti =
                trim(
                    (string) (
                        $record['Anti']
                        ?? ''
                    )
                ) === '+';

            $entry = [
                'name' => $name,
                'directory' => $directory,
                'link' => $link,
                'encrypted' => $encrypted,
                'anti' => $anti,
            ];

            if ($size !== null) {
                $entry['size'] = $size;
            }

            $entries[] = $entry;
        }

        return $entries;
    }

    private function findSevenZipBinary(): ?string
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
            $name = strtolower(
                pathinfo(
                    $configured,
                    PATHINFO_FILENAME
                )
            );

            if (
                ! in_array(
                    $name,
                    ['7z', '7zz', '7za'],
                    true
                )
            ) {
                throw new RuntimeException(
                    'CLOTHING_ARCHIVER_BINARY debe apuntar a 7-Zip por seguridad.'
                );
            }

            return $configured;
        }

        foreach ([
            'C:\\Program Files\\7-Zip\\7z.exe',
            'C:\\Program Files (x86)\\7-Zip\\7z.exe',
        ] as $candidate) {
            if (is_file($candidate)) {
                return $candidate;
            }
        }

        foreach (
            ['7z', '7zz', '7za']
            as $candidate
        ) {
            $resolved =
                $this->resolveFromPath(
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

        if (
            ! is_string($path) ||
            $path === ''
        ) {
            return null;
        }

        $extensions =
            PHP_OS_FAMILY === 'Windows'
                ? ['', '.exe']
                : [''];

        foreach (
            explode(
                PATH_SEPARATOR,
                $path
            )
            as $directory
        ) {
            foreach (
                $extensions
                as $extension
            ) {
                $candidate =
                    rtrim(
                        $directory,
                        '\\/'
                    ) .
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

    private function runProcess(
        array $command,
        int $timeoutSeconds,
        ?string $watchDirectory = null
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
        $startedAt = microtime(true);
        $lastWatch = 0.0;

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
                    'El descompresor generó demasiada salida.';
            }

            $now = microtime(true);

            if (
                $failure === null &&
                $now - $startedAt >
                    $timeoutSeconds
            ) {
                $failure =
                    'El descompresor superó el tiempo máximo de ' .
                    $timeoutSeconds .
                    ' segundos.';
            }

            if (
                $failure === null &&
                $watchDirectory !== null &&
                $now - $lastWatch >= 0.1
            ) {
                try {
                    $this->assertTreeWithinLimits(
                        $watchDirectory
                    );
                } catch (\Throwable $exception) {
                    $failure =
                        $exception->getMessage();
                }

                $lastWatch = $now;
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
                'El descompresor devolvió error ' .
                $exitCode .
                ': ' .
                trim($stderr)
            );
        }

        return $stdout;
    }

    private function assertSafeRelativePath(
        string $path
    ): void {
        if (
            $path === '' ||
            $path !== trim($path) ||
            preg_match(
                '/[\x00-\x1F\x7F]/',
                $path
            ) === 1
        ) {
            throw new RuntimeException(
                'Ruta insegura en el paquete: ' .
                $path
            );
        }

        $normalized =
            str_replace(
                '\\',
                '/',
                $path
            );

        if (
            strlen($normalized) > 500 ||
            str_starts_with(
                $normalized,
                '/'
            ) ||
            str_contains(
                $normalized,
                ':'
            )
        ) {
            throw new RuntimeException(
                'Ruta insegura en el paquete: ' .
                $path
            );
        }

        $normalized =
            rtrim(
                $normalized,
                '/'
            );

        if ($normalized === '') {
            throw new RuntimeException(
                'Ruta insegura en el paquete: ' .
                $path
            );
        }

        $segments =
            explode(
                '/',
                $normalized
            );

        foreach ($segments as $segment) {
            if (
                $segment === '' ||
                $segment === '.' ||
                $segment === '..' ||
                strlen($segment) > 240 ||
                preg_match(
                    '/[. ]$/',
                    $segment
                ) === 1 ||
                preg_match(
                    '/^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/i',
                    $segment
                ) === 1
            ) {
                throw new RuntimeException(
                    'Ruta insegura en el paquete: ' .
                    $path
                );
            }
        }
    }

    private function assertUniqueArchivePath(
        string $path,
        array &$seen
    ): void {
        $normalized = strtolower(
            rtrim(
                str_replace(
                    '\\',
                    '/',
                    $path
                ),
                '/'
            )
        );

        if (isset($seen[$normalized])) {
            throw new RuntimeException(
                'Ruta duplicada en el paquete: ' .
                $path
            );
        }

        $seen[$normalized] = true;
    }

    private function assertAllowedFileType(
        string $path
    ): void {
        $extension = strtolower(
            pathinfo(
                $path,
                PATHINFO_EXTENSION
            )
        );

        if (
            $extension === '' ||
            ! in_array(
                $extension,
                self::ALLOWED_FILE_EXTENSIONS,
                true
            )
        ) {
            throw new RuntimeException(
                'Tipo de archivo no permitido en el paquete: ' .
                $path
            );
        }
    }

    private function assertTreeWithinLimits(
        string $destination
    ): void {
        if (! is_dir($destination)) {
            return;
        }

        $iterator =
            new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator(
                    $destination,
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

            if ($file->isFile()) {
                $bytes +=
                    $file->getSize();

                if (
                    $bytes >
                    self::MAX_EXTRACTED_BYTES
                ) {
                    throw new RuntimeException(
                        'El staging supera 200 MiB.'
                    );
                }
            }
        }
    }

    private function validateExtractedTree(
        string $destination
    ): void {
        $root =
            realpath($destination);

        if ($root === false) {
            throw new RuntimeException(
                'No existe el staging extraído.'
            );
        }

        $rootNormalized =
            rtrim(
                str_replace(
                    '\\',
                    '/',
                    $root
                ),
                '/'
            );

        $iterator =
            new \RecursiveIteratorIterator(
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

            $real =
                $file->getRealPath();

            if ($real === false) {
                throw new RuntimeException(
                    'No se pudo resolver un archivo del staging.'
                );
            }

            $realNormalized =
                str_replace(
                    '\\',
                    '/',
                    $real
                );

            if (
                strcasecmp(
                    $realNormalized,
                    $rootNormalized
                ) !== 0 &&
                ! str_starts_with(
                    strtolower(
                        $realNormalized
                    ),
                    strtolower(
                        $rootNormalized .
                        '/'
                    )
                )
            ) {
                throw new RuntimeException(
                    'Archivo extraído fuera del staging.'
                );
            }

            $relative = ltrim(
                substr(
                    $realNormalized,
                    strlen(
                        $rootNormalized
                    )
                ),
                '/'
            );

            if ($relative !== '') {
                $this->assertSafeRelativePath(
                    $relative
                );
            }

            if ($file->isFile()) {
                $this->assertAllowedFileType(
                    $relative
                );

                $bytes +=
                    $file->getSize();

                if (
                    $bytes >
                    self::MAX_EXTRACTED_BYTES
                ) {
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
            $this->deleteTree(
                $destination
            );
        }

        if (
            ! mkdir(
                $destination,
                0775,
                true
            ) &&
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

        if (
            is_file($path) ||
            is_link($path)
        ) {
            @unlink($path);
            return;
        }

        $iterator =
            new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator(
                    $path,
                    \FilesystemIterator::SKIP_DOTS
                ),
                \RecursiveIteratorIterator::CHILD_FIRST
            );

        foreach ($iterator as $entry) {
            if (
                $entry->isDir() &&
                ! $entry->isLink()
            ) {
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
