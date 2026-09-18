<?php

namespace Tests\Unit\Pokemon;

use App\Services\Pokemon\MapeadorMovimiento;
use PHPUnit\Framework\TestCase;

class MapeadorMovimientoTest extends TestCase
{
    private array $tipos = ['electric' => 13, 'ice' => 15, 'psychic' => 14, 'normal' => 1];

    private function fixture(string $nombre): array
    {
        return json_decode(file_get_contents(__DIR__ . '/../../Fixtures/Pokemon/' . $nombre . '.json'), true);
    }

    private function showdown(string $clave): array
    {
        $todos = json_decode(file_get_contents(__DIR__ . '/../../Fixtures/Pokemon/showdown-moves.json'), true);

        return $todos[$clave];
    }

    public function test_movimiento_de_dano_con_estado(): void
    {
        $fila = MapeadorMovimiento::fila($this->fixture('move-85'), $this->showdown('thunderbolt'), $this->tipos);

        $this->assertSame(85, $fila['id']);
        $this->assertSame('Rayo', $fila['nombre_es']);
        $this->assertSame(13, $fila['type_id']);
        $this->assertSame('special', $fila['clase']);
        $this->assertSame(90, $fila['potencia']);
        $this->assertSame(100, $fila['precision_pct']);
        $this->assertSame(15, $fila['pp']);
        $this->assertSame(0, $fila['prioridad']);
        $this->assertSame('damage-ailment', $fila['categoria']);
        $this->assertSame('damage-ailment', $fila['effect_code']);
        $this->assertSame('paralysis', $fila['dolencia']);
        $this->assertSame(10, $fila['dolencia_chance']);
        $this->assertSame(1, $fila['vigente']);
        $this->assertSame(1, json_decode($fila['flags'], true)['protect'] ?? 0, 'Rayo es bloqueable por Protección');
    }

    public function test_velo_aurora_se_resuelve_como_condicion_de_bando(): void
    {
        $fila = MapeadorMovimiento::fila(
            $this->fixture('move-aurora-veil'),
            $this->showdown('auroraveil'),
            $this->tipos
        );

        $this->assertSame('Velo Aurora', $fila['nombre_es']);
        $this->assertSame('field-effect', $fila['categoria']);
        $this->assertSame('users-field', $fila['objetivo']);
        $this->assertSame('auroraveil', $fila['condicion_bando']);
        $this->assertSame(5, $fila['duracion'], 'La duración viene en los datos, no se escribe a mano');
        $this->assertSame('bando_auroraveil', $fila['effect_code']);
    }

    public function test_amago_rompe_proteccion_y_no_es_bloqueable(): void
    {
        $fila = MapeadorMovimiento::fila(
            $this->fixture('move-feint'),
            $this->showdown('feint'),
            $this->tipos
        );

        $this->assertSame(2, $fila['prioridad']);
        $this->assertSame(1, $fila['rompe_proteccion']);
        $this->assertSame(0, json_decode($fila['flags'], true)['protect'] ?? 0);
    }

    public function test_sin_datos_de_showdown_la_fila_queda_no_vigente(): void
    {
        $fila = MapeadorMovimiento::fila($this->fixture('move-85'), null, $this->tipos);

        $this->assertSame(0, $fila['vigente']);
        $this->assertSame(85, $fila['id']);
    }

    public function test_clave_showdown_normaliza_el_nombre(): void
    {
        $this->assertSame('auroraveil', MapeadorMovimiento::claveShowdown('aurora-veil'));
        $this->assertSame('thunderbolt', MapeadorMovimiento::claveShowdown('thunderbolt'));
        $this->assertSame('kingsshield', MapeadorMovimiento::claveShowdown("king's-shield"));
    }

    public function test_el_reparto_de_categorias_no_solapa(): void
    {
        $solape = array_intersect(
            MapeadorMovimiento::CATEGORIAS_GENERICAS,
            MapeadorMovimiento::CATEGORIAS_MANUALES
        );

        $this->assertSame([], $solape);
        $this->assertCount(
            14,
            array_merge(MapeadorMovimiento::CATEGORIAS_GENERICAS, MapeadorMovimiento::CATEGORIAS_MANUALES)
        );
    }
}
