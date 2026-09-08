package com.retro.avatarreactions;

import com.eu.habbo.Emulator;
import com.eu.habbo.messages.ServerMessage;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class ServicioReacciones
{
    public static final int SLOT_COUNT = 12;
    public static final int DISPLAY_BOXED = 0;
    public static final int DISPLAY_FLOATING = 1;
    public static final int DISPLAY_HIDDEN = 2;

    private ServicioReacciones()
    {
    }

    public static final class Reaccion
    {
        public final int id;
        public final String code;
        public final String glyph;
        public final String name;
        public final String source;

        public Reaccion(int id, String code, String glyph, String name, String source)
        {
            this.id = id;
            this.code = code;
            this.glyph = glyph;
            this.name = name;
            this.source = source;
        }
    }

    public static final class Perfil
    {
        public final int displayMode;
        public final List<Integer> quickSlots;
        public final List<Reaccion> owned;

        public Perfil(int displayMode, List<Integer> quickSlots, List<Reaccion> owned)
        {
            this.displayMode = displayMode;
            this.quickSlots = quickSlots;
            this.owned = owned;
        }
    }

    private static Connection db() throws Exception
    {
        return Emulator.getDatabase().getDataSource().getConnection();
    }

    public static Perfil obtenerPerfil(int userId) throws Exception
    {
        try(Connection connection = db())
        {
            List<Reaccion> owned = obtenerPropias(connection, userId);
            List<Integer> slots = obtenerSlots(connection, userId, owned);
            int displayMode = obtenerModo(connection, userId);

            return new Perfil(displayMode, slots, owned);
        }
    }

    private static List<Reaccion> obtenerPropias(Connection connection, int userId) throws Exception
    {
        List<Reaccion> result = new ArrayList<>();

        String sql =
                "SELECT r.id, r.code, r.glyph, r.name, r.source " +
                "FROM biribiri_reactions r " +
                "LEFT JOIN biribiri_user_reactions ur " +
                "ON ur.reaction_id = r.id AND ur.user_id = ? " +
                "WHERE r.enabled = 1 " +
                "AND (r.default_owned = 1 OR ur.user_id IS NOT NULL) " +
                "ORDER BY r.sort_order ASC, r.id ASC";

        try(PreparedStatement statement = connection.prepareStatement(sql))
        {
            statement.setInt(1, userId);

            try(ResultSet rows = statement.executeQuery())
            {
                while(rows.next())
                {
                    result.add(new Reaccion(
                            rows.getInt("id"),
                            rows.getString("code"),
                            rows.getString("glyph"),
                            rows.getString("name"),
                            rows.getString("source")
                    ));
                }
            }
        }

        return result;
    }

    private static List<Integer> obtenerSlots(
            Connection connection,
            int userId,
            List<Reaccion> owned) throws Exception
    {
        List<Integer> result = new ArrayList<>();

        String sql =
                "SELECT slot_index, reaction_id " +
                "FROM biribiri_user_reaction_slots " +
                "WHERE user_id = ? " +
                "ORDER BY slot_index ASC";

        try(PreparedStatement statement = connection.prepareStatement(sql))
        {
            statement.setInt(1, userId);

            try(ResultSet rows = statement.executeQuery())
            {
                while(rows.next())
                {
                    int slot = rows.getInt("slot_index");
                    int reactionId = rows.getInt("reaction_id");

                    if(slot < 0 || slot >= SLOT_COUNT) continue;

                    while(result.size() < slot)
                    {
                        result.add(0);
                    }

                    if(result.size() == slot)
                    {
                        result.add(reactionId);
                    }
                }
            }
        }

        Set<Integer> ownedIds = new HashSet<>();

        for(Reaccion reaction : owned)
        {
            ownedIds.add(reaction.id);
        }

        boolean valid =
                result.size() == SLOT_COUNT &&
                new HashSet<>(result).size() == SLOT_COUNT &&
                ownedIds.containsAll(result) &&
                !result.contains(0);

        if(valid)
        {
            return result;
        }

        // Perfil nuevo/corrupto: los primeros 12 que realmente posee el servidor.
        result.clear();

        for(Reaccion reaction : owned)
        {
            if(result.size() >= SLOT_COUNT) break;
            result.add(reaction.id);
        }

        return result;
    }

    private static int obtenerModo(Connection connection, int userId) throws Exception
    {
        String sql =
                "SELECT display_mode " +
                "FROM biribiri_user_reaction_settings " +
                "WHERE user_id = ? LIMIT 1";

        try(PreparedStatement statement = connection.prepareStatement(sql))
        {
            statement.setInt(1, userId);

            try(ResultSet rows = statement.executeQuery())
            {
                if(rows.next())
                {
                    int mode = rows.getInt("display_mode");

                    if(mode >= DISPLAY_BOXED && mode <= DISPLAY_HIDDEN)
                    {
                        return mode;
                    }
                }
            }
        }

        return DISPLAY_BOXED;
    }

    public static void guardarSlots(int userId, List<Integer> reactionIds) throws Exception
    {
        if(reactionIds == null || reactionIds.size() != SLOT_COUNT)
        {
            throw new IllegalArgumentException("Se requieren exactamente 12 slots");
        }

        Set<Integer> unique = new HashSet<>(reactionIds);

        if(unique.size() != SLOT_COUNT)
        {
            throw new IllegalArgumentException("No se permiten reacciones duplicadas");
        }

        try(Connection connection = db())
        {
            connection.setAutoCommit(false);

            try
            {
                for(Integer reactionId : reactionIds)
                {
                    if(reactionId == null || !poseeReaccion(connection, userId, reactionId))
                    {
                        throw new SecurityException("Reaccion no poseida: " + reactionId);
                    }
                }

                try(PreparedStatement delete = connection.prepareStatement(
                        "DELETE FROM biribiri_user_reaction_slots WHERE user_id = ?"))
                {
                    delete.setInt(1, userId);
                    delete.executeUpdate();
                }

                try(PreparedStatement insert = connection.prepareStatement(
                        "INSERT INTO biribiri_user_reaction_slots " +
                        "(user_id, slot_index, reaction_id) VALUES (?, ?, ?)"))
                {
                    for(int i = 0; i < reactionIds.size(); i++)
                    {
                        insert.setInt(1, userId);
                        insert.setInt(2, i);
                        insert.setInt(3, reactionIds.get(i));
                        insert.addBatch();
                    }

                    insert.executeBatch();
                }

                connection.commit();
            }
            catch(Exception error)
            {
                connection.rollback();
                throw error;
            }
            finally
            {
                connection.setAutoCommit(true);
            }
        }
    }

    public static void guardarModo(int userId, int mode) throws Exception
    {
        if(mode < DISPLAY_BOXED || mode > DISPLAY_HIDDEN)
        {
            throw new IllegalArgumentException("Modo de reacciones invalido");
        }

        try(Connection connection = db();
            PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO biribiri_user_reaction_settings " +
                    "(user_id, display_mode) VALUES (?, ?) " +
                    "ON DUPLICATE KEY UPDATE display_mode = VALUES(display_mode)"))
        {
            statement.setInt(1, userId);
            statement.setInt(2, mode);
            statement.executeUpdate();
        }
    }

    private static boolean poseeReaccion(
            Connection connection,
            int userId,
            int reactionId) throws Exception
    {
        String sql =
                "SELECT 1 " +
                "FROM biribiri_reactions r " +
                "LEFT JOIN biribiri_user_reactions ur " +
                "ON ur.reaction_id = r.id AND ur.user_id = ? " +
                "WHERE r.id = ? AND r.enabled = 1 " +
                "AND (r.default_owned = 1 OR ur.user_id IS NOT NULL) " +
                "LIMIT 1";

        try(PreparedStatement statement = connection.prepareStatement(sql))
        {
            statement.setInt(1, userId);
            statement.setInt(2, reactionId);

            try(ResultSet rows = statement.executeQuery())
            {
                return rows.next();
            }
        }
    }

    public static Reaccion obtenerReaccionUtilizable(
            int userId,
            int reactionId) throws Exception
    {
        Perfil profile = obtenerPerfil(userId);

        boolean equipped = profile.quickSlots.contains(reactionId);

        if(!equipped)
        {
            return null;
        }

        for(Reaccion reaction : profile.owned)
        {
            if(reaction.id == reactionId)
            {
                return reaction;
            }
        }

        return null;
    }

    public static ServerMessage crearMensajePerfil(int userId) throws Exception
    {
        Perfil profile = obtenerPerfil(userId);

        ServerMessage message = new ServerMessage(ReactionPackets.PROFILE);

        message.appendInt(profile.displayMode);

        message.appendInt(profile.quickSlots.size());

        for(Integer reactionId : profile.quickSlots)
        {
            message.appendInt(reactionId);
        }

        message.appendInt(profile.owned.size());

        for(Reaccion reaction : profile.owned)
        {
            message.appendInt(reaction.id);
            message.appendString(reaction.code);
            message.appendString(reaction.glyph);
            message.appendString(reaction.name);
            message.appendString(reaction.source);
        }

        return message;
    }

    /**
     * Punto de integracion para tienda, eventos, pase, logros, etc.
     * El sistema que concede el premio llama a este metodo desde servidor.
     */
    public static void otorgarReaccion(
            int userId,
            int reactionId,
            String source) throws Exception
    {
        if(source == null || source.trim().isEmpty())
        {
            source = "unknown";
        }

        try(Connection connection = db())
        {
            // La reaccion debe existir y estar habilitada.
            try(PreparedStatement check = connection.prepareStatement(
                    "SELECT 1 FROM biribiri_reactions WHERE id = ? AND enabled = 1 LIMIT 1"))
            {
                check.setInt(1, reactionId);

                try(ResultSet rows = check.executeQuery())
                {
                    if(!rows.next())
                    {
                        throw new IllegalArgumentException("Reaccion inexistente o deshabilitada");
                    }
                }
            }

            try(PreparedStatement insert = connection.prepareStatement(
                    "INSERT INTO biribiri_user_reactions " +
                    "(user_id, reaction_id, source) VALUES (?, ?, ?) " +
                    "ON DUPLICATE KEY UPDATE source = VALUES(source)"))
            {
                insert.setInt(1, userId);
                insert.setInt(2, reactionId);
                insert.setString(3, source);
                insert.executeUpdate();
            }
        }
    }
}
