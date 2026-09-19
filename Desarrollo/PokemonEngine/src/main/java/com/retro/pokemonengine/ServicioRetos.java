package com.retro.pokemonengine;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.retro.pokemonengine.batalla.PlanArena;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Retar a otro jugador.
 *
 * Dos condiciones, y las dos por el mismo motivo — que el reto sea una cosa
 * que pasa **en la sala** y no un mensaje que llega de la nada:
 *
 * 1. Los dos en la misma sala Pokemon.
 * 2. A cinco baldosas o menos.
 *
 * El reto caduca solo. Uno que se quedara pendiente para siempre seria una
 * forma de bloquear a alguien: mientras lo tiene encima, no puede aceptar otro.
 */
public final class ServicioRetos
{
    public static final long CADUCA_MS = 30L * 1000L;

    public static final String SIN_ZONA = "SIN_ZONA";
    public static final String LEJOS = "LEJOS";
    public static final String OCUPADO = "OCUPADO";
    public static final String SIN_RETO = "SIN_RETO";

    private record Reto(int retadorId, long creadoMs)
    {
    }

    /** Por rival: solo se puede tener un reto encima a la vez. */
    private static final Map<Integer, Reto> PENDIENTES = new ConcurrentHashMap<>();

    private ServicioRetos()
    {
    }

    public static Respuesta retar(Habbo retador, int rivalId)
    {
        if(retador == null || retador.getHabboInfo() == null)
        {
            return Respuesta.mal(SIN_ZONA, "No estas en ninguna sala");
        }

        int retadorId = retador.getHabboInfo().getId();

        if(retadorId == rivalId) return Respuesta.mal(OCUPADO, "No puedes retarte a ti mismo");

        Room room = retador.getHabboInfo().getCurrentRoom();

        if(room == null || ServicioZonas.zonaDeSala(room.getId()) == null)
        {
            return Respuesta.mal(SIN_ZONA, "Aqui no se puede combatir");
        }

        Habbo rival = ServicioBatalla.conectado(rivalId);

        if(rival == null || rival.getHabboInfo().getCurrentRoom() == null
                || rival.getHabboInfo().getCurrentRoom().getId() != room.getId())
        {
            return Respuesta.mal(LEJOS, "Ese entrenador no esta en la sala");
        }

        if(ServicioBatalla.enCombate(retadorId) || ServicioBatalla.enCombate(rivalId))
        {
            return Respuesta.mal(OCUPADO, "Uno de los dos ya esta combatiendo");
        }

        if(retador.getRoomUnit() == null || rival.getRoomUnit() == null
                || retador.getRoomUnit().getCurrentLocation() == null
                || rival.getRoomUnit().getCurrentLocation() == null)
        {
            return Respuesta.mal(LEJOS, "No se donde estais");
        }

        int distancia = PlanArena.distancia(
                retador.getRoomUnit().getCurrentLocation().x,
                retador.getRoomUnit().getCurrentLocation().y,
                rival.getRoomUnit().getCurrentLocation().x,
                rival.getRoomUnit().getCurrentLocation().y);

        if(distancia > PlanArena.DISTANCIA_RETO_MAX)
        {
            return Respuesta.mal(LEJOS, "Acercate para retarle");
        }

        Reto existente = PENDIENTES.get(rivalId);

        if(existente != null && !caducado(existente, System.currentTimeMillis()))
        {
            return Respuesta.mal(OCUPADO, "Ya tiene un reto pendiente");
        }

        PENDIENTES.put(rivalId, new Reto(retadorId, System.currentTimeMillis()));

        Map<String, Object> aviso = new LinkedHashMap<>();

        aviso.put("retadorId", retadorId);
        aviso.put("retador", retador.getHabboInfo().getUsername());
        aviso.put("caducaMs", CADUCA_MS);

        rival.getClient().sendResponse(PokemonPackets.resultado(
                PokemonAcciones.BATALLA_RETAR, true, PokemonCuerpo.datos(aviso)));

        Map<String, Object> eco = new LinkedHashMap<>();

        eco.put("enviado", true);
        eco.put("rivalId", rivalId);

        return Respuesta.bien(eco);
    }

    public static Respuesta responder(int userId, boolean acepta) throws Exception
    {
        Reto reto = PENDIENTES.remove(userId);

        if(reto == null) return Respuesta.mal(SIN_RETO, "No tienes ningun reto pendiente");

        if(caducado(reto, System.currentTimeMillis()))
        {
            return Respuesta.mal(SIN_RETO, "Ese reto ya ha caducado");
        }

        Habbo retador = ServicioBatalla.conectado(reto.retadorId());
        Habbo rival = ServicioBatalla.conectado(userId);

        if(retador == null || rival == null)
        {
            return Respuesta.mal(SIN_RETO, "El otro entrenador ya no esta");
        }

        Map<String, Object> respuesta = new LinkedHashMap<>();

        respuesta.put("aceptado", acepta);

        if(!acepta)
        {
            retador.getClient().sendResponse(PokemonPackets.resultado(
                    PokemonAcciones.BATALLA_RETO_RESPONDER, true,
                    PokemonCuerpo.datos(respuesta)));

            return Respuesta.bien(respuesta);
        }

        ServicioBatalla.Sesion sesion = ServicioBatalla.abrirPvp(retador, rival);

        if(sesion == null)
        {
            return Respuesta.mal(OCUPADO, "Alguno de los dos no tiene un Pokemon en pie");
        }

        return Respuesta.bien(ServicioBatalla.cuerpo(sesion, userId));
    }

    private static boolean caducado(Reto reto, long ahora)
    {
        return ahora - reto.creadoMs() >= CADUCA_MS;
    }

    /** Limpia los retos vencidos. La llama el latido de ServicioBatalla. */
    public static void caducar()
    {
        long ahora = System.currentTimeMillis();

        PENDIENTES.entrySet().removeIf(entrada -> caducado(entrada.getValue(), ahora));
    }

    public static int pendientes()
    {
        return PENDIENTES.size();
    }
}
