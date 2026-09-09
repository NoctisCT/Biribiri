package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.GroupMoveService;

import java.util.ArrayList;
import java.util.List;

public class MoveGroupRequest
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

        int count =
                this.packet
                        .readInt()
                        .intValue();

        if(count < 1
                || count > GroupMoveService.MAX_GROUP_SIZE)
        {
            sendResult(
                    GroupMoveService.Result.failure(
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

        GroupMoveService.Result result =
                GroupMoveService.move(
                        this.client.getHabbo(),
                        itemIds,
                        deltaX,
                        deltaY
                );

        sendResult(result);
    }

    private void sendResult(
            GroupMoveService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.MOVE_GROUP_RESULT
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
                result.movedCount
        );

        this.client.sendResponse(
                response
        );
    }
}
