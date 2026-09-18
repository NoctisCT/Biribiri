package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ServicioCombateTest
{
    private static final int RAYO = 85;

    private CatalogoFalso catalogo()
    {
        return new CatalogoFalso()
                .con(CatalogoFalso.mov(RAYO, "Rayo", CatalogoFalso.ELECTRICO, "special", 90, 100, 0, "damage"));
    }

    private ServicioCombate motor()
    {
        return new ServicioCombate(catalogo(), id -> EjecutorMovimiento.Mecanica.simple("damage"));
    }

    private PokemonCombate luchador(String nombre, int tipo, int velocidad, int ps)
    {
        PokemonCombate p = new PokemonCombate(1, 1, nombre, 50, tipo, null, ps,
                new int[] { ps, 100, 100, 110, 100, velocidad });

        p.movimientos().add(new MovimientoEnCombate(RAYO, 15, 15));

        return p;
    }

    private EstadoCombate estado(PokemonCombate a, PokemonCombate b, long semilla)
    {
        Bando ba = new Bando(0);
        Bando bb = new Bando(1);
        ba.posiciones().add(a);
        bb.posiciones().add(b);

        return new EstadoCombate(ba, bb, new RngCombate(semilla));
    }

    private List<Accion> ambosAtacan()
    {
        return Arrays.asList(
                Accion.movimiento(0, 0, 0, 1, 0),
                Accion.movimiento(1, 0, 0, 0, 0));
    }

    @Test
    void unTurnoCompletoGeneraEventosYGastaPp()
    {
        PokemonCombate a = luchador("A", CatalogoFalso.ELECTRICO, 100, 300);
        PokemonCombate b = luchador("B", CatalogoFalso.AGUA, 90, 300);

        List<Evento> eventos = motor().resolverTurno(estado(a, b, 1L), ambosAtacan());

        assertEquals("turno_inicio", eventos.get(0).tipo());
        assertTrue(a.psActual() < a.psMax());
        assertTrue(b.psActual() < b.psMax());
        assertEquals(14, a.movimientos().get(0).ppActual());
    }

    @Test
    void unCombateEnteroTerminaConGanador()
    {
        PokemonCombate a = luchador("A", CatalogoFalso.ELECTRICO, 120, 300);
        PokemonCombate b = luchador("B", CatalogoFalso.AGUA, 80, 200);

        EstadoCombate e = estado(a, b, 4L);
        ServicioCombate motor = motor();

        for(int turno = 0; turno < 30 && !e.terminado(); turno++)
        {
            motor.resolverTurno(e, ambosAtacan());
        }

        assertTrue(e.terminado(), "El combate debería haber acabado en 30 turnos");
        assertTrue(e.ganador() >= 0);
    }

    @Test
    void lamismaSemillaProduceElMismoCombate()
    {
        List<String> primera = registrar(7L);
        List<String> segunda = registrar(7L);

        assertEquals(primera, segunda, "Misma semilla y mismas acciones deben dar el mismo combate");
    }

    @Test
    void semillasDistintasProducenCombatesDistintos()
    {
        assertFalse(registrar(7L).equals(registrar(8L)),
                "Con otra semilla el combate no debería ser idéntico");
    }

    private List<String> registrar(long semilla)
    {
        PokemonCombate a = luchador("A", CatalogoFalso.ELECTRICO, 120, 300);
        PokemonCombate b = luchador("B", CatalogoFalso.AGUA, 80, 300);

        EstadoCombate e = estado(a, b, semilla);
        ServicioCombate motor = motor();

        List<String> registro = new ArrayList<>();

        for(int turno = 0; turno < 12 && !e.terminado(); turno++)
        {
            for(Evento evento : motor.resolverTurno(e, ambosAtacan()))
            {
                registro.add(evento.toString());
            }
        }

        return registro;
    }

    @Test
    void sinPpElMovimientoNoSeUsa()
    {
        PokemonCombate a = luchador("A", CatalogoFalso.ELECTRICO, 120, 300);
        PokemonCombate b = luchador("B", CatalogoFalso.AGUA, 80, 300);

        for(int i = 0; i < 15; i++) a.movimientos().get(0).gastarPp();

        List<Evento> eventos = motor().resolverTurno(estado(a, b, 1L), ambosAtacan());

        assertTrue(eventos.stream().anyMatch(ev -> "sin_pp".equals(ev.tipo())));
    }

    @Test
    void huirTerminaElCombateAFavorDelRival()
    {
        PokemonCombate a = luchador("A", CatalogoFalso.ELECTRICO, 120, 300);
        PokemonCombate b = luchador("B", CatalogoFalso.AGUA, 80, 300);

        EstadoCombate e = estado(a, b, 1L);

        motor().resolverTurno(e, Arrays.asList(
                Accion.huida(0, 0),
                Accion.movimiento(1, 0, 0, 0, 0)));

        assertTrue(e.terminado());
        assertEquals(1, e.ganador());
    }

    @Test
    void cambiarPoneAlSuplenteEnElCampoYLimpiaEtapas()
    {
        PokemonCombate a = luchador("A", CatalogoFalso.ELECTRICO, 120, 300);
        PokemonCombate b = luchador("B", CatalogoFalso.AGUA, 80, 300);
        PokemonCombate suplente = luchador("Suplente", CatalogoFalso.TIERRA, 60, 300);

        a.cambiarEtapa(PokemonCombate.ETAPA_ATAQUE, 2);

        EstadoCombate e = estado(a, b, 1L);
        e.bando(0).banquillo().add(suplente);

        motor().resolverTurno(e, Arrays.asList(
                Accion.cambio(0, 0, 0),
                Accion.movimiento(1, 0, 0, 0, 0)));

        assertEquals("Suplente", e.bando(0).activo(0).nombre());
        assertEquals(0, a.etapa(PokemonCombate.ETAPA_ATAQUE), "Al salir se pierden las etapas");
    }

    @Test
    void unBandoQueSeQuedaSinPokemonPierde()
    {
        PokemonCombate a = luchador("A", CatalogoFalso.ELECTRICO, 120, 300);
        PokemonCombate b = luchador("B", CatalogoFalso.AGUA, 80, 1);

        EstadoCombate e = estado(a, b, 1L);

        motor().resolverTurno(e, ambosAtacan());

        assertTrue(e.terminado());
        assertEquals(0, e.ganador());
    }

    @Test
    void elTurnoAvanzaSuContador()
    {
        PokemonCombate a = luchador("A", CatalogoFalso.ELECTRICO, 120, 500);
        PokemonCombate b = luchador("B", CatalogoFalso.AGUA, 80, 500);

        EstadoCombate e = estado(a, b, 1L);
        ServicioCombate motor = motor();

        motor.resolverTurno(e, ambosAtacan());
        motor.resolverTurno(e, ambosAtacan());

        assertEquals(2, e.turno());
    }

    @Test
    void unCombateTerminadoNoSigueResolviendoTurnos()
    {
        PokemonCombate a = luchador("A", CatalogoFalso.ELECTRICO, 120, 300);
        PokemonCombate b = luchador("B", CatalogoFalso.AGUA, 80, 300);

        EstadoCombate e = estado(a, b, 1L);
        e.terminar(0);

        assertTrue(motor().resolverTurno(e, ambosAtacan()).isEmpty());
    }
}
