package com.retro.pokemonengine.entrenador;

/**
 * Un hueco de movimiento del Pokemon del jugador.
 *
 * Los Mas PP suben el maximo en un 20% del PP base por cada uno, hasta tres,
 * y ese maximo es el que se guarda para no recalcularlo en cada consulta.
 */
public final class MovimientoPoseido
{
    public static final int PP_UP_MAX = 3;

    private final int moveId;
    private final int ppBase;
    private int ppUp;
    private int ppActual;

    public MovimientoPoseido(int moveId, int ppBase, int ppUp, int ppActual)
    {
        this.moveId = moveId;
        this.ppBase = Math.max(1, ppBase);
        this.ppUp = Math.max(0, Math.min(PP_UP_MAX, ppUp));
        this.ppActual = Math.max(0, Math.min(ppActual, ppMaximo()));
    }

    public static MovimientoPoseido nuevo(int moveId, int ppBase)
    {
        return new MovimientoPoseido(moveId, ppBase, 0, ppBase);
    }

    public int moveId() { return this.moveId; }
    public int ppBase() { return this.ppBase; }
    public int ppUp() { return this.ppUp; }
    public int ppActual() { return this.ppActual; }

    public int ppMaximo()
    {
        return this.ppBase + this.ppBase / 5 * this.ppUp;
    }

    public boolean subirPpUp()
    {
        if(this.ppUp >= PP_UP_MAX) return false;

        int antes = ppMaximo();

        this.ppUp++;
        this.ppActual += ppMaximo() - antes;

        return true;
    }

    public void gastarPp()
    {
        if(this.ppActual > 0) this.ppActual--;
    }

    public void restaurarPp(int cantidad)
    {
        this.ppActual = Math.min(ppMaximo(), this.ppActual + Math.max(0, cantidad));
    }

    public void restaurarTodo()
    {
        this.ppActual = ppMaximo();
    }
}
