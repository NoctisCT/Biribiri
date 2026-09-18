package com.retro.pokemonengine.encuentros;

/**
 * La franja horaria del servidor, que decide que Pokemon aparecen.
 *
 * Un encuentro sin franja aparece a cualquier hora: es lo normal en una ruta,
 * y la franja se reserva para lo que de verdad cambia de dia a noche.
 */
public enum Franja
{
    MANANA,
    DIA,
    TARDE,
    NOCHE;

    /**
     * Manana 4-9, dia 10-17, tarde 18-20, noche 21-3.
     *
     * La hora entra ya normalizada por quien llama: asi la tabla se puede probar
     * sin depender del reloj de la maquina.
     */
    public static Franja deHora(int hora)
    {
        int h = ((hora % 24) + 24) % 24;

        if(h >= 4 && h <= 9) return MANANA;
        if(h >= 10 && h <= 17) return DIA;
        if(h >= 18 && h <= 20) return TARDE;

        return NOCHE;
    }

    public static Franja porNombre(String nombre)
    {
        if(nombre != null)
        {
            for(Franja franja : values())
            {
                if(franja.name().equalsIgnoreCase(nombre)) return franja;
            }
        }

        return null;
    }
}
