package com.retro.pokemonengine.handlers;

import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.pokemonengine.PokemonAcciones;
import com.retro.pokemonengine.PokemonCuerpo;
import com.retro.pokemonengine.PokemonEnginePlugin;
import com.retro.pokemonengine.PokemonPackets;

import java.util.LinkedHashMap;
import java.util.Map;

public class PokemonCommandHandler extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;

        Habbo habbo = this.client.getHabbo();
        int userId = habbo.getHabboInfo().getId();
        int accion = this.packet.readInt().intValue();

        boolean exito = false;
        String cuerpo = PokemonCuerpo.error("ACCION_DESCONOCIDA", "Acción no reconocida");

        try
        {
            switch(accion)
            {
                case PokemonAcciones.SALUDO:
                {
                    Map<String, Object> datos = new LinkedHashMap<>();

                    datos.put("protocolVersion", PokemonEnginePlugin.VERSION_PROTOCOLO);
                    datos.put("userId", userId);
                    datos.put("serverTimeEpoch", System.currentTimeMillis() / 1000L);

                    exito = true;
                    cuerpo = PokemonCuerpo.datos(datos);
                    break;
                }

                default:
                    break;
            }
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] Error en la acción " + accion
                    + " del usuario " + userId + ": " + error.getMessage());

            exito = false;
            cuerpo = PokemonCuerpo.error("ERROR_INTERNO", "No se ha podido completar la acción");
        }

        this.client.sendResponse(PokemonPackets.resultado(accion, exito, cuerpo));
    }
}
