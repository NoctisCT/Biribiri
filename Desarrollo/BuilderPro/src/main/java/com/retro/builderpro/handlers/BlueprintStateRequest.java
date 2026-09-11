package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProBlueprintRepository;
import com.retro.builderpro.BuilderProBlueprintService;
import com.retro.builderpro.BuilderProHistoryService;
import com.retro.builderpro.BuilderProPackets;

import java.util.ArrayList;
import java.util.List;

public class BlueprintStateRequest
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

        int blueprintId =
                this.packet.readInt()
                        .intValue();

        String name =
                this.packet.readString();

        int anchorX =
                this.packet.readInt()
                        .intValue();

        int anchorY =
                this.packet.readInt()
                        .intValue();

        int count =
                this.packet.readInt()
                        .intValue();

        if(count < 0
                || count >
                BuilderProBlueprintService.MAX_BLUEPRINT_SIZE)
        {
            sendResult(
                    requestId,
                    BuilderProBlueprintService.Result.failure(
                            50,
                            "Cantidad de furnis invalida.",
                            new ArrayList<BuilderProBlueprintRepository.SavedBlueprint>()
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

        BuilderProBlueprintService.Result result =
                BuilderProBlueprintService.execute(
                        this.client.getHabbo(),
                        operation,
                        blueprintId,
                        name,
                        anchorX,
                        anchorY,
                        itemIds
                );

        if(
            operation == BuilderProBlueprintService.OP_PLACE &&
            result.success
        )
        {
            List<BuilderProHistoryService.ItemState> placedStates =
                    BuilderProHistoryService.capture(
                            this.client.getHabbo(),
                            result.placedItemIds
                    );

            if(
                placedStates != null &&
                placedStates.size() ==
                result.placedItemIds.size()
            )
            {
                BuilderProHistoryService.recordPlacement(
                        this.client.getHabbo(),
                        placedStates,
                        "Blueprint"
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
                operation,
                blueprintId,
                result
        );
    }

    private void sendResult(
            int requestId,
            BuilderProBlueprintService.Result result)
    {
        sendResult(
                requestId,
                -1,
                0,
                result
        );
    }

    private void sendResult(
            int requestId,
            int operation,
            int blueprintId,
            BuilderProBlueprintService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.BLUEPRINT_STATE_RESULT
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
                result.blueprints.size()
        );

        for(BuilderProBlueprintRepository.SavedBlueprint blueprint :
                result.blueprints)
        {
            response.appendInt(
                    blueprint.id
            );

            response.appendString(
                    blueprint.name
            );

            response.appendInt(
                    blueprint.itemCount
            );
        }

        response.appendInt(
                result.placedItemIds.size()
        );

        for(Integer itemId :
                result.placedItemIds)
        {
            response.appendInt(
                    itemId.intValue()
            );
        }

        BuilderProBlueprintRepository.StoredBlueprint preview =
                null;

        if(
            result.success &&
            operation ==
            BuilderProBlueprintService.OP_PREVIEW
        )
        {
            try
            {
                preview =
                        BuilderProBlueprintRepository.find(
                                this.client.getHabbo()
                                        .getHabboInfo()
                                        .getId(),
                                blueprintId
                        );
            }
            catch(Exception exception)
            {
                preview = null;
            }
        }

        if(
            preview == null ||
            preview.items == null ||
            preview.items.isEmpty() ||
            preview.items.size() >
            BuilderProBlueprintService.MAX_BLUEPRINT_SIZE
        )
        {
            response.appendInt(0);
            response.appendInt(0);
        }
        else
        {
            response.appendInt(
                    preview.id
            );

            response.appendInt(
                    preview.items.size()
            );

            for(BuilderProBlueprintRepository.BlueprintItem item :
                    preview.items)
            {
                response.appendInt(
                        item.baseItemId
                );

                response.appendInt(
                        item.offsetX
                );

                response.appendInt(
                        item.offsetY
                );

                response.appendString(
                        Double.toString(
                                item.offsetZ
                        )
                );

                response.appendInt(
                        item.rotation
                );
            }
        }

        this.client.sendResponse(
                response
        );
    }
}
