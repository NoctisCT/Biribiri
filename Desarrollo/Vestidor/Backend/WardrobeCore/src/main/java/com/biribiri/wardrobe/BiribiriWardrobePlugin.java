package com.biribiri.wardrobe;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.messages.ICallable;
import com.eu.habbo.messages.incoming.MessageHandler;
import com.eu.habbo.plugin.EventHandler;
import com.eu.habbo.plugin.EventListener;
import com.eu.habbo.plugin.HabboPlugin;
import com.eu.habbo.plugin.events.emulator.EmulatorLoadedEvent;

public final class BiribiriWardrobePlugin extends HabboPlugin implements EventListener
{
    public static final int PACKET_STATE_REQUEST = 6200;
    public static final int PACKET_STATE_RESPONSE = 6201;
    public static final int PACKET_NAMES_REQUEST = 6202;
    public static final int PACKET_NAMES_RESPONSE = 6203;
    public static final int PACKET_NAME_SAVE = 6204;
    public static final int PACKET_PURCHASE_REQUEST = 6205;
    public static final int PACKET_PURCHASE_RESULT = 6206;
    public static final int PACKET_CLOTHING_FAVORITES_REQUEST = 6207;
    public static final int PACKET_CLOTHING_FAVORITES_RESPONSE = 6208;
    public static final int PACKET_CLOTHING_FAVORITE_SET = 6209;
    public static final int PACKET_CLOTHING_METADATA_REQUEST = 6210;
    public static final int PACKET_CLOTHING_METADATA_RESPONSE = 6211;
    public static final int PACKET_DELETE_REQUEST = 6212;
    public static final int PACKET_DELETE_RESULT = 6213;
    public static final int PACKET_FOLDERS_REQUEST = 6214;
    public static final int PACKET_FOLDERS_RESPONSE = 6215;
    public static final int PACKET_FOLDER_MUTATION = 6216;
    public static final int PACKET_FOLDER_MUTATION_RESULT = 6217;
    // BIRIBIRI_WARDROBE_COMMUNITY_C1
    public static final int PACKET_COMMUNITY_FEED_REQUEST = 6220;
    public static final int PACKET_COMMUNITY_FEED_RESPONSE = 6221;
    // BIRIBIRI_WARDROBE_COMMUNITY_C2_1
    public static final int PACKET_COMMUNITY_MINE_REQUEST = 6222;
    public static final int PACKET_COMMUNITY_MINE_RESPONSE = 6223;
    public static final int PACKET_COMMUNITY_MUTATION_REQUEST = 6224;
    public static final int PACKET_COMMUNITY_MUTATION_RESULT = 6225;
    // BIRIBIRI_WARDROBE_COMMUNITY_C2_2
    public static final int PACKET_COMMUNITY_ACTION_REQUEST = 6226;
    public static final int PACKET_COMMUNITY_ACTION_RESULT = 6227;

    public static final String BUILD = "BIRIBIRI_WARDROBE_P6_FOLDERS";

    private static BiribiriWardrobePlugin instance;
    private final WardrobeManager manager = new WardrobeManager();
    private final WardrobeCommunityManager communityManager = new WardrobeCommunityManager();

    private boolean statePacketRegistered = false;
    private boolean namesPacketRegistered = false;
    private boolean nameSavePacketRegistered = false;
    private boolean purchasePacketRegistered = false;
    private boolean clothingFavoritesRequestPacketRegistered = false;
    private boolean clothingFavoriteSetPacketRegistered = false;
    private boolean clothingMetadataRequestPacketRegistered = false;
    private boolean deletePacketRegistered = false;
    private boolean foldersPacketRegistered = false;
    private boolean folderMutationPacketRegistered = false;
    private boolean saveGuardRegistered = false;
    private boolean communityFeedPacketRegistered = false;
    private boolean communityActionPacketsRegistered = false;
    private boolean communityCardActionPacketRegistered = false;

    private final ICallable saveGuard = new ICallable()
    {
        @Override
        public void call(MessageHandler handler)
        {
            try
            {
                if(
                    handler == null ||
                    handler.client == null ||
                    handler.client.getHabbo() == null ||
                    handler.packet == null
                ) return;

                int slotId = handler.packet.clone().readInt();
                Habbo habbo = handler.client.getHabbo();

                if(!manager.isSlotUnlocked(habbo, slotId))
                {
                    handler.isCancelled = true;
                    manager.sendState(handler.client);
                }
            }
            catch(Throwable throwable)
            {
                handler.isCancelled = true;

                System.out.println(
                    "[BiribiriWardrobe] save guard error: " +
                    throwable.getClass().getSimpleName() +
                    " - " + throwable.getMessage()
                );
            }
        }
    };

    public static BiribiriWardrobePlugin getInstance()
    {
        return instance;
    }

    public WardrobeManager getManager()
    {
        return this.manager;
    }

    public WardrobeCommunityManager getCommunityManager()
    {
        return this.communityManager;
    }

    @Override
    public void onEnable()
    {
        instance = this;

        Emulator.getPluginManager().registerEvents(this, this);

        System.out.println(
            "[BiribiriWardrobe] plugin cargado; esperando GameServer."
        );

        if(Emulator.getGameServer() != null)
        {
            try
            {
                initializePlugin();
            }
            catch(Throwable throwable)
            {
                throw new RuntimeException(throwable);
            }
        }
    }

