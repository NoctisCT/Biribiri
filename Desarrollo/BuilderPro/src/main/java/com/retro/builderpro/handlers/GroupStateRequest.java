package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProGroupRepository;
import com.retro.builderpro.BuilderProGroupService;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;

import java.util.ArrayList;
import java.util.List;

public class GroupStateRequest
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

        int groupId =
                this.packet.readInt()
                        .intValue();

        String name =
                this.packet.readString();

        boolean locked =
                this.packet.readBoolean();

        int count =
                this.packet.readInt()
                        .intValue();

        if(operation != BuilderProGroupService.OP_LIST)
        {
            BuilderProRateLimiter.Result rateLimit =
                    BuilderProRateLimiter.acquireItems(
                            this.client.getHabbo(),
                            "group-state",
                            count
                    );

            if(!rateLimit.allowed)
            {
                sendResult(
                        requestId,
                        BuilderProGroupService.Result.failure(
                                98,
                                rateLimit.message,
                                new ArrayList<BuilderProGroupRepository.SavedGroup>()
                        )
                );

                return;
            }
        }


        if(count < 0
                || count >
                BuilderProGroupService.MAX_GROUP_SIZE)
        {
            sendResult(
                    requestId,
                    BuilderProGroupService.Result.failure(
                            50,
                            "Cantidad de miembros invalida.",
                            new ArrayList<BuilderProGroupRepository.SavedGroup>()
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

        BuilderProGroupService.Result result =
                BuilderProGroupService.execute(
                        this.client.getHabbo(),
                        operation,
                        groupId,
                        name,
                        locked,
                        itemIds
                );

        sendResult(
                requestId,
                result
        );
    }

    private void sendResult(
            int requestId,
            BuilderProGroupService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.GROUP_STATE_RESULT
                );

        response.appendInt(requestId);
        response.appendBoolean(result.success);
        response.appendInt(result.code);
        response.appendString(result.message);

        response.appendInt(
                result.groups.size()
        );

        for(BuilderProGroupRepository.SavedGroup group :
                result.groups)
        {
            response.appendInt(group.id);
            response.appendString(group.name);
            response.appendBoolean(group.locked);

            response.appendInt(
                    group.itemIds.size()
            );

            for(Integer itemId : group.itemIds)
            {
                response.appendInt(
                        itemId.intValue()
                );
            }
        }

        this.client.sendResponse(
                response
        );
    }
}
