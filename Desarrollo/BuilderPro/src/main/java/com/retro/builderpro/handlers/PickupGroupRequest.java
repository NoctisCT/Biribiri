package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;
import com.retro.builderpro.GroupMoveService;

import java.util.ArrayList;
import java.util.List;

public class PickupGroupRequest
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

        BuilderProRateLimiter.Result rateLimit =
                BuilderProRateLimiter.acquireItems(
                        this.client.getHabbo(),
                        "pickup",
                        count
                );

        if(!rateLimit.allowed)
        {
            sendResult(
                    requestId,
                    BuilderProHistoryService.Result.failure(
                            98,
                            rateLimit.message,
                            BuilderProHistoryService.canUndo(
                                    this.client.getHabbo()
                            ),
                            BuilderProHistoryService.canRedo(
                                    this.client.getHabbo()
                            )
                    )
            );

            return;
        }


        if(count < 1
                || count > GroupMoveService.MAX_GROUP_SIZE)
        {
            sendResult(
                    requestId,
                    BuilderProHistoryService.Result.failure(
                            90,
                            "Cantidad de furnis invalida.",
                            false,
                            false
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

        BuilderProHistoryService.Result result =
                BuilderProHistoryService.pickupSelection(
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
            BuilderProHistoryService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.PICKUP_GROUP_RESULT
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
                result.affectedCount
        );

        response.appendBoolean(
                result.canUndo
        );

        response.appendBoolean(
                result.canRedo
        );

        this.client.sendResponse(
                response
        );
    }
}
