package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;
import com.retro.builderpro.BuilderProTraversalService;

import java.util.ArrayList;
import java.util.List;

public class TraversalStateRequest
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

        boolean enabled =
                this.packet.readBoolean();

        int count =
                this.packet.readInt()
                        .intValue();

        if(operation != BuilderProTraversalService.OP_QUERY)
        {
            BuilderProRateLimiter.Result rateLimit =
                    BuilderProRateLimiter.acquireItems(
                            this.client.getHabbo(),
                            "traversal-state",
                            count
                    );

            if(!rateLimit.allowed)
            {
                sendResult(
                        requestId,
                        BuilderProTraversalService.Result.failure(
                                98,
                                rateLimit.message,
                                new ArrayList<Integer>()
                        )
                );

                return;
            }
        }


        if(count < 0
                || count >
                BuilderProTraversalService.MAX_SELECTION)
        {
            sendResult(
                    requestId,
                    BuilderProTraversalService.Result.failure(
                            50,
                            "Cantidad de furnis invalida.",
                            new ArrayList<Integer>()
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

        BuilderProTraversalService.Result result =
                BuilderProTraversalService.execute(
                        this.client.getHabbo(),
                        operation,
                        enabled,
                        itemIds
                );

        sendResult(
                requestId,
                result
        );
    }

    private void sendResult(
            int requestId,
            BuilderProTraversalService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.TRAVERSAL_STATE_RESULT
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
