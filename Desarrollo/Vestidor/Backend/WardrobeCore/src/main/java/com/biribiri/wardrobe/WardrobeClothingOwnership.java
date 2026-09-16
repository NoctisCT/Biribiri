// BIRIBIRI_CLOTHING_OWNERSHIP_S1
package com.biribiri.wardrobe;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboGender;
import com.eu.habbo.habbohotel.users.inventory.WardrobeComponent;
import com.eu.habbo.messages.outgoing.users.UserWardrobeComposer;
import com.eu.habbo.plugin.events.users.UserSavedWardrobeEvent;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

public final class WardrobeClothingOwnership
{
    private WardrobeClothingOwnership()
    {
    }

    public static boolean canUseLook(
        Habbo habbo,
        String look
    )
    {
        if(
            habbo == null ||
            habbo.getInventory() == null ||
            habbo.getInventory().getWardrobeComponent() == null ||
            look == null ||
            look.trim().isEmpty()
        )
        {
            return false;
        }

        try
        {
            Set<Integer> acquiredSetIds =
                loadAcquiredClothingSetIds();

            if(acquiredSetIds.isEmpty())
            {
                return true;
            }

            for(String part : look.split(Pattern.quote(".")))
            {
                if(
                    part == null ||
                    part.trim().isEmpty()
                )
                {
                    continue;
                }

                String[] tokens =
                    part.split("-");

                if(tokens.length < 2)
                {
                    continue;
                }

                int setId;

                try
                {
                    setId =
                        Integer.parseInt(
                            tokens[1]
                        );
                }
                catch(NumberFormatException ignored)
                {
                    continue;
                }

                if(
                    acquiredSetIds.contains(setId) &&
                    !habbo.getInventory()
                        .getWardrobeComponent()
                        .getClothingSets()
                        .contains(setId)
                )
                {
                    return false;
                }
            }

            return true;
        }
        catch(Throwable throwable)
        {
            System.out.println(
                "[BiribiriWardrobe] ownership validation error: " +
                throwable.getClass().getSimpleName() +
                " - " +
                throwable.getMessage()
            );

            return false;
        }
    }

    private static Set<Integer> loadAcquiredClothingSetIds()
        throws Exception
    {
        Set<Integer> result =
            new HashSet<Integer>();

        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection();
            PreparedStatement statement =
                connection.prepareStatement(
                    "SELECT setid FROM catalog_clothing"
                );
            ResultSet set =
                statement.executeQuery()
        )
        {
            while(set.next())
            {
                String raw =
                    set.getString("setid");

                if(
                    raw == null ||
                    raw.trim().isEmpty()
                )
                {
                    continue;
                }

                for(
                    String token :
                    raw.split(
                        Pattern.quote(",")
                    )
                )
                {
                    try
                    {
                        int setId =
                            Integer.parseInt(
                                token.trim()
                            );

                        if(setId > 0)
                        {
                            result.add(setId);
                        }
                    }
                    catch(NumberFormatException ignored)
                    {
                    }
                }
            }
        }

        return result;
    }

    public static void rejectWardrobeSave(
        UserSavedWardrobeEvent event
    )
    {
        if(
            event == null ||
            event.habbo == null ||
            event.wardrobeItem == null
        )
        {
            return;
        }

        if(
            canUseLook(
                event.habbo,
                event.wardrobeItem.getLook()
            )
        )
        {
            return;
        }

        event.setCancelled(true);

        WardrobeComponent wardrobe =
            event.habbo.getInventory()
                .getWardrobeComponent();

        WardrobeComponent.WardrobeItem item =
            event.wardrobeItem;

        int slotId =
            item.getSlotId();

        boolean restored = false;

        try(
            Connection connection =
                Emulator.getDatabase()
                    .getDataSource()
                    .getConnection();
            PreparedStatement statement =
                connection.prepareStatement(
                    "SELECT look, gender " +
                    "FROM users_wardrobe " +
                    "WHERE user_id = ? AND slot_id = ? " +
                    "LIMIT 1"
                )
        )
        {
            statement.setInt(
                1,
                event.habbo.getHabboInfo()
                    .getId()
            );

            statement.setInt(
                2,
                slotId
            );

            try(
                ResultSet set =
                    statement.executeQuery()
            )
            {
                if(set.next())
                {
                    item.setLook(
                        set.getString("look")
                    );

                    item.setGender(
                        HabboGender.valueOf(
                            set.getString("gender")
                                .trim()
                                .toUpperCase(Locale.ROOT)
                        )
                    );

                    item.setNeedsInsert(false);
                    item.setNeedsUpdate(false);

                    restored = true;
                }
            }
        }
        catch(Throwable throwable)
        {
            System.out.println(
                "[BiribiriWardrobe] ownership wardrobe restore error: " +
                throwable.getClass().getSimpleName() +
                " - " +
                throwable.getMessage()
            );
        }

        if(!restored)
        {
            item.setNeedsInsert(false);
            item.setNeedsUpdate(false);

            wardrobe.getLooks()
                .remove(slotId);
        }

        if(event.habbo.getClient() != null)
        {
            event.habbo.getClient()
                .sendResponse(
                    new UserWardrobeComposer(
                        wardrobe
                    )
                );
        }

        event.habbo.alert(
            "No puedes guardar este look porque contiene ropa que no tienes en tu armario."
        );
    }
}
