package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.seguidor.CatalogoAnimaciones;
import com.retro.pokemonengine.seguidor.EstadoSeguidor;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

/**
 * Deja `pokemon_follower_animations` igual que el catalogo del codigo.
 *
 * Se ejecuta en cada arranque y no en una migracion a proposito. Quitar una
 * animacion es algo que va a pasar (al `Head` de PMD hubo que quitarlo: es la
 * cabeza suelta y parecia un decapitado), y una migracion nueva por cada cambio
 * de esa lista es ruido. Aqui la tabla siempre refleja el catalogo: se insertan
 * las que hay y se borran las que ya no estan.
 */
public final class ServicioAnimacionesSeguidor
{
    private ServicioAnimacionesSeguidor()
    {
    }

    public static void sincronizar() throws Exception
    {
        List<EstadoSeguidor> estados = CatalogoAnimaciones.todos();

        try(Connection c = Emulator.getDatabase().getDataSource().getConnection())
        {
            try(PreparedStatement p = c.prepareStatement(
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
                for(EstadoSeguidor estado : estados)
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

            int borradas = borrarSobrantes(c, estados);

            if(borradas > 0)
            {
                System.out.println("[PokemonEngine] Animaciones del seguidor: "
                        + borradas + " retiradas por no estar ya en el catalogo.");
            }
        }
    }

    private static int borrarSobrantes(Connection c, List<EstadoSeguidor> estados) throws Exception
    {
        if(estados.isEmpty()) return 0;

        List<String> codigos = new ArrayList<>();

        for(EstadoSeguidor estado : estados) codigos.add(estado.codigo());

        StringBuilder sql = new StringBuilder(
                "DELETE FROM pokemon_follower_animations WHERE codigo NOT IN (");

        for(int i = 0; i < codigos.size(); i++)
        {
            if(i > 0) sql.append(',');

            sql.append('?');
        }

        sql.append(')');

        try(PreparedStatement p = c.prepareStatement(sql.toString()))
        {
            for(int i = 0; i < codigos.size(); i++) p.setString(i + 1, codigos.get(i));

            return p.executeUpdate();
        }
    }

    /** Cuantas filas tiene la tabla, para el mensaje de arranque. */
    public static int total() throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            Statement s = c.createStatement();
            var r = s.executeQuery("SELECT COUNT(*) FROM pokemon_follower_animations"))
        {
            return r.next() ? r.getInt(1) : 0;
        }
    }
}
