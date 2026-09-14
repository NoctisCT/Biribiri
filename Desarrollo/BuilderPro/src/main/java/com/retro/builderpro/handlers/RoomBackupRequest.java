package com.retro.builderpro.handlers;

import com.eu.habbo.messages.ServerMessage;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.retro.builderpro.BuilderProPackets;
import com.retro.builderpro.BuilderProRateLimiter;
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

        if(operation != BuilderProRoomBackupService.OP_LIST)
        {
            BuilderProRateLimiter.Result rateLimit =
                    BuilderProRateLimiter.acquire(
                            this.client.getHabbo(),
                            operation == BuilderProRoomBackupService.OP_RESTORE
                                    ? "backup-restore"
                                    : "backup-mutation",
                            operation == BuilderProRoomBackupService.OP_RESTORE
                                    ? BuilderProRateLimiter.BACKUP_RESTORE_MS
                                    : BuilderProRateLimiter.BACKUP_MUTATION_MS
                    );

            if(!rateLimit.allowed)
            {
                BuilderProRoomBackupService.Result current =
                        BuilderProRoomBackupService.execute(
                                this.client.getHabbo(),
                                BuilderProRoomBackupService.OP_LIST,
                                0,
                                0,
                                "",
                                ""
                        );

                BuilderProRoomBackupService.Result limited =
                        BuilderProRoomBackupService.Result.failure(
                                98,
                                rateLimit.message,
                                current.backups
                        );

                ServerMessage limitedResponse =
                        new ServerMessage(
                                BuilderProPackets.ROOM_BACKUP_RESULT
                        );

                limitedResponse.appendInt(requestId);
                limitedResponse.appendBoolean(limited.success);
                limitedResponse.appendInt(limited.code);
                limitedResponse.appendString(limited.message);
                limitedResponse.appendInt(limited.restoredRoomId);
                limitedResponse.appendInt(limited.backups.size());

                for(BuilderProRoomBackupRepository.Summary backup :
                        limited.backups)
                {
                    limitedResponse.appendInt(backup.id);
                    limitedResponse.appendInt(backup.originalRoomId);
                    limitedResponse.appendInt(backup.activeRoomId);
                    limitedResponse.appendString(backup.roomName);
                    limitedResponse.appendInt(backup.itemCount);
                    limitedResponse.appendString(backup.updatedAt);
                    limitedResponse.appendBoolean(backup.roomExists);
                }

                this.client.sendResponse(
                        limitedResponse
                );

                return;
            }
        }

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
