package com.retro.rpgengine;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

public final class RpgProjectRequestService
{
    // V1: temporary administrative gate.
    // Later this can be replaced by a dedicated Biribiri permission without
    // changing the project-request persistence model.
    private static final int ADMIN_MIN_RANK_LEVEL = 6;

    private RpgProjectRequestService()
    {
    }

    private static Connection connection() throws Exception
    {
        return Emulator.getDatabase().getDataSource().getConnection();
    }

    public static boolean isAdmin(Habbo habbo)
    {
        if(habbo == null ||
           habbo.getHabboInfo() == null ||
           habbo.getHabboInfo().getRank() == null)
            return false;

        return habbo.getHabboInfo().getRank().getLevel() >= ADMIN_MIN_RANK_LEVEL;
    }

    private static String cleanName(String raw) throws ServicioRpgEngine.RpgEngineException
    {
        String value = raw == null ? "" : raw.trim();

        if(value.length() < 3 || value.length() > 80)
            throw new ServicioRpgEngine.RpgEngineException("invalid-project-request-name");

        return value;
    }

    private static String cleanReason(String raw) throws ServicioRpgEngine.RpgEngineException
    {
        String value = raw == null ? "" : raw.trim();

        if(value.length() > 500)
            throw new ServicioRpgEngine.RpgEngineException("project-request-reason-too-long");

        return value;
    }

