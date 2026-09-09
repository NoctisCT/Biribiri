package com.retro.rpgengine;

import com.eu.habbo.Emulator;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;

public final class RpgMembershipService
{
    private RpgMembershipService()
    {
    }

    private static Connection connection() throws Exception
    {
        return Emulator.getDatabase().getDataSource().getConnection();
    }

    private static String jsonString(String value)
    {
        if(value == null) return "null";

        StringBuilder out = new StringBuilder();
        out.append('"');

        for(int i = 0; i < value.length(); i++)
        {
            char c = value.charAt(i);

            switch(c)
            {
                case '"': out.append("\\\""); break;
                case '\\': out.append("\\\\"); break;
                case '\b': out.append("\\b"); break;
                case '\f': out.append("\\f"); break;
                case '\n': out.append("\\n"); break;
                case '\r': out.append("\\r"); break;
                case '\t': out.append("\\t"); break;
                default:
                    if(c < 32)
                        out.append(String.format("\\u%04x", (int)c));
                    else
                        out.append(c);
                    break;
            }
        }

        out.append('"');
        return out.toString();
    }

    private static void requireProjectOwner(
            Connection connection,
            int actorUserId,
            int rpgId) throws Exception
    {
        try(PreparedStatement statement = connection.prepareStatement(
                "SELECT owner_user_id FROM rpg_engine_projects " +
                "WHERE id=? AND enabled=1 LIMIT 1"))
        {
            statement.setInt(1, rpgId);

            try(ResultSet result = statement.executeQuery())
            {
                if(!result.next())
                    throw new ServicioRpgEngine.RpgEngineException("rpg-not-found");

                if(result.getInt("owner_user_id") != actorUserId)
                    throw new ServicioRpgEngine.RpgEngineException("rpg-owner-required");
            }
        }
    }

    private static boolean canManageGuild(
            Connection connection,
            int actorUserId,
            int guildId) throws Exception
    {
        try(PreparedStatement statement = connection.prepareStatement(
                "SELECT g.id " +
                "FROM guilds g " +
                "LEFT JOIN guilds_members gm " +
                "ON gm.guild_id=g.id AND gm.user_id=? " +
                "WHERE g.id=? AND (g.user_id=? OR gm.level_id IN (0,1)) " +
                "LIMIT 1"))
        {
            statement.setInt(1, actorUserId);
            statement.setInt(2, guildId);
            statement.setInt(3, actorUserId);

            try(ResultSet result = statement.executeQuery())
            {
                return result.next();
            }
        }
    }

