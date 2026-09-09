package com.biribiri.wardrobe;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.MessageComposer;

public final class WardrobeStateComposer extends MessageComposer
{
    private final int baseSlots;
    private final int hcSlots;
    private final boolean hcActive;
    private final int purchasedSlots;

    public WardrobeStateComposer(int baseSlots, int hcSlots, boolean hcActive, int purchasedSlots)
    {
        this.baseSlots = baseSlots;
        this.hcSlots = hcSlots;
        this.hcActive = hcActive;
        this.purchasedSlots = purchasedSlots;
    }

    @Override
    protected ServerMessage composeInternal()
    {
        this.response.init(BiribiriWardrobePlugin.PACKET_STATE_RESPONSE);
        this.response.appendInt(this.baseSlots);
        this.response.appendInt(this.hcSlots);
        this.response.appendBoolean(this.hcActive);
        this.response.appendInt(this.purchasedSlots);
        this.response.appendInt(this.baseSlots + this.hcSlots + this.purchasedSlots);
        return this.response;
    }
}
