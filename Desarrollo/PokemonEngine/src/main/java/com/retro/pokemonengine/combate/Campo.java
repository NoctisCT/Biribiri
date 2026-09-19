package com.retro.pokemonengine.combate;

/**
 * Clima y terreno: lo que afecta a todo el campo a la vez.
 *
 * Los cuatro climas y los cuatro terrenos son los que el importador encontro en
 * los datos de Showdown, con sus nombres tal cual, normalizados a minusculas.
 */
public final class Campo
{
    public static final String SOL = "sunnyday";
    public static final String LLUVIA = "raindance";
    public static final String TORMENTA_ARENA = "sandstorm";
    public static final String NIEVE = "snowscape";

    /*
     * Granizo y nieve son climas distintos, no dos nombres de lo mismo: el
     * granizo de las generaciones 2 a 8 hace dano a quien no sea de Hielo, y la
     * nieve de la novena no hace dano y les sube la Defensa. Los dos existen.
     */
    public static final String GRANIZO = "hail";

    public static final String TERRENO_ELECTRICO = "electricterrain";
    public static final String TERRENO_PLANTA = "grassyterrain";
    public static final String TERRENO_NIEBLA = "mistyterrain";
    public static final String TERRENO_PSIQUICO = "psychicterrain";

    public static final int TURNOS_CLIMA = 5;
    public static final int TURNOS_TERRENO = 5;

    private Campo()
    {
    }

    public static String normalizar(String valor)
    {
        return valor == null ? EstadoCombate.SIN_CLIMA : valor.toLowerCase();
    }

    /** Sol potencia Fuego y debilita Agua; la lluvia hace lo contrario. */
    public static double modificadorClima(String clima, int tipoMovimiento)
    {
        String c = normalizar(clima);

        if(SOL.equals(c))
        {
            if(tipoMovimiento == Tipos.FUEGO) return 1.5;
            if(tipoMovimiento == Tipos.AGUA) return 0.5;
        }

        if(LLUVIA.equals(c))
        {
            if(tipoMovimiento == Tipos.AGUA) return 1.5;
            if(tipoMovimiento == Tipos.FUEGO) return 0.5;
        }

        return 1.0;
    }

    /**
     * El terreno solo afecta a quien pisa el suelo: los Voladores quedan fuera.
     * Sube un 30% el tipo afin y reduce Dragon en el terreno de niebla.
     */
    public static double modificadorTerreno(String terreno, int tipoMovimiento, PokemonCombate atacante, PokemonCombate defensor)
    {
        String t = normalizar(terreno);

        if(EstadoCombate.SIN_TERRENO.equals(t)) return 1.0;

        if(TERRENO_ELECTRICO.equals(t) && tipoMovimiento == Tipos.ELECTRICO && pisaSuelo(atacante)) return 1.3;
        if(TERRENO_PLANTA.equals(t) && tipoMovimiento == Tipos.PLANTA && pisaSuelo(atacante)) return 1.3;
        if(TERRENO_PSIQUICO.equals(t) && tipoMovimiento == Tipos.PSIQUICO && pisaSuelo(atacante)) return 1.3;
        if(TERRENO_NIEBLA.equals(t) && tipoMovimiento == Tipos.DRAGON && pisaSuelo(defensor)) return 0.5;

        return 1.0;
    }

    /** Tormenta de arena y nieve solo danan a quien no es inmune. */
    public static boolean leDanaElClima(String clima, PokemonCombate p)
    {
        String c = normalizar(clima);

        if(TORMENTA_ARENA.equals(c))
        {
            return !Tipos.es(p, Tipos.ROCA) && !Tipos.es(p, Tipos.TIERRA) && !Tipos.es(p, Tipos.ACERO);
        }

        if(GRANIZO.equals(c))
        {
            return !Tipos.es(p, Tipos.HIELO);
        }

        return false;
    }

    /** La tormenta sube un 50% la Defensa Especial de los Roca. */
    public static double defensaEspecialPorClima(String clima, PokemonCombate p)
    {
        return TORMENTA_ARENA.equals(normalizar(clima)) && Tipos.es(p, Tipos.ROCA) ? 1.5 : 1.0;
    }

    /** La nieve sube un 50% la Defensa de los Hielo. */
    public static double defensaPorClima(String clima, PokemonCombate p)
    {
        return NIEVE.equals(normalizar(clima)) && Tipos.es(p, Tipos.HIELO) ? 1.5 : 1.0;
    }

    /**
     * El terreno electrico impide dormir y el de niebla impide cualquier estado
     * alterado, a quien pise el suelo.
     */
    public static boolean terrenoImpideEstado(String terreno, String estado, PokemonCombate objetivo)
    {
        String t = normalizar(terreno);

        if(!pisaSuelo(objetivo)) return false;

        if(TERRENO_ELECTRICO.equals(t) && PokemonCombate.SUENO.equals(estado)) return true;
        if(TERRENO_NIEBLA.equals(t)) return true;

        return false;
    }

    /** El terreno psiquico bloquea los movimientos con prioridad contra quien pisa el suelo. */
    public static boolean terrenoBloqueaPrioridad(String terreno, MovimientoCatalogo movimiento, PokemonCombate objetivo)
    {
        return TERRENO_PSIQUICO.equals(normalizar(terreno))
                && movimiento.prioridad() > 0
                && pisaSuelo(objetivo);
    }

    public static boolean pisaSuelo(PokemonCombate p)
    {
        return !Tipos.es(p, Tipos.VOLADOR);
    }
}
