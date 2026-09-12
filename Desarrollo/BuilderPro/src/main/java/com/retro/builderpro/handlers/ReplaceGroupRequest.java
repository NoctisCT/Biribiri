package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProGroupGuard;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.ReplaceGroupService;

import java.util.ArrayList;
import java.util.List;

public class ReplaceGroupRequest
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
                this.packet.readInt()
                        .intValue();

        int operation =
                this.packet.readInt()
                        .intValue();

        int referenceId =
                this.packet.readInt()
                        .intValue();

        int count =
                this.packet.readInt()
                        .intValue();

        if(count < 1
                || count > ReplaceGroupService.MAX_GROUP_SIZE)
        {
            sendResult(
                    requestId,
                    operation,
                    ReplaceGroupService.Result.failure(
                            50,
                            "Cantidad de furnis invalida.",
                            0,
                            0,
                            referenceId,
                            0,
                            ""
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
                    this.packet.readInt()
                            .intValue()
            );
        }

        int rotationCount =
                this.packet.readInt()
                        .intValue();

        if(rotationCount != count)
        {
            sendResult(
                    requestId,
                    operation,
                    ReplaceGroupService.Result.failure(
                            51,
                            "Faltan orientaciones compatibles.",
                            count,
                            0,
                            referenceId,
                            0,
                            ""
                    )
            );

            return;
        }

        List<Integer> targetRotations =
                new ArrayList<Integer>(
                        rotationCount
                );

        for(int index = 0;
                index < rotationCount;
                index++)
        {
            targetRotations.add(
                    this.packet.readInt()
                            .intValue()
            );
        }

        if(operation != ReplaceGroupService.OP_PREVIEW
                && operation != ReplaceGroupService.OP_EXECUTE)
        {
            sendResult(
                    requestId,
                    operation,
                    ReplaceGroupService.Result.failure(
                            52,
                            "Operacion de reemplazo desconocida.",
                            count,
                            0,
                            referenceId,
                            0,
                            ""
                    )
            );

            return;
        }

        BuilderProGroupGuard.Result guard =
                BuilderProGroupGuard.validate(
                        this.client.getHabbo(),
                        itemIds
                );

        if(!guard.success)
        {
            sendResult(
                    requestId,
                    operation,
                    ReplaceGroupService.Result.failure(
                            53,
                            guard.message,
                            count,
                            0,
                            referenceId,
                            0,
                            ""
                    )
            );

            return;
        }

        ReplaceGroupService.Result result =
                operation == ReplaceGroupService.OP_PREVIEW
                        ? ReplaceGroupService.preview(
                                this.client.getHabbo(),
                                itemIds,
                                referenceId,
                                targetRotations
                        )
                        : ReplaceGroupService.execute(
                                this.client.getHabbo(),
                                itemIds,
                                referenceId,
                                targetRotations
                        );

        sendResult(
                requestId,
                operation,
                result
        );
    }

    private void sendResult(
            int requestId,
            int operation,
            ReplaceGroupService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.REPLACE_GROUP_RESULT
                );

        response.appendInt(requestId);
        response.appendInt(operation);
        response.appendBoolean(result.success);
        response.appendInt(result.code);
        response.appendString(result.message);
        response.appendInt(result.needed);
        response.appendInt(result.available);
        response.appendInt(result.referenceId);
        response.appendInt(result.referenceBaseItemId);
        response.appendString(result.referenceName);
        response.appendInt(result.affectedCount);

        response.appendInt(
                result.itemIds.size()
        );

        for(Integer itemId :
                result.itemIds)
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
