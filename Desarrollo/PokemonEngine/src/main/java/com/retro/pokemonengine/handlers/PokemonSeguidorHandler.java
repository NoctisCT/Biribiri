package com.retro.pokemonengine.handlers;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.pokemonengine.ServicioSeguidor;

/**
 * El paquete 6402: lo poco que el cliente le pide al seguidor.
 *
 * Es aparte del 6400 porque va en binario y sin JSON: lo del seguidor es de alta
 * frecuencia y no se mezcla con el estado de la interfaz.
 */
public class PokemonSeguidorHandler extends MessageHandler
{
    public static final int PEDIR_FOTO = 1;
    public static final int INTERACTUAR = 2;
    public static final int GESTO_PROPIO = 3;

    @Override
    public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;

        Habbo habbo = this.client.getHabbo();

        try
        {
            int accion = this.packet.readInt().intValue();

            switch(accion)
            {
                case PEDIR_FOTO ->
                {
                    Room sala = habbo.getHabboInfo().getCurrentRoom();

                    this.client.sendResponse(ServicioSeguidor.foto(sala));
                }

                case INTERACTUAR ->
                {
                    int objetivo = this.packet.readInt().intValue();
                    String codigo = this.packet.readString();

                    // Solo se puede interactuar con quien esta en tu misma sala.
                    if(mismaSala(habbo, objetivo)) ServicioSeguidor.interactuar(objetivo, codigo);
                }

                case GESTO_PROPIO ->
                        ServicioSeguidor.gestoPropio(
                                habbo.getHabboInfo().getId(), this.packet.readString());

                default ->
                {
                }
            }
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] Error en el paquete del seguidor de "
                    + habbo.getHabboInfo().getId() + ": " + error.getMessage());
        }
    }

    private boolean mismaSala(Habbo quien, int objetivoUserId)
    {
        Room sala = quien.getHabboInfo().getCurrentRoom();

        if(sala == null) return false;

        for(Habbo otro : sala.getHabbos())
        {
            if(otro.getHabboInfo().getId() == objetivoUserId) return true;
        }

        return false;
    }
}
