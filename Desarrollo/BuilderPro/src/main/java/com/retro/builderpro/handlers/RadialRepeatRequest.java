package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProGroupGuard;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;
import com.retro.builderpro.RadialRepeatService;

import java.util.ArrayList;
import java.util.List;

public class RadialRepeatRequest
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

        int operation =
                this.packet
                        .readInt()
                        .intValue();

        int copies =
                this.packet
                        .readInt()
                        .intValue();

        int totalAngle =
                this.packet
                        .readInt()
                        .intValue();

        int radius =
                this.packet
                        .readInt()
                        .intValue();

        boolean rotateWithPattern =
                this.packet
                        .readInt()
                        .intValue() != 0;

        int pivotId =
                this.packet
                        .readInt()
                        .intValue();

        int count =
                this.packet
                        .readInt()
                        .intValue();

        if(count < 1
                || count > RadialRepeatService.MAX_TOTAL_ITEMS)
        {
            sendResult(
                    requestId,
                    operation,
                    copies,
                    totalAngle,
                    radius,
                    rotateWithPattern,
                    pivotId,
                    RadialRepeatService.Result.failure(
                            40,
                            "Cantidad de furnis invalida.",
                            copies
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

        BuilderProGroupGuard.Result groupGuard =
                BuilderProGroupGuard.validate(
                        this.client.getHabbo(),
                        itemIds
                );

        if(!groupGuard.success)
        {
            sendResult(
                    requestId,
                    operation,
                    copies,
                    totalAngle,
                    radius,
                    rotateWithPattern,
                    pivotId,
                    RadialRepeatService.Result.failure(
                            41,
                            groupGuard.message,
                            copies
                    )
            );

            return;
        }

        RadialRepeatService.Result result =
                RadialRepeatService.process(
                        this.client.getHabbo(),
                        itemIds,
                        operation,
                        copies,
                        totalAngle,
                        radius,
                        rotateWithPattern,
                        pivotId,
                        requestId
                );

        if(result.success
                && operation
                == RadialRepeatService.OP_EXECUTE)
        {
            List<BuilderProHistoryService.ItemState> placedStates =
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
                        "Patron radial"))
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
                operation,
                copies,
                totalAngle,
                radius,
                rotateWithPattern,
                pivotId,
                result
        );
    }

    private void sendResult(
            int requestId,
            int operation,
            int copies,
            int totalAngle,
            int radius,
            boolean rotateWithPattern,
            int pivotId,
            RadialRepeatService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.RADIAL_REPEAT_RESULT
                );

        response.appendInt(requestId);
        response.appendInt(operation);
        response.appendBoolean(result.success);
        response.appendInt(result.code);
        response.appendString(result.message);
        response.appendInt(copies);
        response.appendInt(totalAngle);
        response.appendInt(radius);
        response.appendBoolean(rotateWithPattern);
        response.appendInt(pivotId);
        response.appendInt(result.placedCount);
        response.appendInt(result.previewEntries.size());

        for(RadialRepeatService.PreviewEntry entry :
                result.previewEntries)
        {
            response.appendInt(entry.baseItemId);
            response.appendInt(entry.x);
            response.appendInt(entry.y);
            response.appendString(Double.toString(entry.z));
            response.appendInt(entry.rotation);
            response.appendString(entry.extraData);
        }

        response.appendInt(result.itemIds.size());

        for(Integer itemId :
                result.itemIds)
        {
            response.appendInt(itemId.intValue());
        }

        this.client.sendResponse(response);
    }
}
