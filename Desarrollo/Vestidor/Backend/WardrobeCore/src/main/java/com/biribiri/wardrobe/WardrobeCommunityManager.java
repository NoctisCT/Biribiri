// BIRIBIRI_WARDROBE_COMMUNITY_C1
// BIRIBIRI_WARDROBE_COMMUNITY_C2_1
// BIRIBIRI_WARDROBE_COMMUNITY_C2_2
// BIRIBIRI_CLOTHING_OWNERSHIP_S1
// BIRIBIRI_WARDROBE_COMMUNITY_C2_3_2_2
package com.biribiri.wardrobe;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.users.HabboGender;
import com.eu.habbo.habbohotel.users.inventory.WardrobeComponent;
import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.users.UserWardrobeComposer;
import com.eu.habbo.plugin.events.users.UserSavedWardrobeEvent;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.Locale;

public final class WardrobeCommunityManager
{
    public static final int MODE_NEW = 0;
    public static final int MODE_POPULAR = 1;
    public static final int MODE_COSPLAY = 2;
    public static final int MODE_AESTHETIC = 3;
    public static final int MODE_STREETWEAR = 4;
    public static final int MODE_ELEGANT = 5;
    public static final int MODE_FANTASY = 6;
    public static final int MODE_GENERAL = 7;

    public static final int MUTATION_PUBLISH = 1;
    public static final int MUTATION_UNPUBLISH = 2;

    public static final int MUTATION_OK = 0;
    public static final int MUTATION_INVALID_ACTION = 1;
    public static final int MUTATION_INVALID_SLOT = 2;
    public static final int MUTATION_SLOT_LOCKED = 3;
    public static final int MUTATION_LOOK_MISSING = 4;
    public static final int MUTATION_INVALID_CATEGORY = 5;
    public static final int MUTATION_DATABASE_ERROR = 6;
    public static final int MUTATION_CLOTHING_NOT_OWNED = 7;

    public static final int ACTION_LIKE = 1;
    public static final int ACTION_SAVE_COPY = 2;
    public static final int ACTION_UNPUBLISH = 3;

    public static final int ACTION_OK = 0;
    public static final int ACTION_NOT_FOUND = 1;
    public static final int ACTION_NO_FREE_SLOT = 2;
    public static final int ACTION_FORBIDDEN = 3;
    public static final int ACTION_DATABASE_ERROR = 4;
    public static final int ACTION_INVALID = 5;
    public static final int ACTION_CLOTHING_NOT_OWNED = 6;

    private static final class PublicationData
    {
        private final int id;
        private final int userId;
        private final String look;
        private final String gender;
        private final String name;

        private PublicationData(
            int id,
            int userId,
            String look,
            String gender,
            String name
        )
        {
            this.id = id;
            this.userId = userId;
            this.look = look;
            this.gender = gender;
            this.name = name;
        }
    }

