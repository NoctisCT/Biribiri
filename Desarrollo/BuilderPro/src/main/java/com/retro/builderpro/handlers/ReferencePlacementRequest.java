package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProGroupGuard;
import com.retro.builderpro.BuilderProItemLockGuard;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;
import com.retro.builderpro.BuilderProReferencePlacementService;
import com.retro.builderpro.GroupOffsetService;

import java.util.ArrayList;
import java.util.List;

public class ReferencePlacementRequest
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

        int operation =
                this.packet.readInt().intValue();

        int referenceId =
                this.packet.readInt().intValue();

        int pivotId =
                this.packet.readInt().intValue();

        int count =
                this.packet.readInt().intValue();

        BuilderProRateLimiter.Result rateLimit =
                BuilderProRateLimiter.acquireItems(
                        this.client.getHabbo(),
                        "reference",
                        count
                );

        if(!rateLimit.allowed)
        {
            sendResult(
                    requestId,
                    BuilderProReferencePlacementService.Result.failure(
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
                    BuilderProReferencePlacementService.Result.failure(
                            30,
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
                    this.packet.readInt().intValue()
            );
        }

        BuilderProGroupGuard.Result groupGuard =
                BuilderProGroupGuard.validate(
                        this.client.getHabbo(),
                        itemIds
                );

        if(!groupGuard.success)
        {
            sendResult(
                    requestId,
                    BuilderProReferencePlacementService.Result.failure(
                            31,
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
                    BuilderProReferencePlacementService.Result.failure(
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
                    BuilderProReferencePlacementService.Result.failure(
                            32,
                            "No se pudo capturar el estado inicial."
                    )
            );

            return;
        }

        BuilderProReferencePlacementService.Result result =
                BuilderProReferencePlacementService.apply(
                        this.client.getHabbo(),
                        itemIds,
                        operation,
                        referenceId,
                        pivotId,
                        requestId
                );

        if(result.success
                && result.affectedCount > 0)
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
                        operation
                                == BuilderProReferencePlacementService.OP_EQUAL_Z
                                ? "Igualar altura"
                                : "Colocar encima"
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
            BuilderProReferencePlacementService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.OFFSET_GROUP_RESULT
                );

        response.appendInt(requestId);
        response.appendBoolean(result.success);
        response.appendInt(result.code);
        response.appendString(result.message);
        response.appendInt(result.affectedCount);

        this.client.sendResponse(response);
    }
}
