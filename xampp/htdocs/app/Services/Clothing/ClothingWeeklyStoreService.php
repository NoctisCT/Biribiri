<?php

namespace App\Services\Clothing;

use App\Models\ClothingProduct;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ClothingWeeklyStoreService
{
    public function timezone(): string
    {
        return (string) config(
            'clothing_marketplace.timezone',
            'Europe/Madrid'
        );
    }

    public function currentWeekStart(): CarbonImmutable
    {
        $now = CarbonImmutable::now(
            $this->timezone()
        );

        return $now
            ->startOfDay()
            ->subDays(
                $now->dayOfWeek
            );
    }

    public function recommendedWeekKey(): string
    {
        return $this
            ->currentWeekStart()
            ->addWeek()
            ->format('Y-m-d');
    }

    public function weekOptions(
        int $futureWeeks = 10
    ): array {
        $current =
            $this->currentWeekStart();

        $options = [];

        $options[
            $current->format('Y-m-d')
        ] =
            'Rotación actual · ' .
            $current->format('d/m') .
            ' → ' .
            $current
                ->addWeek()
                ->format('d/m');

        for (
            $offset = 1;
            $offset <= $futureWeeks;
            $offset++
        ) {
            $start =
                $current->addWeeks(
                    $offset
                );

            $label =
                $offset === 1
                    ? 'Próximo domingo · recomendado'
                    : (
                        '+' .
                        ($offset - 1) .
                        ' semana' .
                        (
                            $offset === 2
                                ? ''
                                : 's'
                        )
                    );

            $options[
                $start->format('Y-m-d')
            ] =
                $label .
                ' · ' .
                $start->format('d/m/Y') .
                ' → ' .
                $start
                    ->addWeek()
                    ->format('d/m/Y');
        }

        return $options;
    }

    public function schedule(
        ClothingProduct $product,
        array $data
    ): ClothingProduct {
        if (
            (string)
            $product->acquisition_method !==
            'weekly_store'
        ) {
            throw ValidationException::withMessages([
                'week_start' =>
                    'Este producto no pertenece a la tienda semanal.',
            ]);
        }

        $unitPrice =
            (int) (
                $data[
                    'unit_price'
                ] ?? 0
            );

        if ($unitPrice < 1) {
            throw ValidationException::withMessages([
                'unit_price' =>
                    'El precio debe ser de al menos 1 crédito.',
            ]);
        }

        $stockMode =
            (string) (
                $data[
                    'stock_mode'
                ] ?? ''
            );

        if (
            ! in_array(
                $stockMode,
                [
                    'limited',
                    'unlimited',
                ],
                true
            )
        ) {
            throw ValidationException::withMessages([
                'stock_mode' =>
                    'Selecciona Limitado o Ilimitado.',
            ]);
        }

        $stockTotal = null;

        if ($stockMode === 'limited') {
            $stockTotal =
                (int) (
                    $data[
                        'stock_total'
                    ] ?? 0
                );

            if (
                $stockTotal < 1 ||
                $stockTotal <
                    (int)
                    $product->sold_count
            ) {
                throw ValidationException::withMessages([
                    'stock_total' =>
                        'El stock debe ser positivo y no puede ser menor que las unidades ya vendidas.',
                ]);
            }
        }

        $weekKey =
            trim(
                (string) (
                    $data[
                        'week_start'
                    ] ?? ''
                )
            );

        try {
            $startMadrid =
                CarbonImmutable::createFromFormat(
                    'Y-m-d H:i:s',
                    $weekKey .
                    ' 00:00:00',
                    $this->timezone()
                );
        } catch (\Throwable) {
            $startMadrid = null;
        }

        if (
            ! $startMadrid ||
            $startMadrid
                ->format('Y-m-d') !==
                $weekKey ||
            $startMadrid->dayOfWeek !==
                CarbonInterface::SUNDAY
        ) {
            throw ValidationException::withMessages([
                'week_start' =>
                    'La rotación debe comenzar un domingo.',
            ]);
        }

        $current =
            $this->currentWeekStart();

        if ($startMadrid->lessThan($current)) {
            throw ValidationException::withMessages([
                'week_start' =>
                    'No puedes programar una rotación ya finalizada.',
            ]);
        }

        $endMadrid =
            $startMadrid->addWeek();

        $startUtc =
            $startMadrid->setTimezone('UTC');

        $endUtc =
            $endMadrid->setTimezone('UTC');

        $nowUtc =
            CarbonImmutable::now('UTC');

        $activeNow =
            $nowUtc->greaterThanOrEqualTo(
                $startUtc
            ) &&
            $nowUtc->lessThan(
                $endUtc
            );

        $product->forceFill([
            'web_visible' =>
                $activeNow,
            'web_section' =>
                $activeNow
                    ? 'current_week'
                    : 'scheduled',
            'status' =>
                $activeNow
                    ? 'active'
                    : 'scheduled',
            'currency_type' =>
                'credits',
            'points_type' =>
                null,
            'unit_price' =>
                $unitPrice,
            'stock_mode' =>
                $stockMode,
            'stock_total' =>
                $stockTotal,
            'starts_at' =>
                $startUtc,
            'weekly_window_ends_at' =>
                $endUtc,
            'retires_at' =>
                $stockMode ===
                    'unlimited'
                    ? $endUtc
                    : null,
            'keep_after_window_until_sold' =>
                $stockMode ===
                    'limited',
            'designer_reward_due_at' =>
                $product->creator_user_id
                    ? $startUtc
                    : null,
        ])->save();

        return $product->refresh();
    }

    public function retire(
        ClothingProduct $product
    ): ClothingProduct {
        $product->forceFill([
            'web_visible' => false,
            'web_section' => null,
            'status' => 'retired',
            'retires_at' => now(),
        ])->save();

        return $product->refresh();
    }

    public function searchLegacyOptions(
        string $search,
        int $limit = 50
    ): array {
        if (
            ! Schema::hasTable(
                'catalog_clothing'
            ) ||
            ! Schema::hasTable(
                'items_base'
            )
        ) {
            return [];
        }

        $search =
            trim($search);

        $query =
            DB::table(
                'items_base as base'
            )
                ->join(
                    'catalog_clothing as clothing',
                    'clothing.name',
                    '=',
                    'base.item_name'
                )
                ->where(
                    'base.interaction_type',
                    'clothing'
                )
                ->select([
                    'base.id',
                    'base.item_name',
                    'base.public_name',
                    'base.allow_trade',
                    'clothing.setid',
                ])
                ->orderByDesc(
                    'base.allow_trade'
                )
                ->orderBy(
                    'base.public_name'
                );

        if ($search !== '') {
            $query->where(
                function ($nested) use (
                    $search
                ): void {
                    $nested
                        ->where(
                            'base.public_name',
                            'like',
                            '%' .
                            $search .
                            '%'
                        )
                        ->orWhere(
                            'base.item_name',
                            'like',
                            '%' .
                            $search .
                            '%'
                        )
                        ->orWhere(
                            'clothing.setid',
                            'like',
                            '%' .
                            $search .
                            '%'
                        );
                }
            );
        }

        $rows =
            $query
                ->limit(
                    max(
                        $limit * 3,
                        100
                    )
                )
                ->get();

        $seen = [];
        $options = [];

        foreach ($rows as $row) {
            $code =
                (string)
                $row->item_name;

            if (isset($seen[$code])) {
                continue;
            }

            $seen[$code] = true;

            $options[
                (string)
                $row->id
            ] =
                $this->legacyLabel(
                    $row
                );

            if (
                count($options) >=
                $limit
            ) {
                break;
            }
        }

        return $options;
    }

    public function legacyOptionLabel(
        int $baseItemId
    ): ?string {
        if (
            ! Schema::hasTable(
                'catalog_clothing'
            ) ||
            ! Schema::hasTable(
                'items_base'
            )
        ) {
            return null;
        }

        $row =
            DB::table(
                'items_base as base'
            )
                ->join(
                    'catalog_clothing as clothing',
                    'clothing.name',
                    '=',
                    'base.item_name'
                )
                ->where(
                    'base.id',
                    $baseItemId
                )
                ->where(
                    'base.interaction_type',
                    'clothing'
                )
                ->select([
                    'base.id',
                    'base.item_name',
                    'base.public_name',
                    'base.allow_trade',
                    'clothing.setid',
                ])
                ->first();

        return $row
            ? $this->legacyLabel(
                $row
            )
            : null;
    }

    public function createLegacyProduct(
        array $data
    ): ClothingProduct {
        $baseItemId =
            (int) (
                $data[
                    'legacy_base_item_id'
                ] ?? 0
            );

        $base =
            DB::table('items_base')
                ->where(
                    'id',
                    $baseItemId
                )
                ->where(
                    'interaction_type',
                    'clothing'
                )
                ->first();

        if ($base === null) {
            throw ValidationException::withMessages([
                'legacy_base_item_id' =>
                    'La ropa legacy seleccionada ya no existe.',
            ]);
        }

        $clothing =
            DB::table(
                'catalog_clothing'
            )
                ->where(
                    'name',
                    (string)
                    $base->item_name
                )
                ->first();

        if ($clothing === null) {
            throw ValidationException::withMessages([
                'legacy_base_item_id' =>
                    'La ropa no tiene mapping en catalog_clothing.',
            ]);
        }

        $setIds =
            array_values(
                array_filter(
                    array_map(
                        static fn (
                            string $value
                        ): string =>
                            trim($value),
                        explode(
                            ',',
                            (string)
                            $clothing->setid
                        )
                    ),
                    static fn (
                        string $value
                    ): bool =>
                        $value !== ''
                )
            );

        if ($setIds === []) {
            throw new RuntimeException(
                'La ropa legacy no tiene Figure Set IDs.'
            );
        }

        $name =
            trim(
                (string) (
                    $data['name']
                    ??
                    $base->public_name
                    ??
                    $base->item_name
                )
            );

        if ($name === '') {
            throw ValidationException::withMessages([
                'name' =>
                    'Indica un nombre comercial.',
            ]);
        }

        $product =
            ClothingProduct::query()
                ->create([
                    'clothing_submission_id' =>
                        null,
                    'creator_user_id' =>
                        null,
                    'acquisition_method' =>
                        'weekly_store',
                    'name' =>
                        mb_substr(
                            $name,
                            0,
                            80
                        ),
                    'tag' =>
                        trim(
                            (string)
                            ($data['tag'] ?? '')
                        ) ?: null,
                    'category' =>
                        trim(
                            (string)
                            ($data[
                                'category'
                            ] ?? '')
                        ) ?: null,
                    'package_kind' =>
                        count($setIds) > 1
                            ? 'set'
                            : 'single',
                    'piece_count' =>
                        max(
                            1,
                            count($setIds)
                        ),
                    'piece_manifest' => [
                        'source' =>
                            'legacy',
                        'base_item_id' =>
                            $baseItemId,
                        'item_name' =>
                            (string)
                            $base->item_name,
                        'catalog_clothing_id' =>
                            (int)
                            $clothing->id,
                        'set_ids' =>
                            $setIds,
                    ],
                    'web_visible' =>
                        false,
                    'web_section' =>
                        null,
                    'status' =>
                        'draft',
                    'currency_type' =>
                        'credits',
                    'unit_price' =>
                        0,
                    'stock_mode' =>
                        'limited',
                    'stock_total' =>
                        null,
                    'sold_count' =>
                        0,
                    'creator_share_percent' =>
                        0,
                    'burn_percent' =>
                        100,
                    'redeemable_base_item_id' =>
                        $baseItemId,
                    'public_furni_tradeable' =>
                        (bool)
                        $base->allow_trade,
                    'designer_reward_base_item_id' =>
                        null,
                    'designer_reward_nontradeable' =>
                        true,
                    'staff_catalog_section' =>
                        'Semanal',
                ]);

        return $product;
    }

    private function legacyLabel(
        object $row
    ): string {
        $public =
            trim(
                (string)
                ($row->public_name ?? '')
            );

        $name =
            $public !== ''
                ? $public
                : (string)
                    $row->item_name;

        return
            $name .
            ' · ' .
            (string)
            $row->item_name .
            ' · set ' .
            (string)
            $row->setid .
            (
                (bool)
                $row->allow_trade
                    ? ' · tradeable'
                    : ' · no tradeable (P10 lo normalizará)'
            );
    }
}
