package com.retro.pokemonengine.combate;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Orden en que se ejecutan las acciones de un turno.
 *
 * Huida, objetos y cambios van antes que cualquier movimiento; luego manda la
 * prioridad del movimiento y, a igualdad, la Velocidad efectiva. Los empates
 * exactos los rompe el RNG sembrado, no el orden de llegada.
 */
public final class OrdenTurno
{
    private OrdenTurno()
    {
    }

    public static List<Accion> ordenar(EstadoCombate estado, List<Accion> acciones, CatalogoCombate catalogo)
    {
        List<Entrada> entradas = new ArrayList<>();

        for(Accion accion : acciones)
        {
            entradas.add(new Entrada(
                    accion,
                    prioridadTotal(estado, accion, catalogo),
                    velocidad(estado, accion),
                    estado.rng().entre(0, 1_000_000)));
        }

        entradas.sort(Comparator
                .comparingInt((Entrada e) -> e.prioridad).reversed()
                .thenComparing(Comparator.comparingInt((Entrada e) -> e.velocidad).reversed())
                .thenComparingInt(e -> e.desempate));

        List<Accion> salida = new ArrayList<>();

        for(Entrada e : entradas) salida.add(e.accion);

        return salida;
    }

    /**
     * Las acciones que no son movimiento se separan por cien para que ninguna
     * prioridad de movimiento (de -7 a +5) pueda alcanzarlas.
     */
    public static int prioridadTotal(EstadoCombate estado, Accion accion, CatalogoCombate catalogo)
    {
        if(accion.tipo() != Accion.Tipo.MOVIMIENTO)
        {
            return accion.prioridadBase() * 100;
        }

        MovimientoCatalogo m = movimientoDe(estado, accion, catalogo);

        return m == null ? 0 : m.prioridad();
    }

    public static MovimientoCatalogo movimientoDe(EstadoCombate estado, Accion accion, CatalogoCombate catalogo)
    {
        PokemonCombate quien = estado.bando(accion.bando()).activo(accion.posicion());

        if(quien == null) return null;
        if(accion.indiceMovimiento() < 0) return null;
        if(accion.indiceMovimiento() >= quien.movimientos().size()) return null;

        return catalogo.movimiento(quien.movimientos().get(accion.indiceMovimiento()).moveId());
    }

    private static int velocidad(EstadoCombate estado, Accion accion)
    {
        PokemonCombate quien = estado.bando(accion.bando()).activo(accion.posicion());

        return quien == null ? 0 : quien.statEfectivo(Stat.VELOCIDAD);
    }

    private static final class Entrada
    {
        final Accion accion;
        final int prioridad;
        final int velocidad;
        final int desempate;

        Entrada(Accion accion, int prioridad, int velocidad, int desempate)
        {
            this.accion = accion;
            this.prioridad = prioridad;
            this.velocidad = velocidad;
            this.desempate = desempate;
        }
    }
}
