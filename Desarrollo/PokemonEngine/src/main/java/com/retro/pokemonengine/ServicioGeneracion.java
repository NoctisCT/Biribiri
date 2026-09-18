package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.combate.EspecieCatalogo;
import com.retro.pokemonengine.combate.MovimientoCatalogo;
import com.retro.pokemonengine.entrenador.CatalogoGeneracion;
import com.retro.pokemonengine.entrenador.EspecieGeneracion;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * El catalogo que necesita la creacion de Pokemon: habilidades, genero y aprendizaje.
 *
 * Va aparte de ServicioPokedex a proposito. Aquel carga lo que el combate necesita
 * y nada mas; esto son otras 36.000 filas de learnsets que al motor de turno no le
 * hacen ninguna falta.
 */
public final class ServicioGeneracion implements CatalogoGeneracion
{
    private static final ServicioGeneracion INSTANCIA = new ServicioGeneracion();

    private static Map<Integer, EspecieGeneracion> especies = Collections.emptyMap();
    private static Map<Integer, List<MovimientoAprendido>> aprendizajes = Collections.emptyMap();

    private ServicioGeneracion()
    {
    }

    public static ServicioGeneracion instancia()
    {
        return INSTANCIA;
    }

    public static void cargar() throws Exception
    {
        Map<Integer, EspecieGeneracion> nuevasEspecies = new HashMap<>();
        Map<Integer, List<MovimientoAprendido>> nuevosAprendizajes = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT id, ability_1_id, ability_2_id, ability_hidden_id, female_ratio," +
                    " base_friendship, egg_steps FROM pokemon_species WHERE form_id = 0"))
        {
            while(r.next())
            {
                int id = r.getInt("id");
                EspecieCatalogo base = ServicioPokedex.especie(id);

                if(base == null) continue;

                double ratio = r.getDouble("female_ratio");
                Double ratioReal = r.wasNull() ? null : ratio;

                nuevasEspecies.put(id, new EspecieGeneracion(
                        base,
                        entero(r, "ability_1_id"),
                        entero(r, "ability_2_id"),
                        entero(r, "ability_hidden_id"),
                        ratioReal,
                        r.getInt("base_friendship"),
                        r.getInt("egg_steps")));
            }
        }

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT species_id, move_id, nivel FROM pokemon_learnsets" +
                    " WHERE form_id = 0 AND metodo = 'level-up'"))
        {
            while(r.next())
            {
                nuevosAprendizajes
                        .computeIfAbsent(r.getInt("species_id"), k -> new ArrayList<>())
                        .add(new MovimientoAprendido(r.getInt("move_id"), r.getInt("nivel")));
            }
        }

        for(List<MovimientoAprendido> lista : nuevosAprendizajes.values())
        {
            lista.sort(Comparator
                    .comparingInt(MovimientoAprendido::nivel)
                    .thenComparingInt(MovimientoAprendido::moveId));
        }

        especies = Collections.unmodifiableMap(nuevasEspecies);
        aprendizajes = Collections.unmodifiableMap(nuevosAprendizajes);

        int totalAprendizajes = 0;

        for(List<MovimientoAprendido> lista : aprendizajes.values()) totalAprendizajes += lista.size();

        System.out.println("[PokemonEngine] Generacion: " + especies.size()
                + " especies con habilidades y genero, " + totalAprendizajes
                + " aprendizajes por nivel.");
    }

    private static Integer entero(ResultSet r, String columna) throws Exception
    {
        int valor = r.getInt(columna);

        return r.wasNull() ? null : valor;
    }

    @Override
    public EspecieGeneracion especie(int especieId)
    {
        return especies.get(especieId);
    }

    @Override
    public List<MovimientoAprendido> movimientosPorNivel(int especieId, int nivel)
    {
        List<MovimientoAprendido> todos = aprendizajes.get(especieId);

        if(todos == null) return List.of();

        List<MovimientoAprendido> salida = new ArrayList<>();

        for(MovimientoAprendido uno : todos)
        {
            if(uno.nivel() <= nivel) salida.add(uno);
        }

        return salida;
    }

    @Override
    public int ppBase(int moveId)
    {
        MovimientoCatalogo movimiento = ServicioPokedex.movimiento(moveId);

        return movimiento == null ? 5 : Math.max(1, movimiento.pp());
    }

    public static int totalEspecies()
    {
        return especies.size();
    }
}
