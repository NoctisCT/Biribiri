<?php

namespace App\Livewire\Filament;

use App\Models\ClothingSubmission;
use App\Models\User;
use App\Services\Clothing\ClothingPreviewService;
use Filament\Forms;
use Filament\Forms\Concerns\InteractsWithForms;
use Filament\Forms\Contracts\HasForms;
use Filament\Notifications\Notification;
use Filament\Tables;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Concerns\InteractsWithTable;
use Filament\Tables\Contracts\HasTable;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use Illuminate\Contracts\View\View;
use Livewire\Component;

class ClothingApplicationsTable extends Component implements HasForms, HasTable
{
    use InteractsWithForms;
    use InteractsWithTable;

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
        'battle_pass' => 'Pase',
        'online_time' => 'Tiempo online',
        'event' => 'Evento',
        'staff' => 'STAFF / distribución directa',
    ];

    public function mount(): void
    {
        abort_unless(
            hasHousekeepingPermission(
                'manage_clothing_submissions'
            ),
            403
        );
    }

    public function table(Table $table): Table
    {
        return $table
            ->query(
                ClothingSubmission::query()
            )
            ->defaultSort(
                'created_at',
                'desc'
            )
            ->columns([
                TextColumn::make('clothing_name')
                    ->label('Ropa')
                    ->searchable()
                    ->description(
                        fn (
                            ClothingSubmission $record
                        ): string =>
                            '#' .
                            $record->id .
                            ' · ' .
                            (string)
                            $record->original_filename
                    )
                    ->wrap(),

                TextColumn::make('tag')
                    ->label('Tag')
                    ->formatStateUsing(
                        fn ($state): string =>
                            trim(
                                (string) $state
                            ) === ''
                                ? '—'
                                : (
                                    str_starts_with(
                                        trim(
                                            (string)
                                            $state
                                        ),
                                        '#'
                                    )
                                        ? trim(
                                            (string)
                                            $state
                                        )
                                        : '#' .
                                            trim(
                                                (string)
                                                $state
                                            )
                                )
                    )
                    ->searchable()
                    ->wrap(),

                TextColumn::make('creator_user_id')
                    ->label('Diseñador')
                    ->formatStateUsing(
                        fn ($state): string =>
                            $state === null
                                ? 'STAFF'
                                : self::username(
                                    (int) $state
                                )
                    ),

                TextColumn::make('requested_category')
                    ->label('Sección pedida')
                    ->formatStateUsing(
                        fn ($state): string =>
                            self::categoryLabel(
                                $state
                            )
                    ),

                TextColumn::make('final_category')
                    ->label('Sección final')
                    ->formatStateUsing(
                        fn ($state): string =>
                            self::categoryLabel(
                                $state
                            )
                    )
                    ->placeholder('Sin asignar'),

                TextColumn::make(
                    'intended_acquisition_method'
                )
                    ->label('Destino')
                    ->formatStateUsing(
                        fn ($state): string =>
                            self::ACQUISITION_METHODS[
                                (string) $state
                            ] ?? (string) $state
                    )
                    ->badge(),

                TextColumn::make('package_kind')
                    ->label('Paquete')
                    ->formatStateUsing(
                        fn ($state): string =>
                            match ((string) $state) {
                                'set' => 'Set',
                                'batch' => 'Lote inválido',
                                default => 'Single',
                            }
                    )
                    ->description(
                        fn (ClothingSubmission $record): string =>
                            (string) $record->piece_count .
                            ' pieza(s)'
                    ),

                TextColumn::make('piece_manifest')
                    ->label('Mapa técnico')
                    ->formatStateUsing(
                        fn ($state): string =>
                            self::pieceSummary(
                                $state
                            )
                    )
                    ->wrap()
                    ->toggleable(),

                TextColumn::make('technical_status')
                    ->label('QA técnico')
                    ->badge()
                    ->formatStateUsing(
                        fn (string $state): string =>
                            match ($state) {
                                'not_checked' => 'Sin comprobar',
                                'checking' => 'Comprobando',
                                'valid' => 'Válido',
                                'invalid' => 'Con errores',
                                default => $state,
                            }
                    ),

                TextColumn::make('status')
                    ->label('Moderación')
                    ->badge()
                    ->formatStateUsing(
                        fn (string $state): string =>
                            match ($state) {
                                'pending' => 'Pendiente',
                                'import_failed' => 'Error técnico',
                                'approved' => 'Aprobada',
                                'rejected' => 'Rechazada',
                                'importing' => 'Importando',
                                default => $state,
                            }
                    ),

                TextColumn::make('designer_comment')
                    ->label('Comentario diseñador')
                    ->placeholder('—')
                    ->wrap()
                    ->toggleable(
                        isToggledHiddenByDefault: true
                    ),

                TextColumn::make('created_at')
                    ->label('Enviada')
                    ->dateTime('d/m/Y H:i'),
            ])
            ->filters([
                SelectFilter::make('status')
                    ->label('Estado')
                    ->options([
                        'pending' => 'Pendiente',
                        'import_failed' => 'Error técnico',
                        'approved' => 'Aprobada',
                        'rejected' => 'Rechazada',
                    ]),

                SelectFilter::make(
                    'intended_acquisition_method'
                )
                    ->label('Destino')
                    ->options(
                        self::ACQUISITION_METHODS
                    ),
            ])
            ->actions([
                Tables\Actions\Action::make(
                    'preview'
                )
                    ->label('Preview')
                    ->icon('heroicon-o-eye')
                    ->color('info')
                    ->visible(
                        fn (ClothingSubmission $record): bool =>
                            $record->technical_status ===
                                'valid' &&
                            in_array(
                                $record->status,
                                [
                                    'pending',
                                    'approved',
                                ],
                                true
                            )
                    )
                    ->modalHeading(
                        fn (ClothingSubmission $record): string =>
                            'Preview · ' .
                            $record->clothing_name
                    )
                    ->modalWidth('7xl')
                    ->modalSubmitAction(false)
                    ->modalCancelActionLabel('Cerrar')
                    ->modalContent(
                        function (
                            ClothingSubmission $record
                        ): View {
                            $preview =
                                app(
                                    ClothingPreviewService::class
                                )->ensure(
                                    $record
                                );

                            $record->refresh();

                            return view(
                                'filament.components.clothing-preview',
                                [
                                    'record' =>
                                        $record,
                                    'preview' =>
                                        $preview,
                                ]
                            );
                        }
                    ),

                Tables\Actions\Action::make(
                    'review_data'
                )
                    ->label('Revisar datos')
                    ->icon(
                        'heroicon-o-pencil-square'
                    )
                    ->color('primary')
                    ->visible(
                        fn (ClothingSubmission $record): bool =>
                            in_array(
                                $record->status,
                                [
                                    'pending',
                                    'import_failed',
                                ],
                                true
                            )
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

                        Forms\Components\TextInput::make(
                            'tag'
                        )
                            ->label('Tag')
                            ->maxLength(64),

                        Forms\Components\Select::make(
                            'final_category'
                        )
                            ->label('Sección final')
                            ->options(
                                self::CATEGORIES
                            )
                            ->searchable()
                            ->required(),

                        Forms\Components\Select::make(
                            'intended_acquisition_method'
                        )
                            ->label('Destino / tienda')
                            ->options(
                                self::ACQUISITION_METHODS
                            )
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
                                'preview_manifest' =>
                                    null,
                            ])->save();

                            Notification::make()
                                ->title(
                                    'Datos de la ropa actualizados'
                                )
                                ->success()
                                ->send();
                        }
                    ),

                Tables\Actions\Action::make('reject')
                    ->label('Rechazar')
                    ->icon('heroicon-o-x-circle')
                    ->color('danger')
                    ->visible(
                        fn (ClothingSubmission $record): bool =>
                            in_array(
                                $record->status,
                                [
                                    'pending',
                                    'import_failed',
                                ],
                                true
                            )
                    )
                    ->form([
                        Forms\Components\Textarea::make(
                            'reason'
                        )
                            ->label(
                                'Motivo del rechazo'
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
                                'rejected_at' =>
                                    now(),
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

    public function render(): View
    {
        return view(
            'livewire.filament.clothing-applications-table'
        );
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

    private static function pieceSummary(
        mixed $state
    ): string {
        if (! is_array($state)) {
            return 'Pendiente';
        }

        $pieces = is_array(
            $state['pieces'] ?? null
        )
            ? $state['pieces']
            : [];

        if ($pieces === []) {
            return 'Pendiente';
        }

        $rows = [];

        foreach ($pieces as $piece) {
            if (! is_array($piece)) {
                continue;
            }

            $code = (string) (
                $piece['code'] ?? '?'
            );

            $libraries = is_array(
                $piece['library_codes'] ?? null
            )
                ? $piece['library_codes']
                : [];

            $sourceIds = is_array(
                $piece['source_part_ids'] ?? null
            )
                ? $piece['source_part_ids']
                : (
                    is_array(
                        $piece['part_ids'] ?? null
                    )
                        ? $piece['part_ids']
                        : []
                );

            $biribiriIds = is_array(
                $piece['biribiri_part_ids'] ?? null
            )
                ? $piece['biribiri_part_ids']
                : [];

            $rows[] =
                $code .
                ' → ' .
                (
                    $libraries !== []
                        ? implode(', ', $libraries)
                        : 'library pendiente'
                ) .
                ' → origen [' .
                (
                    $sourceIds !== []
                        ? implode(', ', $sourceIds)
                        : 'pendiente'
                ) .
                '] → Biribiri [' .
                (
                    $biribiriIds !== []
                        ? implode(', ', $biribiriIds)
                        : 'pendiente'
                ) .
                ']';
        }

        return $rows !== []
            ? implode(' | ', $rows)
            : 'Pendiente';
    }
}
