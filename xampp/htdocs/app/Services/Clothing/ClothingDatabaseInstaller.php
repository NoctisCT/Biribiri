<?php

namespace App\Services\Clothing;

use App\Models\ClothingProduct;
use App\Models\ClothingSubmission;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use RuntimeException;

class ClothingDatabaseInstaller
{
    public function __construct(
        private readonly ClothingStaffCatalogService $staffCatalog
    ) {
    }

    public function reserveIds(): array
    {
        return [
            'public_base_item_id' =>
                $this->nextFreeId(
                    'items_base',
                    (int) config(
                        'clothing_marketplace.installer.id_ranges.items_base_start',
                        2001000000
                    )
                ),

            'designer_base_item_id' =>
                $this->nextFreeId(
                    'items_base',
                    (int) config(
                        'clothing_marketplace.installer.id_ranges.items_base_start',
                        2001000000
                    ),
                    1
                ),

            'catalog_item_id' =>
                $this->nextFreeId(
                    'catalog_items',
                    (int) config(
                        'clothing_marketplace.installer.id_ranges.catalog_items_start',
                        2001000000
                    )
                ),
        ];
    }

    public function install(
        ClothingSubmission $submission,
        array $plan,
        array $ids
    ): array {
        $this->assertTables();
        $this->staffCatalog->assertReady();

        $publicId =
            (int) $ids[
                'public_base_item_id'
            ];

        $designerId =
            (int) $ids[
                'designer_base_item_id'
            ];

        $catalogItemId =
            (int) $ids[
                'catalog_item_id'
            ];

        foreach ([
            [
                'table' => 'items_base',
                'id' => $publicId,
            ],
            [
                'table' => 'items_base',
                'id' => $designerId,
            ],
            [
                'table' => 'catalog_items',
                'id' => $catalogItemId,
            ],
        ] as $check) {
            if (
                DB::table($check['table'])
                    ->where(
                        'id',
                        $check['id']
                    )
                    ->exists()
            ) {
                throw new RuntimeException(
                    'ID reservado ocupado durante la instalación: ' .
                    $check['table'] .
                    '#' .
                    $check['id']
                );
            }
        }

        $code = trim(
            (string) (
                $plan[
                    'redeemable_code'
                ] ?? ''
            )
        );

        if ($code === '') {
            throw new RuntimeException(
                'Falta redeemable_code.'
            );
        }

        if (
            DB::table('catalog_clothing')
                ->whereRaw(
                    'LOWER(name) = ?',
                    [
                        mb_strtolower(
                            $code
                        ),
                    ]
                )
                ->exists()
        ) {
            throw new RuntimeException(
                'catalog_clothing ya contiene ' .
                $code
            );
        }

        $templateBaseId = (int) config(
            'clothing_marketplace.installer.redeemable_template_base_item_id',
            2000000002
        );

        $template = DB::table(
            'items_base'
        )
            ->where('id', $templateBaseId)
            ->first();

        if ($template === null) {
            throw new RuntimeException(
                'No existe base template Amigo Conejo #' .
                $templateBaseId .
                '.'
            );
        }

        if (
            (string) $template->interaction_type !==
            'clothing'
        ) {
            throw new RuntimeException(
                'El base template no es clothing.'
            );
        }

        $setIds = array_values(
            array_unique(
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
            )
        );

        if ($setIds === []) {
            throw new RuntimeException(
                'No hay set IDs para catalog_clothing.'
            );
        }

        $publicRow =
            (array) $template;

        $publicRow['id'] =
            $publicId;

        $publicRow['sprite_id'] =
            $publicId;

        $publicRow['item_name'] =
            $code;

        $publicRow['public_name'] =
            (string)
            $submission->clothing_name;

        $publicRow['allow_trade'] = 1;
        $publicRow['allow_gift'] = 1;
        $publicRow[
            'allow_marketplace_sell'
        ] = 0;
        $publicRow[
            'interaction_type'
        ] = 'clothing';

        $publicRow[
            'customparams'
        ] =
            implode(
                ',',
                $setIds
            );

        DB::table('items_base')
            ->insert($publicRow);

        /*
         * Variante exclusiva del diseñador:
         * - base item distinto;
         * - MISMO item_name para que RedeemClothingEvent resuelva
         *   el mismo catalog_clothing;
         * - sprite_id apunta al furni público, así reutiliza
         *   FurnitureData/Nitro sin duplicar classname;
         * - no trade / no gift.
         */
        $designerRow =
            $publicRow;

        $designerRow['id'] =
            $designerId;

        $designerRow['sprite_id'] =
            $publicId;

        $designerRow['allow_trade'] = 0;
        $designerRow['allow_gift'] = 0;
        $designerRow[
            'allow_marketplace_sell'
        ] = 0;

        DB::table('items_base')
            ->insert($designerRow);

        $clothingCatalogId = null;

        try {
            $clothingCatalogId =
                DB::table(
                    'catalog_clothing'
                )
                    ->insertGetId([
                    'name' => $code,
                    'setid' =>
                        implode(
                            ',',
                            $setIds
                        ),
                ]);

        $templateCatalog = DB::table(
            'catalog_items'
        )
            ->where(
                'item_ids',
                (string) $templateBaseId
            )
            ->orderByDesc('id')
            ->first();

        if ($templateCatalog === null) {
            throw new RuntimeException(
                'No existe catalog_items template de Amigo Conejo.'
            );
        }

        $catalogRow =
            (array) $templateCatalog;

        $catalogRow['id'] =
            $catalogItemId;

        $catalogRow['item_ids'] =
            (string) $publicId;

        $catalogRow['page_id'] =
            $this->staffCatalog->pageIdFor(
                (string)
                $submission
                    ->intended_acquisition_method
            );

        $catalogRow['catalog_name'] =
            (string)
            $submission->clothing_name;

        $catalogRow['cost_credits'] = 0;
        $catalogRow['cost_points'] = 0;
        $catalogRow['points_type'] = 0;
        $catalogRow['amount'] = 1;
        $catalogRow['limited_sells'] = 0;
        $catalogRow['limited_stack'] = 0;
        $catalogRow['badge'] = null;

        /*
         * La plantilla histórica puede contener '' en enums MySQL.
         * Conservamos 0/1 válidos y normalizamos cualquier valor
         * inválido a '0', equivalente al false que leía el emulador.
         */
        foreach ([
            'have_offer',
            'club_only',
        ] as $booleanColumn) {
            $value = (string) (
                $catalogRow[
                    $booleanColumn
                ] ?? ''
            );

            $catalogRow[
                $booleanColumn
            ] = in_array(
                $value,
                [
                    '0',
                    '1',
                ],
                true
            )
                ? $value
                : '0';
        }

        DB::table('catalog_items')
            ->insert($catalogRow);

        $this->installMetadata(
            $submission,
            $plan
        );

        $product = ClothingProduct::query()
            ->create([
                'clothing_submission_id' =>
                    $submission->id,

                'creator_user_id' =>
                    $submission
                        ->creator_user_id,

                'acquisition_method' =>
                    (string)
                    $submission
                        ->intended_acquisition_method,

                'name' =>
                    (string)
                    $submission
                        ->clothing_name,

                'tag' =>
                    $submission->tag,

                'category' =>
                    (int)
                    $submission->piece_count === 1
                        ? $submission
                            ->final_category
                        : null,

                'package_kind' =>
                    (string)
                    $submission
                        ->package_kind,

                'piece_count' =>
                    (int)
                    $submission
                        ->piece_count,

                'piece_manifest' =>
                    $plan[
                        'pieces'
                    ] ?? null,

                'web_visible' => false,
                'web_section' => null,
                'status' => 'draft',
                'currency_type' => 'credits',
                'points_type' => null,
                'unit_price' => 0,
                'stock_mode' => 'unlimited',
                'stock_total' => null,
                'sold_count' => 0,
                'purchase_limit_per_user' =>
                    null,

                'keep_after_window_until_sold' =>
                    true,

                'creator_share_percent' =>
                    50,

                'burn_percent' =>
                    50,

                'redeemable_base_item_id' =>
                    $publicId,

                'public_furni_tradeable' =>
                    true,

                'designer_reward_base_item_id' =>
                    $designerId,

                'designer_reward_nontradeable' =>
                    true,

                'staff_catalog_section' =>
                    $this
                        ->staffCatalog
                        ->sectionFor(
                            (string)
                            $submission
                                ->intended_acquisition_method
                        ),
            ]);

        $submission->forceFill([
            'status' => 'approved',
            'clothing_catalog_id' =>
                $clothingCatalogId,
            'redeemable_base_item_id' =>
                $publicId,
            'designer_reward_base_item_id' =>
                $designerId,
            'approved_at' => now(),
        ])->save();

        return [
            'catalog_clothing_id' =>
                $clothingCatalogId,
            'public_base_item_id' =>
                $publicId,
            'designer_base_item_id' =>
                $designerId,
            'catalog_item_id' =>
                $catalogItemId,
            'clothing_product_id' =>
                $product->id,
        ];
        } catch (\Throwable $exception) {
            /*
             * catalog_clothing es MyISAM en esta base.
             * No participa en la transacción InnoDB exterior, así
             * que compensamos manualmente si algo posterior falla.
             */
            if ($clothingCatalogId !== null) {
                DB::table(
                    'catalog_clothing'
                )
                    ->where(
                        'id',
                        $clothingCatalogId
                    )
                    ->where(
                        'name',
                        $code
                    )
                    ->delete();
            }

            throw $exception;
        }
    }

