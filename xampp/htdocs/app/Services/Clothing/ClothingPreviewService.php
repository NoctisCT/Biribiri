<?php

namespace App\Services\Clothing;

use App\Models\ClothingSubmission;
use App\Models\User;
use Illuminate\Support\Str;
use RuntimeException;

class ClothingPreviewService
{
    private const VERSION = 9;

    /*
     * IDs efímeros para construir el sandbox de preview.
     * No se consultan, reservan ni instalan en DB.
     */
    private const PREVIEW_PUBLIC_BASE_ITEM_ID = 2146999998;
    private const PREVIEW_CATALOG_ITEM_ID = 2146999999;

    public function __construct(
        private readonly ClothingNitroConverterService $converter,
        private readonly ClothingNitroPartIdRemapperService $partIdRemapper,
        private readonly ClothingRedeemableNitroService $redeemableNitro,
        private readonly ClothingBiribiriCodeService $biribiriCode,
        private readonly ClothingGamedataInstaller $gamedataInstaller
    ) {
    }

    public function ensure(
        ClothingSubmission $submission
    ): array {
        $existing =
            $submission->preview_manifest;

        if (
            is_array($existing) &&
            (int) ($existing['version'] ?? 0) ===
                self::VERSION &&
            $this->manifestFilesExist(
                $existing
            )
        ) {
            return $existing;
        }

        return $this->generate(
            $submission
        );
    }

    public function generate(
        ClothingSubmission $submission
    ): array {
        $submission->refresh();

        if (
            $submission->technical_status !==
                'valid'
        ) {
            throw new RuntimeException(
                'La solicitud no tiene QA técnico válido.'
            );
        }

        $report =
            $submission->technical_report;

        if (
            ! is_array($report) ||
            ! ($report['valid'] ?? false)
        ) {
            throw new RuntimeException(
                'Falta technical_report válido.'
            );
        }

        $manifest =
            is_array(
                $report['manifest'] ?? null
            )
                ? $report['manifest']
                : [];

        $identity =
            is_array(
                $report['identity'] ?? null
            )
                ? $report['identity']
                : [];

        $pieceReport =
            is_array(
                $report['pieces'] ?? null
            )
                ? $report['pieces']
                : [];

        $partRemap =
            is_array(
                $report[
                    'part_id_remap'
                ] ?? null
            )
                ? $report[
                    'part_id_remap'
                ]
                : [];

        $sourceToBiribiri =
            is_array(
                $partRemap[
                    'source_to_biribiri'
                ] ?? null
            )
                ? $partRemap[
                    'source_to_biribiri'
                ]
                : [];

        if (
            ! ($partRemap['valid'] ?? false) ||
            $sourceToBiribiri === []
        ) {
            throw new RuntimeException(
                'Falta mapping source Part ID -> Biribiri.'
            );
        }

        $stagingRelative =
            trim(
                (string) (
                    $report['staging'][
                        'relative_root'
                    ] ?? ''
                )
            );

        if ($stagingRelative === '') {
            throw new RuntimeException(
                'Falta staging.relative_root.'
            );
        }

        $staging =
            storage_path(
                'app/' .
                ltrim(
                    str_replace(
                        '\\',
                        '/',
                        $stagingRelative
                    ),
                    '/'
                )
            );

        if (! is_dir($staging)) {
            throw new RuntimeException(
                'No existe el staging de la solicitud.'
            );
        }

        $token =
            Str::uuid()->toString();

        $rootRelative =
            'clothing_importer/previews/' .
            $submission->id .
            '/' .
            $token;

        $root =
            storage_path(
                'app/' .
                $rootRelative
            );

        $this->ensureDirectory(
            $root
        );

        $protectedLive = [
            public_path(
                'nitro-assets/gamedata/FigureMap.json'
            ),
            public_path(
                'nitro-assets/gamedata/FigureData.json'
            ),
            public_path(
                'nitro-assets/gamedata/FurnitureData.json'
            ),
        ];

        $liveBefore =
            $this->hashFiles(
                $protectedLive
            );

        try {
            $figures =
                $this->generateFigurePreviews(
                    $submission,
                    $staging,
                    $root,
                    $rootRelative,
                    $manifest,
                    $pieceReport,
                    $sourceToBiribiri
                );

            $furniture =
                $this->generateFurniturePreview(
                    $submission,
                    $staging,
                    $root,
                    $rootRelative,
                    $manifest,
                    $identity
                );

            $avatar =
                $this->generateAvatarPreview(
                    $submission,
                    $root,
                    $rootRelative
                );

            $liveAfter =
                $this->hashFiles(
                    $protectedLive
                );

            if ($liveBefore !== $liveAfter) {
                throw new RuntimeException(
                    'La generación de preview modificó gamedata vivo.'
                );
            }

            $preview = [
                'version' =>
                    self::VERSION,
                'generated_at' =>
                    now()->toIso8601String(),
                'submission_id' =>
                    (int)
                    $submission->id,
                'root_relative' =>
                    $rootRelative,
                'figures' =>
                    $figures,
                'furniture' =>
                    $furniture,
                'avatar' =>
                    $avatar,
                'source_to_biribiri' =>
                    $sourceToBiribiri,
                'technical_only' =>
                    true,
                'live_assets_written' =>
                    false,
                'figure_set_ids_allocated' =>
                    false,
            ];

            $submission->forceFill([
                'preview_manifest' =>
                    $preview,
            ])->save();

            return $preview;
        } catch (\Throwable $exception) {
            $this->deleteTree(
                $root
            );

            throw $exception;
        }
    }

