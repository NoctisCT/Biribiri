package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.PasteGroupService;

public class PasteGroupRequest
        extends MessageHandler
{
    @Override
    public void handle()
    {
        if(this.client == null
                || this.client.getHabbo() == null)
        {
            return;
        }

        int requestId =
                this.packet
                        .readInt()
                        .intValue();

        int anchorX =
                this.packet
                        .readInt()
                        .intValue();

        int anchorY =
                this.packet
                        .readInt()
                        .intValue();

        PasteGroupService.Result result =
                PasteGroupService.paste(
                        this.client.getHabbo(),
                        anchorX,
                        anchorY,
                        requestId
                );

        if(result.success)
        {
            java.util.List<BuilderProHistoryService.ItemState> placedStates =
                    BuilderProHistoryService.capture(
                            this.client.getHabbo(),
                            result.itemIds
                    );

            if(placedStates != null
                    && placedStates.size()
                    == result.itemIds.size())
            {
                if(!BuilderProHistoryService.recordPlacementWithMetadata(
                        this.client.getHabbo(),
                        placedStates,
                        "Pegado"))
                {
                    BuilderProHistoryService.invalidate(
                            this.client.getHabbo()
                    );
                }
            }
            else
            {
                BuilderProHistoryService.invalidate(
                        this.client.getHabbo()
                );
            }
        }

        sendResult(
                requestId,
                result
        );
    }

    private void sendResult(
            int requestId,
            PasteGroupService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.PASTE_GROUP_RESULT
                );

        response.appendInt(
                requestId
        );

        response.appendBoolean(
                result.success
        );

        response.appendInt(
                result.code
        );

        response.appendString(
                result.message
        );

        response.appendInt(
                result.placedCount
        );

        response.appendInt(
                result.itemIds.size()
        );

        for(Integer itemId : result.itemIds)
        {
            response.appendInt(
                    itemId.intValue()
            );
        }

        this.client.sendResponse(
                response
        );
    }
}
