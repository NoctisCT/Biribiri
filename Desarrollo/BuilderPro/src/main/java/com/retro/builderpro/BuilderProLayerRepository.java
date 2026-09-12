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

public final class BuilderProLayerRepository
{
    private BuilderProLayerRepository()
    {
    }

    public static void initialize()
            throws Exception
    {
        String layersSql =
                "CREATE TABLE IF NOT EXISTS builder_pro_layers (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "room_id INT NOT NULL," +
                "name VARCHAR(40) NOT NULL," +
                "sort_order INT NOT NULL DEFAULT 0," +
                "created_by INT NOT NULL," +
                "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP " +
                "ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_builder_pro_layer_room_name (room_id, name)," +
                "KEY idx_builder_pro_layers_room_order (room_id, sort_order, id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        String itemsSql =
                "CREATE TABLE IF NOT EXISTS builder_pro_layer_items (" +
                "item_id INT NOT NULL," +
                "layer_id INT NOT NULL," +
                "PRIMARY KEY (item_id)," +
                "KEY idx_builder_pro_layer_items_layer (layer_id, item_id)," +
                "CONSTRAINT fk_builder_pro_layer_items_layer " +
                "FOREIGN KEY (layer_id) " +
                "REFERENCES builder_pro_layers(id) " +
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
            statement.executeUpdate(layersSql);
            statement.executeUpdate(itemsSql);
        }

