package com.biribiri.wardrobe;

import com.eu.habbo.messages.incoming.MessageHandler;

public final class WardrobeFolderMutationRequest
extends MessageHandler
{
    @Override
    public void handle() throws Exception
    {
        BiribiriWardrobePlugin plugin =
            BiribiriWardrobePlugin.getInstance();

        if(
            plugin == null ||
            this.client == null ||
            this.client.getHabbo() == null ||
            this.packet == null
        )
        {
            return;
        }

        int action = this.packet.readInt();
        int folderId = this.packet.readInt();
        int slotId = this.packet.readInt();
        String name = this.packet.readString();

        int status;

        switch(action)
        {
            case WardrobeManager.FOLDER_ACTION_CREATE:
                status =
                    plugin.getManager()
                        .createFolder(
                            this.client.getHabbo(),
                            name
                        );
                break;

            case WardrobeManager.FOLDER_ACTION_RENAME:
                status =
                    plugin.getManager()
                        .renameFolder(
                            this.client.getHabbo(),
                            folderId,
                            name
                        );
                break;

            case WardrobeManager.FOLDER_ACTION_DELETE:
                status =
                    plugin.getManager()
                        .deleteFolder(
                            this.client.getHabbo(),
                            folderId
                        );
                break;

            case WardrobeManager.FOLDER_ACTION_ASSIGN:
                status =
                    plugin.getManager()
                        .assignSlotToFolder(
                            this.client.getHabbo(),
                            folderId,
                            slotId
                        );
                break;

            default:
                status =
                    WardrobeManager.FOLDER_INVALID;
                break;
        }

        this.client.sendResponse(
            new WardrobeFolderMutationResultComposer(
                action,
                status,
                folderId,
                slotId
            )
        );

        plugin.getManager()
            .sendFolders(
                this.client
            );
    }

    @Override
    public int getRatelimit()
    {
        return 150;
    }
}
