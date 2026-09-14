package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProGroupGuard;
import com.retro.builderpro.BuilderProItemLockGuard;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;
import com.retro.builderpro.GroupOffsetService;

import java.util.ArrayList;
import java.util.List;

public class OffsetGroupRequest
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
                        "offset",
                        count
                );

        if(!rateLimit.allowed)
        {
            sendResult(
                    requestId,
                    GroupOffsetService.Result.failure(
                            98,
                            rateLimit.message
                    )
            );

            return;
        }


        if(count < 1
                || count > GroupOffsetService.MAX_GROUP_SIZE)
        {
            sendResult(
                    requestId,
                    GroupOffsetService.Result.failure(
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

        int deltaX =
                this.packet
                        .readInt()
                        .intValue();

        int deltaY =
                this.packet
                        .readInt()
                        .intValue();

        int deltaZMillis =
                this.packet
                        .readInt()
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
                    GroupOffsetService.Result.failure(
                            32,
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
                    GroupOffsetService.Result.failure(
                            33,
                            itemLockGuard.message
                    )
            );

            return;
        }

        List<BuilderProHistoryService.ItemState> historyBefore =
                BuilderProHistoryService.capture(
                        this.client.getHabbo(),
                        itemIds
                );

        if(historyBefore == null)
        {
            sendResult(
                    requestId,
                    GroupOffsetService.Result.failure(
                            31,
                            "No se pudo capturar el estado inicial."
                    )
            );

            return;
        }

        GroupOffsetService.Result result =
                GroupOffsetService.offset(
                        this.client.getHabbo(),
                        itemIds,
                        deltaX,
                        deltaY,
                        deltaZMillis,
                        requestId
                );

        if(result.success)
        {
            List<BuilderProHistoryService.ItemState> historyAfter =
                    BuilderProHistoryService.capture(
                            this.client.getHabbo(),
                            itemIds
                    );

            if(historyAfter != null)
            {
                BuilderProHistoryService.record(
                        this.client.getHabbo(),
                        historyBefore,
                        historyAfter,
                        "Offset numerico"
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
            GroupOffsetService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.OFFSET_GROUP_RESULT
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

        this.client.sendResponse(
                response
        );
    }
}
