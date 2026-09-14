package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRoomBackupRepository;
import com.retro.builderpro.BuilderProRoomBackupService;

public class RoomBackupRequest
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

        int backupId =
                this.packet.readInt().intValue();

        int roomId =
                this.packet.readInt().intValue();

        String pin =
                this.packet.readString();

        String newPin =
                this.packet.readString();

        BuilderProRoomBackupService.Result result =
                BuilderProRoomBackupService.execute(
                        this.client.getHabbo(),
                        operation,
                        backupId,
                        roomId,
                        pin,
                        newPin
                );

        ServerMessage response =
                new ServerMessage(
                        BuilderProPackets.ROOM_BACKUP_RESULT
                );

        response.appendInt(requestId);
        response.appendBoolean(result.success);
        response.appendInt(result.code);
        response.appendString(result.message);
        response.appendInt(result.restoredRoomId);
        response.appendInt(result.backups.size());

        for(BuilderProRoomBackupRepository.Summary backup :
                result.backups)
        {
            response.appendInt(backup.id);
            response.appendInt(backup.originalRoomId);
            response.appendInt(backup.activeRoomId);
            response.appendString(backup.roomName);
            response.appendInt(backup.itemCount);
            response.appendString(backup.updatedAt);
            response.appendBoolean(backup.roomExists);
        }

        this.client.sendResponse(response);
    }
}
