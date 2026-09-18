package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.Statement;

public final class M001Base implements Migracion
{
    @Override
    public int version()
    {
        return 1;
    }

    @Override
    public String nombre()
    {
        return "base";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
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
    }
}
