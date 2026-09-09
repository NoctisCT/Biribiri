<?php

namespace App\Filament\Resources\Hotel\WebsiteAdResource\Pages;

use App\Filament\Resources\Hotel\WebsiteAdResource;
use Filament\Pages\Actions;
use Filament\Resources\Pages\ListRecords;
use Filament\Pages\Actions\Action;
use Illuminate\Support\Facades\Artisan;
use App\Models\WebsiteAd;

class ListWebsiteAds extends ListRecords
{
    protected static string $resource = WebsiteAdResource::class;

    protected function getActions(): array
    {
        return [
            Actions\CreateAction::make()
                ->label('Crear nuevo anuncio')
				->color('success'),
            Action::make('importAdsData')
                ->label('Importar imágenes de anuncios desde la carpeta')
                ->color('info')
                ->action(function () {
                    Artisan::call('import:ads-data');
                    session()->flash('success', '¡Datos de anuncios importados correctamente!');
                })
                ->requiresConfirmation()
                ->modalHeading('Importar datos de anuncios')
                ->modalDescription('¿Seguro que quieres importar los datos de anuncios? Esta acción no se puede deshacer.')
                ->modalButton('Sí, importar datos'),
            Action::make('emptyTable')
                ->label('Vaciar tabla de la base de datos')
                ->color('danger')
                ->action(function () {
                    WebsiteAd::truncate();
                    session()->flash('success', '¡La tabla se ha vaciado correctamente!');
                })
                ->requiresConfirmation()
                ->modalHeading('Vaciar tabla')
                ->modalDescription('¿Seguro que quieres vaciar la tabla? Esta acción no se puede deshacer y eliminará todos los registros.')
                ->modalButton('Sí, vaciar tabla'),
        ];
    }
}