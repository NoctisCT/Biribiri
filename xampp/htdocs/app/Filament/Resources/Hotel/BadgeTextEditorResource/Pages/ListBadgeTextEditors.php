<?php

namespace App\Filament\Resources\Hotel\BadgeTextEditorResource\Pages;

use App\Filament\Resources\Hotel\BadgeTextEditorResource;
use App\Models\WebsiteBadge;
use App\Services\SettingsService;
use Filament\Pages\Actions;
use Filament\Resources\Pages\ListRecords;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\File;

class ListBadgeTextEditors extends ListRecords
{
    protected static string $resource = BadgeTextEditorResource::class;

    protected function getActions(): array
    {
        return [
            Actions\CreateAction::make()
                ->label('Añadir placa')
				        ->color('info')
                ->modalHeading('Añadir una nueva placa')
                ->modalButton('Crear placa')
                ->after(function () {
                    Notification::make()
                        ->title('Placa creada')
                        ->body('La placa se ha creado correctamente.')
                        ->success()
                        ->send();
                }),
            Actions\Action::make('export')
                ->label('Exportar a JSON')
                ->action('exportToJson'),
            Actions\Action::make('backup')
                ->label('Crear copia de seguridad')
                ->color('success')
                ->action('createBackup'),
        ];
    }

    public function exportToJson(SettingsService $settingsService)
    {
        $jsonPath = $settingsService->getOrDefault('nitro_external_texts_file');

        if (empty($jsonPath)) {
            Notification::make()
                ->title('Error al exportar')
                ->body('La ruta del archivo JSON no está configurada en los ajustes del sitio web.')
                ->danger()
                ->send();
            return;
        }

        if (!file_exists($jsonPath)) {
            Notification::make()
                ->title('Error al exportar')
                ->body('El archivo JSON no existe en la ruta especificada.')
                ->danger()
                ->send();
            return;
        }

        $jsonData = json_decode(file_get_contents($jsonPath), true);

        $badges = WebsiteBadge::all();
        $badgeKeys = $badges->pluck('badge_key')->toArray();

        foreach ($jsonData as $key => $value) {
            if (str_starts_with($key, 'badge_desc_') && !in_array($key, $badgeKeys)) {
                unset($jsonData[$key]);
            }
        }

        foreach ($badges as $badge) {
            $jsonData[$badge->badge_key] = $badge->badge_description;
        }

        file_put_contents($jsonPath, json_encode($jsonData, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        Notification::make()
            ->title('Exportación completada')
            ->body('Los datos de las placas se han exportado correctamente.')
            ->success()
            ->send();
    }

    public function createBackup(SettingsService $settingsService)
    {
        $jsonPath = $settingsService->getOrDefault('nitro_external_texts_file');

        if (empty($jsonPath)) {
            Notification::make()
                ->title('Error en la copia de seguridad')
                ->body('La ruta del archivo JSON no está configurada en los ajustes del sitio web.')
                ->danger()
                ->send();
            return;
        }

        if (!file_exists($jsonPath)) {
            Notification::make()
                ->title('Error en la copia de seguridad')
                ->body('El archivo JSON no existe en la ruta especificada.')
                ->danger()
                ->send();
            return;
        }

        $backupPath = dirname($jsonPath) . '/ExternalTexts_' . time(). '.json';

        if (copy($jsonPath, $backupPath)) {
            Notification::make()
                ->title('Copia de seguridad completada')
                ->body('Se ha creado una copia de seguridad del archivo JSON: ' . basename($backupPath))
                ->success()
                ->send();
        } else {
            Notification::make()
                ->title('Error en la copia de seguridad')
                ->body('No se pudo crear una copia de seguridad del archivo JSON.')
                ->danger()
                ->send();
        }
    }
}
