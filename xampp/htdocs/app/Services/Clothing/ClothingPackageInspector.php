<?php

namespace App\Services\Clothing;

use DOMDocument;
use DOMElement;
use DOMXPath;
use RuntimeException;

class ClothingPackageInspector
{
    private const ALLOWED_CATEGORIES = [
        'hd',
        'hr',
        'bn',
        'ha',
        'he',
        'er',
        'mu',
        'fa',
        'be',
        'ea',
        'ch',
        'cp',
        'cc',
        'ca',
        'nk',
        'gl',
        'wr',
        'ba',
        'bp',
        'lg',
        'sh',
        'wa',
        'pe',
        'ce',
        'wi',
        'tl',
    ];

    private const MAX_XML_BYTES = 5242880; // 5 MiB
    private const MAX_SWF_DECLARED_BYTES = 52428800; // 50 MiB

    public function inspect(
        string $directory
    ): array {
        $root = realpath($directory);

        if ($root === false || ! is_dir($root)) {
            throw new RuntimeException(
                'No existe el directorio de staging.'
            );
        }

        $files = $this->collectFiles($root);

        $errors = [];
        $warnings = [];

        $categoriesPath = $this->findUniqueByBasename(
            $files,
            'categories.txt',
            $errors
        );

        $figureDataPath = $this->findUniqueByBasename(
            $files,
            'figuredata.xml',
            $errors
        );

        $figureMapPath = $this->findUniqueByBasename(
            $files,
            'figuremap.xml',
            $errors
        );

        $categories = [];

        if ($categoriesPath !== null) {
            try {
                $categories = $this->parseCategories(
                    $categoriesPath
                );
            } catch (\Throwable $exception) {
                $errors[] = $exception->getMessage();
            }
        }

        $figureData = [
            'settypes' => [],
            'sets' => [],
            'set_ids' => [],
            'part_ids' => [],
        ];

        if ($figureDataPath !== null) {
            try {
                $figureData = $this->parseFigureData(
                    $figureDataPath
                );
            } catch (\Throwable $exception) {
                $errors[] = $exception->getMessage();
            }
        }

        $figureMap = [
            'libraries' => [],
            'part_mappings' => [],
        ];

        if ($figureMapPath !== null) {
            try {
                $figureMap = $this->parseFigureMap(
                    $figureMapPath
                );
            } catch (\Throwable $exception) {
                $errors[] = $exception->getMessage();
            }
        }

        $swfs = [];

        foreach ($files as $relative => $absolute) {
            if (
                strtolower(
                    pathinfo(
                        $absolute,
                        PATHINFO_EXTENSION
                    )
                ) !== 'swf'
            ) {
                continue;
            }

            try {
                $swfs[] = $this->inspectSwf(
                    $absolute,
                    $relative
                );
            } catch (\Throwable $exception) {
                $errors[] = $exception->getMessage();
            }
        }

        if ($swfs === []) {
            $errors[] =
                'El paquete no contiene ningún SWF.';
        }

        $libraryIds = array_map(
            'strtolower',
            array_keys(
                $figureMap['libraries']
            )
        );

        $clothingSwfs = [];
        $redeemableCandidates = [];

        foreach ($swfs as $swf) {
            $basename = strtolower(
                pathinfo(
                    $swf['relative_path'],
                    PATHINFO_FILENAME
                )
            );

            if (
                in_array(
                    $basename,
                    $libraryIds,
                    true
                )
            ) {
                $clothingSwfs[] = $swf;
            } else {
                $redeemableCandidates[] = $swf;
            }
        }

        if (
            $figureMap['libraries'] !== [] &&
            $clothingSwfs === []
        ) {
            $errors[] =
                'Ningún SWF coincide con las librerías declaradas en figuremap.xml.';
        }

        if ($redeemableCandidates === []) {
            $errors[] =
                'No se encontró un SWF candidato para el furni canjeable.';
        } elseif (count($redeemableCandidates) > 1) {
            $warnings[] =
                'Hay varios SWF que no pertenecen a FigureMap; STAFF deberá confirmar cuál es el furni canjeable.';
        }

        if ($categories === []) {
            $errors[] =
                'categories.txt no contiene ninguna asignación válida.';
        }

        $categoryCodes = array_values(
            array_unique(
                array_column(
                    $categories,
                    'category'
                )
            )
        );

        foreach ($categoryCodes as $category) {
            if (
                ! in_array(
                    $category,
                    self::ALLOWED_CATEGORIES,
                    true
                )
            ) {
                $warnings[] =
                    'La categoría de origen "' .
                    $category .
                    '" no existe en el registro actual del Armario; STAFF deberá remapearla.';
            }
        }

        $declaredSetIds = array_values(
            array_map(
                'strval',
                is_array(
                    $figureData[
                        'set_ids'
                    ] ?? null
                )
                    ? $figureData[
                        'set_ids'
                    ]
                    : []
            )
        );

        $placeholderSetIds = array_values(
            array_unique(
                array_filter(
                    $declaredSetIds,
                    static fn (
                        string $value
                    ): bool =>
                        $value === '' ||
                        ! ctype_digit(
                            $value
                        )
                )
            )
        );

        if ($placeholderSetIds !== []) {
            $warnings[] =
                'figuredata.xml contiene IDs placeholder/no numéricos (' .
                implode(
                    ', ',
                    $placeholderSetIds
                ) .
                '). Es correcto: Biribiri asignará IDs finales automáticamente al aprobar.';
        }

        if (
            count($declaredSetIds) !==
            count(
                array_unique(
                    $declaredSetIds
                )
            )
        ) {
            $warnings[] =
                'figuredata.xml repite IDs declarados. No bloquea la importación porque Biribiri no reutiliza esos IDs como destino.';
        }

        $packageCodes = array_values(
            array_unique(
                array_filter(
                    array_merge(
                        array_column(
                            $categories,
                            'code'
                        ),
                        array_keys(
                            $figureMap['libraries']
                        ),
                        array_map(
                            fn (array $swf): string =>
                                pathinfo(
                                    $swf['relative_path'],
                                    PATHINFO_FILENAME
                                ),
                            $swfs
                        )
                    ),
                    fn ($value): bool =>
                        is_string($value) &&
                        trim($value) !== ''
                )
            )
        );

        $manifest = [
            'root' => $root,
            'categories_file' =>
                $categoriesPath
                    ? $this->relative(
                        $root,
                        $categoriesPath
                    )
                    : null,
            'figuredata_file' =>
                $figureDataPath
                    ? $this->relative(
                        $root,
                        $figureDataPath
                    )
                    : null,
            'figuremap_file' =>
                $figureMapPath
                    ? $this->relative(
                        $root,
                        $figureMapPath
                    )
                    : null,
            'categories' => $categories,
            'figuredata' => $figureData,
            'figuremap' => $figureMap,
            'swfs' => $swfs,
            'clothing_swfs' => $clothingSwfs,
            'redeemable_furni_candidates' =>
                $redeemableCandidates,
            'codes' => $packageCodes,

            /*
             * No renombramos todavía.
             * P3 comprobará referencias contra assets/DB vivos
             * antes de decidir si podemos cambiar códigos de
             * ClothingBuilder/FurniBuilder sin romper el SWF.
             */
            'automatic_code_rename_safe' => false,
        ];

        return [
            'valid' => $errors === [],
            'errors' => array_values(
                array_unique($errors)
            ),
            'warnings' => array_values(
                array_unique($warnings)
            ),
            'manifest' => $manifest,
        ];
    }

