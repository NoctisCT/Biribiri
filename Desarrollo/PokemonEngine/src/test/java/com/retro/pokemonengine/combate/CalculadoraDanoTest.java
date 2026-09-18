package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CalculadoraDanoTest
{
    private CalculadoraDano.EntradaDano basica()
    {
        return new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, false, false, true, 1.0, 100);
    }

    @Test
    void elDanoBaseSigueLaFormulaDeLosJuegos()
    {
        // floor(floor(floor(2*50/5 + 2) * 90 * 120 / 100) / 50) + 2
        // = floor(2376 / 50) + 2 = 47 + 2 = 49
        assertEquals(49, CalculadoraDano.base(50, 90, 120, 100));
    }

    @Test
    void sinModificadoresElDanoEsElBase()
    {
        assertEquals(49, CalculadoraDano.calcular(basica()));
    }

    @Test
    void elStabMultiplicaPorUnoComaCinco()
    {
        CalculadoraDano.EntradaDano e = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, true, false, false, true, 1.0, 100);

        assertEquals(73, CalculadoraDano.calcular(e));
    }

    @Test
    void laEfectividadCeroAnulaElDano()
    {
        CalculadoraDano.EntradaDano e = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 0.0, true, true, false, true, 1.0, 100);

        assertEquals(0, CalculadoraDano.calcular(e));
    }

    @Test
    void elCriticoMultiplicaPorUnoComaCinco()
    {
        CalculadoraDano.EntradaDano e = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, true, false, true, 1.0, 100);

        assertEquals(73, CalculadoraDano.calcular(e));
    }

    @Test
    void laQuemaduraSoloAfectaAMovimientosFisicos()
    {
        CalculadoraDano.EntradaDano fisico = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, false, true, true, 1.0, 100);
        CalculadoraDano.EntradaDano especial = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, false, true, false, 1.0, 100);

        assertEquals(24, CalculadoraDano.calcular(fisico));
        assertEquals(49, CalculadoraDano.calcular(especial));
    }

    @Test
    void laVariacionReduceElDanoHastaUnQuincePorCiento()
    {
        CalculadoraDano.EntradaDano minima = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, false, false, true, 1.0, 85);

        assertEquals(41, CalculadoraDano.calcular(minima));
    }

    @Test
    void laEfectividadCuadruplicaYCuartea()
    {
        CalculadoraDano.EntradaDano cuadruple = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 4.0, false, false, false, true, 1.0, 100);
        CalculadoraDano.EntradaDano cuarto = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 0.25, false, false, false, true, 1.0, 100);

        assertEquals(196, CalculadoraDano.calcular(cuadruple));
        assertEquals(12, CalculadoraDano.calcular(cuarto));
    }

    @Test
    void unGolpeQueAciertaNuncaHaceCeroSalvoInmunidad()
    {
        CalculadoraDano.EntradaDano flojo = new CalculadoraDano.EntradaDano(
                1, 10, 1, 255, 0.25, false, false, true, true, 1.0, 85);

        assertTrue(CalculadoraDano.calcular(flojo) >= 1);
    }

    @Test
    void unaDefensaDeCeroNoRompeElCalculo()
    {
        assertTrue(CalculadoraDano.base(50, 90, 120, 0) > 0);
    }

    @Test
    void elClimaEsUnMultiplicadorMas()
    {
        CalculadoraDano.EntradaDano bajoLluvia = new CalculadoraDano.EntradaDano(
                50, 90, 120, 100, 1.0, false, false, false, false, 1.5, 100);

        assertEquals(73, CalculadoraDano.calcular(bajoLluvia));
    }
}
