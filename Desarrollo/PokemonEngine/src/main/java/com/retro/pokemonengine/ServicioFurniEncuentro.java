package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.encuentros.MetodoEncuentro;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * Que furni saca Pokemon y de que manera.
 *
 * El furni es la senal, no la autoridad: sin fila en pokemon_zone_rooms la sala
 * no tiene zona y no pasa nada aunque este alfombrada de hierba alta.
 *
 * Se carga en memoria al arrancar porque se consulta en cada paso de cada
 * jugador del hotel, y cambia solo cuando el staff da de alta un furni nuevo.
 */
public final class ServicioFurniEncuentro
{
    private static Map<Integer, MetodoEncuentro> porSprite = Collections.emptyMap();

    private ServicioFurniEncuentro()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, MetodoEncuentro> nuevos = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT sprite_id, metodo FROM pokemon_encounter_furni WHERE activo = 1"))
        {
            while(r.next())
            {
                nuevos.put(r.getInt("sprite_id"), MetodoEncuentro.porNombre(r.getString("metodo")));
            }
        }

        porSprite = Collections.unmodifiableMap(nuevos);

        System.out.println("[PokemonEngine] Furnis disparadores: " + porSprite.size() + ".");
    }

    /** null si ese furni no dispara nada. */
    public static MetodoEncuentro metodo(int spriteId)
    {
        return porSprite.get(spriteId);
    }

    public static boolean hayAlguno()
    {
        return !porSprite.isEmpty();
    }

    public static int total()
    {
        return porSprite.size();
    }
}
