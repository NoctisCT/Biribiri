package com.retro.pokemonengine.handlers;

import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.retro.pokemonengine.AccionesBatalla;
import com.retro.pokemonengine.AccionesEntrenador;
import com.retro.pokemonengine.AccionesMundo;
import com.retro.pokemonengine.PokemonAcciones;
import com.retro.pokemonengine.PokemonCuerpo;
import com.retro.pokemonengine.PokemonEnginePlugin;
import com.retro.pokemonengine.PokemonPackets;
import com.retro.pokemonengine.Respuesta;
import com.retro.pokemonengine.ServicioObjetos;
import com.retro.pokemonengine.ServicioPokedex;
import com.retro.pokemonengine.ServicioZonas;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * La unica puerta de entrada del paquete 6400.
 *
 * El userId sale siempre de la sesion, nunca del paquete. Ninguna excepcion
 * escapa: el cliente recibe un error generico y el detalle se queda en el log.
 */
public class PokemonCommandHandler extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null || this.client.getHabbo() == null) return;

        Habbo habbo = this.client.getHabbo();
        int userId = habbo.getHabboInfo().getId();
        int accion = this.packet.readInt().intValue();

        Respuesta respuesta;

        try
        {
            JsonObject datos = leerDatos();

            respuesta = switch(accion)
            {
                case PokemonAcciones.SALUDO -> saludo(userId, habbo);
                case PokemonAcciones.CATALOGO -> catalogo();
                // La batalla va primero: desde el hito 6b el 61 y el 62 del
                // mundo acaban delegando en ella de todas formas.
                default -> AccionesBatalla.esAccionDeBatalla(accion)
                        ? AccionesBatalla.ejecutar(habbo, userId, accion, datos)
                        : AccionesMundo.esAccionDeMundo(accion)
                                ? AccionesMundo.ejecutar(habbo, userId, accion, datos)
                                : AccionesEntrenador.ejecutar(habbo, userId, accion, datos);
            };
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] Error en la accion " + accion
                    + " del usuario " + userId + ": " + error.getMessage());

            respuesta = Respuesta.mal("ERROR_INTERNO", "No se ha podido completar la accion");
        }

        this.client.sendResponse(
                PokemonPackets.resultado(accion, respuesta.exito(), respuesta.cuerpo()));
    }

    /**
     * El cuerpo es opcional: un cliente cacheado viejo manda solo la accion y no
     * debe caerse por eso.
     */
    private JsonObject leerDatos()
    {
        try
        {
            String crudo = this.packet.readString();

            if(crudo == null || crudo.isBlank()) return new JsonObject();

            return JsonParser.parseString(crudo).getAsJsonObject();
        }
        catch(Exception error)
        {
            return new JsonObject();
        }
    }

    private Respuesta saludo(int userId, Habbo habbo)
    {
        Map<String, Object> datos = new LinkedHashMap<>();
        int roomId = habbo.getHabboInfo().getCurrentRoom() == null
                ? 0 : habbo.getHabboInfo().getCurrentRoom().getId();

        datos.put("protocolVersion", PokemonEnginePlugin.VERSION_PROTOCOLO);
        datos.put("userId", userId);
        datos.put("serverTimeEpoch", System.currentTimeMillis() / 1000L);
        datos.put("salaPokemon", roomId != 0 && ServicioZonas.esSalaPokemon(roomId));
        datos.put("zonaId", roomId == 0 ? null : ServicioZonas.zonaDeSala(roomId));

        return Respuesta.bien(datos);
    }

    private Respuesta catalogo()
    {
        Map<String, Object> datos = new LinkedHashMap<>();

        datos.put("especies", ServicioPokedex.totalEspecies());
        datos.put("movimientos", ServicioPokedex.totalMovimientos());
        datos.put("zonas", ServicioZonas.totalZonas());
        datos.put("objetos", ServicioObjetos.total());
        datos.put("salasPokemon", ServicioZonas.totalSalas());

        return Respuesta.bien(datos);
    }
}
