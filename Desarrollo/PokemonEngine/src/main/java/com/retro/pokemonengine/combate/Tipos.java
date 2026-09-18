package com.retro.pokemonengine.combate;

/**
 * Identificadores de tipo tal y como los numera PokeAPI, que es la fuente del
 * catalogo. Estan aqui como constantes porque el clima, los terrenos y las
 * trampas necesitan comprobar tipos concretos.
 */
public final class Tipos
{
    public static final int NORMAL = 1;
    public static final int LUCHA = 2;
    public static final int VOLADOR = 3;
    public static final int VENENO = 4;
    public static final int TIERRA = 5;
    public static final int ROCA = 6;
    public static final int BICHO = 7;
    public static final int FANTASMA = 8;
    public static final int ACERO = 9;
    public static final int FUEGO = 10;
    public static final int AGUA = 11;
    public static final int PLANTA = 12;
    public static final int ELECTRICO = 13;
    public static final int PSIQUICO = 14;
    public static final int HIELO = 15;
    public static final int DRAGON = 16;
    public static final int SINIESTRO = 17;
    public static final int HADA = 18;
    public static final int ASTRAL = 19;

    private Tipos()
    {
    }

    public static boolean es(PokemonCombate p, int tipo)
    {
        return p.tipo1() == tipo || (p.tipo2() != null && p.tipo2() == tipo);
    }
}
