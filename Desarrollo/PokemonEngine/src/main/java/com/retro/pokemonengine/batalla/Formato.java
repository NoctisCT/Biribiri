package com.retro.pokemonengine.batalla;

/**
 * De que combate se trata.
 *
 * Manda sobre las tres reglas que cambian de un combate a otro: si se puede
 * huir, si se puede capturar y si deja premio. Los formatos de gimnasio y de
 * torneo entraran aqui sin tocar el motor, que es justo para lo que existe.
 */
public enum Formato
{
    /** Contra un Pokemon salvaje: se huye, se captura y deja experiencia. */
    SALVAJE(true, true, true),

    /**
     * Jugador contra jugador en sala de jugador. No se huye, no se captura y
     * no deja premio: un amistoso que diera experiencia se farmearia con una
     * segunda cuenta en dos minutos.
     */
    PVP_AMISTOSO(false, false, false);

    private final boolean huidaPermitida;
    private final boolean capturaPermitida;
    private final boolean daRecompensa;

    Formato(boolean huidaPermitida, boolean capturaPermitida, boolean daRecompensa)
    {
        this.huidaPermitida = huidaPermitida;
        this.capturaPermitida = capturaPermitida;
        this.daRecompensa = daRecompensa;
    }

    public boolean huidaPermitida() { return this.huidaPermitida; }
    public boolean capturaPermitida() { return this.capturaPermitida; }
    public boolean daRecompensa() { return this.daRecompensa; }

    /** Lo desconocido es SALVAJE: es el formato que no concede nada raro. */
    public static Formato porNombre(String nombre)
    {
        if(nombre == null) return SALVAJE;

        for(Formato formato : values())
        {
            if(formato.name().equalsIgnoreCase(nombre.trim())) return formato;
        }

        return SALVAJE;
    }
}
