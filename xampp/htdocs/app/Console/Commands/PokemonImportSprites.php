<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

/**
 * Baja los sprites de una especie desde PMDCollab/SpriteCollab.
 *
 * Una carpeta por especie, con el nombre de cuatro dígitos que espera el
 * cliente: `public/dist/pokemon/sprite/0197/`. Dentro, el `AnimData.xml` y un
 * par de PNG por animación — el de dibujo y el de la sombra.
 *
 * Qué animaciones bajar no se adivina: se leen del propio `AnimData.xml`, que
 * es la lista que el cliente va a pedir. Una especie con animaciones que otra
 * no tiene se descarga entera igual.
 */
class PokemonImportSprites extends Command
{
    protected $signature = 'pokemon:import-sprites
        {especies* : Ids de especie, por ejemplo 197 25}
        {--forzar : Volver a bajar lo que ya esté descargado}';

    protected $description = 'Descarga los sprites PMD de una o varias especies desde SpriteCollab';

    private const BASE = 'https://raw.githubusercontent.com/PMDCollab/SpriteCollab/master/sprite/';

    public function handle(): int
    {
        $destinoBase = public_path('dist/pokemon/sprite');
        $fallos = 0;

        foreach ($this->argument('especies') as $bruto) {
            $id = (int) $bruto;

            if ($id <= 0) {
                $this->error("Id de especie inválido: {$bruto}");
                $fallos++;
                continue;
            }

            $fallos += $this->bajarEspecie($id, $destinoBase) ? 0 : 1;
        }

        return $fallos === 0 ? self::SUCCESS : self::FAILURE;
    }

    private function bajarEspecie(int $id, string $destinoBase): bool
    {
        $carpeta = str_pad((string) $id, 4, '0', STR_PAD_LEFT);
        $destino = $destinoBase . DIRECTORY_SEPARATOR . $carpeta;

        if (is_dir($destino) && !$this->option('forzar')) {
            $this->line("  {$carpeta}: ya estaba descargado");
            return true;
        }

        $animData = $this->traer($carpeta . '/AnimData.xml');

        if ($animData === null) {
            $this->error("  {$carpeta}: SpriteCollab no tiene esa especie");
            return false;
        }

        if (!is_dir($destino) && !mkdir($destino, 0775, true) && !is_dir($destino)) {
            $this->error("  {$carpeta}: no se pudo crear {$destino}");
            return false;
        }

        file_put_contents($destino . DIRECTORY_SEPARATOR . 'AnimData.xml', $animData);

        $animaciones = $this->animacionesDe($animData);

        if ($animaciones === []) {
            $this->error("  {$carpeta}: el AnimData.xml no declara ninguna animación");
            return false;
        }

        $barra = $this->output->createProgressBar(count($animaciones) * 2);
        $faltan = [];

        foreach ($animaciones as $animacion) {
            foreach (['Anim', 'Shadow'] as $tipo) {
                $fichero = "{$animacion}-{$tipo}.png";
                $contenido = $this->traer("{$carpeta}/{$fichero}");

                // Faltan sombras en bastantes especies y el cliente no las usa
                // todavía: se anotan y se sigue, no es motivo para abortar.
                if ($contenido === null) {
                    $faltan[] = $fichero;
                } else {
                    file_put_contents($destino . DIRECTORY_SEPARATOR . $fichero, $contenido);
                }

                $barra->advance();
            }
        }

        $barra->finish();
        $this->newLine();

        $this->info("  {$carpeta}: " . count($animaciones) . ' animaciones en ' . $destino);

        if ($faltan !== []) {
            $this->warn('  Sin descargar (' . count($faltan) . '): ' . implode(', ', array_slice($faltan, 0, 8))
                . (count($faltan) > 8 ? '…' : ''));
        }

        return true;
    }

    /** @return string[] */
    private function animacionesDe(string $animData): array
    {
        if (!preg_match_all('#<Name>([^<]+)</Name>#', $animData, $coincidencias)) {
            return [];
        }

        return array_values(array_unique($coincidencias[1]));
    }

    private function traer(string $ruta): ?string
    {
        $curl = curl_init(self::BASE . $ruta);

        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_USERAGENT => 'PokemonEngine sprite importer',
        ]);

        $cuerpo = curl_exec($curl);
        $codigo = curl_getinfo($curl, CURLINFO_HTTP_CODE);

        curl_close($curl);

        return ($cuerpo === false || $codigo !== 200) ? null : $cuerpo;
    }
}
