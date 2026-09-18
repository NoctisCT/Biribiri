package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ImpedimentosTest
{
    private PokemonCombate luchador()
    {
        return new PokemonCombate(1, 1, "Prueba", 50, CatalogoFalso.NORMAL, null, 200,
                new int[] { 200, 100, 100, 100, 100, 100 });
    }

    private MovimientoCatalogo conPrecision(Integer precision)
    {
        return CatalogoFalso.mov(1, "Prueba", CatalogoFalso.NORMAL, "physical", 40, precision, 0, "damage");
    }

    @Test
    void sinEstadoNadaImpideActuar()
    {
        Impedimentos.Resultado r = Impedimentos.comprobar(luchador(), new RngCombate(1L));

        assertTrue(r.puedeActuar());
        assertTrue(r.eventos().isEmpty());
    }

    @Test
    void elSuenoImpideHastaQueSeAgotaElContador()
    {
        PokemonCombate p = luchador();
        p.aplicarEstado(PokemonCombate.SUENO, 2);

        RngCombate rng = new RngCombate(1L);

        assertFalse(Impedimentos.comprobar(p, rng).puedeActuar(), "Turno 1 dormido");
        assertTrue(Impedimentos.comprobar(p, rng).puedeActuar(), "Se despierta y actúa");
        assertEquals(PokemonCombate.SIN_ESTADO, p.estado());
    }

    @Test
    void elRetrocesoSoloDuraUnTurnoYSeConsume()
    {
        PokemonCombate p = luchador();
        p.ponerVolatil(PokemonCombate.RETROCESO, 1);

        RngCombate rng = new RngCombate(1L);

        assertFalse(Impedimentos.comprobar(p, rng).puedeActuar());
        assertFalse(p.tieneVolatil(PokemonCombate.RETROCESO));
        assertTrue(Impedimentos.comprobar(p, rng).puedeActuar());
    }

    @Test
    void laParalisisImpideAproximadamenteUnCuartoDeLasVeces()
    {
        int impedido = 0;
        RngCombate rng = new RngCombate(4242L);

        for(int i = 0; i < 2000; i++)
        {
            PokemonCombate p = luchador();
            p.aplicarEstado(PokemonCombate.PARALISIS, 0);

            if(!Impedimentos.comprobar(p, rng).puedeActuar()) impedido++;
        }

        assertTrue(impedido > 400 && impedido < 600,
                "La parálisis debería impedir cerca del 25%, salieron " + impedido + " de 2000");
    }

    @Test
    void laCongelacionSeCuraCercaDelVeintePorCiento()
    {
        int curados = 0;
        RngCombate rng = new RngCombate(31337L);

        for(int i = 0; i < 2000; i++)
        {
            PokemonCombate p = luchador();
            p.aplicarEstado(PokemonCombate.CONGELACION, 0);

            Impedimentos.comprobar(p, rng);

            if(PokemonCombate.SIN_ESTADO.equals(p.estado())) curados++;
        }

        assertTrue(curados > 300 && curados < 500,
                "Descongelar debería rondar el 20%, salieron " + curados + " de 2000");
    }

    @Test
    void laConfusionPuedeHacerQueSeGolpeeASiMismo()
    {
        boolean vistoAutogolpe = false;

        for(long semilla = 1; semilla <= 60 && !vistoAutogolpe; semilla++)
        {
            PokemonCombate p = luchador();
            p.ponerVolatil(PokemonCombate.CONFUSION, 4);

            Impedimentos.Resultado r = Impedimentos.comprobar(p, new RngCombate(semilla));

            if(r.eventos().stream().anyMatch(e -> "confusion_autogolpe".equals(e.tipo())))
            {
                vistoAutogolpe = true;
                assertFalse(r.puedeActuar(), "Si se golpea, pierde el turno");
                assertTrue(p.psActual() < p.psMax(), "El autogolpe hace daño de verdad");
            }
        }

        assertTrue(vistoAutogolpe, "En 60 semillas debería haberse golpeado alguna vez");
    }

    @Test
    void laConfusionSeAgotaYDesaparece()
    {
        PokemonCombate p = luchador();
        p.ponerVolatil(PokemonCombate.CONFUSION, 1);

        Impedimentos.Resultado r = Impedimentos.comprobar(p, new RngCombate(1L));

        assertFalse(p.tieneVolatil(PokemonCombate.CONFUSION));
        assertTrue(r.puedeActuar());
    }

    @Test
    void unMovimientoSinPrecisionNuncaFalla()
    {
        PokemonCombate a = luchador();
        PokemonCombate b = luchador();

        b.cambiarEtapa(PokemonCombate.ETAPA_EVASION, 6);

        RngCombate rng = new RngCombate(1L);

        for(int i = 0; i < 200; i++)
        {
            assertTrue(Impedimentos.acierta(conPrecision(null), a, b, rng));
        }
    }

    @Test
    void laEvasionReduceLaProbabilidadDeAcertar()
    {
        PokemonCombate a = luchador();
        PokemonCombate sinEvasion = luchador();
        PokemonCombate conEvasion = luchador();

        conEvasion.cambiarEtapa(PokemonCombate.ETAPA_EVASION, 6);

        int aciertosNormales = 0;
        int aciertosConEvasion = 0;
        RngCombate rng = new RngCombate(555L);

        for(int i = 0; i < 2000; i++)
        {
            if(Impedimentos.acierta(conPrecision(100), a, sinEvasion, rng)) aciertosNormales++;
            if(Impedimentos.acierta(conPrecision(100), a, conEvasion, rng)) aciertosConEvasion++;
        }

        assertEquals(2000, aciertosNormales, "Precisión 100 sin evasión no falla");
        assertTrue(aciertosConEvasion < 1200,
                "Con +6 de evasión debería fallar mucho, acertó " + aciertosConEvasion);
    }

    @Test
    void laPrecisionSeTopaEnCien()
    {
        PokemonCombate a = luchador();
        PokemonCombate b = luchador();

        a.cambiarEtapa(PokemonCombate.ETAPA_PRECISION, 6);

        RngCombate rng = new RngCombate(1L);

        for(int i = 0; i < 200; i++)
        {
            assertTrue(Impedimentos.acierta(conPrecision(100), a, b, rng));
        }
    }
}
