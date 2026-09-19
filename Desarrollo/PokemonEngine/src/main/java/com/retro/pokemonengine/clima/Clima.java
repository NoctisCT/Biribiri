package com.retro.pokemonengine.clima;

import com.retro.pokemonengine.combate.Campo;
import com.retro.pokemonengine.combate.EstadoCombate;

/**
 * El tiempo que hace en una zona.
 *
 * La clave interna es la del motor de combate, para que el clima del mundo entre
 * en el combate sin tabla de traduccion que se pueda desincronizar. El nombre que
 * ve el jugador es el del juego en espanol y vive aqui, no en la base de datos:
 * es global por clima y duplicarlo por zona solo daria ocasion de que se separaran.
 *
 * Granizo y nieve son dos climas distintos: el granizo hace dano a quien no sea
 * de Hielo y la nieve les sube la Defensa. No son dos nombres de lo mismo.
 */
public enum Clima
{
    DESPEJADO(EstadoCombate.SIN_CLIMA, "Despejado"),
    SOL(Campo.SOL, "Sol"),
    LLUVIA(Campo.LLUVIA, "Lluvia"),
    TORMENTA_ARENA(Campo.TORMENTA_ARENA, "Tormenta de arena"),
    NIEVE(Campo.NIEVE, "Nieve"),
    GRANIZO(Campo.GRANIZO, "Granizo");

    private final String enCampo;
    private final String nombreEs;

    Clima(String enCampo, String nombreEs)
    {
        this.enCampo = enCampo;
        this.nombreEs = nombreEs;
    }

    public String aCampo()
    {
        return this.enCampo;
    }

    public String nombreEs()
    {
        return this.nombreEs;
    }

    public static Clima porNombre(String nombre)
    {
        if(nombre != null)
        {
            for(Clima clima : values())
            {
                if(clima.name().equalsIgnoreCase(nombre)) return clima;
            }
        }

        return DESPEJADO;
    }
}
