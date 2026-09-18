<?php

namespace App\Services\Pokemon;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class CachePokeApi
{
    private const BASE = 'https://pokeapi.co/api/v2/';

    /** @var callable(string): array */
    private $descargador;

    public function __construct(
        private readonly string $directorio,
        ?callable $descargador = null
    ) {
        if (!is_dir($this->directorio)) {
            mkdir($this->directorio, 0777, true);
        }

        $this->descargador = $descargador ?? function (string $ruta): array {
            $respuesta = Http::timeout(30)->retry(3, 500)->get(self::BASE . $ruta);

            if (!$respuesta->successful()) {
                throw new RuntimeException("PokéAPI devolvió {$respuesta->status()} para {$ruta}");
            }

            return $respuesta->json();
        };
    }

    public function estaEnCache(string $ruta): bool
    {
        return is_file($this->rutaEnDisco($ruta));
    }

    public function obtener(string $ruta): array
    {
        $fichero = $this->rutaEnDisco($ruta);

        if (is_file($fichero)) {
            $contenido = json_decode(file_get_contents($fichero), true);

            if (is_array($contenido)) {
                return $contenido;
            }
        }

        $datos = ($this->descargador)($ruta);

        file_put_contents($fichero, json_encode($datos, JSON_UNESCAPED_UNICODE));

        return $datos;
    }

    /**
     * @param string[] $rutas
     * @return array<string, array>
     */
    public function obtenerVarias(array $rutas, int $concurrencia = 8): array
    {
        $resultado = [];

        foreach (array_chunk($rutas, max(1, $concurrencia)) as $lote) {
            foreach ($lote as $ruta) {
                $resultado[$ruta] = $this->obtener($ruta);
            }
        }

        return $resultado;
    }

    private function rutaEnDisco(string $ruta): string
    {
        return $this->directorio . '/' . str_replace(['/', '\\', '?', '=', '&'], '_', trim($ruta, '/')) . '.json';
    }
}
