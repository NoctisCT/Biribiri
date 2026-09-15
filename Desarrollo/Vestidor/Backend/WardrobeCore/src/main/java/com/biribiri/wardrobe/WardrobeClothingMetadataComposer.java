package com.biribiri.wardrobe;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.MessageComposer;

import java.util.Collections;
import java.util.List;

public final class WardrobeClothingMetadataComposer
extends MessageComposer
{
    private final List<WardrobeManager.ClothingMetadata> metadata;

    public WardrobeClothingMetadataComposer(
        List<WardrobeManager.ClothingMetadata> metadata
    )
    {
        this.metadata =
            metadata == null
                ? Collections.emptyList()
                : metadata;
    }

    @Override
    protected ServerMessage composeInternal()
    {
        this.response.init(
            BiribiriWardrobePlugin
                .PACKET_CLOTHING_METADATA_RESPONSE
        );

        this.response.appendInt(
            this.metadata.size()
        );

        for(
            WardrobeManager.ClothingMetadata item :
            this.metadata
        )
        {
            this.response.appendString(
                item.getFigureType()
            );

            // EvaWire transporta int32 signed.
            // El cliente lo recupera como uint32 con >>> 0.
            this.response.appendInt(
                (int)item.getFigureSetId()
            );

            this.response.appendString(
                item.getDisplayName()
            );

            List<String> tags =
                item.getTags();

            this.response.appendInt(
                tags.size()
            );

            for(String tag : tags)
            {
                this.response.appendString(
                    tag
                );
            }
        }

        return this.response;
    }
}
