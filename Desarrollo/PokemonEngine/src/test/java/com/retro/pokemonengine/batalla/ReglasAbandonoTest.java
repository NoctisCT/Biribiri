package com.retro.pokemonengine.batalla;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReglasAbandonoTest
{
    @Test
    void dentroDelPlazoTodaviaSeLeEspera()
    {
        long ausente = 1_000_000L;

        assertFalse(ReglasAbandono.expirado(ausente, ausente + 1000L));
        assertFalse(ReglasAbandono.expirado(ausente, ausente + ReglasAbandono.GRACIA_MS - 1));
    }

    @Test
    void alCumplirseElPlazoSeAcabo()
    {
        long ausente = 1_000_000L;

        assertTrue(ReglasAbandono.expirado(ausente, ausente + ReglasAbandono.GRACIA_MS));
        assertTrue(ReglasAbandono.expirado(ausente, ausente + ReglasAbandono.GRACIA_MS + 60_000L));
    }

    @Test
    void loQueQuedaNuncaEsNegativo()
    {
        long ausente = 1_000_000L;

        assertEquals(ReglasAbandono.GRACIA_MS, ReglasAbandono.restanteMs(ausente, ausente));
        assertEquals(0L, ReglasAbandono.restanteMs(ausente, ausente + ReglasAbandono.GRACIA_MS * 2));
    }

    @Test
    void elTurnoTieneSuPropioReloj()
    {
        long abierto = 500L;

        assertFalse(ReglasAbandono.turnoExpirado(abierto, abierto + ReglasAbandono.TURNO_MS - 1));
        assertTrue(ReglasAbandono.turnoExpirado(abierto, abierto + ReglasAbandono.TURNO_MS));
        assertTrue(ReglasAbandono.TURNO_MS < ReglasAbandono.GRACIA_MS,
                "Esperar por una eleccion no puede costar mas que esperar por una reconexion");
    }
}
