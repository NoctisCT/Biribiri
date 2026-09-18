package com.retro.pokemonengine.combate;

import java.util.HashMap;
import java.util.Map;

/**
 * Catálogo de mentira para las pruebas del motor: sin base de datos y con solo
 * los movimientos que cada prueba necesita.
 */
final class CatalogoFalso implements CatalogoCombate
{
    static final int NORMAL = 1;
    static final int ELECTRICO = 13;
    static final int AGUA = 11;
    static final int TIERRA = 5;
    static final int VOLADOR = 3;

    private final Map<Integer, MovimientoCatalogo> movimientos = new HashMap<>();
    private final Map<Integer, EspecieCatalogo> especies = new HashMap<>();
    private final Map<Long, Double> tabla = new HashMap<>();

    CatalogoFalso()
    {
        tabla.put(TablaTipos.clave(ELECTRICO, AGUA), 2.0);
        tabla.put(TablaTipos.clave(ELECTRICO, VOLADOR), 2.0);
        tabla.put(TablaTipos.clave(ELECTRICO, TIERRA), 0.0);
    }

    CatalogoFalso con(MovimientoCatalogo movimiento)
    {
        this.movimientos.put(movimiento.id(), movimiento);
        return this;
    }

    static MovimientoCatalogo mov(int id, String nombre, int tipo, String clase,
                                  Integer potencia, Integer precision, int prioridad, String effectCode)
    {
        return new MovimientoCatalogo(id, nombre, tipo, clase, potencia, precision,
                15, prioridad, "selected-pokemon", effectCode, true);
    }

    @Override
    public MovimientoCatalogo movimiento(int id)
    {
        return this.movimientos.get(id);
    }

    @Override
    public EspecieCatalogo especie(int id)
    {
        return this.especies.get(id);
    }

    @Override
    public TablaTipos tipos()
    {
        return new TablaTipos(this.tabla);
    }
}
