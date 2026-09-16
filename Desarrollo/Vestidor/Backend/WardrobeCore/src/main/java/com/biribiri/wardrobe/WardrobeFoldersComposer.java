package com.biribiri.wardrobe;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.MessageComposer;

import java.util.List;
import java.util.Map;

public final class WardrobeFoldersComposer
extends MessageComposer
{
    private final boolean clubActive;
    private final List<WardrobeManager.WardrobeFolderData> folders;

    public WardrobeFoldersComposer(
        boolean clubActive,
        List<WardrobeManager.WardrobeFolderData> folders
    )
    {
        this.clubActive = clubActive;
        this.folders = folders;
    }

    @Override
    protected ServerMessage composeInternal()
    {
        this.response.init(
            BiribiriWardrobePlugin.PACKET_FOLDERS_RESPONSE
        );

        this.response.appendBoolean(
            this.clubActive
        );

        int count =
            this.folders == null
                ? 0
                : this.folders.size();

        this.response.appendInt(count);

        if(this.folders != null)
        {
            for(
                WardrobeManager.WardrobeFolderData folder
                : this.folders
            )
            {
                this.response.appendInt(
                    folder.getId()
                );

                this.response.appendString(
                    folder.getName()
                );

                Map<Integer, Integer> slots =
                    folder.getSlots();

                this.response.appendInt(
                    slots == null
                        ? 0
                        : slots.size()
                );

                if(slots != null)
                {
                    for(
                        Map.Entry<Integer, Integer> entry
                        : slots.entrySet()
                    )
                    {
                        this.response.appendInt(
                            entry.getKey()
                        );

                        this.response.appendInt(
                            entry.getValue()
                        );
                    }
                }
            }
        }

        return this.response;
    }
}
