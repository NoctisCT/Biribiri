<?php

namespace App\Filament\Resources\Hotel;

use App\Filament\Resources\Hotel\ClothingSubmissionResource\Pages;
use App\Models\ClothingSubmission;
use App\Models\User;
use App\Services\Clothing\ClothingApprovalPlanService;
use App\Services\Clothing\ClothingLiveInstaller;
use Carbon\Carbon;
use Filament\Forms;
use Filament\Notifications\Notification;
use Filament\Resources\Resource;
use Filament\Tables;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;

class ClothingSubmissionResource extends Resource
{
    protected static ?string $model = ClothingSubmission::class;

    protected static ?string $navigationGroup = 'Hotel';

    /*
     * Ropa se modera desde Hotel > Solicitudes > Ropa.
     * Se mantiene el Resource/URL por compatibilidad, sin entrada
     * independiente en el menú lateral.
     */
    protected static bool $shouldRegisterNavigation = false;
    protected static ?string $navigationIcon = 'heroicon-o-shopping-bag';
    protected static ?string $navigationLabel = 'Ropa de usuarios';
    protected static ?string $modelLabel = 'Solicitud de ropa';
    protected static ?string $pluralModelLabel = 'Solicitudes de ropa';
    protected static ?string $slug = 'hotel/clothing-submissions';
    protected static ?int $navigationSort = 31;

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

