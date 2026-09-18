package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.MovimientoCatalogo;
import com.retro.pokemonengine.combate.TablaTipos;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Collections;
import java.util.HashMap;
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

    private ServicioPokedex()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, EspecieCatalogo> nuevasEspecies = new HashMap<>();
        Map<Integer, MovimientoCatalogo> nuevosMovimientos = new HashMap<>();
        Map<Long, Double> nuevaTabla = new HashMap<>();

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
                    " objetivo, effect_code, vigente FROM pokemon_moves"))
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
        movimientos = Collections.unmodifiableMap(nuevosMovimientos);
        tipos = new TablaTipos(nuevaTabla);

        long vigentes = movimientos.values().stream().filter(MovimientoCatalogo::vigente).count();

        System.out.println("[PokemonEngine] Catalogo en memoria: "
                + especies.size() + " especies, "
                + movimientos.size() + " movimientos (" + vigentes + " vigentes), "
                + nuevaTabla.size() + " combinaciones de tipos.");
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
