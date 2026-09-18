package com.retro.pokemonengine.encuentros;

import com.retro.pokemonengine.combate.RngCombate;

import java.util.ArrayList;
import java.util.List;

/**
 * El sorteo de encuentros: pura aritmetica sobre una lista de filas.
 *
 * No sabe de zonas ni de salas. Quien llama filtra por metodo y franja, sortea
 * y decide el nivel; asi se puede probar con miles de tiradas sin base de datos.
 */
public final class TablaEncuentros
{
    private TablaEncuentros()
    {
    }

    /** Las filas que aplican a este metodo y esta franja, en el mismo orden. */
    public static List<Encuentro> disponibles(List<Encuentro> encuentros, MetodoEncuentro metodo, Franja franja)
    {
        List<Encuentro> resultado = new ArrayList<>();

        if(encuentros == null) return resultado;

        for(Encuentro encuentro : encuentros)
        {
            if(encuentro != null && encuentro.apareceEn(metodo, franja)) resultado.add(encuentro);
        }

        return resultado;
    }

    /**
     * Sortea por peso acumulado. Devuelve null si no hay nada que sortear:
     * una zona sin encuentros no es un error, es una plaza de pueblo.
     */
    public static Encuentro sortear(List<Encuentro> encuentros, RngCombate rng)
    {
        if(encuentros == null || encuentros.isEmpty()) return null;

        int total = 0;

        for(Encuentro encuentro : encuentros)
        {
            if(encuentro != null) total += encuentro.peso();
        }

        if(total <= 0) return null;

        int tirada = rng.entre(1, total);
        int acumulado = 0;

        for(Encuentro encuentro : encuentros)
        {
            if(encuentro == null || encuentro.peso() <= 0) continue;

            acumulado += encuentro.peso();

            if(tirada <= acumulado) return encuentro;
        }

        return null;
    }

    public static int nivel(Encuentro encuentro, RngCombate rng)
    {
        return rng.entre(encuentro.nivelMin(), encuentro.nivelMax());
    }
}
