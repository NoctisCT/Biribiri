<?php

namespace Tests\Unit\Pokemon;

use App\Services\Pokemon\MapeadorEspecie;
use PHPUnit\Framework\TestCase;

class MapeadorEspecieTest extends TestCase
{
    private function fixture(string $nombre): array
    {
        return json_decode(file_get_contents(__DIR__ . '/../../Fixtures/Pokemon/' . $nombre . '.json'), true);
    }

    public function test_mapea_pikachu(): void
    {
        $fila = MapeadorEspecie::fila(
            $this->fixture('species-25'),
            $this->fixture('pokemon-25'),
            ['electric' => 13]
        );

        $this->assertSame(25, $fila['id']);
        $this->assertSame('Pikachu', $fila['nombre_es']);
        $this->assertSame(13, $fila['type_1_id']);
        $this->assertNull($fila['type_2_id']);
        $this->assertSame(35, $fila['base_hp']);
        $this->assertSame(55, $fila['base_attack']);
        $this->assertSame(90, $fila['base_speed']);
        $this->assertSame(2, $fila['yield_speed'], 'Pikachu da 2 EV de Velocidad');
        $this->assertSame(0, $fila['yield_hp']);
        $this->assertSame(190, $fila['catch_rate']);
        $this->assertSame(50.0, $fila['female_ratio']);
        $this->assertSame(0, $fila['es_legendario']);
        $this->assertSame(1, $fila['generacion']);
    }

    public function test_ficha_de_pokedex_categoria_numero_regional_y_cry(): void
    {
        $fila = MapeadorEspecie::fila(
            $this->fixture('species-25'),
            $this->fixture('pokemon-25'),
            ['electric' => 13]
        );

        $this->assertSame('Pokémon Ratón', $fila['categoria_es']);
        $this->assertStringContainsString('cola', $fila['descripcion_es']);
        $this->assertStringNotContainsString("
", $fila['descripcion_es'], 'Sin saltos de linea del juego');
        $this->assertSame(25, $fila['numero_regional'], 'En Kanto coincide con el nacional');
        $this->assertStringEndsWith('25.ogg', $fila['cry_url']);
    }

    public function test_una_especie_sin_datos_en_espanol_no_revienta(): void
    {
        $especie = $this->fixture('species-25');
        $especie['genera'] = [];
        $especie['flavor_text_entries'] = [];
        $especie['pokedex_numbers'] = [];

        $pokemon = $this->fixture('pokemon-25');
        unset($pokemon['cries']);

        $fila = MapeadorEspecie::fila($especie, $pokemon, ['electric' => 13]);

        $this->assertNull($fila['categoria_es']);
        $this->assertNull($fila['descripcion_es']);
        $this->assertNull($fila['numero_regional']);
        $this->assertNull($fila['cry_url']);
    }

    public function test_el_ratio_de_genero_negativo_significa_sin_genero(): void
    {
        $especie = $this->fixture('species-25');
        $especie['gender_rate'] = -1;

        $fila = MapeadorEspecie::fila($especie, $this->fixture('pokemon-25'), ['electric' => 13]);

        $this->assertNull($fila['female_ratio']);
    }

    public function test_la_habilidad_oculta_va_a_su_columna(): void
    {
        $fila = MapeadorEspecie::fila(
            $this->fixture('species-25'),
            $this->fixture('pokemon-25'),
            ['electric' => 13]
        );

        $this->assertNotNull($fila['ability_1_id']);
        $this->assertNotNull($fila['ability_hidden_id']);
        $this->assertNotSame($fila['ability_1_id'], $fila['ability_hidden_id']);
    }
}
