<?php

namespace App\Services\Clothing;

class ClothingPackagePieceResolver
{
    public function resolve(
        array $manifest,
        array $identity
    ): array {
        $errors = [];
        $warnings = [];

        $categories = is_array(
            $manifest['categories'] ?? null
        )
            ? $manifest['categories']
            : [];

        $sets = is_array(
            $manifest['figuredata']['sets'] ?? null
        )
            ? $manifest['figuredata']['sets']
            : [];

        $libraries = is_array(
            $manifest['figuremap']['libraries'] ?? null
        )
            ? $manifest['figuremap']['libraries']
            : [];

        $furniCandidates = is_array(
            $manifest[
                'redeemable_furni_candidates'
            ] ?? null
        )
            ? $manifest[
                'redeemable_furni_candidates'
            ]
            : [];

        if ($categories === []) {
            return [
                'valid' => false,
                'errors' => [
                    'No hay prendas declaradas en categories.txt.',
                ],
                'warnings' => [],
                'package_kind' => 'single',
                'piece_count' => 0,
                'pieces' => [],
                'combined_source_set_keys' => [],
                'declared_set_ids' => [],
                'combined_set_ids' => [],
                'redeemable_furni_count' =>
                    count($furniCandidates),
            ];
        }

        $pieces = [];
        $usedSourceKeys = [];

        foreach (
            $categories
            as $position => $categoryRow
        ) {
            if (! is_array($categoryRow)) {
                continue;
            }

            $code = trim(
                (string) (
                    $categoryRow['code'] ?? ''
                )
            );

            /*
             * Esta es la categoría LÓGICA del Armario. Puede ser bp,
             * pe, etc. y NO tiene por qué coincidir con los part.type
             * técnicos del SWF/FigureMap (ca, ch, ls...).
             */
            $category = strtolower(
                trim(
                    (string) (
                        $categoryRow['category'] ?? ''
                    )
                )
            );

            if ($code === '' || $category === '') {
                $errors[] =
                    'Entrada inválida en categories.txt.';
                continue;
            }

            $matchingLibraries =
                $this->librariesForCode(
                    $libraries,
                    $code
                );

            if ($matchingLibraries === []) {
                $errors[] =
                    'No se encontró ninguna library de FigureMap para la prenda "' .
                    $code .
                    '". No se adivina por categoría.';
                continue;
            }

            $matchedSets = [];
            $libraryLinks = [];
            $piecePartIds = [];

            foreach (
                $matchingLibraries
                as $libraryCode => $library
            ) {
                $libraryParts = is_array(
                    $library['parts'] ?? null
                )
                    ? $library['parts']
                    : [];

                $libraryPairs =
                    $this->partPairs(
                        $libraryParts
                    );

                if ($libraryPairs === []) {
                    $errors[] =
                        'La library "' .
                        $libraryCode .
                        '" no declara Part IDs.';
                    continue;
                }

                $candidates = [];

                foreach ($sets as $set) {
                    if (! is_array($set)) {
                        continue;
                    }

                    $setPairs =
                        $this->partPairs(
                            is_array(
                                $set['parts'] ?? null
                            )
                                ? $set['parts']
                                : []
                        );

                    if ($setPairs === $libraryPairs) {
                        $candidates[] = $set;
                    }
                }

                if (count($candidates) !== 1) {
                    $errors[] =
                        'La library "' .
                        $libraryCode .
                        '" de "' .
                        $code .
                        '" debe corresponder exactamente a 1 set de FigureData; coincidencias=' .
                        count($candidates) .
                        '.';
                    continue;
                }

                $set = $candidates[0];

                $sourceKey = trim(
                    (string) (
                        $set['source_key'] ?? ''
                    )
                );

                if ($sourceKey === '') {
                    $errors[] =
                        'El set enlazado a "' .
                        $libraryCode .
                        '" no tiene source_key interno.';
                    continue;
                }

                if (
                    isset($usedSourceKeys[$sourceKey]) &&
                    $usedSourceKeys[$sourceKey] !== $code
                ) {
                    $errors[] =
                        'El set fuente "' .
                        $sourceKey .
                        '" quedaría asociado a dos prendas distintas (' .
                        $usedSourceKeys[$sourceKey] .
                        ' y ' .
                        $code .
                        ').';
                    continue;
                }

                $usedSourceKeys[$sourceKey] =
                    $code;

                $matchedSets[$sourceKey] =
                    $set;

                foreach ($libraryParts as $part) {
                    if (! is_array($part)) {
                        continue;
                    }

                    $partId = trim(
                        (string) (
                            $part['id'] ?? ''
                        )
                    );

                    if ($partId !== '') {
                        $piecePartIds[] =
                            $partId;
                    }
                }

                $libraryLinks[] = [
                    'library_code' =>
                        (string) $libraryCode,
                    'part_pairs' =>
                        $libraryPairs,
                    'part_ids' =>
                        $this->partIdsFromPairs(
                            $libraryPairs
                        ),
                    'source_set_key' =>
                        $sourceKey,
                    'declared_set_id' =>
                        trim(
                            (string) (
                                $set['declared_id'] ??
                                $set['id'] ??
                                ''
                            )
                        ),
                    'gender' =>
                        trim(
                            (string) (
                                $set['gender'] ?? ''
                            )
                        ),
                ];
            }

            if ($matchedSets === []) {
                continue;
            }

            $sourceSetKeys =
                array_keys($matchedSets);

            $declaredSetIds = [];
            $genders = [];

            foreach ($matchedSets as $set) {
                $declaredSetIds[] = trim(
                    (string) (
                        $set['declared_id'] ??
                        $set['id'] ??
                        ''
                    )
                );

                $gender = trim(
                    (string) (
                        $set['gender'] ?? ''
                    )
                );

                if ($gender !== '') {
                    $genders[] = $gender;
                }
            }

            $piecePartIds = array_values(
                array_unique($piecePartIds)
            );

            sort($piecePartIds);

            $genders = array_values(
                array_unique($genders)
            );

            $pieces[] = [
                'position' => $position + 1,
                'code' => $code,
                'category' => $category,
                'source_set_keys' =>
                    $sourceSetKeys,
                'declared_set_ids' =>
                    $declaredSetIds,
                /*
                 * Los IDs finales Biribiri se asignan SOLO al aprobar.
                 */
                'set_ids' => [],
                'library_codes' =>
                    array_keys(
                        $matchingLibraries
                    ),
                'libraries' =>
                    $libraryLinks,
                /*
                 * part_ids se conserva por compatibilidad interna, pero
                 * estos son SIEMPRE IDs DE ORIGEN del RAR. El allocator
                 * de Biribiri añadirá biribiri_part_ids después.
                 */
                'part_ids' =>
                    $piecePartIds,
                'source_part_ids' =>
                    $piecePartIds,
                'gender_variants' =>
                    $genders,
            ];
        }

        $combinedSourceKeys = [];
        $declaredCombinedIds = [];

        foreach ($pieces as $piece) {
            foreach (
                $piece['source_set_keys']
                as $sourceKey
            ) {
                $combinedSourceKeys[] =
                    $sourceKey;
            }

            foreach (
                $piece['declared_set_ids']
                as $declaredId
            ) {
                $declaredCombinedIds[] =
                    $declaredId;
            }
        }

        $combinedSourceKeys = array_values(
            array_unique(
                $combinedSourceKeys
            )
        );

        $identitySourceKeys =
            array_values(
                array_unique(
                    array_map(
                        'strval',
                        is_array(
                            $identity[
                                'source_set_keys'
                            ] ?? null
                        )
                            ? $identity[
                                'source_set_keys'
                            ]
                            : []
                    )
                )
            );

        $checkCombined =
            $combinedSourceKeys;

        $checkIdentity =
            $identitySourceKeys;

        sort($checkCombined);
        sort($checkIdentity);

        if (
            $checkCombined !==
            $checkIdentity
        ) {
            $errors[] =
                'No todos los sets fuente del paquete han quedado asociados inequívocamente a una prenda de categories.txt.';
        }

        $furniCount =
            count($furniCandidates);

        if ($furniCount === 0) {
            $errors[] =
                'El paquete no contiene un maniquí/furni canjeable.';
        } elseif ($furniCount > 1) {
            $errors[] =
                'El RAR contiene ' .
                $furniCount .
                ' maniquíes/furnis. Parece un lote de prendas independientes: en Biribiri sube cada prenda en su propio RAR. Un set real puede contener varias prendas, pero debe compartir un único furni canjeable.';
        }

        $pieceCount = count($pieces);

        $packageKind =
            $furniCount > 1
                ? 'batch'
                : (
                    $pieceCount > 1
                        ? 'set'
                        : 'single'
                );

        return [
            'valid' => $errors === [],
            'errors' => array_values(
                array_unique($errors)
            ),
            'warnings' => array_values(
                array_unique($warnings)
            ),
            'package_kind' =>
                $packageKind,
            'piece_count' =>
                $pieceCount,
            'pieces' =>
                $pieces,
            'combined_source_set_keys' =>
                $combinedSourceKeys,
            'declared_set_ids' =>
                $declaredCombinedIds,
            'combined_set_ids' => [],
            'redeemable_furni_count' =>
                $furniCount,
        ];
    }

