package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;

public class PokemonEnginePlugin extends HabboPlugin implements EventListener
{
    public static final int PACKET_POKEMON_COMMAND = 5060;
    public static final int VERSION_PROTOCOLO = 1;

    @Override
    public void onEnable()
    {
        Emulator.getPluginManager().registerEvents(this, this);
    }

    @EventHandler
    public void onEmulatorLoaded(EmulatorLoadedEvent event) throws Exception
    {
        BaseDatosPokemon.inicializar();

        System.out.println("[PokemonEngine] Cargado. Protocolo v" + VERSION_PROTOCOLO + ".");
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
