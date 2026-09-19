package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * El mundo con iniciativa propia: disparadores, ratios y clima.
 *
 * Y los cimientos que son baratos ahora y caros cuando haya miles de capturas
 * que migrar: la ficha de Pokedex de las especies, el tamano del sprite, la
 * variante de disfraz y la marca de intercambiable.
 *
 * Las columnas se anaden comprobando antes si existen: ADD COLUMN IF NOT EXISTS
 * no es fiable en todas las versiones de MariaDB que puede haber debajo.
 */
public final class M007Mundo implements Migracion
{
    @Override
    public int version()
    {
        return 7;
    }

    @Override
    public String nombre()
    {
        return "mundo-vivo";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        try(Statement s = conexion.createStatement())
        {
            // Que furni saca Pokemon y de que tipo. El furni es la senal; la
            // autoridad sigue siendo pokemon_zone_rooms.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_encounter_furni (" +
                "sprite_id INT NOT NULL," +
                "metodo VARCHAR(16) NOT NULL DEFAULT 'HIERBA'," +
                "activo TINYINT(1) NOT NULL DEFAULT 1," +
                "nota VARCHAR(80) NULL," +
                "PRIMARY KEY (sprite_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Sin fila, la zona no saca nada: el silencio es el valor por defecto.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_zone_encounter_rates (" +
                "zone_id INT NOT NULL," +
                "metodo VARCHAR(16) NOT NULL," +
                "por_mil SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (zone_id, metodo)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Una zona sin pesos esta siempre despejada, sin codigo especial.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_zone_weather (" +
                "zone_id INT NOT NULL," +
                "clima VARCHAR(16) NOT NULL," +
                "peso SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (zone_id, clima)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // El clima se guarda para que un reinicio no cambie el tiempo.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_zone_weather_state (" +
                "zone_id INT NOT NULL," +
                "clima VARCHAR(16) NOT NULL DEFAULT 'DESPEJADO'," +
                "desde TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "hasta TIMESTAMP NULL DEFAULT NULL," +
                "PRIMARY KEY (zone_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            columna(conexion, s, "pokemon_zone_encounters", "clima", "VARCHAR(16) NULL");

            columna(conexion, s, "pokemon_species", "descripcion_es", "TEXT NULL");
            columna(conexion, s, "pokemon_species", "categoria_es", "VARCHAR(40) NULL");
            columna(conexion, s, "pokemon_species", "numero_regional", "SMALLINT UNSIGNED NULL");
            columna(conexion, s, "pokemon_species", "cry_url", "VARCHAR(255) NULL");
            columna(conexion, s, "pokemon_species", "escala_visual", "VARCHAR(12) NULL");

            columna(conexion, s, "pokemon_owned", "variante", "VARCHAR(24) NOT NULL DEFAULT 'normal'");
            columna(conexion, s, "pokemon_owned", "intercambiable", "TINYINT(1) NOT NULL DEFAULT 1");

            sembrar(s);
        }
    }

    /**
     * La Ruta 1 con su probabilidad y su tiempo. El furni disparador no se
     * siembra: el sprite lo elige el propietario y se da de alta a mano.
     */
    private void sembrar(Statement s) throws Exception
    {
        s.executeUpdate(
            "INSERT IGNORE INTO pokemon_zone_encounter_rates (zone_id, metodo, por_mil)" +
            " SELECT z.id, 'HIERBA', 120 FROM pokemon_zones z WHERE z.codigo = 'ruta-1'");

        s.executeUpdate(
            "INSERT IGNORE INTO pokemon_zone_weather (zone_id, clima, peso)" +
            " SELECT z.id, c.clima, c.peso FROM pokemon_zones z JOIN (" +
            " SELECT 'DESPEJADO' AS clima, 70 AS peso" +
            " UNION ALL SELECT 'LLUVIA', 20" +
            " UNION ALL SELECT 'SOL', 8" +
            " UNION ALL SELECT 'TORMENTA_ARENA', 2) c" +
            " WHERE z.codigo = 'ruta-1'");
    }

    private void columna(Connection c, Statement s, String tabla, String columna, String definicion)
            throws Exception
    {
        try(ResultSet r = c.getMetaData().getColumns(null, null, tabla, columna))
        {
            if(r.next()) return;
        }

        s.executeUpdate("ALTER TABLE " + tabla + " ADD COLUMN " + columna + " " + definicion);
    }
}
