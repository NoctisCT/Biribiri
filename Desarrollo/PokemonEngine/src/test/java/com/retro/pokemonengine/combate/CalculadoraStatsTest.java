package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class CalculadoraStatsTest
{
    @Test
    void velocidadDePikachuNivel50ConIvMaximo()
    {
        int velocidad = CalculadoraStats.otro(
                Stat.VELOCIDAD, 90, 31, 0, 50, Naturaleza.porNombre("hardy"));

        assertEquals(110, velocidad);
    }

    @Test
    void elTruncadoIntermedioImporta()
    {
        // (2*90 + 31) * 50 / 100 = 105,5. Sin truncar el paso intermedio saldría 111.
        int conTruncado = CalculadoraStats.otro(
                Stat.VELOCIDAD, 90, 31, 0, 50, Naturaleza.porNombre("hardy"));

        assertEquals(110, conTruncado);
    }

    @Test
    void naturalezaPositivaYNegativaSobreLaMismaBase()
    {
        int neutra = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 252, 100, Naturaleza.porNombre("hardy"));
        int sube = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 252, 100, Naturaleza.porNombre("adamant"));
        int baja = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 252, 100, Naturaleza.porNombre("modest"));

        assertEquals(299, neutra);
        assertEquals(328, sube);
        assertEquals(269, baja);
    }

    @Test
    void psUsaSuPropiaFormula()
    {
        // Blissey nivel 100, base 255, IV 31, EV 0
        assertEquals(651, CalculadoraStats.ps(255, 31, 0, 100));
    }

    @Test
    void laNaturalezaNoAfectaAPs()
    {
        int conNaturalezaQueSubeAtaque = CalculadoraStats.otro(
                Stat.PS, 255, 31, 0, 100, Naturaleza.porNombre("adamant"));

        assertEquals(651, conNaturalezaQueSubeAtaque);
    }

    @Test
    void baseUnoNoEsUnCasoEspecialEnLaFormula()
    {
        // La regla de 1 PS de Shedinja la aplica el motor, no esta fórmula.
        assertEquals(143, CalculadoraStats.ps(1, 31, 0, 100));
    }

    @Test
    void losEvSeCuentanEnCuartos()
    {
        int sinEv = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 0, 100, Naturaleza.porNombre("hardy"));
        int conTres = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 3, 100, Naturaleza.porNombre("hardy"));
        int conCuatro = CalculadoraStats.otro(Stat.ATAQUE, 100, 31, 4, 100, Naturaleza.porNombre("hardy"));

        assertEquals(sinEv, conTres, "Tres EV no llegan a sumar un punto");
        assertEquals(sinEv + 1, conCuatro);
    }

    @Test
    void hayVeinticincoNaturalezas()
    {
        assertEquals(25, Naturaleza.values().length);
    }

    @Test
    void cincoNaturalezasSonNeutras()
    {
        long neutras = java.util.Arrays.stream(Naturaleza.values())
                .filter(n -> n.sube() == null && n.baja() == null)
                .count();

        assertEquals(5, neutras);
    }

    @Test
    void unNombreDesconocidoCaeEnLaNeutraPorDefecto()
    {
        assertEquals(Naturaleza.HARDY, Naturaleza.porNombre("no-existe"));
        assertEquals(Naturaleza.HARDY, Naturaleza.porNombre(null));
    }
}
