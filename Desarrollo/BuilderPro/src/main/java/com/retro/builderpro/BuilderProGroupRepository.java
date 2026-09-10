package com.retro.builderpro;

import com.eu.habbo.Emulator;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public final class BuilderProGroupRepository
{
    private BuilderProGroupRepository()
    {
    }

    public static void initialize()
            throws Exception
    {
        String groupsSql =
                "CREATE TABLE IF NOT EXISTS builder_pro_groups (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "room_id INT NOT NULL," +
                "name VARCHAR(40) NOT NULL," +
                "locked TINYINT(1) NOT NULL DEFAULT 0," +
                "created_by INT NOT NULL," +
                "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP " +
                "ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_builder_pro_group_room_name (room_id, name)," +
                "KEY idx_builder_pro_groups_room (room_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        String itemsSql =
                "CREATE TABLE IF NOT EXISTS builder_pro_group_items (" +
                "group_id INT NOT NULL," +
                "item_id INT NOT NULL," +
                "sort_order INT NOT NULL DEFAULT 0," +
                "PRIMARY KEY (group_id, item_id)," +
                "UNIQUE KEY uq_builder_pro_group_item (item_id)," +
                "KEY idx_builder_pro_group_items_order " +
                "(group_id, sort_order)," +
                "CONSTRAINT fk_builder_pro_group_items_group " +
                "FOREIGN KEY (group_id) " +
                "REFERENCES builder_pro_groups(id) " +
                "ON DELETE CASCADE" +
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
            statement.executeUpdate(groupsSql);
            statement.executeUpdate(itemsSql);
        }

        System.out.println(
                "[BuilderPro] Persistencia de grupos preparada."
        );
    }

    public static List<SavedGroup> list(
            int roomId)
            throws Exception
    {
        List<SavedGroup> groups =
                new ArrayList<SavedGroup>();

        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT id, room_id, name, locked, created_by " +
                            "FROM builder_pro_groups " +
                            "WHERE room_id = ? " +
                            "ORDER BY id ASC"
                    ))
        {
            statement.setInt(1, roomId);

            try(ResultSet result = statement.executeQuery())
            {
                while(result.next())
                {
                    int groupId =
                            result.getInt("id");

                    groups.add(
                            new SavedGroup(
                                    groupId,
                                    result.getInt("room_id"),
                                    result.getString("name"),
                                    result.getBoolean("locked"),
                                    result.getInt("created_by"),
                                    loadMembers(
                                            connection,
                                            groupId
                                    )
                            )
                    );
                }
            }
        }

        return groups;
    }

    public static SavedGroup find(
            int roomId,
            int groupId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT id, room_id, name, locked, created_by " +
                            "FROM builder_pro_groups " +
                            "WHERE room_id = ? AND id = ? " +
                            "LIMIT 1"
                    ))
        {
            statement.setInt(1, roomId);
            statement.setInt(2, groupId);

            try(ResultSet result = statement.executeQuery())
            {
                if(!result.next())
                {
                    return null;
                }

                return new SavedGroup(
                        result.getInt("id"),
                        result.getInt("room_id"),
                        result.getString("name"),
                        result.getBoolean("locked"),
                        result.getInt("created_by"),
                        loadMembers(
                                connection,
                                groupId
                        )
                );
            }
        }
    }

    public static Map<Integer, Integer> memberships(
            List<Integer> itemIds)
            throws Exception
    {
        Map<Integer, Integer> memberships =
                new HashMap<Integer, Integer>();

        if(itemIds == null || itemIds.isEmpty())
        {
            return memberships;
        }

        StringBuilder sql =
                new StringBuilder(
                        "SELECT item_id, group_id " +
                        "FROM builder_pro_group_items WHERE item_id IN ("
                );

        for(int index = 0;
                index < itemIds.size();
                index++)
        {
            if(index > 0)
            {
                sql.append(",");
            }

            sql.append("?");
        }

        sql.append(")");

        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            sql.toString()
                    ))
        {
            for(int index = 0;
                    index < itemIds.size();
                    index++)
            {
                statement.setInt(
                        index + 1,
                        itemIds.get(index)
                );
            }

            try(ResultSet result = statement.executeQuery())
            {
                while(result.next())
                {
                    memberships.put(
                            result.getInt("item_id"),
                            result.getInt("group_id")
                    );
                }
            }
        }

        return memberships;
    }

    public static String nextDefaultName(
            int roomId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT 1 FROM builder_pro_groups " +
                            "WHERE room_id = ? AND name = ? LIMIT 1"
                    ))
        {
            for(int index = 1;
                    index <= 10000;
                    index++)
            {
                String candidate =
                        "Grupo " + index;

                statement.setInt(1, roomId);
                statement.setString(2, candidate);

                try(ResultSet result =
                        statement.executeQuery())
                {
                    if(!result.next())
                    {
                        return candidate;
                    }
                }
            }
        }

        throw new IllegalStateException(
                "No se pudo generar un nombre de grupo."
        );
    }

    public static boolean nameExists(
            int roomId,
            String name,
            int exceptGroupId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT 1 FROM builder_pro_groups " +
                            "WHERE room_id = ? AND name = ? AND id <> ? " +
                            "LIMIT 1"
                    ))
        {
            statement.setInt(1, roomId);
            statement.setString(2, name);
            statement.setInt(3, exceptGroupId);

            try(ResultSet result = statement.executeQuery())
            {
                return result.next();
            }
        }
    }

    public static int create(
            int roomId,
            int createdBy,
            String name,
            boolean locked,
            List<Integer> itemIds)
            throws Exception
    {
        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                int groupId;

                try(PreparedStatement statement =
                        connection.prepareStatement(
                                "INSERT INTO builder_pro_groups " +
                                "(room_id, name, locked, created_by) " +
                                "VALUES (?, ?, ?, ?)",
                                Statement.RETURN_GENERATED_KEYS
                        ))
                {
                    statement.setInt(1, roomId);
                    statement.setString(2, name);
                    statement.setBoolean(3, locked);
                    statement.setInt(4, createdBy);

                    statement.executeUpdate();

                    try(ResultSet keys =
                            statement.getGeneratedKeys())
                    {
                        if(!keys.next())
                        {
                            throw new IllegalStateException(
                                    "No se obtuvo el ID del grupo."
                            );
                        }

                        groupId =
                                keys.getInt(1);
                    }
                }

                insertMembers(
                        connection,
                        groupId,
                        itemIds
                );

                connection.commit();

                return groupId;
            }
            catch(Exception exception)
            {
                connection.rollback();
                throw exception;
            }
        }
    }

    public static boolean rename(
            int roomId,
            int groupId,
            String name)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "UPDATE builder_pro_groups " +
                            "SET name = ? " +
                            "WHERE room_id = ? AND id = ?"
                    ))
        {
            statement.setString(1, name);
            statement.setInt(2, roomId);
            statement.setInt(3, groupId);

            return statement.executeUpdate() == 1;
        }
    }

    public static boolean setLocked(
            int roomId,
            int groupId,
            boolean locked)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "UPDATE builder_pro_groups " +
                            "SET locked = ? " +
                            "WHERE room_id = ? AND id = ?"
                    ))
        {
            statement.setBoolean(1, locked);
            statement.setInt(2, roomId);
            statement.setInt(3, groupId);

            return statement.executeUpdate() == 1;
        }
    }

    public static boolean delete(
            int roomId,
            int groupId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "DELETE FROM builder_pro_groups " +
                            "WHERE room_id = ? AND id = ?"
                    ))
        {
            statement.setInt(1, roomId);
            statement.setInt(2, groupId);

            return statement.executeUpdate() == 1;
        }
    }

    public static boolean removeItem(
            int itemId)
            throws Exception
    {
        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                Integer groupId = null;

                try(PreparedStatement find =
                        connection.prepareStatement(
                                "SELECT group_id " +
                                "FROM builder_pro_group_items " +
                                "WHERE item_id = ? LIMIT 1"
                        ))
                {
                    find.setInt(1, itemId);

                    try(ResultSet result =
                            find.executeQuery())
                    {
                        if(result.next())
                        {
                            groupId =
                                    result.getInt(
                                            "group_id"
                                    );
                        }
                    }
                }

                if(groupId == null)
                {
                    connection.rollback();
                    return false;
                }

                try(PreparedStatement deleteItem =
                        connection.prepareStatement(
                                "DELETE FROM builder_pro_group_items " +
                                "WHERE item_id = ?"
                        ))
                {
                    deleteItem.setInt(
                            1,
                            itemId
                    );

                    deleteItem.executeUpdate();
                }

                try(PreparedStatement deleteEmptyGroup =
                        connection.prepareStatement(
                                "DELETE FROM builder_pro_groups " +
                                "WHERE id = ? " +
                                "AND NOT EXISTS (" +
                                "SELECT 1 " +
                                "FROM builder_pro_group_items " +
                                "WHERE group_id = ?" +
                                ")"
                        ))
                {
                    deleteEmptyGroup.setInt(
                            1,
                            groupId.intValue()
                    );

                    deleteEmptyGroup.setInt(
                            2,
                            groupId.intValue()
                    );

                    deleteEmptyGroup.executeUpdate();
                }

                connection.commit();

                return true;
            }
            catch(Exception exception)
            {
                connection.rollback();
                throw exception;
            }
        }
    }

    public static boolean replaceMembers(
            int roomId,
            int groupId,
            List<Integer> itemIds)
            throws Exception
    {
        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                try(PreparedStatement check =
                        connection.prepareStatement(
                                "SELECT id FROM builder_pro_groups " +
                                "WHERE room_id = ? AND id = ? LIMIT 1"
                        ))
                {
                    check.setInt(1, roomId);
                    check.setInt(2, groupId);

                    try(ResultSet result =
                            check.executeQuery())
                    {
                        if(!result.next())
                        {
                            connection.rollback();
                            return false;
                        }
                    }
                }

                try(PreparedStatement delete =
                        connection.prepareStatement(
                                "DELETE FROM builder_pro_group_items " +
                                "WHERE group_id = ?"
                        ))
                {
                    delete.setInt(1, groupId);
                    delete.executeUpdate();
                }

                insertMembers(
                        connection,
                        groupId,
                        itemIds
                );

                connection.commit();

                return true;
            }
            catch(Exception exception)
            {
                connection.rollback();
                throw exception;
            }
        }
    }

    private static List<Integer> loadMembers(
            Connection connection,
            int groupId)
            throws Exception
    {
        List<Integer> itemIds =
                new ArrayList<Integer>();

        try(PreparedStatement statement =
                connection.prepareStatement(
                        "SELECT item_id " +
                        "FROM builder_pro_group_items " +
                        "WHERE group_id = ? " +
                        "ORDER BY sort_order ASC, item_id ASC"
                ))
        {
            statement.setInt(1, groupId);

            try(ResultSet result = statement.executeQuery())
            {
                while(result.next())
                {
                    itemIds.add(
                            result.getInt("item_id")
                    );
                }
            }
        }

        return itemIds;
    }

    private static void insertMembers(
            Connection connection,
            int groupId,
            List<Integer> itemIds)
            throws Exception
    {
        try(PreparedStatement statement =
                connection.prepareStatement(
                        "INSERT INTO builder_pro_group_items " +
                        "(group_id, item_id, sort_order) " +
                        "VALUES (?, ?, ?)"
                ))
        {
            for(int index = 0;
                    index < itemIds.size();
                    index++)
            {
                statement.setInt(1, groupId);
                statement.setInt(2, itemIds.get(index));
                statement.setInt(3, index);
                statement.addBatch();
            }

            statement.executeBatch();
        }
    }

    private static Connection connection()
            throws Exception
    {
        return Emulator.getDatabase()
                .getDataSource()
                .getConnection();
    }

    public static final class SavedGroup
    {
        public final int id;
        public final int roomId;
        public final String name;
        public final boolean locked;
        public final int createdBy;
        public final List<Integer> itemIds;

        public SavedGroup(
                int id,
                int roomId,
                String name,
                boolean locked,
                int createdBy,
                List<Integer> itemIds)
        {
            this.id = id;
            this.roomId = roomId;
            this.name = name;
            this.locked = locked;
            this.createdBy = createdBy;
            this.itemIds =
                    new ArrayList<Integer>(
                            itemIds
                    );
        }
    }
}