    public function dataUri(
        ?string $relative
    ): ?string {
        $relative =
            trim(
                str_replace(
                    '\\',
                    '/',
                    (string) $relative
                )
            );

        if (
            $relative === '' ||
            ! str_starts_with(
                $relative,
                'clothing_importer/previews/'
            ) ||
            str_contains(
                $relative,
                '../'
            )
        ) {
            return null;
        }

        $path =
            storage_path(
                'app/' .
                ltrim(
                    $relative,
                    '/'
                )
            );

        if (! is_file($path)) {
            return null;
        }

        $bytes =
            file_get_contents(
                $path
            );

        if (! is_string($bytes)) {
            return null;
        }

        return 'data:image/png;base64,' .
            base64_encode(
                $bytes
            );
    }

    private function generateFigurePreviews(
        ClothingSubmission $submission,
        string $staging,
        string $root,
        string $rootRelative,
        array $manifest,
        array $pieceReport,
        array $sourceToBiribiri
    ): array {
        $swfs =
            is_array(
                $manifest[
                    'clothing_swfs'
                ] ?? null
            )
                ? $manifest[
                    'clothing_swfs'
                ]
                : [];

        if ($swfs === []) {
            throw new RuntimeException(
                'El paquete no contiene SWF de ropa.'
            );
        }

        $figureDirectory =
            $root .
            DIRECTORY_SEPARATOR .
            'figure';

        $imageDirectory =
            $root .
            DIRECTORY_SEPARATOR .
            'images';

        $this->ensureDirectory(
            $figureDirectory
        );

        $this->ensureDirectory(
            $imageDirectory
        );

        $results = [];

        foreach ($swfs as $entry) {
            if (! is_array($entry)) {
                continue;
            }

            $relative =
                trim(
                    (string) (
                        $entry[
                            'relative_path'
                        ] ?? ''
                    )
                );

            if ($relative === '') {
                continue;
            }

            $source =
                $this->safeStagingFile(
                    $staging,
                    $relative
                );

            $sourceClassName =
                pathinfo(
                    $source,
                    PATHINFO_FILENAME
                );

            $library =
                $this->findLibrary(
                    $manifest,
                    $sourceClassName
                );

            $sourceCode =
                $this->sourceCodeForLibrary(
                    $pieceReport,
                    $sourceClassName
                );

            $className =
                $this->biribiriCode
                    ->figureLibraryCode(
                        $submission,
                        $sourceClassName,
                        $sourceCode
                    );

            $sourceIds = [];

            foreach (
                is_array(
                    $library['parts'] ?? null
                )
                    ? $library['parts']
                    : []
                as $part
            ) {
                if (! is_array($part)) {
                    continue;
                }

                $id =
                    trim(
                        (string) (
                            $part['id'] ??
                            ''
                        )
                    );

                if ($id !== '') {
                    $sourceIds[] =
                        $id;
                }
            }

            $sourceIds =
                array_values(
                    array_unique(
                        $sourceIds
                    )
                );

            if ($sourceIds === []) {
                throw new RuntimeException(
                    'Library sin Part IDs: ' .
                    $sourceClassName
                );
            }

            $mapping = [];

            foreach ($sourceIds as $sourceId) {
                if (
                    ! array_key_exists(
                        $sourceId,
                        $sourceToBiribiri
                    )
                ) {
                    throw new RuntimeException(
                        'Falta mapping Part ID para ' .
                        $sourceClassName .
                        ': ' .
                        $sourceId
                    );
                }

                $mapping[$sourceId] =
                    (string)
                    $sourceToBiribiri[
                        $sourceId
                    ];
            }

            $raw =
                $figureDirectory .
                DIRECTORY_SEPARATOR .
                $sourceClassName .
                '.source.nitro';

            $final =
                $figureDirectory .
                DIRECTORY_SEPARATOR .
                $className .
                '.nitro';

            $png =
                $imageDirectory .
                DIRECTORY_SEPARATOR .
                $className .
                '.png';

            $this->converter->convert(
                $source,
                $raw
            );

            $remap =
                $this->partIdRemapper->remap(
                    $raw,
                    $final,
                    $mapping,
                    $sourceClassName,
                    $className
                );

            @unlink(
                $raw
            );

            $image =
                $this->extractLargestPng(
                    $final,
                    $png
                );

            $results[] = [
                'class_name' =>
                    $className,
                'library_code' =>
                    $className,
                'source_library_code' =>
                    $sourceClassName,
                'source_relative' =>
                    $relative,
                'source_part_ids' =>
                    $sourceIds,
                'biribiri_part_ids' =>
                    array_values(
                        $mapping
                    ),
                'part_id_map' =>
                    $mapping,
                'nitro_relative' =>
                    $rootRelative .
                    '/figure/' .
                    $className .
                    '.nitro',
                'nitro_sha256' =>
                    hash_file(
                        'sha256',
                        $final
                    ),
                'png_relative' =>
                    $rootRelative .
                    '/images/' .
                    $className .
                    '.png',
                'png_internal_name' =>
                    $image[
                        'internal_name'
                    ],
                'png_sha256' =>
                    $image['sha256'],
                'width' =>
                    $image['width'],
                'height' =>
                    $image['height'],
                'remap_valid' =>
                    (bool) (
                        $remap['report'][
                            'valid'
                        ] ?? false
                    ),
            ];
        }

        if ($results === []) {
            throw new RuntimeException(
                'No se pudo generar ninguna preview de ropa.'
            );
        }

        return $results;
    }

