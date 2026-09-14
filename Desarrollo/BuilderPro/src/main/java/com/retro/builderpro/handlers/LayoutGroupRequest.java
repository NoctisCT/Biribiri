package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProGroupGuard;
import com.retro.builderpro.BuilderProItemLockGuard;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;
import com.retro.builderpro.GroupLayoutService;

import java.util.ArrayList;
import java.util.List;

public class LayoutGroupRequest
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
                this.packet.readInt().intValue();

        int count =
                this.packet.readInt().intValue();

        BuilderProRateLimiter.Result rateLimit =
                BuilderProRateLimiter.acquireItems(
                        this.client.getHabbo(),
                        "layout",
                        count
                );

        if(!rateLimit.allowed)
        {
            sendResult(
                    requestId,
                    GroupLayoutService.Result.failure(
                            98,
                            rateLimit.message
                    )
            );

            return;
        }


        if(count < 2
                || count > GroupLayoutService.MAX_GROUP_SIZE)
        {
            sendResult(
                    requestId,
                    GroupLayoutService.Result.failure(
                            40,
                            "Cantidad de furnis invalida."
                    )
            );

            return;
        }

        List<Integer> itemIds =
                new ArrayList<Integer>(count);

        for(int index = 0;
                index < count;
                index++)
        {
            itemIds.add(
                    this.packet.readInt()
                            .intValue()
            );
        }

        int operation =
                this.packet.readInt()
                        .intValue();

        int pivotId =
                this.packet.readInt()
                        .intValue();

        int spacing =
                this.packet.readInt()
                        .intValue();

        BuilderProGroupGuard.Result groupGuard =
                BuilderProGroupGuard.validate(
                        this.client.getHabbo(),
                        itemIds
                );

        if(!groupGuard.success)
        {
            sendResult(
                    requestId,
                    GroupLayoutService.Result.failure(
                            42,
                            groupGuard.message
                    )
            );

            return;
        }

        BuilderProItemLockGuard.Result itemLockGuard =
                BuilderProItemLockGuard.validate(
                        this.client.getHabbo(),
                        itemIds
                );

        if(!itemLockGuard.success)
        {
            sendResult(
                    requestId,
                    GroupLayoutService.Result.failure(
                            43,
                            itemLockGuard.message
                    )
            );

            return;
        }

        List<BuilderProHistoryService.ItemState> before =
                BuilderProHistoryService.capture(
                        this.client.getHabbo(),
                        itemIds
                );

        if(before == null)
        {
            sendResult(
                    requestId,
                    GroupLayoutService.Result.failure(
                            41,
                            "No se pudo capturar el estado inicial."
                    )
            );

            return;
        }

        GroupLayoutService.Result result =
                GroupLayoutService.layout(
                        this.client.getHabbo(),
                        itemIds,
                        operation,
                        pivotId,
                        spacing,
                        requestId
                );

        if(result.success)
        {
            List<BuilderProHistoryService.ItemState> after =
                    BuilderProHistoryService.capture(
                            this.client.getHabbo(),
                            itemIds
                    );

            if(after != null)
            {
                BuilderProHistoryService.record(
                        this.client.getHabbo(),
                        before,
                        after,
                        GroupLayoutService.operationLabel(
                                operation
                        )
                );
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
            GroupLayoutService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.LAYOUT_GROUP_RESULT
                );

        response.appendInt(requestId);
        response.appendBoolean(result.success);
        response.appendInt(result.code);
        response.appendString(result.message);
        response.appendInt(result.affectedCount);

        this.client.sendResponse(response);
    }
}
