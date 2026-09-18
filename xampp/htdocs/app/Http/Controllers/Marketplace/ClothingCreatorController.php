<?php

namespace App\Http\Controllers\Marketplace;

use App\Http\Controllers\Controller;
use App\Models\ClothingProduct;
use App\Models\ClothingSubmission;
use App\Services\Clothing\ClothingDesignerEligibilityService;
use App\Services\Clothing\ClothingStagingService;
use Carbon\Carbon;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Throwable;

class ClothingCreatorController extends Controller
{
    private const MAX_PENDING = 3;
    private const MAX_ARCHIVE_KB = 51200;

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

    public function index(
        Request $request,
        ClothingDesignerEligibilityService $eligibility
    ): View {
        $accountId = $this->accountId();
        $authenticatedUserId = (int) Auth::id();

        $schemaReady =
            Schema::hasTable(
                'clothing_submissions'
            );

        $characters =
            $eligibility->creatorCharacters(
                $accountId,
                $authenticatedUserId
            );

        $canSubmit =
            $eligibility->canSubmit(
                $accountId,
                $authenticatedUserId
            );

        $isStaffBypass =
            $eligibility->isStaffUser(
                $authenticatedUserId
            );

        $submissions = collect();
        $pendingCount = 0;

        if ($schemaReady) {
            $submissions =
                ClothingSubmission::query()
                    ->where(
                        'account_id',
                        $accountId
                    )
                    ->latest('created_at')
                    ->limit(30)
                    ->get();

            $userIds = $submissions
                ->pluck('creator_user_id')
                ->filter()
                ->map(
                    static fn ($value): int =>
                        (int) $value
                )
                ->unique()
                ->values();

            $usernames = $userIds->isEmpty()
                ? collect()
                : DB::table('users')
                    ->whereIn('id', $userIds)
                    ->pluck('username', 'id');

            foreach ($submissions as $submission) {
                $submission->creator_username =
                    $submission->creator_user_id
                        ? (
                            $usernames[
                                (int)
                                $submission->creator_user_id
                            ] ??
                            (
                                '#' .
                                (int)
                                $submission->creator_user_id
                            )
                        )
                        : 'STAFF';

                $submission->created_at_display =
                    Carbon::parse(
                        (string)
                        $submission->created_at,
                        'UTC'
                    )
                        ->setTimezone(
                            'Europe/Madrid'
                        )
                        ->format('d/m/Y H:i');

                $submission->status_label =
                    $this->statusLabel(
                        (string)
                        $submission->status
                    );

                $submission->technical_label =
                    $this->technicalLabel(
                        (string)
                        $submission->technical_status
                    );

                $report = is_array(
                    $submission->technical_report
                )
                    ? $submission->technical_report
                    : [];

                $submission->technical_errors =
                    array_values(
                        array_filter(
                            is_array(
                                $report['errors'] ?? null
                            )
                                ? $report['errors']
                                : [],
                            'is_string'
                        )
                    );

                $submission->technical_warnings =
                    array_values(
                        array_filter(
                            is_array(
                                $report['warnings'] ?? null
                            )
                                ? $report['warnings']
                                : [],
                            'is_string'
                        )
                    );
            }

            $pendingCount =
                ClothingSubmission::query()
                    ->where(
                        'account_id',
                        $accountId
                    )
                    ->where(
                        'status',
                        'pending'
                    )
                    ->count();
        }

        $marketProducts = collect();

        if (
            Schema::hasTable(
                'clothing_products'
            )
        ) {
            $marketProducts =
                ClothingProduct::query()
                    ->where(
                        'web_visible',
                        true
                    )
                    ->whereIn(
                        'status',
                        [
                            'active',
                            'previous',
                        ]
                    )
                    ->latest('created_at')
                    ->limit(24)
                    ->get();
        }


        $requestedTab = (string)
            $request->query(
                'tab',
                'market'
            );

        if (
            ! in_array(
                $requestedTab,
                [
                    'market',
                    'submit',
                    'mine',
                ],
                true
            )
        ) {
            $requestedTab = 'market';
        }

        return view(
            'marketplace.clothing',
            [
                'schemaReady' =>
                    $schemaReady,
                'characters' =>
                    $characters,
                'canSubmit' =>
                    $canSubmit,
                'isStaffBypass' =>
                    $isStaffBypass,
                'submissions' =>
                    $submissions,
                'pendingCount' =>
                    $pendingCount,
                'maxPending' =>
                    self::MAX_PENDING,
                'categories' =>
                    self::CATEGORIES,
                'marketProducts' =>
                    $marketProducts,

                'initialTab' =>
                    $requestedTab,
            ]
        );
    }


