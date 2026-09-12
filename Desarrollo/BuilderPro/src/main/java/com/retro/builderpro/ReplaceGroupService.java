package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.*;
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
import com.eu.habbo.messages.outgoing.rooms.items.RemoveFloorItemComposer;
import com.eu.habbo.messages.outgoing.rooms.items.RoomFloorItemsComposer;
import gnu.trove.map.TIntObjectMap;
import gnu.trove.set.hash.THashSet;

import java.awt.Rectangle;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class ReplaceGroupService
{
    public static final int OP_PREVIEW = 0;
    public static final int OP_EXECUTE = 1;
    public static final int MAX_GROUP_SIZE = GroupMoveService.MAX_GROUP_SIZE;

    private static final double EPSILON = 0.000001D;

    private ReplaceGroupService()
    {
    }

    public static Result preview(
            Habbo actor,
            List<Integer> requestedIds,
            int referenceId,
            List<Integer> targetRotations)
    {
        Prepared prepared =
                prepare(
                        actor,
                        requestedIds,
                        referenceId,
                        targetRotations
                );

        if(!prepared.success)
        {
            return prepared.toFailureResult();
        }

        return Result.success(
                "Reemplazo preparado.",
                prepared.needed,
                prepared.available,
                prepared.referenceId,
                prepared.referenceBaseItemId,
                prepared.referenceName,
                0,
                Collections.<Integer>emptyList()
        );
    }

    public static Result execute(
            Habbo actor,
            List<Integer> requestedIds,
            int referenceId,
            List<Integer> targetRotations)
    {
        Prepared prepared =
                prepare(
                        actor,
                        requestedIds,
                        referenceId,
                        targetRotations
                );

        if(!prepared.success)
        {
            return prepared.toFailureResult();
        }

        SwapResult swap =
                performSwap(
                        actor,
                        prepared.record,
                        true
                );

        if(!swap.success)
        {
            return Result.failure(
                    swap.code,
                    swap.message,
                    prepared.needed,
                    prepared.available,
                    prepared.referenceId,
                    prepared.referenceBaseItemId,
                    prepared.referenceName
            );
        }

        if(!BuilderProHistoryService.recordReplacement(
                actor,
                prepared.record))
        {
            SwapResult rollback =
                    performSwap(
                            actor,
                            prepared.record,
                            false
                    );

            BuilderProHistoryService.invalidate(
                    actor
            );

            if(!rollback.success)
            {
                return Result.failure(
                        98,
                        "El reemplazo se completo, pero no pudo registrarse ni revertirse con seguridad.",
                        prepared.needed,
                        prepared.available,
                        prepared.referenceId,
                        prepared.referenceBaseItemId,
                        prepared.referenceName
                );
            }

            return Result.failure(
                    97,
                    "El reemplazo fue revertido porque no pudo registrarse en el historial.",
                    prepared.needed,
                    prepared.available,
                    prepared.referenceId,
                    prepared.referenceBaseItemId,
                    prepared.referenceName
            );
        }

        return Result.success(
                "Reemplazados "
                        + prepared.record.size()
                        + " furnis por "
                        + prepared.referenceName
                        + ".",
                prepared.needed,
                prepared.available,
                prepared.referenceId,
                prepared.referenceBaseItemId,
                prepared.referenceName,
                prepared.record.size(),
                prepared.record.replacementIds()
        );
    }

    public static HistoryApplyResult applyHistory(
            Habbo actor,
            ReplacementRecord record,
            boolean undo)
    {
        if(actor == null
                || record == null)
        {
            return HistoryApplyResult.failure(
                    1,
                    "Entrada de reemplazo invalida.",
                    true
            );
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null
                || room.getId() != record.roomId)
        {
            return HistoryApplyResult.failure(
                    2,
                    "El reemplazo ya no pertenece a esta sala.",
                    true
            );
        }

        SwapResult result =
                performSwap(
                        actor,
                        record,
                        !undo
                );

        if(!result.success)
        {
            return HistoryApplyResult.failure(
                    result.code,
                    result.message,
                    result.invalidateHistory
            );
        }

        return HistoryApplyResult.success(
                record.size(),
                undo
                        ? "Deshecho: Reemplazo."
                        : "Rehecho: Reemplazo."
        );
    }

    private static Prepared prepare(
            Habbo actor,
            List<Integer> requestedIds,
            int referenceId,
            List<Integer> targetRotations)
    {
        if(actor == null)
        {
            return Prepared.failure(
                    1,
                    "Usuario no disponible."
            );
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return Prepared.failure(
                    2,
                    "No hay una sala activa."
            );
        }

        if(!room.hasRights(actor))
        {
            return Prepared.failure(
                    3,
                    "No tienes permisos de construccion en esta sala."
            );
        }

        if(requestedIds == null
                || requestedIds.isEmpty()
                || requestedIds.size() > MAX_GROUP_SIZE)
        {
            return Prepared.failure(
                    4,
                    "Seleccion invalida."
            );
        }

        LinkedHashSet<Integer> unique =
                new LinkedHashSet<Integer>(
                        requestedIds
                );

        if(unique.size() != requestedIds.size())
        {
            return Prepared.failure(
                    5,
                    "La seleccion contiene IDs repetidos."
            );
        }

        if(unique.contains(
                Integer.valueOf(referenceId)))
        {
            return Prepared.failure(
                    6,
                    "El furni de referencia debe estar fuera de la seleccion."
            );
        }

        if(targetRotations == null
                || targetRotations.size()
                != requestedIds.size())
        {
            return Prepared.failure(
                    7,
                    "Faltan orientaciones compatibles."
            );
        }

        HabboItem reference =
                room.getHabboItem(
                        referenceId
                );

        if(reference == null
                || !isSafeReplaceItem(
                        reference))
        {
            return Prepared.failure(
                    8,
                    "Ese furni no puede usarse como referencia de reemplazo."
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        int referenceBaseItemId =
                reference.getBaseItem()
                        .getId();

        String referenceName =
                safeName(
                        reference.getBaseItem()
                                .getName(),
                        referenceBaseItemId
                );

        List<HabboItem> originals =
                new ArrayList<HabboItem>();

        boolean allSameType = true;

        for(Integer id : requestedIds)
        {
            HabboItem item =
                    room.getHabboItem(
                            id.intValue()
                    );

            if(item == null)
            {
                return Prepared.failureWithReference(
                        9,
                        "Uno de los furnis seleccionados ya no existe.",
                        requestedIds.size(),
                        0,
                        referenceId,
                        referenceBaseItemId,
                        referenceName
                );
            }

            if(item.getUserId() != actorId)
            {
                return Prepared.failureWithReference(
                        10,
                        "El reemplazo solo admite furnis de tu propiedad.",
                        requestedIds.size(),
                        0,
                        referenceId,
                        referenceBaseItemId,
                        referenceName
                );
            }

            if(!isSafeReplaceItem(item))
            {
                return Prepared.failureWithReference(
                        11,
                        "La seleccion contiene un furni especial no admitido.",
                        requestedIds.size(),
                        0,
                        referenceId,
                        referenceBaseItemId,
                        referenceName
                );
            }

            if(item.getBaseItem().getId()
                    != referenceBaseItemId)
            {
                allSameType = false;
            }

            originals.add(item);
        }

        List<HabboItem> available =
                availableInventoryItems(
                        actor,
                        referenceBaseItemId
                );

        if(allSameType)
        {
            return Prepared.failureWithReference(
                    12,
                    "La seleccion ya es de ese tipo.",
                    requestedIds.size(),
                    available.size(),
                    referenceId,
                    referenceBaseItemId,
                    referenceName
            );
        }

        int needed =
                originals.size();

        if(available.size() < needed)
        {
            return Prepared.failureWithReference(
                    13,
                    "No tienes suficientes unidades en el inventario.",
                    needed,
                    available.size(),
                    referenceId,
                    referenceBaseItemId,
                    referenceName
            );
        }

        Map<Integer, Integer> layerMemberships;
        Map<Integer, Integer> groupMemberships;
        Set<Integer> traversableIds;

        try
        {
            layerMemberships =
                    BuilderProLayerRepository.memberships(
                            requestedIds
                    );

            groupMemberships =
                    BuilderProGroupRepository.memberships(
                            requestedIds
                    );

            traversableIds =
                    new HashSet<Integer>(
                            BuilderProTraversalRepository.list(
                                    room.getId()
                            )
                    );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return Prepared.failureWithReference(
                    14,
                    "No se pudo leer la metadata de la seleccion.",
                    needed,
                    available.size(),
                    referenceId,
                    referenceBaseItemId,
                    referenceName
            );
        }

        List<SwapItem> items =
                new ArrayList<SwapItem>();

        Map<Integer, Integer> oldToNew =
                new HashMap<Integer, Integer>();

        for(int index = 0;
                index < originals.size();
                index++)
        {
            HabboItem original =
                    originals.get(index);

            HabboItem replacement =
                    available.get(index);

            int layerId =
                    layerMemberships.containsKey(
                            original.getId()
                    )
                            ? layerMemberships.get(
                                    original.getId()
                            ).intValue()
                            : 0;

            int groupId =
                    groupMemberships.containsKey(
                            original.getId()
                    )
                            ? groupMemberships.get(
                                    original.getId()
                            ).intValue()
                            : 0;

            SwapItem swap =
                    new SwapItem(
                            original.getId(),
                            replacement.getId(),
                            original.getX(),
                            original.getY(),
                            original.getZ(),
                            normalizeRotation(
                                    original.getRotation()
                            ),
                            normalizeRotation(
                                    targetRotations.get(index)
                                            .intValue()
                            ),
                            safeExtraData(
                                    original.getExtradata()
                            ),
                            defaultExtraData(
                                    replacement
                            ),
                            original.getBaseItem()
                                    .getId(),
                            replacement.getBaseItem()
                                    .getId(),
                            layerId,
                            groupId,
                            traversableIds.contains(
                                    original.getId()
                            )
                    );

            items.add(swap);

            oldToNew.put(
                    original.getId(),
                    replacement.getId()
            );
        }

        List<GroupSwap> groupSwaps =
                new ArrayList<GroupSwap>();

        Set<Integer> seenGroups =
                new HashSet<Integer>();

        try
        {
            for(SwapItem item : items)
            {
                if(item.groupId <= 0
                        || !seenGroups.add(
                                item.groupId))
                {
                    continue;
                }

                BuilderProGroupRepository.SavedGroup group =
                        BuilderProGroupRepository.find(
                                room.getId(),
                                item.groupId
                        );

                if(group == null)
                {
                    return Prepared.failureWithReference(
                            15,
                            "Uno de los grupos ya no existe.",
                            needed,
                            available.size(),
                            referenceId,
                            referenceBaseItemId,
                            referenceName
                    );
                }

                List<Integer> beforeMembers =
                        new ArrayList<Integer>(
                                group.itemIds
                        );

                List<Integer> afterMembers =
                        new ArrayList<Integer>();

                for(Integer memberId :
                        beforeMembers)
                {
                    Integer replacementId =
                            oldToNew.get(
                                    memberId
                            );

                    afterMembers.add(
                            replacementId == null
                                    ? memberId
                                    : replacementId
                    );
                }

                groupSwaps.add(
                        new GroupSwap(
                                item.groupId,
                                beforeMembers,
                                afterMembers
                        )
                );
            }
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return Prepared.failureWithReference(
                    16,
                    "No se pudo preparar la metadata de grupos.",
                    needed,
                    available.size(),
                    referenceId,
                    referenceBaseItemId,
                    referenceName
            );
        }

        ReplacementRecord record =
                new ReplacementRecord(
                        room.getId(),
                        items,
                        groupSwaps
                );

        SwapResult validation =
                validateSwap(
                        actor,
                        record,
                        true
                );

        if(!validation.success)
        {
            return Prepared.failureWithReference(
                    validation.code,
                    validation.message,
                    needed,
                    available.size(),
                    referenceId,
                    referenceBaseItemId,
                    referenceName
            );
        }

        return Prepared.success(
                needed,
                available.size(),
                referenceId,
                referenceBaseItemId,
                referenceName,
                record
        );
    }

    private static List<HabboItem> availableInventoryItems(
            Habbo actor,
            int baseItemId)
    {
        List<HabboItem> result =
                new ArrayList<HabboItem>();

        if(actor == null)
        {
            return result;
        }

        for(HabboItem item :
                actor.getInventory()
                        .getItemsComponent()
                        .getItemsAsValueCollection())
        {
            if(item == null
                    || item.getBaseItem() == null
                    || item.getRoomId() != 0
                    || item.getUserId()
                    != actor.getHabboInfo().getId()
                    || item.getBaseItem().getId()
                    != baseItemId
                    || !isSafeReplaceItem(item))
            {
                continue;
            }

            result.add(item);
        }

        result.sort(
                Comparator.comparingInt(
                        HabboItem::getId
                )
        );

        return result;
    }

    private static boolean isSafeReplaceItem(
            HabboItem item)
    {
        if(item == null
                || item.getBaseItem() == null
                || item.getBaseItem().getType()
                != FurnitureType.FLOOR)
        {
            return false;
        }

        return !(item instanceof InteractionStackHelper)
                && !(item instanceof InteractionTileWalkMagic)
                && !(item instanceof InteractionWired)
                && !(item instanceof InteractionWiredHighscore)
                && !(item instanceof InteractionTeleport)
                && !(item instanceof InteractionJukeBox)
                && !(item instanceof InteractionMoodLight)
                && !(item instanceof InteractionRentableSpace)
                && !(item instanceof InteractionMusicDisc)
                && !(item instanceof InteractionClothing)
                && !(item instanceof InteractionCrackable);
    }

    private static String defaultExtraData(
            HabboItem item)
    {
        if(item == null
                || item.getBaseItem() == null)
        {
            return "";
        }

        if(item instanceof InteractionMultiHeight
                || item.getBaseItem()
                        .getStateCount() > 1)
        {
            return "0";
        }

        return safeExtraData(
                item.getExtradata()
        );
    }

    private static SwapResult validateSwap(
            Habbo actor,
            ReplacementRecord record,
            boolean forward)
    {
        if(actor == null
                || record == null)
        {
            return SwapResult.failure(
                    20,
                    "Intercambio invalido.",
                    true
            );
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null
                || room.getId() != record.roomId)
        {
            return SwapResult.failure(
                    21,
                    "El reemplazo ya no pertenece a esta sala.",
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

        List<TargetPlan> targets =
                new ArrayList<TargetPlan>();

        Set<Integer> sourceIds =
                new HashSet<Integer>();

        synchronized(inventoryMap)
        {
            for(SwapItem swap :
                    record.items)
            {
                int sourceId =
                        forward
                                ? swap.originalId
                                : swap.replacementId;

                int targetId =
                        forward
                                ? swap.replacementId
                                : swap.originalId;

                HabboItem source =
                        room.getHabboItem(
                                sourceId
                        );

                HabboItem target =
                        inventoryMap.get(
                                targetId
                        );

                if(source == null
                        || source.getRoomId()
                        != room.getId()
                        || target == null
                        || target.getRoomId() != 0)
                {
                    return SwapResult.failure(
                            22,
                            "Los furnis ya no estan donde esperaba el historial.",
                            true
                    );
                }

                if(source.getUserId() != actorId
                        || target.getUserId() != actorId
                        || !isSafeReplaceItem(source)
                        || !isSafeReplaceItem(target))
                {
                    return SwapResult.failure(
                            23,
                            "Uno de los furnis ya no es valido para reemplazo.",
                            true
                    );
                }

                if(!matchesSource(
                        source,
                        swap,
                        forward))
                {
                    return SwapResult.failure(
                            24,
                            "Uno de los furnis fue modificado despues del reemplazo.",
                            true
                    );
                }

                sourceIds.add(
                        sourceId
                );

                targets.add(
                        new TargetPlan(
                                swap,
                                source,
                                target,
                                forward
                        )
                );
            }
        }

        SwapResult metadata =
                validateMetadataSource(
                        room,
                        record,
                        forward
                );

        if(!metadata.success)
        {
            return metadata;
        }

        Map<Integer, String> extraBefore =
                new HashMap<Integer, String>();

        try
        {
            for(TargetPlan target :
                    targets)
            {
                extraBefore.put(
                        target.target.getId(),
                        safeExtraData(
                                target.target.getExtradata()
                        )
                );

                target.target.setExtradata(
                        target.targetExtraData
                );
            }

            return validateTargets(
                    room,
                    targets,
                    sourceIds
            );
        }
        finally
        {
            for(TargetPlan target :
                    targets)
            {
                String extra =
                        extraBefore.get(
                                target.target.getId()
                        );

                if(extra != null)
                {
                    target.target.setExtradata(
                            extra
                    );
                }
            }
        }
    }

    private static SwapResult performSwap(
            Habbo actor,
            ReplacementRecord record,
            boolean forward)
    {
        SwapResult validation =
                validateSwap(
                        actor,
                        record,
                        forward
                );

        if(!validation.success)
        {
            return validation;
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        int actorId =
                actor.getHabboInfo()
                        .getId();

        TIntObjectMap<HabboItem> inventoryMap =
                actor.getInventory()
                        .getItemsComponent()
                        .getItems();

        List<TargetPlan> plans =
                new ArrayList<TargetPlan>();

        Map<Integer, String> inventoryExtraBefore =
                new HashMap<Integer, String>();

        synchronized(inventoryMap)
        {
            for(SwapItem swap :
                    record.items)
            {
                int sourceId =
                        forward
                                ? swap.originalId
                                : swap.replacementId;

                int targetId =
                        forward
                                ? swap.replacementId
                                : swap.originalId;

                HabboItem source =
                        room.getHabboItem(
                                sourceId
                        );

                HabboItem target =
                        inventoryMap.get(
                                targetId
                        );

                if(source == null
                        || target == null)
                {
                    return SwapResult.failure(
                            25,
                            "El estado cambio antes de ejecutar el reemplazo.",
                            true
                    );
                }

                inventoryExtraBefore.put(
                        targetId,
                        safeExtraData(
                                target.getExtradata()
                        )
                );

                plans.add(
                        new TargetPlan(
                                swap,
                                source,
                                target,
                                forward
                        )
                );
            }
        }

        List<HabboItem> removedSources =
                new ArrayList<HabboItem>();

        List<HabboItem> placedTargets =
                new ArrayList<HabboItem>();

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        boolean groupsChanged = false;
        boolean layersChanged = false;
        boolean sourceTraversalDisabled = false;
        boolean targetTraversalEnabled = false;
        boolean inventoryCommitted = false;

        List<Integer> sourceTraversal =
                traversalIds(
                        record,
                        forward,
                        true
                );

        List<Integer> targetTraversal =
                traversalIds(
                        record,
                        forward,
                        false
                );

        try
        {
            if(!sourceTraversal.isEmpty())
            {
                BuilderProTraversalService.Result traversal =
                        BuilderProTraversalService.execute(
                                actor,
                                BuilderProTraversalService.OP_SET,
                                false,
                                sourceTraversal
                        );

                if(!traversal.success)
                {
                    return SwapResult.failure(
                            26,
                            "No se pudo preparar Atravesable para el reemplazo.",
                            false
                    );
                }

                sourceTraversalDisabled = true;
            }

            for(TargetPlan plan : plans)
            {
                addFootprint(
                        room.getLayout(),
                        plan.source.getX(),
                        plan.source.getY(),
                        plan.source,
                        plan.source.getRotation(),
                        affectedTiles
                );

                room.removeHabboItem(
                        plan.source
                );

                removedSources.add(
                        plan.source
                );

                plan.source.onPickUp(
                        room
                );

                plan.source.setRoomId(
                        0
                );

                room.sendComposer(
                        new RemoveFloorItemComposer(
                                plan.source
                        ).compose()
                );

                if(room.getHabboItem(
                        plan.source.getId()
                ) != null)
                {
                    throw new IllegalStateException(
                            "No se pudo retirar un furni original."
                    );
                }
            }

            Map<Integer, Double> forcedHeights =
                    new HashMap<Integer, Double>();

            for(TargetPlan plan : plans)
            {
                plan.target.setExtradata(
                        plan.targetExtraData
                );

                forcedHeights.put(
                        plan.target.getId(),
                        plan.targetZ
                );
            }

            BuilderProContext.begin(
                    actorId,
                    forcedHeights
            );

            try
            {
                for(TargetPlan plan : plans)
                {
                    RoomTile tile =
                            room.getLayout()
                                    .getTile(
                                            plan.targetX,
                                            plan.targetY
                                    );

                    FurnitureMovementError error =
                            room.placeFloorFurniAt(
                                    plan.target,
                                    tile,
                                    plan.targetRotation,
                                    actor
                            );

                    if(error != FurnitureMovementError.NONE)
                    {
                        throw new IllegalStateException(
                                "Colocacion rechazada: "
                                        + error.name()
                        );
                    }

                    placedTargets.add(
                            plan.target
                    );

                    if(plan.target.getRoomId()
                            != room.getId()
                            || plan.target.getX()
                            != plan.targetX
                            || plan.target.getY()
                            != plan.targetY
                            || Math.abs(
                                    plan.target.getZ()
                                            - plan.targetZ
                            ) > EPSILON
                            || normalizeRotation(
                                    plan.target.getRotation()
                            ) != plan.targetRotation)
                    {
                        throw new IllegalStateException(
                                "El servidor altero la geometria del reemplazo."
                        );
                    }

                    addFootprint(
                            room.getLayout(),
                            plan.targetX,
                            plan.targetY,
                            plan.target,
                            plan.targetRotation,
                            affectedTiles
                    );
                }
            }
            finally
            {
                BuilderProContext.clear();
            }

            applyGroups(
                    room,
                    record,
                    forward
            );

            groupsChanged = true;

            applyLayers(
                    room,
                    record,
                    forward
            );

            layersChanged = true;

            if(!targetTraversal.isEmpty())
            {
                BuilderProTraversalService.Result traversal =
                        BuilderProTraversalService.execute(
                                actor,
                                BuilderProTraversalService.OP_SET,
                                true,
                                targetTraversal
                        );

                if(!traversal.success)
                {
                    throw new IllegalStateException(
                            "No se pudo restaurar Atravesable en los sustitutos."
                    );
                }

                targetTraversalEnabled = true;
            }

            for(TargetPlan plan : plans)
            {
                plan.source.setExtradata(
                        plan.sourceExtraData
                );

                plan.source.needsUpdate(
                        true
                );

                plan.source.run();

                plan.target.setExtradata(
                        plan.targetExtraData
                );

                plan.target.needsUpdate(
                        true
                );

                plan.target.run();
            }

            synchronized(inventoryMap)
            {
                for(TargetPlan plan : plans)
                {
                    if(inventoryMap.get(
                            plan.target.getId()
                    ) != plan.target
                            || inventoryMap.get(
                                    plan.source.getId()
                            ) != null)
                    {
                        throw new IllegalStateException(
                                "El inventario cambio durante el reemplazo."
                        );
                    }
                }

                for(TargetPlan plan : plans)
                {
                    inventoryMap.remove(
                            plan.target.getId()
                    );

                    inventoryMap.put(
                            plan.source.getId(),
                            plan.source
                    );
                }
            }

            inventoryCommitted = true;

            try
            {
                refreshAffectedTiles(
                        room,
                        affectedTiles
                );

                notifyInventorySwap(
                        actor,
                        plans
                );

                sendAuthoritativeRoomBatch(
                        actor,
                        room,
                        plans
                );

                BuilderProTraversalService.refreshRoomCollision(
                        room
                );
            }
            catch(Exception postCommitError)
            {
                postCommitError.printStackTrace();
            }

            return SwapResult.success(
                    record.size()
            );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            if(inventoryCommitted)
            {
                return SwapResult.success(
                        record.size()
                );
            }

            try
            {
                if(targetTraversalEnabled
                        && !targetTraversal.isEmpty())
                {
                    BuilderProTraversalService.execute(
                            actor,
                            BuilderProTraversalService.OP_SET,
                            false,
                            targetTraversal
                    );
                }

                if(layersChanged)
                {
                    applyLayers(
                            room,
                            record,
                            !forward
                    );
                }

                if(groupsChanged)
                {
                    applyGroups(
                            room,
                            record,
                            !forward
                    );
                }

                rollbackRoomSwap(
                        actor,
                        room,
                        plans,
                        placedTargets,
                        removedSources,
                        inventoryExtraBefore,
                        affectedTiles
                );

                if(sourceTraversalDisabled
                        && !sourceTraversal.isEmpty())
                {
                    BuilderProTraversalService.execute(
                            actor,
                            BuilderProTraversalService.OP_SET,
                            true,
                            sourceTraversal
                    );
                }

                BuilderProTraversalService.refreshRoomCollision(
                        room
                );
            }
            catch(Exception rollbackError)
            {
                rollbackError.printStackTrace();

                return SwapResult.failure(
                        99,
                        "El reemplazo fallo y el rollback no pudo completarse.",
                        true
                );
            }

            return SwapResult.failure(
                    27,
                    "Reemplazo cancelado y revertido: "
                            + exception.getMessage(),
                    false
            );
        }
    }

    private static void rollbackRoomSwap(
            Habbo actor,
            Room room,
            List<TargetPlan> plans,
            List<HabboItem> placedTargets,
            List<HabboItem> removedSources,
            Map<Integer, String> inventoryExtraBefore,
            THashSet<RoomTile> affectedTiles)
            throws Exception
    {
        for(int index = placedTargets.size() - 1;
                index >= 0;
                index--)
        {
            HabboItem item =
                    placedTargets.get(index);

            if(room.getHabboItem(
                    item.getId()
            ) != null)
            {
                room.removeHabboItem(
                        item
                );

                item.onPickUp(
                        room
                );

                item.setRoomId(
                        0
                );

                room.sendComposer(
                        new RemoveFloorItemComposer(
                                item
                        ).compose()
                );
            }

            String previousExtra =
                    inventoryExtraBefore.get(
                            item.getId()
                    );

            if(previousExtra != null)
            {
                item.setExtradata(
                        previousExtra
                );
            }

            item.needsUpdate(
                    true
            );

            item.run();
        }

        Map<Integer, Double> forced =
                new HashMap<Integer, Double>();

        for(TargetPlan plan : plans)
        {
            forced.put(
                    plan.source.getId(),
                    plan.sourceZ
            );

            plan.source.setExtradata(
                    plan.sourceExtraData
            );
        }

        BuilderProContext.begin(
                actor.getHabboInfo()
                        .getId(),
                forced
        );

        try
        {
            for(TargetPlan plan : plans)
            {
                if(!removedSources.contains(
                        plan.source))
                {
                    continue;
                }

                RoomTile tile =
                        room.getLayout()
                                .getTile(
                                        plan.sourceX,
                                        plan.sourceY
                                );

                FurnitureMovementError error =
                        room.placeFloorFurniAt(
                                plan.source,
                                tile,
                                plan.sourceRotation,
                                actor
                        );

                if(error != FurnitureMovementError.NONE)
                {
                    throw new IllegalStateException(
                            "Rollback rechazado: "
                                    + error.name()
                    );
                }

                plan.source.setExtradata(
                        plan.sourceExtraData
                );

                plan.source.needsUpdate(
                        true
                );

                plan.source.run();
            }
        }
        finally
        {
            BuilderProContext.clear();
        }

        refreshAffectedTiles(
                room,
                affectedTiles
        );
    }

    private static SwapResult validateMetadataSource(
            Room room,
            ReplacementRecord record,
            boolean forward)
    {
        try
        {
            for(GroupSwap groupSwap :
                    record.groups)
            {
                BuilderProGroupRepository.SavedGroup group =
                        BuilderProGroupRepository.find(
                                room.getId(),
                                groupSwap.groupId
                        );

                if(group == null)
                {
                    return SwapResult.failure(
                            28,
                            "Uno de los grupos del reemplazo ya no existe.",
                            true
                    );
                }

                List<Integer> expected =
                        forward
                                ? groupSwap.beforeMembers
                                : groupSwap.afterMembers;

                if(!sameMembers(
                        group.itemIds,
                        expected))
                {
                    return SwapResult.failure(
                            29,
                            "Un grupo fue modificado despues del reemplazo.",
                            true
                    );
                }
            }

            List<Integer> sourceIds =
                    sourceIds(
                            record,
                            forward
                    );

            Map<Integer, Integer> layers =
                    BuilderProLayerRepository.memberships(
                            sourceIds
                    );

            Set<Integer> traversable =
                    new HashSet<Integer>(
                            BuilderProTraversalRepository.list(
                                    room.getId()
                            )
                    );

            for(SwapItem item :
                    record.items)
            {
                int sourceId =
                        forward
                                ? item.originalId
                                : item.replacementId;

                int actualLayer =
                        layers.containsKey(
                                sourceId
                        )
                                ? layers.get(
                                        sourceId
                                ).intValue()
                                : 0;

                if(actualLayer != item.layerId)
                {
                    return SwapResult.failure(
                            30,
                            "La capa de un furni cambio despues del reemplazo.",
                            true
                    );
                }

                if(traversable.contains(
                        sourceId
                ) != item.traversable)
                {
                    return SwapResult.failure(
                            31,
                            "Atravesable cambio despues del reemplazo.",
                            true
                    );
                }
            }

            return SwapResult.success(
                    record.size()
            );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return SwapResult.failure(
                    32,
                    "No se pudo validar la metadata del reemplazo.",
                    true
            );
        }
    }

    private static SwapResult validateTargets(
            Room room,
            List<TargetPlan> targets,
            Set<Integer> ignoredRoomIds)
    {
        RoomLayout layout =
                room.getLayout();

        List<TargetVolume> volumes =
                new ArrayList<TargetVolume>();

        for(TargetPlan target :
                targets)
        {
            HabboItem item =
                    target.target;

            if(target.targetZ
                    > Room.MAXIMUM_FURNI_HEIGHT
                    || target.targetZ < -9999.0D)
            {
                return SwapResult.failure(
                        33,
                        "Una altura destino queda fuera del rango admitido.",
                        false
                );
            }

            Rectangle sourceRectangle =
                    RoomLayout.getRectangle(
                            target.sourceX,
                            target.sourceY,
                            target.source.getBaseItem()
                                    .getWidth(),
                            target.source.getBaseItem()
                                    .getLength(),
                            target.sourceRotation
                    );

            Rectangle targetRectangle =
                    RoomLayout.getRectangle(
                            target.targetX,
                            target.targetY,
                            item.getBaseItem()
                                    .getWidth(),
                            item.getBaseItem()
                                    .getLength(),
                            target.targetRotation
                    );

            if(!sourceRectangle.equals(
                    targetRectangle))
            {
                return SwapResult.failure(
                        41,
                        "La huella del furni sustituto no coincide exactamente con la del original.",
                        false
                );
            }

            RoomTile anchor =
                    layout.getTile(
                            target.targetX,
                            target.targetY
                    );

            if(anchor == null
                    || !layout.fitsOnMap(
                            anchor,
                            item.getBaseItem().getWidth(),
                            item.getBaseItem().getLength(),
                            target.targetRotation))
            {
                return SwapResult.failure(
                        34,
                        "Uno de los furnis nuevos no cabe dentro del mapa.",
                        false
                );
            }

            Rectangle rectangle =
                    targetRectangle;

            double bottom =
                    target.targetZ;

            double top =
                    target.targetZ
                            + Item.getCurrentHeight(
                                    item
                            );

            TargetVolume volume =
                    new TargetVolume(
                            rectangle,
                            bottom,
                            top
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
                        return SwapResult.failure(
                                35,
                                "El reemplazo pisaria tiles invalidos.",
                                false
                        );
                    }

                    if(target.targetZ
                            < layout.getHeightAtSquare(
                                    x,
                                    y
                            ))
                    {
                        return SwapResult.failure(
                                36,
                                "Un furni nuevo quedaria por debajo del suelo.",
                                false
                        );
                    }

                    if(room.hasHabbosAt(x, y)
                            || room.hasBotsAt(x, y)
                            || room.hasPetsAt(x, y))
                    {
                        return SwapResult.failure(
                                37,
                                "Hay una unidad ocupando el volumen destino.",
                                false
                        );
                    }

                    for(HabboItem existing :
                            room.getItemsAt(
                                    tile
                            ))
                    {
                        if(existing == null
                                || ignoredRoomIds.contains(
                                        existing.getId()
                                ))
                        {
                            continue;
                        }

                        if(existing.getBaseItem() == null)
                        {
                            return SwapResult.failure(
                                    38,
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
                                bottom,
                                top,
                                existingBottom,
                                existingTop))
                        {
                            return SwapResult.failure(
                                    39,
                                    "El nuevo furni colisionaria con otro furni.",
                                    false
                            );
                        }
                    }
                }
            }

            for(TargetVolume previous :
                    volumes)
            {
                if(rectangle.intersects(
                        previous.rectangle)
                        && verticalRangesOverlap(
                                bottom,
                                top,
                                previous.bottom,
                                previous.top))
                {
                    return SwapResult.failure(
                            40,
                            "Los furnis nuevos colisionarian entre si.",
                            false
                    );
                }
            }

            volumes.add(
                    volume
            );
        }

        return SwapResult.success(
                targets.size()
        );
    }

    private static void applyGroups(
            Room room,
            ReplacementRecord record,
            boolean forward)
            throws Exception
    {
        List<GroupSwap> applied =
                new ArrayList<GroupSwap>();

        try
        {
            for(GroupSwap group :
                    record.groups)
            {
                List<Integer> target =
                        forward
                                ? group.afterMembers
                                : group.beforeMembers;

                if(!BuilderProGroupRepository.replaceMembers(
                        room.getId(),
                        group.groupId,
                        target))
                {
                    throw new IllegalStateException(
                            "No se pudo actualizar un grupo."
                    );
                }

                applied.add(
                        group
                );
            }
        }
        catch(Exception exception)
        {
            for(int index = applied.size() - 1;
                    index >= 0;
                    index--)
            {
                GroupSwap group =
                        applied.get(index);

                try
                {
                    BuilderProGroupRepository.replaceMembers(
                            room.getId(),
                            group.groupId,
                            forward
                                    ? group.beforeMembers
                                    : group.afterMembers
                    );
                }
                catch(Exception ignored)
                {
                }
            }

            throw exception;
        }
    }

    private static void applyLayers(
            Room room,
            ReplacementRecord record,
            boolean forward)
            throws Exception
    {
        List<Integer> source =
                sourceIds(
                        record,
                        forward
                );

        List<Integer> target =
                targetIds(
                        record,
                        forward
                );

        Map<Integer, List<Integer>> targetByLayer =
                layerAssignments(
                        record,
                        forward
                );

        Map<Integer, List<Integer>> sourceByLayer =
                layerAssignments(
                        record,
                        !forward
                );

        try
        {
            BuilderProLayerRepository.unassignItems(
                    source
            );

            for(Map.Entry<Integer, List<Integer>> entry :
                    targetByLayer.entrySet())
            {
                BuilderProLayerRepository.assignItems(
                        room.getId(),
                        entry.getKey().intValue(),
                        entry.getValue()
                );
            }
        }
        catch(Exception exception)
        {
            try
            {
                BuilderProLayerRepository.unassignItems(
                        target
                );

                for(Map.Entry<Integer, List<Integer>> entry :
                        sourceByLayer.entrySet())
                {
                    BuilderProLayerRepository.assignItems(
                            room.getId(),
                            entry.getKey().intValue(),
                            entry.getValue()
                    );
                }
            }
            catch(Exception ignored)
            {
            }

            throw exception;
        }
    }

    private static Map<Integer, List<Integer>> layerAssignments(
            ReplacementRecord record,
            boolean forward)
    {
        Map<Integer, List<Integer>> byLayer =
                new LinkedHashMap<Integer, List<Integer>>();

        for(SwapItem item :
                record.items)
        {
            if(item.layerId <= 0)
            {
                continue;
            }

            int itemId =
                    forward
                            ? item.replacementId
                            : item.originalId;

            List<Integer> ids =
                    byLayer.get(
                            item.layerId
                    );

            if(ids == null)
            {
                ids =
                        new ArrayList<Integer>();

                byLayer.put(
                        item.layerId,
                        ids
                );
            }

            ids.add(
                    itemId
            );
        }

        return byLayer;
    }

    private static List<Integer> traversalIds(
            ReplacementRecord record,
            boolean forward,
            boolean source)
    {
        List<Integer> ids =
                new ArrayList<Integer>();

        for(SwapItem item :
                record.items)
        {
            if(!item.traversable)
            {
                continue;
            }

            ids.add(
                    source
                            ? (
                                forward
                                    ? item.originalId
                                    : item.replacementId
                            )
                            : (
                                forward
                                    ? item.replacementId
                                    : item.originalId
                            )
            );
        }

        return ids;
    }

    private static List<Integer> sourceIds(
            ReplacementRecord record,
            boolean forward)
    {
        List<Integer> ids =
                new ArrayList<Integer>();

        for(SwapItem item :
                record.items)
        {
            ids.add(
                    forward
                            ? item.originalId
                            : item.replacementId
            );
        }

        return ids;
    }

    private static List<Integer> targetIds(
            ReplacementRecord record,
            boolean forward)
    {
        List<Integer> ids =
                new ArrayList<Integer>();

        for(SwapItem item :
                record.items)
        {
            ids.add(
                    forward
                            ? item.replacementId
                            : item.originalId
            );
        }

        return ids;
    }

    private static boolean matchesSource(
            HabboItem item,
            SwapItem swap,
            boolean forward)
    {
        int rotation =
                forward
                        ? swap.originalRotation
                        : swap.replacementRotation;

        String extra =
                forward
                        ? swap.originalExtraData
                        : swap.replacementExtraData;

        int baseItemId =
                forward
                        ? swap.originalBaseItemId
                        : swap.replacementBaseItemId;

        return item.getX() == swap.x
                && item.getY() == swap.y
                && Math.abs(
                        item.getZ() - swap.z
                ) <= EPSILON
                && normalizeRotation(
                        item.getRotation()
                ) == rotation
                && safeExtraData(
                        item.getExtradata()
                ).equals(extra)
                && item.getBaseItem() != null
                && item.getBaseItem().getId()
                == baseItemId;
    }

    private static boolean sameMembers(
            List<Integer> first,
            List<Integer> second)
    {
        if(first == null
                || second == null
                || first.size() != second.size())
        {
            return false;
        }

        return new HashSet<Integer>(
                first
        ).equals(
                new HashSet<Integer>(
                        second
                )
        );
    }

    private static void sendAuthoritativeRoomBatch(
            Habbo actor,
            Room room,
            List<TargetPlan> plans)
    {
        if(actor == null
                || actor.getClient() == null
                || room == null
                || plans == null
                || plans.isEmpty())
        {
            return;
        }

        THashSet<HabboItem> currentTargets =
                new THashSet<HabboItem>();

        for(TargetPlan plan : plans)
        {
            HabboItem current =
                    room.getHabboItem(
                            plan.target.getId()
                    );

            if(current == null)
            {
                throw new IllegalStateException(
                        "Falta un sustituto durante la resincronizacion del cliente."
                );
            }

            currentTargets.add(
                    current
            );
        }

        if(currentTargets.size()
                != plans.size())
        {
            throw new IllegalStateException(
                    "La resincronizacion no contiene todos los sustitutos."
            );
        }

        /*
         * Room.placeFloorFurniAt() emite altas individuales. Nitro las
         * convierte en una cola de furnis pendientes y, durante un reemplazo
         * masivo, esa cola puede quedar parcialmente materializada cuando
         * Builder Pro recibe el resultado.
         *
         * Para el actor que ejecuta Builder Pro hacemos una resincronizacion
         * autoritativa: eliminamos SOLO la representacion cliente de los
         * nuevos IDs (no tocamos el Room del servidor) y enviamos un unico
         * lote con todos los sustitutos ya colocados. El resultado Builder Pro
         * se envia despues de este metodo, de modo que el frontend puede
         * materializar el lote completo antes de seleccionarlo.
         */
        for(HabboItem item : currentTargets)
        {
            actor.getClient()
                    .sendResponse(
                            new RemoveFloorItemComposer(
                                    item,
                                    true
                            )
                    );
        }

        actor.getClient()
                .sendResponse(
                        new RoomFloorItemsComposer(
                                room.getFurniOwnerNames(),
                                currentTargets
                        )
                );
    }


    private static void notifyInventorySwap(
            Habbo actor,
            List<TargetPlan> plans)
    {
        for(TargetPlan plan : plans)
        {
            try
            {
                actor.getClient()
                        .sendResponse(
                                new RemoveHabboItemComposer(
                                        plan.target
                                                .getGiftAdjustedId()
                                )
                        );

                actor.getClient()
                        .sendResponse(
                                new AddHabboItemComposer(
                                        plan.source
                                )
                        );
            }
            catch(Exception exception)
            {
                System.out.println(
                        "[BuilderProTrace] REPLACE inventory notify failed."
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
        catch(Exception exception)
        {
            System.out.println(
                    "[BuilderProTrace] REPLACE inventory refresh failed."
            );
        }
    }

    private static void addFootprint(
            RoomLayout layout,
            short x,
            short y,
            HabboItem item,
            int rotation,
            THashSet<RoomTile> affected)
    {
        if(layout == null
                || item == null
                || item.getBaseItem() == null)
        {
            return;
        }

        Rectangle rectangle =
                RoomLayout.getRectangle(
                        x,
                        y,
                        item.getBaseItem()
                                .getWidth(),
                        item.getBaseItem()
                                .getLength(),
                        rotation
                );

        for(int tileX = rectangle.x;
                tileX < rectangle.x + rectangle.width;
                tileX++)
        {
            for(int tileY = rectangle.y;
                    tileY < rectangle.y + rectangle.height;
                    tileY++)
            {
                RoomTile tile =
                        layout.getTile(
                                (short)tileX,
                                (short)tileY
                        );

                if(tile != null)
                {
                    affected.add(
                            tile
                    );
                }
            }
        }
    }

    private static void refreshAffectedTiles(
            Room room,
            THashSet<RoomTile> affected)
    {
        if(affected == null
                || affected.isEmpty())
        {
            return;
        }

        room.updateTiles(
                affected
        );

        for(RoomTile tile : affected)
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
        int result =
                rotation % 8;

        if(result < 0)
        {
            result += 8;
        }

        return result;
    }

    private static String safeExtraData(
            String extraData)
    {
        return extraData == null
                ? ""
                : extraData;
    }

    private static String safeName(
            String name,
            int baseItemId)
    {
        if(name == null
                || name.trim().isEmpty())
        {
            return "furni #"
                    + baseItemId;
        }

        return name.trim();
    }

    private static final class TargetPlan
    {
        private final HabboItem source;
        private final HabboItem target;
        private final short sourceX;
        private final short sourceY;
        private final double sourceZ;
        private final int sourceRotation;
        private final String sourceExtraData;
        private final short targetX;
        private final short targetY;
        private final double targetZ;
        private final int targetRotation;
        private final String targetExtraData;

        private TargetPlan(
                SwapItem swap,
                HabboItem source,
                HabboItem target,
                boolean forward)
        {
            this.source = source;
            this.target = target;

            this.sourceX = swap.x;
            this.sourceY = swap.y;
            this.sourceZ = swap.z;
            this.sourceRotation =
                    forward
                            ? swap.originalRotation
                            : swap.replacementRotation;
            this.sourceExtraData =
                    forward
                            ? swap.originalExtraData
                            : swap.replacementExtraData;

            this.targetX = swap.x;
            this.targetY = swap.y;
            this.targetZ = swap.z;
            this.targetRotation =
                    forward
                            ? swap.replacementRotation
                            : swap.originalRotation;
            this.targetExtraData =
                    forward
                            ? swap.replacementExtraData
                            : swap.originalExtraData;
        }
    }

    private static final class TargetVolume
    {
        private final Rectangle rectangle;
        private final double bottom;
        private final double top;

        private TargetVolume(
                Rectangle rectangle,
                double bottom,
                double top)
        {
            this.rectangle = rectangle;
            this.bottom = bottom;
            this.top = top;
        }
    }

    private static final class Prepared
    {
        private final boolean success;
        private final int code;
        private final String message;
        private final int needed;
        private final int available;
        private final int referenceId;
        private final int referenceBaseItemId;
        private final String referenceName;
        private final ReplacementRecord record;

        private Prepared(
                boolean success,
                int code,
                String message,
                int needed,
                int available,
                int referenceId,
                int referenceBaseItemId,
                String referenceName,
                ReplacementRecord record)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.needed = needed;
            this.available = available;
            this.referenceId = referenceId;
            this.referenceBaseItemId =
                    referenceBaseItemId;
            this.referenceName =
                    referenceName == null
                            ? ""
                            : referenceName;
            this.record = record;
        }

        private static Prepared success(
                int needed,
                int available,
                int referenceId,
                int referenceBaseItemId,
                String referenceName,
                ReplacementRecord record)
        {
            return new Prepared(
                    true,
                    0,
                    "",
                    needed,
                    available,
                    referenceId,
                    referenceBaseItemId,
                    referenceName,
                    record
            );
        }

        private static Prepared failure(
                int code,
                String message)
        {
            return new Prepared(
                    false,
                    code,
                    message,
                    0,
                    0,
                    0,
                    0,
                    "",
                    null
            );
        }

        private static Prepared failureWithReference(
                int code,
                String message,
                int needed,
                int available,
                int referenceId,
                int referenceBaseItemId,
                String referenceName)
        {
            return new Prepared(
                    false,
                    code,
                    message,
                    needed,
                    available,
                    referenceId,
                    referenceBaseItemId,
                    referenceName,
                    null
            );
        }

        private Result toFailureResult()
        {
            return Result.failure(
                    this.code,
                    this.message,
                    this.needed,
                    this.available,
                    this.referenceId,
                    this.referenceBaseItemId,
                    this.referenceName
            );
        }
    }

    public static final class ReplacementRecord
    {
        public final int roomId;
        private final List<SwapItem> items;
        private final List<GroupSwap> groups;

        private ReplacementRecord(
                int roomId,
                List<SwapItem> items,
                List<GroupSwap> groups)
        {
            this.roomId = roomId;
            this.items =
                    Collections.unmodifiableList(
                            new ArrayList<SwapItem>(
                                    items
                            )
                    );
            this.groups =
                    Collections.unmodifiableList(
                            new ArrayList<GroupSwap>(
                                    groups
                            )
                    );
        }

        public int size()
        {
            return this.items.size();
        }

        public List<Integer> replacementIds()
        {
            List<Integer> ids =
                    new ArrayList<Integer>();

            for(SwapItem item :
                    this.items)
            {
                ids.add(
                        item.replacementId
                );
            }

            return ids;
        }
    }

    private static final class SwapItem
    {
        private final int originalId;
        private final int replacementId;
        private final short x;
        private final short y;
        private final double z;
        private final int originalRotation;
        private final int replacementRotation;
        private final String originalExtraData;
        private final String replacementExtraData;
        private final int originalBaseItemId;
        private final int replacementBaseItemId;
        private final int layerId;
        private final int groupId;
        private final boolean traversable;

        private SwapItem(
                int originalId,
                int replacementId,
                short x,
                short y,
                double z,
                int originalRotation,
                int replacementRotation,
                String originalExtraData,
                String replacementExtraData,
                int originalBaseItemId,
                int replacementBaseItemId,
                int layerId,
                int groupId,
                boolean traversable)
        {
            this.originalId = originalId;
            this.replacementId = replacementId;
            this.x = x;
            this.y = y;
            this.z = z;
            this.originalRotation =
                    normalizeRotation(
                            originalRotation
                    );
            this.replacementRotation =
                    normalizeRotation(
                            replacementRotation
                    );
            this.originalExtraData =
                    safeExtraData(
                            originalExtraData
                    );
            this.replacementExtraData =
                    safeExtraData(
                            replacementExtraData
                    );
            this.originalBaseItemId =
                    originalBaseItemId;
            this.replacementBaseItemId =
                    replacementBaseItemId;
            this.layerId = layerId;
            this.groupId = groupId;
            this.traversable = traversable;
        }
    }

    private static final class GroupSwap
    {
        private final int groupId;
        private final List<Integer> beforeMembers;
        private final List<Integer> afterMembers;

        private GroupSwap(
                int groupId,
                List<Integer> beforeMembers,
                List<Integer> afterMembers)
        {
            this.groupId = groupId;
            this.beforeMembers =
                    Collections.unmodifiableList(
                            new ArrayList<Integer>(
                                    beforeMembers
                            )
                    );
            this.afterMembers =
                    Collections.unmodifiableList(
                            new ArrayList<Integer>(
                                    afterMembers
                            )
                    );
        }
    }

    private static final class SwapResult
    {
        private final boolean success;
        private final int code;
        private final String message;
        private final boolean invalidateHistory;

        private SwapResult(
                boolean success,
                int code,
                String message,
                boolean invalidateHistory)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.invalidateHistory =
                    invalidateHistory;
        }

        private static SwapResult success(
                int affected)
        {
            return new SwapResult(
                    true,
                    0,
                    "",
                    false
            );
        }

        private static SwapResult failure(
                int code,
                String message,
                boolean invalidateHistory)
        {
            return new SwapResult(
                    false,
                    code,
                    message,
                    invalidateHistory
            );
        }
    }

    public static final class HistoryApplyResult
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final boolean invalidateHistory;
        public final int affectedCount;

        private HistoryApplyResult(
                boolean success,
                int code,
                String message,
                boolean invalidateHistory,
                int affectedCount)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.invalidateHistory =
                    invalidateHistory;
            this.affectedCount =
                    affectedCount;
        }

        public static HistoryApplyResult success(
                int affectedCount,
                String message)
        {
            return new HistoryApplyResult(
                    true,
                    0,
                    message,
                    false,
                    affectedCount
            );
        }

        public static HistoryApplyResult failure(
                int code,
                String message,
                boolean invalidateHistory)
        {
            return new HistoryApplyResult(
                    false,
                    code,
                    message,
                    invalidateHistory,
                    0
            );
        }
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final int needed;
        public final int available;
        public final int referenceId;
        public final int referenceBaseItemId;
        public final String referenceName;
        public final int affectedCount;
        public final List<Integer> itemIds;

        private Result(
                boolean success,
                int code,
                String message,
                int needed,
                int available,
                int referenceId,
                int referenceBaseItemId,
                String referenceName,
                int affectedCount,
                List<Integer> itemIds)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.needed = needed;
            this.available = available;
            this.referenceId = referenceId;
            this.referenceBaseItemId =
                    referenceBaseItemId;
            this.referenceName =
                    referenceName == null
                            ? ""
                            : referenceName;
            this.affectedCount =
                    affectedCount;
            this.itemIds =
                    Collections.unmodifiableList(
                            new ArrayList<Integer>(
                                    itemIds
                            )
                    );
        }

        public static Result success(
                String message,
                int needed,
                int available,
                int referenceId,
                int referenceBaseItemId,
                String referenceName,
                int affectedCount,
                List<Integer> itemIds)
        {
            return new Result(
                    true,
                    0,
                    message,
                    needed,
                    available,
                    referenceId,
                    referenceBaseItemId,
                    referenceName,
                    affectedCount,
                    itemIds
            );
        }

        public static Result failure(
                int code,
                String message,
                int needed,
                int available,
                int referenceId,
                int referenceBaseItemId,
                String referenceName)
        {
            return new Result(
                    false,
                    code,
                    message,
                    needed,
                    available,
                    referenceId,
                    referenceBaseItemId,
                    referenceName,
                    0,
                    Collections.<Integer>emptyList()
            );
        }
    }
}
