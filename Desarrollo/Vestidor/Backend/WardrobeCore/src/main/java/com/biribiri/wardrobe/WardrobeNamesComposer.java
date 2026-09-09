package com.biribiri.wardrobe;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.outgoing.MessageComposer;

import java.util.Map;

public final class WardrobeNamesComposer extends MessageComposer
{
    private final Map<Integer, String> names;

    public WardrobeNamesComposer(
        Map<Integer, String> names
    )
    {
        this.names = names;
    }

    @Override
    protected ServerMessage composeInternal()
    {
        this.response.init(
            BiribiriWardrobePlugin.PACKET_NAMES_RESPONSE
        );

        int count =
            this.names == null
                ? 0
                : this.names.size();

        this.response.appendInt(count);

        if(this.names != null)
        {
            for(
                Map.Entry<Integer, String> entry
                : this.names.entrySet()
            )
            {
                this.response.appendInt(entry.getKey());
                this.response.appendString(entry.getValue());
            }
        }

        return this.response;
    }
}
