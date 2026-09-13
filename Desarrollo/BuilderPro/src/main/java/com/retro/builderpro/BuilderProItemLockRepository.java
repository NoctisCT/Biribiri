package com.retro.builderpro;

import com.eu.habbo.Emulator;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public final class BuilderProItemLockRepository
{
    private BuilderProItemLockRepository()
    {
    }

    public static void initialize()
            throws Exception
    {
        String sql =
                "CREATE TABLE IF NOT EXISTS builder_pro_item_locks (" +
                "item_id INT NOT NULL," +
                "room_id INT NOT NULL," +
                "created_by INT NOT NULL," +
                "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "PRIMARY KEY (item_id)," +
                "KEY idx_builder_pro_item_locks_room (room_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        try(
                Connection connection =
                        Emulator.getDatabase()
                                .getDataSource()
                                .getConnection();

                Statement statement =
                        connection.createStatement()
        )
        {
            statement.executeUpdate(sql);
        }
    }

    public static List<Integer> list(
            int roomId)
            throws Exception
    {
        List<Integer> result =
                new ArrayList<Integer>();

        try(
                Connection connection =
                        Emulator.getDatabase()
                                .getDataSource()
                                .getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT item_id " +
                                "FROM builder_pro_item_locks " +
                                "WHERE room_id = ? " +
                                "ORDER BY item_id ASC"
                        )
        )
        {
            statement.setInt(1, roomId);

            try(ResultSet set =
                    statement.executeQuery())
            {
                while(set.next())
                {
                    result.add(
                            set.getInt("item_id")
                    );
                }
            }
        }

        return result;
    }

    public static void set(
            int roomId,
            int createdBy,
            List<Integer> itemIds,
            boolean enabled)
            throws Exception
    {
        try(
                Connection connection =
                        Emulator.getDatabase()
                                .getDataSource()
                                .getConnection()
        )
        {
            connection.setAutoCommit(false);

            try
            {
                if(enabled)
                {
                    try(PreparedStatement statement =
                            connection.prepareStatement(
                                    "INSERT INTO builder_pro_item_locks " +
                                    "(item_id, room_id, created_by) " +
                                    "VALUES (?, ?, ?) " +
                                    "ON DUPLICATE KEY UPDATE " +
                                    "room_id = VALUES(room_id), " +
                                    "created_by = VALUES(created_by)"
                            ))
                    {
                        for(Integer itemId : itemIds)
                        {
                            statement.setInt(1, itemId.intValue());
                            statement.setInt(2, roomId);
                            statement.setInt(3, createdBy);
                            statement.addBatch();
                        }

                        statement.executeBatch();
                    }
                }
                else
                {
                    try(PreparedStatement statement =
                            connection.prepareStatement(
                                    "DELETE FROM builder_pro_item_locks " +
                                    "WHERE item_id = ? AND room_id = ?"
                            ))
                    {
                        for(Integer itemId : itemIds)
                        {
                            statement.setInt(1, itemId.intValue());
                            statement.setInt(2, roomId);
                            statement.addBatch();
                        }

                        statement.executeBatch();
                    }
                }

                connection.commit();
            }
            catch(Exception exception)
            {
                connection.rollback();
                throw exception;
            }
        }
    }

    public static boolean removeItem(
            int itemId)
            throws Exception
    {
        try(
                Connection connection =
                        Emulator.getDatabase()
                                .getDataSource()
                                .getConnection();

                PreparedStatement statement =
                        connection.prepareStatement(
                                "DELETE FROM builder_pro_item_locks " +
                                "WHERE item_id = ?"
                        )
        )
        {
            statement.setInt(1, itemId);

            return statement.executeUpdate() > 0;
        }
    }
}
