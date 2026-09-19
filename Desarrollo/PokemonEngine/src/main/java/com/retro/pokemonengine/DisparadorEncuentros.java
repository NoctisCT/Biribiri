package com.retro.pokemonengine;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.retro.pokemonengine.combate.RngCombate;
import com.retro.pokemonengine.encuentros.MetodoEncuentro;
import com.retro.pokemonengine.encuentros.TiradaEncuentro;

/**
 * Pisar hierba alta y que salga algo.
 *
 * Se ejecuta en cada paso de cada jugador del hotel, asi que el orden de las
 * comprobaciones es el orden de lo que cuesta: primero si la sala tiene zona,
 * que es una consulta a un mapa en memoria, y solo despues se mira la baldosa.
 */
public final class DisparadorEncuentros
{
    private DisparadorEncuentros()
    {
    }

    public static void alPaso(Habbo habbo, RoomTile hacia)
    {
        if(habbo == null || hacia == null) return;
        if(!ServicioFurniEncuentro.hayAlguno()) return;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null) return;

        // Primera llave, y la mas barata.
        Integer zonaId = ServicioZonas.zonaDeSala(room.getId());

        if(zonaId == null) return;

        int userId = habbo.getHabboInfo().getId();

        // Con un encuentro o un combate delante no se encadena otro.
        if(ServicioEncuentros.activo(userId) != null) return;
        if(ServicioBatalla.enCombate(userId)) return;

        // Segunda llave: que la baldosa de destino tenga un furni disparador.
        MetodoEncuentro metodo = metodoEn(room, hacia);

        if(metodo == null) return;

        TiradaEncuentro.Resultado tirada = TiradaEncuentro.paso(
                ServicioEncuentros.porMil(zonaId, metodo),
                ServicioEncuentros.estadoTirada(userId),
                System.currentTimeMillis(),
                new RngCombate(System.nanoTime() ^ ((long) userId << 16)));

        ServicioEncuentros.ponerEstadoTirada(userId, tirada.estado());

        if(!tirada.toca()) return;

        try
        {
            aparecer(habbo, userId, zonaId, room.getId(), metodo);
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] Error al sacar un salvaje para " + userId
                    + ": " + error.getMessage());
        }
    }

    private static void aparecer(Habbo habbo, int userId, int zonaId, int roomId,
                                 MetodoEncuentro metodo) throws Exception
    {
        ServicioEntrenador.Entrenador entrenador = ServicioEntrenador.cargar(userId);

        ServicioEncuentros.Salvaje salvaje = ServicioEncuentros.buscar(
                userId, zonaId, roomId, metodo, entrenador.temporadaId);

        // La zona puede no tener nada que sacar a esta hora y con este tiempo.
        // No es un error y no se le dice nada al jugador.
        if(salvaje == null) return;

        ServicioEntrenador.registrarVisto(userId, salvaje.pokemon().especieId());

        ServicioBatalla.Sesion sesion = ServicioBatalla.abrirSalvaje(habbo, salvaje);

        // Sin Pokemon en pie no hay combate. El encuentro se descarta sin
        // castigo y sin mensaje: lo contrario seria reganar al jugador por
        // pisar hierba con el equipo hecho polvo.
        if(sesion == null)
        {
            ServicioEncuentros.limpiar(userId);
            return;
        }

        habbo.getClient().sendResponse(PokemonPackets.resultado(
                PokemonAcciones.ENCUENTRO_BUSCAR,
                true,
                PokemonCuerpo.datos(AccionesMundo.cuerpoSalvaje(salvaje))));

        ServicioBatalla.empujarEstado(sesion);
    }

    private static MetodoEncuentro metodoEn(Room room, RoomTile baldosa)
    {
        for(HabboItem item : room.getItemsAt(baldosa.x, baldosa.y))
        {
            if(item == null || item.getBaseItem() == null) continue;

            MetodoEncuentro metodo = ServicioFurniEncuentro.metodo(item.getBaseItem().getSpriteId());

            if(metodo != null) return metodo;
        }

        return null;
    }
}
