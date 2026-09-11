package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProGroupGuard;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.GroupTransformService;

import java.util.ArrayList;
import java.util.List;

public class TransformGroupRequest
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

        int argument =
                this.packet
                        .readInt()
                        .intValue();

        int count =
                this.packet
                        .readInt()
                        .intValue();

        System.out.println(
                "[BuilderProTrace] SERVER TRANSFORM_RECEIVE #"
                        + requestId
                        + " op="
                        + operation
                        + " arg="
                        + argument
                        + " count="
                        + count
        );

        if(count < 1
                || count > GroupTransformService.MAX_GROUP_SIZE)
        {
            sendResult(
                    requestId,
                    GroupTransformService.Result.failure(
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

        int rotationCount =
                this.packet
                        .readInt()
                        .intValue();

        if(rotationCount < 0
                || rotationCount > count)
        {
            sendResult(
                    requestId,
                    GroupTransformService.Result.failure(
                            31,
                            "Cantidad de orientaciones invalida."
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
                    this.packet
                            .readInt()
                            .intValue()
            );
        }

        if(operation == GroupTransformService.OP_ORIENT
                && rotationCount != count)
        {
            sendResult(
                    requestId,
                    GroupTransformService.Result.failure(
                            32,
                            "Faltan orientaciones exactas."
                    )
            );

            return;
        }

        if(operation != GroupTransformService.OP_ORIENT
                && rotationCount != 0)
        {
            sendResult(
                    requestId,
                    GroupTransformService.Result.failure(
                            33,
                            "Esta transformacion no admite orientaciones individuales."
                    )
            );

            return;
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
                    GroupTransformService.Result.failure(
                            34,
                            groupGuard.message
                    )
            );

            return;
        }

        boolean stateOperation =
                operation == GroupTransformService.OP_STATE_PREVIOUS
                || operation == GroupTransformService.OP_STATE_NEXT;

        List<BuilderProHistoryService.ItemState> historyBefore =
                BuilderProHistoryService.capture(
                        this.client.getHabbo(),
                        itemIds
                );

        GroupTransformService.Result result =
                GroupTransformService.transform(
                        this.client.getHabbo(),
                        itemIds,
                        operation,
                        argument,
                        targetRotations,
                        requestId
                );

        if(result.success
                && historyBefore != null
                && (
                    !stateOperation
                    || result.transformedCount > 0
                ))
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
                        stateOperation
                                ? "Estado"
                                : "Transformacion"
                );
            }
        }

        System.out.println(
                "[BuilderProTrace] SERVER TRANSFORM_RESULT #"
                        + requestId
                        + " success="
                        + result.success
                        + " code="
                        + result.code
                        + " transformed="
                        + result.transformedCount
        );

        sendResult(
                requestId,
                result
        );
    }

    private void sendResult(
            int requestId,
            GroupTransformService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.TRANSFORM_GROUP_RESULT
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
                result.transformedCount
        );

        this.client.sendResponse(
                response
        );
    }
}
