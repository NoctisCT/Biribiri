package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.retro.pokemonengine.combate.EjecutorMovimiento;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.MovimientoCatalogo;
import com.retro.pokemonengine.combate.TablaTipos;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Catálogo de solo lectura cargado una vez al arrancar.
 *
 * Existe para que el motor de combate no haga una sola consulta SQL en caliente:
 * unas mil especies y novecientos movimientos caben de sobra en memoria.
 */
public final class ServicioPokedex
{
    private static Map<Integer, EspecieCatalogo> especies = Collections.emptyMap();
    private static Map<Integer, MovimientoCatalogo> movimientos = Collections.emptyMap();
    private static TablaTipos tipos = new TablaTipos(Collections.emptyMap());
    private static Map<Integer, EjecutorMovimiento.Mecanica> mecanicas = Collections.emptyMap();

    private ServicioPokedex()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, EspecieCatalogo> nuevasEspecies = new HashMap<>();
        Map<Integer, MovimientoCatalogo> nuevosMovimientos = new HashMap<>();
        Map<Long, Double> nuevaTabla = new HashMap<>();
        Map<Integer, EjecutorMovimiento.Mecanica> nuevasMecanicas = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT id, nombre_es, type_1_id, type_2_id, base_hp, base_attack, base_defense," +
                    " base_sp_attack, base_sp_defense, base_speed, catch_rate, base_experience, growth_rate" +
                    " FROM pokemon_species WHERE form_id = 0"))
        {
            while(r.next())
            {
                int tipo2 = r.getInt("type_2_id");
                Integer tipo2Real = r.wasNull() ? null : tipo2;

                nuevasEspecies.put(r.getInt("id"), new EspecieCatalogo(
                        r.getInt("id"),
                        r.getString("nombre_es"),
                        r.getInt("type_1_id"),
                        tipo2Real,
                        r.getInt("base_hp"),
                        r.getInt("base_attack"),
                        r.getInt("base_defense"),
                        r.getInt("base_sp_attack"),
                        r.getInt("base_sp_defense"),
                        r.getInt("base_speed"),
                        r.getInt("catch_rate"),
                        r.getInt("base_experience"),
                        r.getString("growth_rate")));
            }
        }

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT id, nombre_es, type_id, clase, potencia, precision_pct, pp, prioridad," +
                    " objetivo, effect_code, vigente," +
                    " categoria, dolencia, dolencia_chance, golpes_min, golpes_max," +
                    " turnos_min, turnos_max, drenaje, curacion, ratio_critico," +
                    " retroceso_chance, stat_chance, cambios_stats," +
                    " stat_ofensivo_forzado, stat_defensivo_forzado" +
                    " FROM pokemon_moves"))
        {
            while(r.next())
            {
                Integer potencia = r.getObject("potencia") == null ? null : r.getInt("potencia");
                Integer precision = r.getObject("precision_pct") == null ? null : r.getInt("precision_pct");

                nuevosMovimientos.put(r.getInt("id"), new MovimientoCatalogo(
                        r.getInt("id"),
                        r.getString("nombre_es"),
                        r.getInt("type_id"),
                        r.getString("clase"),
                        potencia,
                        precision,
                        r.getInt("pp"),
                        r.getInt("prioridad"),
                        r.getString("objetivo"),
                        r.getString("effect_code"),
                        r.getInt("vigente") == 1));

                nuevasMecanicas.put(r.getInt("id"), new EjecutorMovimiento.Mecanica(
                        r.getString("categoria"),
                        r.getString("dolencia"),
                        r.getInt("dolencia_chance"),
                        entero(r, "golpes_min"),
                        entero(r, "golpes_max"),
                        entero(r, "turnos_min"),
                        entero(r, "turnos_max"),
                        r.getInt("drenaje"),
                        r.getInt("curacion"),
                        r.getInt("ratio_critico"),
                        r.getInt("retroceso_chance"),
                        r.getInt("stat_chance"),
                        cambiosStats(r.getString("cambios_stats")),
                        r.getString("stat_ofensivo_forzado"),
                        r.getString("stat_defensivo_forzado")));
            }
        }

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT atacante_id, defensor_id, multiplicador FROM pokemon_type_chart"))
        {
            while(r.next())
            {
                nuevaTabla.put(
                        TablaTipos.clave(r.getInt("atacante_id"), r.getInt("defensor_id")),
                        r.getDouble("multiplicador"));
            }
        }

        especies = Collections.unmodifiableMap(nuevasEspecies);
        mecanicas = Collections.unmodifiableMap(nuevasMecanicas);
        movimientos = Collections.unmodifiableMap(nuevosMovimientos);
        tipos = new TablaTipos(nuevaTabla);

        long vigentes = movimientos.values().stream().filter(MovimientoCatalogo::vigente).count();

        System.out.println("[PokemonEngine] Catalogo en memoria: "
                + especies.size() + " especies, "
                + movimientos.size() + " movimientos (" + vigentes + " vigentes), "
                + nuevaTabla.size() + " combinaciones de tipos.");
    }

    /**
     * La mecanica de un movimiento, tal y como la dejo el importador del hito 2.
     * Es lo que el motor necesita para resolver las once categorias genericas.
     */
    public static EjecutorMovimiento.Mecanica mecanica(int moveId)
    {
        return mecanicas.get(moveId);
    }

    private static Integer entero(ResultSet r, String columna) throws Exception
    {
        int valor = r.getInt(columna);

        return r.wasNull() ? null : valor;
    }

    /** La columna guarda [{"stat":"attack","cambio":-1}] tal como lo escribio el importador. */
    private static List<EjecutorMovimiento.CambioStat> cambiosStats(String json)
    {
        List<EjecutorMovimiento.CambioStat> salida = new ArrayList<>();

        if(json == null || json.isBlank() || "[]".equals(json)) return salida;

        try
        {
            JsonArray array = JsonParser.parseString(json).getAsJsonArray();

            for(JsonElement elemento : array)
            {
                String nombre = elemento.getAsJsonObject().get("stat").getAsString();
                int cambio = elemento.getAsJsonObject().get("cambio").getAsInt();
                int indice = EjecutorMovimiento.CambioStat.indicePorNombre(nombre);

                if(indice >= 0) salida.add(new EjecutorMovimiento.CambioStat(indice, nombre, cambio));
            }
        }
        catch(Exception error)
        {
            System.out.println("[PokemonEngine] cambios_stats ilegible: " + json);
        }

        return salida;
    }

    public static EspecieCatalogo especie(int id)
    {
        return especies.get(id);
    }

    public static MovimientoCatalogo movimiento(int id)
    {
        return movimientos.get(id);
    }

    public static TablaTipos tipos()
    {
        return tipos;
    }

    public static int totalEspecies()
    {
        return especies.size();
    }

    public static int totalMovimientos()
    {
        return movimientos.size();
    }
}