    public static boolean isMember(int rpgId, int userId) throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement = connection.prepareStatement(
                    "SELECT 1 " +
                    "FROM rpg_engine_project_guilds pg " +
                    "INNER JOIN guilds_members gm ON gm.guild_id=pg.guild_id " +
                    "WHERE pg.rpg_id=? AND gm.user_id=? AND gm.level_id IN (0,1,2) " +
                    "LIMIT 1"))
        {
            statement.setInt(1, rpgId);
            statement.setInt(2, userId);

            try(ResultSet result = statement.executeQuery())
            {
                return result.next();
            }
        }
    }

    public static String listAccessibleRpgsJson(int userId) throws Exception
    {
        StringBuilder json = new StringBuilder();
        json.append("{\"rpgs\":[");

        boolean first = true;

        try(Connection connection = connection();
            PreparedStatement statement = connection.prepareStatement(
                    "SELECT p.id,p.name,p.owner_user_id," +
                    "pg.guild_id,g.name AS guild_name,g.badge AS guild_badge," +
                    "gm.level_id AS guild_level " +
                    "FROM rpg_engine_projects p " +
                    "LEFT JOIN rpg_engine_project_guilds pg ON pg.rpg_id=p.id " +
                    "LEFT JOIN guilds g ON g.id=pg.guild_id " +
                    "LEFT JOIN guilds_members gm " +
                    "ON gm.guild_id=pg.guild_id AND gm.user_id=? " +
                    "WHERE p.enabled=1 AND " +
                    "(p.owner_user_id=? OR gm.level_id IN (0,1,2)) " +
                    "ORDER BY p.name ASC,p.id ASC"))
        {
            statement.setInt(1, userId);
            statement.setInt(2, userId);

            try(ResultSet result = statement.executeQuery())
            {
                while(result.next())
                {
                    if(!first) json.append(',');
                    first = false;

                    int ownerUserId = result.getInt("owner_user_id");
                    int guildId = result.getInt("guild_id");
                    boolean guildWasNull = result.wasNull();

                    if(guildWasNull) guildId = 0;

                    int guildLevel = result.getInt("guild_level");
                    boolean guildLevelWasNull = result.wasNull();

                    json.append('{');
                    json.append("\"id\":").append(result.getInt("id")).append(',');
                    json.append("\"name\":").append(jsonString(result.getString("name"))).append(',');
                    json.append("\"ownerUserId\":").append(ownerUserId).append(',');
                    json.append("\"groupId\":").append(guildId).append(',');
                    json.append("\"groupName\":").append(jsonString(result.getString("guild_name"))).append(',');
                    json.append("\"groupBadge\":").append(jsonString(result.getString("guild_badge"))).append(',');
                    json.append("\"groupLevel\":")
                            .append(guildLevelWasNull ? -1 : guildLevel).append(',');
                    json.append("\"canAdmin\":").append(ownerUserId == userId ? "true" : "false").append(',');
                    json.append("\"access\":")
                            .append(jsonString(ownerUserId == userId ? "owner" : "member"));
                    json.append('}');
                }
            }
        }

        json.append("]}");
        return json.toString();
    }

    public static String listManageableGuildsJson(int userId) throws Exception
    {
        StringBuilder json = new StringBuilder();
        json.append("{\"groups\":[");

        boolean first = true;

        try(Connection connection = connection();
            PreparedStatement statement = connection.prepareStatement(
                    "SELECT DISTINCT g.id,g.name,g.badge,g.user_id AS owner_user_id," +
                    "gm.level_id,pg.rpg_id AS linked_rpg_id " +
                    "FROM guilds g " +
                    "LEFT JOIN guilds_members gm " +
                    "ON gm.guild_id=g.id AND gm.user_id=? " +
                    "LEFT JOIN rpg_engine_project_guilds pg ON pg.guild_id=g.id " +
                    "WHERE g.user_id=? OR gm.level_id IN (0,1) " +
                    "ORDER BY g.name ASC,g.id ASC"))
        {
            statement.setInt(1, userId);
            statement.setInt(2, userId);

            try(ResultSet result = statement.executeQuery())
            {
                while(result.next())
                {
                    if(!first) json.append(',');
                    first = false;

                    int linkedRpgId = result.getInt("linked_rpg_id");
                    if(result.wasNull()) linkedRpgId = 0;

                    int level = result.getInt("level_id");
                    if(result.wasNull()) level = -1;

                    json.append('{');
                    json.append("\"id\":").append(result.getInt("id")).append(',');
                    json.append("\"name\":").append(jsonString(result.getString("name"))).append(',');
                    json.append("\"badge\":").append(jsonString(result.getString("badge"))).append(',');
                    json.append("\"ownerUserId\":").append(result.getInt("owner_user_id")).append(',');
                    json.append("\"level\":").append(level).append(',');
                    json.append("\"linkedRpgId\":").append(linkedRpgId);
                    json.append('}');
                }
            }
        }

        json.append("]}");
        return json.toString();
    }

    public static String linkProjectGuildJson(
            int actorUserId,
            int rpgId,
            int guildId) throws Exception
    {
        if(guildId <= 0)
            throw new ServicioRpgEngine.RpgEngineException("invalid-group");

        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                requireProjectOwner(connection, actorUserId, rpgId);

                if(!canManageGuild(connection, actorUserId, guildId))
                    throw new ServicioRpgEngine.RpgEngineException("group-manage-required");

                try(PreparedStatement collision = connection.prepareStatement(
                        "SELECT rpg_id FROM rpg_engine_project_guilds " +
                        "WHERE guild_id=? AND rpg_id<>? LIMIT 1 FOR UPDATE"))
                {
                    collision.setInt(1, guildId);
                    collision.setInt(2, rpgId);

                    try(ResultSet result = collision.executeQuery())
                    {
                        if(result.next())
                            throw new ServicioRpgEngine.RpgEngineException(
                                    "group-already-linked"
                            );
                    }
                }

                try(PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO rpg_engine_project_guilds " +
                        "(rpg_id,guild_id,linked_by_user_id) VALUES (?,?,?) " +
                        "ON DUPLICATE KEY UPDATE " +
                        "guild_id=VALUES(guild_id)," +
                        "linked_by_user_id=VALUES(linked_by_user_id)," +
                        "updated_at=CURRENT_TIMESTAMP"))
                {
                    statement.setInt(1, rpgId);
                    statement.setInt(2, guildId);
                    statement.setInt(3, actorUserId);
                    statement.executeUpdate();
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

        return listAccessibleRpgsJson(actorUserId);
    }

    public static String unlinkProjectGuildJson(
            int actorUserId,
            int rpgId) throws Exception
    {
        try(Connection connection = connection())
        {
            requireProjectOwner(connection, actorUserId, rpgId);

            try(PreparedStatement statement = connection.prepareStatement(
                    "DELETE FROM rpg_engine_project_guilds WHERE rpg_id=?"))
            {
                statement.setInt(1, rpgId);
                statement.executeUpdate();
            }
        }

        return listAccessibleRpgsJson(actorUserId);
    }
}