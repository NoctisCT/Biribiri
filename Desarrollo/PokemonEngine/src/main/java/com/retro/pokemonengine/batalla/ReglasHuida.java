package com.retro.pokemonengine.batalla;

import com.retro.pokemonengine.combate.RngCombate;

/**
 * Huir de un salvaje, con la formula de tercera generacion en adelante.
 *
 * Los intentos se acumulan dentro del mismo combate: el cuarto sale casi
 * siempre aunque el rival sea mucho mas rapido. Es lo que impide que un
 * Pokemon veloz deje al jugador encerrado en un encuentro que no queria.
 *
 * De un entrenador no se huye, pero eso no lo decide esta clase: lo decide
 * `Formato.huidaPermitida()`, porque es una propiedad del combate y no del
 * calculo.
 */
public final class ReglasHuida
{
    private ReglasHuida()
    {
    }

    /**
     * @param intentos cuantas veces se ha intentado huir en este combate,
     *                 contando el actual. El primero es 1.
     */
    public static boolean intentar(int velocidadPropia, int velocidadRival,
                                   int intentos, RngCombate rng)
    {
        if(velocidadPropia > velocidadRival) return true;

        int divisor = (velocidadRival / 4) % 256;

        // La formula original divide por esto. Con un rival lentisimo da cero,
        // y el caso se resuelve como lo que es: huida segura.
        if(divisor == 0) return true;

        int umbral = ((velocidadPropia * 32) / divisor) + 30 * Math.max(1, intentos);

        if(umbral >= 256) return true;

        return rng.entre(0, 255) < umbral;
    }
}
