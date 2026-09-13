package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionJukeBox;
import com.eu.habbo.habbohotel.items.interactions.InteractionMoodLight;
import com.eu.habbo.habbohotel.items.interactions.InteractionStackHelper;
import com.eu.habbo.habbohotel.items.interactions.InteractionTileWalkMagic;
import com.eu.habbo.habbohotel.rooms.FurnitureMovementError;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomLayout;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.rooms.RoomTileState;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.eu.habbo.messages.outgoing.inventory.RemoveHabboItemComposer;
import com.eu.habbo.messages.outgoing.rooms.items.RemoveFloorItemComposer;
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

public final class RadialRepeatService
{
    public static final int OP_PREVIEW = 0;
    public static final int OP_EXECUTE = 1;

    public static final int MAX_COPIES = 100;
    public static final int MAX_ANGLE = 360;
    public static final int MAX_RADIUS = 100;
    public static final int MAX_TOTAL_ITEMS =
            CopyGroupService.MAX_GROUP_SIZE;

    private static final double EPSILON =
            0.000001D;

    private RadialRepeatService()
    {
    }

    public static Result process(
            Habbo actor,
            List<Integer> requestedIds,
            int operation,
            int copies,
            int totalAngle,
            int radius,
            boolean rotateWithPattern,
            int pivotId,
            int requestId)
    {
        if(actor == null)
        {
            return Result.failure(
                    1,
                    "Usuario no disponible.",
                    copies
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
                    copies
            );
        }

        if(!room.hasRights(actor))
        {
            return Result.failure(
                    3,
                    "No tienes permisos de construccion en esta sala.",
                    copies
            );
        }

        if(operation != OP_PREVIEW
                && operation != OP_EXECUTE)
        {
            return Result.failure(
                    4,
                    "Operacion de repeticion invalida.",
                    copies
            );
        }

        if(copies < 1
                || copies > MAX_COPIES)
        {
            return Result.failure(
                    5,
                    "La cantidad de copias no es valida.",
                    copies
            );
        }

        if(totalAngle < 1
                || totalAngle > MAX_ANGLE)
        {
            return Result.failure(
                    9,
                    "El angulo total debe estar entre 1 y 360 grados.",
                    copies
            );
        }

        if(radius < 1
                || radius > MAX_RADIUS)
        {
            return Result.failure(
                    10,
                    "El radio debe estar entre 1 y 100 casillas.",
                    copies
            );
        }

        if(requestedIds == null
                || requestedIds.isEmpty())
        {
            return Result.failure(
                    6,
                    "La seleccion esta vacia.",
                    copies
            );
        }

        LinkedHashSet<Integer> uniqueIds =
                new LinkedHashSet<Integer>(
                        requestedIds
                );

        if(uniqueIds.size()
                != requestedIds.size())
        {
            return Result.failure(
                    7,
                    "La seleccion contiene IDs duplicados.",
                    copies
            );
        }

        if(uniqueIds.size()
                > CopyGroupService.MAX_GROUP_SIZE)
        {
            return Result.failure(
                    8,
                    "La seleccion supera el limite de Builder Pro.",
                    copies
            );
        }

        if(pivotId != 0
                && !uniqueIds.contains(
                        Integer.valueOf(
                                pivotId
                        )))
        {
            return Result.failure(
                    10,
                    "El pivote radial ya no pertenece a la seleccion.",
                    copies
            );
        }

        long totalItemsLong =
                (long)uniqueIds.size()
                        * (long)copies;

        if(totalItemsLong > MAX_TOTAL_ITEMS)
        {
            return Result.failure(
                    11,
                    "La repeticion generaria "
                            + totalItemsLong
                            + " furnis y supera el limite actual de Builder Pro.",
                    copies
            );
        }

        int totalItems =
                (int)totalItemsLong;

        if(room.itemCount() + totalItems
                > Room.MAXIMUM_FURNI)
        {
            return Result.failure(
                    12,
                    "La sala alcanzaria el limite de furnis.",
                    copies
            );
        }

        List<Integer> sourceIds =
                new ArrayList<Integer>(
                        uniqueIds
                );

        Map<Integer, Integer> layerMemberships;
        Set<Integer> traversableIds;

        try
        {
            layerMemberships =
                    BuilderProLayerRepository.memberships(
                            sourceIds
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

            return Result.failure(
                    16,
                    "No se pudo leer la metadata de la seleccion.",
                    copies
            );
        }

        List<Source> sources =
                new ArrayList<Source>(
                        sourceIds.size()
                );

        int minimumX =
                Integer.MAX_VALUE;

        int minimumY =
                Integer.MAX_VALUE;

        int maximumXExclusive =
                Integer.MIN_VALUE;

        int maximumYExclusive =
                Integer.MIN_VALUE;

        for(Integer sourceId : sourceIds)
        {
            if(sourceId == null)
            {
                return Result.failure(
                        13,
                        "La seleccion contiene un ID invalido.",
                        copies
                );
            }

            HabboItem item =
                    room.getHabboItem(
                            sourceId.intValue()
                    );

            if(item == null)
            {
                return Result.failure(
                        13,
                        "Uno de los furnis ya no existe en la sala.",
                        copies
                );
            }

            if(item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR)
            {
                return Result.failure(
                        14,
                        "El patron radial solo admite furnis de suelo.",
                        copies
                );
            }

            if(item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return Result.failure(
                        15,
                        "El patron radial no admite baldosas de arquitecto.",
                        copies
                );
            }

            int layerId =
                    layerMemberships.containsKey(
                            item.getId()
                    )
                            ? layerMemberships.get(
                                    item.getId()
                            ).intValue()
                            : 0;

            Source source =
                    new Source(
                            item,
                            layerId,
                            traversableIds.contains(
                                    item.getId()
                            )
                    );

            sources.add(
                    source
            );

            Rectangle rectangle =
                    RoomLayout.getRectangle(
                            item.getX(),
                            item.getY(),
                            item.getBaseItem()
                                    .getWidth(),
                            item.getBaseItem()
                                    .getLength(),
                            normalizeRotation(
                                    item.getRotation()
                            )
                    );

            minimumX =
                    Math.min(
                            minimumX,
                            rectangle.x
                    );

            minimumY =
                    Math.min(
                            minimumY,
                            rectangle.y
                    );

            maximumXExclusive =
                    Math.max(
                            maximumXExclusive,
                            rectangle.x
                                    + rectangle.width
                    );

            maximumYExclusive =
                    Math.max(
                            maximumYExclusive,
                            rectangle.y
                                    + rectangle.height
                    );
        }

        int structureWidth =
                maximumXExclusive
                        - minimumX;

        int structureHeight =
                maximumYExclusive
                        - minimumY;

        if(structureWidth < 1
                || structureHeight < 1)
        {
            return Result.failure(
                    14,
                    "No se pudo calcular el tamano de la seleccion.",
                    copies
            );
        }

        double sourceCenterX =
                (
                    minimumX
                            + maximumXExclusive
                            - 1
                ) / 2.0D;

        double sourceCenterY =
                (
                    minimumY
                            + maximumYExclusive
                            - 1
                ) / 2.0D;

        double patternCenterX =
                sourceCenterX;

        double patternCenterY =
                sourceCenterY;

        if(pivotId != 0)
        {
            HabboItem pivotItem =
                    room.getHabboItem(
                            pivotId
                    );

            if(pivotItem == null
                    || pivotItem.getBaseItem() == null)
            {
                return Result.failure(
                        13,
                        "El pivote radial ya no existe en la sala.",
                        copies
                );
            }

            Rectangle pivotRectangle =
                    RoomLayout.getRectangle(
                            pivotItem.getX(),
                            pivotItem.getY(),
                            pivotItem.getBaseItem()
                                    .getWidth(),
                            pivotItem.getBaseItem()
                                    .getLength(),
                            normalizeRotation(
                                    pivotItem.getRotation()
                            )
                    );

            patternCenterX =
                    pivotRectangle.x
                            + (
                                pivotRectangle.width
                                        - 1
                            ) / 2.0D;

            patternCenterY =
                    pivotRectangle.y
                            + (
                                pivotRectangle.height
                                        - 1
                            ) / 2.0D;
        }

        List<HabboItem> inventoryItems =
                new ArrayList<HabboItem>(
                        actor.getInventory()
                                .getItemsComponent()
                                .getItemsAsValueCollection()
                );

        inventoryItems.sort(
                Comparator.comparingInt(
                        HabboItem::getId
                )
        );

        Map<Integer, List<HabboItem>> availableByBase =
                new HashMap<Integer, List<HabboItem>>();

        for(HabboItem inventoryItem : inventoryItems)
        {
            if(inventoryItem == null
                    || inventoryItem.getBaseItem() == null
                    || inventoryItem.getRoomId() != 0)
            {
                continue;
            }

            int baseItemId =
                    inventoryItem.getBaseItem()
                            .getId();

            List<HabboItem> available =
                    availableByBase.get(
                            baseItemId
                    );

            if(available == null)
            {
                available =
                        new ArrayList<HabboItem>();

                availableByBase.put(
                        baseItemId,
                        available
                );
            }

            available.add(
                    inventoryItem
            );
        }

        Map<Integer, Integer> cursors =
                new HashMap<Integer, Integer>();

        Map<Integer, Integer> missing =
                new LinkedHashMap<Integer, Integer>();

        Map<Integer, String> names =
                new LinkedHashMap<Integer, String>();

        List<Target> targets =
                new ArrayList<Target>(
                        totalItems
                );

        for(int copyIndex = 0;
                copyIndex < copies;
                copyIndex++)
        {
            double angleDegrees;

            if(copies == 1)
            {
                angleDegrees =
                        0.0D;
            }
            else if(totalAngle == 360)
            {
                angleDegrees =
                        (
                            360.0D
                                    * copyIndex
                        ) / copies;
            }
            else
            {
                angleDegrees =
                        (
                            (double)totalAngle
                                    * copyIndex
                        ) / (
                            copies - 1
                        );
            }

            double radians =
                    Math.toRadians(
                            angleDegrees - 90.0D
                    );

            double deltaX =
                    radius
                            * Math.cos(
                                    radians
                            );

            double deltaY =
                    radius
                            * Math.sin(
                                    radians
                            );

            int rotationDelta =
                    (int)Math.round(
                            angleDegrees / 45.0D
                    );

            for(Source source : sources)
            {
                int baseItemId =
                        source.baseItemId;

                names.put(
                        baseItemId,
                        safeName(
                                source.baseItemName,
                                baseItemId
                        )
                );

                List<HabboItem> candidates =
                        availableByBase.get(
                                baseItemId
                        );

                int cursor =
                        cursors.containsKey(
                                baseItemId
                        )
                                ? cursors.get(
                                        baseItemId
                                )
                                : 0;

                if(candidates == null
                        || cursor >= candidates.size())
                {
                    int currentMissing =
                            missing.containsKey(
                                    baseItemId
                            )
                                    ? missing.get(
                                            baseItemId
                                    )
                                    : 0;

                    missing.put(
                            baseItemId,
                            currentMissing + 1
                    );

                    continue;
                }

                HabboItem targetItem =
                        candidates.get(
                                cursor
                        );

                cursors.put(
                        baseItemId,
                        cursor + 1
                );

                short targetX;
                short targetY;

                try
                {
                    targetX =
                            checkedShort(
                                    (int)Math.round(
                                            patternCenterX
                                                    + deltaX
                                                    + (
                                                        source.x
                                                                - sourceCenterX
                                                    )
                                    )
                            );

                    targetY =
                            checkedShort(
                                    (int)Math.round(
                                            patternCenterY
                                                    + deltaY
                                                    + (
                                                        source.y
                                                                - sourceCenterY
                                                    )
                                    )
                            );
                }
                catch(IllegalArgumentException exception)
                {
                    return Result.failure(
                            18,
                            "Una copia queda fuera del rango de coordenadas.",
                            copies
                    );
                }

                int targetRotation =
                        rotateWithPattern
                                ? snapRotation(
                                        source.rotation
                                                + rotationDelta,
                                        source.maxRotations
                                )
                                : source.rotation;

                targets.add(
                        new Target(
                                targetItem,
                                targetX,
                                targetY,
                                source.z,
                                targetRotation,
                                source.extraData,
                                source.layerId,
                                source.traversable,
                                baseItemId
                        )
                );
            }
        }

        if(!missing.isEmpty())
        {
            return Result.failure(
                    17,
                    formatMissing(
                            missing,
                            names
                    ),
                    copies
            );
        }

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        Result validation =
                validateTargets(
                        room,
                        targets,
                        affectedTiles,
                        copies
                );

        if(!validation.success)
        {
            return validation;
        }

        List<PreviewEntry> previewEntries =
                buildPreviewEntries(
                        targets
                );

        if(operation == OP_PREVIEW)
        {
            return Result.preview(
                    copies,
                    previewEntries
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        Map<Integer, Double> forcedHeights =
                new HashMap<Integer, Double>();

        for(Target target : targets)
        {
            forcedHeights.put(
                    target.item.getId(),
                    target.z
            );

            target.item.setExtradata(
                    target.extraData
            );
        }

        List<Target> placed =
                new ArrayList<Target>();

        boolean metadataApplied =
                false;

        BuilderProContext.begin(
                actorId,
                forcedHeights
        );

        try
        {
            System.out.println(
                    "[BuilderProTrace] SERVER RADIAL_REPEAT_BEGIN #"
                            + requestId
                            + " sources="
                            + sources.size()
                            + " copies="
                            + copies
                            + " targets="
                            + targets.size()
            );

            for(Target target : targets)
            {
                RoomTile destination =
                        room.getLayout()
                                .getTile(
                                        target.x,
                                        target.y
                                );

                FurnitureMovementError error =
                        room.placeFloorFurniAt(
                                target.item,
                                destination,
                                target.rotation,
                                actor
                        );

                if(error != FurnitureMovementError.NONE)
                {
                    rollbackPlaced(
                            room,
                            placed,
                            affectedTiles
                    );

                    restoreTargetExtraData(
                            targets
                    );

                    return Result.failure(
                            27,
                            "Repeticion cancelada por el servidor: "
                                    + error.name(),
                            copies
                    );
                }

                placed.add(
                        target
                );

                HabboItem placedItem =
                        target.item;

                if(placedItem.getRoomId()
                        != room.getId()
                        || placedItem.getX()
                        != target.x
                        || placedItem.getY()
                        != target.y
                        || Math.abs(
                                placedItem.getZ()
                                        - target.z
                        ) > EPSILON
                        || normalizeRotation(
                                placedItem.getRotation()
                        ) != target.rotation)
                {
                    rollbackPlaced(
                            room,
                            placed,
                            affectedTiles
                    );

                    restoreTargetExtraData(
                            targets
                    );

                    return Result.failure(
                            28,
                            "El servidor altero la geometria exacta de la repeticion.",
                            copies
                    );
                }
            }

            TIntObjectMap<HabboItem> inventoryMap =
                    actor.getInventory()
                            .getItemsComponent()
                            .getItems();

            synchronized(inventoryMap)
            {
                for(Target target : targets)
                {
                    if(inventoryMap.get(
                            target.item.getId()
                    ) != target.item)
                    {
                        rollbackPlaced(
                                room,
                                placed,
                                affectedTiles
                        );

                        restoreTargetExtraData(
                                targets
                        );

                        return Result.failure(
                                29,
                                "El inventario cambio durante la repeticion.",
                                copies
                        );
                    }
                }
            }

            try
            {
                applyPlacementMetadata(
                        actor,
                        room,
                        targets
                );

                metadataApplied =
                        true;
            }
            catch(Exception metadataError)
            {
                cleanupPlacementMetadata(
                        actor,
                        room,
                        targets
                );

                rollbackPlaced(
                        room,
                        placed,
                        affectedTiles
                );

                restoreTargetExtraData(
                        targets
                );

                return Result.failure(
                        30,
                        "No se pudo conservar la metadata de la repeticion.",
                        copies
                );
            }

            persistTargetExtraData(
                    room,
                    targets
            );

            synchronized(inventoryMap)
            {
                for(Target target : targets)
                {
                    if(inventoryMap.get(
                            target.item.getId()
                    ) != target.item)
                    {
                        if(metadataApplied)
                        {
                            cleanupPlacementMetadata(
                                    actor,
                                    room,
                                    targets
                            );
                        }

                        rollbackPlaced(
                                room,
                                placed,
                                affectedTiles
                        );

                        restoreTargetExtraData(
                                targets
                        );

                        return Result.failure(
                                29,
                                "El inventario cambio durante la repeticion.",
                                copies
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

            BuilderProTraversalService
                    .refreshRoomCollision(
                            room
                    );

            List<Integer> placedIds =
                    new ArrayList<Integer>(
                            targets.size()
                    );

            for(Target target : targets)
            {
                placedIds.add(
                        target.item.getId()
                );

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
                            "[BuilderProTrace] RADIAL_REPEAT inventory notify failed item="
                                    + target.item.getId()
                    );
                }

                target.item.setFromGift(
                        false
                );
            }

            System.out.println(
                    "[BuilderProTrace] SERVER RADIAL_REPEAT_END #"
                            + requestId
                            + " placed="
                            + placedIds.size()
            );

            return Result.execute(
                    copies,
                    previewEntries,
                    placedIds
            );
        }
        catch(Exception exception)
        {
            if(metadataApplied)
            {
                cleanupPlacementMetadata(
                        actor,
                        room,
                        targets
                );
            }

            restoreTargetExtraData(
                    targets
            );

            rollbackPlaced(
                    room,
                    placed,
                    affectedTiles
            );

            System.out.println(
                    "[BuilderProTrace] SERVER RADIAL_REPEAT_EXCEPTION #"
                            + requestId
                            + " "
                            + exception.getClass()
                                    .getName()
                            + ": "
                            + exception.getMessage()
            );

            return Result.failure(
                    31,
                    "La repeticion fue revertida por un error interno.",
                    copies
            );
        }
        finally
        {
            BuilderProContext.clear();
        }
    }

    private static Result validateTargets(
            Room room,
            List<Target> targets,
            THashSet<RoomTile> affectedTiles,
            int copies)
    {
        for(Target target : targets)
        {
            target.item.setExtradata(
                    target.extraData
            );
        }

        try
        {
            Result specialValidation =
                    validateSpecialItems(
                            room,
                            targets,
                            copies
                    );

            if(!specialValidation.success)
            {
                return specialValidation;
            }

            for(Target target : targets)
            {
                Result targetValidation =
                        validateTargetAgainstRoom(
                                room,
                                target,
                                affectedTiles,
                                copies
                        );

                if(!targetValidation.success)
                {
                    return targetValidation;
                }
            }

            for(int firstIndex = 0;
                    firstIndex < targets.size();
                    firstIndex++)
            {
                Target first =
                        targets.get(
                                firstIndex
                        );

                Rectangle firstRectangle =
                        targetRectangle(
                                first
                        );

                double firstBottom =
                        first.z;

                double firstTop =
                        first.z
                                + Item.getCurrentHeight(
                                        first.item
                                );

                for(int secondIndex =
                            firstIndex + 1;
                        secondIndex < targets.size();
                        secondIndex++)
                {
                    Target second =
                            targets.get(
                                    secondIndex
                            );

                    Rectangle secondRectangle =
                            targetRectangle(
                                    second
                            );

                    if(!firstRectangle.intersects(
                            secondRectangle))
                    {
                        continue;
                    }

                    double secondBottom =
                            second.z;

                    double secondTop =
                            second.z
                                    + Item.getCurrentHeight(
                                            second.item
                                    );

                    if(verticalRangesOverlap(
                            firstBottom,
                            firstTop,
                            secondBottom,
                            secondTop))
                    {
                        return Result.failure(
                                26,
                                "Las copias se solaparian entre si.",
                                copies
                        );
                    }
                }
            }

            return Result.preview(
                    copies,
                    Collections.<PreviewEntry>emptyList()
            );
        }
        finally
        {
            restoreTargetExtraData(
                    targets
            );
        }
    }

    private static Result validateSpecialItems(
            Room room,
            List<Target> targets,
            int copies)
    {
        int moodLights = 0;
        int jukeboxes = 0;

        for(Target target : targets)
        {
            if(target.item
                    instanceof InteractionMoodLight)
            {
                moodLights++;
            }

            if(target.item
                    instanceof InteractionJukeBox)
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
                return Result.failure(
                        19,
                        "La sala no admite otro regulador de ambiente.",
                        copies
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
                return Result.failure(
                        20,
                        "La sala no admite otro jukebox.",
                        copies
                );
            }
        }

        return Result.preview(
                copies,
                Collections.<PreviewEntry>emptyList()
        );
    }

    private static Result validateTargetAgainstRoom(
            Room room,
            Target target,
            THashSet<RoomTile> affectedTiles,
            int copies)
    {
        RoomLayout layout =
                room.getLayout();

        HabboItem item =
                target.item;

        if(item == null
                || item.getBaseItem() == null)
        {
            return Result.failure(
                    21,
                    "El inventario contiene un furni invalido.",
                    copies
            );
        }

        if(target.z > Room.MAXIMUM_FURNI_HEIGHT
                || target.z < -9999.0D)
        {
            return Result.failure(
                    21,
                    "La altura destino queda fuera del rango admitido.",
                    copies
            );
        }

        RoomTile anchor =
                layout.getTile(
                        target.x,
                        target.y
                );

        if(anchor == null
                || !layout.fitsOnMap(
                        anchor,
                        item.getBaseItem()
                                .getWidth(),
                        item.getBaseItem()
                                .getLength(),
                        target.rotation))
        {
            return Result.failure(
                    21,
                    "Una copia no cabe dentro del mapa.",
                    copies
            );
        }

        Rectangle destination =
                targetRectangle(
                        target
                );

        double movingBottom =
                target.z;

        double movingTop =
                target.z
                        + Item.getCurrentHeight(
                                item
                        );

        for(int x = destination.x;
                x < destination.x
                        + destination.width;
                x++)
        {
            for(int y = destination.y;
                    y < destination.y
                            + destination.height;
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
                    return Result.failure(
                            22,
                            "La repeticion pisaria tiles invalidos.",
                            copies
                    );
                }

                affectedTiles.add(
                        tile
                );

                if(target.z
                        < layout.getHeightAtSquare(
                                x,
                                y
                        ))
                {
                    return Result.failure(
                            23,
                            "Un furni quedaria por debajo del suelo.",
                            copies
                    );
                }

                if(room.hasHabbosAt(x, y)
                        || room.hasBotsAt(x, y)
                        || room.hasPetsAt(x, y))
                {
                    return Result.failure(
                            24,
                            "Hay una unidad ocupando el volumen destino.",
                            copies
                    );
                }

                for(HabboItem existing :
                        room.getItemsAt(
                                tile
                        ))
                {
                    if(existing == null)
                    {
                        continue;
                    }

                    if(existing.getBaseItem() == null)
                    {
                        return Result.failure(
                                25,
                                "El destino contiene un furni externo invalido.",
                                copies
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
                        return Result.failure(
                                25,
                                "La repeticion colisiona con un furni existente.",
                                copies
                        );
                    }
                }
            }
        }

        return Result.preview(
                copies,
                Collections.<PreviewEntry>emptyList()
        );
    }

    private static Rectangle targetRectangle(
            Target target)
    {
        return RoomLayout.getRectangle(
                target.x,
                target.y,
                target.item.getBaseItem()
                        .getWidth(),
                target.item.getBaseItem()
                        .getLength(),
                target.rotation
        );
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

    private static void applyPlacementMetadata(
            Habbo actor,
            Room room,
            List<Target> targets)
            throws Exception
    {
        Map<Integer, List<Integer>> byLayer =
                new HashMap<Integer, List<Integer>>();

        List<Integer> traversable =
                new ArrayList<Integer>();

        for(Target target : targets)
        {
            if(target.layerId > 0
                    && BuilderProLayerRepository.find(
                            room.getId(),
                            target.layerId
                    ) != null)
            {
                List<Integer> ids =
                        byLayer.get(
                                target.layerId
                        );

                if(ids == null)
                {
                    ids =
                            new ArrayList<Integer>();

                    byLayer.put(
                            target.layerId,
                            ids
                    );
                }

                ids.add(
                        target.item.getId()
                );
            }

            if(target.traversable)
            {
                traversable.add(
                        target.item.getId()
                );
            }
        }

        for(Map.Entry<Integer, List<Integer>> entry :
                byLayer.entrySet())
        {
            BuilderProLayerRepository.assignItems(
                    room.getId(),
                    entry.getKey()
                            .intValue(),
                    entry.getValue()
            );
        }

        if(!traversable.isEmpty())
        {
            BuilderProTraversalService.Result result =
                    BuilderProTraversalService.execute(
                            actor,
                            BuilderProTraversalService.OP_SET,
                            true,
                            traversable
                    );

            if(!result.success)
            {
                throw new IllegalStateException(
                        result.message
                );
            }
        }
    }

    private static void cleanupPlacementMetadata(
            Habbo actor,
            Room room,
            List<Target> targets)
    {
        List<Integer> ids =
                new ArrayList<Integer>();

        List<Integer> traversable =
                new ArrayList<Integer>();

        for(Target target : targets)
        {
            if(target == null
                    || target.item == null)
            {
                continue;
            }

            ids.add(
                    target.item.getId()
            );

            if(target.traversable)
            {
                traversable.add(
                        target.item.getId()
                );
            }
        }

        try
        {
            BuilderProLayerRepository.unassignItems(
                    ids
            );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();
        }

        if(!traversable.isEmpty())
        {
            try
            {
                BuilderProTraversalService.execute(
                        actor,
                        BuilderProTraversalService.OP_SET,
                        false,
                        traversable
                );
            }
            catch(Exception exception)
            {
                exception.printStackTrace();
            }
        }
    }

    private static void persistTargetExtraData(
            Room room,
            List<Target> targets)
    {
        for(Target target : targets)
        {
            try
            {
                target.item.setExtradata(
                        target.extraData
                );

                target.item.needsUpdate(
                        true
                );

                target.item.run();

                room.updateItemState(
                        target.item
                );
            }
            catch(Exception exception)
            {
                throw new IllegalStateException(
                        "No se pudo conservar el estado de un furni.",
                        exception
                );
            }
        }
    }

    private static void restoreTargetExtraData(
            List<Target> targets)
    {
        for(Target target : targets)
        {
            try
            {
                target.item.setExtradata(
                        target.originalExtraData
                );

                target.item.needsUpdate(
                        true
                );
            }
            catch(Exception exception)
            {
                exception.printStackTrace();
            }
        }
    }

    private static void rollbackPlaced(
            Room room,
            List<Target> placed,
            THashSet<RoomTile> affectedTiles)
    {
        for(int index = placed.size() - 1;
                index >= 0;
                index--)
        {
            Target target =
                    placed.get(
                            index
                    );

            HabboItem item =
                    target.item;

            try
            {
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

                    item.needsUpdate(
                            true
                    );

                    room.sendComposer(
                            new RemoveFloorItemComposer(
                                    item
                            ).compose()
                    );

                    item.run();
                }
            }
            catch(Exception rollbackError)
            {
                System.out.println(
                        "[BuilderProTrace] RADIAL_REPEAT_ROLLBACK_ERROR item="
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

    private static List<PreviewEntry> buildPreviewEntries(
            List<Target> targets)
    {
        List<PreviewEntry> entries =
                new ArrayList<PreviewEntry>(
                        targets.size()
                );

        for(Target target : targets)
        {
            entries.add(
                    new PreviewEntry(
                            target.baseItemId,
                            target.x,
                            target.y,
                            target.z,
                            target.rotation,
                            target.extraData
                    )
            );
        }

        return entries;
    }

    private static String formatMissing(
            Map<Integer, Integer> missing,
            Map<Integer, String> names)
    {
        StringBuilder builder =
                new StringBuilder(
                        "Faltan "
                );

        boolean first =
                true;

        for(Map.Entry<Integer, Integer> entry :
                missing.entrySet())
        {
            if(!first)
            {
                builder.append(
                        " y "
                );
            }

            first =
                    false;

            builder.append(
                    entry.getValue()
            );

            builder.append(
                    " "
            );

            builder.append(
                    safeName(
                            names.get(
                                    entry.getKey()
                            ),
                            entry.getKey()
                    )
            );
        }

        builder.append(
                "."
        );

        return builder.toString();
    }

    private static String safeName(
            String name,
            int baseItemId)
    {
        if(name == null
                || name.trim()
                        .isEmpty())
        {
            return "furni #"
                    + baseItemId;
        }

        return name.trim();
    }

    private static short checkedShort(
            int value)
    {
        if(value < Short.MIN_VALUE
                || value > Short.MAX_VALUE)
        {
            throw new IllegalArgumentException(
                    "Coordenada fuera de rango."
            );
        }

        return (short)value;
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

    private static int snapRotation(
            int desiredRotation,
            int maximumRotations)
    {
        int desired =
                normalizeRotation(
                        desiredRotation
                );

        if(maximumRotations >= 8)
        {
            return desired;
        }

        if(maximumRotations <= 1)
        {
            return 0;
        }

        double step =
                8.0D
                        / maximumRotations;

        int snapped =
                (int)Math.round(
                        Math.round(
                                desired / step
                        ) * step
                );

        return normalizeRotation(
                snapped
        );
    }

    private static double roundZ(
            double value)
    {
        return Math.round(
                value * 1000000.0D
        ) / 1000000.0D;
    }

    private static final class Source
    {
        private final int baseItemId;
        private final String baseItemName;
        private final short x;
        private final short y;
        private final double z;
        private final int rotation;
        private final int maxRotations;
        private final String extraData;
        private final int layerId;
        private final boolean traversable;

        private Source(
                HabboItem item,
                int layerId,
                boolean traversable)
        {
            this.baseItemId =
                    item.getBaseItem()
                            .getId();

            this.baseItemName =
                    item.getBaseItem()
                            .getName();

            this.x =
                    item.getX();

            this.y =
                    item.getY();

            this.z =
                    roundZ(
                            item.getZ()
                    );

            this.rotation =
                    normalizeRotation(
                            item.getRotation()
                    );

            this.maxRotations =
                    Math.max(
                            1,
                            item.getMaximumRotations()
                    );

            this.extraData =
                    item.getExtradata() == null
                            ? ""
                            : item.getExtradata();

            this.layerId =
                    layerId;

            this.traversable =
                    traversable;
        }
    }

    private static final class Target
    {
        private final HabboItem item;
        private final short x;
        private final short y;
        private final double z;
        private final int rotation;
        private final String extraData;
        private final String originalExtraData;
        private final int layerId;
        private final boolean traversable;
        private final int baseItemId;

        private Target(
                HabboItem item,
                short x,
                short y,
                double z,
                int rotation,
                String extraData,
                int layerId,
                boolean traversable,
                int baseItemId)
        {
            this.item =
                    item;

            this.x =
                    x;

            this.y =
                    y;

            this.z =
                    roundZ(
                            z
                    );

            this.rotation =
                    normalizeRotation(
                            rotation
                    );

            this.extraData =
                    extraData == null
                            ? ""
                            : extraData;

            this.originalExtraData =
                    item.getExtradata() == null
                            ? ""
                            : item.getExtradata();

            this.layerId =
                    layerId;

            this.traversable =
                    traversable;

            this.baseItemId =
                    baseItemId;
        }
    }

    public static final class PreviewEntry
    {
        public final int baseItemId;
        public final int x;
        public final int y;
        public final double z;
        public final int rotation;
        public final String extraData;

        private PreviewEntry(
                int baseItemId,
                int x,
                int y,
                double z,
                int rotation,
                String extraData)
        {
            this.baseItemId =
                    baseItemId;

            this.x =
                    x;

            this.y =
                    y;

            this.z =
                    roundZ(
                            z
                    );

            this.rotation =
                    normalizeRotation(
                            rotation
                    );

            this.extraData =
                    extraData == null
                            ? ""
                            : extraData;
        }
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final int copies;
        public final int placedCount;
        public final List<PreviewEntry> previewEntries;
        public final List<Integer> itemIds;

        private Result(
                boolean success,
                int code,
                String message,
                int copies,
                List<PreviewEntry> previewEntries,
                List<Integer> itemIds)
        {
            this.success =
                    success;

            this.code =
                    code;

            this.message =
                    message;

            this.copies =
                    copies;

            this.previewEntries =
                    Collections.unmodifiableList(
                            new ArrayList<PreviewEntry>(
                                    previewEntries
                            )
                    );

            this.itemIds =
                    Collections.unmodifiableList(
                            new ArrayList<Integer>(
                                    itemIds
                            )
                    );

            this.placedCount =
                    this.itemIds.size();
        }

        public static Result preview(
                int copies,
                List<PreviewEntry> previewEntries)
        {
            return new Result(
                    true,
                    0,
                    "OK",
                    copies,
                    previewEntries,
                    Collections.<Integer>emptyList()
            );
        }

        public static Result execute(
                int copies,
                List<PreviewEntry> previewEntries,
                List<Integer> itemIds)
        {
            return new Result(
                    true,
                    0,
                    "OK",
                    copies,
                    previewEntries,
                    itemIds
            );
        }

        public static Result failure(
                int code,
                String message,
                int copies)
        {
            return new Result(
                    false,
                    code,
                    message,
                    copies,
                    Collections.<PreviewEntry>emptyList(),
                    Collections.<Integer>emptyList()
            );
        }
    }
}
