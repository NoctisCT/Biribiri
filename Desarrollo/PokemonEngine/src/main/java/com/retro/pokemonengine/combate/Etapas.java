package com.retro.pokemonengine.combate;

/**
 * Multiplicadores por etapa de stat (-6 a +6).
 *
 * Ataque, Defensa, Ataque Especial, Defensa Especial y Velocidad usan divisor 2;
 * precisión y evasión usan 3, que es la diferencia que más se olvida al implementarlo.
 */
public final class Etapas
{
    public static final int MINIMO = -6;
    public static final int MAXIMO = 6;

    private Etapas()
    {
    }

    public static int acotar(int etapa)
    {
        return Math.max(MINIMO, Math.min(MAXIMO, etapa));
    }

    public static double multiplicador(int etapa)
    {
        int e = acotar(etapa);

        return e >= 0 ? (2.0 + e) / 2.0 : 2.0 / (2.0 - e);
    }

    public static double multiplicadorPunteria(int etapa)
    {
        int e = acotar(etapa);

        return e >= 0 ? (3.0 + e) / 3.0 : 3.0 / (3.0 - e);
    }
}
