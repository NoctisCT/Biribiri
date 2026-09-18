package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class VolatilesTest
{
    private PokemonCombate luchador(String nombre, int genero)
    {
        PokemonCombate p = new PokemonCombate(nombre.hashCode(), 1, nombre, 50, CatalogoFalso.NORMAL, null, 160,
                new int[] { 160, 100, 100, 100, 100, 100 });

        p.ponerGenero(genero);

        return p;
    }

    private EstadoCombate estado(PokemonCombate a, PokemonCombate b)
    {
        Bando ba = new Bando(0);
        Bando bb = new Bando(1);
        ba.posiciones().add(a);
        bb.posiciones().add(b);

        return new EstadoCombate(ba, bb, new RngCombate(1L));
    }

    private MovimientoCatalogo ataque()
    {
        return CatalogoFalso.mov(33, "Placaje", CatalogoFalso.NORMAL, "physical", 40, 100, 0, "damage");
    }

    private MovimientoCatalogo deEstado()
    {
        return CatalogoFalso.mov(14, "Danza Espada", CatalogoFalso.NORMAL, "status", null, null, 0, "net-good-stats");
    }

    private boolean hay(List<Evento> eventos, String tipo)
    {
        return eventos.stream().anyMatch(e -> tipo.equals(e.tipo()));
    }

    // --- Enamorado ---

    @Test
    void soloSeEnamoranGenerosOpuestos()
    {
        PokemonCombate macho = luchador("Macho", PokemonCombate.GENERO_MACHO);
        PokemonCombate hembra = luchador("Hembra", PokemonCombate.GENERO_HEMBRA);
        PokemonCombate otroMacho = luchador("OtroMacho", PokemonCombate.GENERO_MACHO);
        PokemonCombate sinGenero = luchador("SinGenero", PokemonCombate.GENERO_NINGUNO);

        assertTrue(macho.enamorarseDe(hembra));
        assertFalse(otroMacho.enamorarseDe(macho), "Mismo genero no se enamora");
        assertFalse(sinGenero.enamorarseDe(hembra), "Sin genero es inmune a Atraccion");
        assertFalse(luchador("X", PokemonCombate.GENERO_HEMBRA).enamorarseDe(sinGenero));
    }

    @Test
    void enamoradoImpideCercaDeLaMitadDeLasVeces()
    {
        int impedido = 0;
        RngCombate rng = new RngCombate(20260918L);

        for(int i = 0; i < 2000; i++)
        {
            PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
            p.enamorarseDe(luchador("Q", PokemonCombate.GENERO_HEMBRA));

            if(Volatiles.enamoradoImpide(p, rng)) impedido++;
        }

        assertTrue(impedido > 900 && impedido < 1100,
                "Enamorado deberia impedir cerca del 50%, salieron " + impedido + " de 2000");
    }

    @Test
    void enamoradoAparceComoImpedimentoDelTurno()
    {
        boolean visto = false;

        for(long semilla = 1; semilla <= 40 && !visto; semilla++)
        {
            PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
            p.enamorarseDe(luchador("Q", PokemonCombate.GENERO_HEMBRA));

            Impedimentos.Resultado r = Impedimentos.comprobar(p, new RngCombate(semilla));

            if(!r.puedeActuar()
                    && r.eventos().stream().anyMatch(e -> "attract".equals(e.datos().get("motivo"))))
            {
                visto = true;
            }
        }

        assertTrue(visto, "En 40 semillas Atraccion deberia impedir alguna vez");
    }

    // --- Mofa, Tormento, Anulacion, Embargo ---

    @Test
    void mofaProhibeLosMovimientosDeEstadoPeroNoLosDeDano()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
        p.ponerVolatil(PokemonCombate.MOFA, Volatiles.TURNOS_MOFA);

        assertFalse(Volatiles.puedeUsar(p, deEstado()).permitido());
        assertEquals("taunt", Volatiles.puedeUsar(p, deEstado()).motivo());
        assertTrue(Volatiles.puedeUsar(p, ataque()).permitido(), "Los de dano siguen valiendo");
    }

    @Test
    void tormentoProhibeRepetirElMismoMovimiento()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
        p.ponerVolatil(PokemonCombate.TORMENTO, 1);

        assertTrue(Volatiles.puedeUsar(p, ataque()).permitido(), "La primera vez se puede");

        p.registrarMovimientoUsado(ataque().id());

        assertFalse(Volatiles.puedeUsar(p, ataque()).permitido());
        assertEquals("torment", Volatiles.puedeUsar(p, ataque()).motivo());
        assertTrue(Volatiles.puedeUsar(p, deEstado()).permitido(), "Otro movimiento si");
    }

    @Test
    void anulacionBloqueaSoloElMovimientoDeshabilitado()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
        p.anularMovimiento(ataque().id());

        assertFalse(Volatiles.puedeUsar(p, ataque()).permitido());
        assertEquals("disable", Volatiles.puedeUsar(p, ataque()).motivo());
        assertTrue(Volatiles.puedeUsar(p, deEstado()).permitido());
    }

    @Test
    void embargoImpideUsarObjetos()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);

        assertTrue(Volatiles.puedeUsarObjetos(p));

        p.ponerVolatil(PokemonCombate.EMBARGO, Volatiles.TURNOS_EMBARGO);

        assertFalse(Volatiles.puedeUsarObjetos(p));
    }

    // --- Residuales al final del turno ---

    @Test
    void maldicionQuitaUnCuartoCadaTurno()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
        p.ponerVolatil(PokemonCombate.MALDITO, 1);

        List<Evento> eventos = Volatiles.alFinDeTurno(estado(p, luchador("Q", PokemonCombate.GENERO_HEMBRA)));

        assertEquals(160 - 40, p.psActual());
        assertTrue(hay(eventos, "dano_maldicion"));
    }

    @Test
    void cantoMortalDebilitaAlTercerTurno()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
        PokemonCombate q = luchador("Q", PokemonCombate.GENERO_HEMBRA);

        p.ponerVolatil(PokemonCombate.CANTO_MORTAL, Volatiles.TURNOS_CANTO_MORTAL);

        EstadoCombate e = estado(p, q);

        Volatiles.alFinDeTurno(e);
        assertFalse(p.debilitado(), "Turno 1: aun aguanta");

        Volatiles.alFinDeTurno(e);
        assertFalse(p.debilitado(), "Turno 2: aun aguanta");

        List<Evento> eventos = Volatiles.alFinDeTurno(e);

        assertTrue(p.debilitado(), "Turno 3: cae debilitado");
        assertTrue(hay(eventos, "canto_mortal_cumplido"));
    }

    @Test
    void cantoMortalSeEsquivaCambiandoDePokemon()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);

        p.ponerVolatil(PokemonCombate.CANTO_MORTAL, Volatiles.TURNOS_CANTO_MORTAL);
        p.alSalir();

        assertFalse(p.tieneVolatil(PokemonCombate.CANTO_MORTAL),
                "Al cambiar de Pokemon la cuenta atras se pierde");
    }

    @Test
    void elRetrocesoNoSobreviveAlFinalDelTurno()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
        p.ponerVolatil(PokemonCombate.RETROCESO, 1);

        Volatiles.alFinDeTurno(estado(p, luchador("Q", PokemonCombate.GENERO_HEMBRA)));

        assertFalse(p.tieneVolatil(PokemonCombate.RETROCESO),
                "Si el afectado ya habia atacado, el retroceso no puede arrastrarse al turno siguiente");
    }

    @Test
    void mofaYEmbargoCaducan()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
        PokemonCombate q = luchador("Q", PokemonCombate.GENERO_HEMBRA);

        p.ponerVolatil(PokemonCombate.MOFA, 2);
        p.ponerVolatil(PokemonCombate.EMBARGO, 2);

        EstadoCombate e = estado(p, q);

        Volatiles.alFinDeTurno(e);
        assertTrue(p.tieneVolatil(PokemonCombate.MOFA));

        List<Evento> eventos = Volatiles.alFinDeTurno(e);

        assertFalse(p.tieneVolatil(PokemonCombate.MOFA));
        assertFalse(p.tieneVolatil(PokemonCombate.EMBARGO));
        assertTrue(hay(eventos, "volatil_fin"));
    }

    @Test
    void anulacionCaducaYLiberaElMovimiento()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);
        PokemonCombate q = luchador("Q", PokemonCombate.GENERO_HEMBRA);

        p.ponerVolatil(PokemonCombate.ANULACION, 1);
        p.anularMovimiento(ataque().id());

        Volatiles.alFinDeTurno(estado(p, q));

        assertEquals(-1, p.movimientoAnulado());
        assertTrue(Volatiles.puedeUsar(p, ataque()).permitido());
    }

    @Test
    void alCambiarSePierdenTodosLosVolatilesYSusRestricciones()
    {
        PokemonCombate p = luchador("P", PokemonCombate.GENERO_MACHO);

        p.enamorarseDe(luchador("Q", PokemonCombate.GENERO_HEMBRA));
        p.ponerVolatil(PokemonCombate.MOFA, 3);
        p.registrarMovimientoUsado(ataque().id());
        p.anularMovimiento(ataque().id());

        p.alSalir();

        assertFalse(p.tieneVolatil(PokemonCombate.ENAMORADO));
        assertFalse(p.tieneVolatil(PokemonCombate.MOFA));
        assertEquals(-1, p.enamoradoDe());
        assertEquals(-1, p.ultimoMovimiento());
        assertEquals(-1, p.movimientoAnulado());
    }

    @Test
    void laConfusionDuraDeUnoACuatroTurnos()
    {
        assertEquals(1, Volatiles.CONFUSION_MIN);
        assertEquals(4, Volatiles.CONFUSION_MAX);
    }
}
