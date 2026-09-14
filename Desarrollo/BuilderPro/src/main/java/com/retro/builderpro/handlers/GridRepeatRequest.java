package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProGroupGuard;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;
import com.retro.builderpro.GridRepeatService;

import java.util.ArrayList;
import java.util.List;

public class GridRepeatRequest
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

        int columns =
                this.packet
                        .readInt()
                        .intValue();

        int rows =
                this.packet
                        .readInt()
                        .intValue();

        int spacingX =
                this.packet
                        .readInt()
                        .intValue();

        int spacingY =
                this.packet
                        .readInt()
                        .intValue();

        int count =
                this.packet
                        .readInt()
                        .intValue();

        if(count < 1
                || count > GridRepeatService.MAX_TOTAL_ITEMS)
        {
            sendResult(
                    requestId,
                    operation,
                    columns,
                    rows,
                    GridRepeatService.Result.failure(
                            40,
                            "Cantidad de furnis invalida.",
                            0
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
                    columns,
                    rows,
                    GridRepeatService.Result.failure(
                            41,
                            groupGuard.message,
                            0
                    )
            );

            return;
        }

        GridRepeatService.Result result =
                GridRepeatService.process(
                        this.client.getHabbo(),
                        itemIds,
                        operation,
                        columns,
                        rows,
                        spacingX,
                        spacingY,
                        requestId
                );

        if(result.success
                && operation
                == GridRepeatService.OP_EXECUTE)
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
                        "Repeticion en cuadricula"))
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
                columns,
                rows,
                result
        );
    }

    private void sendResult(
            int requestId,
            int operation,
            int columns,
            int rows,
            GridRepeatService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.GRID_REPEAT_RESULT
                );

        response.appendInt(requestId);
        response.appendInt(operation);
        response.appendBoolean(result.success);
        response.appendInt(result.code);
        response.appendString(result.message);
        response.appendInt(columns);
        response.appendInt(rows);
        response.appendInt(result.placedCount);
        response.appendInt(result.previewEntries.size());

        for(GridRepeatService.PreviewEntry entry :
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