    private function generateFurniturePreview(
        ClothingSubmission $submission,
        string $staging,
        string $root,
        string $rootRelative,
        array $manifest,
        array $identity
    ): array {
        $candidates =
            is_array(
                $manifest[
                    'redeemable_furni_candidates'
                ] ?? null
            )
                ? $manifest[
                    'redeemable_furni_candidates'
                ]
                : [];

        if (count($candidates) !== 1) {
            throw new RuntimeException(
                'La preview requiere exactamente un furni canjeable.'
            );
        }

        $relative =
            trim(
                (string) (
                    $candidates[0][
                        'relative_path'
                    ] ?? ''
                )
            );

        if ($relative === '') {
            throw new RuntimeException(
                'Furni canjeable sin ruta.'
            );
        }

        $source =
            $this->safeStagingFile(
                $staging,
                $relative
            );

        $sourceRedeemableCode =
            trim(
                (string) (
                    $identity[
                        'redeemable_furni_code'
                    ] ?? ''
                )
            );

        if ($sourceRedeemableCode === '') {
            throw new RuntimeException(
                'Falta redeemable_furni_code fuente.'
            );
        }

        $redeemableCode =
            $this->biribiriCode
                ->redeemableCode(
                    $submission
                );

        $directory =
            $root .
            DIRECTORY_SEPARATOR .
            'furniture';

        $imageDirectory =
            $root .
            DIRECTORY_SEPARATOR .
            'images';

        $this->ensureDirectory(
            $directory
        );

        $this->ensureDirectory(
            $imageDirectory
        );

        $raw =
            $directory .
            DIRECTORY_SEPARATOR .
            $redeemableCode .
            '.source.nitro';

        $final =
            $directory .
            DIRECTORY_SEPARATOR .
            $redeemableCode .
            '.nitro';

        $icon =
            $imageDirectory .
            DIRECTORY_SEPARATOR .
            $redeemableCode .
            '_icon.png';

        $atlas =
            $imageDirectory .
            DIRECTORY_SEPARATOR .
            $redeemableCode .
            '_furniture.png';

        $this->converter->convert(
            $source,
            $raw
        );

        $comparatorClass =
            trim(
                (string) config(
                    'clothing_marketplace.installer.redeemable_nitro_comparator_class',
                    'clothing_r21_trainoutfit'
                )
            );

        $comparator =
            public_path(
                'nitro-assets/bundled/furniture/' .
                $comparatorClass .
                '.nitro'
            );

        if (! is_file($comparator)) {
            throw new RuntimeException(
                'Falta comparator Nitro: ' .
                $comparatorClass
            );
        }

        $normalizer =
            $this->redeemableNitro->normalize(
                $raw,
                $comparator,
                $final,
                $icon,
                $redeemableCode,
                $sourceRedeemableCode
            );

        @unlink(
            $raw
        );

        $atlasInfo =
            $this->extractLargestPng(
                $final,
                $atlas
            );

        $iconSize =
            @getimagesize(
                $icon
            );

        if (
            ! is_array($iconSize) ||
            (int) ($iconSize[0] ?? 0) <= 0 ||
            (int) ($iconSize[1] ?? 0) <= 0
        ) {
            throw new RuntimeException(
                'El icono de furni generado no es PNG válido.'
            );
        }

        return [
            'redeemable_code' =>
                $redeemableCode,
            'source_redeemable_code' =>
                $sourceRedeemableCode,
            'source_relative' =>
                $relative,
            'nitro_relative' =>
                $rootRelative .
                '/furniture/' .
                $redeemableCode .
                '.nitro',
            'nitro_sha256' =>
                hash_file(
                    'sha256',
                    $final
                ),
            'atlas_relative' =>
                $rootRelative .
                '/images/' .
                $redeemableCode .
                '_furniture.png',
            'atlas_internal_name' =>
                $atlasInfo[
                    'internal_name'
                ],
            'atlas_width' =>
                $atlasInfo['width'],
            'atlas_height' =>
                $atlasInfo['height'],
            'icon_relative' =>
                $rootRelative .
                '/images/' .
                $redeemableCode .
                '_icon.png',
            'icon_sha256' =>
                hash_file(
                    'sha256',
                    $icon
                ),
            'icon_width' =>
                (int) $iconSize[0],
            'icon_height' =>
                (int) $iconSize[1],
            'logic_type' =>
                $normalizer[
                    'logic_type'
                ] ?? null,
            'directions' =>
                $normalizer[
                    'directions'
                ] ?? null,
        ];
    }

    private function sourceCodeForLibrary(
        array $pieceReport,
        string $sourceLibrary
    ): string {
        $pieces =
            is_array(
                $pieceReport[
                    'pieces'
                ] ?? null
            )
                ? $pieceReport[
                    'pieces'
                ]
                : [];

        foreach ($pieces as $piece) {
            if (! is_array($piece)) {
                continue;
            }

            foreach (
                is_array(
                    $piece[
                        'library_codes'
                    ] ?? null
                )
                    ? $piece[
                        'library_codes'
                    ]
                    : []
                as $library
            ) {
                if (
                    strcasecmp(
                        trim(
                            (string)
                            $library
                        ),
                        $sourceLibrary
                    ) !== 0
                ) {
                    continue;
                }

                $code =
                    trim(
                        (string) (
                            $piece['code']
                            ?? ''
                        )
                    );

                if ($code === '') {
                    throw new RuntimeException(
                        'La library ' .
                        $sourceLibrary .
                        ' no tiene code de categories.txt.'
                    );
                }

                return $code;
            }
        }

        throw new RuntimeException(
            'No se encontró el code de categories.txt para ' .
            $sourceLibrary
        );
    }

    private function findLibrary(
        array $manifest,
        string $className
    ): array {
        $libraries =
            is_array(
                $manifest[
                    'figuremap'
                ][
                    'libraries'
                ] ?? null
            )
                ? $manifest[
                    'figuremap'
                ][
                    'libraries'
                ]
                : [];

        foreach ($libraries as $key => $library) {
            if (! is_array($library)) {
                continue;
            }

            $id =
                (string) (
                    $library['id'] ??
                    $key
                );

            if (
                strcasecmp(
                    $id,
                    $className
                ) === 0
            ) {
                return $library;
            }
        }

        throw new RuntimeException(
            'No se encontró FigureMap library para ' .
            $className
        );
    }