        System.out.println(
                "[BuilderPro] Persistencia de capas preparada."
        );
    }

    public static List<SavedLayer> list(
            int roomId)
            throws Exception
    {
        List<SavedLayer> layers =
                new ArrayList<SavedLayer>();

        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT id, room_id, name, sort_order, created_by " +
                            "FROM builder_pro_layers " +
                            "WHERE room_id = ? " +
                            "ORDER BY sort_order ASC, id ASC"
                    ))
        {
            statement.setInt(1, roomId);

            try(ResultSet result = statement.executeQuery())
            {
                while(result.next())
                {
                    int layerId =
                            result.getInt("id");

                    layers.add(
                            new SavedLayer(
                                    layerId,
                                    result.getInt("room_id"),
                                    result.getString("name"),
                                    result.getInt("sort_order"),
                                    result.getInt("created_by"),
                                    loadMembers(
                                            connection,
                                            layerId
                                    )
                            )
                    );
                }
            }
        }

        return layers;
    }

    public static SavedLayer find(
            int roomId,
            int layerId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT id, room_id, name, sort_order, created_by " +
                            "FROM builder_pro_layers " +
                            "WHERE room_id = ? AND id = ? LIMIT 1"
                    ))
        {
            statement.setInt(1, roomId);
            statement.setInt(2, layerId);

            try(ResultSet result = statement.executeQuery())
            {
                if(!result.next())
                {
                    return null;
                }

                return new SavedLayer(
                        result.getInt("id"),
                        result.getInt("room_id"),
                        result.getString("name"),
                        result.getInt("sort_order"),
                        result.getInt("created_by"),
                        loadMembers(
                                connection,
                                layerId
                        )
                );
            }
        }
    }

    public static int count(
            int roomId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT COUNT(*) AS amount " +
                            "FROM builder_pro_layers " +
                            "WHERE room_id = ?"
                    ))
        {
            statement.setInt(1, roomId);

            try(ResultSet result = statement.executeQuery())
            {
                if(!result.next())
                {
                    return 0;
                }

                return result.getInt("amount");
            }
        }
    }

    public static String nextDefaultName(
            int roomId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT 1 FROM builder_pro_layers " +
                            "WHERE room_id = ? AND name = ? LIMIT 1"
                    ))
        {
            for(int index = 1;
                    index <= 10000;
                    index++)
            {
                String candidate =
                        "Capa " + index;

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
                "No se pudo generar un nombre de capa."
        );
    }

    public static boolean nameExists(
            int roomId,
            String name,
            int exceptLayerId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT 1 FROM builder_pro_layers " +
                            "WHERE room_id = ? AND name = ? AND id <> ? " +
                            "LIMIT 1"
                    ))
        {
            statement.setInt(1, roomId);
            statement.setString(2, name);
            statement.setInt(3, exceptLayerId);

            try(ResultSet result = statement.executeQuery())
            {
                return result.next();
            }
        }
    }

    public static int nextSortOrder(
            int roomId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order " +
                            "FROM builder_pro_layers WHERE room_id = ?"
                    ))
        {
            statement.setInt(1, roomId);

            try(ResultSet result = statement.executeQuery())
            {
                if(!result.next())
                {
                    return 0;
                }

                return result.getInt("next_order");
            }
        }
    }

    public static int create(
            int roomId,
            int createdBy,
            String name,
            int sortOrder)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "INSERT INTO builder_pro_layers " +
                            "(room_id, name, sort_order, created_by) " +
                            "VALUES (?, ?, ?, ?)",
                            Statement.RETURN_GENERATED_KEYS
                    ))
        {
            statement.setInt(1, roomId);
            statement.setString(2, name);
            statement.setInt(3, sortOrder);
            statement.setInt(4, createdBy);

            statement.executeUpdate();

            try(ResultSet keys =
                    statement.getGeneratedKeys())
            {
                if(!keys.next())
                {
                    throw new IllegalStateException(
                            "No se obtuvo el ID de la capa."
                    );
                }

                return keys.getInt(1);
            }
        }
    }

    public static boolean rename(
            int roomId,
            int layerId,
            String name)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "UPDATE builder_pro_layers " +
                            "SET name = ? " +
                            "WHERE room_id = ? AND id = ?"
                    ))
        {
            statement.setString(1, name);
            statement.setInt(2, roomId);
            statement.setInt(3, layerId);

            return statement.executeUpdate() == 1;
        }
    }

    public static boolean delete(
            int roomId,
            int layerId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "DELETE FROM builder_pro_layers " +
                            "WHERE room_id = ? AND id = ?"
                    ))
        {
            statement.setInt(1, roomId);
            statement.setInt(2, layerId);

            return statement.executeUpdate() == 1;
        }
    }

    public static void assignItems(
            int roomId,
            int layerId,
            List<Integer> itemIds)
            throws Exception
    {
        if(itemIds == null || itemIds.isEmpty())
        {
            return;
        }

        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                try(PreparedStatement check =
                        connection.prepareStatement(
                                "SELECT id FROM builder_pro_layers " +
                                "WHERE room_id = ? AND id = ? LIMIT 1"
                        ))
                {
                    check.setInt(1, roomId);
                    check.setInt(2, layerId);

                    try(ResultSet result =
                            check.executeQuery())
                    {
                        if(!result.next())
                        {
                            throw new IllegalStateException(
                                    "La capa ya no existe."
                            );
                        }
                    }
                }

                try(PreparedStatement assign =
                        connection.prepareStatement(
                                "INSERT INTO builder_pro_layer_items " +
                                "(item_id, layer_id) VALUES (?, ?) " +
                                "ON DUPLICATE KEY UPDATE layer_id = VALUES(layer_id)"
                        ))
                {
                    for(Integer itemId : itemIds)
                    {
                        assign.setInt(1, itemId.intValue());
                        assign.setInt(2, layerId);
                        assign.addBatch();
                    }

                    assign.executeBatch();
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

    public static void unassignItems(
            List<Integer> itemIds)
            throws Exception
    {
        if(itemIds == null || itemIds.isEmpty())
        {
            return;
        }

        StringBuilder sql =
                new StringBuilder(
                        "DELETE FROM builder_pro_layer_items " +
                        "WHERE item_id IN ("
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
                        itemIds.get(index).intValue()
                );
            }

            statement.executeUpdate();
        }
    }

    public static boolean removeItem(
            int itemId)
            throws Exception
    {
        try(Connection connection = connection();
            PreparedStatement statement =
                    connection.prepareStatement(
                            "DELETE FROM builder_pro_layer_items " +
                            "WHERE item_id = ?"
                    ))
        {
            statement.setInt(1, itemId);

            return statement.executeUpdate() > 0;
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
                        "SELECT item_id, layer_id " +
                        "FROM builder_pro_layer_items " +
                        "WHERE item_id IN ("
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
                        itemIds.get(index).intValue()
                );
            }

            try(ResultSet result = statement.executeQuery())
            {
                while(result.next())
                {
                    memberships.put(
                            result.getInt("item_id"),
                            result.getInt("layer_id")
                    );
                }
            }
        }

        return memberships;
    }

    private static List<Integer> loadMembers(
            Connection connection,
            int layerId)
            throws Exception
    {
        List<Integer> itemIds =
                new ArrayList<Integer>();

        try(PreparedStatement statement =
                connection.prepareStatement(
                        "SELECT item_id " +
                        "FROM builder_pro_layer_items " +
                        "WHERE layer_id = ? " +
                        "ORDER BY item_id ASC"
                ))
        {
            statement.setInt(1, layerId);

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

    private static Connection connection()
            throws Exception
    {
        return Emulator.getDatabase()
                .getDataSource()
                .getConnection();
    }

    public static final class SavedLayer
    {
        public final int id;
        public final int roomId;
        public final String name;
        public final int sortOrder;
        public final int createdBy;
        public final List<Integer> itemIds;

        public SavedLayer(
                int id,
                int roomId,
                String name,
                int sortOrder,
                int createdBy,
                List<Integer> itemIds)
        {
            this.id = id;
            this.roomId = roomId;
            this.name = name;
            this.sortOrder = sortOrder;
            this.createdBy = createdBy;
            this.itemIds =
                    new ArrayList<Integer>(
                            itemIds
                    );
        }
    }
}
