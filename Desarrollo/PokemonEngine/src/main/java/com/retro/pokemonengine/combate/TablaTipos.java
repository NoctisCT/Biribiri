package com.retro.pokemonengine.combate;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class TablaTipos
{
    private final Map<Long, Double> multiplicadores;

    public TablaTipos(Map<Long, Double> multiplicadores)
    {
        this.multiplicadores = Collections.unmodifiableMap(new HashMap<>(multiplicadores));
    }

    public static long clave(int atacante, int defensor)
    {
        return atacante * 1000L + defensor;
    }

    public double multiplicador(int atacante, int defensor1, Integer defensor2)
    {
        double total = this.multiplicadores.getOrDefault(clave(atacante, defensor1), 1.0);

        if(defensor2 != null)
        {
            total *= this.multiplicadores.getOrDefault(clave(atacante, defensor2), 1.0);
        }

        return total;
    }

    public int tamano()
    {
        return this.multiplicadores.size();
    }
}
