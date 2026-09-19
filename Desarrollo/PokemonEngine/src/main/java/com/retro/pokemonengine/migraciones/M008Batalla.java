package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.Statement;

/**
 * Las tablas del combate.
 *
 * El estado vivo del turno no esta aqui: vive en memoria en ServicioBatalla. A
 * disco solo baja `state_snapshot`, que es lo unico que hace falta para que una
 * reconexion devuelva al jugador al combate donde lo dejo.
 *
 * El log es una fila por evento a proposito. Ocupa mas que un JSON por turno,
 * y a cambio se puede contar, filtrar y auditar sin desempaquetar nada.
 */
public final class M008Batalla implements Migracion
{
    @Override
    public int version()
    {
        return 8;
    }

    @Override
    public String nombre()
    {
        return "combate";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        try(Statement s = conexion.createStatement())
        {
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battles (" +
                "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                "tipo VARCHAR(16) NOT NULL DEFAULT 'salvaje'," +
                "formato VARCHAR(24) NOT NULL DEFAULT 'SALVAJE'," +
                "zone_id INT NULL," +
                "room_id INT NULL," +
                "arena_id INT NULL," +
                "season_id INT NOT NULL DEFAULT 1," +
                "estado VARCHAR(16) NOT NULL DEFAULT 'en_curso'," +
                "en_interfaz TINYINT(1) NOT NULL DEFAULT 0," +
                "turno SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "rng_seed BIGINT NOT NULL," +
                "state_snapshot MEDIUMTEXT NULL," +
                "ganador_user_id INT NULL," +
                "motivo_fin VARCHAR(32) NULL," +
                "creada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "terminada_en TIMESTAMP NULL," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_battles_estado (estado)," +
                "KEY idx_pokemon_battles_sala (room_id, estado)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Un bando por fila, y no dos columnas en pokemon_battles: los
            // dobles y los combates multiples de fases futuras no obligan asi
            // a migrar nada.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battle_sides (" +
                "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                "battle_id BIGINT UNSIGNED NOT NULL," +
                "indice TINYINT UNSIGNED NOT NULL," +
                "user_id INT NULL," +
                "es_salvaje TINYINT(1) NOT NULL DEFAULT 0," +
                "owned_id BIGINT UNSIGNED NULL," +
                "species_id INT NOT NULL DEFAULT 0," +
                "nivel TINYINT UNSIGNED NOT NULL DEFAULT 1," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uk_pokemon_battle_side (battle_id, indice)," +
                "KEY idx_pokemon_battle_sides_user (user_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battle_log (" +
                "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                "battle_id BIGINT UNSIGNED NOT NULL," +
                "turno SMALLINT UNSIGNED NOT NULL," +
                "orden SMALLINT UNSIGNED NOT NULL," +
                "tipo VARCHAR(32) NOT NULL," +
                "datos TEXT NULL," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_battle_log_combate (battle_id, turno, orden)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Arenas predefinidas: donde el encuadre importa, lo marca el staff.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battle_arenas (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "zone_id INT NULL," +
                "room_id INT NOT NULL," +
                "nombre VARCHAR(48) NOT NULL DEFAULT ''," +
                "formato VARCHAR(24) NOT NULL DEFAULT 'SALVAJE'," +
                "activo TINYINT(1) NOT NULL DEFAULT 1," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_battle_arenas_sala (room_id, activo)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_battle_arena_slots (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "arena_id INT NOT NULL," +
                "rol VARCHAR(16) NOT NULL," +
                "x SMALLINT NOT NULL," +
                "y SMALLINT NOT NULL," +
                "direccion TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uk_pokemon_arena_rol (arena_id, rol)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }
    }
}