    private function safeStagingFile(
        string $staging,
        string $relative
    ): string {
        $root =
            realpath(
                $staging
            );

        if ($root === false) {
            throw new RuntimeException(
                'Staging no resoluble.'
            );
        }

        $candidate =
            $staging .
            DIRECTORY_SEPARATOR .
            str_replace(
                ['/', '\\'],
                DIRECTORY_SEPARATOR,
                ltrim(
                    $relative,
                    '/\\'
                )
            );

        $resolved =
            realpath(
                $candidate
            );

        if (
            $resolved === false ||
            ! is_file($resolved)
        ) {
            throw new RuntimeException(
                'No existe archivo de staging: ' .
                $relative
            );
        }

        $prefix =
            rtrim(
                $root,
                DIRECTORY_SEPARATOR
            ) .
            DIRECTORY_SEPARATOR;

        if (
            $resolved !== $root &&
            ! str_starts_with(
                $resolved,
                $prefix
            )
        ) {
            throw new RuntimeException(
                'Ruta fuera del staging.'
            );
        }

        return $resolved;
    }

    private function extractLargestPng(
        string $nitro,
        string $output
    ): array {
        $data =
            file_get_contents(
                $nitro
            );

        if (
            ! is_string($data) ||
            strlen($data) < 2
        ) {
            throw new RuntimeException(
                'Nitro vacío o ilegible.'
            );
        }

        $offset = 0;

        $count =
            $this->readU16(
                $data,
                $offset
            );

        $largest = null;

        for (
            $index = 0;
            $index < $count;
            $index++
        ) {
            $nameLength =
                $this->readU16(
                    $data,
                    $offset
                );

            if (
                $nameLength < 1 ||
                $offset + $nameLength >
                    strlen($data)
            ) {
                throw new RuntimeException(
                    'Nitro truncado leyendo nombre.'
                );
            }

            $name =
                substr(
                    $data,
                    $offset,
                    $nameLength
                );

            $offset +=
                $nameLength;

            $payloadLength =
                $this->readU32(
                    $data,
                    $offset
                );

            if (
                $payloadLength < 1 ||
                $offset + $payloadLength >
                    strlen($data)
            ) {
                throw new RuntimeException(
                    'Nitro truncado leyendo payload.'
                );
            }

            $compressed =
                substr(
                    $data,
                    $offset,
                    $payloadLength
                );

            $offset +=
                $payloadLength;

            if (
                ! str_ends_with(
                    strtolower(
                        $name
                    ),
                    '.png'
                )
            ) {
                continue;
            }

            $raw =
                $this->inflate(
                    $compressed
                );

            if (
                ! str_starts_with(
                    $raw,
                    "\x89PNG\r\n\x1a\n"
                )
            ) {
                throw new RuntimeException(
                    'Entrada .png interna inválida.'
                );
            }

            if (
                $largest === null ||
                strlen($raw) >
                    strlen(
                        $largest['bytes']
                    )
            ) {
                $largest = [
                    'name' =>
                        $name,
                    'bytes' =>
                        $raw,
                ];
            }
        }

        if ($largest === null) {
            throw new RuntimeException(
                'Nitro sin PNG interno.'
            );
        }

        $this->ensureDirectory(
            dirname(
                $output
            )
        );

        file_put_contents(
            $output,
            $largest['bytes']
        );

        $size =
            @getimagesize(
                $output
            );

        if (
            ! is_array($size) ||
            (int) ($size[0] ?? 0) <= 0 ||
            (int) ($size[1] ?? 0) <= 0
        ) {
            throw new RuntimeException(
                'PNG extraído no válido.'
            );
        }

        return [
            'internal_name' =>
                $largest['name'],
            'width' =>
                (int) $size[0],
            'height' =>
                (int) $size[1],
            'sha256' =>
                hash_file(
                    'sha256',
                    $output
                ),
        ];
    }

    private function inflate(
        string $data
    ): string {
        foreach ([
            static fn () =>
                @gzuncompress(
                    $data
                ),
            static fn () =>
                @gzdecode(
                    $data
                ),
            static fn () =>
                @gzinflate(
                    $data
                ),
        ] as $attempt) {
            $raw =
                $attempt();

            if (is_string($raw)) {
                return $raw;
            }
        }

        throw new RuntimeException(
            'No se pudo descomprimir una entrada Nitro.'
        );
    }

    private function readU16(
        string $data,
        int &$offset
    ): int {
        if (
            $offset + 2 >
            strlen($data)
        ) {
            throw new RuntimeException(
                'Nitro truncado leyendo uint16.'
            );
        }

        $value =
            unpack(
                'nvalue',
                substr(
                    $data,
                    $offset,
                    2
                )
            );

        $offset += 2;

        return (int)
            $value['value'];
    }

    private function readU32(
        string $data,
        int &$offset
    ): int {
        if (
            $offset + 4 >
            strlen($data)
        ) {
            throw new RuntimeException(
                'Nitro truncado leyendo uint32.'
            );
        }

        $value =
            unpack(
                'Nvalue',
                substr(
                    $data,
                    $offset,
                    4
                )
            );

        $offset += 4;

        return (int)
            $value['value'];
    }


