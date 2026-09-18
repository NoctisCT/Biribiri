package com.retro.pokemonengine.migraciones;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;

/**
 * Marca los movimientos para los que el importador no encontró correspondencia
 * en los datos de Showdown, de modo que el verificador pueda listarlos sin que
 * nadie tenga que investigarlo a mano.
 */
public final class M003SinShowdown implements Migracion
{
    @Override
    public int version()
    {
        return 3;
    }

    @Override
    public String nombre()
    {
        return "sin_showdown";
    }

    @Override
    public void aplicar(Connection conexion) throws Exception
    {
        if(columnaExiste(conexion, "pokemon_moves", "sin_showdown")) return;

        try(Statement s = conexion.createStatement())
        {
            s.executeUpdate(
                "ALTER TABLE pokemon_moves " +
                "ADD COLUMN sin_showdown TINYINT(1) NOT NULL DEFAULT 0 AFTER vigente");
        }
    }

    private static boolean columnaExiste(Connection conexion, String tabla, String columna) throws Exception
    {
        try(ResultSet r = conexion.getMetaData().getColumns(
                conexion.getCatalog(), null, tabla, columna))
        {
            return r.next();
        }
    }
}
