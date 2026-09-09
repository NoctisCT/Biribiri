package com.biribiri.wardrobe;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.MessageComposer;

public final class WardrobePurchaseResultComposer extends MessageComposer
{
    private final WardrobeManager.PurchaseResult result;

    public WardrobePurchaseResultComposer(WardrobeManager.PurchaseResult result)
    {
        this.result = result;
    }

    @Override
    protected ServerMessage composeInternal()
    {
        this.response.init(BiribiriWardrobePlugin.PACKET_PURCHASE_RESULT);
        this.response.appendInt(this.result.getStatus());
        this.response.appendInt(this.result.getPurchasedSlots());
        this.response.appendInt(this.result.getPrice());
        this.response.appendInt(this.result.getCreditsRemaining());
        this.response.appendInt(this.result.getNextPrice());
        return this.response;
    }
}
