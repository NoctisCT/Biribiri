<?php

namespace App\Services\Pokemon;

class MapeadorObjeto
{
    /**
     * El bolsillo sale de la categoría de PokéAPI. Lo que no está aquí
     * cae en OBJETOS: es el cajón de sastre, no un error.
     */
    public const BOLSILLO_POR_CATEGORIA = [
        'standard-balls' => 'BALLS',
        'special-balls' => 'BALLS',
        'healing' => 'MEDICINAS',
        'status-cures' => 'MEDICINAS',
        'revival' => 'MEDICINAS',
        'pp-recovery' => 'MEDICINAS',
        'medicine' => 'MEDICINAS',
        'all-machines' => 'MO_MT',
        'effort-drop' => 'BAYAS',
        'key-items' => 'CLAVE',
        'plot-advancement' => 'CLAVE',
        'event-items' => 'CLAVE',
    ];

    public const BOLSILLO_POR_DEFECTO = 'OBJETOS';

    /**
     * PokéAPI no da el multiplicador de captura de las balls, así que
     * se siembra a mano el puñado que existe en Kanto. La Máster no
     * tiene multiplicador: captura siempre, y eso es un efecto, no un número.
     */
    public const BALLS_KANTO = [
        'poke-ball' => 1.0,
        'great-ball' => 1.5,
        'safari-ball' => 1.5,
        'ultra-ball' => 2.0,
        'premier-ball' => 1.0,
    ];

    public const BALLS_CAPTURA_SEGURA = ['master-ball'];

    /**
     * PokéAPI dejó de exponer `cost` y ahora publica `prices` por grupo de
     * versión, pero a día de hoy la mayoría de objetos de Kanto lo traen
     * vacío: Poké Ball, Poción o Antídoto no tienen ni un precio. Cuando no
     * hay dato se usa esta tabla, con los precios de los juegos de gen 1.
     */
    public const PRECIOS_KANTO = [
        'poke-ball' => 200,
        'safari-ball' => 0,
        'master-ball' => 0,
        'potion' => 300,
        'super-potion' => 700,
        'hyper-potion' => 1200,
        'max-potion' => 2500,
        'full-restore' => 3000,
        'revive' => 1500,
        'max-revive' => 4000,
        'antidote' => 100,
        'burn-heal' => 250,
        'ice-heal' => 250,
        'awakening' => 250,
        'paralyze-heal' => 200,
        'full-heal' => 600,
        'ether' => 1200,
        'max-ether' => 2000,
        'elixir' => 3000,
        'max-elixir' => 4500,
        'repel' => 350,
        'super-repel' => 500,
        'max-repel' => 700,
        'escape-rope' => 550,
        'poke-doll' => 1000,
        'x-attack' => 500,
        'x-defense' => 550,
        'x-speed' => 350,
        'x-sp-atk' => 350,
        'x-accuracy' => 950,
        'dire-hit' => 650,
        'guard-spec' => 700,
        'fresh-water' => 200,
        'soda-pop' => 300,
        'lemonade' => 350,
    ];

    /**
     * Los grupos de versión de Kanto van primero: si un objeto cambió de
     * precio en generaciones posteriores, manda el precio de gen 1.
     */
    private const VERSIONES_PREFERIDAS = ['red-blue', 'yellow', 'firered-leafgreen'];

    public static function fila(array $json): array
    {
        $nombre = (string) $json['name'];
        $categoria = $json['category']['name'] ?? '';
        $bolsillo = self::bolsillo($nombre, $categoria);
        $precios = self::precios($json);
        $esBall = $bolsillo === 'BALLS';
        $ratio = self::BALLS_KANTO[$nombre] ?? null;

        return [
            'id' => (int) $json['id'],
            'nombre' => $nombre,
            'nombre_es' => self::nombreEs($json, $nombre),
            'bolsillo' => $bolsillo,
            'precio' => $precios['compra'],
            'precio_venta' => $precios['venta'],
            'effect_code' => self::codigoDeEfecto($nombre, $esBall, $ratio),
            'tope_pila' => $bolsillo === 'CLAVE' ? 1 : 999,
            'es_ball' => $esBall ? 1 : 0,
            'ball_ratio' => $esBall ? $ratio : null,
            'descripcion_es' => self::descripcionEs($json),
        ];
    }

    public static function bolsillo(string $nombre, string $categoria): string
    {
        // Las bayas se reconocen por el nombre: PokéAPI las reparte entre
        // `medicine`, `effort-drop`, `in-a-pinch` y media docena más de
        // categorías, y todas ellas comparten bolsillo.
        if (str_ends_with($nombre, '-berry')) {
            return 'BAYAS';
        }

        return self::BOLSILLO_POR_CATEGORIA[$categoria] ?? self::BOLSILLO_POR_DEFECTO;
    }

    private static function codigoDeEfecto(string $nombre, bool $esBall, ?float $ratio): string
    {
        if (in_array($nombre, self::BALLS_CAPTURA_SEGURA, true)) {
            return 'ball_captura_segura';
        }

        if ($esBall && $ratio !== null) {
            return 'ball';
        }

        return 'sin_implementar';
    }

    /**
     * @return array{compra: int, venta: int}
     */
    private static function precios(array $json): array
    {
        $entrada = self::entradaDePrecio($json['prices'] ?? []);

        if ($entrada !== null) {
            $compra = (int) $entrada['purchase_price'];
            $venta = $entrada['sell_price'] !== null
                ? (int) $entrada['sell_price']
                : intdiv($compra, 2);

            return ['compra' => $compra, 'venta' => $venta];
        }

        $compra = self::PRECIOS_KANTO[$json['name']] ?? 0;

        return ['compra' => $compra, 'venta' => intdiv($compra, 2)];
    }

    private static function entradaDePrecio(array $precios): ?array
    {
        foreach (self::VERSIONES_PREFERIDAS as $version) {
            foreach ($precios as $precio) {
                if (($precio['version_group']['name'] ?? null) === $version
                    && ($precio['purchase_price'] ?? null) !== null) {
                    return $precio;
                }
            }
        }

        foreach ($precios as $precio) {
            if (($precio['purchase_price'] ?? null) !== null) {
                return $precio;
            }
        }

        return null;
    }

    private static function nombreEs(array $json, string $porDefecto): string
    {
        foreach ($json['names'] ?? [] as $nombre) {
            if (($nombre['language']['name'] ?? null) === 'es') {
                return $nombre['name'];
            }
        }

        return $porDefecto;
    }

    private static function descripcionEs(array $json): ?string
    {
        // Los objetos guardan el texto en `text`, no en `flavor_text` como
        // los movimientos y las especies.
        foreach ($json['flavor_text_entries'] ?? [] as $entrada) {
            if (($entrada['language']['name'] ?? null) === 'es') {
                return $entrada['text'];
            }
        }

        foreach ($json['effect_entries'] ?? [] as $entrada) {
            if (($entrada['language']['name'] ?? null) === 'es') {
                return $entrada['short_effect'] ?? $entrada['effect'] ?? null;
            }
        }

        return null;
    }
}
