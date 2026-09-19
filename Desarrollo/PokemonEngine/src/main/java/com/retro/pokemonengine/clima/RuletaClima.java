package com.retro.pokemonengine.clima;

import com.retro.pokemonengine.combate.RngCombate;

import java.util.List;

/**
 * Sorteo del clima por pesos, igual que la tabla de encuentros.
 *
 * Se sortea zona por zona y no region por region: con un sorteo global llueve en
 * las cuarenta y cinco rutas a la vez y el clima deja de ser un detalle para ser
 * un interruptor.
 *
 * Una zona sin pesos esta siempre despejada, que es lo que resuelve las cuevas y
 * los interiores sin codigo especial.
 */
public final class RuletaClima
{
    private RuletaClima()
    {
    }

    public record Peso(Clima clima, int peso)
    {
    }

    public static Clima sortear(List<Peso> pesos, RngCombate rng)
    {
        if(pesos == null || pesos.isEmpty()) return Clima.DESPEJADO;

        int total = 0;

        for(Peso peso : pesos)
        {
            if(peso != null && peso.peso() > 0) total += peso.peso();
        }

        if(total <= 0) return Clima.DESPEJADO;

        int tirada = rng.entre(1, total);
        int acumulado = 0;

        for(Peso peso : pesos)
        {
            if(peso == null || peso.peso() <= 0) continue;

            acumulado += peso.peso();

            if(tirada <= acumulado) return peso.clima();
        }

        return Clima.DESPEJADO;
    }
}
