package com.retro.pokemonengine.batalla;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RecompensasTest
{
    private static final Recompensas.Ev CERO = new Recompensas.Ev(0, 0, 0, 0, 0, 0);

    @Test
    void aIgualNivelElFactorNoQuitaCasiNada()
    {
        // Con Lderrotado == Lganador el factor vale (2L+10)/(2L+10) elevado a
        // 2,5, que es 1 solo cuando ademas los dos son iguales al mismo nivel.
        long exp = Recompensas.experiencia(51, 20, 20, 1, false);

        assertTrue(exp > 100, "A su nivel, un rival decente sigue pagando: " + exp);
    }

    @Test
    void subirDeNivelHaceQueLosBichosFlojosDejenDeCompensar()
    {
        long aNivelCinco = Recompensas.experiencia(51, 2, 5, 1, false);
        long aNivelSesenta = Recompensas.experiencia(51, 2, 60, 1, false);

        assertTrue(aNivelSesenta * 5 < aNivelCinco,
                "La Ruta 1 tiene que agotarse sola: " + aNivelCinco + " -> " + aNivelSesenta);
        assertEquals(1L, aNivelSesenta,
                "A nivel 60 un Rattata de nivel 2 ya solo paga el minimo");
    }

    @Test
    void unRivalDeMayorNivelPagaMas()
    {
        long flojo = Recompensas.experiencia(100, 10, 30, 1, false);
        long fuerte = Recompensas.experiencia(100, 40, 30, 1, false);

        assertTrue(fuerte > flojo * 4,
                "Buscar rivales de tu nivel tiene que notarse: " + flojo + " -> " + fuerte);
    }

    @Test
    void repartirEntreDosDaCasiLaMitadACadaUno()
    {
        long solo = Recompensas.experiencia(200, 50, 50, 1, false);
        long acompanado = Recompensas.experiencia(200, 50, 50, 2, false);

        assertEquals(solo / 2, acompanado, 1);
    }

    @Test
    void unEntrenadorPagaLaMitadMas()
    {
        long salvaje = Recompensas.experiencia(200, 50, 50, 1, false);
        long entrenador = Recompensas.experiencia(200, 50, 50, 1, true);

        assertEquals(salvaje * 3 / 2, entrenador, 1);
    }

    @Test
    void nuncaSeGanaCero()
    {
        assertEquals(1L, Recompensas.experiencia(1, 1, 100, 6, false),
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
