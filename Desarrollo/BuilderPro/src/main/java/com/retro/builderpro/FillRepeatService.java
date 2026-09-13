package com.retro.builderpro;

import com.eu.habbo.Emulator;
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
import com.eu.habbo.messages.outgoing.rooms.items.AddFloorItemComposer;
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

public final class FillRepeatService
{
    public static final int OP_PREVIEW = 0;
    public static final int OP_EXECUTE = 1;

    public static final int MODE_LINE = 1;
    public static final int MODE_AREA = 2;

    public static final int DIRECTION_LEFT = 1;
    public static final int DIRECTION_RIGHT = 2;
    public static final int DIRECTION_UP = 3;
    public static final int DIRECTION_DOWN = 4;

    public static final int MAX_SPACING = 50;
    public static final int MAX_TOTAL_ITEMS =
            CopyGroupService.MAX_GROUP_SIZE;

    private static final double EPSILON =
            0.000001D;

    private FillRepeatService()
    {
    }

    public static Result process(
            Habbo actor,
            List<Integer> requestedIds,
            int operation,
            int mode,
            int direction,
            int spacing,
            int requestId)
    {
        int copies = 0;

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
                    "Operacion de relleno invalida.",
                    copies
            );
        }

        if(mode != MODE_LINE
                && mode != MODE_AREA)
        {
            return Result.failure(
                    5,
                    "Modo de relleno invalido.",
                    copies
            );
        }

        if(mode == MODE_LINE
                && (direction < DIRECTION_LEFT
                    || direction > DIRECTION_DOWN))
        {
            return Result.failure(
                    6,
                    "Direccion de relleno invalida.",
                    copies
            );
        }

        if(spacing < 0
                || spacing > MAX_SPACING)
        {
            return Result.failure(
                    7,
                    "La separacion no es valida.",
                    copies
            );
        }

        if(requestedIds == null
                || requestedIds.isEmpty())
        {
            return Result.failure(
                    8,
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
                    9,
                    "La seleccion contiene IDs duplicados.",
                    copies
            );
        }

        if(uniqueIds.size()
                > CopyGroupService.MAX_GROUP_SIZE)
        {
            return Result.failure(
                    10,
                    "La seleccion supera el limite de Builder Pro.",
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
                        "El relleno solo admite furnis de suelo.",
                        copies
                );
            }

            if(item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return Result.failure(
                        15,
                        "El relleno no admite baldosas de arquitecto.",
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

        int stepX =
                structureWidth + spacing;

        int stepY =
                structureHeight + spacing;

        List<Offset> offsets =
                new ArrayList<Offset>();

        if(mode == MODE_LINE)
        {
            int directionStepX = 0;
            int directionStepY = 0;

            if(direction == DIRECTION_LEFT)
            {
                directionStepX =
                        -stepX;
            }
            else if(direction == DIRECTION_RIGHT)
            {
                directionStepX =
                        stepX;
            }
            else if(direction == DIRECTION_UP)
            {
                directionStepY =
                        -stepY;
            }
            else
            {
                directionStepY =
                        stepY;
            }

            int maxAttempts =
                    Math.max(
                            room.getLayout()
                                    .getMapSizeX(),
                            room.getLayout()
                                    .getMapSizeY()
                    ) + 2;

            for(int index = 1;
                    index <= maxAttempts;
                    index++)
            {
                int offsetX =
                        directionStepX * index;

                int offsetY =
                        directionStepY * index;

                if(!canPlanModule(
                        room,
                        sources,
                        offsetX,
                        offsetY))
                {
                    break;
                }

                offsets.add(
                        new Offset(
                                offsetX,
                                offsetY
                        )
                );
            }
        }
        else
        {
            RoomLayout layout =
                    room.getLayout();

            int minColumn =
                    -Math.floorDiv(
                            minimumX,
                            stepX
                    );

            int maxColumn =
                    Math.floorDiv(
                            layout.getMapSizeX()
                                    - maximumXExclusive,
                            stepX
                    );

            int minRow =
                    -Math.floorDiv(
                            minimumY,
                            stepY
                    );

            int maxRow =
                    Math.floorDiv(
                            layout.getMapSizeY()
                                    - maximumYExclusive,
                            stepY
                    );

            for(int row = minRow;
                    row <= maxRow;
                    row++)
            {
                for(int column = minColumn;
                        column <= maxColumn;
                        column++)
                {
                    if(column == 0
                            && row == 0)
                    {
                        continue;
                    }

                    int offsetX =
                            column * stepX;

                    int offsetY =
                            row * stepY;

                    if(!canPlanModule(
                            room,
                            sources,
                            offsetX,
                            offsetY))
                    {
                        continue;
                    }

                    offsets.add(
                            new Offset(
                                    offsetX,
                                    offsetY
                            )
                    );
                }
            }
        }

        copies =
                offsets.size();

        if(copies < 1)
        {
            return Result.failure(
                    11,
                    mode == MODE_LINE
                            ? "No hay espacio adicional en esa direccion."
                            : "No hay posiciones adicionales validas para rellenar.",
                    copies
            );
        }

        long totalItemsLong =
                (long)uniqueIds.size()
                        * (long)copies;

        if(totalItemsLong > MAX_TOTAL_ITEMS)
        {
            return Result.failure(
                    12,
                    "El relleno necesita "
                            + totalItemsLong
                            + " furnis nuevos y supera el limite actual de Builder Pro.",
                    copies
            );
        }

        int totalItems =
                (int)totalItemsLong;

        if(room.itemCount() + totalItems
                > Room.MAXIMUM_FURNI)
        {
            return Result.failure(
                    13,
                    "La sala alcanzaria el limite de furnis.",
                    copies
            );
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

        for(Offset offset : offsets)
        {
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
                                    source.x
                                            + offset.x
                            );

                    targetY =
                            checkedShort(
                                    source.y
                                            + offset.y
                            );
                }
                catch(IllegalArgumentException exception)
                {
                    return Result.failure(
                            18,
                            "Una posicion queda fuera del rango de coordenadas.",
                            copies
                    );
                }

                targets.add(
                        new Target(
                                targetItem,
                                targetX,
                                targetY,
                                source.z,
                                source.rotation,
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
                    "[BuilderProTrace] SERVER FILL_REPEAT_BEGIN #"
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
                            "Relleno cancelado por el servidor: "
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

            /*
             * placeFloorFurniAt() emite altas individuales. En rellenos grandes,
             * Nitro puede dejar parte de esas altas pendientes y Builder Pro
             * recibe el resultado antes de que todos los RoomObjects existan.
             *
             * El servidor ya ha completado la operación en este punto. Para el
             * actor que ejecutó Builder Pro forzamos una resincronización
             * autoritativa solo de cliente: quitamos la representación local de
             * los IDs recién creados y enviamos un único lote con todos ellos.
             * No se elimina ningún furni del Room del servidor.
             */
            try
            {
                sendAuthoritativeRoomBatch(
                        actor,
                        room,
                        targets
                );
            }
            catch(Exception syncError)
            {
                System.out.println(
                        "[BuilderProTrace] FILL_REPEAT authoritative sync failed: "
                                + syncError.getClass().getName()
                                + ": "
                                + syncError.getMessage()
                );
            }

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
                            "[BuilderProTrace] FILL_REPEAT inventory notify failed item="
                                    + target.item.getId()
                    );
                }

                target.item.setFromGift(
                        false
                );
            }

            System.out.println(
                    "[BuilderProTrace] SERVER FILL_REPEAT_END #"
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
                    "[BuilderProTrace] SERVER FILL_REPEAT_EXCEPTION #"
                            + requestId
                            + " "
                            + exception.getClass()
                                    .getName()
                            + ": "
                            + exception.getMessage()
            );

            return Result.failure(
                    31,
                    "El relleno fue revertido por un error interno.",
                    copies
            );
        }
        finally
        {
            BuilderProContext.clear();
        }
    }

    private static boolean canPlanModule(
            Room room,
            List<Source> sources,
            int offsetX,
            int offsetY)
    {
        RoomLayout layout =
                room.getLayout();

        for(Source source : sources)
        {
            int targetX =
                    source.x + offsetX;

            int targetY =
                    source.y + offsetY;

            if(targetX < Short.MIN_VALUE
                    || targetX > Short.MAX_VALUE
                    || targetY < Short.MIN_VALUE
                    || targetY > Short.MAX_VALUE)
            {
                return false;
            }

            RoomTile anchor =
                    layout.getTile(
                            (short)targetX,
                            (short)targetY
                    );

            if(anchor == null
                    || !layout.fitsOnMap(
                            anchor,
                            source.width,
                            source.length,
                            source.rotation))
            {
                return false;
            }

            Rectangle destination =
                    RoomLayout.getRectangle(
                            targetX,
                            targetY,
                            source.width,
                            source.length,
                            source.rotation
                    );

            double movingBottom =
                    source.z;

            double movingTop =
                    source.z
                            + source.height;

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
                        return false;
                    }

                    if(source.z
                            < layout.getHeightAtSquare(
                                    x,
                                    y
                            ))
                    {
                        return false;
                    }

                    if(room.hasHabbosAt(x, y)
                            || room.hasBotsAt(x, y)
                            || room.hasPetsAt(x, y))
                    {
                        return false;
                    }

                    for(HabboItem existing :
                            room.getItemsAt(
                                    tile
                            ))
                    {
                        if(existing == null
                                || existing.getBaseItem()
                                == null)
                        {
                            if(existing != null)
                            {
                                return false;
                            }

                            continue;
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
                            return false;
                        }
                    }
                }
            }
        }

        return true;
    }

    private static void sendAuthoritativeRoomBatch(
            Habbo actor,
            Room room,
            List<Target> targets)
    {
        if(actor == null
                || actor.getClient() == null
                || room == null
                || targets == null
                || targets.isEmpty())
        {
            return;
        }

        THashSet<HabboItem> currentTargets =
                new THashSet<HabboItem>();

        List<Integer> currentTargetIds =
                new ArrayList<Integer>(
                        targets.size()
                );

        for(Target target : targets)
        {
            if(target == null
                    || target.item == null)
            {
                throw new IllegalStateException(
                        "Hay un furni invalido durante la resincronizacion."
                );
            }

            HabboItem current =
                    room.getHabboItem(
                            target.item.getId()
                    );

            if(current == null)
            {
                throw new IllegalStateException(
                        "Falta un furni del relleno durante la resincronizacion."
                );
            }

            currentTargets.add(
                    current
            );

            currentTargetIds.add(
                    current.getId()
            );
        }

        if(currentTargets.size()
                != targets.size()
                || currentTargetIds.size()
                != targets.size())
        {
            throw new IllegalStateException(
                    "La resincronizacion no contiene todos los furnis del relleno."
            );
        }

        /*
         * AUTHORITATIVE_SYNC_PACED
         *
         * No enviamos RemoveFloorItemComposer antes del resync.
         * Nitro elimina tambien el pending floor item al recibir un remove;
         * con rellenos grandes eso puede competir con la cola de altas.
         *
         * Primero reenviamos un lote autoritativo completo. Despues reforzamos
         * la sincronizacion con altas individuales, solo al actor de Builder Pro,
         * en pequenos bloques espaciados. Asi Nitro puede materializar la cola
         * sin recibir decenas de altas en el mismo instante.
         */
        actor.getClient()
                .sendResponse(
                        new RoomFloorItemsComposer(
                                room.getFurniOwnerNames(),
                                currentTargets
                        )
                );

        final int roomId =
                room.getId();

        final int chunkSize =
                8;

        final long initialDelayMs =
                75L;

        final long chunkDelayMs =
                75L;

        for(int offset = 0;
                offset < currentTargetIds.size();
                offset += chunkSize)
        {
            int end =
                    Math.min(
                            currentTargetIds.size(),
                            offset + chunkSize
                    );

            final List<Integer> chunkIds =
                    new ArrayList<Integer>(
                            currentTargetIds.subList(
                                    offset,
                                    end
                            )
                    );

            final long delay =
                    initialDelayMs
                            + (
                                (long)(offset / chunkSize)
                                * chunkDelayMs
                            );

            Emulator.getThreading().run(
                    () ->
                    {
                        if(actor.getClient() == null)
                        {
                            return;
                        }

                        Room liveRoom =
                                actor.getHabboInfo()
                                        .getCurrentRoom();

                        if(liveRoom == null
                                || liveRoom.getId()
                                != roomId)
                        {
                            return;
                        }

                        for(Integer itemId :
                                chunkIds)
                        {
                            if(itemId == null)
                            {
                                continue;
                            }

                            HabboItem liveItem =
                                    liveRoom.getHabboItem(
                                            itemId.intValue()
                                    );

                            if(liveItem == null)
                            {
                                continue;
                            }

                            actor.getClient()
                                    .sendResponse(
                                            new AddFloorItemComposer(
                                                    liveItem,
                                                    liveRoom.getFurniOwnerName(
                                                            liveItem.getUserId()
                                                    )
                                            )
                                    );
                        }
                    },
                    delay
            );
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
                                "Las piezas del relleno se solaparian entre si.",
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
                            "El relleno pisaria tiles invalidos.",
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
                                "El relleno colisiona con un furni existente.",
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
                        "[BuilderProTrace] FILL_REPEAT_ROLLBACK_ERROR item="
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

    private static double roundZ(
            double value)
    {
        return Math.round(
                value * 1000000.0D
        ) / 1000000.0D;
    }

    private static final class Offset
    {
        private final int x;
        private final int y;

        private Offset(
                int x,
                int y)
        {
            this.x = x;
            this.y = y;
        }
    }

    private static final class Source
    {
        private final int baseItemId;
        private final String baseItemName;
        private final short x;
        private final short y;
        private final double z;
        private final int rotation;
        private final String extraData;
        private final int layerId;
        private final boolean traversable;
        private final int width;
        private final int length;
        private final double height;

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

            this.extraData =
                    item.getExtradata() == null
                            ? ""
                            : item.getExtradata();

            this.layerId =
                    layerId;

            this.traversable =
                    traversable;

            this.width =
                    item.getBaseItem()
                            .getWidth();

            this.length =
                    item.getBaseItem()
                            .getLength();

            this.height =
                    Item.getCurrentHeight(
                            item
                    );
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
