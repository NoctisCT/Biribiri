@php($previewService = app(\App\Services\Clothing\ClothingPreviewService::class))
@php($designer = $record->creator_user_id ? \App\Models\User::query()->find($record->creator_user_id) : null)
@php($designerName = $designer?->username ?? ($record->creator_user_id ? ('Usuario #' . $record->creator_user_id) : 'STAFF'))
@php($categoryCode = $record->final_category ?: $record->requested_category)
@php($category = [
    'hd' => 'Cara', 'hr' => 'Pelo', 'bn' => 'Flequillo', 'ha' => 'Sombrero',
    'he' => 'Accesorio de cabeza', 'er' => 'Pendientes', 'mu' => 'Maquillaje',
    'fa' => 'Accesorio facial', 'be' => 'Barba', 'ea' => 'Gafas',
    'ch' => 'Camiseta', 'cp' => 'Chaqueta', 'cc' => 'Torso',
    'ca' => 'Accesorio de pecho', 'nk' => 'Collar', 'gl' => 'Guantes',
    'wr' => 'Muñequera', 'ba' => 'Bolso', 'bp' => 'Mochila',
    'lg' => 'Pantalón', 'sh' => 'Zapatos', 'wa' => 'Cintura',
    'pe' => 'Mascota', 'ce' => 'Capa', 'wi' => 'Alas', 'tl' => 'Cola',
][$categoryCode] ?? ($categoryCode ?: '—'))
@php($destination = [
    'weekly_store' => 'Tienda semanal',
    'biri_club' => 'Biri Club',
    'battle_pass' => 'Pase',
    'online_time' => 'Tiempo online',
    'event' => 'Evento',
    'staff' => 'STAFF',
][$record->intended_acquisition_method] ?? $record->intended_acquisition_method)
@php($displayTag = trim((string) $record->tag))
@php($displayTag = $displayTag === '' ? null : (str_starts_with($displayTag, '#') ? $displayTag : ('#' . $displayTag)))
@php($figures = is_array($preview['figures'] ?? null) ? $preview['figures'] : [])
@php($furniture = is_array($preview['furniture'] ?? null) ? $preview['furniture'] : [])
@php($avatar = is_array($preview['avatar'] ?? null) ? $preview['avatar'] : [])
@php($avatarRequestId = 'clothing-preview-' . $record->id . '-' . substr(sha1((string) ($preview['generated_at'] ?? microtime(true))), 0, 12))
@php($figureDataUrl = route('clothing.preview.figure-data', ['submission' => $record->id], false))
@php($figureMapUrl = route('clothing.preview.figure-map', ['submission' => $record->id], false))
@php($figureAssetUrl = '/housekeeping/clothing-preview/' . $record->id . '/figure/%libname%.nitro')
@php($bridgeSrc = '/dist/index.html?avatar-bridge=1&preview-figuredata=' . rawurlencode($figureDataUrl) . '&preview-figuremap=' . rawurlencode($figureMapUrl) . '&preview-asset=' . rawurlencode($figureAssetUrl))