    private function generateAvatarPreview(
        ClothingSubmission $submission,
        string $root,
        string $rootRelative
    ): array {
        $previewPlanRoot =
            $root .
            DIRECTORY_SEPARATOR .
            '_avatar_plan';

        $plan =
            $this->gamedataInstaller
                ->prepare(
                    $submission,
                    self::PREVIEW_PUBLIC_BASE_ITEM_ID,
                    self::PREVIEW_CATALOG_ITEM_ID,
                    $previewPlanRoot
                );

        $preparedRoot =
            realpath(
                (string) (
                    $plan[
                        'prepared_root'
                    ] ?? ''
                )
            );

        if (
            $preparedRoot === false ||
            ! is_dir($preparedRoot)
        ) {
            throw new RuntimeException(
                'El plan de preview no generó prepared_root.'
            );
        }

        $avatarRoot =
            $root .
            DIRECTORY_SEPARATOR .
            'avatar';

        $this->ensureDirectory(
            $avatarRoot
        );

        try {
            $sourceGamedata =
                $preparedRoot .
                DIRECTORY_SEPARATOR .
                'gamedata';

            foreach ([
                'FigureData.json',
                'FigureMap.json',
            ] as $name) {
                $source =
                    $sourceGamedata .
                    DIRECTORY_SEPARATOR .
                    $name;

                if (! is_file($source)) {
                    throw new RuntimeException(
                        'Falta gamedata de preview: ' .
                        $name
                    );
                }

                $target =
                    $avatarRoot .
                    DIRECTORY_SEPARATOR .
                    'gamedata' .
                    DIRECTORY_SEPARATOR .
                    $name;

                $this->ensureDirectory(
                    dirname($target)
                );

                if (! copy($source, $target)) {
                    throw new RuntimeException(
                        'No se pudo copiar gamedata de avatar: ' .
                        $name
                    );
                }
            }

            $qaFigureDataPath =
                $avatarRoot .
                DIRECTORY_SEPARATOR .
                'gamedata' .
                DIRECTORY_SEPARATOR .
                'FigureData.json';

            $qaFigureDataRaw =
                file_get_contents(
                    $qaFigureDataPath
                );

            if (! is_string($qaFigureDataRaw)) {
                throw new RuntimeException(
                    'No se pudo leer FigureData de preview.'
                );
            }

            try {
                $qaFigureData =
                    json_decode(
                        $qaFigureDataRaw,
                        true,
                        512,
                        JSON_THROW_ON_ERROR
                    );
            } catch (\Throwable $exception) {
                throw new RuntimeException(
                    'FigureData de preview no es JSON válido.',
                    0,
                    $exception
                );
            }

            if (
                ! is_array($qaFigureData) ||
                ! is_array(
                    $qaFigureData['palettes'] ?? null
                ) ||
                ! is_array(
                    $qaFigureData['setTypes'] ?? null
                )
            ) {
                throw new RuntimeException(
                    'FigureData de preview no tiene palettes/setTypes válidos.'
                );
            }

            $sourceFigure =
                $preparedRoot .
                DIRECTORY_SEPARATOR .
                'figure';

            if (! is_dir($sourceFigure)) {
                throw new RuntimeException(
                    'El plan no generó assets figure.'
                );
            }

            $targetFigure =
                $avatarRoot .
                DIRECTORY_SEPARATOR .
                'figure';

            $this->copyDirectory(
                $sourceFigure,
                $targetFigure
            );

            $pieces =
                is_array(
                    $plan['pieces'] ?? null
                )
                    ? $plan['pieces']
                    : [];

            if ($pieces === []) {
                throw new RuntimeException(
                    'El plan de preview no generó piezas.'
                );
            }

            $genderMode =
                $this->qaGenderMode(
                    $plan,
                    $submission
                );

            $availableGenders =
                $genderMode === 'U'
                    ? ['M', 'F']
                    : [$genderMode];

            $defaultGender =
                $availableGenders[0];

            $variants = [];
            $combinedByGender = [];
            $combinedSetIds = [];
            $combinedColorGroups = [];

            foreach ($availableGenders as $gender) {
                $combinedByGender[$gender] =
                    $this->qaBaseFigure(
                        $gender
                    );
            }

            foreach ($pieces as $index => $piece) {
                if (! is_array($piece)) {
                    continue;
                }

                $category =
                    strtolower(
                        trim(
                            (string) (
                                $piece[
                                    'installed_category'
                                ] ??
                                $piece['category'] ??
                                ''
                            )
                        )
                    );

                $setIds =
                    array_values(
                        array_filter(
                            array_map(
                                'strval',
                                is_array(
                                    $piece[
                                        'set_ids'
                                    ] ?? null
                                )
                                    ? $piece[
                                        'set_ids'
                                    ]
                                    : []
                            ),
                            static fn (
                                string $value
                            ): bool =>
                                $value !== ''
                        )
                    );

                if (
                    $category === '' ||
                    $setIds === []
                ) {
                    throw new RuntimeException(
                        'Una pieza del plan no tiene categoría/set para preview.'
                    );
                }

                $pieceLabel =
                    $this->qaCategoryLabel(
                        $category,
                        $index
                    );

                $colorProfile =
                    $this->qaColorProfile(
                        $qaFigureData,
                        $category,
                        $setIds[0],
                        $pieceLabel
                    );

                $defaultColors =
                    is_array(
                        $colorProfile[
                            'default_colors'
                        ] ?? null
                    )
                        ? $colorProfile[
                            'default_colors'
                        ]
                        : [];

                $figures = [];

                foreach ($availableGenders as $gender) {
                    $figures[$gender] =
                        $this->replaceFigureCategory(
                            $this->qaBaseFigure(
                                $gender
                            ),
                            $category,
                            $setIds[0],
                            $defaultColors
                        );

                    $combinedByGender[$gender] =
                        $this->replaceFigureCategory(
                            $combinedByGender[$gender],
                            $category,
                            $setIds[0],
                            $defaultColors
                        );
                }

                $combinedSetIds =
                    array_values(
                        array_unique(
                            array_merge(
                                $combinedSetIds,
                                $setIds
                            )
                        )
                    );

                $combinedColorGroups[] =
                    $colorProfile;

                $variants[] = [
                    'key' =>
                        'piece_' . $index,
                    'label' =>
                        $pieceLabel,
                    'figures' =>
                        $figures,
                    'figure' =>
                        (string) (
                            $figures[
                                $defaultGender
                            ] ?? ''
                        ),
                    'gender' =>
                        $defaultGender,
                    'category' =>
                        $category,
                    'set_ids' =>
                        $setIds,
                    'color_groups' => [
                        $colorProfile,
                    ],
                ];
            }

            if ($variants === []) {
                throw new RuntimeException(
                    'No se pudieron generar variantes de avatar para preview.'
                );
            }

            if (count($variants) > 1) {
                $variants[] = [
                    'key' =>
                        'set_all',
                    'label' =>
                        'Set completo',
                    'figures' =>
                        $combinedByGender,
                    'figure' =>
                        (string) (
                            $combinedByGender[
                                $defaultGender
                            ] ?? ''
                        ),
                    'gender' =>
                        $defaultGender,
                    'category' =>
                        'set',
                    'set_ids' =>
                        $combinedSetIds,
                    'color_groups' =>
                        $combinedColorGroups,
                ];
            }

            $defaultVariant =
                count($variants) > 1
                    ? 'set_all'
                    : (string) $variants[0]['key'];

            $default = null;

            foreach ($variants as $variant) {
                if (
                    ($variant['key'] ?? null) ===
                    $defaultVariant
                ) {
                    $default = $variant;
                    break;
                }
            }

            $default ??= $variants[0];

            return [
                'root_relative' =>
                    $rootRelative .
                    '/avatar',
                'figure_data_relative' =>
                    $rootRelative .
                    '/avatar/gamedata/FigureData.json',
                'figure_map_relative' =>
                    $rootRelative .
                    '/avatar/gamedata/FigureMap.json',
                'figure' =>
                    (string) (
                        $default['figure'] ?? ''
                    ),
                'gender' =>
                    $defaultGender,
                'available_genders' =>
                    $availableGenders,
                'set_ids' =>
                    array_values(
                        array_map(
                            'strval',
                            is_array(
                                $plan[
                                    'set_ids'
                                ] ?? null
                            )
                                ? $plan[
                                    'set_ids'
                                ]
                                : []
                        )
                    ),
                'figure_library_map' =>
                    is_array(
                        $plan[
                            'figure_library_map'
                        ] ?? null
                    )
                        ? $plan[
                            'figure_library_map'
                        ]
                        : [],
                'preview_only' =>
                    true,
                'base_mode' =>
                    'qa_neutral_no_outfit',
                'variants' =>
                    $variants,
                'default_variant' =>
                    $defaultVariant,
                'supports_direction' =>
                    true,
                'supports_motion' =>
                    true,
                'supports_gesture' =>
                    true,
                'supports_action' =>
                    true,
                'supports_frame_animation' =>
                    true,
                'supports_color_selection' =>
                    true,
            ];
        } finally {
            $this->deleteTree(
                $preparedRoot
            );
        }
    }

