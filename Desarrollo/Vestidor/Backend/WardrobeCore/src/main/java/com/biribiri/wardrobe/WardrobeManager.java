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
import java.util.LinkedHashMap;
import java.util.Map;

public final class WardrobeManager
{
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
