// BIRIBIRI_WARDROBE_COMMUNITY_C2_1
package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeCommunityMineRequest
    extends MessageHandler
{
    @Override
    public void handle()
    {
        if(
            this.client == null ||
            this.client.getHabbo() == null
        ) return;

        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(plugin == null) return;

        plugin.getCommunityManager()
            .sendMine(this.client);
    }
}