    public static void submit(Habbo habbo, String rawName, String rawReason) throws Exception
    {
        if(habbo == null || habbo.getHabboInfo() == null)
            throw new ServicioRpgEngine.RpgEngineException("invalid-user");

        if(isAdmin(habbo))
            throw new ServicioRpgEngine.RpgEngineException("request-not-required-for-admin");

        int userId = habbo.getHabboInfo().getId();
        String name = cleanName(rawName);
        String reason = cleanReason(rawReason);

        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                try(PreparedStatement check = connection.prepareStatement(
                        "SELECT status FROM rpg_engine_project_requests " +
                        "WHERE user_id=? AND status IN ('pending','approved') " +
                        "ORDER BY id DESC LIMIT 1 FOR UPDATE"))
                {
                    check.setInt(1, userId);

                    try(ResultSet result = check.executeQuery())
                    {
                        if(result.next())
                        {
                            String status = result.getString("status");

                            if("pending".equals(status))
                                throw new ServicioRpgEngine.RpgEngineException("project-request-already-pending");

                            throw new ServicioRpgEngine.RpgEngineException("project-request-already-approved");
                        }
                    }
                }

                try(PreparedStatement insert = connection.prepareStatement(
                        "INSERT INTO rpg_engine_project_requests " +
                        "(user_id, requested_name, reason, status) VALUES (?, ?, ?, 'pending')"))
                {
                    insert.setInt(1, userId);
                    insert.setString(2, name);
                    insert.setString(3, reason);
                    insert.executeUpdate();
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

    public static String status(Habbo habbo) throws Exception
    {
        if(habbo == null || habbo.getHabboInfo() == null)
            throw new ServicioRpgEngine.RpgEngineException("invalid-user");

        if(isAdmin(habbo)) return "request-admin";

        int userId = habbo.getHabboInfo().getId();

        try(Connection connection = connection();
            PreparedStatement statement = connection.prepareStatement(
                    "SELECT status FROM rpg_engine_project_requests " +
                    "WHERE user_id=? ORDER BY id DESC LIMIT 1"))
        {
            statement.setInt(1, userId);

            try(ResultSet result = statement.executeQuery())
            {
                if(!result.next()) return "request-none";

                String status = result.getString("status");

                if("pending".equals(status)) return "request-pending";
                if("approved".equals(status)) return "request-approved";
                if("rejected".equals(status)) return "request-rejected";
                if("consumed".equals(status)) return "request-consumed";

                return "request-none";
            }
        }
    }

    private static void requireAdmin(Habbo habbo) throws ServicioRpgEngine.RpgEngineException
    {
        if(!isAdmin(habbo))
            throw new ServicioRpgEngine.RpgEngineException("rpg-admin-required");
    }

    public static void approve(Habbo reviewer, int targetUserId) throws Exception
    {
        requireAdmin(reviewer);

        if(targetUserId <= 0)
            throw new ServicioRpgEngine.RpgEngineException("invalid-target-user");

        try(Connection connection = connection();
            PreparedStatement statement = connection.prepareStatement(
                    "UPDATE rpg_engine_project_requests " +
                    "SET status='approved', reviewed_by_user_id=?, reviewed_at=CURRENT_TIMESTAMP " +
                    "WHERE user_id=? AND status='pending' " +
                    "ORDER BY id DESC LIMIT 1"))
        {
            statement.setInt(1, reviewer.getHabboInfo().getId());
            statement.setInt(2, targetUserId);

            if(statement.executeUpdate() != 1)
                throw new ServicioRpgEngine.RpgEngineException("pending-project-request-not-found");
        }
    }

    public static void reject(Habbo reviewer, int targetUserId) throws Exception
    {
        requireAdmin(reviewer);

        if(targetUserId <= 0)
            throw new ServicioRpgEngine.RpgEngineException("invalid-target-user");

        try(Connection connection = connection();
            PreparedStatement statement = connection.prepareStatement(
                    "UPDATE rpg_engine_project_requests " +
                    "SET status='rejected', reviewed_by_user_id=?, reviewed_at=CURRENT_TIMESTAMP " +
                    "WHERE user_id=? AND status='pending' " +
                    "ORDER BY id DESC LIMIT 1"))
        {
            statement.setInt(1, reviewer.getHabboInfo().getId());
            statement.setInt(2, targetUserId);

            if(statement.executeUpdate() != 1)
                throw new ServicioRpgEngine.RpgEngineException("pending-project-request-not-found");
        }
    }

    /**
     * Claims exactly one approved application before project creation.
     * Returns 0 for administrators (no application required).
     */
    public static long claimCreateAuthorization(Habbo habbo) throws Exception
    {
        if(habbo == null || habbo.getHabboInfo() == null)
            throw new ServicioRpgEngine.RpgEngineException("invalid-user");

        if(isAdmin(habbo)) return 0L;

        int userId = habbo.getHabboInfo().getId();

        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                long requestId = 0L;

                try(PreparedStatement select = connection.prepareStatement(
                        "SELECT id FROM rpg_engine_project_requests " +
                        "WHERE user_id=? AND status='approved' " +
                        "ORDER BY id DESC LIMIT 1 FOR UPDATE"))
                {
                    select.setInt(1, userId);

                    try(ResultSet result = select.executeQuery())
                    {
                        if(result.next()) requestId = result.getLong("id");
                    }
                }

                if(requestId <= 0L)
                    throw new ServicioRpgEngine.RpgEngineException("project-create-permission-required");

                try(PreparedStatement update = connection.prepareStatement(
                        "UPDATE rpg_engine_project_requests " +
                        "SET status='consumed', consumed_at=CURRENT_TIMESTAMP " +
                        "WHERE id=? AND status='approved'"))
                {
                    update.setLong(1, requestId);

                    if(update.executeUpdate() != 1)
                        throw new ServicioRpgEngine.RpgEngineException("project-create-permission-required");
                }

                connection.commit();
                return requestId;
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

    public static void restoreCreateAuthorization(long requestId) throws Exception
    {
        if(requestId <= 0L) return;

        try(Connection connection = connection();
            PreparedStatement statement = connection.prepareStatement(
                    "UPDATE rpg_engine_project_requests " +
                    "SET status='approved', consumed_at=NULL " +
                    "WHERE id=? AND status='consumed'"))
        {
            statement.setLong(1, requestId);
            statement.executeUpdate();
        }
    }
}