    public function store(
        Request $request,
        ClothingDesignerEligibilityService $eligibility,
        ClothingStagingService $staging
    ): RedirectResponse {
        $accountId = $this->accountId();
        $authenticatedUserId = (int) Auth::id();

        if (
            ! Schema::hasTable(
                'clothing_submissions'
            )
        ) {
            throw ValidationException::withMessages([
                'package' =>
                    'El portal de ropa todavía no está inicializado en la base de datos.',
            ]);
        }

        if (
            ! $eligibility->canSubmit(
                $accountId,
                $authenticatedUserId
            )
        ) {
            abort(
                403,
                'Solo los Diseñadores de Ropa pueden enviar paquetes.'
            );
        }

        $validated = $request->validate([
            'creator_user_id' => [
                'required',
                'integer',
            ],
            'clothing_name' => [
                'required',
                'string',
                'min:2',
                'max:80',
            ],
            'tag' => [
                'required',
                'string',
                'min:1',
                'max:64',
            ],
            'requested_category' => [
                'required',
                'string',
                'in:' .
                    implode(
                        ',',
                        array_keys(
                            self::CATEGORIES
                        )
                    ),
            ],
            'designer_comment' => [
                'nullable',
                'string',
                'max:500',
            ],
            'package' => [
                'required',
                'file',
                'max:' .
                    self::MAX_ARCHIVE_KB,
            ],
        ], [
            'package.required' =>
                'Debes seleccionar el RAR exportado por ClothingBuilder/FurniBuilder.',
            'package.max' =>
                'El paquete no puede superar 50 MB.',
            'clothing_name.required' =>
                'Indica el nombre público de la ropa.',
            'tag.required' =>
                'Indica al menos un tag para la ropa.',
            'requested_category.required' =>
                'Selecciona la sección del Armario.',
        ]);

        $creatorUserId =
            (int)
            $validated['creator_user_id'];

        if (
            ! $eligibility->canUseCreator(
                $accountId,
                $authenticatedUserId,
                $creatorUserId
            )
        ) {
            throw ValidationException::withMessages([
                'creator_user_id' =>
                    'Ese personaje no puede presentar ropa para esta cuenta.',
            ]);
        }

        $pending =
            ClothingSubmission::query()
                ->where(
                    'account_id',
                    $accountId
                )
                ->where(
                    'status',
                    'pending'
                )
                ->count();

        if ($pending >= self::MAX_PENDING) {
            throw ValidationException::withMessages([
                'package' =>
                    'Ya tienes el máximo de ' .
                    self::MAX_PENDING .
                    ' solicitudes pendientes de revisión.',
            ]);
        }

        $archive = $validated['package'];

        if (
            strtolower(
                (string)
                $archive->getClientOriginalExtension()
            ) !== 'rar'
        ) {
            throw ValidationException::withMessages([
                'package' =>
                    'El paquete debe ser un archivo .rar.',
            ]);
        }

        $this->assertRarSignature(
            $archive->getRealPath()
        );

        $token = (string) Str::uuid();

        $folder = sprintf(
            'clothing_importer/uploads/%d/%s',
            $accountId,
            $token
        );

        $sourcePath =
            Storage::disk('local')
                ->putFileAs(
                    $folder,
                    $archive,
                    'package.rar'
                );

        if (
            ! is_string($sourcePath) ||
            $sourcePath === ''
        ) {
            throw ValidationException::withMessages([
                'package' =>
                    'No se pudo guardar el paquete.',
            ]);
        }

        $submission = null;

        try {
            $submission =
                ClothingSubmission::query()
                    ->create([
                        'account_id' =>
                            $accountId,
                        'creator_user_id' =>
                            $creatorUserId,
                        'source_mode' =>
                            'designer',
                        'source_path' =>
                            $sourcePath,
                        'original_filename' =>
                            mb_substr(
                                (string)
                                $archive
                                    ->getClientOriginalName(),
                                0,
                                255
                            ),
                        'clothing_name' =>
                            trim(
                                (string)
                                $validated[
                                    'clothing_name'
                                ]
                            ),
                        'tag' =>
                            ltrim(
                                trim(
                                    (string)
                                    $validated['tag']
                                ),
                                '#'
                            ),
                        'designer_comment' =>
                            trim(
                                (string)
                                ($validated[
                                    'designer_comment'
                                ] ?? '')
                            ) ?: null,
                        'requested_category' =>
                            (string)
                            $validated[
                                'requested_category'
                            ],
                        'final_category' =>
                            null,
                        'intended_acquisition_method' =>
                            'weekly_store',
                        'status' =>
                            'pending',
                        'technical_status' =>
                            'not_checked',
                    ]);
        } catch (Throwable $exception) {
            Storage::disk('local')
                ->deleteDirectory(
                    $folder
                );

            throw $exception;
        }

        try {
            $report = $staging->stage(
                $submission,
                Storage::disk('local')
                    ->path(
                        $sourcePath
                    )
            );

            if (! ($report['valid'] ?? false)) {
                $submission->forceFill([
                    'status' =>
                        'import_failed',
                ])->save();

                return to_route(
                    'marketplace.clothing.index',
                    [
                        'tab' => 'mine',
                    ]
                )->with(
                    'warning',
                    'El paquete se ha guardado, pero el análisis técnico encontró errores. Revísalos en Mis envíos y corrige el RAR antes de volver a enviarlo.'
                );
            }
        } catch (Throwable $exception) {
            report($exception);

            $submission->refresh();

            $submission->forceFill([
                'status' =>
                    'import_failed',
            ])->save();

            return to_route(
                'marketplace.clothing.index',
                [
                    'tab' => 'mine',
                ]
            )->with(
                'warning',
                'El RAR se ha recibido, pero no ha superado el análisis técnico. El detalle queda guardado en Mis envíos para revisión.'
            );
        }

        return to_route(
            'marketplace.clothing.index',
            [
                'tab' => 'mine',
            ]
        )->with(
            'success',
            'Ropa enviada a revisión. El paquete técnico ha pasado la validación automática inicial.'
        );
    }