    @EventHandler
    public void onEmulatorLoaded(EmulatorLoadedEvent event)
    {
        try
        {
            initializePlugin();
        }
        catch(Throwable throwable)
        {
            throw new RuntimeException(throwable);
        }
    }

    private synchronized void initializePlugin() throws Exception
    {
        this.manager.initializeDatabase();
        this.communityManager.initializeDatabase();

        if(!this.statePacketRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_STATE_REQUEST,
                WardrobeStateRequest.class
            );
            this.statePacketRegistered = true;
        }

        if(!this.namesPacketRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_NAMES_REQUEST,
                WardrobeNamesRequest.class
            );
            this.namesPacketRegistered = true;
        }

        if(!this.nameSavePacketRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_NAME_SAVE,
                WardrobeNameSave.class
            );
            this.nameSavePacketRegistered = true;
        }

        if(!this.purchasePacketRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_PURCHASE_REQUEST,
                WardrobePurchaseRequest.class
            );
            this.purchasePacketRegistered = true;
        }

        if(!this.clothingFavoritesRequestPacketRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_CLOTHING_FAVORITES_REQUEST,
                WardrobeClothingFavoritesRequest.class
            );

            this.clothingFavoritesRequestPacketRegistered = true;
        }

        if(!this.clothingFavoriteSetPacketRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_CLOTHING_FAVORITE_SET,
                WardrobeClothingFavoriteSet.class
            );

            this.clothingFavoriteSetPacketRegistered = true;
        }

        if(!this.clothingMetadataRequestPacketRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_CLOTHING_METADATA_REQUEST,
                WardrobeClothingMetadataRequest.class
            );

            this.clothingMetadataRequestPacketRegistered = true;
        }

        if(!this.deletePacketRegistered)
        {
            Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                    PACKET_DELETE_REQUEST,
                    WardrobeDeleteRequest.class
                );

            this.deletePacketRegistered =
                true;
        }

        if(!this.foldersPacketRegistered)
        {
            Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                    PACKET_FOLDERS_REQUEST,
                    WardrobeFoldersRequest.class
                );

            this.foldersPacketRegistered = true;
        }

        if(!this.folderMutationPacketRegistered)
        {
            Emulator.getGameServer()
                .getPacketManager()
                .registerHandler(
                    PACKET_FOLDER_MUTATION,
                    WardrobeFolderMutationRequest.class
                );

            this.folderMutationPacketRegistered = true;
        }

        if(!this.communityFeedPacketRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_COMMUNITY_FEED_REQUEST,
                WardrobeCommunityFeedRequest.class
            );

            this.communityFeedPacketRegistered = true;
        }

        if(!this.communityActionPacketsRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_COMMUNITY_MINE_REQUEST,
                WardrobeCommunityMineRequest.class
            );

            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_COMMUNITY_MUTATION_REQUEST,
                WardrobeCommunityMutationRequest.class
            );

            this.communityActionPacketsRegistered = true;
        }

        if(!this.communityCardActionPacketRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerHandler(
                PACKET_COMMUNITY_ACTION_REQUEST,
                WardrobeCommunityActionRequest.class
            );

            this.communityCardActionPacketRegistered = true;
        }

        if(!this.saveGuardRegistered)
        {
            Emulator.getGameServer().getPacketManager().registerCallable(
                800,
                this.saveGuard
            );
            this.saveGuardRegistered = true;
        }

        System.out.println(
            "[BiribiriWardrobe] habilitado build=" + BUILD +
            " state=" + PACKET_STATE_REQUEST + "/" + PACKET_STATE_RESPONSE +
            " names=" + PACKET_NAMES_REQUEST + "/" + PACKET_NAMES_RESPONSE +
            " saveName=" + PACKET_NAME_SAVE +
            " purchase=" + PACKET_PURCHASE_REQUEST + "/" + PACKET_PURCHASE_RESULT
        );
    }


    // BIRIBIRI_CLOTHING_OWNERSHIP_S1
    @com.eu.habbo.plugin.EventHandler
    public void onBiribiriOwnershipSavedLook(
        com.eu.habbo.plugin.events.users.UserSavedLookEvent event
    )
    {
        if(
            event == null ||
            event.habbo == null
        )
        {
            return;
        }

        if(
            WardrobeClothingOwnership.canUseLook(
                event.habbo,
                event.newLook
            )
        )
        {
            return;
        }

        event.setCancelled(true);

        event.habbo.alert(
            "No puedes usar este look porque contiene ropa que no tienes en tu armario."
        );
    }

    @com.eu.habbo.plugin.EventHandler
    public void onBiribiriOwnershipSavedWardrobe(
        com.eu.habbo.plugin.events.users.UserSavedWardrobeEvent event
    )
    {
        WardrobeClothingOwnership.rejectWardrobeSave(
            event
        );
    }

    @Override
    public void onDisable()
    {
        try
        {
            if(this.saveGuardRegistered)
            {
                Emulator.getGameServer().getPacketManager().unregisterCallables(
                    800,
                    this.saveGuard
                );
            }
        }
        catch(Throwable ignored)
        {
        }

        this.saveGuardRegistered = false;
        instance = null;

        System.out.println("[BiribiriWardrobe] deshabilitado.");
    }

    @Override
    public boolean hasPermission(Habbo habbo, String permission)
    {
        return false;
    }
}
