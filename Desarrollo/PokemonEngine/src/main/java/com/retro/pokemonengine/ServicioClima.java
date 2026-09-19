package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.clima.Clima;
import com.retro.pokemonengine.clima.RuletaClima;
import com.retro.pokemonengine.combate.RngCombate;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;

/**
 * El tiempo que hace en cada zona.
 *
 * Se sortea por zona, no por region: con un sorteo global llueve en todas las
 * rutas a la vez. El estado se guarda porque un reinicio del emulador no debe
 * cambiar el tiempo, y si el emulador estuvo caido varias ventanas **no se
 * compensan**: se sortea una vez y se abre ventana nueva.
 *
 * Una zona sin pesos esta siempre despejada y no se le escribe estado.
 */
public final class ServicioClima
{
    /** Cada cuanto se vuelve a sortear el clima de una zona. */
    public static final long VENTANA_MS = 4L * 60L * 60L * 1000L;

    /** Cada cuanto se mira si alguna ventana ha vencido. */
    private static final long LATIDO_MS = 60L * 1000L;

    private static Map<Integer, List<RuletaClima.Peso>> pesos = Collections.emptyMap();

    private static final Map<Integer, Clima> ACTUAL = new ConcurrentHashMap<>();
    private static final Map<Integer, Long> HASTA = new ConcurrentHashMap<>();

    private static volatile boolean activo = false;

    private ServicioClima()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, List<RuletaClima.Peso>> nuevos = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT zone_id, clima, peso FROM pokemon_zone_weather ORDER BY zone_id, clima"))
        {
            while(r.next())
            {
                nuevos.computeIfAbsent(r.getInt("zone_id"), z -> new ArrayList<>())
                        .add(new RuletaClima.Peso(
                                Clima.porNombre(r.getString("clima")),
                                r.getInt("peso")));
            }
        }

        pesos = Collections.unmodifiableMap(nuevos);

        ACTUAL.clear();
        HASTA.clear();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT zone_id, clima, hasta FROM pokemon_zone_weather_state"))
        {
            while(r.next())
            {
                int zonaId = r.getInt("zone_id");
                Timestamp hasta = r.getTimestamp("hasta");

                ACTUAL.put(zonaId, Clima.porNombre(r.getString("clima")));
                HASTA.put(zonaId, hasta == null ? 0L : hasta.getTime());
            }
        }

        System.out.println("[PokemonEngine] Clima: " + pesos.size()
                + " zonas con tiempo propio, " + ACTUAL.size() + " con estado guardado.");
    }

    public static Clima clima(int zonaId)
    {
        return ACTUAL.getOrDefault(zonaId, Clima.DESPEJADO);
    }

    /** Epoch en milisegundos de cuando toca volver a sortear. Cero si la zona no tiene tiempo propio. */
    public static long hasta(int zonaId)
    {
        return HASTA.getOrDefault(zonaId, 0L);
    }

    public static int totalZonas()
    {
        return pesos.size();
    }

    public static void iniciar()
    {
        activo = true;

        // Primer repaso al arrancar: si la ventana vencio con el emulador caido,
        // se sortea ya en vez de esperar al primer latido.
        latido();

        Emulator.getThreading().getService().scheduleAtFixedRate(
                ServicioClima::latido, LATIDO_MS, LATIDO_MS, TimeUnit.MILLISECONDS);
    }

    private static void latido()
    {
        if(!activo) return;

        try
        {
            repasarYAvisar();
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] Error en el latido del clima: " + error.getMessage());
        }
    }

    public static void parar()
    {
        activo = false;
    }

    /**
     * Sortea las zonas con la ventana vencida y avisa a quien este dentro.
     *
     * @return las zonas que han cambiado de tiempo
     */
    public static List<Integer> repasar()
    {
        List<Integer> cambiadas = new ArrayList<>();
        long ahora = System.currentTimeMillis();

        for(Map.Entry<Integer, List<RuletaClima.Peso>> entrada : pesos.entrySet())
        {
            int zonaId = entrada.getKey();

            if(HASTA.getOrDefault(zonaId, 0L) > ahora) continue;

            Clima anterior = clima(zonaId);
            Clima nuevo = RuletaClima.sortear(
                    entrada.getValue(),
                    new RngCombate(System.nanoTime() ^ ((long) zonaId << 24)));

            long hasta = ahora + VENTANA_MS;

            ACTUAL.put(zonaId, nuevo);
            HASTA.put(zonaId, hasta);

            try
            {
                guardar(zonaId, nuevo, ahora, hasta);
            }
            catch(Exception error)
            {
                System.out.println("[PokemonEngine] No se pudo guardar el clima de la zona "
                        + zonaId + ": " + error.getMessage());
            }

            if(anterior != nuevo) cambiadas.add(zonaId);
        }

        return cambiadas;
    }

    private static void repasarYAvisar()
    {
        for(int zonaId : repasar())
        {
            System.out.println("[PokemonEngine] Clima de la zona " + zonaId + ": "
                    + clima(zonaId).nombreEs() + ".");

            AccionesMundo.avisarClima(zonaId);
        }
    }

    private static void guardar(int zonaId, Clima clima, long desde, long hasta) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "INSERT INTO pokemon_zone_weather_state (zone_id, clima, desde, hasta)" +
                    " VALUES (?, ?, ?, ?)" +
                    " ON DUPLICATE KEY UPDATE clima = VALUES(clima), desde = VALUES(desde)," +
                    " hasta = VALUES(hasta)"))
        {
            p.setInt(1, zonaId);
            p.setString(2, clima.name());
            p.setTimestamp(3, new Timestamp(desde));
            p.setTimestamp(4, new Timestamp(hasta));
            p.executeUpdate();
        }
    }
}
