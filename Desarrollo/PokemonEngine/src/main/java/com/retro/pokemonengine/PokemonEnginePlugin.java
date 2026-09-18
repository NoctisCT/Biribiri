package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;
import com.eu.habbo.plugin.events.users.UserEnterRoomEvent;
import com.eu.habbo.plugin.events.users.UserExitRoomEvent;
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
        ServicioSeguidor.iniciar();

        Emulator.getGameServer().getPacketManager()
                .registerHandler(PACKET_POKEMON_COMMAND, PokemonCommandHandler.class);
        Emulator.getGameServer().getPacketManager()
                .registerHandler(PACKET_POKEMON_SEGUIDOR, PokemonSeguidorHandler.class);

        System.out.println("[PokemonEngine] Cargado. Protocolo v" + VERSION_PROTOCOLO + ".");
    }

    @EventHandler
    public void onUserEnterRoom(UserEnterRoomEvent event)
    {
        ServicioSeguidor.alEntrar(event.habbo, event.room);
    }

    @EventHandler
    public void onUserExitRoom(UserExitRoomEvent event)
    {
        ServicioSeguidor.alSalir(event.habbo);
    }

    @EventHandler
    public void onUserTakeStep(UserTakeStepEvent event)
    {
        ServicioSeguidor.alPaso(event.habbo, event.fromLocation, event.toLocation);
    }

    @Override
    public void onDisable()
    {
    }

    @Override
    public boolean hasPermission(Habbo habbo, String permission)
    {
        return false;
    }
}
