package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;

public class HistoryRequest
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

        int action =
                this.packet
                        .readInt()
                        .intValue();

        BuilderProHistoryService.Result result =
                BuilderProHistoryService.execute(
                        this.client.getHabbo(),
                        action
                );

        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.HISTORY_RESULT
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
