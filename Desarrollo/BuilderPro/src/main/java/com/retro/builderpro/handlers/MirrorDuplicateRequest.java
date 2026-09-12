package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProGroupGuard;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.CopyGroupService;
import com.retro.builderpro.MirrorDuplicateService;

import java.util.ArrayList;
import java.util.List;

public class MirrorDuplicateRequest
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

        int axis =
                this.packet.readInt()
                        .intValue();

        int pivotId =
                this.packet.readInt()
                        .intValue();

        int count =
                this.packet.readInt()
                        .intValue();

        if(count < 1
                || count > CopyGroupService.MAX_GROUP_SIZE)
        {
            sendResult(
                    requestId,
                    MirrorDuplicateService.Result.failure(
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
                    MirrorDuplicateService.Result.failure(
                            31,
                            "Faltan orientaciones reflejadas."
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

        BuilderProGroupGuard.Result groupGuard =
                BuilderProGroupGuard.validate(
                        this.client.getHabbo(),
                        itemIds
                );

        if(!groupGuard.success)
        {
            sendResult(
                    requestId,
                    MirrorDuplicateService.Result.failure(
                            32,
                            groupGuard.message
                    )
            );

            return;
        }

        MirrorDuplicateService.Result result =
                MirrorDuplicateService.prepare(
                        this.client.getHabbo(),
                        itemIds,
                        axis,
                        pivotId,
                        targetRotations
                );

        sendResult(
                requestId,
                result
        );
    }

    private void sendResult(
            int requestId,
            MirrorDuplicateService.Result result)
    {
        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.MIRROR_DUPLICATE_RESULT
                );

        response.appendInt(requestId);
        response.appendBoolean(result.success);
        response.appendInt(result.code);
        response.appendString(result.message);
        response.appendInt(result.preparedCount());

        CopyGroupService.Clipboard clipboard =
                result.clipboard;

        if(clipboard == null)
        {
            response.appendString("0");
            response.appendInt(0);
        }
        else
        {
            response.appendString(
                    Double.toString(
                            clipboard.getSourceOriginZ()
                    )
            );

            response.appendInt(
                    clipboard.size()
            );

            for(CopyGroupService.Entry entry :
                    clipboard.getEntries())
            {
                response.appendInt(entry.getBaseItemId());
                response.appendInt(entry.getOffsetX());
                response.appendInt(entry.getOffsetY());
                response.appendString(
                        Double.toString(
                                entry.getOffsetZ()
                        )
                );
                response.appendInt(entry.getRotation());
                response.appendString(entry.getExtraData());
            }
        }

        this.client.sendResponse(
                response
        );
    }
}
