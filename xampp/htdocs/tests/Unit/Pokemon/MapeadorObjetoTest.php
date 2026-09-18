<?php

namespace Tests\Unit\Pokemon;

use App\Services\Pokemon\MapeadorObjeto;
use PHPUnit\Framework\TestCase;

class MapeadorObjetoTest extends TestCase
{
    private function fixture(string $nombre): array
    {
        return json_decode(file_get_contents(__DIR__ . '/../../Fixtures/Pokemon/item-' . $nombre . '.json'), true);
    }

    public function test_cada_categoria_cae_en_su_bolsillo(): void
    {
        $esperado = [
            'poke-ball' => 'BALLS',
            'luxury-ball' => 'BALLS',
            'potion' => 'MEDICINAS',
            'ether' => 'MEDICINAS',
            'oran-berry' => 'BAYAS',
            'tm01' => 'MO_MT',
            'ss-ticket' => 'CLAVE',
            'growth-mulch' => 'OBJETOS',
        ];

        foreach ($esperado as $objeto => $bolsillo) {
            $fila = MapeadorObjeto::fila($this->fixture($objeto));

            $this->assertSame($bolsillo, $fila['bolsillo'], "{$objeto} debería ir al bolsillo {$bolsillo}");
        }
    }

    public function test_una_categoria_desconocida_cae_en_objetos(): void
    {
        $fila = MapeadorObjeto::fila([
            'id' => 9001,
            'name' => 'cosa-rara',
            'category' => ['name' => 'categoria-que-no-existe'],
        ]);

        $this->assertSame('OBJETOS', $fila['bolsillo']);
        $this->assertSame(0, $fila['es_ball']);
        $this->assertNull($fila['ball_ratio']);
        $this->assertSame('sin_implementar', $fila['effect_code']);
    }

    public function test_una_baya_va_a_bayas_aunque_su_categoria_sea_medicine(): void
    {
        $baya = $this->fixture('oran-berry');

        $this->assertSame('medicine', $baya['category']['name']);
        $this->assertSame('BAYAS', MapeadorObjeto::fila($baya)['bolsillo']);
    }

    public function test_el_precio_sale_de_prices_prefiriendo_kanto(): void
    {
        $fila = MapeadorObjeto::fila($this->fixture('great-ball'));

        $this->assertSame(600, $fila['precio']);
        $this->assertSame(300, $fila['precio_venta']);
    }

    public function test_sin_prices_el_precio_sale_de_la_tabla_sembrada(): void
    {
        // PokéAPI ya no expone `cost` y devuelve `prices` vacío para media
        // Kanto: sin la tabla sembrada, la Poké Ball valdría cero.
        $this->assertSame([], $this->fixture('poke-ball')['prices']);

        $fila = MapeadorObjeto::fila($this->fixture('poke-ball'));

        $this->assertSame(200, $fila['precio']);
        $this->assertSame(100, $fila['precio_venta']);
    }

    public function test_el_precio_de_venta_es_la_mitad_del_de_compra(): void
    {
        foreach (['potion', 'super-potion', 'ether'] as $objeto) {
            $fila = MapeadorObjeto::fila($this->fixture($objeto));

            $this->assertGreaterThan(0, $fila['precio'], "{$objeto} debería tener precio");
            $this->assertSame(intdiv($fila['precio'], 2), $fila['precio_venta']);
        }
    }

    public function test_un_objeto_sin_precio_conocido_vale_cero(): void
    {
        $fila = MapeadorObjeto::fila($this->fixture('growth-mulch'));

        $this->assertSame(0, $fila['precio']);
        $this->assertSame(0, $fila['precio_venta']);
    }

    public function test_una_ball_sembrada_lleva_su_multiplicador(): void
    {
        $fila = MapeadorObjeto::fila($this->fixture('great-ball'));

        $this->assertSame(1, $fila['es_ball']);
        $this->assertSame(1.5, $fila['ball_ratio']);
        $this->assertSame('ball', $fila['effect_code']);
    }

    public function test_una_ball_sin_multiplicador_sembrado_queda_marcada(): void
    {
        $fila = MapeadorObjeto::fila($this->fixture('luxury-ball'));

        $this->assertSame(1, $fila['es_ball']);
        $this->assertNull($fila['ball_ratio'], 'La Lujo Ball no es de Kanto: no debe inventarse un multiplicador');
        $this->assertSame('sin_implementar', $fila['effect_code']);
    }

    public function test_la_master_ball_captura_siempre_y_no_tiene_multiplicador(): void
    {
        $fila = MapeadorObjeto::fila($this->fixture('master-ball'));

        $this->assertSame(1, $fila['es_ball']);
        $this->assertNull($fila['ball_ratio']);
        $this->assertSame('ball_captura_segura', $fila['effect_code']);
    }

    public function test_los_objetos_clave_no_se_apilan(): void
    {
        $this->assertSame(1, MapeadorObjeto::fila($this->fixture('ss-ticket'))['tope_pila']);
        $this->assertSame(999, MapeadorObjeto::fila($this->fixture('potion'))['tope_pila']);
    }

    public function test_nombre_y_descripcion_en_espanol(): void
    {
        $fila = MapeadorObjeto::fila($this->fixture('great-ball'));

        $this->assertSame(3, $fila['id']);
        $this->assertSame('great-ball', $fila['nombre']);
        $this->assertSame('Super Ball', $fila['nombre_es']);
        $this->assertStringContainsString('Poké Ball', $fila['descripcion_es']);
    }
}