    private function collectFiles(
        string $root
    ): array {
        $result = [];

        $iterator = new \RecursiveIteratorIterator(
            new \RecursiveDirectoryIterator(
                $root,
                \FilesystemIterator::SKIP_DOTS
            )
        );

        foreach ($iterator as $file) {
            if (! $file->isFile()) {
                continue;
            }

            $relative = $this->relative(
                $root,
                $file->getPathname()
            );

            $extension = strtolower(
                pathinfo(
                    $relative,
                    PATHINFO_EXTENSION
                )
            );

            if (
                ! in_array(
                    $extension,
                    [
                        'txt',
                        'xml',
                        'swf',
                        'png',
                        'gif',
                        'json',
                    ],
                    true
                )
            ) {
                throw new RuntimeException(
                    'Tipo de archivo no permitido en el paquete: ' .
                    $relative
                );
            }

            $result[$relative] =
                $file->getPathname();
        }

        return $result;
    }

    private function findUniqueByBasename(
        array $files,
        string $basename,
        array &$errors
    ): ?string {
        $matches = [];

        foreach ($files as $absolute) {
            if (
                strcasecmp(
                    basename($absolute),
                    $basename
                ) === 0
            ) {
                $matches[] = $absolute;
            }
        }

        if ($matches === []) {
            $errors[] =
                'Falta ' . $basename . '.';

            return null;
        }

        if (count($matches) > 1) {
            $errors[] =
                'Hay más de un ' .
                $basename .
                ' en el paquete.';

            return null;
        }

        return $matches[0];
    }

