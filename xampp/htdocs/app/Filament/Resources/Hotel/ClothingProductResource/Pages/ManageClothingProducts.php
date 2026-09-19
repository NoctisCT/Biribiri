<?php

namespace App\Filament\Resources\Hotel\ClothingProductResource\Pages;

use App\Filament\Resources\Hotel\ClothingProductResource;
use App\Services\Clothing\ClothingWeeklyStoreService;
use Filament\Actions\Action;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ManageRecords;

class ManageClothingProducts extends ManageRecords
{
    protected static string $resource =
        ClothingProductResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('legacy')
                ->label(
                    'Añadir ropa legacy'
                )
                ->icon(
                    'heroicon-o-archive-box-arrow-down'
                )
                ->color('warning')
                ->modalHeading(
                    'Añadir ropa ya instalada en el holo'
                )
                ->modalDescription(
                    'Úsalo solo para ropa legacy que ya exista en catalog_clothing/items_base. Una ropa custom nueva debe entrar por el importer.'
                )
                ->modalSubmitActionLabel(
                    'Crear y programar'
                )
                ->form([
                    Forms\Components\Select::make(
                        'legacy_base_item_id'
                    )
                        ->label(
                            'Ropa legacy'
                        )
                        ->searchable()
                        ->getSearchResultsUsing(
                            fn (
                                string $search
                            ): array =>
                                app(
                                    ClothingWeeklyStoreService::class
                                )->searchLegacyOptions(
                                    $search
                                )
                        )
                        ->getOptionLabelUsing(
                            fn ($value): ?string =>
                                app(
                                    ClothingWeeklyStoreService::class
                                )->legacyOptionLabel(
                                    (int)
                                    $value
                                )
                        )
                        ->helperText(
                            'Busca por nombre, item_name o Figure Set ID.'
                        )
                        ->required(),

                    Forms\Components\TextInput::make(
                        'name'
                    )
                        ->label(
                            'Nombre comercial'
                        )
                        ->required()
                        ->maxLength(80),

                    Forms\Components\TextInput::make(
                        'tag'
                    )
                        ->label('Tag')
                        ->maxLength(64),

                    Forms\Components\Select::make(
                        'category'
                    )
                        ->label(
                            'Categoría del armario'
                        )
                        ->options(
                            ClothingProductResource::categories()
                        )
                        ->searchable(),

                    ...ClothingProductResource::commercialForm(),
                ])
                ->action(
                    function (
                        array $data
                    ): void {
                        $service =
                            app(
                                ClothingWeeklyStoreService::class
                            );

                        $product =
                            $service
                                ->createLegacyProduct(
                                    $data
                                );

                        try {
                            $service->schedule(
                                $product,
                                $data
                            );
                        } catch (\Throwable $exception) {
                            $product->delete();

                            throw $exception;
                        }

                        Notification::make()
                            ->title(
                                'Ropa legacy añadida'
                            )
                            ->body(
                                'No se ha importado ningún asset nuevo: reutiliza la ropa ya instalada.'
                            )
                            ->success()
                            ->send();
                    }
                ),
        ];
    }
}
