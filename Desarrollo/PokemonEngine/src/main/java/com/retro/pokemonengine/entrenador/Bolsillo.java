package com.retro.pokemonengine.entrenador;

/**
 * Los bolsillos de la mochila.
 *
 * Los objetos clave no se apilan, no se tiran y no se venden: es lo que impide
 * que un jugador se quede sin la bici o sin una MO y bloquee su propia partida.
 */
public enum Bolsillo
{
    OBJETOS(999, true, true),
    MEDICINAS(999, true, true),
    BALLS(999, true, true),
    MO_MT(999, true, true),
    BAYAS(999, true, true),
    CLAVE(1, false, false);

    public static final int TOPE_PILA = 999;

    private final int topePila;
    private final boolean sePuedeTirar;
    private final boolean sePuedeVender;

    Bolsillo(int topePila, boolean sePuedeTirar, boolean sePuedeVender)
    {
        this.topePila = topePila;
        this.sePuedeTirar = sePuedeTirar;
        this.sePuedeVender = sePuedeVender;
    }

    public int topePila()
    {
        return this.topePila;
    }

    public boolean sePuedeTirar()
    {
        return this.sePuedeTirar;
    }

    public boolean sePuedeVender()
    {
        return this.sePuedeVender;
    }

    public static Bolsillo porNombre(String nombre)
    {
        if(nombre != null)
        {
            for(Bolsillo bolsillo : values())
            {
                if(bolsillo.name().equalsIgnoreCase(nombre)) return bolsillo;
            }
        }

        return OBJETOS;
    }
}