    private function parseCategories(
        string $path
    ): array {
        $content = file_get_contents($path);

        if ($content === false) {
            throw new RuntimeException(
                'No se pudo leer categories.txt.'
            );
        }

        $rows = [];

        foreach (
            preg_split('/\R/', $content) ?: []
            as $line
        ) {
            $line = trim($line);

            if (
                $line === '' ||
                str_starts_with($line, '#')
            ) {
                continue;
            }

            if (
                preg_match(
                    '/^(.+?)\s*-\s*([A-Za-z]{2})$/',
                    $line,
                    $match
                ) !== 1
            ) {
                throw new RuntimeException(
                    'Línea inválida en categories.txt: ' .
                    $line
                );
            }

            $rows[] = [
                'code' => trim($match[1]),
                'category' => strtolower(
                    trim($match[2])
                ),
            ];
        }

        return $rows;
    }

    private function parseFigureData(
        string $path
    ): array {
        $dom = $this->loadXml(
            $path,
            'figuredata.xml'
        );

        $xpath = new DOMXPath($dom);

        $settypes = [];
        $sets = [];
        $setIds = [];
        $sourceKeys = [];
        $partIds = [];
        $sourceOrdinal = 0;

        /*
         * Soportamos las dos formas reales de FigureData:
         *
         * 1) gamedata completo:
         *    <settype type="ch"><set ... /></settype>
         *
         * 2) Figure Data Snippet de ClothingBuilder:
         *    <set id="DEFINE_ID"> ... </set>
         *
         * Un set standalone puede contener varias capas técnicas
         * (por ejemplo ch + ls). Eso NO significa varias prendas.
         * El tipo público de la prenda se resolverá después usando
         * categories.txt + FigureMap, no inventándolo desde las capas.
         */
        foreach (
            $xpath->query(
                '//*[local-name()="settype"]'
            ) ?: []
            as $settype
        ) {
            if (! $settype instanceof DOMElement) {
                continue;
            }

            $type = trim(
                $settype->getAttribute('type')
            );

            if ($type !== '') {
                $settypes[$type] = [
                    'type' => $type,
                    'palette_id' =>
                        $settype->getAttribute(
                            'paletteid'
                        ),
                ];
            }
        }

        foreach (
            $xpath->query(
                '//*[local-name()="set"]'
            ) ?: []
            as $set
        ) {
            if (! $set instanceof DOMElement) {
                continue;
            }

            $id = trim(
                $set->getAttribute('id')
            );

            if ($id === '') {
                continue;
            }

            $type = trim(
                $set->getAttribute('type')
            );

            if ($type === '') {
                $parent = $set->parentNode;

                while ($parent instanceof DOMElement) {
                    $parentName = strtolower(
                        $parent->localName
                            ?: $parent->nodeName
                    );

                    if ($parentName === 'settype') {
                        $type = trim(
                            $parent->getAttribute(
                                'type'
                            )
                        );

                        break;
                    }

                    $parent = $parent->parentNode;
                }
            }

            $setIds[] = $id;

            $sourceOrdinal++;
            $sourceKey =
                'source-set-' .
                $sourceOrdinal;

            $sourceKeys[] =
                $sourceKey;

            $entry = [
                /*
                 * El ID declarado por ClothingBuilder es metadata
                 * fuente. DEFINE_ID es válido. Biribiri asignará el
                 * set ID final al aprobar.
                 */
                'id' => $id,
                'declared_id' => $id,
                'source_key' => $sourceKey,
                /*
                 * Puede quedar vacío en Figure Data Snippet.
                 * ClothingPackagePieceResolver lo enlazará con la
                 * categoría usando FigureMap + categories.txt.
                 */
                'type' => $type,
                'gender' =>
                    $set->getAttribute('gender'),
                'club' =>
                    $set->getAttribute('club'),
                'colorable' =>
                    $set->getAttribute(
                        'colorable'
                    ),
                'selectable' =>
                    $set->getAttribute(
                        'selectable'
                    ),
                'sellable' =>
                    $set->getAttribute(
                        'sellable'
                    ),
                'parts' => [],
            ];

            foreach (
                $xpath->query(
                    './/*[local-name()="part"]',
                    $set
                ) ?: []
                as $part
            ) {
                if (! $part instanceof DOMElement) {
                    continue;
                }

                $partId = trim(
                    $part->getAttribute('id')
                );

                if ($partId !== '') {
                    $partIds[] = $partId;
                }

                $entry['parts'][] = [
                    'id' => $partId,
                    'type' =>
                        $part->getAttribute(
                            'type'
                        ),
                    'colorindex' =>
                        $part->getAttribute(
                            'colorindex'
                        ),
                    'index' =>
                        $part->getAttribute(
                            'index'
                        ),
                ];
            }

            $sets[] = $entry;
        }

        if ($sets === []) {
            throw new RuntimeException(
                'figuredata.xml no contiene ningún set de ropa.'
            );
        }

        return [
            'settypes' => $settypes,
            'sets' => $sets,
            'set_ids' => $setIds,
            'source_keys' =>
                $sourceKeys,
            'part_ids' => array_values(
                array_unique($partIds)
            ),
        ];
    }


