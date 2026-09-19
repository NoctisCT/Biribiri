package com.retro.pokemonengine;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.rooms.RoomUserRotation;
import com.eu.habbo.habbohotel.users.Habbo;
import com.retro.pokemonengine.batalla.PlanArena;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Colocar a los combatientes en la sala y devolverlos a su sitio al acabar.
 *
 * **Nadie se teletransporta.** El que ancla la formacion se queda donde esta y
 * el otro **camina** hasta su hueco; cuando llega, se le gira hacia el rival y
 * se le retira el andar. Un avatar que aparece de golpe a tres baldosas rompe
 * la escena que este hito existe para montar.
 *
 * En un reto ancla el que acepta y camina el que reto: quien busca pelea es
 * quien se acerca. Si donde esta el que acepta no cabe la linea, la busqueda
 * abre el radio y entonces se mueven los dos lo justo.
 *
 * El Pokemon que pelea se pone **delante** de su entrenador, en el hueco que le
 * toca de la formacion, en vez de seguir a su espalda.
 *
 * La caminabilidad se mira en el estado real de la baldosa y no en si hay furni
 * encima: una hierba alta pisable, una alfombra o un suelo decorativo no
 * bloquean, y la hierba es justo el furni sobre el que se pelea.
 */
public final class ServicioArena
{
    /**
     * Lo que se espera a que lleguen andando.
     *
     * Si en ese tiempo alguien no ha llegado — camino cortado, alguien en medio
     * — el combate pasa a interfaz y se les suelta. Nunca se cancela.
     */
    public static final long ESPERA_MAX_MS = 12_000L;

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

    /** Un combatiente de camino a su hueco. */
    private static final class Puesto
    {
        final int userId;
        final int x;
        final int y;
        final int direccion;

        /** El hueco donde va su Pokemon, delante de el. */
        final int pokemonX;
        final int pokemonY;

        boolean fijado;

        Puesto(int userId, PlanArena.Hueco suyo, PlanArena.Hueco deSuPokemon)
        {
            this.userId = userId;
            this.x = suyo.x();
            this.y = suyo.y();
            this.direccion = suyo.direccion();
            this.pokemonX = deSuPokemon == null ? suyo.x() : deSuPokemon.x();
            this.pokemonY = deSuPokemon == null ? suyo.y() : deSuPokemon.y();
        }
    }

    /** Una formacion montandose. */
    private static final class Montaje
    {
        final long batallaId;
        final int roomId;
        final List<Puesto> puestos;
        final long desdeMs = System.currentTimeMillis();

        Montaje(long batallaId, int roomId, List<Puesto> puestos)
        {
            this.batallaId = batallaId;
            this.roomId = roomId;
            this.puestos = puestos;
        }
    }