    private function installMetadata(
        ClothingSubmission $submission,
        array $plan
    ): void {
        if (
            ! Schema::hasTable(
                'biribiri_clothing_metadata'
            ) ||
            ! Schema::hasTable(
                'biribiri_clothing_tags'
            )
        ) {
            throw new RuntimeException(
                'Faltan tablas de metadata del Armario. Inicia WardrobeCore antes de importar.'
            );
        }

        $tag = trim(
            (string) $submission->tag
        );

        foreach (
            is_array(
                $plan['pieces'] ?? null
            )
                ? $plan['pieces']
                : []
            as $piece
        ) {
            if (! is_array($piece)) {
                continue;
            }

            $type = trim(
                (string) (
                    $piece[
                        'installed_category'
                    ] ??
                    $piece[
                        'category'
                    ] ??
                    ''
                )
            );

            if ($type === '') {
                continue;
            }

            foreach (
                is_array(
                    $piece[
                        'set_ids'
                    ] ?? null
                )
                    ? $piece[
                        'set_ids'
                    ]
                    : []
                as $setId
            ) {
                DB::table(
                    'biribiri_clothing_metadata'
                )
                    ->updateOrInsert(
                        [
                            'figure_type' =>
                                $type,
                            'figure_set_id' =>
                                (string) $setId,
                        ],
                        [
                            'display_name' =>
                                (string)
                                $submission
                                    ->clothing_name,
                            'source' =>
                                'importer',
                            'updated_at' =>
                                now(),
                        ]
                    );

                if ($tag !== '') {
                    DB::table(
                        'biribiri_clothing_tags'
                    )
                        ->updateOrInsert(
                            [
                                'figure_type' =>
                                    $type,
                                'figure_set_id' =>
                                    (string) $setId,
                                'tag' => $tag,
                            ],
                            [
                                'created_at' =>
                                    now(),
                            ]
                        );
                }
            }
        }
    }

    private function assertTables(): void
    {
        foreach ([
            'items_base',
            'catalog_clothing',
            'catalog_items',
            'catalog_pages',
            'clothing_products',
            'clothing_submissions',
        ] as $table) {
            if (! Schema::hasTable($table)) {
                throw new RuntimeException(
                    'Falta tabla: ' .
                    $table
                );
            }
        }
    }

    private function nextFreeId(
        string $table,
        int $start,
        int $skip = 0
    ): int {
        $max = (int) config(
            'clothing_marketplace.installer.id_ranges.max',
            2147000000
        );

        $found = 0;

        for (
            $id = $start;
            $id <= $max;
            $id++
        ) {
            if (
                DB::table($table)
                    ->where('id', $id)
                    ->exists()
            ) {
                continue;
            }

            if ($found < $skip) {
                $found++;
                continue;
            }

            return $id;
        }

        throw new RuntimeException(
            'No quedan IDs libres en ' .
            $table .
            '.'
        );
    }
}