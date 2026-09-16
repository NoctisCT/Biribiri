package com.biribiri.wardrobe;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.MessageComposer;

public final class WardrobeFolderMutationResultComposer
extends MessageComposer
{
    private final int action;
    private final int status;
    private final int folderId;
    private final int slotId;

    public WardrobeFolderMutationResultComposer(
        int action,
        int status,
        int folderId,
        int slotId
    )
    {
        this.action = action;
        this.status = status;
        this.folderId = folderId;
        this.slotId = slotId;
    }

    @Override
    protected ServerMessage composeInternal()
    {
        this.response.init(
            BiribiriWardrobePlugin.PACKET_FOLDER_MUTATION_RESULT
        );

        this.response.appendInt(this.action);
        this.response.appendInt(this.status);
        this.response.appendInt(this.folderId);
        this.response.appendInt(this.slotId);

        return this.response;
    }
}
