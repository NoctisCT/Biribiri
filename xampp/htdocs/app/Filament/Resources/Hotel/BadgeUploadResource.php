<?php

namespace App\Filament\Resources\Hotel;

use Filament\Resources\Resource;
use Filament\Forms;
use Filament\Tables;
use Illuminate\Support\Facades\Storage;
use App\Filament\Resources\Hotel\BadgeUploadResource\Pages;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

class BadgeUploadResource extends Resource
{
    protected static ?string $navigationGroup = 'Hotel';
	  protected static ?string $navigationIcon = 'heroicon-o-gif';
    protected static ?string $label = 'Subida de placas';
    protected static ?string $navigationLabel = 'Subir placas';
    protected static ?string $modelLabel = 'placa';
    protected static ?string $pluralModelLabel = 'placas';

    public static function form(Forms\Form $form): Forms\Form
    {
        return $form
            ->schema([
                Forms\Components\FileUpload::make('badge_file')
                    ->label('Subir placa')
                    ->disk('local')
                    ->directory(setting('badge_path_filesystem'))
                    ->required()
                    ->getUploadedFileNameForStorageUsing(
                        function (TemporaryUploadedFile $file): string {
                            return strtolower(str_replace([' ', '-', 'æ', 'ø', 'å'], ['_', '_', 'ae', 'oe', 'aa'], $file->getClientOriginalName()));
                        }
                    ),
            ]);
    }

    public static function table(Tables\Table $table): Tables\Table
    {
        return $table
            ->columns([
                Tables\Columns\TextColumn::make('filename')
                    ->label('Nombre del archivo')
                    ->sortable(),
                Tables\Columns\TextColumn::make('path')
                    ->label('Ruta del archivo'),
            ])
            ->filters([]);
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ManageBadgeUploads::route('/'),
        ];
    }

    public static function getFiles(): array
    {
        $badgePath = env('BadgePath', 'badges');
        $files = Storage::disk('local')->files($badgePath);

        return collect($files)->map(function ($file) {
            return [
                'filename' => basename($file),
                'path' => $file,
            ];
        })->toArray();
    }
}
