package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import com.eu.habbo.plugin.events.rooms.RoomUnloadedEvent;
import com.eu.habbo.plugin.events.users.UserDisconnectEvent;
import com.eu.habbo.plugin.events.users.UserEnterRoomEvent;
import com.eu.habbo.plugin.events.users.UserExitRoomEvent;
import com.eu.habbo.plugin.events.users.UserKickEvent;
import com.eu.habbo.plugin.events.users.UserLoginEvent;
import com.eu.habbo.plugin.events.users.UserTakeStepEvent;
import com.retro.pokemonengine.handlers.PokemonCommandHandler;
import com.retro.pokemonengine.handlers.PokemonSeguidorHandler;

public class PokemonEnginePlugin extends HabboPlugin implements EventListener
{
    public static final int PACKET_POKEMON_COMMAND = 6400;
    public static final int PACKET_POKEMON_SEGUIDOR = 6402;
    public static final int VERSION_PROTOCOLO = 2;

    @Override
    public void onEnable()
    {
        Emulator.getPluginManager().registerEvents(this, this);
    }

    @EventHandler
    public void onEmulatorLoaded(EmulatorLoadedEvent event) throws Exception
    {
        BaseDatosPokemon.inicializar();

        ServicioPokedex.cargar();
        ServicioGeneracion.cargar();
        ServicioZonas.cargar();
        ServicioObjetos.cargar();
        ServicioEncuentros.cargar();
        ServicioTienda.cargar();
        ServicioClima.cargar();
        ServicioFurniEncuentro.cargar();
        ServicioAnimacionesSeguidor.sincronizar();
        ServicioSeguidor.iniciar();
        ServicioClima.iniciar();
        ServicioBatalla.iniciarLatido();

        Emulator.getGameServer().getPacketManager()
                .registerHandler(PACKET_POKEMON_COMMAND, PokemonCommandHandler.class);
        Emulator.getGameServer().getPacketManager()
                .registerHandler(PACKET_POKEMON_SEGUIDOR, PokemonSeguidorHandler.class);

        System.out.println("[PokemonEngine] Cargado. Protocolo v" + VERSION_PROTOCOLO + ".");
    }

    @EventHandler
    public void onUserEnterRoom(UserEnterRoomEvent event)
    {
        if(bloqueadoPorCombate(event)) return;

        ServicioSeguidor.alEntrar(event.habbo, event.room);
        ServicioTiempoJugado.alEntrar(event.habbo, event.room);

        // Vuelve a la sala donde estaba peleando: se le devuelve al combate.
        if(event.habbo != null && event.habbo.getHabboInfo() != null)
        {
            ServicioBatalla.volver(event.habbo.getHabboInfo().getId());
        }
    }

    /**
     * Mientras se combate no se cambia de sala.
     *
     * Se cancela la **entrada** y no la salida porque Arcturus comprueba
     * isCancelled() al entrar y no al salir — verificado en el bytecode. Con la
     * entrada cancelada el jugador se queda exactamente donde estaba, que es lo
     * que queremos, y ademas es coherente con el bloqueo de posicion: si no le
     * dejo andar, tampoco le dejo teletransportarse.
     */
    private boolean bloqueadoPorCombate(UserEnterRoomEvent event)
    {
        if(event.habbo == null || event.habbo.getHabboInfo() == null) return false;

        ServicioBatalla.Sesion sesion = ServicioBatalla.de(event.habbo.getHabboInfo().getId());

        if(sesion == null) return false;
        if(event.room != null && event.room.getId() == sesion.roomId) return false;

        event.setCancelled(true);
        event.habbo.alert("No puedes cambiar de sala en mitad de un combate.");

        return true;
    }

    @EventHandler
    public void onUserExitRoom(UserExitRoomEvent event)
    {
        ServicioSeguidor.alSalir(event.habbo);
        ServicioTiempoJugado.alSalir(event.habbo);

        // Un encuentro no sobrevive a cambiar de sala: el Pokemon estaba alli.
        // El enfriamiento tampoco, que muere con la sesion.
        if(event.habbo == null || event.habbo.getHabboInfo() == null) return;

        int userId = event.habbo.getHabboInfo().getId();

        ServicioEncuentros.olvidar(userId);

        if(!ServicioBatalla.enCombate(userId)) return;

        // A la vista del hotel se puede salir siempre: Arcturus no deja
        // cancelarlo. Se trata como lo que es, una ausencia, y empieza el
        // plazo de gracia. Si te echan, en cambio, el combate se anula: eso
        // no es una decision tuya.
        if(event.reason == UserExitRoomEvent.UserExitRoomReason.KICKED_HABBO)
        {
            ServicioBatalla.anularDe(userId, "expulsado");
            return;
        }

        ServicioBatalla.ausentarse(userId);
    }

    @EventHandler
    public void onUserKick(UserKickEvent event)
    {
        if(event.target == null || event.target.getHabboInfo() == null) return;

        ServicioBatalla.anularDe(event.target.getHabboInfo().getId(), "expulsado");
    }

    @EventHandler
    public void onUserDisconnect(UserDisconnectEvent event)
    {
        if(event.habbo == null || event.habbo.getHabboInfo() == null) return;

        ServicioBatalla.ausentarse(event.habbo.getHabboInfo().getId());
    }

    @EventHandler
    public void onUserLogin(UserLoginEvent event)
    {
        if(event.habbo == null || event.habbo.getHabboInfo() == null) return;

        ServicioBatalla.volver(event.habbo.getHabboInfo().getId());
    }

    /** Si la sala se descarga, el combate que hubiera dentro no tiene donde ocurrir. */
    @EventHandler
    public void onRoomUnloaded(RoomUnloadedEvent event)
    {
        if(event.room == null) return;

        ServicioBatalla.anularDeSala(event.room.getId(), "sala_cerrada");
    }

    @EventHandler
    public void onUserTakeStep(UserTakeStepEvent event)
    {
        ServicioSeguidor.alPaso(event.habbo, event.fromLocation, event.toLocation);

        // Detras del seguidor a proposito: primero llega el Pokemon a su baldosa.
        DisparadorEncuentros.alPaso(event.habbo, event.toLocation);
    }

    @Override
    public void onDisable()
    {
        ServicioClima.parar();
    }

    @Override
    public boolean hasPermission(Habbo habbo, String permission)
    {
        return false;
    }
}