    private function qaGenderMode(
        array $plan,
        ClothingSubmission $submission
    ): string {
        $seen = [];

        foreach (
            is_array(
                $plan[
                    'figure_library_map'
                ] ?? null
            )
                ? $plan[
                    'figure_library_map'
                ]
                : []
            as $source => $target
        ) {
            foreach ([
                (string) $source,
                (string) $target,
            ] as $library) {
                if (
                    preg_match(
                        '/(?:^|_)F(?:_|$)/i',
                        $library
                    ) === 1
                ) {
                    $seen['F'] = true;
                }

                if (
                    preg_match(
                        '/(?:^|_)M(?:_|$)/i',
                        $library
                    ) === 1
                ) {
                    $seen['M'] = true;
                }

                if (
                    preg_match(
                        '/(?:^|_)U(?:_|$)/i',
                        $library
                    ) === 1
                ) {
                    $seen['U'] = true;
                }
            }
        }

        if (
            isset($seen['F']) &&
            ! isset($seen['M'])
        ) {
            return 'F';
        }

        if (
            isset($seen['M']) &&
            ! isset($seen['F'])
        ) {
            return 'M';
        }

        if (
            isset($seen['U']) &&
            ! isset($seen['F']) &&
            ! isset($seen['M'])
        ) {
            return 'U';
        }

        $creator =
            $submission->creator_user_id
                ? User::query()->find(
                    (int)
                    $submission->creator_user_id
                )
                : null;

        $creatorGender =
            strtoupper(
                trim(
                    (string) (
                        $creator?->gender ?? ''
                    )
                )
            );

        if (
            $creatorGender === 'F' ||
            $creatorGender === 'M'
        ) {
            return $creatorGender;
        }

        return 'M';
    }

    private function qaBaseFigure(
        string $gender
    ): string {
        /*
         * Cara neutral real para QA.
         * Sin pelo ni outfit base: la ropa visible es solo la enviada.
         * Mantiene una cabeza real para que funcionen los gestos faciales.
         */
        return strtoupper($gender) === 'F'
            ? 'hd-600-1'
            : 'hd-180-1';
    }
    private function qaCategoryLabel(
        string $category,
        int $index
    ): string {
        $labels = [
            'hd' => 'Cara',
            'hr' => 'Pelo',
            'bn' => 'Flequillo',
            'ha' => 'Sombrero',
            'he' => 'Accesorio de cabeza',
            'er' => 'Pendientes',
            'mu' => 'Maquillaje',
            'fa' => 'Accesorio facial',
            'be' => 'Barba',
            'ea' => 'Gafas',
            'ch' => 'Camiseta',
            'cp' => 'Chaqueta',
            'cc' => 'Torso',
            'ca' => 'Accesorio de pecho',
            'nk' => 'Collar',
            'gl' => 'Guantes',
            'wr' => 'Muñequera',
            'ba' => 'Bolso',
            'bp' => 'Mochila',
            'lg' => 'Pantalón',
            'sh' => 'Zapatos',
            'wa' => 'Cintura',
            'pe' => 'Mascota',
            'ce' => 'Capa',
            'wi' => 'Alas',
            'tl' => 'Cola',
        ];

        return (
            $labels[$category] ??
            ('Prenda ' . ($index + 1))
        );
    }

