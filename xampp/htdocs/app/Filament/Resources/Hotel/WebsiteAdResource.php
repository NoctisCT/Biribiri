<?php

namespace App\Filament\Resources\Hotel;

use App\Filament\Resources\Hotel\WebsiteAdResource\Pages;
use App\Models\WebsiteAd;
use Filament\Forms;
use Filament\Forms\Form;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Table;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Columns\ImageColumn;
use Filament\Tables\Columns\Layout\Stack;
use Illuminate\Support\Facades\Artisan;
use Livewire\Features\SupportFileUploads\TemporaryUploadedFile;

class WebsiteAdResource extends Resource
{
    protected static ?string $model = WebsiteAd::class;

    protected static ?string $navigationGroup = 'Hotel';
    protected static ?string $navigationLabel = 'Imágenes de anuncios';
    protected static ?string $modelLabel = 'imagen de anuncio';
    protected static ?string $pluralModelLabel = 'imágenes de anuncios';
    protected static ?string $navigationIcon = 'heroicon-o-sparkles';

    public static function form(Form $form): Form
    {
        return $form
            ->schema([
                Forms\Components\FileUpload::make('image')
                    ->label('Imagen')
                    ->disk('ads')
                    ->preserveFilenames()
                    ->image()
                    ->rules(['required', 'image', 'mimes:jpeg,png,jpg,gif'])
                    ->validationMessages([
                        'required' => 'Sube una imagen.', 'image' => 'El archivo debe ser una imagen válida.', 'mimes' => 'Solo se permiten imágenes JPEG, PNG, JPG y GIF.'])
                    ->required()
                    ->getUploadedFileNameForStorageUsing(
                        function (TemporaryUploadedFile $file): string {
                            return strtolower(str_replace([' ', '-', 'æ', 'ø', 'å'], ['_', '_', 'ae', 'oe', 'aa'], $file->getClientOriginalName()));
                        }
                    )
            ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                Stack::make([
                    ImageColumn::make('image_url')
                        ->label('')
                        ->extraAttributes(['style' => 'image-rendering: pixelated'])
                        ->size(125),
                    TextColumn::make('image')
                        ->label('')
                        ->alignCenter()
                        ->searchable(),
                ]),
                TextColumn::make('created_at')
                    ->label(__('filament::resources.columns.created_at'))
                    ->dateTime(),
            ])
            ->filters([
            ])
            ->actions([
                Tables\Actions\DeleteAction::make(),
            ])
            ->searchable();
    }

    public static function getPages(): array
    {
        return [
            'index' => Pages\ListWebsiteAds::route('/'),
            'create' => Pages\CreateWebsiteAd::route('/create'),
        ];
    }
}
