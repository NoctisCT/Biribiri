<?php

namespace App\Services\Clothing;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ClothingCollisionService
{
    public function check(
        array $identity,
        ?int $submissionId = null
    ): array {
        $errors = [];
        $warnings = [];

        if (! ($identity['valid'] ?? false)) {
            return [
                'valid' => false,
                'errors' => [
                    'No se pueden comprobar colisiones de una identidad técnica inválida.',
                ],
                'warnings' => [],
            ];
        }

        if (
            ! Schema::hasTable(
                'catalog_clothing'
            )
        ) {
            $errors[] =
                'No existe catalog_clothing.';
        }

        if (
            ! Schema::hasTable(
                'items_base'
            )
        ) {
            $errors[] =
                'No existe items_base.';
        }

        if ($errors !== []) {
            return [
                'valid' => false,
                'errors' => $errors,
                'warnings' => $warnings,
            ];
        }

        $redeemableCode = trim(
            (string) (
                $identity[
                    'redeemable_furni_code'
                ] ?? ''
            )
        );

        if ($redeemableCode === '') {
            $errors[] =
                'No hay código de furni canjeable.';
        } else {
            $lower = mb_strtolower(
                $redeemableCode
            );

            $itemBaseCollision =
                DB::table('items_base')
                    ->whereRaw(
                        'LOWER(item_name) = ?',
                        [$lower]
                    )
                    ->first([
                        'id',
                        'item_name',
                        'public_name',
                        'interaction_type',
                        'allow_trade',
                    ]);

            if ($itemBaseCollision !== null) {
                $errors[] =
                    'Ya existe items_base para "' .
                    $redeemableCode .
                    '" (id ' .
                    $itemBaseCollision->id .
                    ').';
            }

            $clothingCollision =
                DB::table(
                    'catalog_clothing'
                )
                    ->whereRaw(
                        'LOWER(name) = ?',
                        [$lower]
                    )
                    ->first([
                        'id',
                        'name',
                        'setid',
                    ]);

            if ($clothingCollision !== null) {
                $errors[] =
                    'Ya existe catalog_clothing para "' .
                    $redeemableCode .
                    '" (id ' .
                    $clothingCollision->id .
                    ').';
            }
        }

        $declaredSetIds = array_values(
            array_filter(
                array_map(
                    'strval',
                    is_array(
                        $identity[
                            'declared_figure_set_ids'
                        ] ?? null
                    )
                        ? $identity[
                            'declared_figure_set_ids'
                        ]
                        : (
                            is_array(
                                $identity[
                                    'figure_set_ids'
                                ] ?? null
                            )
                                ? $identity[
                                    'figure_set_ids'
                                ]
                                : []
                        )
                ),
                static fn (
                    string $value
                ): bool =>
                    $value !== ''
            )
        );

        if ($declaredSetIds !== []) {
            $warnings[] =
                'Los figure set IDs del builder son solo referencias fuente; las colisiones de esos IDs no bloquean porque Biribiri asigna IDs finales libres al aprobar.';
        }

        if (
            Schema::hasTable(
                'clothing_submissions'
            )
        ) {
            $fingerprint = trim(
                (string) (
                    $identity[
                        'source_fingerprint'
                    ] ?? ''
                )
            );

            if (
                $fingerprint !== '' &&
                Schema::hasColumn(
                    'clothing_submissions',
                    'source_fingerprint'
                )
            ) {
                $query = DB::table(
                    'clothing_submissions'
                )
                    ->where(
                        'source_fingerprint',
                        $fingerprint
                    )
                    ->whereNotIn(
                        'status',
                        ['rejected']
                    );

                if ($submissionId !== null) {
                    $query->where(
                        'id',
                        '!=',
                        $submissionId
                    );
                }

                $duplicate =
                    $query->first([
                        'id',
                        'status',
                        'clothing_name',
                    ]);

                if ($duplicate !== null) {
                    $errors[] =
                        'El mismo paquete ya existe en la solicitud #' .
                        $duplicate->id .
                        ' (' .
                        $duplicate->status .
                        ').';
                }
            }

            if (
                $redeemableCode !== '' &&
                Schema::hasColumn(
                    'clothing_submissions',
                    'redeemable_furni_code'
                )
            ) {
                $query = DB::table(
                    'clothing_submissions'
                )
                    ->whereRaw(
                        'LOWER(redeemable_furni_code) = ?',
                        [
                            mb_strtolower(
                                $redeemableCode
                            ),
                        ]
                    )
                    ->whereNotIn(
                        'status',
                        ['rejected']
                    );

                if ($submissionId !== null) {
                    $query->where(
                        'id',
                        '!=',
                        $submissionId
                    );
                }

                $duplicateCode =
                    $query->first([
                        'id',
                        'status',
                    ]);

                if ($duplicateCode !== null) {
                    $errors[] =
                        'Otra solicitud ya reserva el furni técnico "' .
                        $redeemableCode .
                        '" (#' .
                        $duplicateCode->id .
                        ').';
                }
            }
        }

        return [
            'valid' => $errors === [],
            'errors' => array_values(
                array_unique($errors)
            ),
            'warnings' => array_values(
                array_unique($warnings)
            ),
        ];
    }
}