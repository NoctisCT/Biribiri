package com.retro.pokemonengine;

import com.eu.habbo.Emulator;
import com.retro.pokemonengine.entrenador.Economia;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

/**
 * Los pokedolares contra la base de datos.
 *
 * La regla la pone Economia, que es pura; aqui solo se garantiza que leer el
 * saldo, decidir y escribirlo pase en una sola transaccion con la fila bloqueada.
 * Sin eso, dos compras a la vez leerian el mismo saldo y el jugador pagaria una.
 */
public final class ServicioEconomia
{
    private ServicioEconomia()
    {
    }

    public static long saldo(int userId) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement p = c.prepareStatement(
                    "SELECT pokedollars FROM pokemon_trainers WHERE user_id = ?"))
        {
            p.setInt(1, userId);

            try(ResultSet r = p.executeQuery())
            {
                return r.next() ? r.getLong(1) : 0L;
            }
        }
    }

    public static Economia.Movimiento aplicar(
            int userId, long delta, String origen, String referencia) throws Exception
    {
        try(Connection c = Emulator.getDatabase().getDataSource().getConnection())
        {
            boolean autoAntes = c.getAutoCommit();

            c.setAutoCommit(false);

            try
            {
                long saldo = saldoBloqueado(c, userId);
                Economia.Movimiento movimiento = Economia.aplicar(saldo, delta, origen, referencia);

                if(!movimiento.ok())
                {
                    c.rollback();

                    return movimiento;
                }

                escribirSaldo(c, userId, movimiento.saldoResultante());
                registrar(c, userId, movimiento);

                c.commit();

                return movimiento;
            }
            catch(Exception error)
            {
                c.rollback();

                throw error;
            }
            finally
            {
                c.setAutoCommit(autoAntes);
            }
        }
    }

    private static long saldoBloqueado(Connection c, int userId) throws Exception
    {
        try(PreparedStatement p = c.prepareStatement(
                "SELECT pokedollars FROM pokemon_trainers WHERE user_id = ? FOR UPDATE"))
        {
            p.setInt(1, userId);

            try(ResultSet r = p.executeQuery())
            {
                if(r.next()) return r.getLong(1);
            }
        }

        // Un entrenador que aun no existe arranca a cero; se crea aqui mismo para
        // que el bloqueo tenga fila sobre la que actuar.
        try(PreparedStatement p = c.prepareStatement(
                "INSERT IGNORE INTO pokemon_trainers (user_id) VALUES (?)"))
        {
            p.setInt(1, userId);
            p.executeUpdate();
        }

        return 0L;
    }

    private static void escribirSaldo(Connection c, int userId, long saldo) throws Exception
    {
        try(PreparedStatement p = c.prepareStatement(
                "UPDATE pokemon_trainers SET pokedollars = ? WHERE user_id = ?"))
        {
            p.setLong(1, saldo);
            p.setInt(2, userId);
            p.executeUpdate();
        }
    }

    private static void registrar(Connection c, int userId, Economia.Movimiento movimiento)
            throws Exception
    {
        try(PreparedStatement p = c.prepareStatement(
                "INSERT INTO pokemon_currency_log (user_id, delta, saldo_resultante, origen, referencia)" +
                " VALUES (?, ?, ?, ?, ?)"))
        {
            p.setInt(1, userId);
            p.setLong(2, movimiento.delta());
            p.setLong(3, movimiento.saldoResultante());
            p.setString(4, movimiento.origen() == null ? Economia.ORIGEN_ADMIN : movimiento.origen());
            p.setString(5, movimiento.referencia());
            p.executeUpdate();
        }
    }
}
