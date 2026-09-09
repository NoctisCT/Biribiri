package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionJukeBox;
import com.eu.habbo.habbohotel.items.interactions.InteractionMoodLight;
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
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public final class PasteGroupService
{
    public static final int MAX_GROUP_SIZE =
            CopyGroupService.MAX_GROUP_SIZE;

    private static final double EPSILON =
            0.000001D;

    private PasteGroupService()
    {
    }

    public static Result paste(
            Habbo actor,
            int anchorX,
            int anchorY,
            int requestId)
    {
        if(actor == null)
        {
            return Result.failure(
                    1,
                    "Usuario no disponible."
            );
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return Result.failure(
                    2,
                    "No hay una sala activa."
            );
        }

        if(!room.hasRights(actor))
        {
            return Result.failure(
                    3,
                    "No tienes permisos de construccion en esta sala."
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        CopyGroupService.Clipboard clipboard =
                CopyGroupService.getClipboard(
                        actorId
                );

        if(clipboard == null
                || clipboard.getEntries() == null
                || clipboard.getEntries().isEmpty())
        {
            return Result.failure(
                    4,
                    "No hay una copia activa."
            );
        }

        if(clipboard.size() > MAX_GROUP_SIZE)
        {
            return Result.failure(
                    5,
                    "La copia supera el limite de Builder Pro."
            );
        }

        if(room.itemCount() + clipboard.size()
                > Room.MAXIMUM_FURNI)
        {
            return Result.failure(
                    6,
                    "La sala alcanzaria el limite de furnis."
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

        for(HabboItem item : inventoryItems)
        {
            if(item == null
                    || item.getBaseItem() == null
                    || item.getRoomId() != 0)
            {
                continue;
            }

            int baseItemId =
                    item.getBaseItem()
                            .getId();

            List<HabboItem> items =
                    availableByBase.get(
                            baseItemId
                    );

            if(items == null)
            {
                items =
                        new ArrayList<HabboItem>();

                availableByBase.put(
                        baseItemId,
                        items
                );
            }

            items.add(item);
        }

        Map<Integer, Integer> cursors =
                new HashMap<Integer, Integer>();

        Map<Integer, Integer> missing =
                new LinkedHashMap<Integer, Integer>();

        Map<Integer, String> names =
                new LinkedHashMap<Integer, String>();

        List<Target> targets =
                new ArrayList<Target>();

        for(CopyGroupService.Entry entry
                : clipboard.getEntries())
        {
            int baseItemId =
                    entry.getBaseItemId();

            names.put(
                    baseItemId,
                    safeName(
                            entry.getBaseItemName(),
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

            HabboItem item =
                    candidates.get(cursor);

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
                                anchorX
                                        + entry.getOffsetX()
                        );

                targetY =
                        checkedShort(
                                anchorY
                                        + entry.getOffsetY()
                        );
            }
            catch(IllegalArgumentException exception)
            {
                return Result.failure(
                        8,
                        "La copia queda fuera del rango de coordenadas."
                );
            }

            double targetZ =
                    roundZ(
                            clipboard.getSourceOriginZ()
                                    + entry.getOffsetZ()
                    );

            targets.add(
                    new Target(
                            item,
                            targetX,
                            targetY,
                            targetZ,
                            normalizeRotation(
                                    entry.getRotation()
                            )
                    )
            );
        }

        if(!missing.isEmpty())
        {
            return Result.failure(
                    7,
                    formatMissing(
                            missing,
                            names
                    )
            );
        }

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        Result specialValidation =
                validateSpecialItems(
                        room,
                        targets
                );

        if(!specialValidation.success)
        {
            return specialValidation;
        }

        for(Target target : targets)
        {
            Result validation =
                    validateTarget(
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
                    target.z
            );
        }

        List<Target> placed =
                new ArrayList<Target>();

        BuilderProContext.begin(
                actorId,
                forcedHeights
        );

        try
        {
            System.out.println(
                    "[BuilderProTrace] SERVER PASTE_BEGIN #"
                            + requestId
                            + " items="
                            + targets.size()
                            + " anchor="
                            + anchorX
                            + ","
                            + anchorY
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

                    return Result.failure(
                            20,
                            "Pegado cancelado por el servidor: "
                                    + error.name()
                    );
                }

                placed.add(target);

                HabboItem item =
                        target.item;

                if(item.getRoomId() != room.getId()
                        || item.getX() != target.x
                        || item.getY() != target.y
                        || Math.abs(
                                item.getZ() - target.z
                        ) > EPSILON
                        || normalizeRotation(
                                item.getRotation()
                        ) != target.rotation)
                {
                    rollbackPlaced(
                            room,
                            placed,
                            affectedTiles
                    );

                    return Result.failure(
                            21,
                            "El servidor altero la geometria exacta del pegado."
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

                        return Result.failure(
                                22,
                                "El inventario cambio durante el pegado."
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

            List<Integer> placedIds =
                    new ArrayList<Integer>();

            for(Target target : targets)
            {
                placedIds.add(
                        target.item.getId()
                );
            }

            System.out.println(
                    "[BuilderProTrace] SERVER PASTE_END #"
                            + requestId
                            + " placed="
                            + placedIds.size()
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
                            "[BuilderProTrace] PASTE inventory notify failed item="
                                    + target.item.getId()
                    );
                }

                target.item.setFromGift(false);
            }

            return Result.success(
                    placedIds
            );
        }
        catch(Exception exception)
        {
            System.out.println(
                    "[BuilderProTrace] SERVER PASTE_EXCEPTION #"
                            + requestId
                            + " "
                            + exception.getClass()
                                    .getName()
                            + ": "
                            + exception.getMessage()
            );

            rollbackPlaced(
                    room,
                    placed,
                    affectedTiles
            );

            return Result.failure(
                    23,
                    "El pegado fue revertido por un error interno."
            );
        }
        finally
        {
            BuilderProContext.clear();
        }
    }

    private static Result validateSpecialItems(
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
                return Result.failure(
                        18,
                        "La sala no admite otro regulador de ambiente."
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
                        19,
                        "La sala no admite otro jukebox."
                );
            }
        }

        return Result.success(
                Collections.<Integer>emptyList()
        );
    }

    private static Result validateTarget(
            Room room,
            Target target,
            THashSet<RoomTile> affectedTiles)
    {
        RoomLayout layout =
                room.getLayout();

        HabboItem item =
                target.item;

        if(item == null
                || item.getBaseItem() == null)
        {
            return Result.failure(
                    9,
                    "El inventario contiene un furni invalido."
            );
        }

        if(target.z > Room.MAXIMUM_FURNI_HEIGHT
                || target.z < -9999.0D)
        {
            return Result.failure(
                    10,
                    "La altura destino queda fuera del rango admitido."
            );
        }

        RoomTile anchor =
                layout.getTile(
                        target.x,
                        target.y
                );

        if(anchor == null)
        {
            return Result.failure(
                    11,
                    "El destino queda fuera del mapa."
            );
        }

        if(!layout.fitsOnMap(
                anchor,
                item.getBaseItem()
                        .getWidth(),
                item.getBaseItem()
                        .getLength(),
                target.rotation))
        {
            return Result.failure(
                    11,
                    "Un furni no cabe dentro del mapa."
            );
        }

        Rectangle destination =
                RoomLayout.getRectangle(
                        target.x,
                        target.y,
                        item.getBaseItem()
                                .getWidth(),
                        item.getBaseItem()
                                .getLength(),
                        target.rotation
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
                            12,
                            "El pegado pisaria tiles invalidos."
                    );
                }

                affectedTiles.add(tile);

                if(target.z
                        < layout.getHeightAtSquare(
                                x,
                                y
                        ))
                {
                    return Result.failure(
                            13,
                            "Un furni quedaria por debajo del suelo."
                    );
                }

                if(room.hasHabbosAt(x, y)
                        || room.hasBotsAt(x, y)
                        || room.hasPetsAt(x, y))
                {
                    return Result.failure(
                            14,
                            "Hay una unidad ocupando el volumen destino."
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
                        return Result.failure(
                                15,
                                "El destino contiene un furni externo invalido."
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
                                15,
                                "El pegado colisiona con un furni externo."
                        );
                    }
                }
            }
        }

        return Result.success(
                Collections.<Integer>emptyList()
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
                    placed.get(index);

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

                    item.setRoomId(0);
                    item.needsUpdate(true);

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
                        "[BuilderProTrace] PASTE_ROLLBACK_ERROR item="
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

    private static String formatMissing(
            Map<Integer, Integer> missing,
            Map<Integer, String> names)
    {
        StringBuilder builder =
                new StringBuilder(
                        "Faltan "
                );

        boolean first = true;

        for(Map.Entry<Integer, Integer> entry
                : missing.entrySet())
        {
            if(!first)
            {
                builder.append(
                        " y "
                );
            }

            first = false;

            String name =
                    names.get(
                            entry.getKey()
                    );

            builder.append(
                    entry.getValue()
            );

            builder.append(
                    " "
            );

            builder.append(
                    safeName(
                            name,
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
                || name.trim().isEmpty())
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

    private static final class Target
    {
        private final HabboItem item;
        private final short x;
        private final short y;
        private final double z;
        private final int rotation;

        private Target(
                HabboItem item,
                short x,
                short y,
                double z,
                int rotation)
        {
            this.item = item;
            this.x = x;
            this.y = y;
            this.z = z;
            this.rotation =
                    normalizeRotation(
                            rotation
                    );
        }
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final int placedCount;
        public final List<Integer> itemIds;

        private Result(
                boolean success,
                int code,
                String message,
                List<Integer> itemIds)
        {
            this.success = success;
            this.code = code;
            this.message = message;

            this.itemIds =
                    Collections.unmodifiableList(
                            new ArrayList<Integer>(
                                    itemIds
                            )
                    );

            this.placedCount =
                    this.itemIds.size();
        }

        public static Result success(
                List<Integer> itemIds)
        {
            return new Result(
                    true,
                    0,
                    "OK",
                    itemIds
            );
        }

        public static Result failure(
                int code,
                String message)
        {
            return new Result(
                    false,
                    code,
                    message,
                    Collections.<Integer>emptyList()
            );
        }
    }
}
