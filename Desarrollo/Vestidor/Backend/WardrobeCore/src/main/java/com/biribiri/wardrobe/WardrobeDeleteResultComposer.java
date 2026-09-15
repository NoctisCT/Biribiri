package com.biribiri.wardrobe;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.MessageComposer;

public final class WardrobeDeleteResultComposer
extends MessageComposer
{
    private final int status;
    private final int slotId;

    public WardrobeDeleteResultComposer(
        int status,
        int slotId
    )
    {
        this.status = status;
        this.slotId = slotId;
    }

    @Override
    protected ServerMessage composeInternal()
    {
        this.response.init(
            BiribiriWardrobePlugin
                .PACKET_DELETE_RESULT
        );

        this.response.appendInt(
            this.status
        );

        this.response.appendInt(
            this.slotId
        );

        return this.response;
    }
}
