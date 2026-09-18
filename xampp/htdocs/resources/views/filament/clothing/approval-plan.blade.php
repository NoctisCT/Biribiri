<div class="space-y-5 text-sm">
    @if (!($result['ok'] ?? false))
        <div class="rounded-xl border border-danger-300 bg-danger-50 p-4 dark:border-danger-700 dark:bg-danger-950/30">
            <div class="font-semibold text-danger-700 dark:text-danger-300">
                Aprobación bloqueada
            </div>
            <div class="mt-2 text-danger-700 dark:text-danger-300">
                {{ $result['error'] ?? 'No se pudo generar el plan.' }}
            </div>
        </div>
    @else
        @php($plan = $result['plan'])

        <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div class="font-semibold">Dry-run — no instala nada</div>
            <div class="mt-1 text-gray-500 dark:text-gray-400">
                Este plan calcula la identidad e IDs finales previstos y elimina sus archivos temporales al cerrar la generación.
            </div>
        </div>

        <div class="grid gap-4 md:grid-cols-2">
            <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div class="font-semibold">Producto</div>
                <dl class="mt-3 space-y-2">
                    <div><dt class="inline text-gray-500">Nombre:</dt> <dd class="inline">{{ $plan['clothing_name'] }}</dd></div>
                    <div><dt class="inline text-gray-500">Tipo:</dt> <dd class="inline">{{ $plan['package_kind'] }} · {{ $plan['piece_count'] }} pieza(s)</dd></div>
                    <div><dt class="inline text-gray-500">Furni final:</dt> <dd class="inline font-mono">{{ $plan['redeemable_code'] }}</dd></div>
                    <div><dt class="inline text-gray-500">Furni fuente:</dt> <dd class="inline font-mono">{{ $plan['source_redeemable_code'] }}</dd></div>
                </dl>
            </div>

            <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div class="font-semibold">IDs previstos</div>
                <dl class="mt-3 space-y-2 font-mono">
                    @foreach ($plan['ids'] as $key => $value)
                        <div><dt class="inline text-gray-500">{{ $key }}:</dt> <dd class="inline">{{ $value }}</dd></div>
                    @endforeach
                </dl>
            </div>
        </div>

        <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div class="font-semibold">Figure Set IDs</div>
            <div class="mt-3 overflow-x-auto">
                <table class="w-full text-left">
                    <thead>
                        <tr class="border-b border-gray-200 dark:border-gray-700">
                            <th class="py-2 pr-4">Referencia fuente</th>
                            <th class="py-2">ID Biribiri</th>
                        </tr>
                    </thead>
                    <tbody>
                        @forelse ($plan['figure_set_map'] as $source => $target)
                            <tr class="border-b border-gray-100 dark:border-gray-800">
                                <td class="py-2 pr-4 font-mono">{{ $source }}</td>
                                <td class="py-2 font-mono">{{ $target }}</td>
                            </tr>
                        @empty
                            @foreach ($plan['set_ids'] as $setId)
                                <tr>
                                    <td class="py-2 pr-4 text-gray-500">—</td>
                                    <td class="py-2 font-mono">{{ $setId }}</td>
                                </tr>
                            @endforeach
                        @endforelse
                    </tbody>
                </table>
            </div>
        </div>

        <div class="grid gap-4 xl:grid-cols-2">
            <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div class="font-semibold">Part IDs</div>
                <div class="mt-3 max-h-64 overflow-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b border-gray-200 dark:border-gray-700">
                                <th class="py-2 pr-4">Fuente</th>
                                <th class="py-2">Biribiri</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($plan['part_id_map'] as $source => $target)
                                <tr class="border-b border-gray-100 dark:border-gray-800">
                                    <td class="py-2 pr-4 font-mono">{{ $source }}</td>
                                    <td class="py-2 font-mono">{{ $target }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>

            <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
                <div class="font-semibold">Figure libraries</div>
                <div class="mt-3 max-h-64 overflow-auto">
                    <table class="w-full text-left">
                        <thead>
                            <tr class="border-b border-gray-200 dark:border-gray-700">
                                <th class="py-2 pr-4">Fuente</th>
                                <th class="py-2">Biribiri</th>
                            </tr>
                        </thead>
                        <tbody>
                            @foreach ($plan['figure_library_map'] as $source => $target)
                                <tr class="border-b border-gray-100 dark:border-gray-800">
                                    <td class="py-2 pr-4 font-mono">{{ $source }}</td>
                                    <td class="py-2 font-mono">{{ $target }}</td>
                                </tr>
                            @endforeach
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

        <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div class="font-semibold">Archivos que se instalarían</div>
            <div class="mt-3 max-h-72 overflow-auto space-y-2">
                @foreach ($plan['files'] as $file)
                    <div class="rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900">
                        <span class="mr-2 font-semibold">{{ strtoupper($file['kind']) }}</span>
                        <span class="break-all font-mono text-xs">{{ $file['target'] }}</span>
                    </div>
                @endforeach
            </div>
        </div>

        <div class="rounded-xl border border-gray-200 p-4 dark:border-gray-700">
            <div class="font-semibold">Registros DB que se crearían/actualizarían</div>
            <div class="mt-3 max-h-96 overflow-auto space-y-3">
                @foreach ($plan['database'] as $row)
                    <div class="rounded-lg bg-gray-50 p-3 dark:bg-gray-900">
                        <div class="font-mono font-semibold">{{ $row['table'] }}</div>
                        <pre class="mt-2 whitespace-pre-wrap break-all text-xs">{{ json_encode($row['record'], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) }}</pre>
                    </div>
                @endforeach
            </div>
        </div>
    @endif
</div>