    private static final Map<Integer, Sitio> ORIGEN = new ConcurrentHashMap<>();
    private static final Map<Long, Montaje> MONTAJES = new ConcurrentHashMap<>();

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
     * Manda a los combatientes a su hueco.
     *
     * @param anclaje    el que no se mueve: contra la hierba, el propio jugador;
     *                   en un reto, el que acepta.
     * @param queCamina  el que se acerca, o null contra un salvaje.
     * @return true si la formacion cabe y el combate se vera en sala; false si
     *         toca resolverlo en interfaz.
     */
    public static boolean colocar(ServicioBatalla.Sesion sesion, Habbo anclaje, Habbo queCamina)
    {
        if(sesion == null || anclaje == null || anclaje.getHabboInfo() == null) return false;

        Room room = anclaje.getHabboInfo().getCurrentRoom();

        if(room == null || room.getLayout() == null || room.getId() != sesion.roomId) return false;

        RoomUnit unidadAncla = anclaje.getRoomUnit();

        if(unidadAncla == null || unidadAncla.getCurrentLocation() == null) return false;

        RoomUnit unidadQueCamina = null;

        if(queCamina != null)
        {
            if(queCamina.getHabboInfo() == null
                    || queCamina.getHabboInfo().getCurrentRoom() == null
                    || queCamina.getHabboInfo().getCurrentRoom().getId() != room.getId())
            {
                return false;
            }

            unidadQueCamina = queCamina.getRoomUnit();

            if(unidadQueCamina == null || unidadQueCamina.getCurrentLocation() == null) return false;
        }

        RoomTile desdeAncla = unidadAncla.getCurrentLocation();
        RoomTile desdeOtro = unidadQueCamina == null ? null : unidadQueCamina.getCurrentLocation();

        PlanArena.Transitable transitable = (x, y) -> libre(room, x, y, desdeAncla, desdeOtro);

        PlanArena.Formacion formacion = desdeOtro == null
                ? PlanArena.resolver(desdeAncla.x, desdeAncla.y, sesion.formato, transitable)
                : PlanArena.resolverHacia(desdeAncla.x, desdeAncla.y, desdeOtro.x, desdeOtro.y,
                        sesion.formato, transitable);

        if(formacion == null) return false;

        PlanArena.Hueco huecoAncla = formacion.de(PlanArena.ROL_ENTRENADOR_A);
        PlanArena.Hueco pokemonAncla = formacion.de(PlanArena.ROL_POKEMON_A);

        if(huecoAncla == null) return false;

        List<Puesto> puestos = new ArrayList<>();

        guardarOrigen(anclaje, room, unidadAncla);
        puestos.add(new Puesto(anclaje.getHabboInfo().getId(), huecoAncla, pokemonAncla));
        encaminar(room, unidadAncla, huecoAncla);

        if(queCamina != null)
        {
            PlanArena.Hueco huecoOtro = formacion.de(PlanArena.ROL_ENTRENADOR_B);
            PlanArena.Hueco pokemonOtro = formacion.de(PlanArena.ROL_POKEMON_B);

            if(huecoOtro == null) return false;

            guardarOrigen(queCamina, room, unidadQueCamina);
            puestos.add(new Puesto(queCamina.getHabboInfo().getId(), huecoOtro, pokemonOtro));
            encaminar(room, unidadQueCamina, huecoOtro);
        }

        reservar(room.getId(), formacion);
        MONTAJES.put(sesion.id, new Montaje(sesion.id, room.getId(), puestos));

        // Se comprueba ya por si alguno estaba justo en su baldosa: contra la
        // hierba lo normal es que el jugador no tenga que dar ni un paso.
        repasar();

        return true;
    }

    private static void guardarOrigen(Habbo habbo, Room room, RoomUnit unidad)
    {
        ORIGEN.putIfAbsent(habbo.getHabboInfo().getId(),
                new Sitio(room.getId(), unidad.getCurrentLocation(), unidad.getBodyRotation()));
    }

    /** Le pone el destino y le deja andar. Nada de setLocation. */
    private static void encaminar(Room room, RoomUnit unidad, PlanArena.Hueco hueco)
    {
        RoomTile destino = room.getLayout().getTile((short) hueco.x(), (short) hueco.y());

        if(destino == null) return;

        unidad.setCanWalk(true);
        unidad.setGoalLocation(destino);
    }

    /**
     * Mira quien ha llegado ya a su hueco. Lo llama el latido del combate.
     *
     * Al que ha llegado se le gira hacia el rival, se le quita el andar y se le
     * saca el Pokemon delante. Al que no llegue a tiempo — porque le han
     * cortado el paso — se le suelta y el combate se pasa a interfaz.
     */
    public static void repasar()
    {
        long ahora = System.currentTimeMillis();

        for(Montaje montaje : new ArrayList<>(MONTAJES.values()))
        {
            boolean todos = true;

            for(Puesto puesto : montaje.puestos)
            {
                if(puesto.fijado) continue;

                if(fijarSiLlego(montaje, puesto)) continue;

                todos = false;
            }

            if(todos)
            {
                MONTAJES.remove(montaje.batallaId);
                continue;
            }

            if(ahora - montaje.desdeMs < ESPERA_MAX_MS) continue;

            // Se acabo la espera: nadie se queda a medias en mitad de la sala.
            System.out.println("[PokemonEngine] La formacion del combate "
                    + montaje.batallaId + " no se ha podido montar: a interfaz.");

            MONTAJES.remove(montaje.batallaId);
            RESERVADAS.remove(montaje.roomId);

            for(Puesto puesto : montaje.puestos) soltar(puesto.userId);

            ServicioBatalla.pasarAInterfaz(montaje.batallaId);
        }
    }