<div class="space-y-4">
    <div class="flex flex-wrap items-center gap-2 text-sm">
        <span class="rounded-full bg-gray-100 px-3 py-1 font-semibold dark:bg-gray-800">
            {{ $record->clothing_name }}
        </span>

        @if ($displayTag)
            <span class="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
                {{ $displayTag }}
            </span>
        @endif

        <span class="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
            {{ $designerName }}
        </span>

        <span class="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
            {{ $category }}
        </span>

        <span class="rounded-full bg-gray-100 px-3 py-1 dark:bg-gray-800">
            {{ $destination }}
        </span>
    </div>

    @if (! empty($avatar['figure']))
        @php($avatarVariants = array_values(is_array($avatar['variants'] ?? null) ? $avatar['variants'] : []))
        @php($defaultVariant = (string) ($avatar['default_variant'] ?? ($avatarVariants[0]['key'] ?? 'default')))
        @php($availableGenders = array_values(is_array($avatar['available_genders'] ?? null) ? $avatar['available_genders'] : [($avatar['gender'] ?? 'M')]))
        @php($defaultGender = (string) ($avatar['gender'] ?? ($availableGenders[0] ?? 'M')))

        {{-- BIRIBIRI_QA_P1N_CLEAN --}}
        {{-- BIRIBIRI_QA_ALPINE_MESSAGE_P1R --}}
        {{-- BIRIBIRI_QA_USABILITY_P1S --}}
        <style>
            .biri-qa-layout {
                display: grid !important;
                gap: 1rem !important;
                margin-top: 1rem !important;
            }

            .biri-qa-stage {
                position: relative !important;
                display: flex !important;
                min-height: 250px !important;
                align-items: flex-end !important;
                justify-content: center !important;
                overflow: hidden !important;
                border: 1px solid rgb(55 65 81) !important;
                border-radius: .5rem !important;
                background: rgba(17, 24, 39, .38) !important;
                padding: 10px !important;
            }

            .biri-qa-stage img {
                display: block !important;
                width: auto !important;
                height: auto !important;
                max-width: 100% !important;
                max-height: 220px !important;
                object-fit: contain !important;
                image-rendering: auto !important;
                transform: none !important;
                transform-origin: center bottom;
            }

            .biri-qa-direction-grid {
                display: grid !important;
                grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
                gap: .5rem !important;
            }

            .biri-qa-posture-grid {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                gap: .5rem !important;
            }

            .biri-qa-direction-grid > button,
            .biri-qa-posture-grid > button {
                width: 100% !important;
            }

            @media (min-width: 1100px) {
                .biri-qa-layout {
                    grid-template-columns: minmax(320px, 520px) minmax(310px, 420px) !important;
                    align-items: start !important;
                    justify-content: start !important;
                }
            }

            @media (max-width: 700px) {
                .biri-qa-direction-grid {
                    grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
                }

                .biri-qa-posture-grid {
                    grid-template-columns: 1fr !important;
                }

                .biri-qa-stage {
                    min-height: 230px !important;
                }
            }
        </style>

        <section
            class="rounded-xl border border-gray-200 p-4 dark:border-gray-700"
            x-data="{
                ready: false,
                hasRendered: false,
                failed: false,
                failureMessage: '',
                bridgeReady: false,
                requestIdBase: @js($avatarRequestId),
                currentRequestId: null,
                variants: @js($avatarVariants),
                selectedKey: @js($defaultVariant),
                genders: @js($availableGenders),
                selectedGender: @js($defaultGender),
                colorSelections: {},
                direction: 2,
                posture: 'std',
                gesture: '',
                action: '',
                frame: 0,
                playing: false,
                timer: null,
                renderTimeout: null,
                bridgeTimeout: null,

                get selectedVariant() {
                    return this.variants.find(
                        (variant) =>
                            String(variant.key) ===
                            String(this.selectedKey)
                    ) || this.variants[0] || null;
                },

                get selectedFigure() {
                    const variant = this.selectedVariant;

                    if (!variant) return '';

                    let figure = '';

                    if (
                        variant.figures &&
                        variant.figures[this.selectedGender]
                    ) {
                        figure =
                            variant.figures[
                                this.selectedGender
                            ];
                    } else {
                        figure =
                            variant.figure || '';
                    }

                    return this.applySelectedColors(
                        figure,
                        variant
                    );
                },

                get selectedColorGroups() {
                    const variant =
                        this.selectedVariant;

                    return (
                        variant &&
                        Array.isArray(
                            variant.color_groups
                        )
                    )
                        ? variant.color_groups
                        : [];
                },

                get hasColorOptions() {
                    return this.selectedColorGroups.some(
                        (group) =>
                            Array.isArray(
                                group.slots
                            ) &&
                            group.slots.length > 0
                    );
                },

                colorGroupKey(group) {
                    return String(
                        group &&
                        (
                            group.key ||
                            `${group.category}:${group.set_id}`
                        )
                    );
                },

                resetColorsForSelectedVariant() {
                    const next = {};

                    for (
                        const group
                        of this.selectedColorGroups
                    ) {
                        const defaults =
                            Array.isArray(
                                group.default_colors
                            )
                                ? group.default_colors
                                : [];

                        next[
                            this.colorGroupKey(
                                group
                            )
                        ] = [
                            ...defaults
                        ];
                    }

                    this.colorSelections =
                        next;
                },

                selectedColorId(
                    group,
                    slotIndex
                ) {
                    const key =
                        this.colorGroupKey(
                            group
                        );

                    const selected =
                        this.colorSelections[
                            key
                        ] || [];

                    const index =
                        Math.max(
                            0,
                            Number(slotIndex) - 1
                        );

                    return selected[
                        index
                    ];
                },

                selectColor(
                    group,
                    slotIndex,
                    colorId
                ) {
                    const key =
                        this.colorGroupKey(
                            group
                        );

                    const next =
                        [
                            ...(
                                this.colorSelections[
                                    key
                                ] || []
                            )
                        ];

                    const index =
                        Math.max(
                            0,
                            Number(slotIndex) - 1
                        );

                    next[index] =
                        Number(colorId);

                    this.colorSelections = {
                        ...this.colorSelections,
                        [key]: next
                    };

                    this.frame = 0;
                    this.render();
                },

                applySelectedColors(
                    figure,
                    variant
                ) {
                    const groups =
                        (
                            variant &&
                            Array.isArray(
                                variant.color_groups
                            )
                        )
                            ? variant.color_groups
                            : [];

                    const segments =
                        String(
                            figure || ''
                        )
                            .split('.')
                            .filter(
                                (segment) =>
                                    segment !== ''
                            );

                    for (
                        const group
                        of groups
                    ) {
                        if (
                            !Array.isArray(
                                group.slots
                            ) ||
                            group.slots.length === 0
                        ) {
                            continue;
                        }

                        const key =
                            this.colorGroupKey(
                                group
                            );

                        const selected =
                            this.colorSelections[
                                key
                            ] ||
                            group.default_colors ||
                            [];

                        if (
                            !Array.isArray(
                                selected
                            ) ||
                            selected.length === 0
                        ) {
                            continue;
                        }

                        const category =
                            String(
                                group.category || ''
                            ).toLowerCase();

                        const setId =
                            String(
                                group.set_id || ''
                            );

                        const replacement = [
                            category,
                            setId,
                            ...selected.map(
                                (value) =>
                                    String(value)
                            )
                        ].join('-');

                        const segmentIndex =
                            segments.findIndex(
                                (segment) => {
                                    const parts =
                                        String(
                                            segment
                                        ).split('-');

                                    return (
                                        String(
                                            parts[0] || ''
                                        ).toLowerCase() ===
                                            category &&
                                        String(
                                            parts[1] || ''
                                        ) ===
                                            setId
                                    );
                                }
                            );

                        if (
                            segmentIndex >= 0
                        ) {
                            segments[
                                segmentIndex
                            ] = replacement;
                        }
                    }

                    return segments.join('.');
                },

                init() {
                    if (
                        !this.selectedKey &&
                        this.variants.length
                    ) {
                        this.selectedKey =
                            this.variants[0].key;
                    }

                    this.resetColorsForSelectedVariant();

                    this.bridgeTimeout = window.setTimeout(() => {
                        if (
                            !this.bridgeReady &&
                            !this.ready
                        ) {
                            this.failed = true;
                            this.failureMessage =
                                'No se pudo iniciar el renderer.';
                        }
                    }, 15000);
                },

                destroy() {
                    this.stopAnimation();

                    if (this.renderTimeout) {
                        clearTimeout(this.renderTimeout);
                        this.renderTimeout = null;
                    }

                    if (this.bridgeTimeout) {
                        clearTimeout(this.bridgeTimeout);
                        this.bridgeTimeout = null;
                    }
                },

                render() {
                    if (
                        !this.bridgeReady ||
                        !this.selectedVariant ||
                        !this.selectedFigure ||
                        !$refs.bridge ||
                        !$refs.bridge.contentWindow
                    ) return;

                    if (this.renderTimeout) {
                        clearTimeout(this.renderTimeout);
                        this.renderTimeout = null;
                    }

                    this.ready = false;
                    this.failed = false;
                    this.failureMessage = '';

                    this.currentRequestId =
                        `${this.requestIdBase}-${this.selectedKey}-${this.selectedGender}-${this.direction}-${this.posture}-${this.gesture}-${this.action}-${this.frame}-${Date.now()}`;

                    $refs.bridge.contentWindow.postMessage({
                        type: 'avatar-bridge-render',
                        id: this.currentRequestId,
                        figure: this.selectedFigure,
                        gender: this.selectedGender,
                        direction: this.direction,
                        posture: this.posture,
                        gesture: this.gesture || undefined,
                        action: this.action || undefined,
                        frame: this.frame
                    }, window.location.origin);

                    const pendingId = this.currentRequestId;

                    this.renderTimeout = window.setTimeout(() => {
                        if (
                            String(this.currentRequestId) ===
                                String(pendingId) &&
                            !this.ready
                        ) {
                            this.failed = true;
                            this.failureMessage =
                                'La prenda tardó demasiado en renderizarse.';
                        }
                    }, 15000);
                },


                handleBridgeMessage(event) {
                    if (
                        event.origin !==
                            window.location.origin ||
                        !event.data
                    ) return;

                    if (
                        event.data.type ===
                        'avatar-bridge-ready'
                    ) {
                        this.bridgeReady = true;

                        if (this.bridgeTimeout) {
                            clearTimeout(
                                this.bridgeTimeout
                            );
                            this.bridgeTimeout = null;
                        }

                        this.render();
                        return;
                    }

                    if (
                        event.data.type ===
                            'avatar-bridge-result' &&
                        String(event.data.id) ===
                            String(this.currentRequestId) &&
                        event.data.src
                    ) {
                        if (this.renderTimeout) {
                            clearTimeout(
                                this.renderTimeout
                            );
                            this.renderTimeout = null;
                        }

                        $refs.avatar.src =
                            event.data.src;
                        this.ready = true;
                        this.hasRendered = true;
                        this.failed = false;
                        this.failureMessage = '';
                        return;
                    }

                    if (
                        event.data.type ===
                            'avatar-bridge-error' &&
                        String(event.data.id) ===
                            String(this.currentRequestId)
                    ) {
                        if (this.renderTimeout) {
                            clearTimeout(
                                this.renderTimeout
                            );
                            this.renderTimeout = null;
                        }

                        this.failed = true;
                        this.failureMessage =
                            'No se pudo renderizar la prenda' +
                            (event.data.stage
                                ? ` (${String(
                                    event.data.stage
                                )})`
                                : '') +
                            '.';

                        console.error(
                            'Clothing preview bridge error',
                            event.data
                        );
                        return;
                    }

                    if (
                        event.data.type ===
                        'avatar-bridge-fatal'
                    ) {
                        if (this.bridgeTimeout) {
                            clearTimeout(
                                this.bridgeTimeout
                            );
                            this.bridgeTimeout = null;
                        }

                        this.failed = true;
                        this.failureMessage =
                            'No se pudo iniciar el renderer' +
                            (event.data.stage
                                ? ` (${String(
                                    event.data.stage
                                )})`
                                : '') +
                            '.';

                        console.error(
                            'Clothing preview bridge fatal',
                            event.data
                        );
                    }
                },

                selectVariant(key) {
                    this.selectedKey = key;
                    this.resetColorsForSelectedVariant();
                    this.frame = 0;
                    this.render();
                },

                selectGender(gender) {
                    this.selectedGender = gender;
                    this.frame = 0;
                    this.render();
                },

                selectDirection(direction) {
                    this.direction = Number(direction);
                    this.render();
                },

                selectPosture(posture) {
                    this.posture = posture;
                    this.frame = 0;
                    this.render();
                },

                selectGesture(gesture) {
                    this.gesture = gesture;
                    this.frame = 0;
                    this.render();
                },

                selectAction(action) {
                    this.action = action;
                    this.frame = 0;
                    this.render();
                },

                get frameCount() {
                    return String(this.action || '').startsWith(
                        'dance:'
                    )
                        ? 8
                        : 12;
                },

                previousFrame() {
                    this.frame =
                        (
                            this.frame +
                            this.frameCount -
                            1
                        ) % this.frameCount;
                    this.render();
                },

                nextFrame() {
                    this.frame =
                        (this.frame + 1) %
                        this.frameCount;
                    this.render();
                },

                stopAnimation() {
                    this.playing = false;

                    if (this.timer) {
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                },

                toggleAnimation() {
                    if (this.playing) {
                        this.stopAnimation();
                        return;
                    }

                    this.playing = true;

                    this.timer = setInterval(() => {
                        if (!this.playing) return;

                        this.frame =
                            (this.frame + 1) %
                            this.frameCount;

                        this.render();
                    }, 165);
                }
            }"
            x-init="init()"
            x-on:message.window="handleBridgeMessage($event)"
        >
            <div class="flex flex-wrap items-center justify-between gap-3">
                <h3 class="font-bold">
                    Preview QA
                </h3>
            </div>

            @if (count($avatarVariants) > 1)
                <div class="mt-4">
                    <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Prenda
                    </div>

                    <div class="flex flex-wrap gap-2">
                        @foreach ($avatarVariants as $variant)
                            @php($variantKey = (string) ($variant['key'] ?? 'default'))

                            <button
                                type="button"
                                class="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
                                :class="String(selectedKey) === @js($variantKey) ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'"
                                x-on:click="selectVariant(@js($variantKey))"
                            >
                                {{ $variant['label'] ?? 'Prenda' }}
                            </button>
                        @endforeach
                    </div>
                </div>
            @endif

            @if (count($availableGenders) > 1)
                <div class="mt-4">
                    <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Género de prueba
                    </div>

                    <div class="flex gap-2">
                        @foreach ($availableGenders as $genderOption)
                            <button
                                type="button"
                                class="rounded-lg border px-3 py-1.5 text-sm font-medium transition"
                                :class="selectedGender === @js($genderOption) ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'border-gray-300 text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800'"
                                x-on:click="selectGender(@js($genderOption))"
                            >
                                {{ $genderOption === 'F' ? 'Femenino' : 'Masculino' }}
                            </button>
                        @endforeach
                    </div>
                </div>
            @endif

            <div class="biri-qa-layout">
                <div class="min-w-0 space-y-3">
                    <div class="biri-qa-stage">
                    <div
                        x-show="!hasRendered && !failed"
                        class="absolute inset-0 flex items-center justify-center text-sm text-gray-500"
                    >
                        Renderizando…
                    </div>

                    <div
                        x-show="failed"
                        class="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-red-600 dark:text-red-300"
                        x-text="failureMessage || 'No se pudo renderizar la prenda.'"
                    ></div>

                    <img
                        x-ref="avatar"
                        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
                        alt="Preview QA de {{ $record->clothing_name }}"
                        class="max-h-[340px] w-auto object-contain"
                        style="image-rendering:auto;"
                    >
                    </div>

                    <template x-if="hasColorOptions">
                        <div class="rounded-lg border border-gray-200 p-3 dark:border-gray-700">
                            <div class="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Colores
                            </div>

                            <div class="space-y-4">
                                <template
                                    x-for="group in selectedColorGroups"
                                    :key="colorGroupKey(group)"
                                >
                                    <div
                                        x-show="Array.isArray(group.slots) && group.slots.length > 0"
                                        class="space-y-2"
                                    >
                                        <div
                                            x-show="selectedColorGroups.length > 1"
                                            class="text-sm font-semibold"
                                            x-text="group.label"
                                        ></div>

                                        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:.75rem;">
                                            <template
                                                x-for="slot in group.slots"
                                                :key="colorGroupKey(group) + ':' + slot.index"
                                            >
                                                <div class="min-w-0 rounded-lg border border-gray-200 p-2 dark:border-gray-700">
                                                    <div
                                                        class="mb-2 text-xs font-semibold text-gray-500"
                                                        x-text="group.slots.length > 1 ? ('Color ' + slot.index) : 'Color'"
                                                    ></div>

                                                    <div style="height:150px;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-gutter:stable;padding-right:.25rem;">
                                                        <div class="flex flex-wrap gap-2">
                                                            <template
                                                                x-for="color in slot.colors"
                                                                :key="colorGroupKey(group) + ':' + slot.index + ':' + color.id"
                                                            >
                                                                <button
                                                                    type="button"
                                                                    class="h-8 w-8 shrink-0 rounded-md border-2 transition"
                                                                    :class="Number(selectedColorId(group, slot.index)) === Number(color.id) ? 'border-primary-600 ring-2 ring-primary-300' : 'border-gray-300 dark:border-gray-600'"
                                                                    :style="'background-color:' + color.hex"
                                                                    :title="color.hex + ' · ID ' + color.id"
                                                                    x-on:click="selectColor(group, slot.index, color.id)"
                                                                >
                                                                    <span
                                                                        class="sr-only"
                                                                        x-text="'Color ' + color.hex + ' ID ' + color.id"
                                                                    ></span>
                                                                </button>
                                                            </template>
                                                        </div>
                                                    </div>
                                                </div>
                                            </template>
                                        </div>
                                    </div>
                                </template>
                            </div>
                        </div>
                    </template>
                </div>

                <div class="space-y-4">
                    <div>
                        <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Dirección
                        </div>

                        <div class="biri-qa-direction-grid">
                            @foreach (range(0, 7) as $directionIndex)
                                <button
                                    type="button"
                                    class="rounded-lg border px-2 py-2 text-sm font-semibold transition"
                                    :class="Number(direction) === {{ $directionIndex }} ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'"
                                    x-on:click="selectDirection({{ $directionIndex }})"
                                >
                                    {{ $directionIndex }}
                                </button>
                            @endforeach
                        </div>
                    </div>

                    <div>
                        <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Movimiento / postura
                        </div>

                        <div class="biri-qa-posture-grid">
                            @foreach ([
                                'std' => 'Quieto',
                                'mv' => 'Caminar',
                                'sit' => 'Sentado',
                                'lay' => 'Tumbado',
                            ] as $postureCode => $postureLabel)
                                <button
                                    type="button"
                                    class="rounded-lg border px-3 py-2 text-sm font-medium transition"
                                    :class="posture === @js($postureCode) ? 'border-primary-600 bg-primary-50 text-primary-700 dark:bg-primary-500/10 dark:text-primary-300' : 'border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-200'"
                                    x-on:click="selectPosture(@js($postureCode))"
                                >
                                    {{ $postureLabel }}
                                </button>
                            @endforeach
                        </div>
                    </div>

                    <div>
                        <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Gesto
                        </label>

                        <select
                            class="w-full rounded-lg border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                            x-model="gesture"
                            x-on:change="selectGesture($event.target.value)"
                        >
                            <option value="">Normal</option>
                            <option value="sml">Sonrisa</option>
                            <option value="agr">Enfadado</option>
                            <option value="srp">Sorpresa</option>
                            <option value="sad">Triste</option>
                        </select>
                    </div>

                    <div>
                        <label class="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Acción
                        </label>

                        <select
                            class="w-full rounded-lg border-gray-300 text-sm dark:border-gray-600 dark:bg-gray-900"
                            x-model="action"
                            x-on:change="selectAction($event.target.value)"
                        >
                            <option value="">Ninguna</option>
                            <option value="wave">Saludar</option>
                            <option value="blow">Beso</option>
                            <option value="laugh">Reír</option>
                            <option value="respect">Respeto</option>
                            <option value="talk">Hablar</option>
                            <option value="sleep">Dormir</option>
                            <option value="dance:1">Baile 1</option>
                            <option value="dance:2">Baile 2</option>
                            <option value="dance:3">Baile 3</option>
                            <option value="dance:4">Baile 4</option>
                        </select>
                    </div>

                    <div>
                        <div class="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Animación
                        </div>

                        <div class="flex flex-wrap items-center gap-2">
                            <button
                                type="button"
                                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600"
                                x-on:click="previousFrame()"
                            >
                                Anterior
                            </button>

                            <button
                                type="button"
                                class="rounded-lg border px-3 py-2 text-sm font-semibold"
                                :class="playing ? 'border-red-500 text-red-600' : 'border-primary-600 text-primary-700 dark:text-primary-300'"
                                x-on:click="toggleAnimation()"
                                x-text="playing ? 'Pausar' : 'Reproducir'"
                            ></button>

                            <button
                                type="button"
                                class="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium dark:border-gray-600"
                                x-on:click="nextFrame()"
                            >
                                Siguiente
                            </button>

                            <span
                                class="text-xs text-gray-500"
                                x-text="`Frame ${frame}`"
                            ></span>
                        </div>
                    </div>
                </div>
            </div>

            <iframe
                x-ref="bridge"
                src="{{ $bridgeSrc }}"
                aria-hidden="true"
                tabindex="-1"
                class="pointer-events-none absolute h-px w-px opacity-0"
                style="left:-10000px;top:-10000px;border:0;"
            ></iframe>
        </section>
    @endif

    @foreach ($figures as $index => $figure)
        @php($image = $previewService->dataUri($figure['png_relative'] ?? null))
        @php($figureTitle = count($figures) === 1 ? $record->clothing_name : ('Prenda ' . ($index + 1)))

        <section class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 class="mb-3 font-bold">{{ $figureTitle }}</h3>

            @if ($image)
                <div
                    class="overflow-auto rounded-lg border border-dashed border-gray-300 p-4 dark:border-gray-700"
                    style="background-image:linear-gradient(45deg,rgba(127,127,127,.12) 25%,transparent 25%),linear-gradient(-45deg,rgba(127,127,127,.12) 25%,transparent 25%),linear-gradient(45deg,transparent 75%,rgba(127,127,127,.12) 75%),linear-gradient(-45deg,transparent 75%,rgba(127,127,127,.12) 75%);background-size:20px 20px;background-position:0 0,0 10px,10px -10px,-10px 0;"
                >
                    <img
                        src="{{ $image }}"
                        alt="Preview {{ $figureTitle }}"
                        class="mx-auto max-h-[420px] max-w-full"
                        style="image-rendering:pixelated;"
                    >
                </div>
            @endif
        </section>
    @endforeach

    @if ($furniture !== [])
        @php($furniAtlas = $previewService->dataUri($furniture['atlas_relative'] ?? null))
        @php($furniIcon = $previewService->dataUri($furniture['icon_relative'] ?? null))

        <section class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <h3 class="font-bold">Furni canjeable · {{ $record->clothing_name }}</h3>

            <div class="mt-4 grid gap-4 lg:grid-cols-[180px_1fr]">
                <div>
                    <div class="mb-2 text-xs text-gray-500">Icono</div>
                    @if ($furniIcon)
                        <div class="flex min-h-36 items-center justify-center rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-700">
                            <img src="{{ $furniIcon }}" alt="Icono furni" class="max-h-32 max-w-full" style="image-rendering:pixelated;">
                        </div>
                    @endif
                </div>

                <div>
                    <div class="mb-2 text-xs text-gray-500">Furni</div>
                    @if ($furniAtlas)
                        <div class="overflow-auto rounded-lg border border-dashed border-gray-300 p-3 dark:border-gray-700">
                            <img src="{{ $furniAtlas }}" alt="Furni canjeable" class="mx-auto max-h-[360px] max-w-full" style="image-rendering:pixelated;">
                        </div>
                    @endif
                </div>
            </div>
        </section>
    @endif

    <details class="rounded-lg border border-gray-200 p-3 text-xs text-gray-500 dark:border-gray-700">
        <summary class="cursor-pointer font-semibold">Detalles técnicos</summary>

        <div class="mt-3 space-y-2">
            @foreach ($figures as $figure)
                <div>
                    <strong>{{ $figure['library_code'] ?? 'Library' }}</strong>
                    · IDs origen {{ implode(', ', $figure['source_part_ids'] ?? []) }}
                    → Biribiri {{ implode(', ', $figure['biribiri_part_ids'] ?? []) }}
                </div>
            @endforeach

            @if ($furniture !== [])
                <div>
                    Furni Biribiri:
                    <code>{{ $furniture['redeemable_code'] ?? '—' }}</code>
                </div>
            @endif
        </div>
    </details>
</div>
