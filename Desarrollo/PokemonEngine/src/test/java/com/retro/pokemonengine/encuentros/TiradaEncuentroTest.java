package com.retro.pokemonengine.encuentros;

import com.retro.pokemonengine.combate.RngCombate;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TiradaEncuentroTest
{
    private static final int PASOS = 10_000;

    private int cuentaEncuentros(int porMil, long semilla)
    {
        RngCombate rng = new RngCombate(semilla);
        TiradaEncuentro.Estado estado = TiradaEncuentro.inicial();
        int encuentros = 0;
        long ahora = 0L;

        for(int i = 0; i < PASOS; i++)
        {
            // Tiempo de sobra entre pasos para que el enfriamiento por ms nunca mande.
            ahora += TiradaEncuentro.ENFRIAMIENTO_MS + 1;

            TiradaEncuentro.Resultado resultado = TiradaEncuentro.paso(porMil, estado, ahora, rng);

            estado = resultado.estado();

            if(resultado.toca()) encuentros++;
        }

        return encuentros;
    }

    @Test
    void laProbabilidadSaleDentroDeMargen()
    {
        // Con enfriamiento de ocho pasos, cada encuentro se come ocho tiradas.
        int encuentros = cuentaEncuentros(120, 20260919L);

        assertTrue(encuentros > 500, "Demasiado pocos encuentros: " + encuentros);
        assertTrue(encuentros < 1_400, "Demasiados encuentros: " + encuentros);
    }

    @Test
    void probabilidadCeroNoDisparaNunca()
    {
        assertEquals(0, cuentaEncuentros(0, 7L));
    }

    @Test
    void probabilidadMilDisparaEnCuantoPuede()
    {
        int encuentros = cuentaEncuentros(1000, 3L);

        assertTrue(encuentros >= PASOS / (TiradaEncuentro.ENFRIAMIENTO_PASOS + 1) - 1,
                "Con certeza deberia disparar cada nueve pasos: " + encuentros);
    }

    @Test
    void elEnfriamientoPorPasosBloqueaLosSiguientes()
    {
        RngCombate rng = new RngCombate(1L);
        TiradaEncuentro.Resultado primero = TiradaEncuentro.paso(
                1000, TiradaEncuentro.inicial(), 0L, rng);

        assertTrue(primero.toca());

        TiradaEncuentro.Estado estado = primero.estado();

        assertEquals(TiradaEncuentro.ENFRIAMIENTO_PASOS, estado.pasosEnfriamiento());

        for(int i = 0; i < TiradaEncuentro.ENFRIAMIENTO_PASOS; i++)
        {
            TiradaEncuentro.Resultado siguiente = TiradaEncuentro.paso(
                    1000, estado, TiradaEncuentro.ENFRIAMIENTO_MS * 10L, rng);

            assertFalse(siguiente.toca(), "El paso " + i + " no deberia disparar");

            estado = siguiente.estado();
        }

        assertTrue(TiradaEncuentro.paso(1000, estado, TiradaEncuentro.ENFRIAMIENTO_MS * 20L, rng).toca(),
                "Pasado el enfriamiento vuelve a disparar");
    }

    @Test
    void elEnfriamientoPorTiempoBloqueaAunqueSobrenPasos()
    {
        RngCombate rng = new RngCombate(1L);
        TiradaEncuentro.Estado estado = TiradaEncuentro.paso(
                1000, TiradaEncuentro.inicial(), 1_000L, rng).estado();

        // Se agotan los pasos de enfriamiento sin dejar pasar el reloj.
        for(int i = 0; i < TiradaEncuentro.ENFRIAMIENTO_PASOS; i++)
        {
            estado = TiradaEncuentro.paso(1000, estado, 1_001L, rng).estado();
        }

        assertFalse(TiradaEncuentro.paso(1000, estado, 1_002L, rng).toca(),
                "El reloj todavia no ha pasado");
        assertTrue(TiradaEncuentro.paso(
                1000, estado, 1_000L + TiradaEncuentro.ENFRIAMIENTO_MS + 1, rng).toca());
    }

    @Test
    void elSilenciadoGanaAlEnfriamiento()
    {
        RngCombate rng = new RngCombate(1L);
        TiradaEncuentro.Estado estado = TiradaEncuentro.silenciar(TiradaEncuentro.inicial(), 3);

        for(int i = 0; i < 3; i++)
        {
            TiradaEncuentro.Resultado resultado = TiradaEncuentro.paso(1000, estado, i * 10_000L, rng);

            assertFalse(resultado.toca(), "Silenciado no puede disparar");

            estado = resultado.estado();
        }

        assertTrue(TiradaEncuentro.paso(1000, estado, 100_000L, rng).toca(),
                "Agotado el silenciado, vuelve a disparar");
    }

    @Test
    void laMismaSemillaDaLaMismaSecuencia()
    {
        assertEquals(cuentaEncuentros(120, 42L), cuentaEncuentros(120, 42L));
    }
}