    private function accountId(): int
    {
        $accountId = DB::table(
            'account_characters'
        )
            ->where(
                'user_id',
                Auth::id()
            )
            ->value(
                'account_id'
            );

        if ($accountId === null) {
            abort(
                403,
                'No se pudo resolver la cuenta del personaje.'
            );
        }

        return (int) $accountId;
    }

    private function assertRarSignature(
        string $path
    ): void {
        $handle = @fopen(
            $path,
            'rb'
        );

        if (! is_resource($handle)) {
            throw ValidationException::withMessages([
                'package' =>
                    'No se pudo leer el archivo subido.',
            ]);
        }

        try {
            $header = (string)
                fread(
                    $handle,
                    8
                );
        } finally {
            fclose($handle);
        }

        $rar4 =
            "Rar!\x1A\x07\x00";

        $rar5 =
            "Rar!\x1A\x07\x01\x00";

        if (
            substr(
                $header,
                0,
                strlen($rar4)
            ) !== $rar4 &&
            substr(
                $header,
                0,
                strlen($rar5)
            ) !== $rar5
        ) {
            throw ValidationException::withMessages([
                'package' =>
                    'El archivo no tiene una firma RAR válida.',
            ]);
        }
    }

    private function statusLabel(
        string $status
    ): string {
        return match ($status) {
            'pending' => 'Pendiente de staff',
            'approved' => 'Aprobada',
            'rejected' => 'Rechazada',
            'import_failed' => 'Error técnico',
            'importing' => 'Importando',
            default => $status,
        };
    }

    private function technicalLabel(
        string $status
    ): string {
        return match ($status) {
            'not_checked' => 'Sin comprobar',
            'checking' => 'Analizando',
            'valid' => 'Validación OK',
            'invalid' => 'Con errores',
            default => $status,
        };
    }
}