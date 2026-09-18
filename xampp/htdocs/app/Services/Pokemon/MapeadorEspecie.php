<?php

namespace App\Services\Pokemon;

class MapeadorEspecie
{
    /**
     * @param array<string, int> $tiposPorNombre
     */
    public static function fila(array $especie, array $pokemon, array $tiposPorNombre): array
    {
        $stats = self::stats($pokemon);
        $yields = self::yields($pokemon);
        $tipos = self::tipos($pokemon, $tiposPorNombre);
        $habilidades = self::habilidades($pokemon);

        return [
            'id' => (int) $especie['id'],
            'form_id' => 0,
            'nombre' => $especie['name'],
            'nombre_es' => self::nombreEs($especie),
            'generacion' => self::generacion($especie),
            'type_1_id' => $tipos[0],
            'type_2_id' => $tipos[1],
            'base_hp' => $stats['hp'],
            'base_attack' => $stats['attack'],
            'base_defense' => $stats['defense'],
            'base_sp_attack' => $stats['special-attack'],
            'base_sp_defense' => $stats['special-defense'],
            'base_speed' => $stats['speed'],
            'yield_hp' => $yields['hp'],
            'yield_attack' => $yields['attack'],
            'yield_defense' => $yields['defense'],
            'yield_sp_attack' => $yields['special-attack'],
            'yield_sp_defense' => $yields['special-defense'],
            'yield_speed' => $yields['speed'],
            'ability_1_id' => $habilidades['normal'][0] ?? null,
            'ability_2_id' => $habilidades['normal'][1] ?? null,
            'ability_hidden_id' => $habilidades['oculta'] ?? null,
            'catch_rate' => (int) ($especie['capture_rate'] ?? 255),
            'base_experience' => (int) ($pokemon['base_experience'] ?? 50),
            'growth_rate' => $especie['growth_rate']['name'] ?? 'medium',
            'female_ratio' => self::ratioHembra($especie),
            'egg_group_1' => $especie['egg_groups'][0]['name'] ?? null,
            'egg_group_2' => $especie['egg_groups'][1]['name'] ?? null,
            'egg_steps' => (int) ((($especie['hatch_counter'] ?? 20) + 1) * 255),
            'base_friendship' => (int) ($especie['base_happiness'] ?? 70),
            'altura' => ((int) ($pokemon['height'] ?? 0)) / 10,
            'peso' => ((int) ($pokemon['weight'] ?? 0)) / 10,
            'es_legendario' => !empty($especie['is_legendary']) ? 1 : 0,
            'es_singular' => !empty($especie['is_mythical']) ? 1 : 0,
        ];
    }

    private static function stats(array $pokemon): array
    {
        $salida = [];

        foreach ($pokemon['stats'] ?? [] as $stat) {
            $salida[$stat['stat']['name']] = (int) $stat['base_stat'];
        }

        return $salida + [
            'hp' => 1, 'attack' => 1, 'defense' => 1,
            'special-attack' => 1, 'special-defense' => 1, 'speed' => 1,
        ];
    }

    private static function yields(array $pokemon): array
    {
        $salida = [];

        foreach ($pokemon['stats'] ?? [] as $stat) {
            $salida[$stat['stat']['name']] = (int) $stat['effort'];
        }

        return $salida + [
            'hp' => 0, 'attack' => 0, 'defense' => 0,
            'special-attack' => 0, 'special-defense' => 0, 'speed' => 0,
        ];
    }

    /**
     * @return array{0: int, 1: ?int}
     */
    private static function tipos(array $pokemon, array $tiposPorNombre): array
    {
        $ids = [];

        foreach ($pokemon['types'] ?? [] as $tipo) {
            $ids[] = $tiposPorNombre[$tipo['type']['name']] ?? 1;
        }

        return [$ids[0] ?? 1, $ids[1] ?? null];
    }

    /**
     * @return array{normal: int[], oculta: ?int}
     */
    private static function habilidades(array $pokemon): array
    {
        $normales = [];
        $oculta = null;

        foreach ($pokemon['abilities'] ?? [] as $habilidad) {
            $id = (int) basename(rtrim($habilidad['ability']['url'], '/'));

            if (!empty($habilidad['is_hidden'])) {
                $oculta = $id;
                continue;
            }

            $normales[] = $id;
        }

        return ['normal' => $normales, 'oculta' => $oculta];
    }

    private static function ratioHembra(array $especie): ?float
    {
        $tasa = $especie['gender_rate'] ?? -1;

        return $tasa < 0 ? null : round($tasa * 12.5, 1);
    }

    private static function generacion(array $especie): int
    {
        $nombre = $especie['generation']['name'] ?? 'generation-i';
        $romanos = [
            'i' => 1, 'ii' => 2, 'iii' => 3, 'iv' => 4, 'v' => 5,
            'vi' => 6, 'vii' => 7, 'viii' => 8, 'ix' => 9,
        ];

        $sufijo = substr($nombre, strlen('generation-'));

        return $romanos[$sufijo] ?? 1;
    }

    private static function nombreEs(array $especie): string
    {
        foreach ($especie['names'] ?? [] as $nombre) {
            if (($nombre['language']['name'] ?? null) === 'es') {
                return $nombre['name'];
            }
        }

        return ucfirst($especie['name']);
    }
}
