package com.retro.pokemonengine.batalla;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecompensasTest
{
    private static final Recompensas.Ev CERO = new Recompensas.Ev(0, 0, 0, 0, 0, 0);

    @Test
    void unRattataDeNivelDosDaMuyPocaExperiencia()
    {
        // Rattata: base_experience 51.
        assertEquals(51L * 2 / 7, Recompensas.experiencia(51, 2, 1, false));
    }

    @Test
    void repartirEntreDosDaLaMitadACadaUno()
    {
        long solo = Recompensas.experiencia(200, 50, 1, false);
        long acompanado = Recompensas.experiencia(200, 50, 2, false);

        assertEquals(solo / 2, acompanado);
    }

    @Test
    void unEntrenadorPagaLaMitadMas()
    {
        long salvaje = Recompensas.experiencia(200, 50, 1, false);
        long entrenador = Recompensas.experiencia(200, 50, 1, true);

        assertEquals(salvaje * 3 / 2, entrenador);
    }

    @Test
    void nuncaSeGanaCero()
    {
        assertEquals(1L, Recompensas.experiencia(1, 1, 6, false),
                "Un combate ganado siempre tiene que sumar algo");
    }

    @Test
    void elPokerusDuplicaElReparto()
    {
        Recompensas.Ev reparto = new Recompensas.Ev(0, 1, 0, 0, 0, 0);

        assertEquals(1, Recompensas.sumar(CERO, reparto, false).ataque());
        assertEquals(2, Recompensas.sumar(CERO, reparto, true).ataque());
    }

    @Test
    void ningunStatPasaDeDoscientosCincuentaYDos()
    {
        Recompensas.Ev actuales = new Recompensas.Ev(0, 250, 0, 0, 0, 0);
        Recompensas.Ev reparto = new Recompensas.Ev(0, 10, 0, 0, 0, 0);

        assertEquals(Recompensas.EV_MAX_POR_STAT,
                Recompensas.sumar(actuales, reparto, false).ataque());
    }

    @Test
    void elTotalNoPasaDeQuinientosDiez()
    {
        Recompensas.Ev actuales = new Recompensas.Ev(252, 252, 0, 0, 0, 0);
        Recompensas.Ev reparto = new Recompensas.Ev(0, 0, 10, 10, 0, 0);

        Recompensas.Ev fin = Recompensas.sumar(actuales, reparto, false);

        assertEquals(Recompensas.EV_MAX_TOTAL, fin.total());
        assertEquals(6, fin.defensa(),
                "Lo que cabe entra en el primero de la lista, no se reparte");
        assertEquals(0, fin.ataqueEsp(), "Y al siguiente ya no le queda margen");
    }

    @Test
    void conElTotalLlenoNoEntraNadaMas()
    {
        Recompensas.Ev lleno = new Recompensas.Ev(252, 252, 6, 0, 0, 0);
        Recompensas.Ev fin = Recompensas.sumar(lleno, new Recompensas.Ev(0, 0, 0, 8, 8, 8), false);

        assertEquals(lleno, fin);
        assertTrue(fin.total() <= Recompensas.EV_MAX_TOTAL);
    }
}
