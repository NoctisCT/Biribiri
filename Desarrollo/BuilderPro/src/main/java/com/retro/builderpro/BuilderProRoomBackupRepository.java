package com.retro.builderpro;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.HabboItem;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public final class BuilderProRoomBackupRepository
{
    private BuilderProRoomBackupRepository()
    {
    }

    public static void initialize()
            throws Exception
    {
        String backupsSql =
                "CREATE TABLE IF NOT EXISTS builder_pro_room_backups (" +
                "id INT NOT NULL AUTO_INCREMENT," +
                "owner_id INT NOT NULL," +
                "original_room_id INT NOT NULL," +
                "active_room_id INT NOT NULL," +
                "room_name VARCHAR(50) NOT NULL," +
                "room_description VARCHAR(250) NOT NULL," +
                "room_model VARCHAR(100) NOT NULL," +
                "users_max INT NOT NULL," +
                "category_id INT NOT NULL," +
                "trade_mode INT NOT NULL," +
                "room_state VARCHAR(16) NOT NULL," +
                "room_password VARCHAR(64) NOT NULL," +
                "floor_paint VARCHAR(255) NOT NULL," +
                "wall_paint VARCHAR(255) NOT NULL," +
                "landscape_paint VARCHAR(255) NOT NULL," +
                "wall_size INT NOT NULL," +
                "wall_height INT NOT NULL," +
                "floor_size INT NOT NULL," +
                "tags VARCHAR(255) NOT NULL," +
                "allow_other_pets TINYINT(1) NOT NULL," +
                "allow_other_pets_eat TINYINT(1) NOT NULL," +
                "allow_walkthrough TINYINT(1) NOT NULL," +
                "allow_hidewall TINYINT(1) NOT NULL," +
                "chat_mode INT NOT NULL," +
                "chat_weight INT NOT NULL," +
                "chat_speed INT NOT NULL," +
                "chat_distance INT NOT NULL," +
                "chat_protection INT NOT NULL," +
                "mute_option INT NOT NULL," +
                "kick_option INT NOT NULL," +
                "ban_option INT NOT NULL," +
                "roller_speed INT NOT NULL," +
                "move_diagonally TINYINT(1) NOT NULL," +
                "hide_wired TINYINT(1) NOT NULL," +
                "custom_layout TINYINT(1) NOT NULL DEFAULT 0," +
                "custom_door_x INT NOT NULL DEFAULT 0," +
                "custom_door_y INT NOT NULL DEFAULT 0," +
                "custom_door_dir INT NOT NULL DEFAULT 0," +
                "custom_heightmap MEDIUMTEXT NOT NULL," +
                "pin_salt VARCHAR(128) NOT NULL," +
                "pin_hash VARCHAR(255) NOT NULL," +
                "pin_iterations INT NOT NULL," +
                "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP " +
                "ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (id)," +
                "UNIQUE KEY uq_builder_pro_room_backup_original " +
                "(owner_id, original_room_id)," +
                "UNIQUE KEY uq_builder_pro_room_backup_active " +
                "(owner_id, active_room_id)," +
                "KEY idx_builder_pro_room_backups_owner (owner_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        String itemsSql =
                "CREATE TABLE IF NOT EXISTS builder_pro_room_backup_items (" +
                "backup_id INT NOT NULL," +
                "item_id INT NOT NULL," +
                "base_item_id INT NOT NULL," +
                "furniture_type CHAR(1) NOT NULL," +
                "x SMALLINT NOT NULL," +
                "y SMALLINT NOT NULL," +
                "z DOUBLE NOT NULL," +
                "rotation TINYINT NOT NULL," +
                "wall_position VARCHAR(255) NOT NULL," +
                "extra_data MEDIUMTEXT NOT NULL," +
                "PRIMARY KEY (backup_id, item_id)," +
                "CONSTRAINT fk_builder_pro_room_backup_items_backup " +
                "FOREIGN KEY (backup_id) " +
                "REFERENCES builder_pro_room_backups(id) " +
                "ON DELETE CASCADE" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4";

        try(
                Connection connection = connection();
                Statement statement = connection.createStatement()
        )
        {
            statement.executeUpdate(backupsSql);
            statement.executeUpdate(itemsSql);
        }

        System.out.println(
                "[BuilderPro] Persistencia de backups de sala preparada."
        );
    }

    public static Snapshot capture(
            Room room,
            int ownerId)
            throws Exception
    {
        if(room == null)
        {
            throw new IllegalArgumentException("Sala no disponible.");
        }

        String model = "";

        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT model FROM rooms WHERE id = ? LIMIT 1"
                        )
        )
        {
            statement.setInt(1, room.getId());

            try(ResultSet row = statement.executeQuery())
            {
                if(row.next())
                {
                    model = safe(row.getString("model"));
                }
            }
        }

        boolean customLayout = room.hasCustomLayout();
        int customDoorX = 0;
        int customDoorY = 0;
        int customDoorDir = 0;
        String customHeightmap = "";

        if(customLayout && room.getLayout() != null)
        {
            customDoorX = room.getLayout().getDoorX();
            customDoorY = room.getLayout().getDoorY();
            customDoorDir = room.getLayout().getDoorDirection();
            customHeightmap = safe(room.getLayout().getHeightmap());
        }

        return new Snapshot(
                room.getId(),
                safe(room.getName()),
                safe(room.getDescription()),
                model,
                room.getUsersMax(),
                room.getCategory(),
                room.getTradeMode(),
                room.getState().name().toLowerCase(),
                safe(room.getPassword()),
                safe(room.getFloorPaint()),
                safe(room.getWallPaint()),
                safe(room.getBackgroundPaint()),
                room.getWallSize(),
                room.getWallHeight(),
                room.getFloorSize(),
                safe(room.getTags()),
                room.isAllowPets(),
                room.isAllowPetsEat(),
                room.isAllowWalkthrough(),
                room.isHideWall(),
                room.getChatMode(),
                room.getChatWeight(),
                room.getChatSpeed(),
                room.getChatDistance(),
                room.getChatProtection(),
                room.getMuteOption(),
                room.getKickOption(),
                room.getBanOption(),
                room.getRollerSpeed(),
                room.moveDiagonally(),
                room.isHideWired(),
                customLayout,
                customDoorX,
                customDoorY,
                customDoorDir,
                customHeightmap,
                captureOwnerItems(room, ownerId)
        );
    }

    public static List<BackupItem> captureOwnerItems(
            Room room,
            int ownerId)
            throws Exception
    {
        List<BackupItem> result =
                new ArrayList<BackupItem>();

        Set<Integer> seen =
                new HashSet<Integer>();

        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT id, room_id, item_id, x, y, z, rot, " +
                                "wall_pos, extra_data " +
                                "FROM items WHERE user_id = ? ORDER BY id ASC"
                        )
        )
        {
            statement.setInt(1, ownerId);

            try(ResultSet rows = statement.executeQuery())
            {
                while(rows.next())
                {
                    int itemId = rows.getInt("id");

                    HabboItem live =
                            room.getHabboItem(itemId);

                    if(live != null
                            && live.getUserId() == ownerId
                            && live.getRoomId() == room.getId())
                    {
                        BackupItem captured = fromLive(live);

                        if(captured != null)
                        {
                            result.add(captured);
                            seen.add(itemId);
                        }

                        continue;
                    }

                    if(rows.getInt("room_id") != room.getId()
                            || seen.contains(itemId))
                    {
                        continue;
                    }

                    int baseItemId = rows.getInt("item_id");

                    Item base =
                            Emulator.getGameEnvironment()
                                    .getItemManager()
                                    .getItem(baseItemId);

                    if(base == null)
                    {
                        continue;
                    }

                    String type = base.getType().code;

                    if(!"S".equals(type)
                            && !"I".equals(type))
                    {
                        continue;
                    }

                    result.add(
                            new BackupItem(
                                    itemId,
                                    baseItemId,
                                    type,
                                    rows.getShort("x"),
                                    rows.getShort("y"),
                                    rows.getDouble("z"),
                                    normalizeRotation(rows.getInt("rot")),
                                    safe(rows.getString("wall_pos")),
                                    safe(rows.getString("extra_data"))
                            )
                    );

                    seen.add(itemId);
                }
            }
        }

        return result;
    }

    private static BackupItem fromLive(
            HabboItem item)
    {
        if(item == null || item.getBaseItem() == null)
        {
            return null;
        }

        FurnitureType type = item.getBaseItem().getType();

        if(type != FurnitureType.FLOOR
                && type != FurnitureType.WALL)
        {
            return null;
        }

        return new BackupItem(
                item.getId(),
                item.getBaseItem().getId(),
                type.code,
                item.getX(),
                item.getY(),
                item.getZ(),
                normalizeRotation(item.getRotation()),
                safe(item.getWallPosition()),
                safe(item.getExtradata())
        );
    }

    public static int create(
            int ownerId,
            Snapshot snapshot,
            BuilderProRoomBackupSecurity.Credentials credentials)
            throws Exception
    {
        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                int backupId;

                try(
                        PreparedStatement statement =
                                connection.prepareStatement(
                                        insertBackupSql(),
                                        Statement.RETURN_GENERATED_KEYS
                                )
                )
                {
                    bindSnapshot(
                            statement,
                            ownerId,
                            snapshot.roomId,
                            snapshot.roomId,
                            snapshot,
                            credentials.salt,
                            credentials.hash,
                            credentials.iterations
                    );

                    statement.executeUpdate();

                    try(ResultSet keys = statement.getGeneratedKeys())
                    {
                        if(!keys.next())
                        {
                            throw new IllegalStateException(
                                    "No se obtuvo el ID del backup."
                            );
                        }

                        backupId = keys.getInt(1);
                    }
                }

                insertItems(
                        connection,
                        backupId,
                        snapshot.items
                );

                connection.commit();

                return backupId;
            }
            catch(Exception exception)
            {
                connection.rollback();
                throw exception;
            }
        }
    }

    public static void replaceSnapshot(
            int ownerId,
            int backupId,
            Snapshot snapshot)
            throws Exception
    {
        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                try(
                        PreparedStatement statement =
                                connection.prepareStatement(
                                        "UPDATE builder_pro_room_backups SET " +
                                        "active_room_id = ?, " +
                                        shellUpdateSql() +
                                        " WHERE id = ? AND owner_id = ?"
                                )
                )
                {
                    int index = 1;
                    statement.setInt(index++, snapshot.roomId);
                    index = bindShell(statement, index, snapshot);
                    statement.setInt(index++, backupId);
                    statement.setInt(index, ownerId);

                    if(statement.executeUpdate() != 1)
                    {
                        throw new IllegalStateException(
                                "Backup no encontrado."
                        );
                    }
                }

                try(
                        PreparedStatement statement =
                                connection.prepareStatement(
                                        "DELETE FROM builder_pro_room_backup_items " +
                                        "WHERE backup_id = ?"
                                )
                )
                {
                    statement.setInt(1, backupId);
                    statement.executeUpdate();
                }

                insertItems(
                        connection,
                        backupId,
                        snapshot.items
                );

                connection.commit();
            }
            catch(Exception exception)
            {
                connection.rollback();
                throw exception;
            }
        }
    }

    public static List<Summary> list(
            int ownerId)
            throws Exception
    {
        List<Summary> result =
                new ArrayList<Summary>();

        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT b.id, b.original_room_id, " +
                                "b.active_room_id, b.room_name, b.updated_at, " +
                                "(SELECT COUNT(*) " +
                                " FROM builder_pro_room_backup_items i " +
                                " WHERE i.backup_id = b.id) AS item_count, " +
                                "EXISTS(SELECT 1 FROM rooms r " +
                                " WHERE r.id = b.active_room_id " +
                                " AND r.owner_id = b.owner_id) AS room_exists " +
                                "FROM builder_pro_room_backups b " +
                                "WHERE b.owner_id = ? " +
                                "ORDER BY b.updated_at DESC, b.id ASC"
                        )
        )
        {
            statement.setInt(1, ownerId);

            try(ResultSet rows = statement.executeQuery())
            {
                while(rows.next())
                {
                    Timestamp updated = rows.getTimestamp("updated_at");

                    result.add(
                            new Summary(
                                    rows.getInt("id"),
                                    rows.getInt("original_room_id"),
                                    rows.getInt("active_room_id"),
                                    safe(rows.getString("room_name")),
                                    rows.getInt("item_count"),
                                    updated == null
                                            ? ""
                                            : updated.toString(),
                                    rows.getBoolean("room_exists")
                            )
                    );
                }
            }
        }

        return result;
    }

    public static StoredBackup find(
            int ownerId,
            int backupId)
            throws Exception
    {
        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT * FROM builder_pro_room_backups " +
                                "WHERE owner_id = ? AND id = ? LIMIT 1"
                        )
        )
        {
            statement.setInt(1, ownerId);
            statement.setInt(2, backupId);

            try(ResultSet row = statement.executeQuery())
            {
                if(!row.next())
                {
                    return null;
                }

                return readStored(connection, row);
            }
        }
    }

    public static StoredBackup findByActiveRoom(
            int ownerId,
            int roomId)
            throws Exception
    {
        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT * FROM builder_pro_room_backups " +
                                "WHERE owner_id = ? AND active_room_id = ? " +
                                "LIMIT 1"
                        )
        )
        {
            statement.setInt(1, ownerId);
            statement.setInt(2, roomId);

            try(ResultSet row = statement.executeQuery())
            {
                if(!row.next())
                {
                    return null;
                }

                return readStored(connection, row);
            }
        }
    }

    public static void updatePin(
            int ownerId,
            int backupId,
            BuilderProRoomBackupSecurity.Credentials credentials)
            throws Exception
    {
        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "UPDATE builder_pro_room_backups SET " +
                                "pin_salt = ?, pin_hash = ?, pin_iterations = ? " +
                                "WHERE id = ? AND owner_id = ?"
                        )
        )
        {
            statement.setString(1, credentials.salt);
            statement.setString(2, credentials.hash);
            statement.setInt(3, credentials.iterations);
            statement.setInt(4, backupId);
            statement.setInt(5, ownerId);

            if(statement.executeUpdate() != 1)
            {
                throw new IllegalStateException(
                        "Backup no encontrado."
                );
            }
        }
    }

    public static void updateActiveRoom(
            int ownerId,
            int backupId,
            int activeRoomId)
            throws Exception
    {
        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "UPDATE builder_pro_room_backups " +
                                "SET active_room_id = ? " +
                                "WHERE id = ? AND owner_id = ?"
                        )
        )
        {
            statement.setInt(1, activeRoomId);
            statement.setInt(2, backupId);
            statement.setInt(3, ownerId);

            if(statement.executeUpdate() != 1)
            {
                throw new IllegalStateException(
                        "Backup no encontrado."
                );
            }
        }
    }

    public static boolean delete(
            int ownerId,
            int backupId)
            throws Exception
    {
        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "DELETE FROM builder_pro_room_backups " +
                                "WHERE id = ? AND owner_id = ?"
                        )
        )
        {
            statement.setInt(1, backupId);
            statement.setInt(2, ownerId);

            return statement.executeUpdate() == 1;
        }
    }

    public static boolean roomExistsOwned(
            int roomId,
            int ownerId)
            throws Exception
    {
        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT 1 FROM rooms " +
                                "WHERE id = ? AND owner_id = ? LIMIT 1"
                        )
        )
        {
            statement.setInt(1, roomId);
            statement.setInt(2, ownerId);

            try(ResultSet row = statement.executeQuery())
            {
                return row.next();
            }
        }
    }

    public static boolean foreignWallAt(
            int roomId,
            int ownerId,
            String wallPosition)
            throws Exception
    {
        if(wallPosition == null || wallPosition.isEmpty())
        {
            return false;
        }

        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT 1 FROM items " +
                                "WHERE room_id = ? AND user_id <> ? " +
                                "AND wall_pos = ? LIMIT 1"
                        )
        )
        {
            statement.setInt(1, roomId);
            statement.setInt(2, ownerId);
            statement.setString(3, wallPosition);

            try(ResultSet row = statement.executeQuery())
            {
                return row.next();
            }
        }
    }

    public static void setRoomLayoutMode(
            int roomId,
            String model,
            boolean customLayout)
            throws Exception
    {
        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                try(
                        PreparedStatement statement =
                                connection.prepareStatement(
                                        "UPDATE rooms SET model = ?, override_model = ? " +
                                        "WHERE id = ?"
                                )
                )
                {
                    statement.setString(1, model);
                    statement.setString(
                            2,
                            customLayout ? "1" : "0"
                    );
                    statement.setInt(3, roomId);

                    if(statement.executeUpdate() != 1)
                    {
                        throw new IllegalStateException(
                                "No se pudo actualizar el layout de la sala."
                        );
                    }
                }

                if(!customLayout)
                {
                    try(
                            PreparedStatement statement =
                                    connection.prepareStatement(
                                            "DELETE FROM room_models_custom WHERE id = ?"
                                    )
                    )
                    {
                        statement.setInt(1, roomId);
                        statement.executeUpdate();
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

    public static int createRoomFromBackup(
            int ownerId,
            String ownerName,
            StoredBackup backup)
            throws Exception
    {
        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try
            {
                int roomId;

                try(
                        PreparedStatement statement =
                                connection.prepareStatement(
                                        "INSERT INTO rooms " +
                                        "(owner_id, owner_name, name, description, " +
                                        "model, users_max, category, trade_mode) " +
                                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                                        Statement.RETURN_GENERATED_KEYS
                                )
                )
                {
                    statement.setInt(1, ownerId);
                    statement.setString(2, ownerName);
                    statement.setString(3, backup.roomName);
                    statement.setString(4, backup.roomDescription);
                    statement.setString(5, backup.roomModel);
                    statement.setInt(6, backup.usersMax);
                    statement.setInt(7, backup.categoryId);
                    statement.setInt(8, backup.tradeMode);
                    statement.executeUpdate();

                    try(ResultSet keys = statement.getGeneratedKeys())
                    {
                        if(!keys.next())
                        {
                            throw new IllegalStateException(
                                    "No se pudo crear la sala restaurada."
                            );
                        }

                        roomId = keys.getInt(1);
                    }
                }

                String model = backup.roomModel;

                if(backup.customLayout)
                {
                    model = "custom_" + roomId;

                    try(
                            PreparedStatement statement =
                                    connection.prepareStatement(
                                            "INSERT INTO room_models_custom " +
                                            "(id, name, door_x, door_y, door_dir, heightmap) " +
                                            "VALUES (?, ?, ?, ?, ?, ?)"
                                    )
                    )
                    {
                        statement.setInt(1, roomId);
                        statement.setString(2, model);
                        statement.setInt(3, backup.customDoorX);
                        statement.setInt(4, backup.customDoorY);
                        statement.setInt(5, backup.customDoorDir);
                        statement.setString(6, backup.customHeightmap);
                        statement.executeUpdate();
                    }
                }

                try(
                        PreparedStatement statement =
                                connection.prepareStatement(
                                        "UPDATE rooms SET " +
                                        "model = ?, password = ?, state = ?, " +
                                        "paper_floor = ?, paper_wall = ?, " +
                                        "paper_landscape = ?, thickness_wall = ?, " +
                                        "wall_height = ?, thickness_floor = ?, tags = ?, " +
                                        "allow_other_pets = ?, allow_other_pets_eat = ?, " +
                                        "allow_walkthrough = ?, allow_hidewall = ?, " +
                                        "chat_mode = ?, chat_weight = ?, chat_speed = ?, " +
                                        "chat_hearing_distance = ?, chat_protection = ?, " +
                                        "who_can_mute = ?, who_can_kick = ?, who_can_ban = ?, " +
                                        "roller_speed = ?, move_diagonally = ?, " +
                                        "override_model = ?, hidewired = ? " +
                                        "WHERE id = ?"
                                )
                )
                {
                    int index = 1;
                    statement.setString(index++, model);
                    statement.setString(index++, backup.roomPassword);
                    statement.setString(index++, backup.roomState);
                    statement.setString(index++, backup.floorPaint);
                    statement.setString(index++, backup.wallPaint);
                    statement.setString(index++, backup.landscapePaint);
                    statement.setInt(index++, backup.wallSize);
                    statement.setInt(index++, backup.wallHeight);
                    statement.setInt(index++, backup.floorSize);
                    statement.setString(index++, backup.tags);
                    statement.setString(
                            index++,
                            backup.allowOtherPets ? "1" : "0"
                    );
                    statement.setString(
                            index++,
                            backup.allowOtherPetsEat ? "1" : "0"
                    );
                    statement.setString(
                            index++,
                            backup.allowWalkthrough ? "1" : "0"
                    );
                    statement.setString(
                            index++,
                            backup.allowHideWall ? "1" : "0"
                    );
                    statement.setInt(index++, backup.chatMode);
                    statement.setInt(index++, backup.chatWeight);
                    statement.setInt(index++, backup.chatSpeed);
                    statement.setInt(index++, backup.chatDistance);
                    statement.setInt(index++, backup.chatProtection);
                    statement.setInt(index++, backup.muteOption);
                    statement.setInt(index++, backup.kickOption);
                    statement.setInt(index++, backup.banOption);
                    statement.setInt(index++, backup.rollerSpeed);
                    statement.setString(
                            index++,
                            backup.moveDiagonally ? "1" : "0"
                    );
                    statement.setString(
                            index++,
                            backup.customLayout ? "1" : "0"
                    );
                    statement.setString(
                            index++,
                            backup.hideWired ? "1" : "0"
                    );
                    statement.setInt(index, roomId);
                    statement.executeUpdate();
                }

                connection.commit();
                return roomId;
            }
            catch(Exception exception)
            {
                connection.rollback();
                throw exception;
            }
        }
    }

    public static void assignBackupItemsToRoom(
            int ownerId,
            int roomId,
            List<BackupItem> items)
            throws Exception
    {
        try(Connection connection = connection())
        {
            connection.setAutoCommit(false);

            try(
                    PreparedStatement statement =
                            connection.prepareStatement(
                                    "UPDATE items SET " +
                                    "room_id = ?, x = ?, y = ?, z = ?, rot = ?, " +
                                    "wall_pos = ?, extra_data = ? " +
                                    "WHERE id = ? AND user_id = ? " +
                                    "AND room_id = 0 AND item_id = ?"
                            )
            )
            {
                for(BackupItem state : items)
                {
                    int index = 1;
                    statement.setInt(index++, roomId);
                    statement.setShort(index++, state.x);
                    statement.setShort(index++, state.y);
                    statement.setDouble(index++, state.z);
                    statement.setInt(index++, state.rotation);
                    statement.setString(index++, state.wallPosition);
                    statement.setString(index++, state.extraData);
                    statement.setInt(index++, state.itemId);
                    statement.setInt(index++, ownerId);
                    statement.setInt(index, state.baseItemId);

                    if(statement.executeUpdate() != 1)
                    {
                        throw new IllegalStateException(
                                "No se pudo reasignar el furni #"
                                        + state.itemId
                                        + " a la sala recreada."
                        );
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

    public static void releaseRestoredRoomItems(
            int ownerId,
            int roomId)
            throws Exception
    {
        try(
                Connection connection = connection();
                PreparedStatement statement =
                        connection.prepareStatement(
                                "UPDATE items SET room_id = 0 " +
                                "WHERE room_id = ? AND user_id = ?"
                        )
        )
        {
            statement.setInt(1, roomId);
            statement.setInt(2, ownerId);
            statement.executeUpdate();
        }
    }

    public static void deleteRestoredRoom(
            int roomId)
            throws Exception
    {
        try(Connection connection = connection())
        {
            try(
                    PreparedStatement statement =
                            connection.prepareStatement(
                                    "DELETE FROM room_models_custom " +
                                    "WHERE id = ?"
                            )
            )
            {
                statement.setInt(1, roomId);
                statement.executeUpdate();
            }

            try(
                    PreparedStatement statement =
                            connection.prepareStatement(
                                    "DELETE FROM rooms WHERE id = ?"
                            )
            )
            {
                statement.setInt(1, roomId);
                statement.executeUpdate();
            }
        }
    }

    private static StoredBackup readStored(
            Connection connection,
            ResultSet row)
            throws Exception
    {
        int backupId = row.getInt("id");

        return new StoredBackup(
                backupId,
                row.getInt("owner_id"),
                row.getInt("original_room_id"),
                row.getInt("active_room_id"),
                safe(row.getString("room_name")),
                safe(row.getString("room_description")),
                safe(row.getString("room_model")),
                row.getInt("users_max"),
                row.getInt("category_id"),
                row.getInt("trade_mode"),
                safe(row.getString("room_state")),
                safe(row.getString("room_password")),
                safe(row.getString("floor_paint")),
                safe(row.getString("wall_paint")),
                safe(row.getString("landscape_paint")),
                row.getInt("wall_size"),
                row.getInt("wall_height"),
                row.getInt("floor_size"),
                safe(row.getString("tags")),
                row.getBoolean("allow_other_pets"),
                row.getBoolean("allow_other_pets_eat"),
                row.getBoolean("allow_walkthrough"),
                row.getBoolean("allow_hidewall"),
                row.getInt("chat_mode"),
                row.getInt("chat_weight"),
                row.getInt("chat_speed"),
                row.getInt("chat_distance"),
                row.getInt("chat_protection"),
                row.getInt("mute_option"),
                row.getInt("kick_option"),
                row.getInt("ban_option"),
                row.getInt("roller_speed"),
                row.getBoolean("move_diagonally"),
                row.getBoolean("hide_wired"),
                row.getBoolean("custom_layout"),
                row.getInt("custom_door_x"),
                row.getInt("custom_door_y"),
                row.getInt("custom_door_dir"),
                safe(row.getString("custom_heightmap")),
                safe(row.getString("pin_salt")),
                safe(row.getString("pin_hash")),
                row.getInt("pin_iterations"),
                loadItems(connection, backupId)
        );
    }

    private static List<BackupItem> loadItems(
            Connection connection,
            int backupId)
            throws Exception
    {
        List<BackupItem> result =
                new ArrayList<BackupItem>();

        try(
                PreparedStatement statement =
                        connection.prepareStatement(
                                "SELECT item_id, base_item_id, furniture_type, " +
                                "x, y, z, rotation, wall_position, extra_data " +
                                "FROM builder_pro_room_backup_items " +
                                "WHERE backup_id = ? ORDER BY z ASC, item_id ASC"
                        )
        )
        {
            statement.setInt(1, backupId);

            try(ResultSet rows = statement.executeQuery())
            {
                while(rows.next())
                {
                    result.add(
                            new BackupItem(
                                    rows.getInt("item_id"),
                                    rows.getInt("base_item_id"),
                                    safe(rows.getString("furniture_type")),
                                    rows.getShort("x"),
                                    rows.getShort("y"),
                                    rows.getDouble("z"),
                                    normalizeRotation(rows.getInt("rotation")),
                                    safe(rows.getString("wall_position")),
                                    safe(rows.getString("extra_data"))
                            )
                    );
                }
            }
        }

        return result;
    }

    private static void insertItems(
            Connection connection,
            int backupId,
            List<BackupItem> items)
            throws Exception
    {
        if(items == null || items.isEmpty())
        {
            return;
        }

        try(
                PreparedStatement statement =
                        connection.prepareStatement(
                                "INSERT INTO builder_pro_room_backup_items " +
                                "(backup_id, item_id, base_item_id, furniture_type, " +
                                "x, y, z, rotation, wall_position, extra_data) " +
                                "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                        )
        )
        {
            for(BackupItem item : items)
            {
                statement.setInt(1, backupId);
                statement.setInt(2, item.itemId);
                statement.setInt(3, item.baseItemId);
                statement.setString(4, item.furnitureType);
                statement.setShort(5, item.x);
                statement.setShort(6, item.y);
                statement.setDouble(7, item.z);
                statement.setInt(8, item.rotation);
                statement.setString(9, item.wallPosition);
                statement.setString(10, item.extraData);
                statement.addBatch();
            }

            statement.executeBatch();
        }
    }

    private static String insertBackupSql()
    {
        return "INSERT INTO builder_pro_room_backups (" +
                "owner_id, original_room_id, active_room_id, " +
                shellColumns() +
                ", pin_salt, pin_hash, pin_iterations" +
                ") VALUES (?, ?, ?, " +
                shellPlaceholders() +
                ", ?, ?, ?)";
    }

    private static String shellColumns()
    {
        return "room_name, room_description, room_model, users_max, " +
                "category_id, trade_mode, room_state, room_password, " +
                "floor_paint, wall_paint, landscape_paint, wall_size, " +
                "wall_height, floor_size, tags, allow_other_pets, " +
                "allow_other_pets_eat, allow_walkthrough, allow_hidewall, " +
                "chat_mode, chat_weight, chat_speed, chat_distance, " +
                "chat_protection, mute_option, kick_option, ban_option, " +
                "roller_speed, move_diagonally, hide_wired, custom_layout, " +
                "custom_door_x, custom_door_y, custom_door_dir, custom_heightmap";
    }

    private static String shellPlaceholders()
    {
        StringBuilder result = new StringBuilder();

        for(int index = 0; index < 35; index++)
        {
            if(index > 0)
            {
                result.append(", ");
            }

            result.append("?");
        }

        return result.toString();
    }

    private static String shellUpdateSql()
    {
        String[] columns = shellColumns().split(", ");
        StringBuilder result = new StringBuilder();

        for(int index = 0; index < columns.length; index++)
        {
            if(index > 0)
            {
                result.append(", ");
            }

            result.append(columns[index]).append(" = ?");
        }

        return result.toString();
    }

    private static void bindSnapshot(
            PreparedStatement statement,
            int ownerId,
            int originalRoomId,
            int activeRoomId,
            Snapshot snapshot,
            String salt,
            String hash,
            int iterations)
            throws Exception
    {
        int index = 1;
        statement.setInt(index++, ownerId);
        statement.setInt(index++, originalRoomId);
        statement.setInt(index++, activeRoomId);
        index = bindShell(statement, index, snapshot);
        statement.setString(index++, salt);
        statement.setString(index++, hash);
        statement.setInt(index, iterations);
    }

    private static int bindShell(
            PreparedStatement statement,
            int index,
            Snapshot snapshot)
            throws Exception
    {
        statement.setString(index++, snapshot.roomName);
        statement.setString(index++, snapshot.roomDescription);
        statement.setString(index++, snapshot.roomModel);
        statement.setInt(index++, snapshot.usersMax);
        statement.setInt(index++, snapshot.categoryId);
        statement.setInt(index++, snapshot.tradeMode);
        statement.setString(index++, snapshot.roomState);
        statement.setString(index++, snapshot.roomPassword);
        statement.setString(index++, snapshot.floorPaint);
        statement.setString(index++, snapshot.wallPaint);
        statement.setString(index++, snapshot.landscapePaint);
        statement.setInt(index++, snapshot.wallSize);
        statement.setInt(index++, snapshot.wallHeight);
        statement.setInt(index++, snapshot.floorSize);
        statement.setString(index++, snapshot.tags);
        statement.setBoolean(index++, snapshot.allowOtherPets);
        statement.setBoolean(index++, snapshot.allowOtherPetsEat);
        statement.setBoolean(index++, snapshot.allowWalkthrough);
        statement.setBoolean(index++, snapshot.allowHideWall);
        statement.setInt(index++, snapshot.chatMode);
        statement.setInt(index++, snapshot.chatWeight);
        statement.setInt(index++, snapshot.chatSpeed);
        statement.setInt(index++, snapshot.chatDistance);
        statement.setInt(index++, snapshot.chatProtection);
        statement.setInt(index++, snapshot.muteOption);
        statement.setInt(index++, snapshot.kickOption);
        statement.setInt(index++, snapshot.banOption);
        statement.setInt(index++, snapshot.rollerSpeed);
        statement.setBoolean(index++, snapshot.moveDiagonally);
        statement.setBoolean(index++, snapshot.hideWired);
        statement.setBoolean(index++, snapshot.customLayout);
        statement.setInt(index++, snapshot.customDoorX);
        statement.setInt(index++, snapshot.customDoorY);
        statement.setInt(index++, snapshot.customDoorDir);
        statement.setString(index++, snapshot.customHeightmap);

        return index;
    }

    private static Connection connection()
            throws Exception
    {
        return Emulator.getDatabase()
                .getDataSource()
                .getConnection();
    }

    private static int normalizeRotation(int rotation)
    {
        int normalized = rotation % 8;

        if(normalized < 0)
        {
            normalized += 8;
        }

        return normalized;
    }

    private static String safe(String value)
    {
        return value == null ? "" : value;
    }

    public static final class Snapshot
    {
        public final int roomId;
        public final String roomName;
        public final String roomDescription;
        public final String roomModel;
        public final int usersMax;
        public final int categoryId;
        public final int tradeMode;
        public final String roomState;
        public final String roomPassword;
        public final String floorPaint;
        public final String wallPaint;
        public final String landscapePaint;
        public final int wallSize;
        public final int wallHeight;
        public final int floorSize;
        public final String tags;
        public final boolean allowOtherPets;
        public final boolean allowOtherPetsEat;
        public final boolean allowWalkthrough;
        public final boolean allowHideWall;
        public final int chatMode;
        public final int chatWeight;
        public final int chatSpeed;
        public final int chatDistance;
        public final int chatProtection;
        public final int muteOption;
        public final int kickOption;
        public final int banOption;
        public final int rollerSpeed;
        public final boolean moveDiagonally;
        public final boolean hideWired;
        public final boolean customLayout;
        public final int customDoorX;
        public final int customDoorY;
        public final int customDoorDir;
        public final String customHeightmap;
        public final List<BackupItem> items;

        public Snapshot(
                int roomId,
                String roomName,
                String roomDescription,
                String roomModel,
                int usersMax,
                int categoryId,
                int tradeMode,
                String roomState,
                String roomPassword,
                String floorPaint,
                String wallPaint,
                String landscapePaint,
                int wallSize,
                int wallHeight,
                int floorSize,
                String tags,
                boolean allowOtherPets,
                boolean allowOtherPetsEat,
                boolean allowWalkthrough,
                boolean allowHideWall,
                int chatMode,
                int chatWeight,
                int chatSpeed,
                int chatDistance,
                int chatProtection,
                int muteOption,
                int kickOption,
                int banOption,
                int rollerSpeed,
                boolean moveDiagonally,
                boolean hideWired,
                boolean customLayout,
                int customDoorX,
                int customDoorY,
                int customDoorDir,
                String customHeightmap,
                List<BackupItem> items)
        {
            this.roomId = roomId;
            this.roomName = roomName;
            this.roomDescription = roomDescription;
            this.roomModel = roomModel;
            this.usersMax = usersMax;
            this.categoryId = categoryId;
            this.tradeMode = tradeMode;
            this.roomState = roomState;
            this.roomPassword = roomPassword;
            this.floorPaint = floorPaint;
            this.wallPaint = wallPaint;
            this.landscapePaint = landscapePaint;
            this.wallSize = wallSize;
            this.wallHeight = wallHeight;
            this.floorSize = floorSize;
            this.tags = tags;
            this.allowOtherPets = allowOtherPets;
            this.allowOtherPetsEat = allowOtherPetsEat;
            this.allowWalkthrough = allowWalkthrough;
            this.allowHideWall = allowHideWall;
            this.chatMode = chatMode;
            this.chatWeight = chatWeight;
            this.chatSpeed = chatSpeed;
            this.chatDistance = chatDistance;
            this.chatProtection = chatProtection;
            this.muteOption = muteOption;
            this.kickOption = kickOption;
            this.banOption = banOption;
            this.rollerSpeed = rollerSpeed;
            this.moveDiagonally = moveDiagonally;
            this.hideWired = hideWired;
            this.customLayout = customLayout;
            this.customDoorX = customDoorX;
            this.customDoorY = customDoorY;
            this.customDoorDir = customDoorDir;
            this.customHeightmap = customHeightmap;
            this.items = new ArrayList<BackupItem>(items);
        }
    }

    public static final class BackupItem
    {
        public final int itemId;
        public final int baseItemId;
        public final String furnitureType;
        public final short x;
        public final short y;
        public final double z;
        public final int rotation;
        public final String wallPosition;
        public final String extraData;

        public BackupItem(
                int itemId,
                int baseItemId,
                String furnitureType,
                short x,
                short y,
                double z,
                int rotation,
                String wallPosition,
                String extraData)
        {
            this.itemId = itemId;
            this.baseItemId = baseItemId;
            this.furnitureType = furnitureType;
            this.x = x;
            this.y = y;
            this.z = z;
            this.rotation = rotation;
            this.wallPosition = wallPosition;
            this.extraData = extraData;
        }
    }

    public static final class Summary
    {
        public final int id;
        public final int originalRoomId;
        public final int activeRoomId;
        public final String roomName;
        public final int itemCount;
        public final String updatedAt;
        public final boolean roomExists;

        public Summary(
                int id,
                int originalRoomId,
                int activeRoomId,
                String roomName,
                int itemCount,
                String updatedAt,
                boolean roomExists)
        {
            this.id = id;
            this.originalRoomId = originalRoomId;
            this.activeRoomId = activeRoomId;
            this.roomName = roomName;
            this.itemCount = itemCount;
            this.updatedAt = updatedAt;
            this.roomExists = roomExists;
        }
    }

    public static final class StoredBackup
    {
        public final int id;
        public final int ownerId;
        public final int originalRoomId;
        public final int activeRoomId;
        public final String roomName;
        public final String roomDescription;
        public final String roomModel;
        public final int usersMax;
        public final int categoryId;
        public final int tradeMode;
        public final String roomState;
        public final String roomPassword;
        public final String floorPaint;
        public final String wallPaint;
        public final String landscapePaint;
        public final int wallSize;
        public final int wallHeight;
        public final int floorSize;
        public final String tags;
        public final boolean allowOtherPets;
        public final boolean allowOtherPetsEat;
        public final boolean allowWalkthrough;
        public final boolean allowHideWall;
        public final int chatMode;
        public final int chatWeight;
        public final int chatSpeed;
        public final int chatDistance;
        public final int chatProtection;
        public final int muteOption;
        public final int kickOption;
        public final int banOption;
        public final int rollerSpeed;
        public final boolean moveDiagonally;
        public final boolean hideWired;
        public final boolean customLayout;
        public final int customDoorX;
        public final int customDoorY;
        public final int customDoorDir;
        public final String customHeightmap;
        public final String pinSalt;
        public final String pinHash;
        public final int pinIterations;
        public final List<BackupItem> items;

        public StoredBackup(
                int id,
                int ownerId,
                int originalRoomId,
                int activeRoomId,
                String roomName,
                String roomDescription,
                String roomModel,
                int usersMax,
                int categoryId,
                int tradeMode,
                String roomState,
                String roomPassword,
                String floorPaint,
                String wallPaint,
                String landscapePaint,
                int wallSize,
                int wallHeight,
                int floorSize,
                String tags,
                boolean allowOtherPets,
                boolean allowOtherPetsEat,
                boolean allowWalkthrough,
                boolean allowHideWall,
                int chatMode,
                int chatWeight,
                int chatSpeed,
                int chatDistance,
                int chatProtection,
                int muteOption,
                int kickOption,
                int banOption,
                int rollerSpeed,
                boolean moveDiagonally,
                boolean hideWired,
                boolean customLayout,
                int customDoorX,
                int customDoorY,
                int customDoorDir,
                String customHeightmap,
                String pinSalt,
                String pinHash,
                int pinIterations,
                List<BackupItem> items)
        {
            this.id = id;
            this.ownerId = ownerId;
            this.originalRoomId = originalRoomId;
            this.activeRoomId = activeRoomId;
            this.roomName = roomName;
            this.roomDescription = roomDescription;
            this.roomModel = roomModel;
            this.usersMax = usersMax;
            this.categoryId = categoryId;
            this.tradeMode = tradeMode;
            this.roomState = roomState;
            this.roomPassword = roomPassword;
            this.floorPaint = floorPaint;
            this.wallPaint = wallPaint;
            this.landscapePaint = landscapePaint;
            this.wallSize = wallSize;
            this.wallHeight = wallHeight;
            this.floorSize = floorSize;
            this.tags = tags;
            this.allowOtherPets = allowOtherPets;
            this.allowOtherPetsEat = allowOtherPetsEat;
            this.allowWalkthrough = allowWalkthrough;
            this.allowHideWall = allowHideWall;
            this.chatMode = chatMode;
            this.chatWeight = chatWeight;
            this.chatSpeed = chatSpeed;
            this.chatDistance = chatDistance;
            this.chatProtection = chatProtection;
            this.muteOption = muteOption;
            this.kickOption = kickOption;
            this.banOption = banOption;
            this.rollerSpeed = rollerSpeed;
            this.moveDiagonally = moveDiagonally;
            this.hideWired = hideWired;
            this.customLayout = customLayout;
            this.customDoorX = customDoorX;
            this.customDoorY = customDoorY;
            this.customDoorDir = customDoorDir;
            this.customHeightmap = customHeightmap;
            this.pinSalt = pinSalt;
            this.pinHash = pinHash;
            this.pinIterations = pinIterations;
            this.items = new ArrayList<BackupItem>(items);
        }
    }
}
