<?php

namespace App\Filament\Resources\Hotel;

use App\Filament\Resources\Hotel\ClothingProductResource\Pages;
use App\Models\ClothingProduct;
use App\Models\User;
use App\Services\Clothing\ClothingWeeklyStoreService;
use Carbon\Carbon;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ClothingProductResource extends Resource
{
    protected static ?string $model =
        ClothingProduct::class;

    protected static ?string $navigationGroup =
        'Hotel';

    protected static ?string $navigationIcon =
        'heroicon-o-calendar-days';

    protected static ?string $navigationLabel =
        'Tienda de ropa';

    protected static ?string $modelLabel =
        'Producto de ropa';

    protected static ?string $pluralModelLabel =
        'Tienda de ropa';

    protected static ?string $slug =
        'hotel/clothing-store';

    protected static ?int $navigationSort =
        31;

    private const CATEGORIES = [
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

    public static function canViewAny(): bool
    {
        return hasHousekeepingPermission(
            'manage_clothing_submissions'
        );
    }

    public static function canCreate(): bool
    {
        return false;
    }

    public static function canEdit(
        $record
    ): bool {
        return false;
    }

    public static function canDelete(
        $record
    ): bool {
        return false;
    }

    public static function form(
        Forms\Form $form
    ): Forms\Form {
        return $form->schema([]);
    }

    public static function table(
        Table $table
    ): Table {
        return $table
            ->defaultSort(
                'created_at',
                'desc'
            )
            ->columns([
                TextColumn::make('name')
                    ->label('Ropa')
                    ->searchable()
                    ->description(
                        fn (
                            ClothingProduct $record
                        ): string =>
                            (
                                $record
                                    ->clothing_submission_id
                                    ? 'Importer'
                                    : 'Legacy'
                            ) .
                            (
                                $record->tag
                                    ? ' · #' .
                                        ltrim(
                                            (string)
                                            $record->tag,
                                            '#'
                                        )
                                    : ''
                            )
                    )
                    ->wrap(),

                TextColumn::make(
                    'creator_user_id'
                )
                    ->label('Diseñador')
                    ->formatStateUsing(
                        fn ($state): string =>
                            $state
                                ? self::username(
                                    (int)
                                    $state
                                )
                                : 'Biribiri / legacy'
                    ),

                TextColumn::make('status')
                    ->label('Estado')
                    ->badge()
                    ->formatStateUsing(
                        fn (
                            string $state
                        ): string =>
                            match ($state) {
                                'draft' =>
                                    'Sin programar',
                                'scheduled' =>
                                    'Programada',
                                'active' =>
                                    'Esta semana',
                                'previous' =>
                                    'Semana anterior',
                                'sold_out' =>
                                    'Agotada',
                                'retired' =>
                                    'Retirada',
                                default =>
                                    $state,
                            }
                    )
                    ->color(
                        fn (
                            string $state
                        ): string =>
                            match ($state) {
                                'draft' =>
                                    'gray',
                                'scheduled' =>
                                    'info',
                                'active' =>
                                    'success',
                                'previous' =>
                                    'warning',
                                'sold_out' =>
                                    'danger',
                                'retired' =>
                                    'gray',
                                default =>
                                    'gray',
                            }
                    ),

                TextColumn::make('starts_at')
                    ->label('Rotación')
                    ->formatStateUsing(
                        fn ($state): string =>
                            $state
                                ? Carbon::parse(
                                    (string)
                                    $state,
                                    'UTC'
                                )
                                    ->setTimezone(
                                        'Europe/Madrid'
                                    )
                                    ->format(
                                        'd/m/Y H:i'
                                    )
                                : 'Sin programar'
                    ),

                TextColumn::make('unit_price')
                    ->label('Precio')
                    ->formatStateUsing(
                        fn ($state): string =>
                            number_format(
                                (int)
                                $state,
                                0,
                                ',',
                                '.'
                            ) .
                            ' créditos'
                    ),

                TextColumn::make('stock_total')
                    ->label('Stock')
                    ->getStateUsing(
                        fn (
                            ClothingProduct $record
                        ): string =>
                            $record->stock_mode ===
                            'unlimited'
                                ? 'Ilimitado'
                                : (
                                    (string)
                                    $record
                                        ->remainingStock() .
                                    ' / ' .
                                    (string)
                                    (
                                        $record
                                            ->stock_total
                                        ?? 0
                                    )
                                )
                    ),

                TextColumn::make('web_visible')
                    ->label('Web')
                    ->formatStateUsing(
                        fn ($state): string =>
                            $state
                                ? 'Visible'
                                : 'Oculta'
                    )
                    ->badge()
                    ->color(
                        fn ($state): string =>
                            $state
                                ? 'success'
                                : 'gray'
                    ),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('Estado')
                    ->options([
                        'draft' =>
                            'Sin programar',
                        'scheduled' =>
                            'Programada',
                        'active' =>
                            'Esta semana',
                        'previous' =>
                            'Semana anterior',
                        'sold_out' =>
                            'Agotada',
                        'retired' =>
                            'Retirada',
                    ]),
            ])
            ->actions([
                Tables\Actions\Action::make(
                    'configure'
                )
                    ->label(
                        'Programar / configurar'
                    )
                    ->icon(
                        'heroicon-o-calendar-days'
                    )
                    ->color('primary')
                    ->visible(
                        fn (
                            ClothingProduct $record
                        ): bool =>
                            in_array(
                                $record->status,
                                [
                                    'draft',
                                    'scheduled',
                                    'active',
                                ],
                                true
                            )
                    )
                    ->fillForm(
                        function (
                            ClothingProduct $record
                        ): array {
                            $service =
                                app(
                                    ClothingWeeklyStoreService::class
                                );

                            return [
                                'week_start' =>
                                    $record
                                        ->starts_at
                                        ? $record
                                            ->starts_at
                                            ->copy()
                                            ->setTimezone(
                                                $service
                                                    ->timezone()
                                            )
                                            ->format(
                                                'Y-m-d'
                                            )
                                        : $service
                                            ->recommendedWeekKey(),
                                'unit_price' =>
                                    max(
                                        1,
                                        (int)
                                        $record
                                            ->unit_price
                                    ),
                                'stock_mode' =>
                                    (string)
                                    $record
                                        ->stock_mode,
                                'stock_total' =>
                                    $record
                                        ->stock_total,
                            ];
                        }
                    )
                    ->form(
                        self::commercialForm()
                    )
                    ->modalHeading(
                        fn (
                            ClothingProduct $record
                        ): string =>
                            'Programar · ' .
                            $record->name
                    )
                    ->modalSubmitActionLabel(
                        'Guardar programación'
                    )
                    ->action(
                        function (
                            ClothingProduct $record,
                            array $data
                        ): void {
                            app(
                                ClothingWeeklyStoreService::class
                            )->schedule(
                                $record,
                                $data
                            );

                            Notification::make()
                                ->title(
                                    'Producto programado'
                                )
                                ->body(
                                    'La aprobación técnica sigue separada de la publicación comercial.'
                                )
                                ->success()
                                ->send();
                        }
                    ),

                Tables\Actions\Action::make(
                    'retire'
                )
                    ->label('Retirar')
                    ->icon(
                        'heroicon-o-archive-box-x-mark'
                    )
                    ->color('danger')
                    ->requiresConfirmation()
                    ->visible(
                        fn (
                            ClothingProduct $record
                        ): bool =>
                            ! in_array(
                                $record->status,
                                [
                                    'retired',
                                    'sold_out',
                                ],
                                true
                            )
                    )
                    ->action(
                        function (
                            ClothingProduct $record
                        ): void {
                            app(
                                ClothingWeeklyStoreService::class
                            )->retire(
                                $record
                            );

                            Notification::make()
                                ->title(
                                    'Producto retirado'
                                )
                                ->success()
                                ->send();
                        }
                    ),
            ])
            ->bulkActions([]);
    }

    public static function commercialForm(): array
    {
        return [
            Forms\Components\Select::make(
                'week_start'
            )
                ->label('Rotación semanal')
                ->options(
                    fn (): array =>
                        app(
                            ClothingWeeklyStoreService::class
                        )->weekOptions()
                )
                ->default(
                    fn (): string =>
                        app(
                            ClothingWeeklyStoreService::class
                        )->recommendedWeekKey()
                )
                ->helperText(
                    'El próximo domingo es la sugerencia principal. También puedes usar la rotación actual o semanas posteriores.'
                )
                ->required(),

            Forms\Components\TextInput::make(
                'unit_price'
            )
                ->label('Precio')
                ->numeric()
                ->minValue(1)
                ->suffix('créditos')
                ->required(),

            Forms\Components\Select::make(
                'stock_mode'
            )
                ->label('Stock')
                ->options([
                    'limited' =>
                        'Limitado',
                    'unlimited' =>
                        'Ilimitado',
                ])
                ->default('limited')
                ->required(),

            Forms\Components\TextInput::make(
                'stock_total'
            )
                ->label(
                    'Unidades si es limitado'
                )
                ->numeric()
                ->minValue(1)
                ->helperText(
                    'Se ignora cuando el stock es Ilimitado.'
                ),
        ];
    }

    public static function categories(): array
    {
        return self::CATEGORIES;
    }

    public static function getPages(): array
    {
        return [
            'index' =>
                Pages\ManageClothingProducts::route(
                    '/'
                ),
        ];
    }

    private static function username(
        int $userId
    ): string {
        return (string) (
            User::query()
                ->whereKey($userId)
                ->value('username')
            ??
            ('#' . $userId)
        );
    }
}