    private function parseFigureMap(
        string $path
    ): array {
        $dom = $this->loadXml(
            $path,
            'figuremap.xml'
        );

        $xpath = new DOMXPath($dom);

        $libraries = [];
        $partMappings = [];

        foreach (
            $xpath->query('//*[local-name()="lib"]')
            ?: []
            as $lib
        ) {
            if (! $lib instanceof DOMElement) {
                continue;
            }

            $libraryId = trim(
                $lib->getAttribute('id')
            );

            if ($libraryId === '') {
                continue;
            }

            $parts = [];

            foreach (
                $xpath->query(
                    './/*[local-name()="part"]',
                    $lib
                ) ?: []
                as $part
            ) {
                if (! $part instanceof DOMElement) {
                    continue;
                }

                $mapping = [
                    'type' =>
                        $part->getAttribute('type'),
                    'id' =>
                        $part->getAttribute('id'),
                ];

                $parts[] = $mapping;
                $partMappings[] =
                    ['library' => $libraryId] +
                    $mapping;
            }

            $libraries[$libraryId] = [
                'id' => $libraryId,
                'parts' => $parts,
            ];
        }

        if ($libraries === []) {
            throw new RuntimeException(
                'figuremap.xml no contiene ninguna librería.'
            );
        }

        return [
            'libraries' => $libraries,
            'part_mappings' => $partMappings,
        ];
    }

