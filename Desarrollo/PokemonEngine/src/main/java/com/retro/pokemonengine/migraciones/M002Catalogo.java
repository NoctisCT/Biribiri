package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.Statement;

public final class M002Catalogo implements Migracion
{
    @Override
    public int version()
    {
        return 2;
    }

    @Override
    public String nombre()
    {
        return "catalogo";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        try(Statement s = conexion.createStatement())
        {
            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_types (" +
                "id INT NOT NULL," +
                "nombre VARCHAR(20) NOT NULL," +
                "nombre_es VARCHAR(20) NOT NULL," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_pokemon_types_nombre (nombre)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_type_chart (" +
                "atacante_id INT NOT NULL," +
                "defensor_id INT NOT NULL," +
                "multiplicador DECIMAL(3,2) NOT NULL," +
                "PRIMARY KEY (atacante_id, defensor_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_abilities_cat (" +
                "id INT NOT NULL," +
                "nombre VARCHAR(60) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "descripcion_es TEXT NULL," +
                "effect_code VARCHAR(48) NOT NULL DEFAULT 'sin_implementar'," +
                "implemented TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_species (" +
                "id INT NOT NULL," +
                "form_id INT NOT NULL DEFAULT 0," +
                "nombre VARCHAR(60) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "generacion TINYINT UNSIGNED NOT NULL DEFAULT 1," +
                "type_1_id INT NOT NULL," +
                "type_2_id INT NULL," +
                "base_hp SMALLINT UNSIGNED NOT NULL," +
                "base_attack SMALLINT UNSIGNED NOT NULL," +
                "base_defense SMALLINT UNSIGNED NOT NULL," +
                "base_sp_attack SMALLINT UNSIGNED NOT NULL," +
                "base_sp_defense SMALLINT UNSIGNED NOT NULL," +
                "base_speed SMALLINT UNSIGNED NOT NULL," +
                "yield_hp TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_attack TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_defense TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_sp_attack TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_sp_defense TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "yield_speed TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "ability_1_id INT NULL," +
                "ability_2_id INT NULL," +
                "ability_hidden_id INT NULL," +
                "catch_rate SMALLINT UNSIGNED NOT NULL DEFAULT 255," +
                "base_experience SMALLINT UNSIGNED NOT NULL DEFAULT 50," +
                "growth_rate VARCHAR(24) NOT NULL DEFAULT 'medium'," +
                "female_ratio DECIMAL(4,1) NULL," +
                "egg_group_1 VARCHAR(30) NULL," +
                "egg_group_2 VARCHAR(30) NULL," +
                "egg_steps SMALLINT UNSIGNED NOT NULL DEFAULT 5120," +
                "base_friendship TINYINT UNSIGNED NOT NULL DEFAULT 70," +
                "altura DECIMAL(5,2) NOT NULL DEFAULT 0," +
                "peso DECIMAL(6,2) NOT NULL DEFAULT 0," +
                "es_legendario TINYINT(1) NOT NULL DEFAULT 0," +
                "es_singular TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id, form_id)," +
                "KEY idx_pokemon_species_gen (generacion)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_species_evolution (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "origen_id INT NOT NULL," +
                "destino_id INT NOT NULL," +
                "metodo VARCHAR(32) NOT NULL," +
                "parametro VARCHAR(64) NULL," +
                "nivel_minimo TINYINT UNSIGNED NULL," +
                "condicion VARCHAR(128) NULL," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_evolution_origen (origen_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_moves (" +
                "id INT NOT NULL," +
                "nombre VARCHAR(60) NOT NULL," +
                "nombre_es VARCHAR(60) NOT NULL," +
                "type_id INT NOT NULL," +
                "clase VARCHAR(12) NOT NULL," +
                "potencia SMALLINT UNSIGNED NULL," +
                "precision_pct SMALLINT UNSIGNED NULL," +
                "pp TINYINT UNSIGNED NOT NULL DEFAULT 5," +
                "prioridad TINYINT NOT NULL DEFAULT 0," +
                "objetivo VARCHAR(32) NOT NULL," +
                "categoria VARCHAR(32) NOT NULL," +
                "effect_code VARCHAR(48) NOT NULL," +
                "effect_chance SMALLINT UNSIGNED NULL," +
                "dolencia VARCHAR(24) NOT NULL DEFAULT 'none'," +
                "dolencia_chance SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "golpes_min TINYINT UNSIGNED NULL," +
                "golpes_max TINYINT UNSIGNED NULL," +
                "turnos_min TINYINT UNSIGNED NULL," +
                "turnos_max TINYINT UNSIGNED NULL," +
                "drenaje SMALLINT NOT NULL DEFAULT 0," +
                "curacion SMALLINT NOT NULL DEFAULT 0," +
                "ratio_critico TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "retroceso_chance SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "stat_chance SMALLINT UNSIGNED NOT NULL DEFAULT 0," +
                "cambios_stats TEXT NULL," +
                "vigente TINYINT(1) NOT NULL DEFAULT 1," +
                "flags TEXT NULL," +
                "rompe_proteccion TINYINT(1) NOT NULL DEFAULT 0," +
                "ignora_habilidad TINYINT(1) NOT NULL DEFAULT 0," +
                "ignora_defensa TINYINT(1) NOT NULL DEFAULT 0," +
                "ignora_evasion TINYINT(1) NOT NULL DEFAULT 0," +
                "ignora_inmunidad TINYINT(1) NOT NULL DEFAULT 0," +
                "critico_seguro TINYINT(1) NOT NULL DEFAULT 0," +
                "retroceso_dano VARCHAR(16) NULL," +
                "stat_ofensivo_forzado VARCHAR(8) NULL," +
                "stat_defensivo_forzado VARCHAR(8) NULL," +
                "condicion_bando VARCHAR(32) NULL," +
                "condicion_hueco VARCHAR(32) NULL," +
                "estado_volatil VARCHAR(32) NULL," +
                "estado VARCHAR(24) NULL," +
                "clima VARCHAR(24) NULL," +
                "terreno VARCHAR(24) NULL," +
                "duracion TINYINT UNSIGNED NULL," +
                "cambio_forzado TINYINT(1) NOT NULL DEFAULT 0," +
                "autocambio TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (id)," +
                "KEY idx_pokemon_moves_effect (effect_code)," +
                "KEY idx_pokemon_moves_vigente (vigente)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_move_effects (" +
                "effect_code VARCHAR(48) NOT NULL," +
                "descripcion VARCHAR(160) NOT NULL," +
                "implemented TINYINT(1) NOT NULL DEFAULT 0," +
                "PRIMARY KEY (effect_code)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

            s.executeUpdate(
                "CREATE TABLE IF NOT EXISTS pokemon_learnsets (" +
                "species_id INT NOT NULL," +
                "form_id INT NOT NULL DEFAULT 0," +
                "move_id INT NOT NULL," +
                "metodo VARCHAR(24) NOT NULL," +
                "nivel TINYINT UNSIGNED NOT NULL DEFAULT 0," +
                "PRIMARY KEY (species_id, form_id, move_id, metodo, nivel)," +
                "KEY idx_pokemon_learnsets_species (species_id, form_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
        }
    }
}
