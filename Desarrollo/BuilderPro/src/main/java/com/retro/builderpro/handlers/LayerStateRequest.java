package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProLayerRepository;
import com.retro.builderpro.BuilderProLayerService;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;

import java.util.ArrayList;
import java.util.List;

public class LayerStateRequest
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

        int layerId =
                this.packet.readInt().intValue();

        String name =
                this.packet.readString();

        int count =
                this.packet.readInt().intValue();

        if(operation != BuilderProLayerService.OP_LIST)
        {
            BuilderProRateLimiter.Result rateLimit =
                    BuilderProRateLimiter.acquireItems(
                            this.client.getHabbo(),
                            "layer-state",
                            count
                    );

            if(!rateLimit.allowed)
            {
                sendResult(
                        requestId,
                        BuilderProLayerService.Result.failure(
                                98,
                                rateLimit.message,
                                new ArrayList<BuilderProLayerRepository.SavedLayer>()
                        )
                );

                return;
            }
        }


        if(count < 0
                || count >
                BuilderProLayerService.MAX_BATCH_SIZE)
        {
            sendResult(
                    requestId,
                    BuilderProLayerService.Result.failure(
                            50,
                            "Cantidad de furnis invalida.",
                            new ArrayList<BuilderProLayerRepository.SavedLayer>()
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

        BuilderProLayerService.Result result =
                BuilderProLayerService.execute(
                        this.client.getHabbo(),
                        operation,
                        layerId,
                        name,
                        itemIds
                );

        sendResult(requestId, result);
    }

    private void sendResult(
            int requestId,
            BuilderProLayerService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.LAYER_STATE_RESULT
                );

        response.appendInt(requestId);
        response.appendBoolean(result.success);
        response.appendInt(result.code);
        response.appendString(result.message);
        response.appendInt(result.layers.size());

        for(BuilderProLayerRepository.SavedLayer layer :
                result.layers)
        {
            response.appendInt(layer.id);
            response.appendString(layer.name);
            response.appendInt(layer.sortOrder);
            response.appendInt(layer.itemIds.size());

            for(Integer itemId : layer.itemIds)
            {
                response.appendInt(
                        itemId.intValue()
                );
            }
        }

        this.client.sendResponse(response);
    }
}
