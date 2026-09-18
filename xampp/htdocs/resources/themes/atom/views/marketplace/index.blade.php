<x-app-layout>
    @push('title', 'Marketplace')

    <div class="col-span-12">
        <x-content.content-card
            icon="hotel-icon"
            classes="border dark:border-gray-900"
        >
            <x-slot:title>
                Marketplace
            </x-slot:title>

            <x-slot:under-title>
                Creaciones de la comunidad de Biribiri.
            </x-slot:under-title>

            <div class="px-2 py-5">
                <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
                    <a
                        href="{{ route('marketplace.badges.index') }}"
                        class="group overflow-hidden rounded border border-gray-300 bg-white transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900"
                    >
                        <div
                            class="h-2"
                            style="background:#168eea;"
                        ></div>

                        <div class="p-5">
                            <div class="text-lg font-extrabold text-gray-900 dark:text-white">
                                Placas
                            </div>

                            <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                Descubre placas de la comunidad, crea las tuyas, publícalas y gestiona tus ventas.
                            </p>

                            <div
                                class="mt-5 inline-flex rounded border-2 px-4 py-2 text-sm font-bold text-white"
                                style="background:#168eea;border-color:#51b4ff;"
                            >
                                Entrar en Placas
                            </div>
                        </div>
                    </a>

                    <a
                        href="{{ route('marketplace.clothing.index') }}"
                        class="group overflow-hidden rounded border border-gray-300 bg-white transition hover:-translate-y-0.5 hover:shadow-lg dark:border-gray-700 dark:bg-gray-900"
                    >
                        <div
                            class="h-2"
                            style="background:#a34fb5;"
                        ></div>

                        <div class="p-5">
                            <div class="text-lg font-extrabold text-gray-900 dark:text-white">
                                Ropa
                            </div>

                            <p class="mt-2 text-sm text-gray-600 dark:text-gray-300">
                                Consulta la tienda semanal, envía tus prendas y sigue el estado de tus diseños.
                            </p>

                            <div
                                class="mt-5 inline-flex rounded border-2 px-4 py-2 text-sm font-bold text-white"
                                style="background:#a34fb5;border-color:#cf74df;"
                            >
                                Entrar en Ropa
                            </div>
                        </div>
                    </a>
                </div>
            </div>
        </x-content.content-card>
    </div>
</x-app-layout>