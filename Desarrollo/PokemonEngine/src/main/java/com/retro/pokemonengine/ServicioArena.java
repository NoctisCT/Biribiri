package com.retro.pokemonengine;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.rooms.RoomUserRotation;
import com.eu.habbo.habbohotel.users.Habbo;
import com.retro.pokemonengine.batalla.PlanArena;

import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Colocar a los combatientes en la sala y devolverlos a su sitio al acabar.
 *
 * Tres cosas y en este orden:
 *
 * 1. **Buscar sitio** con PlanArena, empezando por la baldosa donde esta el
 *    jugador. Si cabe ahi, no se le mueve: nada molesta mas que un juego que
 *    te teletransporta sin motivo.
 * 2. **Bloquear**: se guarda la posicion original, se le lleva a su hueco, se
 *    le gira al centro y se le quita el andar. Sin esto el jugador se va
 *    andando a mitad de combate y la formacion se queda sola.
 * 3. **Reservar** las baldosas mientras dura, para que un espectador no se
 *    plante en medio.
 *
 * Si no cabe en ningun sitio, `colocar` devuelve false y el combate se juega en
 * interfaz. No se cancela nunca: estar la ruta llena cuesta el espectaculo, no
 * el encuentro.
 *
 * La caminabilidad se mira en el estado real de la baldosa y no en si hay furni
 * encima: una hierba alta pisable, una alfombra o un suelo decorativo no
 * bloquean, y la hierba es justo el furni sobre el que se pelea.
 */
public final class ServicioArena
{
    /** Donde estaba cada jugador antes de que le colocaramos. */
    private static final class Sitio
    {
        final int roomId;
        final short x;
        final short y;
        final RoomUserRotation rotacion;

        Sitio(int roomId, RoomTile baldosa, RoomUserRotation rotacion)
        {
            this.roomId = roomId;
            this.x = baldosa.x;
            this.y = baldosa.y;
            this.rotacion = rotacion;
        }
    }

    private static final Map<Integer, Sitio> ORIGEN = new ConcurrentHashMap<>();

    /** Baldosas ocupadas por un combate, por sala. */
    private static final Map<Integer, Set<Integer>> RESERVADAS = new ConcurrentHashMap<>();

    private ServicioArena()
    {
    }

    private static int clave(int x, int y)
    {
        return x * 1000 + y;
    }

    public static boolean reservada(int roomId, int x, int y)
    {
        Set<Integer> baldosas = RESERVADAS.get(roomId);

        return baldosas != null && baldosas.contains(clave(x, y));
    }

    /**
     * @return true si la formacion cupo y el combate se ve en sala; false si
     *         toca resolverlo en interfaz.
     */
    public static boolean colocar(ServicioBatalla.Sesion sesion, Habbo habbo)
    {
        if(sesion == null || habbo == null || habbo.getHabboInfo() == null) return false;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null || room.getLayout() == null || room.getId() != sesion.roomId) return false;

        RoomUnit unidad = habbo.getRoomUnit();

        if(unidad == null || unidad.getCurrentLocation() == null) return false;

        RoomTile desde = unidad.getCurrentLocation();

        PlanArena.Formacion formacion = PlanArena.resolver(
                desde.x, desde.y, sesion.formato, (x, y) -> libre(room, x, y, desde));

        if(formacion == null) return false;

        PlanArena.Hueco mio = formacion.de(PlanArena.ROL_ENTRENADOR_A);

        if(mio == null) return false;

        reservar(room.getId(), formacion);
        bloquear(habbo, room, unidad, mio);

        return true;
    }

    private static void reservar(int roomId, PlanArena.Formacion formacion)
    {
        Set<Integer> baldosas = RESERVADAS.computeIfAbsent(roomId, r -> new HashSet<>());

        for(PlanArena.Hueco hueco : formacion.huecos())
        {
            baldosas.add(clave(hueco.x(), hueco.y()));
        }
    }

    private static void bloquear(Habbo habbo, Room room, RoomUnit unidad, PlanArena.Hueco hueco)
    {
        int userId = habbo.getHabboInfo().getId();

        ORIGEN.put(userId, new Sitio(room.getId(), unidad.getCurrentLocation(),
                unidad.getBodyRotation()));

        RoomTile destino = room.getLayout().getTile((short) hueco.x(), (short) hueco.y());

        if(destino != null)
        {
            unidad.stopWalking();
            unidad.setGoalLocation(destino);
            unidad.setLocation(destino);
        }

        RoomUserRotation mirando = RoomUserRotation.fromValue(hueco.direccion());

        unidad.setRotation(mirando);
        unidad.setBodyRotation(mirando);
        unidad.setHeadRotation(mirando);

        // Lo ultimo: quitarle el andar. Antes de esto los setGoalLocation
        // siguen funcionando; despues, ya no hacen nada.
        unidad.setCanWalk(false);
        unidad.statusUpdate(true);
    }

    /** Devuelve a su sitio a todo el que estuviera bloqueado por esta sesion. */
    public static void soltar(ServicioBatalla.Sesion sesion)
    {
        if(sesion == null) return;

        RESERVADAS.remove(sesion.roomId);

        for(int userId : sesion.userIds)
        {
            soltar(userId);
        }
    }

    public static void soltar(int userId)
    {
        Sitio sitio = ORIGEN.remove(userId);

        if(sitio == null) return;

        Habbo habbo = ServicioBatalla.conectado(userId);

        if(habbo == null) return;

        RoomUnit unidad = habbo.getRoomUnit();

        if(unidad == null) return;

        unidad.setCanWalk(true);

        Room room = habbo.getHabboInfo().getCurrentRoom();

        // Si se ha cambiado de sala, devolverle a la baldosa vieja no tiene
        // sentido: basta con que vuelva a poder andar.
        if(room == null || room.getId() != sitio.roomId || room.getLayout() == null) return;

        RoomTile vuelta = room.getLayout().getTile(sitio.x, sitio.y);

        // Si su sitio se ha ocupado mientras peleaba, se queda donde esta.
        if(vuelta != null && vuelta.isWalkable()
                && room.getHabbosAndBotsAt(sitio.x, sitio.y).isEmpty())
        {
            unidad.setGoalLocation(vuelta);
        }

        if(sitio.rotacion != null) unidad.setBodyRotation(sitio.rotacion);

        unidad.statusUpdate(true);
    }

    /**
     * Una baldosa vale si se puede pisar, no esta reservada por otro combate y
     * no hay nadie encima — salvo la propia del jugador, que obviamente si.
     */
    private static boolean libre(Room room, int x, int y, RoomTile propia)
    {
        if(room.getLayout() == null) return false;

        RoomTile baldosa = room.getLayout().getTile((short) x, (short) y);

        if(baldosa == null || !baldosa.isWalkable()) return false;

        if(reservada(room.getId(), x, y)) return false;

        if(propia != null && propia.x == x && propia.y == y) return true;

        return room.getHabbosAndBotsAt((short) x, (short) y).isEmpty();
    }

    /** Solo para el diagnostico. */
    public static int totalBloqueados()
    {
        return ORIGEN.size();
    }
}