    private function librariesForCode(
        array $libraries,
        string $code
    ): array {
        $result = [];

        $needle = $this->normalize(
            $code
        );

        foreach ($libraries as $name => $library) {
            $normalizedName =
                $this->normalize(
                    (string) $name
                );

            if (
                $needle !== '' &&
                str_contains(
                    $normalizedName,
                    $needle
                )
            ) {
                $result[(string) $name] =
                    is_array($library)
                        ? $library
                        : [];
            }
        }

        return $result;
    }

    private function partPairs(
        array $parts
    ): array {
        $pairs = [];

        foreach ($parts as $part) {
            if (! is_array($part)) {
                continue;
            }

            $type = strtolower(
                trim(
                    (string) (
                        $part['type'] ?? ''
                    )
                )
            );

            $id = trim(
                (string) (
                    $part['id'] ?? ''
                )
            );

            if ($type === '' || $id === '') {
                continue;
            }

            $pairs[] =
                $type . ':' . $id;
        }

        $pairs = array_values(
            array_unique($pairs)
        );

        sort($pairs);

        return $pairs;
    }

    private function partIdsFromPairs(
        array $pairs
    ): array {
        $ids = [];

        foreach ($pairs as $pair) {
            $position = strrpos(
                (string) $pair,
                ':'
            );

            if ($position === false) {
                continue;
            }

            $id = substr(
                (string) $pair,
                $position + 1
            );

            if ($id !== '') {
                $ids[] = $id;
            }
        }

        $ids = array_values(
            array_unique($ids)
        );

        sort($ids);

        return $ids;
    }

    private function normalize(
        string $value
    ): string {
        return strtolower(
            preg_replace(
                '/[^a-z0-9]+/i',
                '',
                $value
            ) ?? ''
        );
    }
}
