<?php

namespace Tests\Unit\Pokemon;

use App\Services\Pokemon\CachePokeApi;
use PHPUnit\Framework\TestCase;

class CachePokeApiTest extends TestCase
{
    private string $dir;

    protected function setUp(): void
    {
        $this->dir = sys_get_temp_dir() . '/pkcache-' . uniqid();
        mkdir($this->dir, 0777, true);
    }

    protected function tearDown(): void
    {
        array_map('unlink', glob($this->dir . '/*') ?: []);
        @rmdir($this->dir);
    }

    public function test_descarga_una_vez_y_luego_sirve_de_disco(): void
    {
        $llamadas = 0;

        $cache = new CachePokeApi($this->dir, function (string $ruta) use (&$llamadas) {
            $llamadas++;
            return ['ruta' => $ruta, 'ok' => true];
        });

        $primera = $cache->obtener('move/85');
        $segunda = $cache->obtener('move/85');

        $this->assertSame(1, $llamadas, 'La segunda lectura no debe tocar la red');
        $this->assertSame('move/85', $primera['ruta']);
        $this->assertSame($primera, $segunda);
        $this->assertTrue($cache->estaEnCache('move/85'));
    }

    public function test_rutas_distintas_no_colisionan_en_disco(): void
    {
        $cache = new CachePokeApi($this->dir, fn (string $ruta) => ['ruta' => $ruta]);

        $cache->obtener('move/85');
        $cache->obtener('pokemon/85');

        $this->assertSame('move/85', $cache->obtener('move/85')['ruta']);
        $this->assertSame('pokemon/85', $cache->obtener('pokemon/85')['ruta']);
    }

    public function test_obtener_varias_devuelve_mapa_por_ruta(): void
    {
        $cache = new CachePokeApi($this->dir, fn (string $ruta) => ['ruta' => $ruta]);

        $resultado = $cache->obtenerVarias(['type/1', 'type/2']);

        $this->assertSame(['type/1', 'type/2'], array_keys($resultado));
        $this->assertSame('type/2', $resultado['type/2']['ruta']);
    }
}
