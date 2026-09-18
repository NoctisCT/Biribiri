package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FinDeTurnoTest
{
    private PokemonCombate luchador(String nombre)
    {
        return new PokemonCombate(1, 1, nombre, 50, CatalogoFalso.NORMAL, null, 160,
                new int[] { 160, 100, 100, 100, 100, 100 });
    }

    private EstadoCombate estado(PokemonCombate a, PokemonCombate b)
    {
        Bando ba = new Bando(0);
        Bando bb = new Bando(1);
        ba.posiciones().add(a);
        bb.posiciones().add(b);

        return new EstadoCombate(ba, bb, new RngCombate(1L));
    }

    private boolean hay(List<Evento> eventos, String tipo)
    {
        return eventos.stream().anyMatch(e -> tipo.equals(e.tipo()));
    }

    @Test
    void laQuemaduraQuitaUnDieciseisavo()
    {
        PokemonCombate a = luchador("A");
        a.aplicarEstado(PokemonCombate.QUEMADURA, 0);

        FinDeTurno.resolver(estado(a, luchador("B")));

        assertEquals(160 - 10, a.psActual());
    }

    @Test
    void elVenenoQuitaUnOctavo()
    {
        PokemonCombate a = luchador("A");
        a.aplicarEstado(PokemonCombate.VENENO, 0);

        FinDeTurno.resolver(estado(a, luchador("B")));

        assertEquals(160 - 20, a.psActual());
    }

    @Test
    void elVenenoGraveSubeCadaTurno()
    {
        PokemonCombate a = luchador("A");
        PokemonCombate b = luchador("B");
        a.aplicarEstado(PokemonCombate.VENENO_GRAVE, 0);

        EstadoCombate e = estado(a, b);

        FinDeTurno.resolver(e);
        int primerTurno = 160 - a.psActual();

        FinDeTurno.resolver(e);
        int segundoTurno = (160 - primerTurno) - a.psActual();

        assertEquals(10, primerTurno, "Primer turno: 1/16");
        assertEquals(20, segundoTurno, "Segundo turno: 2/16");
    }

    @Test
    void laTormentaDeArenaDanaACualquieraEnElCampo()
    {
        PokemonCombate a = luchador("A");
        PokemonCombate b = luchador("B");

        EstadoCombate e = estado(a, b);
        e.ponerClima("sandstorm", 5);

        FinDeTurno.resolver(e);

        assertEquals(150, a.psActual());
        assertEquals(150, b.psActual());
    }

    @Test
    void lasDrenadorasPasanLosPsDelRivalAlOtroBando()
    {
        PokemonCombate a = luchador("A");
        PokemonCombate b = luchador("B");

        a.ponerVolatil(FinDeTurno.DRENADORAS, 1);
        b.recibirDano(100);

        EstadoCombate e = estado(a, b);
        List<Evento> eventos = FinDeTurno.resolver(e);

        assertEquals(140, a.psActual(), "Pierde un octavo");
        assertEquals(80, b.psActual(), "Y el rival recupera lo mismo");
        assertTrue(hay(eventos, "drenadoras"));
        assertTrue(hay(eventos, "drenadoras_cura"));
    }

    @Test
    void lasCondicionesDeBandoCaducan()
    {
        PokemonCombate a = luchador("A");
        EstadoCombate e = estado(a, luchador("B"));

        e.bando(0).ponerCondicion("reflect", 2);

        FinDeTurno.resolver(e);
        assertTrue(e.bando(0).tieneCondicion("reflect"), "Todavía le queda un turno");

        List<Evento> eventos = FinDeTurno.resolver(e);
        assertFalse(e.bando(0).tieneCondicion("reflect"));
        assertTrue(hay(eventos, "condicion_bando_fin"));
    }

    @Test
    void lasCondicionesSinLimiteNoCaducan()
    {
        EstadoCombate e = estado(luchador("A"), luchador("B"));

        e.bando(0).ponerCondicion("spikes", 0);

        for(int i = 0; i < 10; i++) FinDeTurno.resolver(e);

        assertTrue(e.bando(0).tieneCondicion("spikes"), "Púas se quedan hasta que alguien las quite");
    }

    @Test
    void elClimaCaducaYVuelveANinguno()
    {
        EstadoCombate e = estado(luchador("A"), luchador("B"));
        e.ponerClima("sunnyday", 2);

        FinDeTurno.resolver(e);
        assertEquals("sunnyday", e.clima());

        FinDeTurno.resolver(e);
        assertEquals(EstadoCombate.SIN_CLIMA, e.clima());
    }

    @Test
    void elCombateTerminaCuandoUnBandoSeQuedaSinNadie()
    {
        PokemonCombate a = luchador("A");
        PokemonCombate b = luchador("B");

        b.recibirDano(9999);

        EstadoCombate e = estado(a, b);
        List<Evento> eventos = FinDeTurno.resolver(e);

        assertTrue(e.terminado());
        assertEquals(0, e.ganador());
        assertTrue(hay(eventos, "combate_terminado"));
    }

    @Test
    void elVenenoPuedeDebilitarYTerminarElCombate()
    {
        PokemonCombate a = luchador("A");
        PokemonCombate b = luchador("B");

        b.aplicarEstado(PokemonCombate.VENENO, 0);
        b.recibirDano(150);

        EstadoCombate e = estado(a, b);
        FinDeTurno.resolver(e);

        assertTrue(b.debilitado());
        assertTrue(e.terminado());
        assertEquals(0, e.ganador());
    }
}
