package com.retro.pokemonengine.combate;

public final class Accion
{
    public enum Tipo
    {
        HUIDA,
        OBJETO,
        CAMBIO,
        MOVIMIENTO
    }

    private final Tipo tipo;
    private final int bando;
    private final int posicion;
    private final int indiceMovimiento;
    private final int bandoObjetivo;
    private final int posicionObjetivo;
    private final int parametro;

    private Accion(Tipo tipo, int bando, int posicion, int indiceMovimiento,
                   int bandoObjetivo, int posicionObjetivo, int parametro)
    {
        this.tipo = tipo;
        this.bando = bando;
        this.posicion = posicion;
        this.indiceMovimiento = indiceMovimiento;
        this.bandoObjetivo = bandoObjetivo;
        this.posicionObjetivo = posicionObjetivo;
        this.parametro = parametro;
    }

    public static Accion movimiento(int bando, int posicion, int indiceMovimiento,
                                    int bandoObjetivo, int posicionObjetivo)
    {
        return new Accion(Tipo.MOVIMIENTO, bando, posicion, indiceMovimiento,
                bandoObjetivo, posicionObjetivo, 0);
    }

    public static Accion cambio(int bando, int posicion, int indiceBanquillo)
    {
        return new Accion(Tipo.CAMBIO, bando, posicion, -1, bando, posicion, indiceBanquillo);
    }

    public static Accion objeto(int bando, int posicion, int itemId)
    {
        return new Accion(Tipo.OBJETO, bando, posicion, -1, bando, posicion, itemId);
    }

    public static Accion huida(int bando, int posicion)
    {
        return new Accion(Tipo.HUIDA, bando, posicion, -1, bando, posicion, 0);
    }

    public Tipo tipo() { return this.tipo; }
    public int bando() { return this.bando; }
    public int posicion() { return this.posicion; }
    public int indiceMovimiento() { return this.indiceMovimiento; }
    public int bandoObjetivo() { return this.bandoObjetivo; }
    public int posicionObjetivo() { return this.posicionObjetivo; }
    public int parametro() { return this.parametro; }

    /** Huida, objeto y cambio van antes que cualquier movimiento. */
    public int prioridadBase()
    {
        return switch(this.tipo)
        {
            case HUIDA -> 8;
            case OBJETO -> 7;
            case CAMBIO -> 6;
            case MOVIMIENTO -> 0;
        };
    }
}
