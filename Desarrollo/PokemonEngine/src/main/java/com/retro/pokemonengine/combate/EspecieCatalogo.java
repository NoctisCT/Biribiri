package com.retro.pokemonengine.combate;

public record EspecieCatalogo(
        int id,
        String nombreEs,
        int tipo1,
        Integer tipo2,
        int baseHp,
        int baseAtaque,
        int baseDefensa,
        int baseAtaqueEsp,
        int baseDefensaEsp,
        int baseVelocidad,
        int catchRate,
        int baseExperience,
        String growthRate)
{
    public int base(Stat stat)
    {
        return switch(stat)
        {
            case PS -> this.baseHp;
            case ATAQUE -> this.baseAtaque;
            case DEFENSA -> this.baseDefensa;
            case ATAQUE_ESP -> this.baseAtaqueEsp;
            case DEFENSA_ESP -> this.baseDefensaEsp;
            case VELOCIDAD -> this.baseVelocidad;
        };
    }
}
