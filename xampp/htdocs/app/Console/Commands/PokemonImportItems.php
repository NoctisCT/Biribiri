<?php

namespace App\Console\Commands;

use App\Services\Pokemon\CachePokeApi;
use App\Services\Pokemon\MapeadorObjeto;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PokemonImportItems extends Command
{
    protected $signature = 'pokemon:import-items
        {--limite=0 : Importar solo los N primeros, para pruebas}';

    protected $description = 'Importa el catálogo de objetos desde PokéAPI a pokemon_items';

    public function handle(): int
    {
        if (!$this->esquemaListo()) {
            $this->error('El esquema no está en la versión 4. Arranca el plugin PokemonEngine primero.');
            return self::FAILURE;
        }

        $cache = new CachePokeApi(storage_path('app/pokemon-cache'));

        $indice = $cache->obtener('item?limit=3000');
        $entradas = $indice['results'];
        $limite = (int) $this->option('limite');
        $total = $limite > 0 ? min($limite, count($entradas)) : count($entradas);

        $barra = $this->output->createProgressBar($total);
        $porBolsillo = [];
        $ballsSinRatio = [];

        foreach (array_slice($entradas, 0, $total) as $entrada) {
            $id = (int) basename(rtrim($entrada['url'], '/'));
            $fila = MapeadorObjeto::fila($cache->obtener('item/' . $id));

            // `implemented` no se toca: lo marca quien escribe el efecto, no el importador.
            DB::table('pokemon_items')->updateOrInsert(['id' => $fila['id']], $fila);

            $porBolsillo[$fila['bolsillo']] = ($porBolsillo[$fila['bolsillo']] ?? 0) + 1;

            if ($fila['es_ball'] === 1 && $fila['ball_ratio'] === null
                && $fila['effect_code'] !== 'ball_captura_segura') {
                $ballsSinRatio[] = $fila['nombre'];
            }

            $barra->advance();
        }

        $barra->finish();
        $this->newLine();

        ksort($porBolsillo);

        $this->table(['Bolsillo', 'Objetos'], array_map(
            fn (string $bolsillo, int $cuenta) => [$bolsillo, $cuenta],
            array_keys($porBolsillo),
            $porBolsillo
        ));

        if ($ballsSinRatio !== []) {
            $this->line(sprintf(
                '  %d balls sin multiplicador sembrado (no son de Kanto): %s',
                count($ballsSinRatio),
                implode(', ', array_slice($ballsSinRatio, 0, 8)) . (count($ballsSinRatio) > 8 ? '…' : '')
            ));
            $this->line('  Si alguna hace falta, se añade a MapeadorObjeto::BALLS_KANTO.');
        }

        $this->info('Objetos importados.');

        return self::SUCCESS;
    }

    private function esquemaListo(): bool
    {
        try {
            return (int) DB::table('pokemon_schema_version')->max('version') >= 4;
        } catch (\Throwable) {
            return false;
        }
    }
}
