package com.retro.pokemonengine.migraciones;

import com.retro.pokemonengine.seguidor.CatalogoAnimaciones;
import com.retro.pokemonengine.seguidor.EstadoSeguidor;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;

/**
 * El estado permanente del jugador y el gating de salas.
 *
 * Las zonas entran aqui y no en el hito del mundo porque el seguidor necesita
 * saber desde el primer dia en que salas puede existir. El hito 5 anade encuentros,
 * obstaculos, tiendas y arenas sobre estas mismas dos tablas.
 */
public final class M004Entrenador implements Migracion
{
    @Override
    public int version()
    {
        return 4;
    }

    @Override
    public String nombre()
    {
        return "entrenador";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        try(Statement s = conexion.createStatement())
        {
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_seasons (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "codigo VARCHAR(40) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "region_id INT NOT NULL DEFAULT 1," +
                "empieza_en TIMESTAMP NULL DEFAULT NULL," +
                "termina_en TIMESTAMP NULL DEFAULT NULL," +
                "activa TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_pokemon_seasons_codigo (codigo)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "INSERT IGNORE INTO pokemon_seasons (id, codigo, nombre_es, region_id, activa)" +
                " VALUES (1, 'kanto-t1', 'Temporada 1 - Kanto', 1, 1)");

            // El importador de objetos es trabajo del hito 5; la tabla existe ya para
            // que la mochila tenga a donde apuntar.
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
                "CREATE TABLE IF NOT EXISTS pokemon_owned (" +
                "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                "user_id INT NOT NULL," +
                "species_id INT NOT NULL," +
                "form_id INT NOT NULL DEFAULT 0," +
                "mote VARCHAR(24) NULL," +
                "nivel TINYINT UNSIGNED NOT NULL DEFAULT 1," +
                "experiencia INT UNSIGNED NOT NULL DEFAULT 0," +
                "iv_hp TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "iv_ataque TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "iv_defensa TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "iv_ataque_esp TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "iv_defensa_esp TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "iv_velocidad TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "ev_hp SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "ev_ataque SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "ev_defensa SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "ev_ataque_esp SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "ev_defensa_esp SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "ev_velocidad SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "naturaleza VARCHAR(12) NOT NULL DEFAULT 'hardy'," +
                "ability_slot TINYINT UNSIGNED NOT NULL DEFAULT 1," +
                "ability_id INT NULL," +
                "genero TINYINT NOT NULL DEFAULT 0," +
                "es_shiny TINYINT(1) NOT NULL DEFAULT 0," +
                "ps_actual SMALLINT UNSIGNED NOT NULL DEFAULT 1," +
                "estado VARCHAR(16) NOT NULL DEFAULT 'none'," +
                "estado_turnos TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "amistad TINYINT UNSIGNED NOT NULL DEFAULT 70," +
                "pokerus TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "pokerus_dias TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "objeto_id INT NULL," +
                "ball_id INT NOT NULL DEFAULT 4," +
                "met_zone_id INT NULL," +
                "met_level TINYINT UNSIGNED NOT NULL DEFAULT 1," +
                "met_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "original_trainer_user_id INT NOT NULL," +
                "ubicacion VARCHAR(8) NOT NULL DEFAULT 'equipo'," +
                "box_number TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "slot TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "es_favorito TINYINT(1) NOT NULL DEFAULT 0," +
                "es_huevo TINYINT(1) NOT NULL DEFAULT 0," +
                "pasos_huevo SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "parent_a_id BIGINT UNSIGNED NULL," +
                "parent_b_id BIGINT UNSIGNED NULL," +
                "season_id INT NOT NULL DEFAULT 1," +
                "creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_owned_ubicacion (user_id, ubicacion, box_number, slot)," +
                "KEY idx_pokemon_owned_especie (user_id, species_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_owned_moves (" +
                "owned_id BIGINT UNSIGNED NOT NULL," +
                "slot TINYINT UNSIGNED NOT NULL," +
                "move_id INT NOT NULL," +
                "pp_actual TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "pp_up TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (owned_id, slot)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_owned_ribbons (" +
                "owned_id BIGINT UNSIGNED NOT NULL," +
                "ribbon_code VARCHAR(48) NOT NULL," +
                "obtenida_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "PRIMARY KEY (owned_id, ribbon_code)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_boxes (" +
                "user_id INT NOT NULL," +
                "box_number TINYINT UNSIGNED NOT NULL," +
                "nombre VARCHAR(24) NOT NULL," +
                "fondo TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (user_id, box_number)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_bag (" +
                "user_id INT NOT NULL," +
                "item_id INT NOT NULL," +
                "bolsillo VARCHAR(16) NOT NULL DEFAULT 'OBJETOS'," +
                "cantidad SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (user_id, item_id)," +
                "KEY idx_pokemon_bag_bolsillo (user_id, bolsillo)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_dex_entries (" +
                "user_id INT NOT NULL," +
                "species_id INT NOT NULL," +
                "visto TINYINT(1) NOT NULL DEFAULT 0," +
                "capturado TINYINT(1) NOT NULL DEFAULT 0," +
                "shiny_capturado TINYINT(1) NOT NULL DEFAULT 0," +
                "visto_en TIMESTAMP NULL DEFAULT NULL," +
                "capturado_en TIMESTAMP NULL DEFAULT NULL," +
                "PRIMARY KEY (user_id, species_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_currency_log (" +
                "id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT," +
                "user_id INT NOT NULL," +
                "delta BIGINT NOT NULL," +
                "saldo_resultante BIGINT UNSIGNED NOT NULL," +
                "origen VARCHAR(32) NOT NULL," +
                "referencia VARCHAR(64) NULL," +
                "creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_currency_log_usuario (user_id, creado_en)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_zones (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "region_id INT NOT NULL DEFAULT 1," +
                "codigo VARCHAR(40) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "tipo VARCHAR(16) NOT NULL DEFAULT 'ruta'," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_pokemon_zones_codigo (codigo)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            // Esta tabla es el gating: sin fila, la sala no es una sala Pokemon.
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_zone_rooms (" +
                "room_id INT NOT NULL," +
                "zone_id INT NOT NULL," +
                "seguidor_permitido TINYINT(1) NOT NULL DEFAULT 1," +
                "PRIMARY KEY (room_id)," +
                "KEY idx_pokemon_zone_rooms_zona (zone_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_follower_animations (" +
                "codigo VARCHAR(24) NOT NULL," +
                "nombre_es VARCHAR(40) NOT NULL," +
                "animacion_pmd VARCHAR(24) NOT NULL," +
                "animacion_respaldo VARCHAR(24) NOT NULL DEFAULT 'Idle'," +
                "vinculo_habbo VARCHAR(24) NULL," +
                "es_interactivo TINYINT(1) NOT NULL DEFAULT 0," +
                "duracion_ms SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "orden SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (codigo)," +
                "KEY idx_pokemon_follower_animations_interactivo (es_interactivo, orden)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

        }

        sembrarAnimaciones(conexion);
    }

    /**
     * La tabla se siembra desde CatalogoAnimaciones para que el codigo y la base
     * de datos no se puedan separar: si manana cambia una animacion, cambia en un
     * unico sitio y esta migracion la refleja.
     */
    private void sembrarAnimaciones(Connection conexion) throws Exception
    {
        try(PreparedStatement p = conexion.prepareStatement(
                "INSERT INTO pokemon_follower_animations" +
                " (codigo, nombre_es, animacion_pmd, animacion_respaldo, vinculo_habbo," +
                " es_interactivo, duracion_ms, orden) VALUES (?, ?, ?, ?, ?, ?, ?, ?)" +
                " ON DUPLICATE KEY UPDATE" +
                " nombre_es = VALUES(nombre_es)," +
                " animacion_pmd = VALUES(animacion_pmd)," +
                " animacion_respaldo = VALUES(animacion_respaldo)," +
                " vinculo_habbo = VALUES(vinculo_habbo)," +
                " es_interactivo = VALUES(es_interactivo)," +
                " duracion_ms = VALUES(duracion_ms)," +
                " orden = VALUES(orden)"))
        {
            for(EstadoSeguidor estado : CatalogoAnimaciones.todos())
            {
                p.setString(1, estado.codigo());
                p.setString(2, estado.nombreEs());
                p.setString(3, estado.animacion());
                p.setString(4, estado.respaldo());
                p.setString(5, estado.vinculo());
                p.setInt(6, estado.interactivo() ? 1 : 0);
                p.setInt(7, estado.duracionMs());
                p.setInt(8, estado.orden());
                p.addBatch();
            }

            p.executeBatch();
        }
    }
}
