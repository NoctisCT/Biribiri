<?php

namespace App\Console\Commands;

use App\Services\Pokemon\CachePokeApi;
use App\Services\Pokemon\MapeadorEspecie;
use App\Services\Pokemon\MapeadorMovimiento;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PokemonImportCatalog extends Command
{
    protected $signature = 'pokemon:import-catalog
        {--solo= : tipos|habilidades|especies|movimientos|learnsets|evoluciones}
        {--limite=0 : Importar solo los N primeros de cada recurso, para pruebas}';

    protected $description = 'Importa el catálogo Pokémon desde PokéAPI y Showdown a las tablas del plugin';

    private CachePokeApi $cache;

    public function handle(): int
    {
        if (!$this->esquemaListo()) {
            $this->error('El esquema no está en la versión 2. Arranca el plugin PokemonEngine primero.');
            return self::FAILURE;
        }

        $this->cache = new CachePokeApi(storage_path('app/pokemon-cache'));

        $solo = $this->option('solo');
        $pasos = ['tipos', 'habilidades', 'especies', 'movimientos', 'learnsets', 'evoluciones'];

        foreach ($pasos as $paso) {
            if ($solo && $solo !== $paso) {
                continue;
            }

            $this->info("Importando {$paso}…");
            $this->{'importar' . ucfirst($paso)}();
        }

        $this->info('Catálogo importado.');

        return self::SUCCESS;
    }

    private function esquemaListo(): bool
    {
        try {
            return (int) DB::table('pokemon_schema_version')->max('version') >= 2;
        } catch (\Throwable) {
            return false;
        }
    }

    private function limite(int $total): int
    {
        $limite = (int) $this->option('limite');

        return $limite > 0 ? min($limite, $total) : $total;
    }

    private function tiposPorNombre(): array
    {
        return DB::table('pokemon_types')->pluck('id', 'nombre')->all();
    }

    private function importarTipos(): void
    {
        $indice = $this->cache->obtener('type?limit=100');

        foreach ($indice['results'] as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));

            if ($id > 10000) {
                continue;
            }

            $tipo = $this->cache->obtener('type/' . $id);

            DB::table('pokemon_types')->updateOrInsert(
                ['id' => $tipo['id']],
                ['nombre' => $tipo['name'], 'nombre_es' => $this->nombreEs($tipo, $tipo['name'])]
            );
        }

        $this->importarTablaDeTipos();
    }

    private function importarTablaDeTipos(): void
    {
        $ids = DB::table('pokemon_types')->pluck('id', 'nombre')->all();
        $filas = [];

        foreach ($ids as $nombre => $id) {
            $tipo = $this->cache->obtener('type/' . $id);
            $relaciones = $tipo['damage_relations'];

            foreach ($ids as $nombreDefensor => $idDefensor) {
                $multiplicador = 1.0;

                foreach ($relaciones['no_damage_to'] as $r) {
                    if ($r['name'] === $nombreDefensor) $multiplicador = 0.0;
                }
                foreach ($relaciones['half_damage_to'] as $r) {
                    if ($r['name'] === $nombreDefensor) $multiplicador = 0.5;
                }
                foreach ($relaciones['double_damage_to'] as $r) {
                    if ($r['name'] === $nombreDefensor) $multiplicador = 2.0;
                }

                $filas[] = [
                    'atacante_id' => $id,
                    'defensor_id' => $idDefensor,
                    'multiplicador' => $multiplicador,
                ];
            }
        }

        DB::table('pokemon_type_chart')->upsert($filas, ['atacante_id', 'defensor_id'], ['multiplicador']);

        $this->line('  Tabla de tipos: ' . count($filas) . ' combinaciones');
    }

    private function importarHabilidades(): void
    {
        $indice = $this->cache->obtener('ability?limit=400');
        $total = $this->limite(count($indice['results']));
        $barra = $this->output->createProgressBar($total);

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));
            $habilidad = $this->cache->obtener('ability/' . $id);

            DB::table('pokemon_abilities_cat')->updateOrInsert(
                ['id' => $id],
                [
                    'nombre' => $habilidad['name'],
                    'nombre_es' => $this->nombreEs($habilidad, $habilidad['name']),
                    'descripcion_es' => $this->textoEs($habilidad),
                ]
            );

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();
    }

    private function importarEspecies(): void
    {
        $indice = $this->cache->obtener('pokemon-species?limit=1100');
        $total = $this->limite(count($indice['results']));
        $tipos = $this->tiposPorNombre();
        $barra = $this->output->createProgressBar($total);

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));

            $especie = $this->cache->obtener('pokemon-species/' . $id);
            $pokemon = $this->cache->obtener('pokemon/' . $id);

            $fila = MapeadorEspecie::fila($especie, $pokemon, $tipos);

            DB::table('pokemon_species')->updateOrInsert(
                ['id' => $fila['id'], 'form_id' => $fila['form_id']],
                $fila
            );

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();
    }

    /**
     * Descarga el moves.js de Showdown una sola vez y lo convierte a JSON con Node,
     * porque es JavaScript con claves sin comillas y no se puede parsear como JSON.
     *
     * @return array<string, array>
     */
    private function movimientosShowdown(): array
    {
        $destinoJson = storage_path('app/pokemon-cache/showdown-moves.json');

        if (is_file($destinoJson)) {
            return json_decode(file_get_contents($destinoJson), true);
        }

        $destinoJs = storage_path('app/pokemon-cache/showdown-moves.js');

        if (!is_file($destinoJs)) {
            $this->line('  Descargando datos de Showdown…');
            file_put_contents($destinoJs, file_get_contents('https://play.pokemonshowdown.com/data/moves.js'));
        }

        // En Windows, escapeshellarg rompe las comillas de un script pasado con `node -e`,
        // así que el conversor se escribe a disco y se ejecuta como fichero.
        $conversor = storage_path('app/pokemon-cache/convertir-showdown.js');

        file_put_contents($conversor, sprintf(
            "const m = require(%s).BattleMovedex;\n" .
            "require('fs').writeFileSync(%s, JSON.stringify(m));\n",
            json_encode(str_replace('\\', '/', $destinoJs)),
            json_encode(str_replace('\\', '/', $destinoJson))
        ));

        shell_exec('node ' . escapeshellarg($conversor) . ' 2>&1');

        if (!is_file($destinoJson)) {
            throw new RuntimeException('No se pudo convertir moves.js con Node. ¿Está node en el PATH?');
        }

        return json_decode(file_get_contents($destinoJson), true);
    }

    private function importarMovimientos(): void
    {
        $indice = $this->cache->obtener('move?limit=1000');
        $total = $this->limite(count($indice['results']));
        $tipos = $this->tiposPorNombre();
        $showdown = $this->movimientosShowdown();
        $barra = $this->output->createProgressBar($total);
        $efectos = [];
        $sinShowdown = 0;

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));
            $movimiento = $this->cache->obtener('move/' . $id);

            $clave = MapeadorMovimiento::claveShowdown($movimiento['name']);
            $sd = $showdown[$clave] ?? null;

            if ($sd === null) {
                $sinShowdown++;
            }

            $fila = MapeadorMovimiento::fila($movimiento, $sd, $tipos);
            $fila['sin_showdown'] = $sd === null ? 1 : 0;

            DB::table('pokemon_moves')->updateOrInsert(['id' => $fila['id']], $fila);

            $efectos[$fila['effect_code']] = $fila['categoria'];

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();

        foreach ($efectos as $codigo => $categoria) {
            DB::table('pokemon_move_effects')->updateOrInsert(
                ['effect_code' => $codigo],
                ['descripcion' => 'Categoría ' . $categoria]
            );
        }

        $this->line('  Efectos distintos: ' . count($efectos));
        $this->line('  Movimientos sin entrada en Showdown: ' . $sinShowdown . ' (quedan como no vigentes)');
    }

    private function importarLearnsets(): void
    {
        $indice = $this->cache->obtener('pokemon-species?limit=1100');
        $total = $this->limite(count($indice['results']));
        $barra = $this->output->createProgressBar($total);

        $movimientosConocidos = DB::table('pokemon_moves')->pluck('id')->flip();

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));
            $pokemon = $this->cache->obtener('pokemon/' . $id);
            $filas = [];

            foreach ($pokemon['moves'] ?? [] as $movimiento) {
                $moveId = (int) basename(rtrim($movimiento['move']['url'], '/'));

                if (!isset($movimientosConocidos[$moveId])) {
                    continue;
                }

                foreach ($movimiento['version_group_details'] as $detalle) {
                    $clave = $moveId . '|' . $detalle['move_learn_method']['name'] . '|' . (int) $detalle['level_learned_at'];

                    $filas[$clave] = [
                        'species_id' => $id,
                        'form_id' => 0,
                        'move_id' => $moveId,
                        'metodo' => $detalle['move_learn_method']['name'],
                        'nivel' => (int) $detalle['level_learned_at'],
                    ];
                }
            }

            foreach (array_chunk(array_values($filas), 500) as $lote) {
                DB::table('pokemon_learnsets')->upsert(
                    $lote,
                    ['species_id', 'form_id', 'move_id', 'metodo', 'nivel'],
                    ['nivel']
                );
            }

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();
    }

    private function importarEvoluciones(): void
    {
        $indice = $this->cache->obtener('evolution-chain?limit=600');
        $total = $this->limite(count($indice['results']));
        $barra = $this->output->createProgressBar($total);

        DB::table('pokemon_species_evolution')->truncate();

        foreach (array_slice($indice['results'], 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));
            $cadena = $this->cache->obtener('evolution-chain/' . $id);

            $this->recorrerCadena($cadena['chain']);

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();
    }

    private function recorrerCadena(array $nodo): void
    {
        $origenId = (int) basename(rtrim($nodo['species']['url'], '/'));

        foreach ($nodo['evolves_to'] ?? [] as $hijo) {
            $destinoId = (int) basename(rtrim($hijo['species']['url'], '/'));

            foreach ($hijo['evolution_details'] ?? [] as $detalle) {
                DB::table('pokemon_species_evolution')->insert([
                    'origen_id' => $origenId,
                    'destino_id' => $destinoId,
                    'metodo' => $detalle['trigger']['name'] ?? 'level-up',
                    'parametro' => $detalle['item']['name'] ?? ($detalle['held_item']['name'] ?? null),
                    'nivel_minimo' => $detalle['min_level'] ?? null,
                    'condicion' => $this->condicion($detalle),
                ]);
            }

            $this->recorrerCadena($hijo);
        }
    }

    private function condicion(array $detalle): ?string
    {
        $partes = [];

        if (!empty($detalle['min_happiness'])) $partes[] = 'amistad>=' . $detalle['min_happiness'];
        if (!empty($detalle['time_of_day'])) $partes[] = 'hora=' . $detalle['time_of_day'];
        if (!empty($detalle['known_move']['name'])) $partes[] = 'sabe=' . $detalle['known_move']['name'];
        if (!empty($detalle['location']['name'])) $partes[] = 'lugar=' . $detalle['location']['name'];
        if (isset($detalle['gender']) && $detalle['gender'] !== null) $partes[] = 'genero=' . $detalle['gender'];

        return $partes === [] ? null : implode(',', $partes);
    }

    private function nombreEs(array $json, string $porDefecto): string
    {
        foreach ($json['names'] ?? [] as $nombre) {
            if (($nombre['language']['name'] ?? null) === 'es') {
                return $nombre['name'];
            }
        }

        return $porDefecto;
    }

    private function textoEs(array $json): ?string
    {
        foreach ($json['flavor_text_entries'] ?? [] as $entrada) {
            if (($entrada['language']['name'] ?? null) === 'es') {
                return $entrada['flavor_text'];
            }
        }

        return null;
    }
}
