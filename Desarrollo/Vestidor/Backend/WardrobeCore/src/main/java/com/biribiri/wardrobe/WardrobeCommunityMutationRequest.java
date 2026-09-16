// BIRIBIRI_WARDROBE_COMMUNITY_C2_1
package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeCommunityMutationRequest
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
        int slotId = this.packet.readInt();
        String category = this.packet.readString();

        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(plugin == null) return;

        plugin.getCommunityManager()
            .mutate(
                this.client,
                action,
                slotId,
                category
            );
    }
}
