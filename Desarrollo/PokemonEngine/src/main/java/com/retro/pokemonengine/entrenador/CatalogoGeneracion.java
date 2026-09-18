package com.retro.pokemonengine.entrenador;

import java.util.List;

/**
 * Lo unico que la generacion necesita del catalogo.
 *
 * Existe por la misma razon que CatalogoCombate: que este paquete no dependa de
 * ServicioPokedex, que si importa el emulador.
 */
public interface CatalogoGeneracion
{
    EspecieGeneracion especie(int especieId);

    /**
     * Los movimientos que la especie aprende por nivel hasta el nivel dado,
     * en el orden en que los aprende (el ultimo de la lista es el mas reciente).
     */
    List<MovimientoAprendido> movimientosPorNivel(int especieId, int nivel);

    /** El PP base del movimiento, para llenar el hueco al crearlo. */
    int ppBase(int moveId);

    record MovimientoAprendido(int moveId, int nivel)
    {
    }
}