    public void initializeDatabase() throws SQLException
    {
        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection()
        )
        {
            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "CREATE TABLE IF NOT EXISTS biribiri_wardrobe_community_posts (" +
                        "id INT UNSIGNED NOT NULL AUTO_INCREMENT," +
                        "user_id INT NOT NULL," +
                        "slot_id INT NOT NULL," +
                        "category VARCHAR(16) NOT NULL DEFAULT 'normal'," +
                        "look_hash CHAR(64) NOT NULL," +
                        "active TINYINT(1) NOT NULL DEFAULT 1," +
                        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                        "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                        "PRIMARY KEY (id)," +
                        "UNIQUE KEY uq_biribiri_community_user_slot (user_id, slot_id)," +
                        "INDEX idx_biribiri_community_feed (active, created_at)," +
                        "INDEX idx_biribiri_community_category (active, category, created_at)" +
                        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
                    )
            )
            {
                statement.execute();
            }

            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "CREATE TABLE IF NOT EXISTS biribiri_wardrobe_community_likes (" +
                        "publication_id INT UNSIGNED NOT NULL," +
                        "user_id INT NOT NULL," +
                        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                        "PRIMARY KEY (publication_id, user_id)," +
                        "INDEX idx_biribiri_community_likes_user (user_id)" +
                        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
                    )
            )
            {
                statement.execute();
            }

            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "CREATE TABLE IF NOT EXISTS biribiri_wardrobe_community_moderation (" +
                        "id INT UNSIGNED NOT NULL AUTO_INCREMENT," +
                        "publication_id INT UNSIGNED NOT NULL," +
                        "author_user_id INT NOT NULL," +
                        "moderator_user_id INT NOT NULL," +
                        "action VARCHAR(24) NOT NULL," +
                        "reason VARCHAR(160) NOT NULL DEFAULT ''," +
                        "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                        "PRIMARY KEY (id)," +
                        "INDEX idx_biribiri_community_mod_publication (publication_id)," +
                        "INDEX idx_biribiri_community_mod_moderator (moderator_user_id, created_at)" +
                        ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
                    )
            )
            {
                statement.execute();
            }
        }
    }

    public boolean canModerate(GameClient client)
    {
        if(
            client == null ||
            client.getHabbo() == null ||
            client.getHabbo().getHabboInfo() == null ||
            client.getHabbo().getHabboInfo().getRank() == null
        ) return false;

        int rank =
            client.getHabbo()
                .getHabboInfo()
                .getRank()
                .getId();

        return rank == 6 || rank == 7;
    }

    private String normalizeCategory(String raw)
    {
        String category =
            raw == null
                ? ""
                : raw.trim().toLowerCase(Locale.ROOT);

        switch(category)
        {
            case "normal":
            case "cosplay":
            case "aesthetic":
            case "streetwear":
            case "elegant":
            case "fantasy":
                return category;

            default:
                return null;
        }
    }

    private String sha256(String input) throws Exception
    {
        MessageDigest digest =
            MessageDigest.getInstance("SHA-256");

        byte[] bytes =
            digest.digest(
                input.getBytes(StandardCharsets.UTF_8)
            );

        StringBuilder builder =
            new StringBuilder(bytes.length * 2);

        for(byte value : bytes)
        {
            builder.append(
                String.format("%02x", value & 0xff)
            );
        }

        return builder.toString();
    }

    private String sanitizeReason(String raw)
    {
        if(raw == null) return "";

        String value =
            raw.replace('\r', ' ')
                .replace('\n', ' ')
                .trim();

        while(value.contains("  "))
        {
            value = value.replace("  ", " ");
        }

        if(value.length() > 160)
        {
            value = value.substring(0, 160);
        }

        return value;
    }

    private String safeCopyName(String raw)
    {
        String value =
            raw == null
                ? "Look guardado"
                : raw.trim();

        if(value.isEmpty())
        {
            value = "Look guardado";
        }

        if(value.length() > 32)
        {
            value = value.substring(0, 32);
        }

        return value;
    }

    private void deactivateStalePublications(
        Connection connection
    ) throws SQLException
    {
        try(
            PreparedStatement statement =
                connection.prepareStatement(
                    "UPDATE biribiri_wardrobe_community_posts p " +
                    "LEFT JOIN users_wardrobe w " +
                    " ON w.user_id = p.user_id AND w.slot_id = p.slot_id " +
                    "SET p.active = 0 " +
                    "WHERE p.active = 1 " +
                    "AND (" +
                    " w.user_id IS NULL OR " +
                    " p.look_hash <> SHA2(CONCAT(w.look, '|', w.gender), 256)" +
                    ")"
                )
        )
        {
            statement.executeUpdate();
        }
    }

    private PublicationData loadPublication(
        Connection connection,
        int publicationId
    ) throws SQLException
    {
        try(
            PreparedStatement statement =
                connection.prepareStatement(
                    "SELECT p.id, p.user_id, w.look, w.gender, " +
                    "COALESCE(NULLIF(m.outfit_name, ''), CONCAT('Look ', p.slot_id)) AS outfit_name " +
                    "FROM biribiri_wardrobe_community_posts p " +
                    "INNER JOIN users_wardrobe w " +
                    " ON w.user_id = p.user_id AND w.slot_id = p.slot_id " +
                    "LEFT JOIN biribiri_wardrobe_outfit_meta m " +
                    " ON m.user_id = p.user_id AND m.slot_id = p.slot_id " +
                    "WHERE p.id = ? " +
                    "AND p.active = 1 " +
                    "AND p.look_hash = SHA2(CONCAT(w.look, '|', w.gender), 256) " +
                    "LIMIT 1"
                )
        )
        {
            statement.setInt(1, publicationId);

            try(ResultSet set = statement.executeQuery())
            {
                if(!set.next()) return null;

                return new PublicationData(
                    set.getInt("id"),
                    set.getInt("user_id"),
                    set.getString("look"),
                    set.getString("gender"),
                    set.getString("outfit_name")
                );
            }
        }
    }

    public void sendFeed(
        GameClient client,
        int requestedMode,
        int requestedOffset,
        int requestedLimit
    )
    {
        if(
            client == null ||
            client.getHabbo() == null
        ) return;

        int mode =
            Math.max(
                MODE_NEW,
                Math.min(MODE_GENERAL, requestedMode)
            );

        int offset = Math.max(0, requestedOffset);

        int limit =
            Math.max(
                1,
                Math.min(40, requestedLimit)
            );

        int viewerId =
            client.getHabbo()
                .getHabboInfo()
                .getId();

        String categoryFilter = "";

        switch(mode)
        {
            case MODE_COSPLAY:
                categoryFilter = " AND p.category = 'cosplay' ";
                break;

            case MODE_AESTHETIC:
                categoryFilter = " AND p.category = 'aesthetic' ";
                break;

            case MODE_STREETWEAR:
                categoryFilter = " AND p.category = 'streetwear' ";
                break;

            case MODE_ELEGANT:
                categoryFilter = " AND p.category = 'elegant' ";
                break;

            case MODE_FANTASY:
                categoryFilter = " AND p.category = 'fantasy' ";
                break;

            case MODE_GENERAL:
                categoryFilter = " AND p.category = 'normal' ";
                break;

            default:
                break;
        }

        String orderBy =
            mode == MODE_POPULAR
                ? " ORDER BY likes_count DESC, p.created_at DESC, p.id DESC "
                : " ORDER BY p.created_at DESC, p.id DESC ";

        String sql =
            "SELECT " +
            "p.id, p.user_id, u.username, p.slot_id, " +
            "w.look, w.gender, " +
            "COALESCE(NULLIF(m.outfit_name, ''), CONCAT('Look ', p.slot_id)) AS outfit_name, " +
            "p.category, " +
            "(SELECT COUNT(*) FROM biribiri_wardrobe_community_likes l " +
            " WHERE l.publication_id = p.id) AS likes_count, " +
            "EXISTS(" +
            " SELECT 1 FROM biribiri_wardrobe_community_likes ml " +
            " WHERE ml.publication_id = p.id AND ml.user_id = ?" +
            ") AS my_like, " +
            "DATE_FORMAT(p.created_at, '%Y-%m-%d %H:%i:%s') AS created_text " +
            "FROM biribiri_wardrobe_community_posts p " +
            "INNER JOIN users_wardrobe w " +
            " ON w.user_id = p.user_id AND w.slot_id = p.slot_id " +
            "INNER JOIN users u ON u.id = p.user_id " +
            "LEFT JOIN biribiri_wardrobe_outfit_meta m " +
            " ON m.user_id = p.user_id AND m.slot_id = p.slot_id " +
            "WHERE p.active = 1 " +
            "AND p.look_hash = SHA2(CONCAT(w.look, '|', w.gender), 256) " +
            categoryFilter +
            orderBy +
            "LIMIT ? OFFSET ?";

        ServerMessage response =
            new ServerMessage(
                BiribiriWardrobePlugin.PACKET_COMMUNITY_FEED_RESPONSE
            );

        response.appendInt(mode);
        response.appendInt(offset);
        response.appendBoolean(this.canModerate(client));

        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection()
        )
        {
            this.deactivateStalePublications(connection);

            try(
                PreparedStatement statement =
                    connection.prepareStatement(sql)
            )
            {
                statement.setInt(1, viewerId);
                statement.setInt(2, limit);
                statement.setInt(3, offset);

                ArrayList<Object[]> rows =
                    new ArrayList<Object[]>();

                try(ResultSet set = statement.executeQuery())
                {
                    while(set.next())
                    {
                        rows.add(
                            new Object[] {
                                set.getInt("id"),
                                set.getInt("user_id"),
                                set.getString("username"),
                                set.getInt("slot_id"),
                                set.getString("look"),
                                set.getString("gender"),
                                set.getString("outfit_name"),
                                set.getString("category"),
                                set.getInt("likes_count"),
                                set.getString("created_text"),
                                set.getBoolean("my_like")
                            }
                        );
                    }
                }

                response.appendInt(rows.size());

                for(Object[] row : rows)
                {
                    int authorUserId =
                        (Integer) row[1];

                    response.appendInt((Integer) row[0]);
                    response.appendInt(authorUserId);
                    response.appendString((String) row[2]);
                    response.appendInt((Integer) row[3]);
                    response.appendString((String) row[4]);
                    response.appendString((String) row[5]);
                    response.appendString((String) row[6]);
                    response.appendString((String) row[7]);
                    response.appendInt((Integer) row[8]);
                    response.appendString((String) row[9]);
                    response.appendBoolean((Boolean) row[10]);
                    response.appendBoolean(authorUserId == viewerId);
                }
            }
        }
        catch(Throwable throwable)
        {
            System.out.println(
                "[BiribiriWardrobe] community feed error: " +
                throwable.getClass().getSimpleName() +
                " - " +
                throwable.getMessage()
            );

            response =
                new ServerMessage(
                    BiribiriWardrobePlugin.PACKET_COMMUNITY_FEED_RESPONSE
                );

            response.appendInt(mode);
            response.appendInt(offset);
            response.appendBoolean(this.canModerate(client));
            response.appendInt(0);
        }

        client.sendResponse(response);
    }

    public void sendMine(GameClient client)
    {
        if(
            client == null ||
            client.getHabbo() == null
        ) return;

        int userId =
            client.getHabbo()
                .getHabboInfo()
                .getId();

        ServerMessage response =
            new ServerMessage(
                BiribiriWardrobePlugin.PACKET_COMMUNITY_MINE_RESPONSE
            );

        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection()
        )
        {
            this.deactivateStalePublications(connection);

            String sql =
                "SELECT " +
                "w.slot_id, w.look, w.gender, " +
                "COALESCE(NULLIF(m.outfit_name, ''), CONCAT('Look ', w.slot_id)) AS outfit_name, " +
                "COALESCE(p.id, 0) AS publication_id, " +
                "COALESCE(p.category, '') AS category " +
                "FROM users_wardrobe w " +
                "LEFT JOIN biribiri_wardrobe_outfit_meta m " +
                " ON m.user_id = w.user_id AND m.slot_id = w.slot_id " +
                "LEFT JOIN biribiri_wardrobe_community_posts p " +
                " ON p.user_id = w.user_id " +
                " AND p.slot_id = w.slot_id " +
                " AND p.active = 1 " +
                " AND p.look_hash = SHA2(CONCAT(w.look, '|', w.gender), 256) " +
                "WHERE w.user_id = ? " +
                "ORDER BY w.slot_id";

            ArrayList<Object[]> rows =
                new ArrayList<Object[]>();

            try(
                PreparedStatement statement =
                    connection.prepareStatement(sql)
            )
            {
                statement.setInt(1, userId);

                try(ResultSet set = statement.executeQuery())
                {
                    while(set.next())
                    {
                        int slotId =
                            set.getInt("slot_id");

                        BiribiriWardrobePlugin plugin =
                            BiribiriWardrobePlugin.getInstance();

                        if(
                            plugin == null ||
                            !plugin.getManager()
                                .isSlotUnlocked(
                                    client.getHabbo(),
                                    slotId
                                )
                        ) continue;

                        int publicationId =
                            set.getInt("publication_id");

                        rows.add(
                            new Object[] {
                                slotId,
                                set.getString("look"),
                                set.getString("gender"),
                                set.getString("outfit_name"),
                                publicationId > 0,
                                publicationId,
                                set.getString("category")
                            }
                        );
                    }
                }
            }

            response.appendInt(rows.size());

            for(Object[] row : rows)
            {
                response.appendInt((Integer) row[0]);
                response.appendString((String) row[1]);
                response.appendString((String) row[2]);
                response.appendString((String) row[3]);
                response.appendBoolean((Boolean) row[4]);
                response.appendInt((Integer) row[5]);
                response.appendString((String) row[6]);
            }
        }
        catch(Throwable throwable)
        {
            System.out.println(
                "[BiribiriWardrobe] community mine error: " +
                throwable.getClass().getSimpleName() +
                " - " +
                throwable.getMessage()
            );

            response =
                new ServerMessage(
                    BiribiriWardrobePlugin.PACKET_COMMUNITY_MINE_RESPONSE
                );

            response.appendInt(0);
        }

        client.sendResponse(response);
    }

    public void mutate(
        GameClient client,
        int action,
        int slotId,
        String rawCategory
    )
    {
        if(
            client == null ||
            client.getHabbo() == null
        ) return;

        if(
            action != MUTATION_PUBLISH &&
            action != MUTATION_UNPUBLISH
        )
        {
            this.sendMutationResult(
                client,
                action,
                slotId,
                false,
                MUTATION_INVALID_ACTION,
                0,
                ""
            );
            return;
        }

        if(slotId <= 0)
        {
            this.sendMutationResult(
                client,
                action,
                slotId,
                false,
                MUTATION_INVALID_SLOT,
                0,
                ""
            );
            return;
        }

        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(
            plugin == null ||
            !plugin.getManager()
                .isSlotUnlocked(
                    client.getHabbo(),
                    slotId
                )
        )
        {
            this.sendMutationResult(
                client,
                action,
                slotId,
                false,
                MUTATION_SLOT_LOCKED,
                0,
                ""
            );
            return;
        }

        int userId =
            client.getHabbo()
                .getHabboInfo()
                .getId();

        if(action == MUTATION_UNPUBLISH)
        {
            try(
                Connection connection =
                    Emulator.getDatabase()
                        .getDataSource()
                        .getConnection();
                PreparedStatement statement =
                    connection.prepareStatement(
                        "UPDATE biribiri_wardrobe_community_posts " +
                        "SET active = 0 " +
                        "WHERE user_id = ? AND slot_id = ?"
                    )
            )
            {
                statement.setInt(1, userId);
                statement.setInt(2, slotId);
                statement.executeUpdate();

                this.sendMutationResult(
                    client,
                    action,
                    slotId,
                    true,
                    MUTATION_OK,
                    0,
                    ""
                );
            }
            catch(Throwable throwable)
            {
                this.sendMutationResult(
                    client,
                    action,
                    slotId,
                    false,
                    MUTATION_DATABASE_ERROR,
                    0,
                    ""
                );
            }

            return;
        }

        String category =
            this.normalizeCategory(rawCategory);

        if(category == null)
        {
            this.sendMutationResult(
                client,
                action,
                slotId,
                false,
                MUTATION_INVALID_CATEGORY,
                0,
                ""
            );
            return;
        }

        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection()
        )
        {
            String look = null;
            String gender = null;

            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "SELECT look, gender " +
                        "FROM users_wardrobe " +
                        "WHERE user_id = ? AND slot_id = ? " +
                        "LIMIT 1"
                    )
            )
            {
                statement.setInt(1, userId);
                statement.setInt(2, slotId);

                try(ResultSet set = statement.executeQuery())
                {
                    if(set.next())
                    {
                        look = set.getString("look");
                        gender = set.getString("gender");
                    }
                }
            }

            if(
                look == null ||
                look.trim().isEmpty() ||
                gender == null ||
                gender.trim().isEmpty()
            )
            {
                this.sendMutationResult(
                    client,
                    action,
                    slotId,
                    false,
                    MUTATION_LOOK_MISSING,
                    0,
                    ""
                );
                return;
            }

            if(
                !WardrobeClothingOwnership.canUseLook(
                    client.getHabbo(),
                    look
                )
            )
            {
                this.sendMutationResult(
                    client,
                    action,
                    slotId,
                    false,
                    MUTATION_CLOTHING_NOT_OWNED,
                    0,
                    ""
                );
                return;
            }

            String lookHash =
                this.sha256(
                    look + "|" + gender
                );

            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "INSERT INTO biribiri_wardrobe_community_posts " +
                        "(user_id, slot_id, category, look_hash, active) " +
                        "VALUES (?, ?, ?, ?, 1) " +
                        "ON DUPLICATE KEY UPDATE " +
                        "category = VALUES(category), " +
                        "look_hash = VALUES(look_hash), " +
                        "active = 1, " +
                        "updated_at = CURRENT_TIMESTAMP"
                    )
            )
            {
                statement.setInt(1, userId);
                statement.setInt(2, slotId);
                statement.setString(3, category);
                statement.setString(4, lookHash);
                statement.executeUpdate();
            }

            int publicationId = 0;

            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "SELECT id " +
                        "FROM biribiri_wardrobe_community_posts " +
                        "WHERE user_id = ? AND slot_id = ? " +
                        "LIMIT 1"
                    )
            )
            {
                statement.setInt(1, userId);
                statement.setInt(2, slotId);

                try(ResultSet set = statement.executeQuery())
                {
                    if(set.next())
                    {
                        publicationId =
                            set.getInt("id");
                    }
                }
            }

            this.sendMutationResult(
                client,
                action,
                slotId,
                true,
                MUTATION_OK,
                publicationId,
                category
            );
        }
        catch(Throwable throwable)
        {
            System.out.println(
                "[BiribiriWardrobe] community mutation error: " +
                throwable.getClass().getSimpleName() +
                " - " +
                throwable.getMessage()
            );

            this.sendMutationResult(
                client,
                action,
                slotId,
                false,
                MUTATION_DATABASE_ERROR,
                0,
                ""
            );
        }
    }

    public void handleAction(
        GameClient client,
        int action,
        int publicationId,
        String rawReason
    )
    {
        if(
            client == null ||
            client.getHabbo() == null
        ) return;

        if(
            action != ACTION_LIKE &&
            action != ACTION_SAVE_COPY &&
            action != ACTION_UNPUBLISH
        )
        {
            this.sendActionResult(
                client,
                action,
                publicationId,
                false,
                ACTION_INVALID,
                0,
                false
            );
            return;
        }

        if(publicationId <= 0)
        {
            this.sendActionResult(
                client,
                action,
                publicationId,
                false,
                ACTION_NOT_FOUND,
                0,
                false
            );
            return;
        }

        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection()
        )
        {
            this.deactivateStalePublications(connection);

            PublicationData publication =
                this.loadPublication(
                    connection,
                    publicationId
                );

            if(publication == null)
            {
                this.sendActionResult(
                    client,
                    action,
                    publicationId,
                    false,
                    ACTION_NOT_FOUND,
                    0,
                    false
                );
                return;
            }

            if(action == ACTION_LIKE)
            {
                this.toggleLike(
                    client,
                    connection,
                    publication
                );
                return;
            }

            if(action == ACTION_SAVE_COPY)
            {
                this.saveCopy(
                    client,
                    connection,
                    publication
                );
                return;
            }

            this.unpublishFromCard(
                client,
                connection,
                publication,
                rawReason
            );
        }
        catch(Throwable throwable)
        {
            System.out.println(
                "[BiribiriWardrobe] community action error: " +
                throwable.getClass().getSimpleName() +
                " - " +
                throwable.getMessage()
            );

            this.sendActionResult(
                client,
                action,
                publicationId,
                false,
                ACTION_DATABASE_ERROR,
                0,
                false
            );
        }
    }

    private void toggleLike(
        GameClient client,
        Connection connection,
        PublicationData publication
    ) throws SQLException
    {
        int userId =
            client.getHabbo()
                .getHabboInfo()
                .getId();

        boolean liked = false;

        try(
            PreparedStatement statement =
                connection.prepareStatement(
                    "SELECT 1 " +
                    "FROM biribiri_wardrobe_community_likes " +
                    "WHERE publication_id = ? AND user_id = ? " +
                    "LIMIT 1"
                )
        )
        {
            statement.setInt(1, publication.id);
            statement.setInt(2, userId);

            try(ResultSet set = statement.executeQuery())
            {
                liked = set.next();
            }
        }

        if(liked)
        {
            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "DELETE FROM biribiri_wardrobe_community_likes " +
                        "WHERE publication_id = ? AND user_id = ?"
                    )
            )
            {
                statement.setInt(1, publication.id);
                statement.setInt(2, userId);
                statement.executeUpdate();
            }

            liked = false;
        }
        else
        {
            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "INSERT IGNORE INTO biribiri_wardrobe_community_likes " +
                        "(publication_id, user_id) VALUES (?, ?)"
                    )
            )
            {
                statement.setInt(1, publication.id);
                statement.setInt(2, userId);
                statement.executeUpdate();
            }

            liked = true;
        }

        int likes = 0;

        try(
            PreparedStatement statement =
                connection.prepareStatement(
                    "SELECT COUNT(*) AS total " +
                    "FROM biribiri_wardrobe_community_likes " +
                    "WHERE publication_id = ?"
                )
        )
        {
            statement.setInt(1, publication.id);

            try(ResultSet set = statement.executeQuery())
            {
                if(set.next())
                {
                    likes = set.getInt("total");
                }
            }
        }

        this.sendActionResult(
            client,
            ACTION_LIKE,
            publication.id,
            true,
            ACTION_OK,
            likes,
            liked
        );
    }

    private void saveCopy(
        GameClient client,
        Connection connection,
        PublicationData publication
    ) throws Exception
    {
        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(plugin == null)
        {
            this.sendActionResult(
                client,
                ACTION_SAVE_COPY,
                publication.id,
                false,
                ACTION_DATABASE_ERROR,
                0,
                false
            );
            return;
        }

        if(
            !WardrobeClothingOwnership.canUseLook(
                client.getHabbo(),
                publication.look
            )
        )
        {
            this.sendActionResult(
                client,
                ACTION_SAVE_COPY,
                publication.id,
                false,
                ACTION_CLOTHING_NOT_OWNED,
                0,
                false
            );
            return;
        }

        WardrobeComponent wardrobe =
            client.getHabbo()
                .getInventory()
                .getWardrobeComponent();

        int targetSlot = 0;

        for(int slotId = 1; slotId <= 100; slotId++)
        {
            if(
                !plugin.getManager()
                    .isSlotUnlocked(
                        client.getHabbo(),
                        slotId
                    )
            ) continue;

            if(
                wardrobe.getLooks()
                    .containsKey(slotId)
            ) continue;

            targetSlot = slotId;
            break;
        }

        if(targetSlot <= 0)
        {
            this.sendActionResult(
                client,
                ACTION_SAVE_COPY,
                publication.id,
                false,
                ACTION_NO_FREE_SLOT,
                0,
                false
            );
            return;
        }

        WardrobeComponent.WardrobeItem item =
            wardrobe.createLook(
                client.getHabbo(),
                targetSlot,
                publication.look
            );

        item.setGender(
            HabboGender.valueOf(
                publication.gender
                    .trim()
                    .toUpperCase(Locale.ROOT)
            )
        );

        item.setNeedsInsert(true);

        wardrobe.getLooks()
            .put(
                targetSlot,
                item
            );

        String copyName =
            this.safeCopyName(
                publication.name
            );

        try(
            PreparedStatement statement =
                connection.prepareStatement(
                    "INSERT INTO biribiri_wardrobe_outfit_meta " +
                    "(user_id, slot_id, outfit_name) VALUES (?, ?, ?) " +
                    "ON DUPLICATE KEY UPDATE " +
                    "outfit_name = VALUES(outfit_name), " +
                    "updated_at = CURRENT_TIMESTAMP"
                )
        )
        {
            statement.setInt(
                1,
                client.getHabbo()
                    .getHabboInfo()
                    .getId()
            );
            statement.setInt(2, targetSlot);
            statement.setString(3, copyName);
            statement.executeUpdate();
        }

        Emulator.getPluginManager()
            .fireEvent(
                new UserSavedWardrobeEvent(
                    client.getHabbo(),
                    item
                )
            );

        Emulator.getThreading()
            .run(item);

        client.sendResponse(
            new UserWardrobeComposer(
                wardrobe
            )
        );

        plugin.getManager()
            .sendNames(client);

        this.sendActionResult(
            client,
            ACTION_SAVE_COPY,
            publication.id,
            true,
            ACTION_OK,
            targetSlot,
            false
        );
    }

    private void unpublishFromCard(
        GameClient client,
        Connection connection,
        PublicationData publication,
        String rawReason
    ) throws SQLException
    {
        int moderatorId =
            client.getHabbo()
                .getHabboInfo()
                .getId();

        boolean own =
            publication.userId == moderatorId;

        if(
            !own &&
            !this.canModerate(client)
        )
        {
            this.sendActionResult(
                client,
                ACTION_UNPUBLISH,
                publication.id,
                false,
                ACTION_FORBIDDEN,
                0,
                false
            );
            return;
        }

        try(
            PreparedStatement statement =
                connection.prepareStatement(
                    "UPDATE biribiri_wardrobe_community_posts " +
                    "SET active = 0 " +
                    "WHERE id = ?"
                )
        )
        {
            statement.setInt(1, publication.id);
            statement.executeUpdate();
        }

        if(!own)
        {
            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "INSERT INTO biribiri_wardrobe_community_moderation " +
                        "(publication_id, author_user_id, moderator_user_id, action, reason) " +
                        "VALUES (?, ?, ?, 'unpublish', ?)"
                    )
            )
            {
                statement.setInt(1, publication.id);
                statement.setInt(2, publication.userId);
                statement.setInt(3, moderatorId);
                statement.setString(
                    4,
                    this.sanitizeReason(rawReason)
                );
                statement.executeUpdate();
            }
        }

        this.sendActionResult(
            client,
            ACTION_UNPUBLISH,
            publication.id,
            true,
            ACTION_OK,
            0,
            false
        );
    }

    private void sendMutationResult(
        GameClient client,
        int action,
        int slotId,
        boolean success,
        int code,
        int publicationId,
        String category
    )
    {
        ServerMessage response =
            new ServerMessage(
                BiribiriWardrobePlugin.PACKET_COMMUNITY_MUTATION_RESULT
            );

        response.appendInt(action);
        response.appendInt(slotId);
        response.appendBoolean(success);
        response.appendInt(code);
        response.appendInt(publicationId);
        response.appendString(
            category == null
                ? ""
                : category
        );

        client.sendResponse(response);
    }

    private void sendActionResult(
        GameClient client,
        int action,
        int publicationId,
        boolean success,
        int code,
        int value,
        boolean flag
    )
    {
        ServerMessage response =
            new ServerMessage(
                BiribiriWardrobePlugin.PACKET_COMMUNITY_ACTION_RESULT
            );

        response.appendInt(action);
        response.appendInt(publicationId);
        response.appendBoolean(success);
        response.appendInt(code);
        response.appendInt(value);
        response.appendBoolean(flag);

        client.sendResponse(response);
    }
}
