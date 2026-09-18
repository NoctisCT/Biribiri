<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PokemonVerifyCatalog extends Command
{
    protected $signature = 'pokemon:verify-catalog';
    protected $description = 'Comprueba la coherencia del catálogo Pokémon y lo que falta por implementar';

    public function handle(): int
    {
        $problemas = 0;

        $this->info('Recuentos');
        $this->table(['Tabla', 'Filas'], [
            ['pokemon_types', DB::table('pokemon_types')->count()],
            ['pokemon_type_chart', DB::table('pokemon_type_chart')->count()],
            ['pokemon_abilities_cat', DB::table('pokemon_abilities_cat')->count()],
            ['pokemon_species', DB::table('pokemon_species')->count()],
            ['pokemon_species_evolution', DB::table('pokemon_species_evolution')->count()],
            ['pokemon_moves', DB::table('pokemon_moves')->count()],
            ['pokemon_learnsets', DB::table('pokemon_learnsets')->count()],
        ]);

        $tabla = DB::table('pokemon_type_chart')->count();
        $tipos = DB::table('pokemon_types')->count();

        if ($tabla !== $tipos * $tipos) {
            $this->error("La tabla de tipos tiene {$tabla} filas y debería tener " . ($tipos * $tipos));
            $problemas++;
        }

        $huerfanos = DB::table('pokemon_learnsets as l')
            ->leftJoin('pokemon_moves as m', 'l.move_id', '=', 'm.id')
            ->whereNull('m.id')
            ->count();

        if ($huerfanos > 0) {
            $this->error("{$huerfanos} filas de learnset apuntan a movimientos inexistentes");
            $problemas++;
        }

        $sinTipo = DB::table('pokemon_species as s')
            ->leftJoin('pokemon_types as t', 's.type_1_id', '=', 't.id')
            ->whereNull('t.id')
            ->count();

        if ($sinTipo > 0) {
            $this->error("{$sinTipo} especies tienen un tipo primario inexistente");
            $problemas++;
        }

        $evolucionesRotas = DB::table('pokemon_species_evolution as e')
            ->leftJoin('pokemon_species as s', 'e.destino_id', '=', 's.id')
            ->whereNull('s.id')
            ->count();

        if ($evolucionesRotas > 0) {
            $this->error("{$evolucionesRotas} evoluciones apuntan a especies inexistentes");
            $problemas++;
        }

        $this->newLine();
        $this->info('Movimientos');

        $vigentes = DB::table('pokemon_moves')->where('vigente', 1)->count();
        $noVigentes = DB::table('pokemon_moves')->where('vigente', 0)->count();
        $implementados = DB::table('pokemon_move_effects')->where('implemented', 1)->count();
        $porImplementar = DB::table('pokemon_move_effects')->where('implemented', 0)->count();

        $this->line("  Vigentes: {$vigentes}");
        $this->line("  No vigentes (Z, Dinamax, retirados o sin datos de Showdown): {$noVigentes}");
        $this->line("  Efectos implementados: {$implementados}");
        $this->line("  Efectos sin implementar: {$porImplementar}");

        $this->newLine();
        $this->info('Primitivas que el motor debe implementar');

        foreach ([
            'condicion_bando' => 'Condiciones de bando',
            'clima' => 'Climas',
            'terreno' => 'Terrenos',
            'estado_volatil' => 'Estados volátiles',
            'condicion_hueco' => 'Condiciones de hueco',
        ] as $columna => $titulo) {
            $filas = DB::table('pokemon_moves')
                ->select($columna, DB::raw('COUNT(*) as total'))
                ->whereNotNull($columna)
                ->where('vigente', 1)
                ->groupBy($columna)
                ->orderBy($columna)
                ->get();

            $this->line(sprintf(
                '  %-24s %2d distintas en %3d movimientos',
                $titulo . ':',
                $filas->count(),
                $filas->sum('total')
            ));
        }

        $this->newLine();
        $this->info('Movimientos sin correspondencia en los datos de Showdown');

        $sinShowdown = DB::table('pokemon_moves')->where('sin_showdown', 1)->get();

        // Los movimientos Z llevan sufijo de clase y los Oscuros vienen de
        // Pokémon XD/Colosseum: ninguno existe en los juegos principales.
        $esRuido = fn ($m) =>
            str_contains($m->nombre, '--physical')
            || str_contains($m->nombre, '--special')
            || str_starts_with($m->nombre, 'shadow-')
            || str_starts_with($m->nombre, 'max-')
            || str_starts_with($m->nombre, 'g-max-');

        $ruido = $sinShowdown->filter($esRuido);
        $revisar = $sinShowdown->reject($esRuido);

        $this->line('  Total sin correspondencia: ' . $sinShowdown->count());
        $this->line('  De ellos, movimientos Z, Maxi u Oscuros (descartables): ' . $ruido->count());

        if ($revisar->isEmpty()) {
            $this->line('  Ninguno pendiente de revisar.');
        } else {
            $this->error('  PENDIENTES DE REVISAR: ' . $revisar->count());

            $this->table(['Id', 'Nombre', 'Nombre ES', 'Especies de Kanto'], $revisar->map(fn ($m) => [
                $m->id,
                $m->nombre,
                $m->nombre_es,
                DB::table('pokemon_learnsets')
                    ->where('move_id', $m->id)
                    ->where('species_id', '<=', 151)
                    ->distinct()
                    ->count('species_id'),
            ])->all());

            $this->line('  Si alguno es legítimo, añadir su alias a MapeadorMovimiento::ALIAS_SHOWDOWN.');
            $problemas++;
        }

        $this->newLine();
        $sueltos = DB::table('pokemon_moves')
            ->where('vigente', 1)
            ->where('effect_code', 'like', 'manual_%')
            ->count();

        $this->info("Movimientos vigentes que siguen necesitando código propio: {$sueltos}");

        $this->table(['Categoría', 'Movimientos'], DB::table('pokemon_moves')
            ->select('categoria', DB::raw('COUNT(*) as total'))
            ->where('vigente', 1)
            ->where('effect_code', 'like', 'manual_%')
            ->groupBy('categoria')
            ->orderByDesc('total')
            ->get()
            ->map(fn ($f) => [$f->categoria, $f->total])
            ->all());

        if ($problemas > 0) {
            $this->error("{$problemas} problemas de coherencia.");
            return self::FAILURE;
        }

        $this->info('Catálogo coherente.');

        return self::SUCCESS;
    }
}
