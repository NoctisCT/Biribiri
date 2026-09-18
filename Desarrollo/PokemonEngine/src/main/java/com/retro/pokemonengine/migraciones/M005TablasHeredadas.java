package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * Aparta las tablas del sistema Pokemon viejo en PHP que chocan de nombre.
 *
 * `pokemon_trainers` y `pokemon_items` ya existian con otro esquema, asi que los
 * CREATE TABLE IF NOT EXISTS de la migracion 4 **no hicieron nada** y se quedaron
 * las de PHP. No dio ningun error: por eso esta migracion comprueba columnas y no
 * solo la existencia de la tabla.
 *
 * Las viejas no se borran, se renombran a `_php`. El sistema PHP deja de verlas
 * desde este momento, que es justo lo que se busca: el nuevo lo sustituye. Si
 * hiciera falta volver atras, los datos siguen ahi.
 */
public final class M005TablasHeredadas implements Migracion
{
    @Override
    public int version()
    {
        return 5;
    }

    @Override
    public String nombre()
    {
        return "tablas-heredadas";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        apartar(conexion, "pokemon_trainers", "pokedollars");
        apartar(conexion, "pokemon_items", "bolsillo");

        try(Statement s = conexion.createStatement())
        {
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_trainers (" +
                "user_id INT NOT NULL," +
                "pokedollars BIGINT UNSIGNED NOT NULL DEFAULT 0," +
                "badges_bitmask INT UNSIGNED NOT NULL DEFAULT 0," +
                "zona_actual_id INT NULL," +
                "follower_owned_id BIGINT UNSIGNED NULL," +
                "seguidor_activo TINYINT(1) NOT NULL DEFAULT 1," +
                "dex_vistos SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "dex_capturados SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "season_id INT NOT NULL DEFAULT 1," +
                "jugado_segundos INT UNSIGNED NOT NULL DEFAULT 0," +
                "creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "ultima_conexion TIMESTAMP NULL DEFAULT NULL," +
                "PRIMARY KEY (user_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_items (" +
                "id INT NOT NULL," +
                "nombre VARCHAR(60) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "bolsillo VARCHAR(16) NOT NULL DEFAULT 'OBJETOS'," +
                "precio INT NOT NULL DEFAULT 0," +
                "precio_venta INT NOT NULL DEFAULT 0," +
                "effect_code VARCHAR(48) NOT NULL DEFAULT 'sin_implementar'," +
                "implemented TINYINT(1) NOT NULL DEFAULT 0," +
                "tope_pila SMALLINT UNSIGNED NOT NULL DEFAULT 999," +
                "es_ball TINYINT(1) NOT NULL DEFAULT 0," +
                "ball_ratio DECIMAL(4,2) NULL," +
                "descripcion_es TEXT NULL," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_items_bolsillo (bolsillo)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }

        // El saldo del sistema viejo se conserva: quien tuviera dinero en PHP
        // arranca con el mismo en pokedolares.
        if(existe(conexion, "pokemon_trainers_php") && tieneColumna(conexion, "pokemon_trainers_php", "money"))
        {
            try(Statement s = conexion.createStatement())
            {
                s.executeUpdate(
                        "INSERT INTO pokemon_trainers (user_id, pokedollars)" +
                        " SELECT user_id, GREATEST(0, money) FROM pokemon_trainers_php" +
                        " ON DUPLICATE KEY UPDATE pokedollars = VALUES(pokedollars)");
            }

            System.out.println("[PokemonEngine] Saldos del sistema PHP traidos a pokedolares.");
        }
    }

    /** Renombra la tabla solo si existe y le falta la columna que la delata como vieja. */
    private void apartar(Connection conexion, String tabla, String columnaEsperada) throws Exception
    {
        if(!existe(conexion, tabla)) return;
        if(tieneColumna(conexion, tabla, columnaEsperada)) return;

        String destino = tabla + "_php";

        if(existe(conexion, destino)) destino = destino + "_" + System.currentTimeMillis();

        try(Statement s = conexion.createStatement())
        {
            s.executeUpdate("RENAME TABLE " + tabla + " TO " + destino);
        }

        System.out.println("[PokemonEngine] La tabla heredada " + tabla
                + " se ha apartado como " + destino + ".");
    }

    private boolean existe(Connection conexion, String tabla) throws Exception
    {
        try(PreparedStatement p = conexion.prepareStatement(
                "SELECT COUNT(*) FROM information_schema.TABLES" +
                " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?"))
        {
            p.setString(1, tabla);

            try(ResultSet r = p.executeQuery())
            {
                return r.next() && r.getInt(1) > 0;
            }
        }
    }

    private boolean tieneColumna(Connection conexion, String tabla, String columna) throws Exception
    {
        try(PreparedStatement p = conexion.prepareStatement(
                "SELECT COUNT(*) FROM information_schema.COLUMNS" +
                " WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?"))
        {
            p.setString(1, tabla);
            p.setString(2, columna);

            try(ResultSet r = p.executeQuery())
            {
                return r.next() && r.getInt(1) > 0;
            }
        }
    }
}
