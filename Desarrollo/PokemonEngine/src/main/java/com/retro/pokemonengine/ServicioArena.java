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
 * Delante de cada entrenador se ve **al Pokemon que pelea**, y contra la
 * hierba tambien se ve al salvaje. La linea completa es
 *
 *     Entrenador - Pokemon - (hueco) - Pokemon o salvaje - Entrenador
 *
 * La formacion se guarda mientras dure el combate y no solo mientras se monta,
 * porque hace falta entera para recolocar a quien se reconecte a mitad.
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

        Sitio(int roomId, RoomTile baldosa)
        {
            this.roomId = roomId;
            this.x = baldosa.x;
            this.y = baldosa.y;
        }
    }

    /** Un combatiente y su hueco. */
    private static final class Puesto
    {
        final int userId;
        final int x;
        final int y;
        final int direccion;

        /** El hueco donde va su Pokemon, delante de el, con su propia mirada. */
        final int pokemonX;
        final int pokemonY;
        final int pokemonDireccion;

        boolean fijado;

        Puesto(int userId, PlanArena.Hueco suyo, PlanArena.Hueco deSuPokemon)
        {
            this.userId = userId;
            this.x = suyo.x();
            this.y = suyo.y();
            this.direccion = suyo.direccion();
            this.pokemonX = deSuPokemon == null ? suyo.x() : deSuPokemon.x();
            this.pokemonY = deSuPokemon == null ? suyo.y() : deSuPokemon.y();

            // La suya, no la de su entrenador: el Pokemon mira al rival.
            this.pokemonDireccion = deSuPokemon == null
                    ? suyo.direccion()
                    : deSuPokemon.direccion();
        }
    }

    /** La formacion de un combate, viva mientras el combate lo este. */
    private static final class Formacion
    {
        final long batallaId;
        final int roomId;
        final List<Puesto> puestos;
        final PlanArena.Hueco salvaje;

        long esperandoDesdeMs = System.currentTimeMillis();
        boolean salvajeFuera;

        Formacion(long batallaId, int roomId, List<Puesto> puestos, PlanArena.Hueco salvaje)
        {
            this.batallaId = batallaId;
            this.roomId = roomId;
            this.puestos = puestos;
            this.salvaje = salvaje;
        }

        Puesto de(int userId)
        {
            for(Puesto puesto : this.puestos)
            {
                if(puesto.userId == userId) return puesto;
            }

            return null;
        }
    }

    private static final Map<Integer, Sitio> ORIGEN = new ConcurrentHashMap<>();
    private static final Map<Long, Formacion> FORMACIONES = new ConcurrentHashMap<>();

    /** Baldosas ocupadas por un combate, por sala. */
    private static final Map<Integer, Set<Integer>> RESERVADAS = new ConcurrentHashMap<>();

    private ServicioArena()
    {
    }

    private static int clave(int x, int y)
    {
        return x * 1000 + y;
    }

    /** La clave del salvaje: el combate en negativo, porque no hay jugador detras. */
    private static int claveSalvaje(long batallaId)
    {
        return -(int) batallaId;
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

        PlanArena.Formacion plan = desdeOtro == null
                ? PlanArena.resolver(desdeAncla.x, desdeAncla.y, sesion.formato, transitable)
                : PlanArena.resolverHacia(desdeAncla.x, desdeAncla.y, desdeOtro.x, desdeOtro.y,
                        sesion.formato, transitable);

        if(plan == null) return false;

        PlanArena.Hueco huecoAncla = plan.de(PlanArena.ROL_ENTRENADOR_A);

        if(huecoAncla == null) return false;

        List<Puesto> puestos = new ArrayList<>();

        guardarOrigen(anclaje, room, unidadAncla);
        puestos.add(new Puesto(anclaje.getHabboInfo().getId(), huecoAncla,
                plan.de(PlanArena.ROL_POKEMON_A)));
        andarHasta(room, unidadAncla, huecoAncla.x(), huecoAncla.y());

        if(queCamina != null)
        {
            PlanArena.Hueco huecoOtro = plan.de(PlanArena.ROL_ENTRENADOR_B);

            if(huecoOtro == null) return false;

            guardarOrigen(queCamina, room, unidadQueCamina);
            puestos.add(new Puesto(queCamina.getHabboInfo().getId(), huecoOtro,
                    plan.de(PlanArena.ROL_POKEMON_B)));
            andarHasta(room, unidadQueCamina, huecoOtro.x(), huecoOtro.y());
        }

        reservar(room.getId(), plan);

        FORMACIONES.put(sesion.id, new Formacion(
                sesion.id, room.getId(), puestos, plan.de(PlanArena.ROL_SALVAJE)));

        // Se comprueba ya por si alguno estaba justo en su baldosa: contra la
        // hierba lo normal es que el jugador no tenga que dar ni un paso.
        repasar();

        return true;
    }

    /**
     * Vuelve a llevar a su hueco a quien se habia ido.
     *
     * Es lo que cierra la reconexion: el combate no se habia acabado, asi que
     * al volver a la sala hay que devolver al jugador a su sitio y sacarle otra
     * vez el Pokemon. Sin esto se vuelve a un combate en curso con los dos
     * paseando por la sala.
     */
    public static void recolocar(ServicioBatalla.Sesion sesion, Habbo habbo)
    {
        if(sesion == null || habbo == null || habbo.getHabboInfo() == null) return;

        Formacion formacion = FORMACIONES.get(sesion.id);

        if(formacion == null) return;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null || room.getLayout() == null || room.getId() != formacion.roomId) return;

        Puesto puesto = formacion.de(habbo.getHabboInfo().getId());
        RoomUnit unidad = habbo.getRoomUnit();

        if(puesto == null || unidad == null || unidad.getCurrentLocation() == null) return;

        puesto.fijado = false;
        formacion.esperandoDesdeMs = System.currentTimeMillis();

        guardarOrigen(habbo, room, unidad);
        andarHasta(room, unidad, puesto.x, puesto.y);

        repasar();
    }

    private static void guardarOrigen(Habbo habbo, Room room, RoomUnit unidad)
    {
        ORIGEN.putIfAbsent(habbo.getHabboInfo().getId(),
                new Sitio(room.getId(), unidad.getCurrentLocation()));
    }

    /** Le pone el destino y le deja andar. Nada de setLocation. */
    private static void andarHasta(Room room, RoomUnit unidad, int x, int y)
    {
        RoomTile destino = room.getLayout().getTile((short) x, (short) y);

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

        for(Formacion formacion : new ArrayList<>(FORMACIONES.values()))
        {
            boolean faltaAlguien = false;

            for(Puesto puesto : formacion.puestos)
            {
                if(puesto.fijado) continue;

                if(!fijarSiLlego(formacion, puesto)) faltaAlguien = true;
            }

            if(!faltaAlguien)
            {
                // Con los entrenadores en su sitio sale el salvaje, si lo hay.
                sacarSalvaje(formacion);
                continue;
            }

            if(ahora - formacion.esperandoDesdeMs < ESPERA_MAX_MS) continue;

            // Se acabo la espera: nadie se queda a medias en mitad de la sala.
            System.out.println("[PokemonEngine] La formacion del combate "
                    + formacion.batallaId + " no se ha podido montar: a interfaz.");

            soltarFormacion(formacion);

            ServicioBatalla.pasarAInterfaz(formacion.batallaId);
        }
    }

    private static boolean fijarSiLlego(Formacion formacion, Puesto puesto)
    {
        Habbo habbo = ServicioBatalla.conectado(puesto.userId);

        if(habbo == null || habbo.getHabboInfo().getCurrentRoom() == null) return false;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room.getId() != formacion.roomId) return false;

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
     * El Pokemon que pelea se pone delante y el seguidor de siempre se esconde.
     *
     * Delante se ve **al que esta luchando**, sea o no el que iba detras. Que
     * el seguidor y el combatiente coincidan es lo normal, pero con el primero
     * del equipo debilitado deja de serlo, y entonces ensenar al Pokemon
     * equivocado en la formacion seria mentir sobre quien pelea.
     */
    private static void sacarPokemon(Puesto puesto)
    {
        ServicioBatalla.Sesion sesion = ServicioBatalla.de(puesto.userId);

        if(sesion == null) return;

        int bando = sesion.bandoDe(puesto.userId);

        if(bando < 0 || sesion.propios[bando] == null) return;

        ServicioSeguidor.aArena(puesto.userId, puesto.pokemonX, puesto.pokemonY,
                puesto.pokemonDireccion, sesion.propios[bando]);
    }

    /** Contra la hierba, el salvaje tambien se ve: enfrente y mirando al jugador. */
    private static void sacarSalvaje(Formacion formacion)
    {
        if(formacion.salvajeFuera || formacion.salvaje == null) return;

        ServicioBatalla.Sesion sesion = ServicioBatalla.deId(formacion.batallaId);

        if(sesion == null || sesion.salvaje == null) return;

        Habbo alguno = ServicioBatalla.conectado(sesion.userIds[0]);
        Room room = alguno == null ? null : alguno.getHabboInfo().getCurrentRoom();

        if(room == null || room.getId() != formacion.roomId) return;

        ServicioSeguidor.salvajeAArena(
                claveSalvaje(formacion.batallaId), room,
                formacion.salvaje.x(), formacion.salvaje.y(), formacion.salvaje.direccion(),
                sesion.salvaje.pokemon(), sesion.salvaje.especie());

        formacion.salvajeFuera = true;
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

        Formacion formacion = FORMACIONES.get(sesion.id);

        if(formacion != null)
        {
            soltarFormacion(formacion);
            return;
        }

        for(int userId : sesion.userIds) soltar(userId);
    }

    private static void soltarFormacion(Formacion formacion)
    {
        FORMACIONES.remove(formacion.batallaId);
        RESERVADAS.remove(formacion.roomId);

        Habbo alguno = null;

        for(Puesto puesto : formacion.puestos)
        {
            if(alguno == null) alguno = ServicioBatalla.conectado(puesto.userId);

            soltar(puesto.userId);
        }

        if(formacion.salvajeFuera && alguno != null)
        {
            ServicioSeguidor.quitarSalvaje(claveSalvaje(formacion.batallaId),
                    alguno.getHabboInfo().getCurrentRoom());
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

    public static int totalFormaciones()
    {
        return FORMACIONES.size();
    }
}
