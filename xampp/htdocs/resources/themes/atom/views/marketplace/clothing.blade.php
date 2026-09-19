<x-app-layout>
    @push('title', 'Marketplace - Ropa')

    <div
        class="col-span-12"
        x-data="{ tab: @js($initialTab) }"
    >
        <x-content.content-card
            icon="hotel-icon"
            classes="border dark:border-gray-900"
        >
            <x-slot:title>
                Marketplace · Ropa
            </x-slot:title>

            <x-slot:under-title>
                Tienda semanal, envíos de diseñadores y seguimiento de ropa creada por la comunidad.
            </x-slot:under-title>
            <div class="px-2 pt-3 text-sm">
                <a
                    href="{{ route('marketplace.index') }}"
                    class="inline-flex items-center rounded border border-gray-300 px-3 py-2 font-semibold text-gray-700 transition hover:bg-gray-100 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
                >
                    ← Marketplace
                </a>
            </div>

            @if (session('success'))
                <div class="mx-2 mt-3 rounded border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                    {{ session('success') }}
                </div>
            @endif

            @if (session('warning'))
                <div class="mx-2 mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    {{ session('warning') }}
                </div>
            @endif

            @if ($errors->any())
                <div class="mx-2 mt-3 rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
                    <div class="font-semibold">Revisa estos datos:</div>
                    <ul class="mt-1 list-disc pl-5">
                        @foreach ($errors->all() as $error)
                            <li>{{ $error }}</li>
                        @endforeach
                    </ul>
                </div>
            @endif

            @if (! $schemaReady)
                <div class="mx-2 mt-3 rounded border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    El portal ya está instalado en la web, pero las tablas de ropa todavía no se han creado. La subida se activará cuando ejecutemos las migraciones del importer.
                </div>
            @endif

            <div class="px-2 py-4 text-sm dark:text-gray-200">
                <div class="mb-5 flex flex-wrap gap-2">
                    <button
                        type="button"
                        @click="tab = 'market'"
                        :class="tab === 'market' ? 'ring-2 ring-inset ring-yellow-400' : ''"
                        class="rounded border-2 px-4 py-2 font-semibold transition"
                        style="background:#168eea;color:#fff;border-color:#51b4ff;"
                    >
                        Mercado
                    </button>

                    <button
                        type="button"
                        @click="tab = 'submit'"
                        :class="tab === 'submit' ? 'ring-2 ring-inset ring-yellow-400' : ''"
                        class="rounded border-2 px-4 py-2 font-semibold transition"
                        style="background:#eeb425;color:#fff;border-color:#e6a914;"
                    >
                        Enviar ropa
                    </button>

                    <button
                        type="button"
                        @click="tab = 'mine'"
                        :class="tab === 'mine' ? 'ring-2 ring-inset ring-yellow-400' : ''"
                        class="rounded border-2 px-4 py-2 font-semibold transition"
                        style="background:#22a866;color:#fff;border-color:#4fd68c;"
                    >
                        Mis envíos
                    </button>
                </div>

                                <section x-show="tab === 'market'" x-cloak>
                    @php($currentProducts = $marketProducts->where('status', 'active'))
                    @php($previousProducts = $marketProducts->where('status', 'previous'))

                    <div class="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 class="text-base font-bold">Tienda semanal de ropa</h3>
                            <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
                                La rotación cambia cada domingo a las 00:00 (Europe/Madrid). Comprar se conectará en P10; P9 deja listo el escaparate y la planificación.
                            </p>
                        </div>

                        <div class="rounded bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                            El furni comprado será canjeable y tradeable antes de usarlo.
                        </div>
                    </div>

                    @if ($currentProducts->isEmpty())
                        <div class="mt-4 rounded border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
                            No hay prendas activas en la rotación actual.
                        </div>
                    @else
                        <h4 class="mt-5 font-bold">Esta semana</h4>

                        <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                            @foreach ($currentProducts as $product)
                                <div class="rounded border border-gray-300 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
                                    <div class="flex gap-3">
                                        @if ($product->icon_url)
                                            <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded bg-gray-100 p-2 dark:bg-gray-800">
                                                <img
                                                    src="{{ $product->icon_url }}"
                                                    alt=""
                                                    class="max-h-12 max-w-12"
                                                >
                                            </div>
                                        @endif

                                        <div class="min-w-0">
                                            <div class="font-bold">{{ $product->name }}</div>

                                            @if ($product->tag)
                                                <div class="mt-1 text-xs text-gray-500">
                                                    #{{ ltrim($product->tag, '#') }}
                                                </div>
                                            @endif

                                            <div class="mt-1 text-xs text-gray-500">
                                                {{ $product->clothing_submission_id ? 'Diseñador' : 'Legacy Biribiri' }}
                                                · {{ $product->creator_username }}
                                            </div>
                                        </div>
                                    </div>

                                    <div class="mt-4 flex items-end justify-between gap-3">
                                        <div>
                                            <div class="text-lg font-bold">
                                                {{ number_format($product->unit_price, 0, ',', '.') }} créditos
                                            </div>

                                            <div class="mt-1 text-xs text-gray-500">
                                                @if ($product->stock_mode === 'unlimited')
                                                    Stock ilimitado
                                                @else
                                                    Quedan {{ number_format((int) $product->remaining_stock, 0, ',', '.') }} de {{ number_format((int) $product->stock_total, 0, ',', '.') }}
                                                @endif
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            disabled
                                            class="cursor-not-allowed rounded bg-gray-200 px-3 py-2 text-xs font-bold text-gray-500 dark:bg-gray-800"
                                            title="La compra se conecta en P10"
                                        >
                                            Comprar · P10
                                        </button>
                                    </div>

                                    @if ($product->window_end_display)
                                        <div class="mt-3 text-[11px] text-gray-400">
                                            Rotación actual hasta {{ $product->window_end_display }}.
                                        </div>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    @endif

                    @if ($previousProducts->isNotEmpty())
                        <div class="mt-8 border-t border-gray-200 pt-5 dark:border-gray-800">
                            <h4 class="font-bold">Ropa de semanas anteriores</h4>
                            <p class="mt-1 text-xs text-gray-500">
                                Solo permanecen aquí las prendas limitadas con unidades disponibles.
                            </p>

                            <div class="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                @foreach ($previousProducts as $product)
                                    <div class="rounded border border-gray-300 p-4 dark:border-gray-700">
                                        <div class="flex gap-3">
                                            @if ($product->icon_url)
                                                <div class="flex h-14 w-14 shrink-0 items-center justify-center rounded bg-gray-100 p-2 dark:bg-gray-800">
                                                    <img
                                                        src="{{ $product->icon_url }}"
                                                        alt=""
                                                        class="max-h-10 max-w-10"
                                                    >
                                                </div>
                                            @endif

                                            <div>
                                                <div class="font-bold">{{ $product->name }}</div>
                                                <div class="mt-1 text-xs text-gray-500">
                                                    {{ number_format($product->unit_price, 0, ',', '.') }} créditos
                                                    · quedan {{ number_format((int) $product->remaining_stock, 0, ',', '.') }}
                                                </div>
                                            </div>
                                        </div>

                                        <div class="mt-3 rounded bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
                                            Disponible hasta agotar existencias.
                                        </div>
                                    </div>
                                @endforeach
                            </div>
                        </div>
                    @endif
                </section>

                <section x-show="tab === 'submit'" x-cloak>
                    <div class="grid grid-cols-1 gap-5 lg:grid-cols-2">
                        <div class="rounded border border-gray-300 p-4 dark:border-gray-700">
                            <h3 class="text-base font-bold">Cómo exportar</h3>
                            <p class="mt-2 text-sm">
                                Usa ClothingBuilder/FurniBuilder y exporta como <strong>Flash</strong>. Sube el RAR tal como sale de tu flujo de trabajo.
                            </p>

                            <div class="mt-4 rounded border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-700 dark:text-emerald-300">
                                <strong>No necesitas ningún ID de Biribiri.</strong>
                                Sube el RAR tal como salga de ClothingBuilder o tal como exista en Hobba/u otro origen. Los Part IDs del paquete se consideran IDs de origen: Biribiri asigna IDs nuevos automáticamente y sustituye las referencias durante la conversión. <code>DEFINE_ID</code> también se sustituye por el Figure Set ID final de Biribiri.
                            </div>

                            <div class="mt-4 text-xs text-gray-500 dark:text-gray-400">
                                El paquete debe incluir los SWF y los datos figuremap/figuredata que genera el builder. Para un set, el importer detectará varias prendas y las enlazará a un único furni canjeable.
                            </div>
                        </div>

                        <div class="rounded border border-gray-300 p-4 dark:border-gray-700">
                            <h3 class="text-base font-bold">Validación automática</h3>
                            <p class="mt-2 text-sm">
                                Al enviar el RAR se analiza inmediatamente en staging: estructura, SWF, códigos técnicos, categorías, colisiones y piezas del paquete.
                            </p>

                            <div class="mt-4 grid grid-cols-2 gap-3 text-center text-xs">
                                <div class="rounded bg-gray-100 p-3 dark:bg-gray-800">
                                    <div class="text-lg font-bold">50 MB</div>
                                    <div class="text-gray-500">máximo por RAR</div>
                                </div>
                                <div class="rounded bg-gray-100 p-3 dark:bg-gray-800">
                                    <div class="text-lg font-bold">Sin límite</div><div class="text-gray-500">envíos pendientes</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    @if (! $canSubmit)
                        <div class="mt-5 rounded border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
                            Para enviar ropa necesitas que uno de tus personajes tenga el cargo <strong>Diseñador de Ropa</strong>.
                        </div>
                    @elseif (! $schemaReady)
                        <div class="mt-5 rounded border border-gray-300 p-4 text-sm text-gray-500 dark:border-gray-700">
                            La interfaz está lista. Falta ejecutar las migraciones del importer para habilitar el envío.
                        </div>
                    @else


                        <form
                            method="POST"
                            action="{{ route('marketplace.clothing.store') }}"
                            enctype="multipart/form-data"
                            class="mt-5 rounded border border-gray-300 p-4 dark:border-gray-700"
                        >
                            @csrf

                            <h3 class="text-base font-bold">Datos del envío</h3>

                            @if ($isStaffBypass)
                                <div class="mt-3 rounded bg-blue-500/10 p-3 text-xs text-blue-600 dark:text-blue-300">
                                    Acceso STAFF activo: puedes usar cualquiera de tus personajes para realizar pruebas del portal.
                                </div>
                            @endif

                            <div class="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                <div>
                                    <label class="font-semibold">Personaje diseñador</label>
                                    <select
                                        name="creator_user_id"
                                        required
                                        class="mt-2 h-12 w-full rounded border-4 border-gray-200 px-3 dark:border-gray-700 dark:bg-gray-800 focus:border-[#eeb425] focus:ring-0"
                                    >
                                        @foreach ($characters as $character)
                                            <option
                                                value="{{ $character->id }}"
                                                @selected((string) old('creator_user_id') === (string) $character->id)
                                            >
                                                {{ $character->username }}
                                                @if ($character->is_primary) · principal @endif
                                            </option>
                                        @endforeach
                                    </select>
                                </div>

                                <div>
                                    <label class="font-semibold">Nombre público</label>
                                    <input
                                        name="clothing_name"
                                        value="{{ old('clothing_name') }}"
                                        maxlength="80"
                                        required
                                        class="mt-2 h-12 w-full rounded border-4 border-gray-200 px-3 dark:border-gray-700 dark:bg-gray-800 focus:border-[#eeb425] focus:ring-0"
                                        placeholder="Ej. Top Bustier"
                                    >
                                </div>

                                <div>
                                    <label class="font-semibold">Tag</label>
                                    <input
                                        name="tag"
                                        value="{{ old('tag') }}"
                                        maxlength="64"
                                        required
                                        class="mt-2 h-12 w-full rounded border-4 border-gray-200 px-3 dark:border-gray-700 dark:bg-gray-800 focus:border-[#eeb425] focus:ring-0"
                                        placeholder="Ej. goth"
                                    >
                                    <p class="mt-1 text-xs text-gray-500">
                                        No hace falta escribir #.
                                    </p>
                                </div>

                                <div>
                                    <label class="font-semibold">Sección del Armario</label>
                                    <select
                                        name="requested_category"
                                        required
                                        class="mt-2 h-12 w-full rounded border-4 border-gray-200 px-3 dark:border-gray-700 dark:bg-gray-800 focus:border-[#eeb425] focus:ring-0"
                                    >
                                        <option value="">Selecciona una sección</option>
                                        @foreach ($categories as $code => $label)
                                            <option
                                                value="{{ $code }}"
                                                @selected(old('requested_category') === $code)
                                            >
                                                {{ $label }} · {{ $code }}
                                            </option>
                                        @endforeach
                                    </select>
                                    <p class="mt-1 text-xs text-gray-500">
                                        Es una propuesta. El staff puede corregirla al revisar.
                                    </p>
                                </div>
                            </div>

                            <div class="mt-4 rounded border border-gray-300 bg-gray-50 p-3 text-sm dark:border-gray-700 dark:bg-gray-800/60">
                                <strong>Destino inicial:</strong> Tienda semanal web.
                                El staff puede cambiarlo en Solicitudes → Ropa a Biri Club, Evento, Pase, Tiempo online o distribución STAFF.
                            </div>

                            <div class="mt-4">
                                <label class="font-semibold">Comentario para el staff · opcional</label>
                                <textarea
                                    name="designer_comment"
                                    maxlength="500"
                                    rows="3"
                                    class="mt-2 w-full rounded border-4 border-gray-200 px-3 py-2 dark:border-gray-700 dark:bg-gray-800 focus:border-[#eeb425] focus:ring-0"
                                    placeholder="Ej. Incluye variante femenina; el maniquí está dentro de la carpeta Maniquí."
                                >{{ old('designer_comment') }}</textarea>
                            </div>

                            <div class="mt-4">
                                <label class="font-semibold">RAR de ClothingBuilder/FurniBuilder</label>
                                <input
                                    type="file"
                                    name="package"
                                    accept=".rar,application/vnd.rar,application/x-rar-compressed"
                                    required
                                    class="mt-2 block w-full rounded border border-gray-300 p-2 dark:border-gray-700 dark:bg-gray-800"
                                >
                                <p class="mt-1 text-xs text-gray-500">
                                    RAR únicamente · máximo 50 MB · no renombres códigos técnicos dentro del paquete.
                                </p>
                            </div>

                            <button
                                type="submit"
                                class="mt-5 w-full rounded border-2 p-3 font-bold transition"
                                style="background:#eeb425;color:#fff;border-color:#facc15;"
                            >
                                Enviar ropa a revisión
                            </button>
                        </form>
                    @endif
                </section>

                <section x-show="tab === 'mine'" x-cloak>
                    <div class="flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 class="text-base font-bold">Mis envíos de ropa</h3>
                            <p class="mt-1 text-xs text-gray-500">
                                Se muestra el análisis automático y el estado de moderación de cada RAR.
                            </p>
                        </div>

                        <div class="text-xs text-gray-500">
                            Pendientes: {{ $pendingCount }}
                        </div>
                    </div>

                    @if ($submissions->isEmpty())
                        <div class="mt-4 rounded border border-dashed border-gray-300 p-8 text-center text-gray-500 dark:border-gray-700">
                            Todavía no has enviado ropa.
                        </div>
                    @else
                        <div class="mt-4 space-y-3">
                            @foreach ($submissions as $submission)
                                <div class="rounded border border-gray-300 p-4 dark:border-gray-700">
                                    <div class="flex flex-wrap items-start justify-between gap-3">
                                        <div>
                                            <div class="font-bold">{{ $submission->clothing_name }}</div>
                                            <div class="mt-1 text-xs text-gray-500">
                                                {{ $submission->original_filename }} · {{ $submission->created_at_display }}
                                            </div>
                                            <div class="mt-1 text-xs text-gray-500">
                                                Creador: {{ $submission->creator_username }} · #{{ $submission->tag }}
                                            </div>
                                        </div>

                                        <div class="flex flex-wrap gap-2 text-xs">
                                            <span class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">
                                                {{ $submission->status_label }}
                                            </span>
                                            <span class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">
                                                {{ $submission->technical_label }}
                                            </span>
                                            @if ($submission->piece_count)
                                                <span class="rounded bg-gray-100 px-2 py-1 dark:bg-gray-800">
                                                    {{ $submission->package_kind === 'set' ? 'Set' : ($submission->package_kind === 'batch' ? 'Lote' : 'Single') }} · {{ $submission->piece_count }} pieza{{ $submission->piece_count === 1 ? '' : 's' }}
                                                </span>
                                            @endif
                                        </div>
                                    </div>

                                    <div class="mt-3 grid grid-cols-1 gap-2 text-xs md:grid-cols-2">
                                        <div class="rounded bg-gray-50 p-2 dark:bg-gray-800/60">
                                            Sección pedida:
                                            <strong>{{ $categories[$submission->requested_category] ?? $submission->requested_category ?? '—' }}</strong>
                                        </div>
                                        <div class="rounded bg-gray-50 p-2 dark:bg-gray-800/60">
                                            Código detectado:
                                            <strong>{{ $submission->clothing_code ?: 'pendiente' }}</strong>
                                        </div>
                                    </div>

                                    @if ($submission->designer_comment)
                                        <div class="mt-3 rounded bg-blue-500/10 p-3 text-xs text-blue-700 dark:text-blue-300">
                                            <strong>Tu comentario:</strong> {{ $submission->designer_comment }}
                                        </div>
                                    @endif

                                    @if (! empty($submission->technical_warnings))
                                        <div class="mt-3 rounded bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                                            <strong>Avisos técnicos:</strong>
                                            <ul class="mt-1 list-disc pl-5">
                                                @foreach ($submission->technical_warnings as $warning)
                                                    <li>{{ $warning }}</li>
                                                @endforeach
                                            </ul>
                                        </div>
                                    @endif

                                    @if (! empty($submission->technical_errors))
                                        <div class="mt-3 rounded bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                                            <strong>Errores técnicos:</strong>
                                            <ul class="mt-1 list-disc pl-5">
                                                @foreach ($submission->technical_errors as $error)
                                                    <li>{{ $error }}</li>
                                                @endforeach
                                            </ul>
                                        </div>
                                    @endif

                                    @php($technicalPieces = is_array($submission->piece_manifest) ? ($submission->piece_manifest['pieces'] ?? []) : [])

                                    @if (! empty($technicalPieces))
                                        <details class="mt-3 rounded border border-gray-300 p-3 text-xs dark:border-gray-700">
                                            <summary class="cursor-pointer font-semibold">
                                                Mapa técnico automático
                                            </summary>

                                            <div class="mt-2 space-y-2">
                                                @foreach ($technicalPieces as $piece)
                                                    @php($sourceIds = $piece['source_part_ids'] ?? $piece['part_ids'] ?? [])
                                                    @php($biribiriIds = $piece['biribiri_part_ids'] ?? [])

                                                    <div class="rounded bg-gray-50 p-2 dark:bg-gray-800/60">
                                                        <div>
                                                            <strong>{{ $piece['code'] ?? 'Prenda' }}</strong>
                                                            · {{ $categories[$piece['category'] ?? ''] ?? ($piece['category'] ?? '—') }}
                                                        </div>

                                                        <div class="mt-1 text-gray-500">
                                                            Library:
                                                            {{ ! empty($piece['library_codes']) ? implode(', ', $piece['library_codes']) : 'pendiente' }}
                                                        </div>

                                                        <div class="mt-1 font-mono text-gray-500">
                                                            Origen: {{ ! empty($sourceIds) ? implode(', ', $sourceIds) : 'pendiente' }}
                                                            → Biribiri: {{ ! empty($biribiriIds) ? implode(', ', $biribiriIds) : 'pendiente' }}
                                                        </div>
                                                    </div>
                                                @endforeach
                                            </div>
                                        </details>
                                    @endif

                                    @if ($submission->moderation_reason)
                                        <div class="mt-3 rounded bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">
                                            <strong>Moderación:</strong> {{ $submission->moderation_reason }}
                                        </div>
                                    @endif
                                </div>
                            @endforeach
                        </div>
                    @endif
                </section>
            </div>
        </x-content.content-card>
    </div>
</x-app-layout>