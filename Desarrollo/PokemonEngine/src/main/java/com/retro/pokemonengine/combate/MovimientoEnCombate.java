package com.retro.pokemonengine.combate;

public final class MovimientoEnCombate
{
    private final int moveId;
    private final int ppMaximo;
    private int ppActual;

    public MovimientoEnCombate(int moveId, int ppMaximo, int ppActual)
    {
        this.moveId = moveId;
        this.ppMaximo = ppMaximo;
        this.ppActual = ppActual;
    }

    public int moveId() { return this.moveId; }
    public int ppMaximo() { return this.ppMaximo; }
    public int ppActual() { return this.ppActual; }

    public boolean tienePp()
    {
        return this.ppActual > 0;
    }

    public void gastarPp()
    {
        if(this.ppActual > 0) this.ppActual--;
    }

    public void restaurarPp(int cantidad)
    {
        this.ppActual = Math.min(this.ppMaximo, this.ppActual + cantidad);
    }
}
