package com.retro.pokemonengine.entrenador;

import com.retro.pokemonengine.entrenador.TablaExperiencia.Curva;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TablaExperienciaTest
{
    @Test
    void elNivelUnoNoCuestaExperienciaEnNingunaCurva()
    {
        for(Curva curva : Curva.values())
        {
            assertEquals(0L, TablaExperiencia.expParaNivel(curva, 1), "Curva " + curva);
            assertEquals(0L, TablaExperiencia.expParaNivel(curva, 0), "Curva " + curva);
        }
    }

    @Test
    void elNivelCienCuestaLoQueDicenLosJuegos()
    {
        assertEquals(600_000L, TablaExperiencia.expParaNivel(Curva.ERRATICA, 100));
        assertEquals(800_000L, TablaExperiencia.expParaNivel(Curva.RAPIDA, 100));
        assertEquals(1_000_000L, TablaExperiencia.expParaNivel(Curva.MEDIA, 100));
        assertEquals(1_059_860L, TablaExperiencia.expParaNivel(Curva.MEDIA_LENTA, 100));
        assertEquals(1_250_000L, TablaExperiencia.expParaNivel(Curva.LENTA, 100));
        assertEquals(1_640_000L, TablaExperiencia.expParaNivel(Curva.FLUCTUANTE, 100));
    }

    @Test
    void laMediaLentaTruncaComoEnLosJuegosEnLosPrimerosNiveles()
    {
        // Los tres primeros valores publicados de la curva medium-slow.
        assertEquals(9L, TablaExperiencia.expParaNivel(Curva.MEDIA_LENTA, 2));
        assertEquals(57L, TablaExperiencia.expParaNivel(Curva.MEDIA_LENTA, 3));
        assertEquals(96L, TablaExperiencia.expParaNivel(Curva.MEDIA_LENTA, 4));
    }

    @Test
    void lasCurvasNuncaRetroceden()
    {
        for(Curva curva : Curva.values())
        {
            for(int nivel = 2; nivel <= 100; nivel++)
            {
                assertTrue(
                        TablaExperiencia.expParaNivel(curva, nivel)
                                >= TablaExperiencia.expParaNivel(curva, nivel - 1),
                        "Curva " + curva + " retrocede en el nivel " + nivel);
            }
        }
    }

    @Test
    void nivelParaExpEsLaInversaEnLosCienNiveles()
    {
        for(Curva curva : Curva.values())
        {
            for(int nivel = 1; nivel <= 100; nivel++)
            {
                long exp = TablaExperiencia.expParaNivel(curva, nivel);

                assertEquals(nivel, TablaExperiencia.nivelParaExp(curva, exp),
                        "Curva " + curva + " en el nivel " + nivel);
            }
        }
    }

    @Test
    void laExperienciaFueraDeRangoSeQuedaEnLosExtremos()
    {
        assertEquals(1, TablaExperiencia.nivelParaExp(Curva.MEDIA, -50L));
        assertEquals(1, TablaExperiencia.nivelParaExp(Curva.MEDIA, 0L));
        assertEquals(100, TablaExperiencia.nivelParaExp(Curva.MEDIA, 99_000_000L));
    }

    @Test
    void faltaParaSiguienteEsCeroAlMaximo()
    {
        long tope = TablaExperiencia.expParaNivel(Curva.MEDIA, 100);

        assertEquals(0L, TablaExperiencia.faltaParaSiguiente(Curva.MEDIA, tope));
        assertEquals(1L, TablaExperiencia.faltaParaSiguiente(Curva.MEDIA, 7L),
                "Del nivel 2 (8) al 3 (27) falta lo que falta; con 7 aun falta 1 para el nivel 2");
    }

    @Test
    void losNombresSonLosQueGuardaElImportador()
    {
        assertEquals(Curva.MEDIA, TablaExperiencia.porNombre("medium"));
        assertEquals(Curva.MEDIA_LENTA, TablaExperiencia.porNombre("medium-slow"));
        assertEquals(Curva.ERRATICA, TablaExperiencia.porNombre("slow-then-very-fast"));
        assertEquals(Curva.FLUCTUANTE, TablaExperiencia.porNombre("fast-then-very-slow"));
        assertEquals(Curva.LENTA, TablaExperiencia.porNombre("slow"));
        assertEquals(Curva.RAPIDA, TablaExperiencia.porNombre("fast"));
        assertEquals(Curva.MEDIA, TablaExperiencia.porNombre("lo-que-sea"),
                "Una curva desconocida no debe romper la creacion de un Pokemon");
        assertEquals(Curva.MEDIA, TablaExperiencia.porNombre(null));
    }
}
