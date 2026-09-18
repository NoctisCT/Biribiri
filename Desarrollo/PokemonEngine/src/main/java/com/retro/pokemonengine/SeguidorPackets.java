package com.retro.pokemonengine;

import com.eu.habbo.messages.ServerMessage;

import java.util.List;

/**
 * El paquete 6403: posicion, direccion y animacion del seguidor.
 *
 * Va en binario y no en JSON porque es un paquete por cada paso de cada jugador
 * de la sala. La forma de la entrada es siempre la misma aunque el tipo no la
 * necesite entera, para que el lector del cliente sea trivial y no pueda
 * desincronizarse.
 */
public final class SeguidorPackets
{
    public static final int PAQUETE = 6403;

    public static final int TIPO_FOTO = 1;
    public static final int TIPO_PASO = 2;
    public static final int TIPO_ALTA = 3;
    public static final int TIPO_BAJA = 4;
    public static final int TIPO_ANIMACION = 5;

    private SeguidorPackets()
    {
    }

    public record Entrada(
            int userId,
            long ownedId,
            int especieId,
            int formaId,
            boolean shiny,
            int x,
            int y,
            int zCentesimas,
            int direccion,
            String estado,
            String animacion,
            String respaldo,
            String nombre)
    {
        /** Para la baja solo hace falta el usuario; el resto va a cero. */
        public static Entrada baja(int userId)
        {
            return new Entrada(userId, 0L, 0, 0, false, 0, 0, 0, 0, "", "", "", "");
        }
    }

    public static ServerMessage mensaje(int tipo, List<Entrada> entradas)
    {
        ServerMessage mensaje = new ServerMessage(PAQUETE);

        mensaje.appendInt(tipo);
        mensaje.appendInt(entradas.size());

        for(Entrada entrada : entradas)
        {
            mensaje.appendInt(entrada.userId());
            mensaje.appendInt((int) entrada.ownedId());
            mensaje.appendInt(entrada.especieId());
            mensaje.appendInt(entrada.formaId());
            mensaje.appendBoolean(entrada.shiny());
            mensaje.appendInt(entrada.x());
            mensaje.appendInt(entrada.y());
            mensaje.appendInt(entrada.zCentesimas());
            mensaje.appendInt(entrada.direccion());
            mensaje.appendString(texto(entrada.estado()));
            mensaje.appendString(texto(entrada.animacion()));
            mensaje.appendString(texto(entrada.respaldo()));
            mensaje.appendString(texto(entrada.nombre()));
        }

        return mensaje;
    }

    public static ServerMessage mensaje(int tipo, Entrada entrada)
    {
        return mensaje(tipo, List.of(entrada));
    }

    private static String texto(String valor)
    {
        return valor == null ? "" : valor;
    }
}
