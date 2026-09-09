package com.retro.airhockey;

import com.eu.habbo.habbohotel.gameclients.GameClient;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionDefault;
import com.eu.habbo.habbohotel.rooms.Room;

import java.sql.ResultSet;
import java.sql.SQLException;

public final class InteractionAirHockey extends InteractionDefault
{
    public InteractionAirHockey(ResultSet set, Item baseItem) throws SQLException
    {
        super(set, baseItem);
    }

    public InteractionAirHockey(
            int id,
            int userId,
            Item item,
            String extradata,
            int limitedStack,
            int limitedSells)
    {
        super(id, userId, item, extradata, limitedStack, limitedSells);
    }

    @Override
    public void onClick(GameClient client, Room room, Object[] objects)
    {
        System.out.println(
                "[AirHockey][TRACE] ONCLICK itemId=" + this.getId() +
                " runtimeClass=" + this.getClass().getName()
        );
        if(client == null || client.getHabbo() == null || room == null)
        {
            return;
        }

        AirHockeyPlugin plugin = AirHockeyPlugin.getInstance();

        if(plugin == null)
        {
            return;
        }

        plugin.getManager().requestJoin(client, room, this);
    }
}
