package com.retro.pokemonengine.combate;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrdenTurnoTest
{
    private static final int PLACAJE = 33;
    private static final int VELOCIDAD_EXTREMA = 245;

    private CatalogoFalso catalogo()
    {
        return new CatalogoFalso()
                .con(CatalogoFalso.mov(PLACAJE, "Placaje", CatalogoFalso.NORMAL, "physical", 40, 100, 0, "damage"))
                .con(CatalogoFalso.mov(VELOCIDAD_EXTREMA, "Velocidad Extrema", CatalogoFalso.NORMAL, "physical", 80, 100, 2, "damage"));
    }

    private PokemonCombate luchador(String nombre, int velocidad, int... moveIds)
    {
        PokemonCombate p = new PokemonCombate(1, 1, nombre, 50, CatalogoFalso.NORMAL, null, 100,
                new int[] { 100, 100, 100, 100, 100, velocidad });

        for(int id : moveIds) p.movimientos().add(new MovimientoEnCombate(id, 15, 15));

        return p;
    }

    private EstadoCombate estado(PokemonCombate a, PokemonCombate b, long semilla)
    {
        Bando bandoA = new Bando(0);
        Bando bandoB = new Bando(1);

        bandoA.posiciones().add(a);
        bandoB.posiciones().add(b);

        return new EstadoCombate(bandoA, bandoB, new RngCombate(semilla));
    }

    @Test
    void elMasRapidoActuaPrimero()
    {
        EstadoCombate e = estado(luchador("Rapido", 120, PLACAJE), luchador("Lento", 80, PLACAJE), 1L);

        List<Accion> orden = OrdenTurno.ordenar(e, Arrays.asList(
                Accion.movimiento(1, 0, 0, 0, 0),
                Accion.movimiento(0, 0, 0, 1, 0)), catalogo());

        assertEquals(0, orden.get(0).bando(), "El bando del rápido va primero");
    }

    @Test
    void laPrioridadGanaALaVelocidad()
    {
        PokemonCombate rapido = luchador("Rapido", 200, PLACAJE);
        PokemonCombate lento = luchador("Lento", 10, VELOCIDAD_EXTREMA);

        EstadoCombate e = estado(rapido, lento, 1L);

        List<Accion> orden = OrdenTurno.ordenar(e, Arrays.asList(
                Accion.movimiento(0, 0, 0, 1, 0),
                Accion.movimiento(1, 0, 0, 0, 0)), catalogo());

        assertEquals(1, orden.get(0).bando(), "Velocidad Extrema tiene prioridad +2");
    }

    @Test
    void cambiarVaAntesQueCualquierMovimientoConPrioridad()
    {
        PokemonCombate a = luchador("A", 10, VELOCIDAD_EXTREMA);
        PokemonCombate b = luchador("B", 200, PLACAJE);

        EstadoCombate e = estado(a, b, 1L);
        e.bando(1).banquillo().add(luchador("Suplente", 50, PLACAJE));

        List<Accion> orden = OrdenTurno.ordenar(e, Arrays.asList(
                Accion.movimiento(0, 0, 0, 1, 0),
                Accion.cambio(1, 0, 0)), catalogo());

        assertEquals(Accion.Tipo.CAMBIO, orden.get(0).tipo());
    }

    @Test
    void laParalisisCambiaElOrden()
    {
        PokemonCombate paralizado = luchador("Paralizado", 120, PLACAJE);
        PokemonCombate sano = luchador("Sano", 80, PLACAJE);

        paralizado.aplicarEstado(PokemonCombate.PARALISIS, 0);

        EstadoCombate e = estado(paralizado, sano, 1L);

        List<Accion> orden = OrdenTurno.ordenar(e, Arrays.asList(
                Accion.movimiento(0, 0, 0, 1, 0),
                Accion.movimiento(1, 0, 0, 0, 0)), catalogo());

        assertEquals(1, orden.get(0).bando(), "120 paralizado son 60, menos que 80");
    }

    @Test
    void lasEtapasDeVelocidadCambianElOrden()
    {
        PokemonCombate lento = luchador("Lento", 80, PLACAJE);
        PokemonCombate rapido = luchador("Rapido", 100, PLACAJE);

        lento.cambiarEtapa(PokemonCombate.ETAPA_VELOCIDAD, 2);

        EstadoCombate e = estado(lento, rapido, 1L);

        List<Accion> orden = OrdenTurno.ordenar(e, Arrays.asList(
                Accion.movimiento(0, 0, 0, 1, 0),
                Accion.movimiento(1, 0, 0, 0, 0)), catalogo());

        assertEquals(0, orden.get(0).bando(), "80 con +2 etapas son 160");
    }

    @Test
    void elEmpateExactoLoDecideElRngYEsReproducible()
    {
        List<Accion> acciones = Arrays.asList(
                Accion.movimiento(0, 0, 0, 1, 0),
                Accion.movimiento(1, 0, 0, 0, 0));

        List<Accion> primera = OrdenTurno.ordenar(
                estado(luchador("A", 100, PLACAJE), luchador("B", 100, PLACAJE), 777L),
                acciones, catalogo());

        List<Accion> segunda = OrdenTurno.ordenar(
                estado(luchador("A", 100, PLACAJE), luchador("B", 100, PLACAJE), 777L),
                acciones, catalogo());

        assertEquals(primera.get(0).bando(), segunda.get(0).bando(),
                "La misma semilla debe romper el empate igual");
    }

    @Test
    void conSemillasDistintasElEmpateNoSiempreCaeDelMismoLado()
    {
        List<Accion> acciones = Arrays.asList(
                Accion.movimiento(0, 0, 0, 1, 0),
                Accion.movimiento(1, 0, 0, 0, 0));

        boolean vistoCero = false;
        boolean vistoUno = false;

        for(long semilla = 1; semilla <= 40; semilla++)
        {
            List<Accion> orden = OrdenTurno.ordenar(
                    estado(luchador("A", 100, PLACAJE), luchador("B", 100, PLACAJE), semilla),
                    acciones, catalogo());

            if(orden.get(0).bando() == 0) vistoCero = true;
            else vistoUno = true;
        }

        assertTrue(vistoCero && vistoUno, "El desempate no puede estar sesgado a un bando");
    }
}
