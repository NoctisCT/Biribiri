package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.captura.FormulaCaptura;
import com.retro.pokemonengine.entrenador.Bolsillo;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

/**
 * El catalogo de objetos en memoria.
 *
 * Lo llena el importador de PHP (pokemon:import-items) y aqui solo se lee. El
 * multiplicador de ball se guarda multiplicado por diez, que es como lo quiere
 * la formula de captura, y la Master Ball no lleva numero sino marca.
 */
public final class ServicioObjetos
{
    public record Objeto(
            int id,
            String nombre,
            String nombreEs,
            Bolsillo bolsillo,
            int precio,
            int precioVenta,
            boolean esBall,
            int ballRatioX10,
            String effectCode)
    {
        public boolean seVende()
        {
            return this.bolsillo.sePuedeVender() && this.precioVenta > 0;
        }
    }

    public static final String EFECTO_CAPTURA_SEGURA = "ball_captura_segura";

    private static Map<Integer, Objeto> objetos = Collections.emptyMap();

    private ServicioObjetos()
    {
    }

    public static void cargar() throws Exception
    {
        Map<Integer, Objeto> nuevos = new HashMap<>();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            ResultSet r = s.executeQuery(
                    "SELECT id, nombre, nombre_es, bolsillo, precio, precio_venta," +
                    " es_ball, ball_ratio, effect_code FROM pokemon_items"))
        {
            while(r.next())
            {
                String efecto = r.getString("effect_code");
                double ratio = r.getDouble("ball_ratio");
                boolean sinRatio = r.wasNull();

                int ratioX10 = EFECTO_CAPTURA_SEGURA.equals(efecto)
                        ? FormulaCaptura.RATIO_CAPTURA_SEGURA
                        : (sinRatio ? 0 : (int) Math.round(ratio * 10.0));

                nuevos.put(r.getInt("id"), new Objeto(
                        r.getInt("id"),
                        r.getString("nombre"),
                        r.getString("nombre_es"),
                        Bolsillo.porNombre(r.getString("bolsillo")),
                        r.getInt("precio"),
                        r.getInt("precio_venta"),
                        r.getInt("es_ball") == 1,
                        ratioX10,
                        efecto));
            }
        }

        objetos = Collections.unmodifiableMap(nuevos);

        System.out.println("[PokemonEngine] Objetos: " + objetos.size() + " en catalogo.");
    }

    public static Objeto objeto(int id)
    {
        return objetos.get(id);
    }

    public static int total()
    {
        return objetos.size();
    }
}
