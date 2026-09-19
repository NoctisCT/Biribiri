package com.retro.pokemonengine.entrenador;

/**
 * Quien puede intercambiar y que.
 *
 * La marca del propio Pokemon manda sobre todo lo demas: un premio de evento
 * nace intransferible y no hay requisito que lo desbloquee. Es lo que hace
 * inutil reclamar el mismo regalo con diez cuentas.
 *
 * Los requisitos son dos y las dos cuentan: capturas distintas en la Pokedex,
 * que exigen pisar hierba y gastar balls, e insignias. Las insignias se quedan
 * a cero hasta que existan los gimnasios, que son de la fase 3; si fueran la
 * unica llave, el intercambio naceria muerto.
 *
 * El tiempo jugado no es una llave: se farmea dejando el avatar quieto toda la
 * noche, asi que es un dato de vitrina y nada mas.
 */
public final class ReglasIntercambio
{
    public static final String OK = "OK";
    public static final String NO_INTERCAMBIABLE = "NO_INTERCAMBIABLE";
    public static final String FALTA_DEX = "FALTA_DEX";
    public static final String FALTAN_INSIGNIAS = "FALTAN_INSIGNIAS";

    private ReglasIntercambio()
    {
    }

    public record Requisitos(int dexCapturadosMinimos, int insigniasMinimas)
    {
    }

    public static String puede(PokemonPoseido pokemon, int dexCapturados, int insignias,
                               Requisitos requisitos)
    {
        if(pokemon == null || !pokemon.intercambiable()) return NO_INTERCAMBIABLE;

        if(requisitos == null) return OK;

        if(dexCapturados < requisitos.dexCapturadosMinimos()) return FALTA_DEX;

        if(insignias < requisitos.insigniasMinimas()) return FALTAN_INSIGNIAS;

        return OK;
    }
}
