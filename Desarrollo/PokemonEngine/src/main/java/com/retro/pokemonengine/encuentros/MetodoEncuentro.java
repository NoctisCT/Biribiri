package com.retro.pokemonengine.encuentros;

/**
 * Como se provoca el encuentro.
 *
 * La fase 1 solo usa HIERBA, pero el metodo va en la tabla desde el principio
 * porque una zona con agua o con cueva reutiliza las mismas filas.
 */
public enum MetodoEncuentro
{
    HIERBA,
    CUEVA,
    SURF,
    PESCA,
    ESPECIAL;

    public static MetodoEncuentro porNombre(String nombre)
    {
        if(nombre != null)
        {
            for(MetodoEncuentro metodo : values())
            {
                if(metodo.name().equalsIgnoreCase(nombre)) return metodo;
            }
        }

        return HIERBA;
    }
}
