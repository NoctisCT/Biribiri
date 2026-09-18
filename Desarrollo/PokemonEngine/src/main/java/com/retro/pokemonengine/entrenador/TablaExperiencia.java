package com.retro.pokemonengine.entrenador;

/**
 * Las seis curvas de experiencia de los juegos.
 *
 * Los nombres de las curvas son los que devuelve PokeAPI y los que el importador
 * guarda en `pokemon_species.growth_rate`, para no traducir dos veces.
 * Toda la aritmetica es entera y trunca en cada paso, como en los juegos.
 */
public final class TablaExperiencia
{
    public static final int NIVEL_MIN = 1;
    public static final int NIVEL_MAX = 100;

    public enum Curva
    {
        LENTA("slow"),
        MEDIA("medium"),
        RAPIDA("fast"),
        MEDIA_LENTA("medium-slow"),
        ERRATICA("slow-then-very-fast"),
        FLUCTUANTE("fast-then-very-slow");

        private final String nombre;

        Curva(String nombre)
        {
            this.nombre = nombre;
        }

        public String nombre()
        {
            return this.nombre;
        }
    }

    private TablaExperiencia()
    {
    }

    /** Una curva desconocida cae en la media, que es la de casi la mitad del catalogo. */
    public static Curva porNombre(String nombre)
    {
        if(nombre != null)
        {
            for(Curva curva : Curva.values())
            {
                if(curva.nombre().equalsIgnoreCase(nombre)) return curva;
            }
        }

        return Curva.MEDIA;
    }

    public static long expParaNivel(Curva curva, int nivel)
    {
        if(nivel <= NIVEL_MIN) return 0L;

        int n = Math.min(nivel, NIVEL_MAX);
        long cubo = (long) n * n * n;

        return switch(curva)
        {
            case MEDIA -> cubo;
            case RAPIDA -> 4L * cubo / 5L;
            case LENTA -> 5L * cubo / 4L;
            case MEDIA_LENTA -> 6L * cubo / 5L - 15L * n * n + 100L * n - 140L;
            case ERRATICA -> erratica(n, cubo);
            case FLUCTUANTE -> fluctuante(n, cubo);
        };
    }

    private static long erratica(int n, long cubo)
    {
        if(n <= 50) return cubo * (100 - n) / 50L;
        if(n <= 68) return cubo * (150 - n) / 100L;
        if(n <= 98) return cubo * ((1911 - 10L * n) / 3L) / 500L;

        return cubo * (160 - n) / 100L;
    }

    private static long fluctuante(int n, long cubo)
    {
        if(n <= 15) return cubo * ((n + 1) / 3 + 24) / 50L;
        if(n <= 36) return cubo * (n + 14) / 50L;

        return cubo * (n / 2 + 32) / 50L;
    }

    /** El nivel mas alto cuyo umbral de experiencia ya se ha alcanzado. */
    public static int nivelParaExp(Curva curva, long experiencia)
    {
        if(experiencia <= 0L) return NIVEL_MIN;

        for(int nivel = NIVEL_MAX; nivel > NIVEL_MIN; nivel--)
        {
            if(experiencia >= expParaNivel(curva, nivel)) return nivel;
        }

        return NIVEL_MIN;
    }

    /** Lo que falta para el siguiente nivel; 0 si ya esta al maximo. */
    public static long faltaParaSiguiente(Curva curva, long experiencia)
    {
        int nivel = nivelParaExp(curva, experiencia);

        if(nivel >= NIVEL_MAX) return 0L;

        return Math.max(0L, expParaNivel(curva, nivel + 1) - experiencia);
    }
}