    private function qaColorProfile(
        array $figureData,
        string $category,
        string $setId,
        string $label
    ): array {
        $setType = null;

        foreach (
            $figureData['setTypes']
            as $candidate
        ) {
            if (! is_array($candidate)) {
                continue;
            }

            if (
                strcasecmp(
                    trim(
                        (string) (
                            $candidate['type'] ??
                            ''
                        )
                    ),
                    $category
                ) === 0
            ) {
                $setType = $candidate;
                break;
            }
        }

        if ($setType === null) {
            throw new RuntimeException(
                'FigureData QA no contiene la categoría ' .
                $category .
                '.'
            );
        }

        $set = null;

        foreach (
            is_array(
                $setType['sets'] ?? null
            )
                ? $setType['sets']
                : []
            as $candidate
        ) {
            if (
                is_array($candidate) &&
                (string) (
                    $candidate['id'] ??
                    ''
                ) === (string) $setId
            ) {
                $set = $candidate;
                break;
            }
        }

        if ($set === null) {
            throw new RuntimeException(
                'FigureData QA no contiene el set ' .
                $category .
                '-' .
                $setId .
                '.'
            );
        }

        $colorable =
            $this->qaBool(
                $set['colorable'] ??
                false
            );

        $maxColorIndex = 0;

        foreach (
            is_array(
                $set['parts'] ?? null
            )
                ? $set['parts']
                : []
            as $part
        ) {
            if (! is_array($part)) {
                continue;
            }

            $maxColorIndex =
                max(
                    $maxColorIndex,
                    (int) (
                        $part['colorindex'] ??
                        0
                    )
                );
        }

        $paletteId =
            (int) (
                $setType['paletteId'] ??
                0
            );

        $base = [
            'key' =>
                $category .
                ':' .
                $setId,
            'label' =>
                $label,
            'category' =>
                $category,
            'set_id' =>
                (string) $setId,
            'palette_id' =>
                $paletteId,
            'colorable' =>
                $colorable &&
                $maxColorIndex > 0,
            'slots' => [],
            'default_colors' => [],
        ];

        if (
            ! $colorable ||
            $maxColorIndex <= 0
        ) {
            return $base;
        }

        $palette = null;

        foreach (
            $figureData['palettes']
            as $candidate
        ) {
            if (
                is_array($candidate) &&
                (int) (
                    $candidate['id'] ??
                    -1
                ) === $paletteId
            ) {
                $palette = $candidate;
                break;
            }
        }

        if ($palette === null) {
            throw new RuntimeException(
                'FigureData QA no contiene la paleta ' .
                $paletteId .
                ' para ' .
                $category .
                '.'
            );
        }

        $colors = [];

        foreach (
            is_array(
                $palette['colors'] ?? null
            )
                ? $palette['colors']
                : []
            as $color
        ) {
            if (! is_array($color)) {
                continue;
            }

            if (
                ! $this->qaBool(
                    $color['selectable'] ??
                    true,
                    true
                )
            ) {
                continue;
            }

            $id =
                (int) (
                    $color['id'] ??
                    -1
                );

            if ($id < 0) {
                continue;
            }

            $hex =
                strtoupper(
                    trim(
                        (string) (
                            $color['hexCode'] ??
                            ''
                        )
                    )
                );

            $hex =
                ltrim(
                    $hex,
                    '#'
                );

            if (
                strlen($hex) === 3 &&
                ctype_xdigit($hex)
            ) {
                $hex =
                    $hex[0] . $hex[0] .
                    $hex[1] . $hex[1] .
                    $hex[2] . $hex[2];
            }

            if (
                strlen($hex) !== 6 ||
                ! ctype_xdigit($hex)
            ) {
                continue;
            }

            $colors[] = [
                'id' => $id,
                'hex' =>
                    '#' .
                    $hex,
                'club' =>
                    (int) (
                        $color['club'] ??
                        0
                    ),
            ];
        }

        if ($colors === []) {
            throw new RuntimeException(
                'La paleta ' .
                $paletteId .
                ' no tiene colores seleccionables para QA.'
            );
        }

        $defaultColor =
            (int) $colors[0]['id'];

        $slots = [];

        for (
            $slot = 1;
            $slot <= $maxColorIndex;
            $slot++
        ) {
            $slots[] = [
                'index' => $slot,
                'colors' => $colors,
            ];
        }

        $base['slots'] =
            $slots;

        $base['default_colors'] =
            array_fill(
                0,
                $maxColorIndex,
                $defaultColor
            );

        return $base;
    }

    private function qaBool(
        mixed $value,
        bool $default = false
    ): bool {
        if (is_bool($value)) {
            return $value;
        }

        if (
            is_int($value) ||
            is_float($value)
        ) {
            return (int) $value !== 0;
        }

        $normalized =
            strtolower(
                trim(
                    (string) $value
                )
            );

        if (
            in_array(
                $normalized,
                [
                    '1',
                    'true',
                    'yes',
                    'y',
                ],
                true
            )
        ) {
            return true;
        }

        if (
            in_array(
                $normalized,
                [
                    '0',
                    'false',
                    'no',
                    'n',
                    '',
                ],
                true
            )
        ) {
            return false;
        }

        return $default;
    }

