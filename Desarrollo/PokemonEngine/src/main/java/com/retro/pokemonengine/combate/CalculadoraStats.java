package com.retro.pokemonengine.combate;

public final class CalculadoraStats
{
    private CalculadoraStats()
    {
    }

    public static int ps(int base, int iv, int ev, int nivel)
    {
        return ((2 * base + iv + (ev / 4)) * nivel) / 100 + nivel + 10;
    }

    public static int otro(Stat stat, int base, int iv, int ev, int nivel, Naturaleza naturaleza)
    {
        if(stat == Stat.PS) return ps(base, iv, ev, nivel);

        int sinNaturaleza = ((2 * base + iv + (ev / 4)) * nivel) / 100 + 5;

        return (int) Math.floor(sinNaturaleza * naturaleza.multiplicador(stat));
    }
}
