package com.retro.pokemonengine;

import com.eu.habbo.Emulator;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.HashMap;
import java.util.Map;

/**
 * El gating: que salas del hotel son salas Pokemon.
 *
 * Una sala sin fila en pokemon_zone_rooms no tiene nada de Pokemon: ni seguidor,
 * ni encuentros, ni combates. El servidor rechaza cualquier accion que necesite
 * zona, sin fiarse de que el cliente haya escondido la interfaz.
 *
 * Cabe de sobra en memoria y cambia solo cuando un administrador da de alta una
 * sala, asi que se carga al arrancar y se recarga a mano.
 */
public final class ServicioZonas
{
    public record Zona(int zonaId, int regionId, String codigo, String nombreEs, String tipo)
    {
    }

    public record SalaZona(int roomId, int zonaId, boolean seguidorPermitido)
    {
    }

    private static Map<Integer, Zona> zonas = Collections.emptyMap();
    private static Map<Integer, SalaZona> salas = Collections.emptyMap();

    private ServicioZonas()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, Zona> nuevasZonas = new HashMap<>();
        Map<Integer, SalaZona> nuevasSalas = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT id, region_id, codigo, nombre_es, tipo FROM pokemon_zones"))
        {
            while(r.next())
            {
                nuevasZonas.put(r.getInt("id"), new Zona(
                        r.getInt("id"),
                        r.getInt("region_id"),
                        r.getString("codigo"),
                        r.getString("nombre_es"),
                        r.getString("tipo")));
            }
        }

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT room_id, zone_id, seguidor_permitido FROM pokemon_zone_rooms"))
        {
            while(r.next())
            {
                nuevasSalas.put(r.getInt("room_id"), new SalaZona(
                        r.getInt("room_id"),
                        r.getInt("zone_id"),
                        r.getInt("seguidor_permitido") == 1));
            }
        }

        zonas = Collections.unmodifiableMap(nuevasZonas);
        // Una sala que pierde la condicion de sala Pokemon no puede seguir
        // albergando un combate: se anula, sin ganador y sin castigo.
        for(int roomId : salas.keySet())
        {
            if(!nuevasSalas.containsKey(roomId))
            {
                ServicioBatalla.anularDeSala(roomId, "sala_sin_zona");
            }
        }

        salas = Collections.unmodifiableMap(nuevasSalas);

        System.out.println("[PokemonEngine] Zonas: " + zonas.size()
                + " zonas, " + salas.size() + " salas dadas de alta.");
    }

    public static SalaZona sala(int roomId)
    {
        return salas.get(roomId);
    }

    public static Zona zona(int zonaId)
    {
        return zonas.get(zonaId);
    }

    public static boolean esSalaPokemon(int roomId)
    {
        return salas.containsKey(roomId);
    }

    public static boolean permiteSeguidor(int roomId)
    {
        SalaZona sala = salas.get(roomId);

        return sala != null && sala.seguidorPermitido();
    }

    public static Integer zonaDeSala(int roomId)
    {
        SalaZona sala = salas.get(roomId);

        return sala == null ? null : sala.zonaId();
    }

    /** Las salas dadas de alta en esa zona. Para avisar a quien este dentro. */
    public static List<Integer> salasDeZona(int zonaId)
    {
        List<Integer> salida = new ArrayList<>();

        for(SalaZona sala : salas.values())
        {
            if(sala.zonaId() == zonaId) salida.add(sala.roomId());
        }

        return salida;
    }

    public static int totalSalas()
    {
        return salas.size();
    }

    public static int totalZonas()
    {
        return zonas.size();
    }
}
