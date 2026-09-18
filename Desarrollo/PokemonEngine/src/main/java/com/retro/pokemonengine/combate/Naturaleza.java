package com.retro.pokemonengine.combate;

public enum Naturaleza
{
    HARDY("hardy", null, null),
    LONELY("lonely", Stat.ATAQUE, Stat.DEFENSA),
    BRAVE("brave", Stat.ATAQUE, Stat.VELOCIDAD),
    ADAMANT("adamant", Stat.ATAQUE, Stat.ATAQUE_ESP),
    NAUGHTY("naughty", Stat.ATAQUE, Stat.DEFENSA_ESP),
    BOLD("bold", Stat.DEFENSA, Stat.ATAQUE),
    DOCILE("docile", null, null),
    RELAXED("relaxed", Stat.DEFENSA, Stat.VELOCIDAD),
    IMPISH("impish", Stat.DEFENSA, Stat.ATAQUE_ESP),
    LAX("lax", Stat.DEFENSA, Stat.DEFENSA_ESP),
    TIMID("timid", Stat.VELOCIDAD, Stat.ATAQUE),
    HASTY("hasty", Stat.VELOCIDAD, Stat.DEFENSA),
    SERIOUS("serious", null, null),
    JOLLY("jolly", Stat.VELOCIDAD, Stat.ATAQUE_ESP),
    NAIVE("naive", Stat.VELOCIDAD, Stat.DEFENSA_ESP),
    MODEST("modest", Stat.ATAQUE_ESP, Stat.ATAQUE),
    MILD("mild", Stat.ATAQUE_ESP, Stat.DEFENSA),
    QUIET("quiet", Stat.ATAQUE_ESP, Stat.VELOCIDAD),
    BASHFUL("bashful", null, null),
    RASH("rash", Stat.ATAQUE_ESP, Stat.DEFENSA_ESP),
    CALM("calm", Stat.DEFENSA_ESP, Stat.ATAQUE),
    GENTLE("gentle", Stat.DEFENSA_ESP, Stat.DEFENSA),
    SASSY("sassy", Stat.DEFENSA_ESP, Stat.VELOCIDAD),
    CAREFUL("careful", Stat.DEFENSA_ESP, Stat.ATAQUE_ESP),
    QUIRKY("quirky", null, null);

    private final String nombre;
    private final Stat sube;
    private final Stat baja;

    Naturaleza(String nombre, Stat sube, Stat baja)
    {
        this.nombre = nombre;
        this.sube = sube;
        this.baja = baja;
    }

    public String nombre()
    {
        return this.nombre;
    }

    public Stat sube()
    {
        return this.sube;
    }

    public Stat baja()
    {
        return this.baja;
    }

    public static Naturaleza porNombre(String nombre)
    {
        if(nombre != null)
        {
            for(Naturaleza naturaleza : values())
            {
                if(naturaleza.nombre.equalsIgnoreCase(nombre)) return naturaleza;
            }
        }

        return HARDY;
    }

    public double multiplicador(Stat stat)
    {
        if(stat == Stat.PS) return 1.0;
        if(stat == this.sube) return 1.1;
        if(stat == this.baja) return 0.9;

        return 1.0;
    }
}
