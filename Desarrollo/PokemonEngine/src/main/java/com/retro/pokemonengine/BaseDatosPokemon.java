package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.migraciones.M001Base;
import com.retro.pokemonengine.migraciones.M002Catalogo;
import com.retro.pokemonengine.migraciones.M003SinShowdown;
import com.retro.pokemonengine.migraciones.M004Entrenador;
import com.retro.pokemonengine.migraciones.M005TablasHeredadas;
import com.retro.pokemonengine.migraciones.M006Mundo;
import com.retro.pokemonengine.migraciones.Migracion;
import com.retro.pokemonengine.migraciones.PlanMigracion;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Arrays;
import java.util.List;

public final class BaseDatosPokemon
{
    private BaseDatosPokemon()
    {
    }

    private static List<Migracion> migraciones()
    {
        return Arrays.asList(
                new M001Base(),
                new M002Catalogo(),
                new M003SinShowdown(),
                new M004Entrenador(),
                new M005TablasHeredadas(),
                new M006Mundo()
        );
    }

    public static int versionActual(Connection conexion) throws Exception
    {
        try(Statement statement = conexion.createStatement())
        {
            statement.executeUpdate(
                    "CREATE TABLE IF NOT EXISTS pokemon_schema_version (" +
                    "version INT NOT NULL," +
                    "nombre VARCHAR(64) NOT NULL," +
                    "aplicada_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                    "PRIMARY KEY (version)" +
                    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
            );
        }

        try(Statement statement = conexion.createStatement();
            ResultSet resultado = statement.executeQuery(
                    "SELECT COALESCE(MAX(version), 0) FROM pokemon_schema_version"))
        {
            return resultado.next() ? resultado.getInt(1) : 0;
        }
    }

    public static void inicializar() throws Exception
    {
        try(Connection conexion = Emulator.getDatabase().getDataSource().getConnection())
        {
            int actual = versionActual(conexion);

            List<Migracion> pendientes = PlanMigracion.pendientes(actual, migraciones());

            if(pendientes.isEmpty())
            {
                System.out.println("[PokemonEngine] Esquema al día en la versión " + actual + ".");
                return;
            }

            for(Migracion migracion : pendientes)
            {
                migracion.aplicar(conexion);

                try(PreparedStatement statement = conexion.prepareStatement(
                        "INSERT INTO pokemon_schema_version (version, nombre) VALUES (?, ?)"))
                {
                    statement.setInt(1, migracion.version());
                    statement.setString(2, migracion.nombre());
                    statement.executeUpdate();
                }

                System.out.println("[PokemonEngine] Migración "
                        + migracion.version() + " (" + migracion.nombre() + ") aplicada.");
            }
        }
    }
}
