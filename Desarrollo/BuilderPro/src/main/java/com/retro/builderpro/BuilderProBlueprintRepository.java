package com.retro.builderpro;

import com.eu.habbo.Emulator;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;

public final class BuilderProBlueprintRepository
{
    private BuilderProBlueprintRepository()
    {
    }

    public static void initialize()
            throws Exception
    {
        String blueprintsSql =
                "CREATE TABLE IF NOT EXISTS builder_pro_blueprints (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "owner_id INT NOT NULL," +
                "name VARCHAR(50) NOT NULL," +
                "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP " +
                "ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_builder_pro_blueprint_owner_name " +
                "(owner_id, name)," +
                "KEY idx_builder_pro_blueprints_owner (owner_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        String itemsSql =
                "CREATE TABLE IF NOT EXISTS builder_pro_blueprint_items (" +
                "blueprint_id INT NOT NULL," +
                "sort_order INT NOT NULL," +
                "base_item_id INT NOT NULL," +
                "base_item_name VARCHAR(255) NOT NULL," +
                "offset_x INT NOT NULL," +
                "offset_y INT NOT NULL," +
                "offset_z DOUBLE NOT NULL," +
                "rotation TINYINT NOT NULL," +
                "extra_data MEDIUMTEXT NOT NULL," +
                "PRIMARY KEY (blueprint_id, sort_order)," +
                "KEY idx_builder_pro_blueprint_items_base " +
                "(base_item_id)," +
                "CONSTRAINT fk_builder_pro_blueprint_items_blueprint " +
                "FOREIGN KEY (blueprint_id) " +
                "REFERENCES builder_pro_blueprints(id) " +
                "ON DELETE CASCADE" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        try(
                Connection connection =
                        connection();

                Statement statement =
                        connection.createStatement()
        )
        {
            statement.executeUpdate(
                    blueprintsSql
            );

            statement.executeUpdate(
                    itemsSql
            );
        }

        System.out.println(
                "[BuilderPro] Persistencia de blueprints preparada."
        );
    }

    public static List<SavedBlueprint> list(
            int ownerId)
            throws Exception
    {
        List<SavedBlueprint> result =
                new ArrayList<SavedBlueprint>();

        try(
                Connection connection =
                        connection();

                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT b.id, b.owner_id, b.name, " +
                                "(SELECT COUNT(*) " +
                                "FROM builder_pro_blueprint_items i " +
                                "WHERE i.blueprint_id = b.id) AS item_count " +
                                "FROM builder_pro_blueprints b " +
                                "WHERE b.owner_id = ? " +
                                "ORDER BY b.updated_at DESC, b.id ASC"
                        )
        )
        {
            statement.setInt(
                    1,
                    ownerId
            );

            try(ResultSet rows =
                    statement.executeQuery())
            {
                while(rows.next())
                {
                    result.add(
                            new SavedBlueprint(
                                    rows.getInt(
                                            "id"
                                    ),
                                    rows.getInt(
                                            "owner_id"
                                    ),
                                    rows.getString(
                                            "name"
                                    ),
                                    rows.getInt(
                                            "item_count"
                                    )
                            )
                    );
                }
            }
        }

