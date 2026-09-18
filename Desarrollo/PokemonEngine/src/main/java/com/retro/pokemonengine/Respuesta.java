package com.retro.pokemonengine;

/** Lo que una accion devuelve al handler: si salio bien y el JSON que se manda. */
public record Respuesta(boolean exito, String cuerpo)
{
    public static Respuesta bien(Object datos)
    {
        return new Respuesta(true, PokemonCuerpo.datos(datos));
    }

    public static Respuesta mal(String codigo, String mensaje)
    {
        return new Respuesta(false, PokemonCuerpo.error(codigo, mensaje));
    }
}