    private static boolean fijarSiLlego(Montaje montaje, Puesto puesto)
    {
        Habbo habbo = ServicioBatalla.conectado(puesto.userId);

        if(habbo == null || habbo.getHabboInfo().getCurrentRoom() == null) return false;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room.getId() != montaje.roomId) return false;

        RoomUnit unidad = habbo.getRoomUnit();

        if(unidad == null || unidad.getCurrentLocation() == null) return false;

        RoomTile donde = unidad.getCurrentLocation();

        if(donde.x != puesto.x || donde.y != puesto.y) return false;

        RoomUserRotation mirando = RoomUserRotation.fromValue(puesto.direccion);

        unidad.setRotation(mirando);
        unidad.setBodyRotation(mirando);
        unidad.setHeadRotation(mirando);

        // Lo ultimo: quitarle el andar.
        unidad.setCanWalk(false);
        unidad.statusUpdate(true);

        sacarPokemon(puesto);

        puesto.fijado = true;

        return true;
    }

    /**
     * El Pokemon que pelea se pone delante.
     *
     * Solo si es el mismo que le sigue: si el jugador lleva detras a otro, el
     * seguidor se queda donde esta y el combatiente no se ve — hasta que la
     * fase 2 sepa dibujar un Pokemon que no sea el seguidor.
     */
    private static void sacarPokemon(Puesto puesto)
    {
        ServicioBatalla.Sesion sesion = ServicioBatalla.de(puesto.userId);

        if(sesion == null) return;

        int bando = sesion.bandoDe(puesto.userId);

        if(bando < 0 || sesion.propios[bando] == null) return;

        if(ServicioSeguidor.ownedIdDe(puesto.userId) != sesion.propios[bando].id()) return;

        ServicioSeguidor.aArena(puesto.userId, puesto.pokemonX, puesto.pokemonY, puesto.direccion);
    }

    private static void reservar(int roomId, PlanArena.Formacion formacion)
    {
        Set<Integer> baldosas = RESERVADAS.computeIfAbsent(roomId, r -> new HashSet<>());

        for(PlanArena.Hueco hueco : formacion.huecos())
        {
            baldosas.add(clave(hueco.x(), hueco.y()));
        }
    }

    /** Devuelve a su sitio a todo el que estuviera bloqueado por esta sesion. */
    public static void soltar(ServicioBatalla.Sesion sesion)
    {
        if(sesion == null) return;

        MONTAJES.remove(sesion.id);
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

        ServicioSeguidor.fueraDeArena(userId);

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

        // Vuelve andando, igual que vino. Si su sitio se ha ocupado mientras
        // peleaba, se queda donde esta.
        if(vuelta != null && vuelta.isWalkable()
                && room.getHabbosAndBotsAt(sitio.x, sitio.y).isEmpty())
        {
            unidad.setGoalLocation(vuelta);
        }

        unidad.statusUpdate(true);
    }

    /**
     * Una baldosa vale si se puede pisar, no esta reservada por otro combate y
     * no hay nadie encima — salvo los propios combatientes, que obviamente si.
     */
    private static boolean libre(Room room, int x, int y, RoomTile propiaA, RoomTile propiaB)
    {
        if(room.getLayout() == null) return false;

        RoomTile baldosa = room.getLayout().getTile((short) x, (short) y);

        if(baldosa == null || !baldosa.isWalkable()) return false;

        if(reservada(room.getId(), x, y)) return false;

        if(propiaA != null && propiaA.x == x && propiaA.y == y) return true;
        if(propiaB != null && propiaB.x == x && propiaB.y == y) return true;

        return room.getHabbosAndBotsAt((short) x, (short) y).isEmpty();
    }

    /** Solo para el diagnostico. */
    public static int totalBloqueados()
    {
        return ORIGEN.size();
    }

    public static int totalMontandose()
    {
        return MONTAJES.size();
    }
}
