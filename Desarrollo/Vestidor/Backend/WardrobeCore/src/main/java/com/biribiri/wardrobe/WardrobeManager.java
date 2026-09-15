// BIRIBIRI_WARDROBE_V4_2_3_PROVEN_PURCHASE_FLOW
package com.biribiri.wardrobe;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.outgoing.users.UserCreditsComposer;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class WardrobeManager
{

    // BIRIBIRI_CLOTHING_METADATA_V1
    private volatile boolean clothingCatalogMetadataSeeded = false;

    public static final class ClothingMetadata
    {
        private final String figureType;
        private final long figureSetId;
        private final String displayName;
        private final List<String> tags =
            new ArrayList<String>();

        public ClothingMetadata(
            String figureType,
            long figureSetId,
            String displayName
        )
        {
            this.figureType = figureType;
            this.figureSetId = figureSetId;
            this.displayName =
                displayName == null
                    ? ""
                    : displayName;
        }

        public String getFigureType()
        {
            return this.figureType;
        }

        public long getFigureSetId()
        {
            return this.figureSetId;
        }

        public String getDisplayName()
        {
            return this.displayName;
        }

        public List<String> getTags()
        {
            return this.tags;
        }

        private void addTag(String tag)
        {
            if(
                tag != null &&
                !tag.trim().isEmpty() &&
                !this.tags.contains(tag.trim())
            )
            {
                this.tags.add(tag.trim());
            }
        }
    }

    public static final int BASE_SLOTS = 10;
    public static final int HC_BONUS_SLOTS = 10;
    public static final int MAX_PURCHASED_SLOTS = 80;
    public static final int MAX_OUTFIT_NAME_LENGTH = 32;

    public static final int EXTRA_PRICE_1_TO_10 = 25;
    public static final int EXTRA_PRICE_11_TO_20 = 50;
    public static final int EXTRA_PRICE_21_TO_40 = 75;
    public static final int EXTRA_PRICE_41_TO_80 = 100;

    public static final int PURCHASE_SUCCESS = 0;
    public static final int PURCHASE_NOT_ENOUGH_CREDITS = 1;
    public static final int PURCHASE_MAX_REACHED = 2;
    public static final int PURCHASE_FAILED = 3;

    // BIRIBIRI_WARDROBE_DELETE_UNDO_V1
    public static final int DELETE_SUCCESS = 0;
    public static final int DELETE_FORBIDDEN = 1;
    public static final int DELETE_NOT_FOUND = 2;
    public static final int DELETE_FAILED = 3;


    public static final class PurchaseResult
    {
        private final int status;
        private final int purchasedSlots;
        private final int price;
        private final int creditsRemaining;
        private final int nextPrice;

        public PurchaseResult(int status, int purchasedSlots, int price, int creditsRemaining, int nextPrice)
        {
            this.status = status;
            this.purchasedSlots = purchasedSlots;
            this.price = price;
            this.creditsRemaining = creditsRemaining;
            this.nextPrice = nextPrice;
        }

        public int getStatus() { return this.status; }
        public int getPurchasedSlots() { return this.purchasedSlots; }
        public int getPrice() { return this.price; }
        public int getCreditsRemaining() { return this.creditsRemaining; }
        public int getNextPrice() { return this.nextPrice; }
        public boolean isSuccess() { return this.status == PURCHASE_SUCCESS; }
    }

    public int getExtraSlotPrice(int purchasedSlots)
    {
        if(purchasedSlots < 0) purchasedSlots = 0;
        if(purchasedSlots >= MAX_PURCHASED_SLOTS) return 0;
        if(purchasedSlots < 10) return EXTRA_PRICE_1_TO_10;
        if(purchasedSlots < 20) return EXTRA_PRICE_11_TO_20;
        if(purchasedSlots < 40) return EXTRA_PRICE_21_TO_40;
        return EXTRA_PRICE_41_TO_80;
    }

    public void initializeDatabase() throws SQLException
    {
        try(
            Connection connection = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement statement = connection.prepareStatement(
                "CREATE TABLE IF NOT EXISTS biribiri_wardrobe_entitlements (" +
                "user_id INT NOT NULL," +
                "purchased_slots INT NOT NULL DEFAULT 0," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (user_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
            )
        )
        {
            statement.execute();
        }

        try(
            Connection connection = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement statement = connection.prepareStatement(
                "CREATE TABLE IF NOT EXISTS biribiri_wardrobe_outfit_meta (" +
                "user_id INT NOT NULL," +
                "slot_id INT NOT NULL," +
                "outfit_name VARCHAR(32) NOT NULL," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (user_id, slot_id)," +
                "INDEX idx_biribiri_wardrobe_meta_user (user_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
            )
        )
        {
            statement.execute();
        }

        try(
            Connection connection = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement statement = connection.prepareStatement(
                "CREATE TABLE IF NOT EXISTS biribiri_wardrobe_clothing_favorites (" +
                "user_id INT NOT NULL," +
                "figure_type VARCHAR(8) NOT NULL," +
                "figure_set_id INT NOT NULL," +
                "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                "PRIMARY KEY (user_id, figure_type, figure_set_id)," +
                "INDEX idx_biribiri_wardrobe_clothing_fav_user (user_id)" +
                ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
            )
        )
        {
            statement.execute();
        }


        // Metadatos globales de prendas.
        // figure_type='*' sirve como fallback para nombres
        // importados desde catalog_clothing.
        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection();
            PreparedStatement statement =
                connection.prepareStatement(
                    "CREATE TABLE IF NOT EXISTS biribiri_clothing_metadata (" +
                    "figure_type VARCHAR(8) NOT NULL," +
                    "figure_set_id BIGINT UNSIGNED NOT NULL," +
                    "display_name VARCHAR(120) NOT NULL DEFAULT ''," +
                    "source VARCHAR(24) NOT NULL DEFAULT 'manual'," +
                    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                    "updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP," +
                    "PRIMARY KEY (figure_type, figure_set_id)," +
                    "INDEX idx_biribiri_clothing_metadata_id (figure_set_id)," +
                    "INDEX idx_biribiri_clothing_metadata_name (display_name)" +
                    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
                )
        )
        {
            statement.execute();
        }

        // Tags normalizados. Un mismo set puede tener N tags.
        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection();
            PreparedStatement statement =
                connection.prepareStatement(
                    "CREATE TABLE IF NOT EXISTS biribiri_clothing_tags (" +
                    "figure_type VARCHAR(8) NOT NULL," +
                    "figure_set_id BIGINT UNSIGNED NOT NULL," +
                    "tag VARCHAR(48) NOT NULL," +
                    "created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP," +
                    "PRIMARY KEY (figure_type, figure_set_id, tag)," +
                    "INDEX idx_biribiri_clothing_tag (tag)," +
                    "INDEX idx_biribiri_clothing_tag_id (figure_set_id)" +
                    ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;"
                )
        )
        {
            statement.execute();
        }
}

    public int getPurchasedSlots(Habbo habbo)
    {
        if(habbo == null) return 0;

        int userId = habbo.getHabboInfo().getId();

        try(
            Connection connection = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement statement = connection.prepareStatement(
                "SELECT purchased_slots FROM biribiri_wardrobe_entitlements WHERE user_id = ? LIMIT 1"
            )
        )
        {
            statement.setInt(1, userId);

            try(ResultSet set = statement.executeQuery())
            {
                if(set.next())
                {
                    return Math.max(
                        0,
                        Math.min(
                            MAX_PURCHASED_SLOTS,
                            set.getInt("purchased_slots")
                        )
                    );
                }
            }
        }
        catch(SQLException exception)
        {
            System.out.println(
                "[BiribiriWardrobe] DB read error user=" +
                userId + " - " + exception.getMessage()
            );
        }

        return 0;
    }

    public boolean hasActiveClub(Habbo habbo)
    {
        return (
            habbo != null &&
            habbo.getHabboStats() != null &&
            habbo.getHabboStats().hasActiveClub()
        );
    }

    public boolean isSlotUnlocked(Habbo habbo, int slotId)
    {
        if(habbo == null || slotId <= 0) return false;
        if(slotId <= BASE_SLOTS) return true;

        if(slotId <= (BASE_SLOTS + HC_BONUS_SLOTS))
        {
            return this.hasActiveClub(habbo);
        }

        int purchased = this.getPurchasedSlots(habbo);

        return (
            slotId <=
            (
                BASE_SLOTS +
                HC_BONUS_SLOTS +
                purchased
            )
        );
    }

    public synchronized PurchaseResult purchaseNextSlot(Habbo habbo)
    {
        if(
            habbo == null ||
            habbo.getHabboInfo() == null
        )
        {
            return new PurchaseResult(
                PURCHASE_FAILED,
                0,
                0,
                0,
                EXTRA_PRICE_1_TO_10
            );
        }

        int userId =
            habbo.getHabboInfo().getId();

        Connection connection = null;

        try
        {
            connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection();

            connection.setAutoCommit(false);

            // Igual que Subastas: primero garantizamos la fila,
            // luego la bloqueamos antes de calcular el precio.
            try(
                PreparedStatement ensure =
                    connection.prepareStatement(
                        "INSERT INTO biribiri_wardrobe_entitlements " +
                        "(user_id, purchased_slots) VALUES (?, 0) " +
                        "ON DUPLICATE KEY UPDATE user_id = VALUES(user_id)"
                    )
            )
            {
                ensure.setInt(
                    1,
                    userId
                );

                ensure.executeUpdate();
            }

            int purchasedSlots;

            try(
                PreparedStatement query =
                    connection.prepareStatement(
                        "SELECT purchased_slots " +
                        "FROM biribiri_wardrobe_entitlements " +
                        "WHERE user_id = ? FOR UPDATE"
                    )
            )
            {
                query.setInt(
                    1,
                    userId
                );

                try(
                    ResultSet result =
                        query.executeQuery()
                )
                {
                    if(!result.next())
                    {
                        throw new IllegalStateException(
                            "No se encontro el entitlement del usuario."
                        );
                    }

                    purchasedSlots =
                        Math.max(
                            0,
                            Math.min(
                                MAX_PURCHASED_SLOTS,
                                result.getInt(
                                    "purchased_slots"
                                )
                            )
                        );
                }
            }

            int price =
                this.getExtraSlotPrice(
                    purchasedSlots
                );

            if(
                purchasedSlots >= MAX_PURCHASED_SLOTS ||
                price <= 0
            )
            {
                connection.rollback();

                return new PurchaseResult(
                    PURCHASE_MAX_REACHED,
                    purchasedSlots,
                    0,
                    habbo.getHabboInfo().getCredits(),
                    0
                );
            }

            // Patron probado de Subastas:
            // el saldo real se lee y bloquea en la misma transaccion.
            int credits;

            try(
                PreparedStatement query =
                    connection.prepareStatement(
                        "SELECT id, credits " +
                        "FROM users " +
                        "WHERE id = ? FOR UPDATE"
                    )
            )
            {
                query.setInt(
                    1,
                    userId
                );

                try(
                    ResultSet result =
                        query.executeQuery()
                )
                {
                    if(!result.next())
                    {
                        throw new IllegalStateException(
                            "No se encontro el usuario."
                        );
                    }

                    credits =
                        result.getInt(
                            "credits"
                        );
                }
            }

            if(credits < price)
            {
                connection.rollback();

                return new PurchaseResult(
                    PURCHASE_NOT_ENOUGH_CREDITS,
                    purchasedSlots,
                    price,
                    credits,
                    price
                );
            }

            int remainingCredits =
                credits - price;

            // Igual que Subastas: UPDATE simple sobre la fila ya bloqueada.
            try(
                PreparedStatement update =
                    connection.prepareStatement(
                        "UPDATE users " +
                        "SET credits = ? " +
                        "WHERE id = ?"
                    )
            )
            {
                update.setInt(
                    1,
                    remainingCredits
                );

                update.setInt(
                    2,
                    userId
                );

                if(update.executeUpdate() != 1)
                {
                    throw new IllegalStateException(
                        "No se pudo actualizar el saldo."
                    );
                }
            }

            int newPurchasedSlots =
                purchasedSlots + 1;

            try(
                PreparedStatement update =
                    connection.prepareStatement(
                        "UPDATE biribiri_wardrobe_entitlements " +
                        "SET purchased_slots = ?, " +
                        "updated_at = CURRENT_TIMESTAMP " +
                        "WHERE user_id = ?"
                    )
            )
            {
                update.setInt(
                    1,
                    newPurchasedSlots
                );

                update.setInt(
                    2,
                    userId
                );

                if(update.executeUpdate() != 1)
                {
                    throw new IllegalStateException(
                        "No se pudo actualizar purchased_slots."
                    );
                }
            }

            // Creditos y entitlement se vuelven persistentes juntos.
            connection.commit();

            // Mismo patron que Subastas: sincronizar el Habbo online
            // SOLO despues del commit.
            this.syncOnlineCredits(
                userId,
                remainingCredits
            );

            return new PurchaseResult(
                PURCHASE_SUCCESS,
                newPurchasedSlots,
                price,
                remainingCredits,
                this.getExtraSlotPrice(
                    newPurchasedSlots
                )
            );
        }
        catch(Exception error)
        {
            try
            {
                if(connection != null)
                {
                    connection.rollback();
                }
            }
            catch(Exception ignored)
            {
            }

            System.out.println(
                "[BiribiriWardrobe][BUY] ERROR user=" +
                userId +
                " " +
                error.getClass().getName() +
                ": " +
                error.getMessage()
            );

            error.printStackTrace();

            int purchased =
                this.getPurchasedSlots(
                    habbo
                );

            return new PurchaseResult(
                PURCHASE_FAILED,
                purchased,
                this.getExtraSlotPrice(
                    purchased
                ),
                habbo.getHabboInfo().getCredits(),
                this.getExtraSlotPrice(
                    purchased
                )
            );
        }
        finally
        {
            if(connection != null)
            {
                try
                {
                    connection.setAutoCommit(
                        true
                    );

                    connection.close();
                }
                catch(Exception ignored)
                {
                }
            }
        }
    }

    private void syncOnlineCredits(
        int userId,
        int newBalance
    )
    {
        try
        {
            Habbo onlineHabbo =
                Emulator.getGameEnvironment()
                    .getHabboManager()
                    .getHabbo(
                        userId
                    );

            if(onlineHabbo == null)
            {
                return;
            }

            onlineHabbo
                .getHabboInfo()
                .setCredits(
                    newBalance
                );

            if(onlineHabbo.getClient() != null)
            {
                onlineHabbo
                    .getClient()
                    .sendResponse(
                        new UserCreditsComposer(
                            onlineHabbo
                        )
                    );
            }
        }
        catch(Exception error)
        {
            System.out.println(
                "[BiribiriWardrobe][BUY] warning sync credits user=" +
                userId +
                ": " +
                error.getMessage()
            );
        }
    }

    public Map<Integer, String> getOutfitNames(Habbo habbo)
    {
        Map<Integer, String> names =
            new LinkedHashMap<Integer, String>();

        if(habbo == null) return names;

        int userId = habbo.getHabboInfo().getId();

        try(
            Connection connection = Emulator.getDatabase().getDataSource().getConnection();
            PreparedStatement statement = connection.prepareStatement(
                "SELECT slot_id, outfit_name " +
                "FROM biribiri_wardrobe_outfit_meta " +
                "WHERE user_id = ? ORDER BY slot_id ASC"
            )
        )
        {
            statement.setInt(1, userId);

            try(ResultSet set = statement.executeQuery())
            {
                while(set.next())
                {
                    int slotId = set.getInt("slot_id");
                    String name = set.getString("outfit_name");

                    if(
                        slotId > 0 &&
                        name != null &&
                        !name.trim().isEmpty()
                    )
                    {
                        names.put(slotId, name);
                    }
                }
            }
        }
        catch(SQLException exception)
        {
            System.out.println(
                "[BiribiriWardrobe] names read error user=" +
                userId + " - " + exception.getMessage()
            );
        }

        return names;
    }

    public String sanitizeOutfitName(String raw)
    {
        if(raw == null) return "";

        String value =
            raw
                .replace('\n', ' ')
                .replace('\r', ' ')
                .replace('\t', ' ')
                .trim();

        while(value.contains("  "))
        {
            value = value.replace("  ", " ");
        }

        if(value.length() > MAX_OUTFIT_NAME_LENGTH)
        {
            value = value.substring(0, MAX_OUTFIT_NAME_LENGTH).trim();
        }

        return value;
    }

    public boolean saveOutfitName(
        Habbo habbo,
        int slotId,
        String rawName
    )
    {
        if(
            habbo == null ||
            slotId <= 0 ||
            !this.isSlotUnlocked(habbo, slotId)
        ) return false;

        String name = this.sanitizeOutfitName(rawName);
        int userId = habbo.getHabboInfo().getId();

        try(
            Connection connection = Emulator.getDatabase().getDataSource().getConnection()
        )
        {
            if(name.isEmpty())
            {
                try(
                    PreparedStatement statement = connection.prepareStatement(
                        "DELETE FROM biribiri_wardrobe_outfit_meta " +
                        "WHERE user_id = ? AND slot_id = ?"
                    )
                )
                {
                    statement.setInt(1, userId);
                    statement.setInt(2, slotId);
                    statement.executeUpdate();
                }

                return true;
            }

            try(
                PreparedStatement statement = connection.prepareStatement(
                    "INSERT INTO biribiri_wardrobe_outfit_meta " +
                    "(user_id, slot_id, outfit_name) VALUES (?, ?, ?) " +
                    "ON DUPLICATE KEY UPDATE " +
                    "outfit_name = VALUES(outfit_name), " +
                    "updated_at = CURRENT_TIMESTAMP"
                )
            )
            {
                statement.setInt(1, userId);
                statement.setInt(2, slotId);
                statement.setString(3, name);
                statement.executeUpdate();
            }

            return true;
        }
        catch(SQLException exception)
        {
            System.out.println(
                "[BiribiriWardrobe] name save error user=" +
                userId + " slot=" + slotId +
                " - " + exception.getMessage()
            );

            return false;
        }
    }

    private String sanitizeFigureType(
        String raw
    )
    {
        if(raw == null) return "";

        String value =
            raw
                .trim()
                .toLowerCase();

        if(
            value.length() < 1 ||
            value.length() > 8 ||
            !value.matches("[a-z]+")
        )
        {
            return "";
        }

        return value;
    }

    public Map<String, java.util.List<Integer>> getClothingFavorites(
        Habbo habbo
    )
    {
        Map<String, java.util.List<Integer>> favorites =
            new LinkedHashMap<String, java.util.List<Integer>>();

        if(habbo == null) return favorites;

        int userId =
            habbo
                .getHabboInfo()
                .getId();

        try(
            Connection connection =
                Emulator
                    .getDatabase()
                    .getDataSource()
                    .getConnection();

            PreparedStatement statement =
                connection.prepareStatement(
                    "SELECT figure_type, figure_set_id " +
                    "FROM biribiri_wardrobe_clothing_favorites " +
                    "WHERE user_id = ? " +
                    "ORDER BY created_at ASC, figure_type ASC, figure_set_id ASC"
                )
        )
        {
            statement.setInt(
                1,
                userId
            );

            try(
                ResultSet set =
                    statement.executeQuery()
            )
            {
                while(set.next())
                {
                    String figureType =
                        this.sanitizeFigureType(
                            set.getString(
                                "figure_type"
                            )
                        );

                    int figureSetId =
                        set.getInt(
                            "figure_set_id"
                        );

                    if(
                        figureType.isEmpty() ||
                        figureSetId <= 0
                    )
                    {
                        continue;
                    }

                    java.util.List<Integer> ids =
                        favorites.get(
                            figureType
                        );

                    if(ids == null)
                    {
                        ids =
                            new java.util.ArrayList<Integer>();

                        favorites.put(
                            figureType,
                            ids
                        );
                    }

                    ids.add(
                        figureSetId
                    );
                }
            }
        }
        catch(SQLException exception)
        {
            System.out.println(
                "[BiribiriWardrobe] clothing favorites read error user=" +
                userId +
                " - " +
                exception.getMessage()
            );
        }

        return favorites;
    }

    public boolean setClothingFavorite(
        Habbo habbo,
        String rawFigureType,
        int figureSetId,
        boolean favorite
    )
    {
        if(
            habbo == null ||
            figureSetId == 0 ||
            figureSetId == -1
        )
        {
            return false;
        }

        String figureType =
            this.sanitizeFigureType(
                rawFigureType
            );

        if(figureType.isEmpty())
        {
            return false;
        }

        int userId =
            habbo
                .getHabboInfo()
                .getId();

        try(
            Connection connection =
                Emulator
                    .getDatabase()
                    .getDataSource()
                    .getConnection()
        )
        {
            if(favorite)
            {
                try(
                    PreparedStatement statement =
                        connection.prepareStatement(
                            "INSERT INTO biribiri_wardrobe_clothing_favorites " +
                            "(user_id, figure_type, figure_set_id) " +
                            "VALUES (?, ?, ?) " +
                            "ON DUPLICATE KEY UPDATE " +
                            "updated_at = CURRENT_TIMESTAMP"
                        )
                )
                {
                    statement.setInt(
                        1,
                        userId
                    );

                    statement.setString(
                        2,
                        figureType
                    );

                    statement.setInt(
                        3,
                        figureSetId
                    );

                    statement.executeUpdate();
                }
            }
            else
            {
                try(
                    PreparedStatement statement =
                        connection.prepareStatement(
                            "DELETE FROM biribiri_wardrobe_clothing_favorites " +
                            "WHERE user_id = ? " +
                            "AND figure_type = ? " +
                            "AND figure_set_id = ?"
                        )
                )
                {
                    statement.setInt(
                        1,
                        userId
                    );

                    statement.setString(
                        2,
                        figureType
                    );

                    statement.setInt(
                        3,
                        figureSetId
                    );

                    statement.executeUpdate();
                }
            }

            return true;
        }
        catch(SQLException exception)
        {
            System.out.println(
                "[BiribiriWardrobe] clothing favorite save error user=" +
                userId +
                " type=" +
                figureType +
                " set=" +
                figureSetId +
                " - " +
                exception.getMessage()
            );

            return false;
        }
    }

    public void sendClothingFavorites(
        GameClient client
    )
    {
        if(
            client == null ||
            client.getHabbo() == null
        )
        {
            return;
        }

        client.sendResponse(
            new WardrobeClothingFavoritesComposer(
                this.getClothingFavorites(
                    client.getHabbo()
                )
            )
        );
    }


    private String clothingMetadataKey(
        String figureType,
        long figureSetId
    )
    {
        return figureType + ":" + figureSetId;
    }

    private String humanizeCatalogClothingName(
        String raw
    )
    {
        if(raw == null) return "";

        String value =
            raw.trim();

        if(
            value.toLowerCase()
                .startsWith("clothing_")
        )
        {
            value =
                value.substring(
                    "clothing_".length()
                );
        }

        value =
            value
                .replace('_', ' ')
                .replace('-', ' ')
                .trim();

        while(value.contains("  "))
        {
            value =
                value.replace(
                    "  ",
                    " "
                );
        }

        if(value.isEmpty()) return "";

        String[] parts =
            value.split(" ");

        StringBuilder result =
            new StringBuilder();

        for(String part : parts)
        {
            if(part == null || part.isEmpty())
            {
                continue;
            }

            if(result.length() > 0)
            {
                result.append(' ');
            }

            result.append(
                Character.toUpperCase(
                    part.charAt(0)
                )
            );

            if(part.length() > 1)
            {
                result.append(
                    part.substring(1)
                );
            }
        }

        return result.toString();
    }

    private synchronized void seedClothingMetadataFromCatalog()
    {
        if(this.clothingCatalogMetadataSeeded)
        {
            return;
        }

        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection();
            PreparedStatement query =
                connection.prepareStatement(
                    "SELECT name, setid " +
                    "FROM catalog_clothing"
                );
            PreparedStatement insert =
                connection.prepareStatement(
                    "INSERT INTO biribiri_clothing_metadata " +
                    "(figure_type, figure_set_id, display_name, source) " +
                    "VALUES ('*', ?, ?, 'catalog') " +
                    "ON DUPLICATE KEY UPDATE " +
                    "display_name = IF(" +
                    "source = 'catalog', " +
                    "VALUES(display_name), " +
                    "display_name" +
                    "), " +
                    "updated_at = IF(" +
                    "source = 'catalog', " +
                    "CURRENT_TIMESTAMP, " +
                    "updated_at" +
                    ")"
                )
        )
        {
            try(
                ResultSet set =
                    query.executeQuery()
            )
            {
                while(set.next())
                {
                    String rawName =
                        set.getString(
                            "name"
                        );

                    String rawSetIds =
                        set.getString(
                            "setid"
                        );

                    String displayName =
                        this.humanizeCatalogClothingName(
                            rawName
                        );

                    if(
                        rawSetIds == null ||
                        rawSetIds.trim().isEmpty() ||
                        displayName.isEmpty()
                    )
                    {
                        continue;
                    }

                    for(
                        String token :
                        rawSetIds.split(",")
                    )
                    {
                        try
                        {
                            long figureSetId =
                                Long.parseLong(
                                    token.trim()
                                );

                            if(
                                figureSetId <= 0L ||
                                figureSetId > 4294967295L
                            )
                            {
                                continue;
                            }

                            insert.setLong(
                                1,
                                figureSetId
                            );

                            insert.setString(
                                2,
                                displayName
                            );

                            insert.addBatch();
                        }
                        catch(
                            NumberFormatException ignored
                        )
                        {
                        }
                    }
                }
            }

            insert.executeBatch();

            this.clothingCatalogMetadataSeeded =
                true;
        }
        catch(SQLException exception)
        {
            System.out.println(
                "[BiribiriWardrobe] clothing metadata seed error - " +
                exception.getMessage()
            );
        }
    }

    public List<ClothingMetadata> getClothingMetadata()
    {
        this.seedClothingMetadataFromCatalog();

        Map<String, ClothingMetadata> items =
            new LinkedHashMap<String, ClothingMetadata>();

        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection();
            PreparedStatement statement =
                connection.prepareStatement(
                    "SELECT figure_type, figure_set_id, display_name " +
                    "FROM biribiri_clothing_metadata " +
                    "ORDER BY figure_type ASC, figure_set_id ASC"
                )
        )
        {
            try(
                ResultSet set =
                    statement.executeQuery()
            )
            {
                while(set.next())
                {
                    String figureType =
                        set.getString(
                            "figure_type"
                        );

                    long figureSetId =
                        set.getLong(
                            "figure_set_id"
                        );

                    String displayName =
                        set.getString(
                            "display_name"
                        );

                    if(
                        figureType == null ||
                        figureType.trim().isEmpty() ||
                        figureSetId <= 0L ||
                        figureSetId > 4294967295L
                    )
                    {
                        continue;
                    }

                    ClothingMetadata metadata =
                        new ClothingMetadata(
                            figureType.trim()
                                .toLowerCase(),
                            figureSetId,
                            displayName
                        );

                    items.put(
                        this.clothingMetadataKey(
                            metadata.getFigureType(),
                            metadata.getFigureSetId()
                        ),
                        metadata
                    );
                }
            }
        }
        catch(SQLException exception)
        {
            System.out.println(
                "[BiribiriWardrobe] clothing metadata read error - " +
                exception.getMessage()
            );
        }

        if(!items.isEmpty())
        {
            try(
                Connection connection =
                    Emulator.getDatabase()
                        .getDataSource()
                        .getConnection();
                PreparedStatement statement =
                    connection.prepareStatement(
                        "SELECT figure_type, figure_set_id, tag " +
                        "FROM biribiri_clothing_tags " +
                        "ORDER BY tag ASC"
                    )
            )
            {
                try(
                    ResultSet set =
                        statement.executeQuery()
                )
                {
                    while(set.next())
                    {
                        String figureType =
                            set.getString(
                                "figure_type"
                            );

                        long figureSetId =
                            set.getLong(
                                "figure_set_id"
                            );

                        String tag =
                            set.getString(
                                "tag"
                            );

                        ClothingMetadata metadata =
                            items.get(
                                this.clothingMetadataKey(
                                    figureType,
                                    figureSetId
                                )
                            );

                        if(metadata != null)
                        {
                            metadata.addTag(tag);
                        }
                    }
                }
            }
            catch(SQLException exception)
            {
                System.out.println(
                    "[BiribiriWardrobe] clothing tags read error - " +
                    exception.getMessage()
                );
            }
        }

        return new ArrayList<ClothingMetadata>(
            items.values()
        );
    }

    public void sendClothingMetadata(
        GameClient client
    )
    {
        if(client == null)
        {
            return;
        }

        client.sendResponse(
            new WardrobeClothingMetadataComposer(
                this.getClothingMetadata()
            )
        );
    }


    public synchronized int deleteOutfit(
        Habbo habbo,
        int slotId
    )
    {
        if(
            habbo == null ||
            habbo.getHabboInfo() == null ||
            slotId <= 0 ||
            !this.isSlotUnlocked(
                habbo,
                slotId
            )
        )
        {
            return DELETE_FORBIDDEN;
        }

        int userId =
            habbo.getHabboInfo().getId();

        boolean existsInMemory =
            habbo.getInventory()
                .getWardrobeComponent()
                .getLooks()
                .containsKey(
                    slotId
                );

        Connection connection = null;

        try
        {
            connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection();

            connection.setAutoCommit(false);

            int wardrobeRows = 0;

            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "DELETE FROM users_wardrobe " +
                        "WHERE user_id = ? AND slot_id = ?"
                    )
            )
            {
                statement.setInt(
                    1,
                    userId
                );

                statement.setInt(
                    2,
                    slotId
                );

                wardrobeRows =
                    statement.executeUpdate();
            }

            // El nombre pertenece al mismo slot:
            // se elimina atomicamente con el look.
            try(
                PreparedStatement statement =
                    connection.prepareStatement(
                        "DELETE FROM biribiri_wardrobe_outfit_meta " +
                        "WHERE user_id = ? AND slot_id = ?"
                    )
            )
            {
                statement.setInt(
                    1,
                    userId
                );

                statement.setInt(
                    2,
                    slotId
                );

                statement.executeUpdate();
            }

            connection.commit();

            if(
                !existsInMemory &&
                wardrobeRows == 0
            )
            {
                return DELETE_NOT_FOUND;
            }

            // Importante: quitar tambien el objeto vivo del inventario.
            habbo.getInventory()
                .getWardrobeComponent()
                .getLooks()
                .remove(
                    slotId
                );

            return DELETE_SUCCESS;
        }
        catch(Exception error)
        {
            try
            {
                if(connection != null)
                {
                    connection.rollback();
                }
            }
            catch(Exception ignored)
            {
            }

            System.out.println(
                "[BiribiriWardrobe][DELETE] ERROR user=" +
                userId +
                " slot=" +
                slotId +
                " " +
                error.getClass().getSimpleName() +
                ": " +
                error.getMessage()
            );

            return DELETE_FAILED;
        }
        finally
        {
            if(connection != null)
            {
                try
                {
                    connection.setAutoCommit(
                        true
                    );

                    connection.close();
                }
                catch(Exception ignored)
                {
                }
            }
        }
    }

    public void sendState(GameClient client)
    {
        if(client == null || client.getHabbo() == null) return;

        Habbo habbo = client.getHabbo();
        boolean hcActive = this.hasActiveClub(habbo);
        int purchased = this.getPurchasedSlots(habbo);

        client.sendResponse(
            new WardrobeStateComposer(
                BASE_SLOTS,
                HC_BONUS_SLOTS,
                hcActive,
                purchased
            )
        );
    }

    public void sendNames(GameClient client)
    {
        if(client == null || client.getHabbo() == null) return;

        client.sendResponse(
            new WardrobeNamesComposer(
                this.getOutfitNames(
                    client.getHabbo()
                )
            )
        );
    }
}