    private function replaceFigureCategory(
        string $figure,
        string $category,
        string $setId,
        array $colorIds = []
    ): string {
        $requestedColors =
            array_values(
                array_filter(
                    array_map(
                        static fn (
                            mixed $value
                        ): string =>
                            trim(
                                (string) $value
                            ),
                        $colorIds
                    ),
                    static fn (
                        string $value
                    ): bool =>
                        $value !== ''
                )
            );

        $segments =
            array_values(
                array_filter(
                    explode(
                        '.',
                        $figure
                    ),
                    static fn (
                        string $segment
                    ): bool =>
                        trim($segment) !== ''
                )
            );

        $replaced = false;

        foreach (
            $segments
            as $index => $segment
        ) {
            $parts =
                explode(
                    '-',
                    $segment
                );

            if (
                strtolower(
                    trim(
                        (string) (
                            $parts[0]
                            ?? ''
                        )
                    )
                ) !== $category
            ) {
                continue;
            }

            $colors =
                $requestedColors;

            if ($colors === []) {
                $colors =
                    array_values(
                        array_filter(
                            array_slice(
                                $parts,
                                2
                            ),
                            static fn (
                                string $value
                            ): bool =>
                                trim($value) !== ''
                        )
                    );
            }

            if ($colors === []) {
                $colors = ['1'];
            }

            $segments[$index] =
                $category .
                '-' .
                $setId .
                '-' .
                implode(
                    '-',
                    $colors
                );

            $replaced = true;

            break;
        }

        if (! $replaced) {
            $colors =
                $requestedColors === []
                    ? ['1']
                    : $requestedColors;

            $segments[] =
                $category .
                '-' .
                $setId .
                '-' .
                implode(
                    '-',
                    $colors
                );
        }

        return implode(
            '.',
            $segments
        );
    }

    private function copyDirectory(
        string $source,
        string $target
    ): void {
        $sourceReal =
            realpath(
                $source
            );

        if (
            $sourceReal === false ||
            ! is_dir($sourceReal)
        ) {
            throw new RuntimeException(
                'No existe directorio fuente para preview: ' .
                $source
            );
        }

        $this->ensureDirectory(
            $target
        );

        $iterator =
            new \RecursiveIteratorIterator(
                new \RecursiveDirectoryIterator(
                    $sourceReal,
                    \FilesystemIterator::SKIP_DOTS
                ),
                \RecursiveIteratorIterator::SELF_FIRST
            );

        foreach ($iterator as $entry) {
            $relative =
                substr(
                    $entry->getPathname(),
                    strlen($sourceReal) + 1
                );

            $destination =
                $target .
                DIRECTORY_SEPARATOR .
                $relative;

            if ($entry->isDir()) {
                $this->ensureDirectory(
                    $destination
                );

                continue;
            }

            $this->ensureDirectory(
                dirname($destination)
            );

            if (
                ! copy(
                    $entry->getPathname(),
                    $destination
                )
            ) {
                throw new RuntimeException(
                    'No se pudo copiar asset figure de preview: ' .
                    $relative
                );
            }
        }
    }

    private function manifestFilesExist(
        array $manifest
    ): bool {
        $paths = [];

        foreach (
            is_array(
                $manifest['figures'] ?? null
            )
                ? $manifest['figures']
                : []
            as $figure
        ) {
            if (
                is_array($figure) &&
                is_string(
                    $figure[
                        'png_relative'
                    ] ?? null
                )
            ) {
                $paths[] =
                    $figure[
                        'png_relative'
                    ];
            }
        }

        $furniture =
            is_array(
                $manifest[
                    'furniture'
                ] ?? null
            )
                ? $manifest[
                    'furniture'
                ]
                : [];

        foreach ([
            'atlas_relative',
            'icon_relative',
        ] as $key) {
            if (
                is_string(
                    $furniture[$key] ?? null
                )
            ) {
                $paths[] =
                    $furniture[$key];
            }
        }

        $avatar =
            is_array(
                $manifest[
                    'avatar'
                ] ?? null
            )
                ? $manifest[
                    'avatar'
                ]
                : [];

        foreach ([
            'figure_data_relative',
            'figure_map_relative',
        ] as $key) {
            if (
                is_string(
                    $avatar[$key] ?? null
                )
            ) {
                $paths[] =
                    $avatar[$key];
            }
        }

        $avatarRoot =
            trim(
                (string) (
                    $avatar[
                        'root_relative'
                    ] ?? ''
                )
            );

        foreach (
            is_array(
                $avatar[
                    'figure_library_map'
                ] ?? null
            )
                ? $avatar[
                    'figure_library_map'
                ]
                : []
            as $finalLibrary
        ) {
            $finalLibrary =
                trim(
                    (string)
                    $finalLibrary
                );

            if (
                $avatarRoot !== '' &&
                $finalLibrary !== ''
            ) {
                $paths[] =
                    $avatarRoot .
                    '/figure/' .
                    $finalLibrary .
                    '.nitro';
            }
        }

        if ($paths === []) {
            return false;
        }

        foreach ($paths as $relative) {
            $relative =
                str_replace(
                    '\\',
                    '/',
                    (string) $relative
                );

            if (
                ! str_starts_with(
                    $relative,
                    'clothing_importer/previews/'
                ) ||
                str_contains(
                    $relative,
                    '../'
                ) ||
                ! is_file(
                    storage_path(
                        'app/' .
                        ltrim(
                            $relative,
                            '/'
                        )
                    )
                )
            ) {
                return false;
            }
        }

        return true;
    }

    private function hashFiles(
        array $paths
    ): array {
        $result = [];

        foreach ($paths as $path) {
            if (! is_file($path)) {
                throw new RuntimeException(
                    'Falta archivo vivo protegido: ' .
                    $path
                );
            }

            $result[$path] =
                hash_file(
                    'sha256',
                    $path
                );
        }

        return $result;
    }

    private function ensureDirectory(
        string $directory
    ): void {
        if (
            is_dir($directory)
        ) {
            return;
        }

        if (
            ! mkdir(
                $directory,
                0775,
                true
            ) &&
            ! is_dir(
                $directory
            )
        ) {
            throw new RuntimeException(
                'No se pudo crear directorio: ' .
                $directory
            );
        }
    }

    private function deleteTree(
        string $path
    ): void {
        if (! is_dir($path)) {
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
            if ($entry->isDir()) {
                @rmdir(
                    $entry->getPathname()
                );
            } else {
                @unlink(
                    $entry->getPathname()
                );
            }
        }

        @rmdir(
            $path
        );
    }
}
