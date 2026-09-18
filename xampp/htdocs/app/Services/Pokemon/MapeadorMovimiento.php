<?php

namespace App\Services\Pokemon;

class MapeadorMovimiento
{
    public const CATEGORIAS_GENERICAS = [
        'damage',
        'ailment',
        'net-good-stats',
        'heal',
        'damage-ailment',
        'swagger',
        'damage-lower',
        'damage-raise',
        'damage-heal',
        'ohko',
        'force-switch',
    ];

    public const CATEGORIAS_MANUALES = [
        'whole-field-effect',
        'field-effect',
        'unique',
    ];

    /**
     * @param array|null $sd Entrada del movimiento en BattleMovedex de Showdown, o null si no existe
     * @param array<string, int> $tiposPorNombre
     */
    public static function fila(array $json, ?array $sd, array $tiposPorNombre): array
    {
        $meta = $json['meta'] ?? [];
        $categoria = $meta['category']['name'] ?? 'unique';
        $sd = $sd ?? [];

        return [
            'id' => (int) $json['id'],
            'nombre' => $json['name'],
            'nombre_es' => self::nombreEs($json),
            'type_id' => $tiposPorNombre[$json['type']['name']] ?? 1,
            'clase' => $json['damage_class']['name'] ?? 'status',
            'potencia' => $json['power'],
            'precision_pct' => $json['accuracy'],
            'pp' => (int) ($json['pp'] ?? 5),
            'prioridad' => (int) ($json['priority'] ?? 0),
            'objetivo' => $json['target']['name'] ?? 'selected-pokemon',
            'categoria' => $categoria,
            'effect_code' => self::codigoDeEfecto($categoria, $json['name'], $sd),
            'effect_chance' => $json['effect_chance'],
            'dolencia' => $meta['ailment']['name'] ?? 'none',
            'dolencia_chance' => (int) ($meta['ailment_chance'] ?? 0),
            'golpes_min' => $meta['min_hits'] ?? null,
            'golpes_max' => $meta['max_hits'] ?? null,
            'turnos_min' => $meta['min_turns'] ?? null,
            'turnos_max' => $meta['max_turns'] ?? null,
            'drenaje' => (int) ($meta['drain'] ?? 0),
            'curacion' => (int) ($meta['healing'] ?? 0),
            'ratio_critico' => (int) ($meta['crit_rate'] ?? 0),
            'retroceso_chance' => (int) ($meta['flinch_chance'] ?? 0),
            'stat_chance' => (int) ($meta['stat_chance'] ?? 0),
            'cambios_stats' => json_encode(array_map(
                fn (array $c) => ['stat' => $c['stat']['name'], 'cambio' => $c['change']],
                $json['stat_changes'] ?? []
            ), JSON_UNESCAPED_UNICODE),

            // --- mecánica de Showdown ---
            'vigente' => self::esVigente($sd) ? 1 : 0,
            'flags' => json_encode($sd['flags'] ?? [], JSON_UNESCAPED_UNICODE),
            'rompe_proteccion' => !empty($sd['breaksProtect']) ? 1 : 0,
            'ignora_habilidad' => !empty($sd['ignoreAbility']) ? 1 : 0,
            'ignora_defensa' => !empty($sd['ignoreDefensive']) ? 1 : 0,
            'ignora_evasion' => !empty($sd['ignoreEvasion']) ? 1 : 0,
            'ignora_inmunidad' => !empty($sd['ignoreImmunity']) ? 1 : 0,
            'critico_seguro' => !empty($sd['willCrit']) ? 1 : 0,
            'retroceso_dano' => isset($sd['recoil']) && is_array($sd['recoil'])
                ? implode('/', $sd['recoil'])
                : null,
            'stat_ofensivo_forzado' => $sd['overrideOffensiveStat'] ?? null,
            'stat_defensivo_forzado' => $sd['overrideDefensiveStat'] ?? null,
            'condicion_bando' => $sd['sideCondition'] ?? null,
            'condicion_hueco' => $sd['slotCondition'] ?? null,
            'estado_volatil' => $sd['volatileStatus'] ?? null,
            'estado' => $sd['status'] ?? null,
            'clima' => $sd['weather'] ?? null,
            'terreno' => $sd['terrain'] ?? null,
            'duracion' => $sd['condition']['duration'] ?? null,
            'cambio_forzado' => !empty($sd['forceSwitch']) ? 1 : 0,
            'autocambio' => !empty($sd['selfSwitch']) ? 1 : 0,
        ];
    }

    /**
     * Un movimiento es vigente si Showdown lo conoce y no es Z, Dinamax ni retirado.
     */
    public static function esVigente(array $sd): bool
    {
        if ($sd === []) {
            return false;
        }

        return empty($sd['isZ']) && empty($sd['isMax']) && empty($sd['isNonstandard']);
    }

    /**
     * El código de efecto prefiere la primitiva reutilizable de Showdown sobre
     * marcar el movimiento como manual, para no escribir código por movimiento.
     */
    public static function codigoDeEfecto(string $categoria, string $nombreMovimiento, array $sd = []): string
    {
        if (!empty($sd['sideCondition'])) return 'bando_' . $sd['sideCondition'];
        if (!empty($sd['weather'])) return 'clima_' . strtolower($sd['weather']);
        if (!empty($sd['terrain'])) return 'terreno_' . strtolower($sd['terrain']);
        if (!empty($sd['slotCondition'])) return 'hueco_' . $sd['slotCondition'];
        if (!empty($sd['volatileStatus'])) return 'volatil_' . $sd['volatileStatus'];

        return in_array($categoria, self::CATEGORIAS_MANUALES, true)
            ? 'manual_' . $nombreMovimiento
            : $categoria;
    }

    /**
     * PokéAPI usa `aurora-veil`; Showdown usa `auroraveil`.
     */
    public static function claveShowdown(string $nombre): string
    {
        return preg_replace('/[^a-z0-9]/', '', strtolower($nombre));
    }

    private static function nombreEs(array $json): string
    {
        foreach ($json['names'] ?? [] as $nombre) {
            if (($nombre['language']['name'] ?? null) === 'es') {
                return $nombre['name'];
            }
        }

        foreach ($json['names'] ?? [] as $nombre) {
            if (($nombre['language']['name'] ?? null) === 'en') {
                return $nombre['name'];
            }
        }

        return $json['name'];
    }
}
