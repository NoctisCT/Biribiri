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
