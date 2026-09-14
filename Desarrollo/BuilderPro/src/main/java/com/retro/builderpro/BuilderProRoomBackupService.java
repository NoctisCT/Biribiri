package com.retro.builderpro;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.rooms.FurnitureMovementError;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomLayout;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.eu.habbo.messages.outgoing.inventory.RemoveHabboItemComposer;
import com.eu.habbo.messages.outgoing.rooms.ForwardToRoomComposer;
import gnu.trove.map.TIntObjectMap;
import gnu.trove.set.hash.THashSet;

import java.awt.Rectangle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public final class BuilderProRoomBackupService
{
    public static final int OP_LIST = 0;
    public static final int OP_CREATE = 1;
    public static final int OP_UPDATE = 2;
    public static final int OP_RESTORE = 3;
    public static final int OP_DELETE = 4;
    public static final int OP_CHANGE_PIN = 5;

    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final long LOCK_MS = 15L * 60L * 1000L;
    private static final double EPSILON = 0.000001D;

    private static final Map<String, AttemptState> ATTEMPTS =
            new ConcurrentHashMap<String, AttemptState>();

    private BuilderProRoomBackupService()
    {
    }

    public static Result execute(
            Habbo actor,
            int operation,
            int backupId,
            int roomId,
            String pin,
            String newPin)
    {
        if(actor == null)
        {
            return Result.failure(
                    1,
                    "Usuario no disponible.",
                    new ArrayList<BuilderProRoomBackupRepository.Summary>()
            );
        }

        int ownerId =
                actor.getHabboInfo().getId();

        try
        {
            if(operation == OP_LIST)
            {
                return Result.success(
                        "Backups actualizados.",
                        safeList(ownerId),
                        0
                );
            }

            if(operation == OP_CREATE)
            {
                return create(
                        actor,
                        roomId,
                        newPin
                );
            }

            BuilderProRoomBackupRepository.StoredBackup backup =
                    BuilderProRoomBackupRepository.find(
                            ownerId,
                            backupId
                    );

            if(backup == null)
            {
                return Result.failure(
                        2,
                        "Backup no encontrado.",
                        safeList(ownerId)
                );
            }

            Result pinResult =
                    verifyPin(
                            actor,
                            backup,
                            pin
                    );

            if(pinResult != null)
            {
                return pinResult;
            }

            if(operation == OP_UPDATE)
            {
                return update(
                        actor,
                        backup,
                        roomId
                );
            }

            if(operation == OP_RESTORE)
            {
                return restore(
                        actor,
                        backup
                );
            }

            if(operation == OP_DELETE)
            {
                BuilderProRoomBackupRepository.delete(
                        ownerId,
                        backup.id
                );

                clearAttempts(
                        ownerId,
                        backup.id
                );

                return Result.success(
                        "Backup eliminado.",
                        safeList(ownerId),
                        0
                );
            }

            if(operation == OP_CHANGE_PIN)
            {
                if(!BuilderProRoomBackupSecurity.validPin(newPin))
                {
                    return Result.failure(
                            3,
                            "El PIN nuevo debe tener entre 6 y 12 digitos.",
                            safeList(ownerId)
                    );
                }

                BuilderProRoomBackupRepository.updatePin(
                        ownerId,
                        backup.id,
                        BuilderProRoomBackupSecurity.create(
                                newPin
                        )
                );

                clearAttempts(
                        ownerId,
                        backup.id
                );

                return Result.success(
                        "PIN del backup actualizado.",
                        safeList(ownerId),
                        0
                );
            }

            return Result.failure(
                    4,
                    "Operacion de backup invalida.",
                    safeList(ownerId)
            );
        }
        catch(Exception exception)
        {
            System.err.println(
                    "[BuilderPro] Error gestionando backup de sala."
            );

            exception.printStackTrace();

            return Result.failure(
                    90,
                    "Error interno al gestionar el backup.",
                    safeList(ownerId)
            );
        }
    }

    private static Result create(
            Habbo actor,
            int roomId,
            String newPin)
            throws Exception
    {
        int ownerId =
                actor.getHabboInfo().getId();

        if(!BuilderProRoomBackupSecurity.validPin(newPin))
        {
            return Result.failure(
                    10,
                    "El PIN debe tener entre 6 y 12 digitos.",
                    safeList(ownerId)
            );
        }

        Room room =
                Emulator.getGameEnvironment()
                        .getRoomManager()
                        .loadRoom(
                                roomId,
                                true
                        );

        if(room == null
                || room.getOwnerId() != ownerId)
        {
            return Result.failure(
                    11,
                    "Solo el propietario puede crear el backup.",
                    safeList(ownerId)
            );
        }

        if(
            BuilderProRoomBackupRepository.findByActiveRoom(
                    ownerId,
                    roomId
            ) != null
        )
        {
            return Result.failure(
                    12,
                    "Esta sala ya tiene un backup. Usa Actualizar.",
                    safeList(ownerId)
            );
        }

        BuilderProRoomBackupRepository.Snapshot snapshot =
                BuilderProRoomBackupRepository.capture(
                        room,
                        ownerId
                );

        if(snapshot.items.size() > Room.MAXIMUM_FURNI)
        {
            return Result.failure(
                    13,
                    "La sala supera el limite admitido para backups.",
                    safeList(ownerId)
            );
        }

        BuilderProRoomBackupRepository.create(
                ownerId,
                snapshot,
                BuilderProRoomBackupSecurity.create(
                        newPin
                )
        );

        return Result.success(
                "Backup creado con "
                        + snapshot.items.size()
                        + " furnis tuyos.",
                safeList(ownerId),
                0
        );
    }

    private static Result update(
            Habbo actor,
            BuilderProRoomBackupRepository.StoredBackup backup,
            int roomId)
            throws Exception
    {
        int ownerId =
                actor.getHabboInfo().getId();

        if(roomId != backup.activeRoomId)
        {
            return Result.failure(
                    20,
                    "Ese backup no pertenece a esta sala activa.",
                    safeList(ownerId)
            );
        }

        Room room =
                Emulator.getGameEnvironment()
                        .getRoomManager()
                        .loadRoom(
                                roomId,
                                true
                        );

        if(room == null
                || room.getOwnerId() != ownerId)
        {
            return Result.failure(
                    21,
                    "La sala no esta disponible o ya no te pertenece.",
                    safeList(ownerId)
            );
        }

        BuilderProRoomBackupRepository.Snapshot snapshot =
                BuilderProRoomBackupRepository.capture(
                        room,
                        ownerId
                );

        BuilderProRoomBackupRepository.replaceSnapshot(
                ownerId,
                backup.id,
                snapshot
        );

        return Result.success(
                "Backup actualizado con "
                        + snapshot.items.size()
                        + " furnis tuyos.",
                safeList(ownerId),
                0
        );
    }

    private static Result restore(
            Habbo actor,
            BuilderProRoomBackupRepository.StoredBackup backup)
            throws Exception
    {
        int ownerId =
                actor.getHabboInfo().getId();

        boolean roomExists =
                BuilderProRoomBackupRepository.roomExistsOwned(
                        backup.activeRoomId,
                        ownerId
                );

        if(roomExists)
        {
            Room room =
                    Emulator.getGameEnvironment()
                            .getRoomManager()
                            .loadRoom(
                                    backup.activeRoomId,
                                    true
                            );

            if(room == null)
            {
                return Result.failure(
                        30,
                        "No se pudo cargar la sala a restaurar.",
                        safeList(ownerId)
                );
            }

            return restoreIntoRoom(
                    actor,
                    room,
                    backup
            );
        }

        Result inventoryCheck =
                validateItemsForDeletedRoom(
                        actor,
                        backup
                );

        if(inventoryCheck != null)
        {
            return inventoryCheck;
        }

        int newRoomId =
                BuilderProRoomBackupRepository.createRoomFromBackup(
                        ownerId,
                        actor.getHabboInfo().getUsername(),
                        backup
                );

        Room validationRoom =
                Emulator.getGameEnvironment()
                        .getRoomManager()
                        .loadRoom(
                                newRoomId,
                                true
                        );

        if(validationRoom == null
                || validationRoom.getLayout() == null)
        {
            BuilderProRoomBackupRepository.deleteRestoredRoom(
                    newRoomId
            );

            return Result.failure(
                    31,
                    "No se pudo cargar el layout de la sala recreada.",
                    safeList(ownerId)
            );
        }

        Result layoutCheck =
                validateDeletedRoomLayout(
                        actor,
                        validationRoom,
                        backup.items
                );

        if(layoutCheck != null)
        {
            validationRoom.preventUnloading = false;
            validationRoom.dispose();

            Emulator.getGameEnvironment()
                    .getRoomManager()
                    .uncacheRoom(validationRoom);

            BuilderProRoomBackupRepository.deleteRestoredRoom(
                    newRoomId
            );

            return layoutCheck;
        }

        validationRoom.preventUnloading = false;
        validationRoom.dispose();

        Emulator.getGameEnvironment()
                .getRoomManager()
                .uncacheRoom(validationRoom);

        try
        {
            BuilderProRoomBackupRepository.assignBackupItemsToRoom(
                    ownerId,
                    newRoomId,
                    backup.items
            );
        }
        catch(Exception exception)
        {
            BuilderProRoomBackupRepository.deleteRestoredRoom(
                    newRoomId
            );

            System.err.println(
                    "[BuilderPro] Fallo P14 recreando items en BD."
            );
            exception.printStackTrace();

            return Result.failure(
                    33,
                    "No se pudieron restaurar los furnis de la sala recreada.",
                    safeList(ownerId)
            );
        }

        Room newRoom =
                Emulator.getGameEnvironment()
                        .getRoomManager()
                        .loadRoom(
                                newRoomId,
                                true
                        );

        if(newRoom == null
                || newRoom.getLayout() == null)
        {
            BuilderProRoomBackupRepository.releaseRestoredRoomItems(
                    ownerId,
                    newRoomId
            );

            BuilderProRoomBackupRepository.deleteRestoredRoom(
                    newRoomId
            );

            return Result.failure(
                    32,
                    "La sala se creo, pero no pudo cargarse con sus furnis.",
                    safeList(ownerId)
            );
        }

        try
        {
            BuilderProRoomBackupRepository.updateActiveRoom(
                    ownerId,
                    backup.id,
                    newRoomId
            );
        }
        catch(Exception exception)
        {
            newRoom.preventUnloading = false;
            newRoom.dispose();

            Emulator.getGameEnvironment()
                    .getRoomManager()
                    .uncacheRoom(newRoom);

            BuilderProRoomBackupRepository.releaseRestoredRoomItems(
                    ownerId,
                    newRoomId
            );

            BuilderProRoomBackupRepository.deleteRestoredRoom(
                    newRoomId
            );

            throw exception;
        }

        removeBackupItemsFromInventory(
                actor,
                backup.items
        );

        return Result.success(
                "Sala recreada desde el backup.",
                safeList(ownerId),
                newRoomId
        );
    }

    private static Result restoreIntoRoom(
            Habbo actor,
            Room room,
            BuilderProRoomBackupRepository.StoredBackup backup)
            throws Exception
    {
        int ownerId =
                actor.getHabboInfo().getId();

        List<BuilderProRoomBackupRepository.BackupItem> targetItems =
                backup.items;

        if(room.getOwnerId() != ownerId)
        {
            return Result.failure(
                    40,
                    "La sala ya no te pertenece.",
                    safeList(ownerId)
            );
        }

        int otherUsers = room.getUserCount();

        if(
            actor.getHabboInfo().getCurrentRoom() != null &&
            actor.getHabboInfo().getCurrentRoom().getId() == room.getId()
        )
        {
            otherUsers--;
        }

        if(otherUsers > 0)
        {
            return Result.failure(
                    41,
                    "Expulsa a los demas usuarios antes de restaurar.",
                    safeList(ownerId)
            );
        }

        Result ownership =
                validateItemsForRoom(
                        actor,
                        room,
                        targetItems
                );

        if(ownership != null)
        {
            return ownership;
        }

        BuilderProRoomBackupRepository.Snapshot beforeSnapshot =
                BuilderProRoomBackupRepository.capture(
                        room,
                        ownerId
                );

        ArchitectState targetArchitect =
                ArchitectState.fromBackup(
                        backup
                );

        ArchitectState beforeArchitect =
                ArchitectState.fromSnapshot(
                        beforeSnapshot
                );

        boolean architectChanged =
                !architectMatches(
                        room,
                        targetArchitect
                );

        if(
            architectChanged &&
            hasForeignFurniture(
                    room,
                    ownerId
            )
        )
        {
            return Result.failure(
                    47,
                    "No se puede restaurar Arquitecto mientras haya furnis de otros jugadores en la sala.",
                    safeList(ownerId)
            );
        }

        if(!architectChanged)
        {
            Result foreignCollision =
                    validateForeignFurniture(
                            actor,
                            room,
                            targetItems
                    );

            if(foreignCollision != null)
            {
                return foreignCollision;
            }
        }

        List<BuilderProRoomBackupRepository.BackupItem> before =
                beforeSnapshot.items;

        ejectOwnerItems(
                room,
                ownerId,
                before
        );

        if(architectChanged)
        {
            Result architectResult =
                    applyArchitectState(
                            actor,
                            room,
                            targetArchitect
                    );

            if(architectResult != null)
            {
                Result architectRollback =
                        applyArchitectState(
                                actor,
                                room,
                                beforeArchitect
                        );

                if(architectRollback != null)
                {
                    System.err.println(
                            "[BuilderPro] CRITICO: rollback de Arquitecto incompleto."
                    );
                }

                Result itemRollback =
                        placeBackupItems(
                                actor,
                                room,
                                before
                        );

                if(!itemRollback.success)
                {
                    System.err.println(
                            "[BuilderPro] CRITICO: rollback de furnis incompleto tras fallo de Arquitecto."
                    );
                }

                return architectResult;
            }
        }

        Result placed =
                placeBackupItems(
                        actor,
                        room,
                        targetItems
                );

        if(!placed.success)
        {
            ejectOwnerItems(
                    room,
                    ownerId,
                    BuilderProRoomBackupRepository.captureOwnerItems(
                            room,
                            ownerId
                    )
            );

            if(architectChanged)
            {
                Result architectRollback =
                        applyArchitectState(
                                actor,
                                room,
                                beforeArchitect
                        );

                if(architectRollback != null)
                {
                    System.err.println(
                            "[BuilderPro] CRITICO: rollback de Arquitecto incompleto."
                    );
                }
            }

            Result rollback =
                    placeBackupItems(
                            actor,
                            room,
                            before
                    );

            if(!rollback.success)
            {
                System.err.println(
                        "[BuilderPro] CRITICO: rollback de backup incompleto."
                );
            }

            return placed;
        }

        if(
            actor.getHabboInfo().getCurrentRoom() != null &&
            actor.getHabboInfo().getCurrentRoom().getId() == room.getId()
        )
        {
            BuilderProHistoryService.invalidate(actor);
        }

        if(architectChanged)
        {
            reloadRoomAfterArchitectRestore(
                    actor,
                    room
            );
        }

        return Result.success(
                architectChanged
                        ? "Sala y plano de Arquitecto restaurados desde el backup."
                        : "Sala restaurada desde el backup.",
                safeList(ownerId),
                room.getId()
        );
    }

    private static Result validateItemsForRoom(
            Habbo actor,
            Room room,
            List<BuilderProRoomBackupRepository.BackupItem> items)
    {
        int ownerId =
                actor.getHabboInfo().getId();

        for(BuilderProRoomBackupRepository.BackupItem state : items)
        {
            HabboItem item =
                    resolveItem(
                            actor,
                            room,
                            state.itemId
                    );

            if(item == null
                    || item.getUserId() != ownerId
                    || item.getBaseItem() == null
                    || item.getBaseItem().getId() != state.baseItemId)
            {
                return Result.failure(
                        42,
                        "Falta el furni #"
                                + state.itemId
                                + " o ya no te pertenece.",
                        safeList(ownerId)
                );
            }

            if(item.getRoomId() != 0
                    && item.getRoomId() != room.getId())
            {
                return Result.failure(
                        43,
                        "El furni #"
                                + state.itemId
                                + " esta colocado en otra sala.",
                        safeList(ownerId)
                );
            }
        }

        return null;
    }

    private static Result validateItemsForDeletedRoom(
            Habbo actor,
            BuilderProRoomBackupRepository.StoredBackup backup)
    {
        int ownerId =
                actor.getHabboInfo().getId();

        for(BuilderProRoomBackupRepository.BackupItem state : backup.items)
        {
            HabboItem item =
                    actor.getInventory()
                            .getItemsComponent()
                            .getHabboItem(
                                    state.itemId
                            );

            if(item == null
                    || item.getUserId() != ownerId
                    || item.getRoomId() != 0
                    || item.getBaseItem() == null
                    || item.getBaseItem().getId() != state.baseItemId)
            {
                return Result.failure(
                        44,
                        "No se puede recrear: el furni #"
                                + state.itemId
                                + " no esta en tu inventario.",
                        safeList(ownerId)
                );
            }
        }

        return null;
    }

    private static Result validateDeletedRoomLayout(
            Habbo actor,
            Room room,
            List<BuilderProRoomBackupRepository.BackupItem> items)
    {
        int ownerId =
                actor.getHabboInfo().getId();

        for(BuilderProRoomBackupRepository.BackupItem state : items)
        {
            if(!"S".equals(state.furnitureType))
            {
                continue;
            }

            HabboItem item =
                    actor.getInventory()
                            .getItemsComponent()
                            .getHabboItem(
                                    state.itemId
                            );

            if(item == null
                    || item.getBaseItem() == null)
            {
                return Result.failure(
                        45,
                        "No se pudo validar el furni #"
                                + state.itemId
                                + " en el layout recreado.",
                        safeList(ownerId)
                );
            }

            RoomTile tile =
                    room.getLayout()
                            .getTile(
                                    state.x,
                                    state.y
                            );

            if(tile == null
                    || !room.getLayout().fitsOnMap(
                            tile,
                            item.getBaseItem().getWidth(),
                            item.getBaseItem().getLength(),
                            state.rotation
                    ))
            {
                return Result.failure(
                        45,
                        "El backup no cabe en el layout recreado.",
                        safeList(ownerId)
                );
            }
        }

        return null;
    }

    private static void removeBackupItemsFromInventory(
            Habbo actor,
            List<BuilderProRoomBackupRepository.BackupItem> items)
    {
        TIntObjectMap<HabboItem> inventoryMap =
                actor.getInventory()
                        .getItemsComponent()
                        .getItems();

        for(BuilderProRoomBackupRepository.BackupItem state : items)
        {
            HabboItem item =
                    actor.getInventory()
                            .getItemsComponent()
                            .getHabboItem(
                                    state.itemId
                            );

            if(item == null)
            {
                continue;
            }

            synchronized(inventoryMap)
            {
                actor.getInventory()
                        .getItemsComponent()
                        .removeHabboItem(
                                item.getId()
                        );
            }

            actor.getClient()
                    .sendResponse(
                            new RemoveHabboItemComposer(
                                    item.getGiftAdjustedId()
                            )
                    );
        }
    }

    private static boolean architectMatches(
            Room room,
            ArchitectState state)
    {
        if(room == null
                || room.getLayout() == null
                || room.hasCustomLayout() != state.customLayout
                || room.getWallSize() != state.wallSize
                || room.getWallHeight() != state.wallHeight
                || room.getFloorSize() != state.floorSize)
        {
            return false;
        }

        if(state.customLayout)
        {
            return room.getLayout().getDoorX() == state.doorX
                    && room.getLayout().getDoorY() == state.doorY
                    && room.getLayout().getDoorDirection() == state.doorDir
                    && sameString(
                            room.getLayout().getHeightmap(),
                            state.heightmap
                    );
        }

        return sameString(
                room.getLayout().getName(),
                state.roomModel
        );
    }

    private static boolean hasForeignFurniture(
            Room room,
            int ownerId)
    {
        for(HabboItem item : room.getFloorItems())
        {
            if(item != null
                    && item.getUserId() != ownerId)
            {
                return true;
            }
        }

        for(HabboItem item : room.getWallItems())
        {
            if(item != null
                    && item.getUserId() != ownerId)
            {
                return true;
            }
        }

        return false;
    }

    private static Result applyArchitectState(
            Habbo actor,
            Room room,
            ArchitectState state)
            throws Exception
    {
        int ownerId =
                actor.getHabboInfo().getId();

        BuilderProRoomBackupRepository.setRoomLayoutMode(
                room.getId(),
                state.roomModel,
                state.customLayout
        );

        RoomLayout layout;

        if(state.customLayout)
        {
            layout =
                    Emulator.getGameEnvironment()
                            .getRoomManager()
                            .insertCustomLayout(
                                    room,
                                    state.heightmap,
                                    state.doorX,
                                    state.doorY,
                                    state.doorDir
                            );
        }
        else
        {
            layout =
                    Emulator.getGameEnvironment()
                            .getRoomManager()
                            .loadLayout(
                                    state.roomModel,
                                    room
                            );
        }

        if(layout == null
                || layout.getDoorTile() == null)
        {
            return Result.failure(
                    48,
                    "No se pudo restaurar el plano de Arquitecto.",
                    safeList(ownerId)
            );
        }

        room.setHasCustomLayout(
                state.customLayout
        );
        room.setLayout(layout);
        room.setWallSize(
                state.wallSize
        );
        room.setWallHeight(
                state.wallHeight
        );
        room.setFloorSize(
                state.floorSize
        );
        room.setNeedsUpdate(true);
        room.save();

        return null;
    }

    private static void reloadRoomAfterArchitectRestore(
            Habbo actor,
            Room room)
    {
        int roomId =
                room.getId();

        room.preventUnloading = false;

        Emulator.getGameEnvironment()
                .getRoomManager()
                .unloadRoom(room);

        Emulator.getGameEnvironment()
                .getRoomManager()
                .loadRoom(
                        roomId,
                        true
                );

        actor.getClient()
                .sendResponse(
                        new ForwardToRoomComposer(
                                roomId
                        )
                );
    }

    private static boolean sameString(
            String first,
            String second)
    {
        String left =
                first == null
                        ? ""
                        : first;

        String right =
                second == null
                        ? ""
                        : second;

        return left.equals(right);
    }

    private static Result validateForeignFurniture(
            Habbo actor,
            Room room,
            List<BuilderProRoomBackupRepository.BackupItem> items)
            throws Exception
    {
        int ownerId =
                actor.getHabboInfo().getId();

        for(BuilderProRoomBackupRepository.BackupItem state : items)
        {
            if("I".equals(state.furnitureType))
            {
                if(
                    BuilderProRoomBackupRepository.foreignWallAt(
                            room.getId(),
                            ownerId,
                            state.wallPosition
                    )
                )
                {
                    return Result.failure(
                            46,
                            "Un furni de pared de otro jugador bloquea la restauracion.",
                            safeList(ownerId)
                    );
                }

                continue;
            }

            HabboItem item =
                    resolveItem(
                            actor,
                            room,
                            state.itemId
                    );

            if(item == null || item.getBaseItem() == null)
            {
                continue;
            }

            Rectangle rectangle =
                    RoomLayout.getRectangle(
                            state.x,
                            state.y,
                            item.getBaseItem().getWidth(),
                            item.getBaseItem().getLength(),
                            state.rotation
                    );

            for(int x = rectangle.x;
                    x < rectangle.x + rectangle.width;
                    x++)
            {
                for(int y = rectangle.y;
                        y < rectangle.y + rectangle.height;
                        y++)
                {
                    RoomTile tile =
                            room.getLayout().getTile(
                                    (short)x,
                                    (short)y
                            );

                    if(tile == null)
                    {
                        return Result.failure(
                                45,
                                "El backup ya no cabe en el layout actual.",
                                safeList(ownerId)
                        );
                    }

                    THashSet<HabboItem> present =
                            room.getItemsAt(tile);

                    for(HabboItem other : present)
                    {
                        if(other != null
                                && other.getUserId() != ownerId)
                        {
                            return Result.failure(
                                    46,
                                    "Un furni de otro jugador bloquea la restauracion.",
                                    safeList(ownerId)
                            );
                        }
                    }
                }
            }
        }

        return null;
    }

    private static void ejectOwnerItems(
            Room room,
            int ownerId,
            List<BuilderProRoomBackupRepository.BackupItem> states)
    {
        for(BuilderProRoomBackupRepository.BackupItem state : states)
        {
            HabboItem item =
                    room.getHabboItem(
                            state.itemId
                    );

            if(item != null
                    && item.getUserId() == ownerId)
            {
                room.ejectUserItem(item);
            }
        }
    }

    private static Result placeBackupItems(
            Habbo actor,
            Room room,
            List<BuilderProRoomBackupRepository.BackupItem> states)
    {
        int ownerId =
                actor.getHabboInfo().getId();

        List<BuilderProRoomBackupRepository.BackupItem> ordered =
                new ArrayList<BuilderProRoomBackupRepository.BackupItem>(
                        states
                );

        ordered.sort(
                Comparator.comparingDouble(
                        state -> state.z
                )
        );

        Map<Integer, Double> forcedHeights =
                new HashMap<Integer, Double>();

        for(BuilderProRoomBackupRepository.BackupItem state : ordered)
        {
            if("S".equals(state.furnitureType))
            {
                forcedHeights.put(
                        state.itemId,
                        state.z
                );
            }
        }

        BuilderProContext.begin(
                ownerId,
                forcedHeights
        );

        try
        {
            for(BuilderProRoomBackupRepository.BackupItem state : ordered)
            {
                HabboItem item =
                        actor.getInventory()
                                .getItemsComponent()
                                .getHabboItem(
                                        state.itemId
                                );

                if(item == null
                        || item.getUserId() != ownerId)
                {
                    return Result.failure(
                            50,
                            "No se encontro el furni #"
                                    + state.itemId
                                    + " durante la restauracion.",
                            safeList(ownerId)
                    );
                }

                item.setExtradata(
                        state.extraData
                );

                FurnitureMovementError error;

                if("I".equals(state.furnitureType))
                {
                    error =
                            room.placeWallFurniAt(
                                    item,
                                    state.wallPosition,
                                    actor
                            );
                }
                else
                {
                    RoomTile tile =
                            room.getLayout()
                                    .getTile(
                                            state.x,
                                            state.y
                                    );

                    if(tile == null)
                    {
                        return Result.failure(
                                51,
                                "Una posicion del backup ya no existe.",
                                safeList(ownerId)
                        );
                    }

                    error =
                            room.canPlaceFurnitureAt(
                                    item,
                                    actor,
                                    tile,
                                    state.rotation
                            );

                    if(error == FurnitureMovementError.NONE)
                    {
                        error =
                                room.placeFloorFurniAt(
                                        item,
                                        tile,
                                        state.rotation,
                                        actor
                                );
                    }
                }

                if(error != FurnitureMovementError.NONE)
                {
                    return Result.failure(
                            52,
                            "Restauracion cancelada por el servidor: "
                                    + error.name(),
                            safeList(ownerId)
                    );
                }

                if(
                    "S".equals(state.furnitureType) &&
                    (
                        item.getX() != state.x ||
                        item.getY() != state.y ||
                        Math.abs(item.getZ() - state.z) > EPSILON ||
                        normalizeRotation(item.getRotation()) != state.rotation
                    )
                )
                {
                    return Result.failure(
                            53,
                            "El servidor altero la posicion exacta de un furni.",
                            safeList(ownerId)
                    );
                }

                TIntObjectMap<HabboItem> inventoryMap =
                        actor.getInventory()
                                .getItemsComponent()
                                .getItems();

                synchronized(inventoryMap)
                {
                    actor.getInventory()
                            .getItemsComponent()
                            .removeHabboItem(
                                    item.getId()
                            );
                }

                actor.getClient()
                        .sendResponse(
                                new RemoveHabboItemComposer(
                                        item.getGiftAdjustedId()
                                )
                        );
            }
        }
        finally
        {
            BuilderProContext.clear();
        }

        return Result.success(
                "Furnis restaurados.",
                safeList(ownerId),
                room.getId()
        );
    }

    private static HabboItem resolveItem(
            Habbo actor,
            Room room,
            int itemId)
    {
        HabboItem roomItem =
                room.getHabboItem(itemId);

        if(roomItem != null)
        {
            return roomItem;
        }

        return actor.getInventory()
                .getItemsComponent()
                .getHabboItem(itemId);
    }

    private static void cleanupFailedRecreatedRoom(
            Habbo actor,
            Room room)
    {
        try
        {
            List<BuilderProRoomBackupRepository.BackupItem> placed =
                    BuilderProRoomBackupRepository.captureOwnerItems(
                            room,
                            actor.getHabboInfo().getId()
                    );

            ejectOwnerItems(
                    room,
                    actor.getHabboInfo().getId(),
                    placed
            );

            room.preventUnloading = false;
            room.dispose();

            Emulator.getGameEnvironment()
                    .getRoomManager()
                    .uncacheRoom(room);

            BuilderProRoomBackupRepository.deleteRestoredRoom(
                    room.getId()
            );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();
        }
    }

    private static Result verifyPin(
            Habbo actor,
            BuilderProRoomBackupRepository.StoredBackup backup,
            String pin)
            throws Exception
    {
        int ownerId =
                actor.getHabboInfo().getId();

        String key =
                ownerId + ":" + backup.id;

        AttemptState attempts =
                ATTEMPTS.get(key);

        long now =
                System.currentTimeMillis();

        if(attempts != null
                && attempts.lockUntil > now)
        {
            long seconds =
                    Math.max(
                            1L,
                            (attempts.lockUntil - now + 999L) / 1000L
                    );

            return Result.failure(
                    60,
                    "Demasiados PIN incorrectos. Espera "
                            + seconds
                            + " s.",
                    safeList(ownerId)
            );
        }

        boolean valid =
                BuilderProRoomBackupSecurity.verify(
                        pin,
                        backup.pinSalt,
                        backup.pinHash,
                        backup.pinIterations
                );

        if(valid)
        {
            clearAttempts(
                    ownerId,
                    backup.id
            );

            return null;
        }

        AttemptState next =
                attempts == null
                        ? new AttemptState()
                        : attempts;

        next.failures++;

        if(next.failures >= MAX_FAILED_ATTEMPTS)
        {
            next.failures = 0;
            next.lockUntil =
                    now + LOCK_MS;
        }

        ATTEMPTS.put(
                key,
                next
        );

        return Result.failure(
                61,
                "PIN incorrecto.",
                safeList(ownerId)
        );
    }

    private static void clearAttempts(
            int ownerId,
            int backupId)
    {
        ATTEMPTS.remove(
                ownerId + ":" + backupId
        );
    }

    private static int normalizeRotation(int rotation)
    {
        int normalized =
                rotation % 8;

        if(normalized < 0)
        {
            normalized += 8;
        }

        return normalized;
    }

    private static List<BuilderProRoomBackupRepository.Summary> safeList(
            int ownerId)
    {
        try
        {
            return BuilderProRoomBackupRepository.list(
                    ownerId
            );
        }
        catch(Exception ignored)
        {
            return new ArrayList<BuilderProRoomBackupRepository.Summary>();
        }
    }

    private static final class ArchitectState
    {
        final String roomModel;
        final int wallSize;
        final int wallHeight;
        final int floorSize;
        final boolean customLayout;
        final int doorX;
        final int doorY;
        final int doorDir;
        final String heightmap;

        ArchitectState(
                String roomModel,
                int wallSize,
                int wallHeight,
                int floorSize,
                boolean customLayout,
                int doorX,
                int doorY,
                int doorDir,
                String heightmap)
        {
            this.roomModel =
                    roomModel == null
                            ? ""
                            : roomModel;
            this.wallSize = wallSize;
            this.wallHeight = wallHeight;
            this.floorSize = floorSize;
            this.customLayout = customLayout;
            this.doorX = doorX;
            this.doorY = doorY;
            this.doorDir = doorDir;
            this.heightmap =
                    heightmap == null
                            ? ""
                            : heightmap;
        }

        static ArchitectState fromBackup(
                BuilderProRoomBackupRepository.StoredBackup backup)
        {
            return new ArchitectState(
                    backup.roomModel,
                    backup.wallSize,
                    backup.wallHeight,
                    backup.floorSize,
                    backup.customLayout,
                    backup.customDoorX,
                    backup.customDoorY,
                    backup.customDoorDir,
                    backup.customHeightmap
            );
        }

        static ArchitectState fromSnapshot(
                BuilderProRoomBackupRepository.Snapshot snapshot)
        {
            return new ArchitectState(
                    snapshot.roomModel,
                    snapshot.wallSize,
                    snapshot.wallHeight,
                    snapshot.floorSize,
                    snapshot.customLayout,
                    snapshot.customDoorX,
                    snapshot.customDoorY,
                    snapshot.customDoorDir,
                    snapshot.customHeightmap
            );
        }
    }

    private static final class AttemptState
    {
        int failures = 0;
        long lockUntil = 0L;
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final List<BuilderProRoomBackupRepository.Summary> backups;
        public final int restoredRoomId;

        private Result(
                boolean success,
                int code,
                String message,
                List<BuilderProRoomBackupRepository.Summary> backups,
                int restoredRoomId)
        {
            this.success = success;
            this.code = code;
            this.message = message == null ? "" : message;
            this.backups =
                    new ArrayList<BuilderProRoomBackupRepository.Summary>(
                            backups
                    );
            this.restoredRoomId = restoredRoomId;
        }

        public static Result success(
                String message,
                List<BuilderProRoomBackupRepository.Summary> backups,
                int restoredRoomId)
        {
            return new Result(
                    true,
                    0,
                    message,
                    backups,
                    restoredRoomId
            );
        }

        public static Result failure(
                int code,
                String message,
                List<BuilderProRoomBackupRepository.Summary> backups)
        {
            return new Result(
                    false,
                    code,
                    message,
                    backups,
                    0
            );
        }
    }
}