    private function loadXml(
        string $path,
        string $label
    ): DOMDocument {
        $size = filesize($path);

        if (
            $size === false ||
            $size <= 0 ||
            $size > self::MAX_XML_BYTES
        ) {
            throw new RuntimeException(
                $label .
                ' está vacío o supera 5 MiB.'
            );
        }

        $content = file_get_contents($path);

        if ($content === false) {
            throw new RuntimeException(
                'No se pudo leer ' .
                $label .
                '.'
            );
        }

        if (
            stripos($content, '<!DOCTYPE') !== false ||
            stripos($content, '<!ENTITY') !== false
        ) {
            throw new RuntimeException(
                $label .
                ' contiene DTD/ENTITY y se ha rechazado por seguridad.'
            );
        }

        $previous = libxml_use_internal_errors(
            true
        );

        try {
            $dom = new DOMDocument();

            if (
                $dom->loadXML(
                    $content,
                    LIBXML_NONET |
                    LIBXML_NOBLANKS |
                    LIBXML_COMPACT
                )
            ) {
                return $dom;
            }

            $directMessages = [];

            foreach (
                libxml_get_errors()
                as $error
            ) {
                $directMessages[] = trim(
                    $error->message
                );
            }

            libxml_clear_errors();

            /*
             * ClothingBuilder también exporta fragmentos XML válidos
             * para el importer, por ejemplo varios <set> o varios <lib>
             * hermanos sin un nodo raíz común. DOMDocument exige una
             * raíz única, así que solo para parsear los envolvemos en
             * un nodo sintético. El contenido original no se modifica.
             */
            $fragmentContent = preg_replace(
                '/<\\?xml[^?]*\\?>/i',
                '',
                $content
            );

            if (! is_string($fragmentContent)) {
                $fragmentContent = $content;
            }

            $wrapped =
                '<biribiri-fragment>' .
                $fragmentContent .
                '</biribiri-fragment>';

            $fragmentDom = new DOMDocument();

            if (
                $fragmentDom->loadXML(
                    $wrapped,
                    LIBXML_NONET |
                    LIBXML_NOBLANKS |
                    LIBXML_COMPACT
                )
            ) {
                return $fragmentDom;
            }

            $fragmentMessages = [];

            foreach (
                libxml_get_errors()
                as $error
            ) {
                $fragmentMessages[] = trim(
                    $error->message
                );
            }

            $messages = array_values(
                array_unique(
                    array_merge(
                        $directMessages,
                        $fragmentMessages
                    )
                )
            );

            throw new RuntimeException(
                $label .
                ' no es XML válido ni un fragmento XML válido: ' .
                implode(
                    ' | ',
                    array_slice(
                        $messages,
                        0,
                        5
                    )
                )
            );
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors(
                $previous
            );
        }
    }

    private function inspectSwf(
        string $path,
        string $relative
    ): array {
        $handle = fopen($path, 'rb');

        if (! is_resource($handle)) {
            throw new RuntimeException(
                'No se pudo leer SWF: ' .
                $relative
            );
        }

        try {
            $header = fread($handle, 8);
        } finally {
            fclose($handle);
        }

        if (
            ! is_string($header) ||
            strlen($header) < 8
        ) {
            throw new RuntimeException(
                'SWF demasiado corto: ' .
                $relative
            );
        }

        $signature = substr($header, 0, 3);

        if (
            ! in_array(
                $signature,
                ['FWS', 'CWS', 'ZWS'],
                true
            )
        ) {
            throw new RuntimeException(
                'Firma SWF inválida en ' .
                $relative .
                '.'
            );
        }

        $declared = unpack(
            'Vlength',
            substr($header, 4, 4)
        );

        $declaredLength = (int) (
            $declared['length'] ?? 0
        );

        if (
            $declaredLength < 8 ||
            $declaredLength >
                self::MAX_SWF_DECLARED_BYTES
        ) {
            throw new RuntimeException(
                'Longitud SWF declarada inválida en ' .
                $relative .
                '.'
            );
        }

        return [
            'relative_path' => $relative,
            'signature' => $signature,
            'file_size' =>
                (int) filesize($path),
            'declared_uncompressed_size' =>
                $declaredLength,
            'sha256' =>
                hash_file(
                    'sha256',
                    $path
                ),
        ];
    }

    private function relative(
        string $root,
        string $path
    ): string {
        $rootNormalized = rtrim(
            str_replace(
                '\\',
                '/',
                $root
            ),
            '/'
        );

        $pathNormalized = str_replace(
            '\\',
            '/',
            $path
        );

        if (
            ! str_starts_with(
                strtolower($pathNormalized),
                strtolower(
                    $rootNormalized . '/'
                )
            )
        ) {
            return basename($pathNormalized);
        }

        return substr(
            $pathNormalized,
            strlen($rootNormalized) + 1
        );
    }
}