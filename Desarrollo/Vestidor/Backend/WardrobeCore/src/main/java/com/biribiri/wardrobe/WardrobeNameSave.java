package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeNameSave extends MessageHandler
{
    @Override
    public void handle() throws Exception
    {
        if(
            this.client == null ||
            this.client.getHabbo() == null ||
            this.packet == null
        ) return;

        int slotId = this.packet.readInt().intValue();
        String name = this.packet.readString();

        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(plugin == null) return;

        plugin.getManager().saveOutfitName(
            this.client.getHabbo(),
            slotId,
            name
        );

        plugin.getManager().sendNames(this.client);
    }

    @Override
    public int getRatelimit()
    {
        return 250;
    }
}