        return result;
    }

    public static StoredBlueprint find(
            int ownerId,
            int blueprintId)
            throws Exception
    {
        try(
                Connection connection =
                        connection();

                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT id, owner_id, name " +
                                "FROM builder_pro_blueprints " +
                                "WHERE owner_id = ? AND id = ? " +
                                "LIMIT 1"
                        )
        )
        {
            statement.setInt(
                    1,
                    ownerId
            );

            statement.setInt(
                    2,
                    blueprintId
            );

            try(ResultSet row =
                    statement.executeQuery())
            {
                if(!row.next())
                {
                    return null;
                }

                return new StoredBlueprint(
                        row.getInt(
                                "id"
                        ),
                        row.getInt(
                                "owner_id"
                        ),
                        row.getString(
                                "name"
                        ),
                        loadItems(
                                connection,
                                blueprintId
                        )
                );
            }
        }
    }

    public static int create(
            int ownerId,
            String name,
            List<BlueprintItem> items)
            throws Exception
    {
        try(Connection connection =
                connection())
        {
            connection.setAutoCommit(
                    false
            );

            try
            {
                int blueprintId;

                try(
                        PreparedStatement statement =
                                connection.prepareStatement(
                                        "INSERT INTO builder_pro_blueprints " +
                                        "(owner_id, name) " +
                                        "VALUES (?, ?)",
                                        Statement.RETURN_GENERATED_KEYS
                                )
                )
                {
                    statement.setInt(
                            1,
                            ownerId
                    );

                    statement.setString(
                            2,
                            name
                    );

                    statement.executeUpdate();

                    try(ResultSet keys =
                            statement.getGeneratedKeys())
                    {
                        if(!keys.next())
                        {
                            throw new IllegalStateException(
                                    "No se obtuvo el ID del blueprint."
                            );
                        }

                        blueprintId =
                                keys.getInt(1);
                    }
                }

                insertItems(
                        connection,
                        blueprintId,
                        items
                );

                connection.commit();

                return blueprintId;
            }
            catch(Exception exception)
            {
                connection.rollback();

                throw exception;
            }
        }
    }

    public static boolean rename(
            int ownerId,
            int blueprintId,
            String name)
            throws Exception
    {
        try(
                Connection connection =
                        connection();

                PreparedStatement statement =
                        connection.prepareStatement(
                                "UPDATE builder_pro_blueprints " +
                                "SET name = ? " +
                                "WHERE owner_id = ? AND id = ?"
                        )
        )
        {
            statement.setString(
                    1,
                    name
            );

            statement.setInt(
                    2,
                    ownerId
            );

            statement.setInt(
                    3,
                    blueprintId
            );

            return statement.executeUpdate()
                    == 1;
        }
    }

    public static boolean delete(
            int ownerId,
            int blueprintId)
            throws Exception
    {
        try(
                Connection connection =
                        connection();

                PreparedStatement statement =
                        connection.prepareStatement(
                                "DELETE FROM builder_pro_blueprints " +
                                "WHERE owner_id = ? AND id = ?"
                        )
        )
        {
            statement.setInt(
                    1,
                    ownerId
            );

            statement.setInt(
                    2,
                    blueprintId
            );

            return statement.executeUpdate()
                    == 1;
        }
    }

    public static boolean nameExists(
            int ownerId,
            String name,
            int exceptBlueprintId)
            throws Exception
    {
        try(
                Connection connection =
                        connection();

                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT 1 " +
                                "FROM builder_pro_blueprints " +
                                "WHERE owner_id = ? " +
                                "AND name = ? " +
                                "AND id <> ? " +
                                "LIMIT 1"
                        )
        )
        {
            statement.setInt(
                    1,
                    ownerId
            );

            statement.setString(
                    2,
                    name
            );

            statement.setInt(
                    3,
                    exceptBlueprintId
            );

            try(ResultSet result =
                    statement.executeQuery())
            {
                return result.next();
            }
        }
    }

    public static String nextDefaultName(
            int ownerId)
            throws Exception
    {
        try(
                Connection connection =
                        connection();

                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT 1 " +
                                "FROM builder_pro_blueprints " +
                                "WHERE owner_id = ? AND name = ? " +
                                "LIMIT 1"
                        )
        )
        {
            for(int index = 1;
                    index <= 10000;
                    index++)
            {
                String candidate =
                        "Blueprint " + index;

                statement.setInt(
                        1,
                        ownerId
                );

                statement.setString(
                        2,
                        candidate
                );

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
                "No se pudo generar un nombre de blueprint."
        );
    }

    private static List<BlueprintItem> loadItems(
            Connection connection,
            int blueprintId)
            throws Exception
    {
        List<BlueprintItem> items =
                new ArrayList<BlueprintItem>();

        try(
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT sort_order, base_item_id, " +
                                "base_item_name, offset_x, offset_y, " +
                                "offset_z, rotation, extra_data " +
                                "FROM builder_pro_blueprint_items " +
                                "WHERE blueprint_id = ? " +
                                "ORDER BY sort_order ASC"
                        )
        )
        {
            statement.setInt(
                    1,
                    blueprintId
            );

            try(ResultSet rows =
                    statement.executeQuery())
            {
                while(rows.next())
                {
                    items.add(
                            new BlueprintItem(
                                    rows.getInt(
                                            "base_item_id"
                                    ),
                                    rows.getString(
                                            "base_item_name"
                                    ),
                                    rows.getInt(
                                            "offset_x"
                                    ),
                                    rows.getInt(
                                            "offset_y"
                                    ),
                                    rows.getDouble(
                                            "offset_z"
                                    ),
                                    rows.getInt(
                                            "rotation"
                                    ),
                                    rows.getString(
                                            "extra_data"
                                    )
                            )
                    );
                }
            }
        }

        return items;
    }

    private static void insertItems(
            Connection connection,
            int blueprintId,
            List<BlueprintItem> items)
            throws Exception
    {
        if(items == null
                || items.isEmpty())
        {
            return;
        }

        try(
                PreparedStatement statement =
                        connection.prepareStatement(
                                "INSERT INTO builder_pro_blueprint_items " +
                                "(blueprint_id, sort_order, base_item_id, " +
                                "base_item_name, offset_x, offset_y, " +
                                "offset_z, rotation, extra_data) " +
                                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
                        )
        )
        {
            for(int index = 0;
                    index < items.size();
                    index++)
            {
                BlueprintItem item =
                        items.get(index);

                statement.setInt(
                        1,
                        blueprintId
                );

                statement.setInt(
                        2,
                        index
                );

                statement.setInt(
                        3,
                        item.baseItemId
                );

                statement.setString(
                        4,
                        item.baseItemName
                );

                statement.setInt(
                        5,
                        item.offsetX
                );

                statement.setInt(
                        6,
                        item.offsetY
                );

                statement.setDouble(
                        7,
                        item.offsetZ
                );

                statement.setInt(
                        8,
                        item.rotation
                );

                statement.setString(
                        9,
                        item.extraData
                );

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

    public static final class SavedBlueprint
    {
        public final int id;
        public final int ownerId;
        public final String name;
        public final int itemCount;

        public SavedBlueprint(
                int id,
                int ownerId,
                String name,
                int itemCount)
        {
            this.id = id;
            this.ownerId = ownerId;
            this.name =
                    name == null
                            ? ""
                            : name;
            this.itemCount = itemCount;
        }
    }

    public static final class StoredBlueprint
    {
        public final int id;
        public final int ownerId;
        public final String name;
        public final List<BlueprintItem> items;

        public StoredBlueprint(
                int id,
                int ownerId,
                String name,
                List<BlueprintItem> items)
        {
            this.id = id;
            this.ownerId = ownerId;
            this.name =
                    name == null
                            ? ""
                            : name;
            this.items =
                    new ArrayList<BlueprintItem>(
                            items
                    );
        }
    }

    public static final class BlueprintItem
    {
        public final int baseItemId;
        public final String baseItemName;
        public final int offsetX;
        public final int offsetY;
        public final double offsetZ;
        public final int rotation;
        public final String extraData;

        public BlueprintItem(
                int baseItemId,
                String baseItemName,
                int offsetX,
                int offsetY,
                double offsetZ,
                int rotation,
                String extraData)
        {
            this.baseItemId =
                    baseItemId;

            this.baseItemName =
                    baseItemName == null
                            ? ""
                            : baseItemName;

            this.offsetX =
                    offsetX;

            this.offsetY =
                    offsetY;

            this.offsetZ =
                    offsetZ;

            this.rotation =
                    rotation;

            this.extraData =
                    extraData == null
                            ? ""
                            : extraData;
        }
    }
}
