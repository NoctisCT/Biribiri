@php
    $notificationAccountId = (int) (
        \Illuminate\Support\Facades\DB::table('account_characters')
            ->where('user_id', auth()->id())
            ->whereNull('archived_at')
            ->value('account_id') ?? 0
    );

    $headerNotifications = collect();
    $unreadNotificationCount = 0;

    if ($notificationAccountId > 0) {
        $headerNotifications = \App\Models\AccountNotification::query()
            ->where('account_id', $notificationAccountId)
            ->latest('created_at')
            ->limit(8)
            ->get();

        $unreadNotificationCount = \App\Models\AccountNotification::query()
            ->where('account_id', $notificationAccountId)
            ->whereNull('read_at')
            ->count();
    }
@endphp

<div class="max-w-7xl min-h-[60px] px-4 md:flex md:items-center md:justify-between md:mx-auto">
    <div class="flex gap-x-6">
        <x-top-header-currency icon="nav-credit-icon">
            <x-slot:currency>
                {{ auth()->user()->credits }}
            </x-slot:currency>

            {{ __('Credits') }}
        </x-top-header-currency>

        <x-top-header-currency icon="nav-ducket-icon">
            <x-slot:currency>
                {{ auth()->user()->currency('duckets') }}
            </x-slot:currency>

            {{ __('Duckets') }}
        </x-top-header-currency>

        <x-top-header-currency icon="nav-diamond-icon">
            <x-slot:currency>
                {{ auth()->user()->currency('diamonds') }}
            </x-slot:currency>

            {{ __('Diamonds') }}
        </x-top-header-currency>
    </div>

    <div class="flex gap-x-3">
        @if(hasPermission('view_server_logs') || hasPermission('housekeeping_access') || hasPermission('generate_logo'))
            <x-navigation.dropdown classes="!text-red-700 !border-none">
                {{ __('Administration') }}

                <x-slot:children>
                    @if (hasPermission('generate_logo'))
                        <x-navigation.dropdown-child route="{{ route('logo-generator.index') }}" :turbolink="false" target="_blank">
                            {{ __('Logo generator') }}
                        </x-navigation.dropdown-child>
                    @endif

                    @php
                        $maximumAdminRankId = (int) \Illuminate\Support\Facades\DB::table('permissions')
                            ->orderByDesc('level')
                            ->value('id');
                    @endphp

                    @if ((int) auth()->user()->rank === $maximumAdminRankId)
                        <x-navigation.dropdown-child route="{{ route('admin.archived-characters') }}" :turbolink="false">
                            Personajes archivados
                        </x-navigation.dropdown-child>
                    @endif

                    @if (hasPermission('view_server_logs'))
                        <x-navigation.dropdown-child route="/log-viewer" :turbolink="false" target="_blank">
                            {{ __('Error logs') }}
                        </x-navigation.dropdown-child>
                    @endif

                    @if(hasPermission('housekeeping_access'))
                        <a data-turbolinks="false" href="{{ setting('housekeeping_url') }}" target="_blank" class="dropdown-item dark:text-gray-200 dark:hover:bg-gray-700">
                            {{ __('Housekeeping') }}
                        </a>
                    @endif
                </x-slot:children>
            </x-navigation.dropdown>
        @endif

        <x-navigation.dropdown
            classes="!border-none"
            childClasses="!left-auto !right-0 min-w-[190px] !overflow-visible"
        >
            <span class="relative flex h-12 w-12 shrink-0 overflow-visible">
                <span class="relative block h-12 w-12 overflow-hidden rounded-full bg-gray-100 dark:bg-gray-800">
                    <img
                        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw=="
                        alt="{{ auth()->user()->username }}"
                        data-header-avatar="1"
                        data-avatar-id="{{ auth()->user()->id }}"
                        data-avatar-figure="{{ auth()->user()->look }}"
                        data-avatar-gender="{{ auth()->user()->gender ?: 'M' }}"
                        class="pointer-events-none absolute left-1/2 max-w-none"
                        style="height:112px;width:auto;top:-27px;transform:translateX(-50%);image-rendering:auto;"
                    >
                </span>

                @if ($unreadNotificationCount > 0)
                    <span
                        class="absolute -right-2 -top-1 z-20 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-extrabold leading-none text-white shadow"
                        aria-label="{{ $unreadNotificationCount }} {{ __('unread notifications') }}"
                    >
                        {{ $unreadNotificationCount }}
                    </span>
                @endif
            </span>

            <span class="-ml-2">{{ auth()->user()->username }}</span>

            <x-slot:children>
                <div class="w-[190px] whitespace-normal">
                    <a
                        href="{{ route('notifications.index') }}"
                        class="flex w-full items-center justify-between gap-3 px-4 py-2.5 font-semibold text-gray-800 transition hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                    >
                        <span>Notificaciones</span>

                        @if ($unreadNotificationCount > 0)
                            <span class="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-red-600 px-1.5 text-[11px] font-extrabold leading-none text-white">
                                {{ $unreadNotificationCount }}
                            </span>
                        @endif
                    </a>

                    <x-navigation.dropdown-child :route="route('settings.account.show')">
                        {{ __('User settings') }}
                    </x-navigation.dropdown-child>

                    <button
                        class="dropdown-item dark:text-gray-200 dark:hover:bg-gray-700 w-full text-left"
                        @click.prevent="document.getElementById('logout-form').submit();"
                    >
                        {{ __('Logout') }}
                    </button>

                    <form id="logout-form" action="{{ route('logout') }}" method="POST" class="hidden">
                        @csrf
                    </form>
                </div>
            </x-slot:children>
        </x-navigation.dropdown>
    </div>
</div>

<script id="header-avatar-bridge-script">
(function () {
    function initHeaderAvatarBridge()
    {
        const avatar = document.querySelector('[data-header-avatar="1"]');

        if(!avatar || avatar.dataset.bridgeInitialized === '1') return;

        avatar.dataset.bridgeInitialized = '1';

        const bridge = document.createElement('iframe');

        bridge.src = '/dist/index.html?avatar-bridge=1';
        bridge.setAttribute('aria-hidden', 'true');
        bridge.setAttribute('tabindex', '-1');

        Object.assign(bridge.style, {
            position: 'absolute',
            width: '2px',
            height: '2px',
            left: '-10000px',
            top: '-10000px',
            border: '0',
            opacity: '0',
            pointerEvents: 'none'
        });

        function onMessage(event)
        {
            if(event.origin !== window.location.origin) return;
            if(!event.data) return;

            if(event.data.type === 'avatar-bridge-ready')
            {
                if(!bridge.contentWindow) return;

                bridge.contentWindow.postMessage({
                    type: 'avatar-bridge-render',
                    id: avatar.dataset.avatarId,
                    figure: avatar.dataset.avatarFigure || '',
                    gender: avatar.dataset.avatarGender || 'M',
                    direction: 2,
                    gesture: 'sml'
                }, window.location.origin);

                return;
            }

            if(
                event.data.type !== 'avatar-bridge-result' ||
                String(event.data.id) !== String(avatar.dataset.avatarId) ||
                !event.data.src
            ) {
                return;
            }

            avatar.src = event.data.src;
        }

        window.addEventListener('message', onMessage);
        document.body.appendChild(bridge);
    }

    document.addEventListener('DOMContentLoaded', initHeaderAvatarBridge);
    document.addEventListener('turbolinks:load', initHeaderAvatarBridge);

    if(document.readyState !== 'loading')
    {
        initHeaderAvatarBridge();
    }
})();
</script>
