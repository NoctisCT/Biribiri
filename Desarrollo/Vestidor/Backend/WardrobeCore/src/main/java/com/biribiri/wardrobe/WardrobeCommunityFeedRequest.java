// BIRIBIRI_WARDROBE_COMMUNITY_C1
package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeCommunityFeedRequest
    extends MessageHandler
{
    @Override
    public void handle()
    {
        if(
            this.client == null ||
            this.client.getHabbo() == null ||
            this.packet == null
        ) return;

        int mode = this.packet.readInt();
        int offset = this.packet.readInt();
        int limit = this.packet.readInt();

        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(plugin == null) return;

        plugin.getCommunityManager()
            .sendFeed(
                this.client,
                mode,
                offset,
                limit
            );
    }
}
