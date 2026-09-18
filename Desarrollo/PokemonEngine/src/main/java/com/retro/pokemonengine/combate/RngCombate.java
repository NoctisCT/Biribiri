package com.retro.pokemonengine.combate;

import java.util.Random;

/**
 * Azar del combate, sembrado para que un combate sea reproducible bit a bit
 * a partir de su semilla y su registro de acciones.
 */
public final class RngCombate
{
    private final long semilla;
    private final Random random;

    public RngCombate(long semilla)
    {
        this.semilla = semilla;
        this.random = new Random(semilla);
    }

    public long semilla()
    {
        return this.semilla;
    }

    /** Entero entre a y b, ambos incluidos. */
    public int entre(int a, int b)
    {
        if(b <= a) return a;

        return a + this.random.nextInt(b - a + 1);
    }

    /** true con probabilidad p por ciento. */
    public boolean porcentaje(int p)
    {
        if(p <= 0) return false;
        if(p >= 100) return true;

        return this.random.nextInt(100) < p;
    }

    /** La variación de daño de los juegos: 85 a 100. */
    public int variacionDano()
    {
        return entre(85, 100);
    }
}
