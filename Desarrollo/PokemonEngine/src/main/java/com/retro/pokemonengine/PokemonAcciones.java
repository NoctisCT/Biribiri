package com.retro.pokemonengine;

/**
 * Las acciones del paquete 6400, en los rangos reservados por el diseno.
 *
 * Los rangos no se reordenan nunca: un cliente cacheado viejo que mande un 24
 * tiene que seguir queriendo decir lo mismo.
 */
public final class PokemonAcciones
{
    // 1-19 sesion, zona y seguidor
    public static final int SALUDO = 1;
    public static final int CATALOGO = 2;
    public static final int ENTRENADOR_ESTADO = 3;
    public static final int SEGUIDOR_ELEGIR = 4;
    public static final int SEGUIDOR_ACTIVAR = 5;
    public static final int SEGUIDOR_ANIMACIONES = 6;
    public static final int ZONA_INFO = 7;

    // 20-39 equipo y cajas
    public static final int EQUIPO_LISTAR = 20;
    public static final int CAJAS_LISTAR = 22;
    public static final int CAJA_VER = 23;
    public static final int POKEMON_MOVER = 24;
    public static final int POKEMON_DETALLE = 25;
    public static final int POKEMON_MOTE = 26;
    public static final int POKEMON_FAVORITO = 27;
    public static final int CAJA_RENOMBRAR = 28;
    public static final int POKEMON_DEPOSITAR = 29;
    public static final int POKEMON_RETIRAR = 30;

    // 40-59 mochila y objetos
    public static final int MOCHILA_LISTAR = 40;
    public static final int MOCHILA_TIRAR = 41;
    public static final int OBJETO_DAR = 42;
    public static final int OBJETO_QUITAR = 43;

    // 60-99 encuentros y combate
    public static final int ENCUENTRO_BUSCAR = 60;
    public static final int CAPTURA_INTENTAR = 61;
    public static final int ENCUENTRO_HUIR = 62;

    // 100-119 pokedex
    public static final int DEX_RESUMEN = 100;
    public static final int DEX_ENTRADA = 101;

    // 120-139 tiendas y centros
    public static final int TIENDA_VER = 120;
    public static final int TIENDA_COMPRAR = 121;
    public static final int TIENDA_VENDER = 122;
    public static final int CENTRO_CURAR = 123;

    private PokemonAcciones()
    {
    }
}
