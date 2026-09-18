package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class EstadoModeloTest
{
    private PokemonCombate pikachu()
    {
        // PS 110, ATK 90, DEF 70, SPA 100, SPD 90, VEL 110
        return new PokemonCombate(1, 25, "Pikachu", 50, 13, null, 110,
                new int[] { 110, 90, 70, 100, 90, 110 });
    }

    @Test
    void lasEtapasSiguenLaFormulaDeLosJuegos()
    {
        assertEquals(1.0, Etapas.multiplicador(0));
        assertEquals(1.5, Etapas.multiplicador(1));
        assertEquals(2.0, Etapas.multiplicador(2));
        assertEquals(4.0, Etapas.multiplicador(6));
        assertEquals(2.0 / 3.0, Etapas.multiplicador(-1));
        assertEquals(0.25, Etapas.multiplicador(-6));
    }

    @Test
    void precisionYEvasionUsanDivisorTres()
    {
        assertEquals(4.0 / 3.0, Etapas.multiplicadorPunteria(1));
        assertEquals(3.0 / 4.0, Etapas.multiplicadorPunteria(-1));

        assertNotEquals(Etapas.multiplicador(1), Etapas.multiplicadorPunteria(1));
    }

    @Test
    void lasEtapasSeTopanEnSeis()
    {
        PokemonCombate p = pikachu();

        assertEquals(6, p.cambiarEtapa(PokemonCombate.ETAPA_ATAQUE, 10), "Debe subir solo hasta +6");
        assertEquals(6, p.etapa(PokemonCombate.ETAPA_ATAQUE));
        assertEquals(0, p.cambiarEtapa(PokemonCombate.ETAPA_ATAQUE, 3), "Ya está al tope");
        assertEquals(-12, p.cambiarEtapa(PokemonCombate.ETAPA_ATAQUE, -20));
        assertEquals(-6, p.etapa(PokemonCombate.ETAPA_ATAQUE));
    }

    @Test
    void lasEtapasCambianElStatEfectivo()
    {
        PokemonCombate p = pikachu();

        assertEquals(90, p.statEfectivo(Stat.ATAQUE));

        p.cambiarEtapa(PokemonCombate.ETAPA_ATAQUE, 2);

        assertEquals(180, p.statEfectivo(Stat.ATAQUE));
    }

    @Test
    void laParalisisReduceLaVelocidadALaMitad()
    {
        PokemonCombate p = pikachu();

        assertEquals(110, p.statEfectivo(Stat.VELOCIDAD));

        p.aplicarEstado(PokemonCombate.PARALISIS, 0);

        assertEquals(55, p.statEfectivo(Stat.VELOCIDAD));
    }

    @Test
    void noSePuedenAcumularDosEstadosAlterados()
    {
        PokemonCombate p = pikachu();

        assertTrue(p.aplicarEstado(PokemonCombate.QUEMADURA, 0));
        assertFalse(p.aplicarEstado(PokemonCombate.PARALISIS, 0), "Ya está quemado");
        assertEquals(PokemonCombate.QUEMADURA, p.estado());
    }

    @Test
    void unDebilitadoNoPuedeRecibirEstados()
    {
        PokemonCombate p = pikachu();
        p.recibirDano(9999);

        assertTrue(p.debilitado());
        assertFalse(p.aplicarEstado(PokemonCombate.SUENO, 3));
    }

    @Test
    void elDanoNoBajaDeCeroYLaCuraNoPasaDelMaximo()
    {
        PokemonCombate p = pikachu();

        assertEquals(110, p.recibirDano(500), "Solo se aplican los PS que quedaban");
        assertEquals(0, p.psActual());

        assertEquals(110, p.curar(500));
        assertEquals(110, p.psActual());
        assertEquals(0, p.curar(50), "Ya está al máximo");
    }

    @Test
    void alSalirSePierdenEtapasYVolatilesPeroNoElEstado()
    {
        PokemonCombate p = pikachu();

        p.cambiarEtapa(PokemonCombate.ETAPA_ATAQUE, 3);
        p.ponerVolatil(PokemonCombate.CONFUSION, 3);
        p.aplicarEstado(PokemonCombate.QUEMADURA, 0);

        p.alSalir();

        assertEquals(0, p.etapa(PokemonCombate.ETAPA_ATAQUE));
        assertFalse(p.tieneVolatil(PokemonCombate.CONFUSION));
        assertEquals(PokemonCombate.QUEMADURA, p.estado(), "La quemadura sí sobrevive al cambio");
    }

    @Test
    void laMismaSemillaDaLaMismaSecuencia()
    {
        RngCombate a = new RngCombate(12345L);
        RngCombate b = new RngCombate(12345L);

        for(int i = 0; i < 50; i++)
        {
            assertEquals(a.entre(1, 100), b.entre(1, 100));
            assertEquals(a.variacionDano(), b.variacionDano());
        }
    }

    @Test
    void laVariacionDeDanoSiempreEstaEntre85y100()
    {
        RngCombate rng = new RngCombate(999L);

        for(int i = 0; i < 500; i++)
        {
            int v = rng.variacionDano();

            assertTrue(v >= 85 && v <= 100, "Variación fuera de rango: " + v);
        }
    }

    @Test
    void unaCondicionDeBandoNoSeAcumula()
    {
        Bando bando = new Bando(0);

        assertTrue(bando.ponerCondicion("reflect", 5));
        assertFalse(bando.ponerCondicion("reflect", 5), "Reflejo ya estaba activo");
    }

    @Test
    void unBandoConTodosDebilitadosNoPuedeSeguir()
    {
        Bando bando = new Bando(0);
        PokemonCombate p = pikachu();
        bando.posiciones().add(p);

        assertTrue(bando.puedeSeguir());

        p.recibirDano(9999);

        assertFalse(bando.puedeSeguir());
    }

    @Test
    void lasAccionesQueNoSonMovimientoVanAntes()
    {
        assertTrue(Accion.huida(0, 0).prioridadBase() > Accion.objeto(0, 0, 1).prioridadBase());
        assertTrue(Accion.objeto(0, 0, 1).prioridadBase() > Accion.cambio(0, 0, 1).prioridadBase());
        assertTrue(Accion.cambio(0, 0, 1).prioridadBase() > Accion.movimiento(0, 0, 0, 1, 0).prioridadBase());
    }
}
