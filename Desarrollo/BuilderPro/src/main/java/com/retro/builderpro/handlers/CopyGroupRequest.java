package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.CopyGroupService;

import java.util.ArrayList;
import java.util.List;

public class CopyGroupRequest
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

        int count =
                this.packet
                        .readInt()
                        .intValue();

        if(count < 1
                || count > CopyGroupService.MAX_GROUP_SIZE)
        {
            sendResult(
                    requestId,
                    CopyGroupService.Result.failure(
                            30,
                            "Cantidad de furnis invalida."
                    )
            );

            return;
        }

        List<Integer> itemIds =
                new ArrayList<Integer>(
                        count
                );

        for(int index = 0;
                index < count;
                index++)
        {
            itemIds.add(
                    this.packet
                            .readInt()
                            .intValue()
            );
        }

        CopyGroupService.Result result =
                CopyGroupService.copy(
                        this.client.getHabbo(),
                        itemIds
                );

        sendResult(
                requestId,
                result
        );
    }

    private void sendResult(
            int requestId,
            CopyGroupService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.COPY_GROUP_RESULT
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
                result.copiedCount
        );

        CopyGroupService.Clipboard clipboard =
                result.success
                        ? CopyGroupService.getClipboard(
                                this.client.getHabbo().getHabboInfo().getId()
                        )
                        : null;

        if(clipboard == null)
        {
            response.appendString("0");
            response.appendInt(0);
        }
        else
        {
            response.appendString(Double.toString(clipboard.getSourceOriginZ()));
            response.appendInt(clipboard.size());

            for(CopyGroupService.Entry entry : clipboard.getEntries())
            {
                response.appendInt(entry.getBaseItemId());
                response.appendInt(entry.getOffsetX());
                response.appendInt(entry.getOffsetY());
                response.appendString(Double.toString(entry.getOffsetZ()));
                response.appendInt(entry.getRotation());
            }
        }

        this.client.sendResponse(
                response
        );
    }
}
