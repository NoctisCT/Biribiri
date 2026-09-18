package com.retro.pokemonengine;

import com.eu.habbo.messages.ServerMessage;

public final class PokemonPackets
{
    public static final int RESULT_PACKET = 6401;

    private PokemonPackets()
    {
    }

    public static ServerMessage resultado(int accion, boolean exito, String cuerpoJson)
    {
        ServerMessage respuesta = new ServerMessage(RESULT_PACKET);

        respuesta.appendInt(accion);
        respuesta.appendBoolean(exito);
        respuesta.appendString(cuerpoJson == null ? "{}" : cuerpoJson);

        return respuesta;
    }
}
