package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionJukeBox;
import com.eu.habbo.habbohotel.items.interactions.InteractionMoodLight;
import com.eu.habbo.habbohotel.items.interactions.InteractionMultiHeight;
import com.eu.habbo.habbohotel.items.interactions.InteractionStackHelper;
import com.eu.habbo.habbohotel.items.interactions.InteractionTileWalkMagic;
import com.eu.habbo.habbohotel.rooms.FurnitureMovementError;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomLayout;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.rooms.RoomTileState;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.eu.habbo.messages.outgoing.inventory.AddHabboItemComposer;
import com.eu.habbo.messages.outgoing.inventory.InventoryRefreshComposer;
import com.eu.habbo.messages.outgoing.inventory.RemoveHabboItemComposer;
import com.eu.habbo.messages.outgoing.rooms.items.AddFloorItemComposer;
import com.eu.habbo.messages.outgoing.rooms.items.FloorItemUpdateComposer;
import com.eu.habbo.messages.outgoing.rooms.items.RemoveFloorItemComposer;
import gnu.trove.map.TIntObjectMap;
import gnu.trove.set.hash.THashSet;

import java.awt.Rectangle;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class BuilderProHistoryService
{
    public static final int ACTION_UNDO = 1;
    public static final int ACTION_REDO = 2;

    public static final int MAX_HISTORY = 50;

    private static final double EPSILON = 0.000001D;

    private static final String PLACEMENT_PREFIX =
            "BUILDER_PRO_PLACEMENT:";

    private static final String PICKUP_PREFIX =
            "BUILDER_PRO_PICKUP:";

    private static final String REPLACEMENT_PREFIX =
            "BUILDER_PRO_REPLACEMENT:";

    private static final Map<String, History> HISTORIES =
            new ConcurrentHashMap<String, History>();

    private BuilderProHistoryService()
    {
    }

    public static List<ItemState> capture(
            Habbo actor,
            List<Integer> requestedIds)
    {
        if(actor == null
                || requestedIds == null
                || requestedIds.isEmpty())
        {
            return null;
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return null;
        }

        LinkedHashSet<Integer> uniqueIds =
                new LinkedHashSet<Integer>(
                        requestedIds
                );

        if(uniqueIds.size() != requestedIds.size()
                || uniqueIds.size()
                > GroupMoveService.MAX_GROUP_SIZE)
        {
            return null;
        }

        List<ItemState> states =
                new ArrayList<ItemState>();

        for(Integer id : uniqueIds)
        {
            if(id == null)
            {
                return null;
            }

            HabboItem item =
                    room.getHabboItem(
                            id.intValue()
                    );

            if(item == null)
            {
                return null;
            }

            states.add(
                    new ItemState(item)
            );
        }

        states.sort(
                Comparator.comparingInt(
                        state -> state.itemId
                )
        );

        return states;
    }

    public static void record(
            Habbo actor,
            List<ItemState> before,
            List<ItemState> after,
            String label)
    {
        if(actor == null
                || before == null
                || after == null
                || before.isEmpty()
                || before.size() != after.size())
        {
            return;
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return;
        }

        if(!sameIds(before, after))
        {
            return;
        }

        History history =
                HISTORIES.computeIfAbsent(
                        key(actor, room),
                        ignored -> new History()
                );

        Entry entry =
                new Entry(
                        room.getId(),
                        copyStates(before),
                        copyStates(after),
                        label == null
                                ? "Operacion"
                                : label
                );

        synchronized(history)
        {
            history.undo.addLast(entry);

            while(history.undo.size() > MAX_HISTORY)
            {
                history.undo.removeFirst();
            }

            history.redo.clear();
        }
    }


    public static boolean recordReplacement(
            Habbo actor,
            ReplaceGroupService.ReplacementRecord record)
    {
        if(actor == null
                || record == null
                || record.size() < 1
                || record.size()
                > GroupMoveService.MAX_GROUP_SIZE)
        {
            return false;
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null
                || room.getId()
                != record.roomId)
        {
            return false;
        }

        History history =
                HISTORIES.computeIfAbsent(
                        key(actor, room),
                        ignored -> new History()
                );

        Entry entry =
                new Entry(
                        room.getId(),
                        null,
                        null,
                        REPLACEMENT_PREFIX
                                + "Reemplazo",
                        null,
                        record
                );

        synchronized(history)
        {
            history.undo.addLast(entry);

            while(history.undo.size() > MAX_HISTORY)
            {
                history.undo.removeFirst();
            }

            history.redo.clear();
        }

        return true;
    }


    public static void recordPlacement(
            Habbo actor,
            List<ItemState> placed,
            String label)
    {
        if(actor == null
                || placed == null
                || placed.isEmpty()
                || placed.size() > GroupMoveService.MAX_GROUP_SIZE)
        {
            return;
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return;
        }

        History history =
                HISTORIES.computeIfAbsent(
                        key(actor, room),
                        ignored -> new History()
                );

        Entry entry =
                new Entry(
                        room.getId(),
                        copyStates(placed),
                        copyStates(placed),
                        PLACEMENT_PREFIX
                                + (
                                    label == null
                                        ? "Pegado"
                                        : label
                                )
                );

        synchronized(history)
        {
            history.undo.addLast(entry);

            while(history.undo.size() > MAX_HISTORY)
            {
                history.undo.removeFirst();
            }

            history.redo.clear();
        }
    }

    public static boolean recordPlacementWithMetadata(
            Habbo actor,
            List<ItemState> placed,
            String label)
    {
        if(actor == null
                || placed == null
                || placed.isEmpty()
                || placed.size() > GroupMoveService.MAX_GROUP_SIZE)
        {
            return false;
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return false;
        }

        PickupMetadata metadata;

        try
        {
            metadata =
                    capturePickupMetadata(
                            room,
                            itemIdsOf(placed)
                    );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();
            return false;
        }

        History history =
                HISTORIES.computeIfAbsent(
                        key(actor, room),
                        ignored -> new History()
                );

        Entry entry =
                new Entry(
                        room.getId(),
                        copyStates(placed),
                        copyStates(placed),
                        PLACEMENT_PREFIX
                                + (
                                    label == null
                                        ? "Pegado"
                                        : label
                                ),
                        metadata
                );

        synchronized(history)
        {
            history.undo.addLast(entry);

            while(history.undo.size() > MAX_HISTORY)
            {
                history.undo.removeFirst();
            }

            history.redo.clear();
        }

        return true;
    }

    public static Result pickupSelection(
            Habbo actor,
            List<Integer> requestedIds)
    {
        if(actor == null)
        {
            return Result.failure(
                    70,
                    "Usuario no disponible.",
                    false,
                    false
            );
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return Result.failure(
                    71,
                    "No hay una sala activa.",
                    false,
                    false
            );
        }

        if(!room.hasRights(actor))
        {
            return Result.failure(
                    72,
                    "No tienes permisos de construccion en esta sala.",
                    false,
                    false
            );
        }

        BuilderProGroupGuard.Result groupGuard =
                BuilderProGroupGuard.validate(
                        actor,
                        requestedIds
                );

        if(!groupGuard.success)
        {
            return Result.failure(
                    73,
                    groupGuard.message,
                    false,
                    false
            );
        }

        BuilderProItemLockGuard.Result itemLockGuard =
                BuilderProItemLockGuard.validate(
                        actor,
                        requestedIds
                );

        if(!itemLockGuard.success)
        {
            return Result.failure(
                    78,
                    itemLockGuard.message,
                    false,
                    false
            );
        }

        List<ItemState> states =
                capture(
                        actor,
                        requestedIds
                );

        if(states == null
                || states.isEmpty())
        {
            return Result.failure(
                    74,
                    "La seleccion ya no es valida.",
                    false,
                    false
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        for(ItemState state : states)
        {
            HabboItem item =
                    room.getHabboItem(
                            state.itemId
                    );

            if(item == null
                    || item.getUserId() != actorId)
            {
                return Result.failure(
                        75,
                        "La recogida con Undo solo admite furnis de tu propiedad.",
                        false,
                        false
                );
            }

            if(item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR
                    || item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return Result.failure(
                        76,
                        "La seleccion contiene un furni no admitido.",
                        false,
                        false
                );
            }
        }

        PickupMetadata metadata;

        try
        {
            metadata =
                    capturePickupMetadata(
                            room,
                            requestedIds
                    );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return Result.failure(
                    77,
                    "No se pudo capturar la metadata de la seleccion.",
                    false,
                    false
            );
        }

        try
        {
            cleanupPickupMetadata(
                    actor,
                    room,
                    metadata,
                    requestedIds
            );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            try
            {
                restorePickupMetadata(
                        actor,
                        room,
                        metadata
                );
            }
            catch(Exception ignored)
            {
            }

            return Result.failure(
                    78,
                    "No se pudo preparar la recogida.",
                    false,
                    false
            );
        }

        ApplyResult pickup =
                undoPlacement(
                        actor,
                        room,
                        states
                );

        if(!pickup.success)
        {
            try
            {
                restorePickupMetadata(
                        actor,
                        room,
                        metadata
                );
            }
            catch(Exception ignored)
            {
            }

            return Result.failure(
                    pickup.code,
                    pickup.message,
                    false,
                    false
            );
        }

        recordPickup(
                actor,
                states,
                metadata,
                "Recogida"
        );

        return Result.success(
                states.size(),
                "Recogidos: "
                        + states.size()
                        + " furnis.",
                true,
                false
        );
    }

    private static void recordPickup(
            Habbo actor,
            List<ItemState> states,
            PickupMetadata metadata,
            String label)
    {
        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return;
        }

        History history =
                HISTORIES.computeIfAbsent(
                        key(actor, room),
                        ignored -> new History()
                );

        Entry entry =
                new Entry(
                        room.getId(),
                        copyStates(states),
                        copyStates(states),
                        PICKUP_PREFIX
                                + (
                                    label == null
                                        ? "Recogida"
                                        : label
                                ),
                        metadata
                );

        synchronized(history)
        {
            history.undo.addLast(
                    entry
            );

            while(history.undo.size()
                    > MAX_HISTORY)
            {
                history.undo.removeFirst();
            }

            history.redo.clear();
        }
    }

    public static void invalidate(
            Habbo actor)
    {
        if(actor == null)
        {
            return;
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return;
        }

        HISTORIES.remove(
                key(actor, room)
        );
    }

    public static Result execute(
            Habbo actor,
            int action)
    {
        if(actor == null)
        {
            return Result.failure(
                    1,
                    "Usuario no disponible.",
                    false,
                    false
            );
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return Result.failure(
                    2,
                    "No hay una sala activa.",
                    false,
                    false
            );
        }

        if(!room.hasRights(actor))
        {
            return Result.failure(
                    3,
                    "No tienes permisos de construccion en esta sala.",
                    false,
                    false
            );
        }

        if(action != ACTION_UNDO
                && action != ACTION_REDO)
        {
            return Result.failure(
                    4,
                    "Accion de historial invalida.",
                    false,
                    false
            );
        }

        History history =
                HISTORIES.get(
                        key(actor, room)
                );

        if(history == null)
        {
            return Result.failure(
                    5,
                    action == ACTION_UNDO
                            ? "No hay nada que deshacer."
                            : "No hay nada que rehacer.",
                    false,
                    false
            );
        }

        synchronized(history)
        {
            Deque<Entry> source =
                    action == ACTION_UNDO
                            ? history.undo
                            : history.redo;

            if(source.isEmpty())
            {
                return Result.failure(
                        5,
                        action == ACTION_UNDO
                                ? "No hay nada que deshacer."
                                : "No hay nada que rehacer.",
                        !history.undo.isEmpty(),
                        !history.redo.isEmpty()
                );
            }

            Entry entry =
                    source.peekLast();

            if(entry == null
                    || entry.roomId != room.getId())
            {
                history.undo.clear();
                history.redo.clear();

                return Result.failure(
                        6,
                        "El historial ya no pertenece a esta sala.",
                        false,
                        false
                );
            }


            if(entry.label != null
                    && entry.label.startsWith(
                            REPLACEMENT_PREFIX
                    ))
            {
                ReplaceGroupService.HistoryApplyResult replacement =
                        ReplaceGroupService.applyHistory(
                                actor,
                                entry.replacementRecord,
                                action == ACTION_UNDO
                        );

                if(!replacement.success)
                {
                    if(replacement.invalidateHistory)
                    {
                        history.undo.clear();
                        history.redo.clear();
                    }

                    return Result.failure(
                            replacement.code,
                            replacement.message,
                            !history.undo.isEmpty(),
                            !history.redo.isEmpty()
                    );
                }

                source.removeLast();

                if(action == ACTION_UNDO)
                {
                    history.redo.addLast(
                            entry
                    );
                }
                else
                {
                    history.undo.addLast(
                            entry
                    );
                }

                return Result.success(
                        replacement.affectedCount,
                        replacement.message,
                        !history.undo.isEmpty(),
                        !history.redo.isEmpty()
                );
            }

            if(entry.label != null
                    && entry.label.startsWith(
                            PICKUP_PREFIX
                    ))
            {
                ApplyResult pickupApply;

                if(action == ACTION_REDO)
                {
                    BuilderProItemLockGuard.Result itemLockGuard =
                            BuilderProItemLockGuard.validate(
                                    actor,
                                    itemIdsOf(
                                            entry.after
                                    )
                            );

                    if(!itemLockGuard.success)
                    {
                        return Result.failure(
                                81,
                                itemLockGuard.message,
                                !history.undo.isEmpty(),
                                !history.redo.isEmpty()
                        );
                    }
                }

                if(action == ACTION_UNDO)
                {
                    pickupApply =
                            redoPlacement(
                                    actor,
                                    room,
                                    entry.after
                            );

                    if(pickupApply.success)
                    {
                        try
                        {
                            restorePickupMetadata(
                                    actor,
                                    room,
                                    entry.pickupMetadata
                            );
                        }
                        catch(Exception exception)
                        {
                            exception.printStackTrace();

                            try
                            {
                                cleanupPickupMetadata(
                                        actor,
                                        room,
                                        entry.pickupMetadata,
                                        itemIdsOf(
                                                entry.after
                                        )
                                );

                                undoPlacement(
                                        actor,
                                        room,
                                        entry.after
                                );
                            }
                            catch(Exception ignored)
                            {
                            }

                            history.undo.clear();
                            history.redo.clear();

                            return Result.failure(
                                    79,
                                    "No se pudo restaurar completamente la recogida.",
                                    false,
                                    false
                            );
                        }
                    }
                }
                else
                {
                    try
                    {
                        cleanupPickupMetadata(
                                actor,
                                room,
                                entry.pickupMetadata,
                                itemIdsOf(
                                        entry.after
                                )
                        );
                    }
                    catch(Exception exception)
                    {
                        exception.printStackTrace();

                        try
                        {
                            restorePickupMetadata(
                                    actor,
                                    room,
                                    entry.pickupMetadata
                            );
                        }
                        catch(Exception ignored)
                        {
                        }

                        return Result.failure(
                                80,
                                "No se pudo preparar el rehacer de la recogida.",
                                !history.undo.isEmpty(),
                                !history.redo.isEmpty()
                        );
                    }

                    pickupApply =
                            undoPlacement(
                                    actor,
                                    room,
                                    entry.after
                            );

                    if(!pickupApply.success)
                    {
                        try
                        {
                            restorePickupMetadata(
                                    actor,
                                    room,
                                    entry.pickupMetadata
                            );
                        }
                        catch(Exception ignored)
                        {
                        }
                    }
                }

                if(!pickupApply.success)
                {
                    if(pickupApply.invalidateHistory)
                    {
                        history.undo.clear();
                        history.redo.clear();
                    }

                    return Result.failure(
                            pickupApply.code,
                            pickupApply.message,
                            !history.undo.isEmpty(),
                            !history.redo.isEmpty()
                    );
                }

                source.removeLast();

                if(action == ACTION_UNDO)
                {
                    history.redo.addLast(
                            entry
                    );
                }
                else
                {
                    history.undo.addLast(
                            entry
                    );
                }

                String pickupLabel =
                        entry.label.substring(
                                PICKUP_PREFIX.length()
                        );

                return Result.success(
                        entry.after.size(),
                        (
                            action == ACTION_UNDO
                                ? "Deshecho: "
                                : "Rehecho: "
                        ) + pickupLabel + ".",
                        !history.undo.isEmpty(),
                        !history.redo.isEmpty()
                );
            }

            if(entry.label != null
                    && entry.label.startsWith(
                            PLACEMENT_PREFIX
                    ))
            {
                ApplyResult placementApply;

                if(action == ACTION_UNDO)
                {
                    BuilderProItemLockGuard.Result itemLockGuard =
                            BuilderProItemLockGuard.validate(
                                    actor,
                                    itemIdsOf(
                                            entry.after
                                    )
                            );

                    if(!itemLockGuard.success)
                    {
                        return Result.failure(
                                69,
                                itemLockGuard.message,
                                !history.undo.isEmpty(),
                                !history.redo.isEmpty()
                        );
                    }
                }

                if(action == ACTION_UNDO)
                {
                    boolean metadataCleared =
                            false;

                    if(entry.pickupMetadata != null)
                    {
                        try
                        {
                            cleanupPickupMetadata(
                                    actor,
                                    room,
                                    entry.pickupMetadata,
                                    itemIdsOf(
                                            entry.after
                                    )
                            );

                            metadataCleared =
                                    true;
                        }
                        catch(Exception exception)
                        {
                            try
                            {
                                restorePickupMetadata(
                                        actor,
                                        room,
                                        entry.pickupMetadata
                                );
                            }
                            catch(Exception ignored)
                            {
                            }

                            return Result.failure(
                                    49,
                                    "No se pudo preparar la metadata para Undo.",
                                    !history.undo.isEmpty(),
                                    !history.redo.isEmpty()
                            );
                        }
                    }

                    placementApply =
                            undoPlacement(
                                    actor,
                                    room,
                                    entry.after
                            );

                    if(!placementApply.success
                            && metadataCleared)
                    {
                        try
                        {
                            restorePickupMetadata(
                                    actor,
                                    room,
                                    entry.pickupMetadata
                            );
                        }
                        catch(Exception exception)
                        {
                            history.undo.clear();
                            history.redo.clear();

                            return Result.failure(
                                    58,
                                    "Undo fallo y no se pudo restaurar su metadata.",
                                    false,
                                    false
                            );
                        }
                    }
                }
                else
                {
                    placementApply =
                            redoPlacement(
                                    actor,
                                    room,
                                    entry.after
                            );

                    if(placementApply.success
                            && entry.pickupMetadata != null)
                    {
                        try
                        {
                            restorePickupMetadata(
                                    actor,
                                    room,
                                    entry.pickupMetadata
                            );
                        }
                        catch(Exception exception)
                        {
                            try
                            {
                                cleanupPickupMetadata(
                                        actor,
                                        room,
                                        entry.pickupMetadata,
                                        itemIdsOf(
                                                entry.after
                                        )
                                );
                            }
                            catch(Exception ignored)
                            {
                            }

                            ApplyResult rollback =
                                    undoPlacement(
                                            actor,
                                            room,
                                            entry.after
                                    );

                            if(!rollback.success)
                            {
                                history.undo.clear();
                                history.redo.clear();

                                return Result.failure(
                                        68,
                                        "Redo fallo al restaurar metadata y no pudo revertirse.",
                                        false,
                                        false
                                );
                            }

                            return Result.failure(
                                    67,
                                    "Redo cancelado: no se pudo restaurar la metadata.",
                                    !history.undo.isEmpty(),
                                    !history.redo.isEmpty()
                            );
                        }
                    }
                }

                if(!placementApply.success)
                {
                    if(placementApply.invalidateHistory)
                    {
                        history.undo.clear();
                        history.redo.clear();
                    }

                    return Result.failure(
                            placementApply.code,
                            placementApply.message,
                            !history.undo.isEmpty(),
                            !history.redo.isEmpty()
                    );
                }

                source.removeLast();

                if(action == ACTION_UNDO)
                {
                    history.redo.addLast(entry);
                }
                else
                {
                    history.undo.addLast(entry);
                }

                String placementLabel =
                        entry.label.substring(
                                PLACEMENT_PREFIX.length()
                        );

                return Result.success(
                        entry.after.size(),
                        (
                            action == ACTION_UNDO
                                ? "Deshecho: "
                                : "Rehecho: "
                        ) + placementLabel + ".",
                        !history.undo.isEmpty(),
                        !history.redo.isEmpty()
                );
            }

            List<ItemState> expected =
                    action == ACTION_UNDO
                            ? entry.after
                            : entry.before;

            List<ItemState> target =
                    action == ACTION_UNDO
                            ? entry.before
                            : entry.after;

            BuilderProItemLockGuard.Result itemLockGuard =
                    BuilderProItemLockGuard.validate(
                            actor,
                            itemIdsOf(
                                    expected
                            )
                    );

            if(!itemLockGuard.success)
            {
                return Result.failure(
                        82,
                        itemLockGuard.message,
                        !history.undo.isEmpty(),
                        !history.redo.isEmpty()
                );
            }

            ApplyResult apply =
                    apply(
                            actor,
                            room,
                            expected,
                            target
                    );

            if(!apply.success)
            {
                if(apply.invalidateHistory)
                {
                    history.undo.clear();
                    history.redo.clear();
                }

                return Result.failure(
                        apply.code,
                        apply.message,
                        !history.undo.isEmpty(),
                        !history.redo.isEmpty()
                );
            }

            source.removeLast();

            if(action == ACTION_UNDO)
            {
                history.redo.addLast(entry);
            }
            else
            {
                history.undo.addLast(entry);
            }

            return Result.success(
                    target.size(),
                    (
                        action == ACTION_UNDO
                            ? "Deshecho: "
                            : "Rehecho: "
                    ) + entry.label + ".",
                    !history.undo.isEmpty(),
                    !history.redo.isEmpty()
            );
        }
    }

    public static void clearAll()
    {
        HISTORIES.clear();
    }


    private static PickupMetadata capturePickupMetadata(
            Room room,
            List<Integer> requestedIds)
            throws Exception
    {
        Set<Integer> requested =
                new HashSet<Integer>(
                        requestedIds
                );

        List<GroupSnapshot> groups =
                new ArrayList<GroupSnapshot>();

        for(BuilderProGroupRepository.SavedGroup group :
                BuilderProGroupRepository.list(
                        room.getId()
                ))
        {
            boolean touched = false;

            for(Integer itemId :
                    group.itemIds)
            {
                if(requested.contains(
                        itemId
                ))
                {
                    touched = true;
                    break;
                }
            }

            if(touched)
            {
                groups.add(
                        new GroupSnapshot(
                                group
                        )
                );
            }
        }

        List<Integer> traversable =
                new ArrayList<Integer>();

        for(Integer itemId :
                BuilderProTraversalRepository.list(
                        room.getId()
                ))
        {
            if(requested.contains(
                    itemId
            ))
            {
                traversable.add(
                        itemId
                );
            }
        }

        Map<Integer, Integer> layerMemberships =
                BuilderProLayerRepository.memberships(
                        requestedIds
                );

        return new PickupMetadata(
                groups,
                traversable,
                layerMemberships
        );
    }

    private static void cleanupPickupMetadata(
            Habbo actor,
            Room room,
            PickupMetadata metadata,
            List<Integer> requestedIds)
            throws Exception
    {
        if(metadata == null)
        {
            return;
        }

        for(Integer itemId :
                requestedIds)
        {
            if(itemId == null)
            {
                continue;
            }

            BuilderProGroupRepository.removeItem(
                    itemId.intValue()
            );

            BuilderProLayerRepository.removeItem(
                    itemId.intValue()
            );
        }

        if(!metadata.traversableIds.isEmpty())
        {
            BuilderProTraversalService.Result traversal =
                    BuilderProTraversalService.execute(
                            actor,
                            BuilderProTraversalService.OP_SET,
                            false,
                            metadata.traversableIds
                    );

            if(!traversal.success)
            {
                throw new IllegalStateException(
                        traversal.message
                );
            }
        }
    }

    private static void restorePickupMetadata(
            Habbo actor,
            Room room,
            PickupMetadata metadata)
            throws Exception
    {
        if(metadata == null)
        {
            return;
        }

        for(GroupSnapshot snapshot :
                metadata.groups)
        {
            for(Integer itemId :
                    snapshot.itemIds)
            {
                if(room.getHabboItem(
                        itemId.intValue()
                ) == null)
                {
                    throw new IllegalStateException(
                            "Falta un miembro original del grupo."
                    );
                }
            }

            BuilderProGroupRepository.SavedGroup current =
                    BuilderProGroupRepository.find(
                            room.getId(),
                            snapshot.groupId
                    );

            if(current == null)
            {
                for(BuilderProGroupRepository.SavedGroup candidate :
                        BuilderProGroupRepository.list(
                                room.getId()
                        ))
                {
                    if(candidate.name.equals(
                            snapshot.name
                    ))
                    {
                        current =
                                candidate;

                        break;
                    }
                }
            }

            if(current == null)
            {
                snapshot.groupId =
                        BuilderProGroupRepository.create(
                                room.getId(),
                                snapshot.createdBy,
                                snapshot.name,
                                snapshot.locked,
                                snapshot.itemIds
                        );
            }
            else
            {
                snapshot.groupId =
                        current.id;

                BuilderProGroupRepository.rename(
                        room.getId(),
                        current.id,
                        snapshot.name
                );

                BuilderProGroupRepository.setLocked(
                        room.getId(),
                        current.id,
                        snapshot.locked
                );

                BuilderProGroupRepository.replaceMembers(
                        room.getId(),
                        current.id,
                        snapshot.itemIds
                );
            }
        }

        Map<Integer, List<Integer>> layerItems =
                new HashMap<Integer, List<Integer>>();

        for(Map.Entry<Integer, Integer> membership :
                metadata.layerMemberships.entrySet())
        {
            int itemId = membership.getKey().intValue();
            int layerId = membership.getValue().intValue();

            if(room.getHabboItem(itemId) == null)
            {
                continue;
            }

            if(BuilderProLayerRepository.find(
                    room.getId(),
                    layerId) == null)
            {
                continue;
            }

            List<Integer> items = layerItems.get(layerId);

            if(items == null)
            {
                items = new ArrayList<Integer>();
                layerItems.put(layerId, items);
            }

            items.add(itemId);
        }

        for(Map.Entry<Integer, List<Integer>> layerEntry :
                layerItems.entrySet())
        {
            BuilderProLayerRepository.assignItems(
                    room.getId(),
                    layerEntry.getKey().intValue(),
                    layerEntry.getValue()
            );
        }

        if(!metadata.traversableIds.isEmpty())
        {
            BuilderProTraversalService.Result traversal =
                    BuilderProTraversalService.execute(
                            actor,
                            BuilderProTraversalService.OP_SET,
                            true,
                            metadata.traversableIds
                    );

            if(!traversal.success)
            {
                throw new IllegalStateException(
                        traversal.message
                );
            }
        }
    }

    private static List<Integer> itemIdsOf(
            List<ItemState> states)
    {
        List<Integer> result =
                new ArrayList<Integer>(
                        states.size()
                );

        for(ItemState state :
                states)
        {
            result.add(
                    state.itemId
            );
        }

        return result;
    }

    private static ApplyResult undoPlacement(
            Habbo actor,
            Room room,
            List<ItemState> states)
    {
        if(states == null
                || states.isEmpty()
                || states.size()
                > GroupMoveService.MAX_GROUP_SIZE)
        {
            return ApplyResult.failure(
                    50,
                    "Entrada de pegado invalida.",
                    true
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        TIntObjectMap<HabboItem> inventoryMap =
                actor.getInventory()
                        .getItemsComponent()
                        .getItems();

        List<Target> targets =
                new ArrayList<Target>();

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        RoomLayout layout =
                room.getLayout();

        for(ItemState state : states)
        {
            HabboItem item =
                    room.getHabboItem(
                            state.itemId
                    );

            if(item == null
                    || item.getRoomId() != room.getId())
            {
                return ApplyResult.failure(
                        51,
                        "Uno de los furnis pegados ya no esta en la sala.",
                        true
                );
            }

            if(item.getUserId() != actorId
                    || item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR
                    || item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return ApplyResult.failure(
                        52,
                        "Uno de los furnis pegados ya no es valido.",
                        true
                );
            }

            if(!matches(
                    item,
                    state))
            {
                return ApplyResult.failure(
                        53,
                        "El pegado ya no coincide con su estado original.",
                        true
                );
            }

            targets.add(
                    new Target(
                            item,
                            state
                    )
            );

            addFootprint(
                    layout,
                    state.x,
                    state.y,
                    item,
                    state.rotation,
                    affectedTiles
            );
        }

        synchronized(inventoryMap)
        {
            for(Target target : targets)
            {
                if(inventoryMap.get(
                        target.item.getId()
                ) != null)
                {
                    return ApplyResult.failure(
                            54,
                            "El inventario ya contiene uno de los furnis del pegado.",
                            true
                    );
                }
            }
        }

        targets.sort(
                Comparator.comparingInt(
                        target ->
                                target.item.getId()
                )
        );

        List<Target> removed =
                new ArrayList<Target>();

        try
        {
            for(Target target : targets)
            {
                HabboItem item =
                        target.item;

                room.removeHabboItem(
                        item
                );

                removed.add(
                        target
                );

                item.onPickUp(
                        room
                );

                item.setRoomId(0);
                item.needsUpdate(true);

                room.sendComposer(
                        new RemoveFloorItemComposer(
                                item
                        ).compose()
                );

                item.run();

                if(room.getHabboItem(
                        item.getId()
                ) != null
                        || item.getRoomId() != 0)
                {
                    restorePlacementRoomDirect(
                            actor,
                            room,
                            removed,
                            affectedTiles
                    );

                    return ApplyResult.failure(
                            55,
                            "No se pudo retirar atomicamente el pegado.",
                            true
                    );
                }
            }

            synchronized(inventoryMap)
            {
                for(Target target : targets)
                {
                    if(inventoryMap.get(
                            target.item.getId()
                    ) != null)
                    {
                        restorePlacementRoomDirect(
                                actor,
                                room,
                                removed,
                                affectedTiles
                        );

                        return ApplyResult.failure(
                                56,
                                "El inventario cambio durante Undo.",
                                true
                        );
                    }
                }

                for(Target target : targets)
                {
                    inventoryMap.put(
                            target.item.getId(),
                            target.item
                    );
                }
            }

            refreshAffectedTiles(
                    room,
                    affectedTiles
            );

            for(Target target : targets)
            {
                try
                {
                    actor.getClient()
                            .sendResponse(
                                    new AddHabboItemComposer(
                                            target.item
                                    )
                            );
                }
                catch(Exception notificationError)
                {
                    System.out.println(
                            "[BuilderProTrace] HISTORY_UNDO_PASTE inventory notify failed item="
                                    + target.item.getId()
                    );
                }
            }

            try
            {
                actor.getClient()
                        .sendResponse(
                                new InventoryRefreshComposer()
                        );
            }
            catch(Exception notificationError)
            {
                System.out.println(
                        "[BuilderProTrace] HISTORY_UNDO_PASTE refresh notify failed"
                );
            }

            return ApplyResult.success();
        }
        catch(Exception exception)
        {
            restorePlacementRoomDirect(
                    actor,
                    room,
                    removed,
                    affectedTiles
            );

            return ApplyResult.failure(
                    57,
                    "Undo del pegado fue revertido por un error interno.",
                    false
            );
        }
    }

    private static ApplyResult redoPlacement(
            Habbo actor,
            Room room,
            List<ItemState> states)
    {
        if(states == null
                || states.isEmpty()
                || states.size()
                > GroupMoveService.MAX_GROUP_SIZE)
        {
            return ApplyResult.failure(
                    60,
                    "Entrada de pegado invalida.",
                    true
            );
        }

        if(room.itemCount() + states.size()
                > Room.MAXIMUM_FURNI)
        {
            return ApplyResult.failure(
                    61,
                    "La sala alcanzaria el limite de furnis.",
                    false
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        TIntObjectMap<HabboItem> inventoryMap =
                actor.getInventory()
                        .getItemsComponent()
                        .getItems();

        List<Target> targets =
                new ArrayList<Target>();

        synchronized(inventoryMap)
        {
            for(ItemState state : states)
            {
                HabboItem item =
                        inventoryMap.get(
                                state.itemId
                        );

                if(item == null
                        || item.getRoomId() != 0)
                {
                    return ApplyResult.failure(
                            62,
                            "Uno de los furnis del pegado ya no esta en tu inventario.",
                            true
                    );
                }

                if(room.getHabboItem(
                        item.getId()
                ) != null)
                {
                    return ApplyResult.failure(
                            63,
                            "Uno de los furnis del pegado ya existe en la sala.",
                            true
                    );
                }

                if(item.getUserId() != actorId
                        || item.getBaseItem() == null
                        || item.getBaseItem().getType()
                        != FurnitureType.FLOOR
                        || item instanceof InteractionStackHelper
                        || item instanceof InteractionTileWalkMagic)
                {
                    return ApplyResult.failure(
                            64,
                            "Uno de los furnis del pegado ya no es valido.",
                            true
                    );
                }

                targets.add(
                        new Target(
                                item,
                                state
                        )
                );
            }
        }

        ApplyResult specialValidation =
                validatePlacementSpecialItems(
                        room,
                        targets
                );

        if(!specialValidation.success)
        {
            return specialValidation;
        }

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        for(Target target : targets)
        {
            ApplyResult validation =
                    validatePlacementTarget(
                            room,
                            target,
                            affectedTiles
                    );

            if(!validation.success)
            {
                return validation;
            }
        }

        Map<Integer, Double> forcedHeights =
                new HashMap<Integer, Double>();

        for(Target target : targets)
        {
            forcedHeights.put(
                    target.item.getId(),
                    target.state.z
            );
        }

        targets.sort(
                Comparator.comparingInt(
                        target ->
                                target.item.getId()
                )
        );

        List<Target> placed =
                new ArrayList<Target>();

        BuilderProContext.begin(
                actorId,
                forcedHeights
        );

        try
        {
            for(Target target : targets)
            {
                ItemState state =
                        target.state;

                RoomTile destination =
                        room.getLayout()
                                .getTile(
                                        state.x,
                                        state.y
                                );

                FurnitureMovementError error =
                        room.placeFloorFurniAt(
                                target.item,
                                destination,
                                state.rotation,
                                actor
                        );

                if(error != FurnitureMovementError.NONE)
                {
                    rollbackRedoPlacement(
                            room,
                            placed,
                            affectedTiles
                    );

                    return ApplyResult.failure(
                            65,
                            "Redo del pegado cancelado por el servidor: "
                                    + error.name(),
                            false
                    );
                }

                placed.add(
                        target
                );

                if(target.item.getRoomId()
                        != room.getId()
                        || !matches(
                                target.item,
                                state
                        ))
                {
                    rollbackRedoPlacement(
                            room,
                            placed,
                            affectedTiles
                    );

                    return ApplyResult.failure(
                            66,
                            "El servidor altero la geometria exacta del pegado.",
                            false
                    );
                }
            }

            synchronized(inventoryMap)
            {
                for(Target target : targets)
                {
                    if(inventoryMap.get(
                            target.item.getId()
                    ) != target.item)
                    {
                        rollbackRedoPlacement(
                                room,
                                placed,
                                affectedTiles
                        );

                        return ApplyResult.failure(
                                67,
                                "El inventario cambio durante Redo.",
                                true
                        );
                    }
                }

                for(Target target : targets)
                {
                    inventoryMap.remove(
                            target.item.getId()
                    );
                }
            }

            refreshAffectedTiles(
                    room,
                    affectedTiles
            );

            for(Target target : targets)
            {
                try
                {
                    actor.getClient()
                            .sendResponse(
                                    new RemoveHabboItemComposer(
                                            target.item
                                                    .getGiftAdjustedId()
                                    )
                            );
                }
                catch(Exception notificationError)
                {
                    System.out.println(
                            "[BuilderProTrace] HISTORY_REDO_PASTE inventory notify failed item="
                                    + target.item.getId()
                    );
                }

                target.item.setFromGift(false);
            }

            return ApplyResult.success();
        }
        catch(Exception exception)
        {
            rollbackRedoPlacement(
                    room,
                    placed,
                    affectedTiles
            );

            return ApplyResult.failure(
                    68,
                    "Redo del pegado fue revertido por un error interno.",
                    false
            );
        }
        finally
        {
            BuilderProContext.clear();
        }
    }

    private static ApplyResult validatePlacementSpecialItems(
            Room room,
            List<Target> targets)
    {
        int moodLights = 0;
        int jukeboxes = 0;

        for(Target target : targets)
        {
            if(target.item instanceof InteractionMoodLight)
            {
                moodLights++;
            }

            if(target.item instanceof InteractionJukeBox)
            {
                jukeboxes++;
            }
        }

        if(moodLights > 0)
        {
            int existing =
                    room.getRoomSpecialTypes()
                            .getItemsOfType(
                                    InteractionMoodLight.class
                            )
                            .size();

            if(existing + moodLights > 1)
            {
                return ApplyResult.failure(
                        69,
                        "La sala no admite otro regulador de ambiente.",
                        false
                );
            }
        }

        if(jukeboxes > 0)
        {
            int existing =
                    room.getRoomSpecialTypes()
                            .getItemsOfType(
                                    InteractionJukeBox.class
                            )
                            .size();

            if(existing + jukeboxes > 1)
            {
                return ApplyResult.failure(
                        70,
                        "La sala no admite otro jukebox.",
                        false
                );
            }
        }

        return ApplyResult.success();
    }

    private static ApplyResult validatePlacementTarget(
            Room room,
            Target target,
            THashSet<RoomTile> affectedTiles)
    {
        RoomLayout layout =
                room.getLayout();

        HabboItem item =
                target.item;

        ItemState state =
                target.state;

        if(state.z > Room.MAXIMUM_FURNI_HEIGHT
                || state.z < -9999.0D)
        {
            return ApplyResult.failure(
                    71,
                    "La altura del pegado queda fuera del rango admitido.",
                    false
            );
        }

        RoomTile anchor =
                layout.getTile(
                        state.x,
                        state.y
                );

        if(anchor == null)
        {
            return ApplyResult.failure(
                    72,
                    "El destino del pegado queda fuera del mapa.",
                    false
            );
        }

        if(!layout.fitsOnMap(
                anchor,
                item.getBaseItem().getWidth(),
                item.getBaseItem().getLength(),
                state.rotation))
        {
            return ApplyResult.failure(
                    72,
                    "Un furni del pegado no cabe dentro del mapa.",
                    false
            );
        }

        Rectangle rectangle =
                RoomLayout.getRectangle(
                        state.x,
                        state.y,
                        item.getBaseItem().getWidth(),
                        item.getBaseItem().getLength(),
                        state.rotation
                );

        double movingBottom =
                state.z;

        double movingTop =
                state.z
                        + Item.getCurrentHeight(
                                item
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
                        layout.getTile(
                                (short)x,
                                (short)y
                        );

                if(tile == null
                        || tile.getState()
                        == RoomTileState.INVALID)
                {
                    return ApplyResult.failure(
                            73,
                            "El destino del pegado contiene tiles invalidos.",
                            false
                    );
                }

                affectedTiles.add(
                        tile
                );

                if(state.z
                        < layout.getHeightAtSquare(
                                x,
                                y
                        ))
                {
                    return ApplyResult.failure(
                            74,
                            "Un furni del pegado quedaria por debajo del suelo.",
                            false
                    );
                }

                if(room.hasHabbosAt(x, y)
                        || room.hasBotsAt(x, y)
                        || room.hasPetsAt(x, y))
                {
                    return ApplyResult.failure(
                            75,
                            "Hay una unidad ocupando el destino del pegado.",
                            false
                    );
                }

                for(HabboItem existing
                        : room.getItemsAt(tile))
                {
                    if(existing == null)
                    {
                        continue;
                    }

                    if(existing.getBaseItem() == null)
                    {
                        return ApplyResult.failure(
                                76,
                                "El destino contiene un furni externo invalido.",
                                false
                        );
                    }

                    double existingBottom =
                            existing.getZ();

                    double existingTop =
                            existing.getZ()
                                    + Item.getCurrentHeight(
                                            existing
                                    );

                    if(verticalRangesOverlap(
                            movingBottom,
                            movingTop,
                            existingBottom,
                            existingTop))
                    {
                        return ApplyResult.failure(
                                76,
                                "El pegado colisiona con un furni externo.",
                                false
                        );
                    }
                }
            }
        }

        addFootprint(
                layout,
                state.x,
                state.y,
                item,
                state.rotation,
                affectedTiles
        );

        return ApplyResult.success();
    }

    private static void restorePlacementRoomDirect(
            Habbo actor,
            Room room,
            List<Target> removed,
            THashSet<RoomTile> affectedTiles)
    {
        for(Target target : removed)
        {
            HabboItem item =
                    target.item;

            ItemState state =
                    target.state;

            try
            {
                if(room.getHabboItem(
                        item.getId()
                ) != null)
                {
                    continue;
                }

                item.setX(state.x);
                item.setY(state.y);
                item.setZ(state.z);
                item.setRotation(
                        state.rotation
                );

                item.needsUpdate(true);

                room.addHabboItem(
                        item
                );

                item.setRoomId(
                        room.getId()
                );

                item.onPlace(
                        room
                );

                room.sendComposer(
                        new AddFloorItemComposer(
                                item,
                                actor.getHabboInfo()
                                        .getUsername()
                        ).compose()
                );

                item.run();
            }
            catch(Exception rollbackError)
            {
                System.out.println(
                        "[BuilderProTrace] HISTORY_UNDO_PASTE_ROLLBACK item="
                                + item.getId()
                                + " "
                                + rollbackError
                                        .getClass()
                                        .getName()
                );
            }
        }

        refreshAffectedTiles(
                room,
                affectedTiles
        );
    }

    private static void rollbackRedoPlacement(
            Room room,
            List<Target> placed,
            THashSet<RoomTile> affectedTiles)
    {
        for(int index = placed.size() - 1;
                index >= 0;
                index--)
        {
            Target target =
                    placed.get(index);

            HabboItem item =
                    target.item;

            try
            {
                if(room.getHabboItem(
                        item.getId()
                ) == null)
                {
                    continue;
                }

                room.removeHabboItem(
                        item
                );

                item.onPickUp(
                        room
                );

                item.setRoomId(0);
                item.needsUpdate(true);

                room.sendComposer(
                        new RemoveFloorItemComposer(
                                item
                        ).compose()
                );

                item.run();
            }
            catch(Exception rollbackError)
            {
                System.out.println(
                        "[BuilderProTrace] HISTORY_REDO_PASTE_ROLLBACK item="
                                + item.getId()
                                + " "
                                + rollbackError
                                        .getClass()
                                        .getName()
                );
            }
        }

        refreshAffectedTiles(
                room,
                affectedTiles
        );
    }

    private static ApplyResult apply(
            Habbo actor,
            Room room,
            List<ItemState> expected,
            List<ItemState> target)
    {
        if(expected == null
                || target == null
                || expected.isEmpty()
                || expected.size() != target.size()
                || !sameIds(expected, target))
        {
            return ApplyResult.failure(
                    30,
                    "Entrada de historial invalida.",
                    true
            );
        }

        if(isStateOnlyTransition(
                expected,
                target))
        {
            return applyStateOnly(
                    room,
                    expected,
                    target
            );
        }

        Map<Integer, ItemState> expectedById =
                new HashMap<Integer, ItemState>();

        for(ItemState state : expected)
        {
            expectedById.put(
                    state.itemId,
                    state
            );
        }

        Set<Integer> selectedIds =
                new HashSet<Integer>();

        List<Target> targets =
                new ArrayList<Target>();

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        RoomLayout layout =
                room.getLayout();

        for(ItemState state : target)
        {
            HabboItem item =
                    room.getHabboItem(
                            state.itemId
                    );

            ItemState expectedState =
                    expectedById.get(
                            state.itemId
                    );

            if(item == null
                    || expectedState == null)
            {
                return ApplyResult.failure(
                        31,
                        "Uno de los furnis del historial ya no existe en la sala.",
                        true
                );
            }

            if(item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR)
            {
                return ApplyResult.failure(
                        32,
                        "El historial contiene un furni no admitido.",
                        true
                );
            }

            if(item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return ApplyResult.failure(
                        33,
                        "El historial contiene una baldosa de arquitecto.",
                        true
                );
            }

            if(!matches(
                    item,
                    expectedState))
            {
                return ApplyResult.failure(
                        34,
                        "El estado actual ya no coincide con el historial.",
                        true
                );
            }

            selectedIds.add(
                    item.getId()
            );

            targets.add(
                    new Target(
                            item,
                            state
                    )
            );

            addFootprint(
                    layout,
                    expectedState.x,
                    expectedState.y,
                    item,
                    expectedState.rotation,
                    affectedTiles
            );
        }

        for(Target targetEntry : targets)
        {
            HabboItem item =
                    targetEntry.item;

            ItemState state =
                    targetEntry.state;

            if(state.z > Room.MAXIMUM_FURNI_HEIGHT
                    || state.z < -9999.0D)
            {
                return ApplyResult.failure(
                        35,
                        "La altura de historial queda fuera del rango admitido.",
                        false
                );
            }

            RoomTile anchor =
                    layout.getTile(
                            state.x,
                            state.y
                    );

            if(anchor == null)
            {
                return ApplyResult.failure(
                        36,
                        "El destino de historial queda fuera del mapa.",
                        false
                );
            }

            if(!layout.fitsOnMap(
                    anchor,
                    item.getBaseItem().getWidth(),
                    item.getBaseItem().getLength(),
                    state.rotation))
            {
                return ApplyResult.failure(
                        36,
                        "Un furni del historial no cabe dentro del mapa.",
                        false
                );
            }

            Rectangle rectangle =
                    RoomLayout.getRectangle(
                            state.x,
                            state.y,
                            item.getBaseItem().getWidth(),
                            item.getBaseItem().getLength(),
                            state.rotation
                    );

            double movingBottom =
                    state.z;

            double movingTop =
                    state.z
                            + Item.getCurrentHeight(
                                    item
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
                            layout.getTile(
                                    (short)x,
                                    (short)y
                            );

                    if(tile == null
                            || tile.getState()
                            == RoomTileState.INVALID)
                    {
                        return ApplyResult.failure(
                                37,
                                "El destino del historial contiene tiles invalidos.",
                                false
                        );
                    }

                    affectedTiles.add(tile);

                    if(state.z
                            < layout.getHeightAtSquare(
                                    x,
                                    y
                            ))
                    {
                        return ApplyResult.failure(
                                38,
                                "Un furni del historial quedaria por debajo del suelo.",
                                false
                        );
                    }

                    if(room.hasHabbosAt(x, y)
                            || room.hasBotsAt(x, y)
                            || room.hasPetsAt(x, y))
                    {
                        return ApplyResult.failure(
                                39,
                                "Hay una unidad ocupando el destino del historial.",
                                false
                        );
                    }

                    for(HabboItem existing
                            : room.getItemsAt(tile))
                    {
                        if(existing == null)
                        {
                            continue;
                        }

                        if(selectedIds.contains(
                                existing.getId()))
                        {
                            continue;
                        }

                        if(existing.getBaseItem() == null)
                        {
                            return ApplyResult.failure(
                                    40,
                                    "El destino contiene un furni externo invalido.",
                                    false
                            );
                        }

                        double existingBottom =
                                existing.getZ();

                        double existingTop =
                                existing.getZ()
                                        + Item.getCurrentHeight(
                                                existing
                                        );

                        if(verticalRangesOverlap(
                                movingBottom,
                                movingTop,
                                existingBottom,
                                existingTop))
                        {
                            return ApplyResult.failure(
                                    41,
                                    "El historial colisiona con un furni externo.",
                                    false
                            );
                        }
                    }
                }
            }

            addFootprint(
                    layout,
                    state.x,
                    state.y,
                    item,
                    state.rotation,
                    affectedTiles
            );
        }

        Map<Integer, Double> forcedHeights =
                new HashMap<Integer, Double>();

        for(Target targetEntry : targets)
        {
            forcedHeights.put(
                    targetEntry.item.getId(),
                    targetEntry.state.z
            );
        }

        targets.sort(
                Comparator.comparingInt(
                        targetEntry ->
                                targetEntry.item.getId()
                )
        );

        int actorId =
                actor.getHabboInfo()
                        .getId();

        BuilderProContext.begin(
                actorId,
                forcedHeights
        );

        try
        {
            for(Target targetEntry : targets)
            {
                ItemState state =
                        targetEntry.state;

                RoomTile destination =
                        layout.getTile(
                                state.x,
                                state.y
                        );

                FurnitureMovementError error =
                        room.moveFurniTo(
                                targetEntry.item,
                                destination,
                                state.rotation,
                                actor,
                                true,
                                true
                        );

                if(error != FurnitureMovementError.NONE)
                {
                    rollback(
                            room,
                            expected,
                            affectedTiles
                    );

                    return ApplyResult.failure(
                            42,
                            "Undo/Redo cancelado por el servidor: "
                                    + error.name(),
                            false
                    );
                }

                if(!matches(
                        targetEntry.item,
                        state))
                {
                    rollback(
                            room,
                            expected,
                            affectedTiles
                    );

                    return ApplyResult.failure(
                            43,
                            "El servidor altero la geometria exacta del historial.",
                            false
                    );
                }
            }

            refreshAffectedTiles(
                    room,
                    affectedTiles
            );

            return ApplyResult.success();
        }
        catch(Exception exception)
        {
            rollback(
                    room,
                    expected,
                    affectedTiles
            );

            return ApplyResult.failure(
                    44,
                    "Undo/Redo fue revertido por un error interno.",
                    false
            );
        }
        finally
        {
            BuilderProContext.clear();
        }
    }

    private static boolean isStateOnlyTransition(
            List<ItemState> expected,
            List<ItemState> target)
    {
        if(expected == null
                || target == null
                || expected.size() != target.size()
                || expected.isEmpty())
        {
            return false;
        }

        boolean stateChanged = false;

        for(int index = 0;
                index < expected.size();
                index++)
        {
            ItemState current =
                    expected.get(index);

            ItemState destination =
                    target.get(index);

            if(current.itemId
                    != destination.itemId)
            {
                return false;
            }

            if(current.x != destination.x
                    || current.y != destination.y
                    || Math.abs(
                            current.z -
                            destination.z
                    ) > EPSILON
                    || current.rotation
                    != destination.rotation)
            {
                return false;
            }

            if(!sameExtraData(
                    current.extraData,
                    destination.extraData))
            {
                stateChanged = true;
            }
        }

        return stateChanged;
    }

    private static ApplyResult applyStateOnly(
            Room room,
            List<ItemState> expected,
            List<ItemState> target)
    {
        Map<Integer, ItemState> expectedById =
                new HashMap<Integer, ItemState>();

        for(ItemState state : expected)
        {
            expectedById.put(
                    state.itemId,
                    state
            );
        }

        List<Target> targets =
                new ArrayList<Target>();

        for(ItemState state : target)
        {
            HabboItem item =
                    room.getHabboItem(
                            state.itemId
                    );

            ItemState expectedState =
                    expectedById.get(
                            state.itemId
                    );

            if(item == null
                    || expectedState == null)
            {
                return ApplyResult.failure(
                        80,
                        "Uno de los furnis de estado ya no existe.",
                        true
                );
            }

            if(item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR)
            {
                return ApplyResult.failure(
                        81,
                        "El historial de estado contiene un furni no admitido.",
                        true
                );
            }

            if(item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return ApplyResult.failure(
                        82,
                        "El historial de estado contiene una baldosa de arquitecto.",
                        true
                );
            }

            if(!matches(
                    item,
                    expectedState))
            {
                return ApplyResult.failure(
                        83,
                        "El estado actual ya no coincide con el historial.",
                        true
                );
            }

            targets.add(
                    new Target(
                            item,
                            state
                    )
            );
        }

        targets.sort(
                Comparator.comparingInt(
                        targetEntry ->
                                targetEntry.item.getId()
                )
        );

        try
        {
            for(Target targetEntry : targets)
            {
                HabboItem item =
                        targetEntry.item;

                ItemState state =
                        targetEntry.state;

                item.setExtradata(
                        state.extraData
                );

                item.needsUpdate(
                        true
                );

                item.run();

                refreshState(
                        room,
                        item
                );

                if(!matches(
                        item,
                        state))
                {
                    rollbackStateOnly(
                            room,
                            expected
                    );

                    return ApplyResult.failure(
                            84,
                            "El servidor altero el estado exacto del historial.",
                            false
                    );
                }
            }

            return ApplyResult.success();
        }
        catch(Exception exception)
        {
            rollbackStateOnly(
                    room,
                    expected
            );

            return ApplyResult.failure(
                    85,
                    "Undo/Redo de estado fue revertido por un error interno.",
                    false
            );
        }
    }

    private static void rollbackStateOnly(
            Room room,
            List<ItemState> states)
    {
        for(ItemState state : states)
        {
            HabboItem item =
                    room.getHabboItem(
                            state.itemId
                    );

            if(item == null)
            {
                continue;
            }

            try
            {
                item.setExtradata(
                        state.extraData
                );

                item.needsUpdate(
                        true
                );

                item.run();

                refreshState(
                        room,
                        item
                );
            }
            catch(Exception ignored)
            {
            }
        }
    }

    private static void refreshState(
            Room room,
            HabboItem item)
    {
        if(item instanceof InteractionMultiHeight)
        {
            InteractionMultiHeight multiHeight =
                    (InteractionMultiHeight)item;

            RoomTile anchor =
                    room.getLayout()
                            .getTile(
                                    item.getX(),
                                    item.getY()
                            );

            if(anchor != null)
            {
                room.updateTiles(
                        room.getLayout()
                                .getTilesAt(
                                        anchor,
                                        item.getBaseItem()
                                                .getWidth(),
                                        item.getBaseItem()
                                                .getLength(),
                                        item.getRotation()
                                )
                );

                multiHeight.updateUnitsOnItem(
                        room
                );
            }
        }

        room.updateItemState(
                item
        );
    }

    private static boolean sameExtraData(
            String first,
            String second)
    {
        if(first == null)
        {
            return second == null;
        }

        return first.equals(
                second
        );
    }

    private static boolean matches(
            HabboItem item,
            ItemState state)
    {
        return item != null
                && item.getX() == state.x
                && item.getY() == state.y
                && Math.abs(
                        item.getZ() - state.z
                ) <= EPSILON
                && normalizeRotation(
                        item.getRotation()
                ) == state.rotation
                && sameExtraData(
                        item.getExtradata(),
                        state.extraData
                );
    }

    private static boolean sameIds(
            List<ItemState> first,
            List<ItemState> second)
    {
        if(first.size() != second.size())
        {
            return false;
        }

        for(int index = 0;
                index < first.size();
                index++)
        {
            if(first.get(index).itemId
                    != second.get(index).itemId)
            {
                return false;
            }
        }

        return true;
    }

    private static List<ItemState> copyStates(
            List<ItemState> source)
    {
        List<ItemState> copy =
                new ArrayList<ItemState>(
                        source.size()
                );

        for(ItemState state : source)
        {
            copy.add(
                    new ItemState(state)
            );
        }

        return copy;
    }

    private static void rollback(
            Room room,
            List<ItemState> states,
            THashSet<RoomTile> affectedTiles)
    {
        for(ItemState state : states)
        {
            HabboItem item =
                    room.getHabboItem(
                            state.itemId
                    );

            if(item == null)
            {
                continue;
            }

            item.setX(state.x);
            item.setY(state.y);
            item.setZ(state.z);
            item.setRotation(
                    state.rotation
            );

            item.needsUpdate(true);
            item.run();

            room.sendComposer(
                    new FloorItemUpdateComposer(
                            item
                    ).compose()
            );
        }

        refreshAffectedTiles(
                room,
                affectedTiles
        );
    }

    private static void addFootprint(
            RoomLayout layout,
            short x,
            short y,
            HabboItem item,
            int rotation,
            THashSet<RoomTile> output)
    {
        Rectangle rectangle =
                RoomLayout.getRectangle(
                        x,
                        y,
                        item.getBaseItem().getWidth(),
                        item.getBaseItem().getLength(),
                        rotation
                );

        for(int px = rectangle.x;
                px < rectangle.x + rectangle.width;
                px++)
        {
            for(int py = rectangle.y;
                    py < rectangle.y + rectangle.height;
                    py++)
            {
                RoomTile tile =
                        layout.getTile(
                                (short)px,
                                (short)py
                        );

                if(tile != null)
                {
                    output.add(tile);
                }
            }
        }
    }

    private static void refreshAffectedTiles(
            Room room,
            THashSet<RoomTile> affectedTiles)
    {
        if(affectedTiles == null
                || affectedTiles.isEmpty())
        {
            return;
        }

        room.updateTiles(
                affectedTiles
        );

        for(RoomTile tile : affectedTiles)
        {
            room.updateHabbosAt(
                    tile.x,
                    tile.y
            );

            room.updateBotsAt(
                    tile.x,
                    tile.y
            );

            room.updatePetsAt(
                    tile.x,
                    tile.y
            );
        }
    }

    private static boolean verticalRangesOverlap(
            double firstBottom,
            double firstTop,
            double secondBottom,
            double secondTop)
    {
        return firstBottom
                        < secondTop - EPSILON
                && firstTop
                        > secondBottom + EPSILON;
    }

    private static int normalizeRotation(
            int rotation)
    {
        int normalized =
                rotation % 8;

        if(normalized < 0)
        {
            normalized += 8;
        }

        return normalized;
    }

    private static String key(
            Habbo actor,
            Room room)
    {
        return actor.getHabboInfo().getId()
                + ":"
                + room.getId();
    }

    public static final class ItemState
    {
        public final int itemId;
        public final short x;
        public final short y;
        public final double z;
        public final int rotation;
        public final String extraData;

        private ItemState(
                HabboItem item)
        {
            this.itemId = item.getId();
            this.x = item.getX();
            this.y = item.getY();
            this.z = item.getZ();
            this.extraData =
                    item.getExtradata();
            this.rotation =
                    normalizeRotation(
                            item.getRotation()
                    );
        }

        private ItemState(
                ItemState other)
        {
            this.itemId = other.itemId;
            this.x = other.x;
            this.y = other.y;
            this.z = other.z;
            this.rotation = other.rotation;
            this.extraData = other.extraData;
        }
    }

    private static final class Target
    {
        private final HabboItem item;
        private final ItemState state;

        private Target(
                HabboItem item,
                ItemState state)
        {
            this.item = item;
            this.state = state;
        }
    }

    private static final class PickupMetadata
    {
        private final List<GroupSnapshot> groups;
        private final List<Integer> traversableIds;
        private final Map<Integer, Integer> layerMemberships;

        private PickupMetadata(
                List<GroupSnapshot> groups,
                List<Integer> traversableIds,
                Map<Integer, Integer> layerMemberships)
        {
            this.groups = groups;
            this.traversableIds =
                    new ArrayList<Integer>(
                            traversableIds
                    );
            this.layerMemberships =
                    new HashMap<Integer, Integer>(
                            layerMemberships
                    );
        }
    }

    private static final class GroupSnapshot
    {
        private int groupId;
        private final String name;
        private final boolean locked;
        private final int createdBy;
        private final List<Integer> itemIds;

        private GroupSnapshot(
                BuilderProGroupRepository.SavedGroup group)
        {
            this.groupId = group.id;
            this.name = group.name;
            this.locked = group.locked;
            this.createdBy = group.createdBy;
            this.itemIds =
                    new ArrayList<Integer>(
                            group.itemIds
                    );
        }
    }

    private static final class Entry
    {
        private final int roomId;
        private final List<ItemState> before;
        private final List<ItemState> after;
        private final String label;
        private final PickupMetadata pickupMetadata;
        private final ReplaceGroupService.ReplacementRecord replacementRecord;

        private Entry(
                int roomId,
                List<ItemState> before,
                List<ItemState> after,
                String label)
        {
            this(
                    roomId,
                    before,
                    after,
                    label,
                    null,
                    null
            );
        }

        private Entry(
                int roomId,
                List<ItemState> before,
                List<ItemState> after,
                String label,
                PickupMetadata pickupMetadata)
        {
            this(
                    roomId,
                    before,
                    after,
                    label,
                    pickupMetadata,
                    null
            );
        }

        private Entry(
                int roomId,
                List<ItemState> before,
                List<ItemState> after,
                String label,
                PickupMetadata pickupMetadata,
                ReplaceGroupService.ReplacementRecord replacementRecord)
        {
            this.roomId = roomId;
            this.before = before;
            this.after = after;
            this.label = label;
            this.pickupMetadata =
                    pickupMetadata;
            this.replacementRecord =
                    replacementRecord;
        }
    }

    private static final class History
    {
        private final Deque<Entry> undo =
                new ArrayDeque<Entry>();

        private final Deque<Entry> redo =
                new ArrayDeque<Entry>();
    }

    private static final class ApplyResult
    {
        private final boolean success;
        private final int code;
        private final String message;
        private final boolean invalidateHistory;

        private ApplyResult(
                boolean success,
                int code,
                String message,
                boolean invalidateHistory)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.invalidateHistory = invalidateHistory;
        }

        private static ApplyResult success()
        {
            return new ApplyResult(
                    true,
                    0,
                    "",
                    false
            );
        }

        private static ApplyResult failure(
                int code,
                String message,
                boolean invalidateHistory)
        {
            return new ApplyResult(
                    false,
                    code,
                    message,
                    invalidateHistory
            );
        }
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final int affectedCount;
        public final boolean canUndo;
        public final boolean canRedo;

        private Result(
                boolean success,
                int code,
                String message,
                int affectedCount,
                boolean canUndo,
                boolean canRedo)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.affectedCount = affectedCount;
            this.canUndo = canUndo;
            this.canRedo = canRedo;
        }

        public static Result success(
                int affectedCount,
                String message,
                boolean canUndo,
                boolean canRedo)
        {
            return new Result(
                    true,
                    0,
                    message,
                    affectedCount,
                    canUndo,
                    canRedo
            );
        }

        public static Result failure(
                int code,
                String message,
                boolean canUndo,
                boolean canRedo)
        {
            return new Result(
                    false,
                    code,
                    message,
                    0,
                    canUndo,
                    canRedo
            );
        }
    }
}