    private const ACQUISITION_METHODS = [
        'weekly_store' => 'Tienda semanal web',
        'biri_club' => 'Biri Club',
        'battle_pass' => 'Pase de batalla',
        'online_time' => 'Horas conectado',
        'event' => 'Evento',
        'staff' => 'Solo STAFF',
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

    public static function canEdit($record): bool
    {
        return false;
    }

    public static function canDelete($record): bool
    {
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
            ->defaultSort('created_at', 'desc')
            ->columns([
                TextColumn::make('clothing_name')
                    ->label('Nombre')
                    ->searchable()
                    ->sortable()
                    ->description(
                        fn (ClothingSubmission $record): string =>
                            trim(
                                ($record->tag
                                    ? ('#' . $record->tag)
                                    : '') .
                                ($record->original_filename
                                    ? (' · ' .
                                        $record->original_filename)
                                    : '')
                            )
                    ),

                TextColumn::make('creator_user_id')
                    ->label('Diseñador')
                    ->formatStateUsing(
                        fn ($state): string =>
                            $state === null
                                ? 'STAFF'
                                : self::username((int) $state)
                    ),

                TextColumn::make('designer_comment')
                    ->label('Comentario diseñador')
                    ->placeholder('—')
                    ->wrap()
                    ->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('requested_category')
                    ->label('Sección pedida')
                    ->formatStateUsing(
                        fn ($state): string =>
                            self::categoryLabel($state)
                    ),

                TextColumn::make('final_category')
                    ->label('Sección final')
                    ->formatStateUsing(
                        fn ($state): string =>
                            self::categoryLabel($state)
                    )
                    ->placeholder('Sin asignar'),

                TextColumn::make('intended_acquisition_method')
                    ->label('Destino')
                    ->formatStateUsing(
                        fn ($state): string =>
                            self::ACQUISITION_METHODS[
                                (string) $state
                            ] ?? (string) $state
                    ),

                TextColumn::make('technical_status')
                    ->label('QA técnico')
                    ->badge()
                    ->formatStateUsing(
                        fn (string $state): string => match ($state) {
                            'not_checked' => 'Sin comprobar',
                            'checking' => 'Comprobando',
                            'valid' => 'Válida',
                            'invalid' => 'Con errores',
                            default => $state,
                        }
                    )
                    ->color(
                        fn (string $state): string => match ($state) {
                            'not_checked' => 'gray',
                            'checking' => 'warning',
                            'valid' => 'success',
                            'invalid' => 'danger',
                            default => 'gray',
                        }
                    ),

                TextColumn::make('status')
                    ->label('Estado')
                    ->badge()
                    ->formatStateUsing(
                        fn (string $state): string => match ($state) {
                            'pending' => 'Pendiente',
                            'importing' => 'Importando',
                            'approved' => 'Aprobada',
                            'rejected' => 'Rechazada',
                            'import_failed' => 'Error de importación',
                            default => $state,
                        }
                    )
                    ->color(
                        fn (string $state): string => match ($state) {
                            'pending' => 'warning',
                            'importing' => 'info',
                            'approved' => 'success',
                            'rejected' => 'gray',
                            'import_failed' => 'danger',
                            default => 'gray',
                        }
                    ),

                TextColumn::make('created_at')
                    ->label('Enviada')
                    ->formatStateUsing(
                        fn ($state): string =>
                            Carbon::parse((string) $state, 'UTC')
                                ->setTimezone('Europe/Madrid')
                                ->format('d/m/Y H:i')
                    )
                    ->sortable(),

                TextColumn::make('moderation_reason')
                    ->label('Motivo')
                    ->placeholder('—')
                    ->wrap()
                    ->toggleable(isToggledHiddenByDefault: true),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('Estado')
                    ->options([
                        'pending' => 'Pendiente',
                        'importing' => 'Importando',
                        'approved' => 'Aprobada',
                        'rejected' => 'Rechazada',
                        'import_failed' => 'Error de importación',
                    ]),

                SelectFilter::make('intended_acquisition_method')
                    ->label('Destino')
                    ->options(self::ACQUISITION_METHODS),
            ])
            ->actions([
                Tables\Actions\Action::make('review_data')
                    ->label('Revisar datos')
                    ->icon('heroicon-o-pencil-square')
                    ->color('primary')
                    ->visible(
                        fn (ClothingSubmission $record): bool =>
                            $record->status === 'pending'
                    )
                    ->fillForm(
                        fn (ClothingSubmission $record): array => [
                            'clothing_name' =>
                                (string) $record->clothing_name,
                            'tag' =>
                                (string) ($record->tag ?? ''),
                            'final_category' =>
                                $record->final_category ??
                                $record->requested_category,
                            'intended_acquisition_method' =>
                                (string)
                                $record->intended_acquisition_method,
                        ]
                    )
                    ->form([
                        Forms\Components\TextInput::make(
                            'clothing_name'
                        )
                            ->label('Nombre')
                            ->required()
                            ->maxLength(80),

                        Forms\Components\TextInput::make('tag')
                            ->label('Tag')
                            ->maxLength(64),

                        Forms\Components\Select::make(
                            'final_category'
                        )
                            ->label('Sección final')
                            ->options(self::CATEGORIES)
                            ->searchable()
                            ->required(),

                        Forms\Components\Select::make(
                            'intended_acquisition_method'
                        )
                            ->label('Método de obtención')
                            ->options(self::ACQUISITION_METHODS)
                            ->required(),
                    ])
                    ->action(
                        function (
                            ClothingSubmission $record,
                            array $data
                        ): void {
                            $record->forceFill([
                                'clothing_name' =>
                                    trim(
                                        (string)
                                        $data['clothing_name']
                                    ),
                                'tag' =>
                                    trim(
                                        (string)
                                        ($data['tag'] ?? '')
                                    ) ?: null,
                                'final_category' =>
                                    (string)
                                    $data['final_category'],
                                'intended_acquisition_method' =>
                                    (string)
                                    $data[
                                        'intended_acquisition_method'
                                    ],
                                'moderator_user_id' =>
                                    auth()->user()?->id,
                            ])->save();

                            Notification::make()
                                ->title(
                                    'Datos de la ropa actualizados'
                                )
                                ->success()
                                ->send();
                        }
                    ),

                Tables\Actions\Action::make(
                    'approval_plan'
                )
                    ->label('Plan de aprobación')
                    ->icon(
                        'heroicon-o-clipboard-document-check'
                    )
                    ->color('success')
                    ->visible(
                        fn (
                            ClothingSubmission $record
                        ): bool =>
                            $record->status === 'pending' &&
                            $record->technical_status === 'valid'
                    )
                    ->modalHeading(
                        fn (
                            ClothingSubmission $record
                        ): string =>
                            'Plan de aprobación · ' .
                            $record->clothing_name
                    )
                    ->modalSubmitAction(false)
                    ->modalCancelActionLabel('Cerrar')
                    ->modalContent(
                        fn (
                            ClothingSubmission $record
                        ) =>
                            view(
                                'filament.clothing.approval-plan',
                                [
                                    'result' =>
                                        app(
                                            ClothingApprovalPlanService::class
                                        )->buildSafe(
                                            $record
                                        ),
                                ]
                            )
                    )
                    ->action(
                        static fn (): null =>
                            null
                    ),

                Tables\Actions\Action::make(
                    'approve'
                )
                    ->label('Aprobar')
                    ->icon(
                        'heroicon-o-check-circle'
                    )
                    ->color('success')
                    ->visible(
                        fn (
                            ClothingSubmission $record
                        ): bool =>
                            $record->status === 'pending' &&
                            $record->technical_status === 'valid'
                    )
                    ->requiresConfirmation()
                    ->modalHeading(
                        'Aprobar e instalar ropa'
                    )
                    ->modalDescription(
                        'Se volverá a validar el plan dentro del lock. Después se instalarán assets y registros DB. Si falla cualquier paso previo al commit, se restaurarán los archivos y la transacción DB.'
                    )
                    ->modalSubmitActionLabel(
                        'Aprobar e instalar'
                    )
                    ->action(
                        function (
                            ClothingSubmission $record
                        ): void {
                            try {
                                $result =
                                    app(
                                        ClothingLiveInstaller::class
                                    )->install(
                                        $record,
                                        auth()->user()?->id
                                    );

                                $body =
                                    'Instalación completada.';

                                if (
                                    $result[
                                        'emulator_restart_required'
                                    ] ?? false
                                ) {
                                    $body .=
                                        ' Reinicia el emulador antes del primer test dentro del hotel.';
                                }

                                Notification::make()
                                    ->title(
                                        'Ropa aprobada e instalada'
                                    )
                                    ->body(
                                        $body
                                    )
                                    ->success()
                                    ->persistent()
                                    ->send();
                            } catch (\Throwable $exception) {
                                Notification::make()
                                    ->title(
                                        'Aprobación bloqueada'
                                    )
                                    ->body(
                                        $exception
                                            ->getMessage()
                                    )
                                    ->danger()
                                    ->persistent()
                                    ->send();
                            }
                        }
                    ),

                Tables\Actions\Action::make('reject')
                    ->label('Rechazar')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(
                        fn (ClothingSubmission $record): bool =>
                            $record->status === 'pending'
                    )
                    ->form([
                        Forms\Components\Textarea::make('reason')
                            ->label('Motivo del rechazo')
                            ->helperText(
                                'El diseñador verá este motivo. Aprobar se añadirá cuando existan staging, QA técnico y preview completo.'
                            )
                            ->required()
                            ->minLength(3)
                            ->maxLength(500)
                            ->rows(4),
                    ])
                    ->action(
                        function (
                            ClothingSubmission $record,
                            array $data
                        ): void {
                            $record->forceFill([
                                'status' => 'rejected',
                                'moderator_user_id' =>
                                    auth()->user()?->id,
                                'moderation_reason' =>
                                    trim(
                                        (string)
                                        $data['reason']
                                    ),
                                'rejected_at' => now(),
                            ])->save();

                            Notification::make()
                                ->title('Ropa rechazada')
                                ->success()
                                ->send();
                        }
                    ),
            ])
            ->bulkActions([]);
    }

    public static function getPages(): array
    {
        return [
            'index' =>
                Pages\ManageClothingSubmissions::route('/'),
        ];
    }

    public static function getNavigationBadge(): ?string
    {
        if (! static::canViewAny()) {
            return null;
        }

        $count = ClothingSubmission::query()
            ->where('status', 'pending')
            ->count();

        return $count > 0 ? (string) $count : null;
    }

    public static function getNavigationBadgeColor(): ?string
    {
        return 'warning';
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

    private static function categoryLabel(
        mixed $value
    ): string {
        if ($value === null || $value === '') {
            return '—';
        }

        $key = (string) $value;

        return self::CATEGORIES[$key] ?? $key;
    }
}