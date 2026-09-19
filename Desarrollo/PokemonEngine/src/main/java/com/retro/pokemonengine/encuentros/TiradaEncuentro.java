package com.retro.pokemonengine.encuentros;

import com.retro.pokemonengine.combate.RngCombate;

/**
 * Decide si un paso produce un encuentro.
 *
 * No sabe de zonas, de salas ni de jugadores: recibe la probabilidad y el estado
 * de ese jugador y devuelve el estado nuevo. Asi se puede probar con diez mil
 * pasos seguidos sin levantar el emulador.
 */
public final class TiradaEncuentro
{
    /** Pasos sin tirar despues de un encuentro. */
    public static final int ENFRIAMIENTO_PASOS = 8;

    /** Milisegundos sin tirar despues de un encuentro, ademas de los pasos. */
    public static final long ENFRIAMIENTO_MS = 5000L;

    private TiradaEncuentro()
    {
    }

    public record Estado(int pasosEnfriamiento, long esperaHastaMs, int pasosSilenciados)
    {
    }

    public record Resultado(boolean toca, Estado estado)
    {
    }

    public static Estado inicial()
    {
        return new Estado(0, 0L, 0);
    }

    /** Rellena el contador del Repelente. Sustituye al que hubiera, no suma. */
    public static Estado silenciar(Estado estado, int pasos)
    {
        Estado actual = estado == null ? inicial() : estado;

        return new Estado(actual.pasosEnfriamiento(), actual.esperaHastaMs(), Math.max(0, pasos));
    }

    public static Resultado paso(int porMil, Estado estado, long ahoraMs, RngCombate rng)
    {
        Estado actual = estado == null ? inicial() : estado;

        int silenciados = Math.max(0, actual.pasosSilenciados());
        int enfriamiento = Math.max(0, actual.pasosEnfriamiento());

        // El silenciado se gasta aunque no se tire: el Repelente cuenta pasos,
        // no encuentros evitados.
        if(silenciados > 0)
        {
            return new Resultado(false,
                    new Estado(Math.max(0, enfriamiento - 1), actual.esperaHastaMs(), silenciados - 1));
        }

        if(enfriamiento > 0)
        {
            return new Resultado(false, new Estado(enfriamiento - 1, actual.esperaHastaMs(), 0));
        }

        if(ahoraMs < actual.esperaHastaMs())
        {
            return new Resultado(false, new Estado(0, actual.esperaHastaMs(), 0));
        }

        if(porMil <= 0 || rng.entre(1, 1000) > porMil)
        {
            return new Resultado(false, new Estado(0, actual.esperaHastaMs(), 0));
        }

        return new Resultado(true, new Estado(ENFRIAMIENTO_PASOS, ahoraMs + ENFRIAMIENTO_MS, 0));
    }
}
