package com.retro.pokemonengine.batalla;

/**
 * Cuanto se espera a alguien.
 *
 * Dos relojes distintos y a proposito. El del **turno** es corto: el rival no
 * puede quedarse mirando la pantalla media hora. El de la **gracia** es largo:
 * a quien se le cae la conexion no se le castiga por su router.
 *
 * Esta clase solo compara numeros. Quien decide que hacer al expirar — mover
 * por el jugador, o darle la derrota por abandono — es ServicioBatalla.
 */
public final class ReglasAbandono
{
    /** Lo que se espera a quien se ha caido antes de darle la derrota. */
    public static final long GRACIA_MS = 3L * 60L * 1000L;

    /** Lo que se espera a que alguien elija accion. */
    public static final long TURNO_MS = 30L * 1000L;

    private ReglasAbandono()
    {
    }

    public static boolean expirado(long ausenteDesdeMs, long ahoraMs)
    {
        return ahoraMs - ausenteDesdeMs >= GRACIA_MS;
    }

    public static long restanteMs(long ausenteDesdeMs, long ahoraMs)
    {
        return Math.max(0L, GRACIA_MS - (ahoraMs - ausenteDesdeMs));
    }

    public static boolean turnoExpirado(long turnoDesdeMs, long ahoraMs)
    {
        return ahoraMs - turnoDesdeMs >= TURNO_MS;
    }
}
