package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.rooms.RoomUnit;
import com.eu.habbo.habbohotel.rooms.RoomUnitStatus;
import com.eu.habbo.habbohotel.users.DanceType;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.ServerMessage;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.entrenador.PokemonPoseido;
import com.retro.pokemonengine.seguidor.CatalogoAnimaciones;
import com.retro.pokemonengine.seguidor.Direccion;
import com.retro.pokemonengine.seguidor.EstadoSeguidor;
import com.retro.pokemonengine.seguidor.MaquinaAnimacion;
import com.retro.pokemonengine.seguidor.RastroSeguidor;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * El Pokemon que camina detras del jugador.
 *
 * Existe solo en salas dadas de alta en pokemon_zone_rooms. La posicion sale de
 * UserTakeStepEvent, asi que nunca hay que perseguir a nadie: el seguidor ocupa
 * la baldosa que el entrenador deja y con eso basta.
 *
 * La animacion no tiene evento propio en Arcturus (nadie avisa de que alguien ha
 * empezado a bailar), asi que un latido cada medio segundo mira el estado de los
 * avatares con seguidor y difunde solo lo que ha cambiado.
 */
public final class ServicioSeguidor
{
    public static final long LATIDO_MS = 500L;

    /**
     * Un paso de Habbo dura un ciclo de sala. Con algo de margen por encima, si no
     * ha llegado otro paso en este tiempo es que el jugador se ha parado.
     */
    public static final long MARGEN_PASO_MS = 700L;

    private static final Map<Integer, Seguidor> porUsuario = new ConcurrentHashMap<>();

    private ServicioSeguidor()
    {
    }

    /** Lo que el servidor sabe del seguidor de un jugador dentro de una sala. */
    public static final class Seguidor
    {
        final int userId;
        int roomId;

        long ownedId;
        int especieId;
        int formaId;
        boolean shiny;
        String nombre;

        final RastroSeguidor rastro = new RastroSeguidor();
        final MaquinaAnimacion maquina = new MaquinaAnimacion();

        long ultimoPasoMs;

        String gesto;
        long gestoHastaMs;
        String interaccion;
        long interaccionHastaMs;

        /**
         * Puesto en el hueco de combate.
         *
         * Mientras dura, el seguidor deja de ir detras del jugador: se queda en
         * la baldosa que le toca de la formacion, mirando al rival. Es lo que
         * hace que el Pokemon que pelea se ponga delante en vez de seguir a la
         * espalda de su entrenador.
         */
        boolean enArena;

        /** La identidad de fuera de combate, para devolverla al acabar. */
        long ownedIdFuera;
        int especieIdFuera;
        int formaIdFuera;
        boolean shinyFuera;
        String nombreFuera;

        /** Creado solo para el combate: al soltarlo desaparece del todo. */
        boolean soloParaCombate;

        String ultimoEstado = CatalogoAnimaciones.PARADO;
        String ultimaAnimacion = "Idle";
        String ultimoRespaldo = "Walk";

        Seguidor(int userId)
        {
            this.userId = userId;
        }
    }

    public static void iniciar()
    {
        Emulator.getThreading().getService().scheduleAtFixedRate(
                ServicioSeguidor::latido, LATIDO_MS, LATIDO_MS, TimeUnit.MILLISECONDS);
    }

    // --- Entrada y salida de la sala ---

