// BIRIBIRI_WARDROBE_COMMUNITY_C2_2
package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeCommunityActionRequest
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

        int action = this.packet.readInt();
        int publicationId = this.packet.readInt();
        String reason = this.packet.readString();

        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(plugin == null) return;

        plugin.getCommunityManager()
            .handleAction(
                this.client,
                action,
                publicationId,
                reason
            );
    }
}