    public static void alEntrar(Habbo habbo, Room room)
    {
        if(habbo == null || room == null) return;

        int userId = habbo.getHabboInfo().getId();

        porUsuario.remove(userId);

        if(!ServicioZonas.permiteSeguidor(room.getId()))
        {
            // Sala sin zona: el cliente recibe una foto vacia y esconde la interfaz.
            enviarA(habbo, SeguidorPackets.mensaje(SeguidorPackets.TIPO_FOTO, List.of()));
            return;
        }

        try
        {
            ServicioEntrenador.ponerZonaActual(userId, ServicioZonas.zonaDeSala(room.getId()));

            Seguidor seguidor = construir(userId, room);

            if(seguidor != null)
            {
                porUsuario.put(userId, seguidor);
                room.sendComposer(SeguidorPackets.mensaje(
                        SeguidorPackets.TIPO_ALTA, entradaDe(seguidor, room)));
            }
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] No se ha podido sacar el seguidor de "
                    + userId + ": " + error.getMessage());
        }

        enviarA(habbo, foto(room));
    }

    public static void alSalir(Habbo habbo)
    {
        if(habbo == null) return;

        int userId = habbo.getHabboInfo().getId();
        Seguidor seguidor = porUsuario.remove(userId);

        if(seguidor == null) return;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room != null)
        {
            room.sendComposer(SeguidorPackets.mensaje(
                    SeguidorPackets.TIPO_BAJA, SeguidorPackets.Entrada.baja(userId)));
        }
    }

    public static void alPaso(Habbo habbo, RoomTile desde, RoomTile hacia)
    {
        if(habbo == null || desde == null || hacia == null) return;

        Seguidor seguidor = porUsuario.get(habbo.getHabboInfo().getId());

        if(seguidor == null) return;

        // En el hueco de combate el Pokemon no sigue a nadie: se queda plantado.
        if(seguidor.enArena) return;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null) return;

        seguidor.rastro.alPasar(desde.x, desde.y, hacia.x, hacia.y);
        seguidor.ultimoPasoMs = System.currentTimeMillis();

        room.sendComposer(SeguidorPackets.mensaje(
                SeguidorPackets.TIPO_PASO, entradaDe(seguidor, room)));
    }

    // --- Gestos e interacciones ---

    /** Un gesto del avatar (saludo, risa, beso) se refleja en el seguidor. */
    public static void gesto(int userId, String codigoEstado)
    {
        Seguidor seguidor = porUsuario.get(userId);

        if(seguidor == null) return;

        EstadoSeguidor estado = CatalogoAnimaciones.por(codigoEstado);

        if(estado == null) return;

        seguidor.gesto = estado.codigo();
        seguidor.gestoHastaMs = System.currentTimeMillis() + Math.max(500, estado.duracionMs());
    }

    /**
     * La risa, el beso y el pulgar no dejan estado en el avatar: Arcturus solo los
     * difunde y se olvidan. Como no hay forma de verlos desde el servidor, los
     * cuenta el cliente, y solo para el seguidor de quien los manda. Lo peor que
     * puede conseguir un cliente manipulado es que su propio Pokemon salude de mas.
     */
    public static boolean gestoPropio(int userId, String codigoEstado)
    {
        EstadoSeguidor estado = CatalogoAnimaciones.por(codigoEstado);

        if(estado == null || estado.interactivo() || estado.vinculo() == null) return false;
        if(!estado.esPuntual()) return false;

        gesto(userId, codigoEstado);

        return true;
    }

    /**
     * Lo que pide un jugador al pulsar un seguidor: una animacion suelta de las
     * que no tienen vinculo con ningun gesto de Habbo.
     */
    public static boolean interactuar(int userIdDelSeguidor, String codigoEstado)
    {
        Seguidor seguidor = porUsuario.get(userIdDelSeguidor);

        if(seguidor == null) return false;

        EstadoSeguidor estado = CatalogoAnimaciones.por(codigoEstado);

        if(estado == null || !estado.interactivo()) return false;

        seguidor.interaccion = estado.codigo();
        seguidor.interaccionHastaMs = System.currentTimeMillis() + Math.max(500, estado.duracionMs());

        return true;
    }

    // --- El latido ---

    private static void latido()
    {
        try
        {
            for(Seguidor seguidor : porUsuario.values()) revisar(seguidor);
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] Fallo en el latido del seguidor: " + error.getMessage());
        }
    }

    private static void revisar(Seguidor seguidor)
    {
        Habbo habbo = Emulator.getGameEnvironment().getHabboManager().getHabbo(seguidor.userId);

        if(habbo == null || habbo.getHabboInfo().getCurrentRoom() == null)
        {
            porUsuario.remove(seguidor.userId);
            return;
        }

        Room room = habbo.getHabboInfo().getCurrentRoom();
        RoomUnit unidad = habbo.getRoomUnit();

        if(unidad == null) return;

        // El saludo si deja rastro en el avatar, asi que este no hace falta que lo
        // cuente el cliente.
        if(unidad.hasStatus(RoomUnitStatus.WAVE)) gesto(seguidor.userId, CatalogoAnimaciones.SALUDANDO);

        // En el hueco de combate la posicion la manda la formacion, no el rastro.
        if(!seguidor.enArena && recolocar(seguidor, unidad, room)) return;

        EstadoSeguidor estado = seguidor.maquina.resolver(foto(seguidor, unidad));

        if(estado.codigo().equals(seguidor.ultimoEstado)) return;

        seguidor.ultimoEstado = estado.codigo();
        seguidor.ultimaAnimacion = estado.animacion();
        seguidor.ultimoRespaldo = estado.respaldo();

        room.sendComposer(SeguidorPackets.mensaje(
                SeguidorPackets.TIPO_ANIMACION, entradaDe(seguidor, room)));
    }

    /** La traduccion del avatar de Habbo a la entrada que entiende la maquina. */
    private static MaquinaAnimacion.EntradaAvatar foto(Seguidor seguidor, RoomUnit unidad)
    {
        // Solo el estado real de la unidad. `cmdSit` y `cmdLay` guardan que el
        // jugador *pidio* sentarse o tumbarse y no siempre se limpian al levantarse:
        // mirarlos dejaba al seguidor tumbado para siempre.
        boolean sentado = unidad.hasStatus(RoomUnitStatus.SIT);
        boolean tumbado = unidad.hasStatus(RoomUnitStatus.LAY);
        boolean bailando = unidad.getDanceType() != null && unidad.getDanceType() != DanceType.NONE;

        return new MaquinaAnimacion.EntradaAvatar(
                false,
                false,
                tumbado,
                sentado,
                unidad.isIdle(),
                bailando,
                andando(seguidor),
                seguidor.gesto,
                seguidor.gestoHastaMs,
                seguidor.interaccion,
                seguidor.interaccionHastaMs,
                System.currentTimeMillis());
    }

    /**
     * Si el seguidor se ha quedado descolgado, lo devuelve al lado del jugador.
     *
     * Pasa al entrar en una sala: `UserEnterRoomEvent` salta antes de que el
     * avatar tenga baldosa, asi que el seguidor nacia en la del sitio anterior y
     * se quedaba alli hasta el primer paso. En vez de adivinar cuando esta
     * colocado el avatar, se comprueba cada latido y se corrige.
     */
    private static boolean recolocar(Seguidor seguidor, RoomUnit unidad, Room room)
    {
        RoomTile baldosa = unidad.getCurrentLocation();

        if(baldosa == null) return false;

        RastroSeguidor rastro = seguidor.rastro;

        if(rastro.colocado()
                && Direccion.distancia(rastro.x(), rastro.y(), baldosa.x, baldosa.y) <= 1)
        {
            return false;
        }

        rastro.aparecer(baldosa.x, baldosa.y,
                unidad.getBodyRotation() == null ? Direccion.SUR : unidad.getBodyRotation().getValue());

        room.sendComposer(SeguidorPackets.mensaje(
                SeguidorPackets.TIPO_ALTA, entradaDe(seguidor, room)));

        return true;
    }

    /**
     * Si el ultimo paso es reciente, el jugador esta caminando.
     *
     * No se usa `RoomUnit.isWalking()` porque es `!isAtGoal() && canWalk`: cuando
     * alguien pincha una baldosa a la que no se puede llegar, el destino se queda
     * puesto, el avatar se para y el seguidor se quedaba caminando para siempre.
     * El paso, en cambio, es un hecho: o ha llegado o no.
     */
    private static boolean andando(Seguidor seguidor)
    {
        return (System.currentTimeMillis() - seguidor.ultimoPasoMs) < MARGEN_PASO_MS;
    }

    // --- Construccion y envio ---

    private static Seguidor construir(int userId, Room room) throws Exception
    {
        ServicioEntrenador.Entrenador entrenador = ServicioEntrenador.cargar(userId);

        if(!entrenador.seguidorActivo || entrenador.seguidorOwnedId == null) return null;

        PokemonPoseido pokemon = ServicioEntrenador.cargarUno(userId, entrenador.seguidorOwnedId);

        if(pokemon == null || pokemon.huevo()) return null;

        EspecieCatalogo especie = ServicioPokedex.especie(pokemon.especieId());

        Seguidor seguidor = new Seguidor(userId);

        seguidor.roomId = room.getId();
        seguidor.ownedId = pokemon.id();
        seguidor.especieId = pokemon.especieId();
        seguidor.formaId = pokemon.formaId();
        seguidor.shiny = pokemon.shiny();
        seguidor.nombre = pokemon.nombreMostrado(especie);

        Habbo habbo = Emulator.getGameEnvironment().getHabboManager().getHabbo(userId);
        RoomUnit unidad = habbo == null ? null : habbo.getRoomUnit();
        RoomTile baldosa = unidad == null ? null : unidad.getCurrentLocation();

        if(baldosa != null)
        {
            seguidor.rastro.aparecer(
                    baldosa.x, baldosa.y,
                    unidad.getBodyRotation() == null
                            ? Direccion.SUR : unidad.getBodyRotation().getValue());
        }

        return seguidor;
    }

    /** La foto de la sala entera, para quien acaba de entrar o ha recargado el cliente. */
    public static ServerMessage foto(Room room)
    {
        List<SeguidorPackets.Entrada> entradas = new ArrayList<>();

        if(room != null)
        {
            for(Habbo habbo : room.getHabbos())
            {
                Seguidor seguidor = porUsuario.get(habbo.getHabboInfo().getId());

                if(seguidor != null) entradas.add(entradaDe(seguidor, room));
            }
        }

        return SeguidorPackets.mensaje(SeguidorPackets.TIPO_FOTO, entradas);
    }

    /**
     * Pone en el hueco de combate **al Pokemon que pelea**.
     *
     * Dentro del combate el que se ve delante es el que esta luchando, y el
     * seguidor de siempre se esconde. Se hace reutilizando la misma entidad:
     * se le cambia la identidad y se le devuelve la suya al acabar, para que
     * el cliente no tenga que saber nada de esto y siga habiendo un Pokemon
     * por jugador.
     *
     * No anda hasta el hueco: aparece. Un Pokemon que sale de su ball no
     * camina desde detras de su entrenador, y ademas no hay ninguna garantia
     * de que haya camino libre entre una baldosa y la otra.
     */
    public static void aArena(int userId, int x, int y, int direccion, PokemonPoseido quePelea)
    {
        if(quePelea == null) return;

        Habbo habbo = Emulator.getGameEnvironment().getHabboManager().getHabbo(userId);
        Room room = habbo == null ? null : habbo.getHabboInfo().getCurrentRoom();

        if(room == null) return;

        Seguidor seguidor = porUsuario.get(userId);

        // Sin seguidor activo tambien hay que ver al que pelea: se crea uno
        // para el combate y se retira al terminar.
        if(seguidor == null)
        {
            seguidor = new Seguidor(userId);
            seguidor.roomId = room.getId();
            seguidor.soloParaCombate = true;

            porUsuario.put(userId, seguidor);
        }

        if(!seguidor.enArena)
        {
            seguidor.ownedIdFuera = seguidor.ownedId;
            seguidor.especieIdFuera = seguidor.especieId;
            seguidor.formaIdFuera = seguidor.formaId;
            seguidor.shinyFuera = seguidor.shiny;
            seguidor.nombreFuera = seguidor.nombre;
        }

        EspecieCatalogo especie = ServicioPokedex.especie(quePelea.especieId());

        seguidor.enArena = true;
        seguidor.ownedId = quePelea.id();
        seguidor.especieId = quePelea.especieId();
        seguidor.formaId = quePelea.formaId();
        seguidor.shiny = quePelea.shiny();
        seguidor.nombre = quePelea.nombreMostrado(especie);

        seguidor.rastro.aparecer(x, y, direccion);

        room.sendComposer(SeguidorPackets.mensaje(
                SeguidorPackets.TIPO_ALTA, entradaDe(seguidor, room)));
    }

    /** Devuelve el seguidor de siempre a la espalda de su entrenador. */
    public static void fueraDeArena(int userId)
    {
        Seguidor seguidor = porUsuario.get(userId);

        if(seguidor == null || !seguidor.enArena) return;

        seguidor.enArena = false;

        Habbo habbo = Emulator.getGameEnvironment().getHabboManager().getHabbo(userId);
        Room room = habbo == null ? null : habbo.getHabboInfo().getCurrentRoom();

        // El que solo existia para el combate se va con el combate.
        if(seguidor.soloParaCombate)
        {
            porUsuario.remove(userId);

            if(room != null)
            {
                room.sendComposer(SeguidorPackets.mensaje(
                        SeguidorPackets.TIPO_BAJA, SeguidorPackets.Entrada.baja(userId)));
            }

            return;
        }

        seguidor.ownedId = seguidor.ownedIdFuera;
        seguidor.especieId = seguidor.especieIdFuera;
        seguidor.formaId = seguidor.formaIdFuera;
        seguidor.shiny = seguidor.shinyFuera;
        seguidor.nombre = seguidor.nombreFuera;

        if(room == null) return;

        // Vuelve de golpe a la espalda de su entrenador, sin pasear: el
        // siguiente latido ya le lleva el ritmo.
        room.sendComposer(SeguidorPackets.mensaje(
                SeguidorPackets.TIPO_ALTA, entradaDe(seguidor, room)));
    }

    /** El Pokemon que va detras, o 0 si no hay ninguno. */
    public static long ownedIdDe(int userId)
    {
        Seguidor seguidor = porUsuario.get(userId);

        return seguidor == null ? 0L : seguidor.ownedId;
    }

    public static boolean tieneSeguidor(int userId)
    {
        return porUsuario.containsKey(userId);
    }

    /** Se llama cuando el jugador cambia de seguidor estando ya en la sala. */
    public static void refrescar(Habbo habbo)
    {
        if(habbo == null) return;

        Room room = habbo.getHabboInfo().getCurrentRoom();

        if(room == null) return;

        alEntrar(habbo, room);
    }

    private static SeguidorPackets.Entrada entradaDe(Seguidor seguidor, Room room)
    {
        RastroSeguidor rastro = seguidor.rastro;
        int zCentesimas = 0;

        if(room != null && room.getLayout() != null)
        {
            RoomTile baldosa = room.getLayout().getTile((short) rastro.x(), (short) rastro.y());

            if(baldosa != null) zCentesimas = (int) Math.round(baldosa.getStackHeight() * 100.0);
        }

        return new SeguidorPackets.Entrada(
                seguidor.userId,
                seguidor.ownedId,
                seguidor.especieId,
                seguidor.formaId,
                seguidor.shiny,
                rastro.x(),
                rastro.y(),
                zCentesimas,
                rastro.direccion(),
                seguidor.ultimoEstado,
                seguidor.ultimaAnimacion,
                seguidor.ultimoRespaldo,
                seguidor.nombre);
    }

    private static void enviarA(Habbo habbo, ServerMessage mensaje)
    {
        if(habbo != null && habbo.getClient() != null) habbo.getClient().sendResponse(mensaje);
    }
}
