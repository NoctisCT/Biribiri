package com.retro.builderpro;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionStackHelper;
import com.eu.habbo.habbohotel.items.interactions.InteractionTileWalkMagic;
import com.eu.habbo.habbohotel.rooms.FurnitureMovementError;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomLayout;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.rooms.RoomTileState;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;
import com.eu.habbo.messages.outgoing.rooms.items.FloorItemUpdateComposer;
import gnu.trove.set.hash.THashSet;

import java.awt.Rectangle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class GroupOffsetService
{
    public static final int MAX_GROUP_SIZE = Room.MAXIMUM_FURNI;

    private static final double EPSILON = 0.000001D;

    private static final int DIRECT_UPDATE_LIMIT = 100;
    private static final int UPDATE_CHUNK_SIZE = 50;
    private static final long UPDATE_CHUNK_DELAY_MS = 25L;

    private GroupOffsetService()
    {
    }

    public static Result offset(
            Habbo actor,
            List<Integer> requestedIds,
            int deltaX,
            int deltaY,
            int deltaZMillis,
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

        if(requestedIds == null
                || requestedIds.isEmpty())
        {
            return Result.failure(
                    4,
                    "La seleccion esta vacia."
            );
        }

        LinkedHashSet<Integer> uniqueIds =
                new LinkedHashSet<Integer>(
                        requestedIds
                );

        if(uniqueIds.size() != requestedIds.size())
        {
            return Result.failure(
                    5,
                    "La seleccion contiene IDs duplicados."
            );
        }

        if(uniqueIds.size() > MAX_GROUP_SIZE)
        {
            return Result.failure(
                    5,
                    "La seleccion supera el limite de Builder Pro."
            );
        }

        if(deltaX == 0
                && deltaY == 0
                && deltaZMillis == 0)
        {
            return Result.failure(
                    6,
                    "El offset es cero."
            );
        }

        if(deltaZMillis < -40000
                || deltaZMillis > 40000)
        {
            return Result.failure(
                    6,
                    "El offset Z es demasiado grande."
            );
        }

        List<Snapshot> snapshots =
                new ArrayList<Snapshot>();

        Set<Integer> selectedIds =
                new HashSet<Integer>();

        for(Integer id : uniqueIds)
        {
            if(id == null)
            {
                return Result.failure(
                        7,
                        "La seleccion contiene un ID invalido."
                );
            }

            HabboItem item =
                    room.getHabboItem(
                            id.intValue()
                    );

            if(item == null)
            {
                return Result.failure(
                        8,
                        "Uno de los furnis ya no existe en la sala."
                );
            }

            if(item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR)
            {
                return Result.failure(
                        9,
                        "Builder Pro solo admite furnis de suelo."
                );
            }

            if(item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return Result.failure(
                        10,
                        "Builder Pro no desplaza baldosas de arquitecto."
                );
            }

            Snapshot snapshot =
                    new Snapshot(
                            item
                    );

            snapshots.add(
                    snapshot
            );

            selectedIds.add(
                    item.getId()
            );
        }

        RoomLayout layout =
                room.getLayout();

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        List<Target> targets =
                new ArrayList<Target>();

        double deltaZ =
                deltaZMillis / 1000.0D;

        for(Snapshot snapshot : snapshots)
        {
            addFootprint(
                    layout,
                    snapshot.x,
                    snapshot.y,
                    snapshot.item,
                    snapshot.rotation,
                    affectedTiles
            );

            long rawX =
                    (long)snapshot.x
                            + (long)deltaX;

            long rawY =
                    (long)snapshot.y
                            + (long)deltaY;

            if(rawX < Short.MIN_VALUE
                    || rawX > Short.MAX_VALUE
                    || rawY < Short.MIN_VALUE
                    || rawY > Short.MAX_VALUE)
            {
                return Result.failure(
                        11,
                        "El destino queda fuera del rango de coordenadas."
                );
            }

            short targetX =
                    (short)rawX;

            short targetY =
                    (short)rawY;

            double targetZ =
                    roundZ(
                            snapshot.z
                                    + deltaZ
                    );

            if(targetZ > Room.MAXIMUM_FURNI_HEIGHT
                    || targetZ < -9999.0D)
            {
                return Result.failure(
                        12,
                        "La altura destino queda fuera del rango admitido."
                );
            }

            Target target =
                    new Target(
                            snapshot,
                            targetX,
                            targetY,
                            targetZ
                    );

            Result validation =
                    validateTarget(
                            room,
                            target,
                            selectedIds,
                            affectedTiles
                    );

            if(!validation.success)
            {
                return validation;
            }

            targets.add(
                    target
            );
        }

        targets.sort(
                Comparator.comparingInt(
                        target ->
                                target.snapshot
                                        .item
                                        .getId()
                )
        );

        Map<Integer, Double> forcedHeights =
                new HashMap<Integer, Double>();

        for(Target target : targets)
        {
            forcedHeights.put(
                    target.snapshot.item.getId(),
                    target.z
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        int affectedCount = 0;

        boolean deferredUpdates =
                targets.size() > DIRECT_UPDATE_LIMIT;

        BuilderProContext.begin(
                actorId,
                forcedHeights
        );

        try
        {
            System.out.println(
                    "[BuilderProTrace] SERVER OFFSET_BEGIN #"
                            + requestId
                            + " dx="
                            + deltaX
                            + " dy="
                            + deltaY
                            + " dz="
                            + deltaZ
                            + " items="
                            + targets.size()
            );

            for(Target target : targets)
            {
                RoomTile destination =
                        layout.getTile(
                                target.x,
                                target.y
                        );

                FurnitureMovementError error =
                        room.moveFurniTo(
                                target.snapshot.item,
                                destination,
                                target.snapshot.rotation,
                                actor,
                                !deferredUpdates,
                                true
                        );

                if(error != FurnitureMovementError.NONE)
                {
                    rollback(
                            room,
                            snapshots,
                            affectedTiles
                    );

                    return Result.failure(
                            20,
                            "Offset cancelado por el servidor: "
                                    + error.name()
                    );
                }

                HabboItem item =
                        target.snapshot.item;

                if(item.getX() != target.x
                        || item.getY() != target.y
                        || Math.abs(
                                item.getZ() - target.z
                        ) > EPSILON
                        || normalizeRotation(
                                item.getRotation()
                        ) != normalizeRotation(
                                target.snapshot.rotation
                        ))
                {
                    rollback(
                            room,
                            snapshots,
                            affectedTiles
                    );

                    return Result.failure(
                            21,
                            "El servidor altero la geometria exacta del offset."
                    );
                }

                affectedCount++;
            }

            refreshAffectedTiles(
                    room,
                    affectedTiles
            );

            if(deferredUpdates)
            {
                List<HabboItem> changedItems =
                        new ArrayList<HabboItem>(
                                targets.size()
                        );

                for(Target target : targets)
                {
                    changedItems.add(
                            target.snapshot.item
                    );
                }

                scheduleDeferredUpdates(
                        room,
                        changedItems
                );
            }

            System.out.println(
                    "[BuilderProTrace] SERVER OFFSET_END #"
                            + requestId
                            + " affected="
                            + affectedCount
            );

            return Result.success(
                    affectedCount
            );
        }
        catch(Exception exception)
        {
            System.out.println(
                    "[BuilderProTrace] SERVER OFFSET_EXCEPTION #"
                            + requestId
                            + " "
                            + exception.getClass()
                                    .getName()
                            + ": "
                            + exception.getMessage()
            );

            rollback(
                    room,
                    snapshots,
                    affectedTiles
            );

            return Result.failure(
                    22,
                    "El offset fue revertido por un error interno."
            );
        }
        finally
        {
            BuilderProContext.clear();
        }
    }

    private static Result validateTarget(
            Room room,
            Target target,
            Set<Integer> selectedIds,
            THashSet<RoomTile> affectedTiles)
    {
        RoomLayout layout =
                room.getLayout();

        HabboItem item =
                target.snapshot.item;

        RoomTile anchor =
                layout.getTile(
                        target.x,
                        target.y
                );

        if(anchor == null)
        {
            return Result.failure(
                    13,
                    "El destino queda fuera del mapa."
            );
        }

        if(!layout.fitsOnMap(
                anchor,
                item.getBaseItem().getWidth(),
                item.getBaseItem().getLength(),
                target.snapshot.rotation))
        {
            return Result.failure(
                    13,
                    "Un furni no cabe dentro del mapa."
            );
        }

        Rectangle rectangle =
                RoomLayout.getRectangle(
                        target.x,
                        target.y,
                        item.getBaseItem().getWidth(),
                        item.getBaseItem().getLength(),
                        target.snapshot.rotation
                );

        double movingBottom =
                target.z;

        double movingTop =
                target.z
                        + Item.getCurrentHeight(
                                item
                        );

        for(int x = rectangle.x;
                x < rectangle.x
                        + rectangle.width;
                x++)
        {
            for(int y = rectangle.y;
                    y < rectangle.y
                            + rectangle.height;
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
                            14,
                            "El destino contiene tiles invalidos."
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
                            15,
                            "Un furni quedaria por debajo del suelo."
                    );
                }

                if(room.hasHabbosAt(x, y)
                        || room.hasBotsAt(x, y)
                        || room.hasPetsAt(x, y))
                {
                    return Result.failure(
                            16,
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

                    if(selectedIds.contains(
                            existing.getId()))
                    {
                        continue;
                    }

                    if(existing.getBaseItem() == null)
                    {
                        return Result.failure(
                                17,
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
                                17,
                                "El offset colisiona con un furni externo."
                        );
                    }
                }
            }
        }

        addFootprint(
                layout,
                target.x,
                target.y,
                item,
                target.snapshot.rotation,
                affectedTiles
        );

        return Result.success(0);
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
                px < rectangle.x
                        + rectangle.width;
                px++)
        {
            for(int py = rectangle.y;
                    py < rectangle.y
                            + rectangle.height;
                    py++)
            {
                RoomTile tile =
                        layout.getTile(
                                (short)px,
                                (short)py
                        );

                if(tile != null)
                {
                    output.add(
                            tile
                    );
                }
            }
        }
    }

    private static void rollback(
            Room room,
            List<Snapshot> snapshots,
            THashSet<RoomTile> affectedTiles)
    {
        for(Snapshot snapshot : snapshots)
        {
            HabboItem item =
                    snapshot.item;

            item.setX(snapshot.x);
            item.setY(snapshot.y);
            item.setZ(snapshot.z);
            item.setRotation(
                    snapshot.rotation
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

    private static void scheduleDeferredUpdates(
            Room room,
            List<HabboItem> items)
    {
        for(int offset = 0;
                offset < items.size();
                offset += UPDATE_CHUNK_SIZE)
        {
            int end =
                    Math.min(
                            items.size(),
                            offset + UPDATE_CHUNK_SIZE
                    );

            List<HabboItem> chunk =
                    new ArrayList<HabboItem>(
                            end - offset
                    );

            for(int index = offset;
                    index < end;
                    index++)
            {
                chunk.add(
                        items.get(index)
                );
            }

            long delay =
                    (long)(offset / UPDATE_CHUNK_SIZE)
                            * UPDATE_CHUNK_DELAY_MS;

            Emulator.getThreading().run(
                    () ->
                    {
                        for(HabboItem item : chunk)
                        {
                            if(item != null
                                    && room.getHabboItem(
                                            item.getId()
                                    ) == item)
                            {
                                room.sendComposer(
                                        new FloorItemUpdateComposer(
                                                item
                                        ).compose()
                                );
                            }
                        }
                    },
                    delay
            );
        }
    }

    private static int normalizeRotation(
            int rotation)
    {
        return (
                (
                    rotation % 8
                ) + 8
        ) % 8;
    }

    private static double roundZ(
            double value)
    {
        return Math.round(
                value * 1000000.0D
        ) / 1000000.0D;
    }

    private static final class Snapshot
    {
        private final HabboItem item;
        private final short x;
        private final short y;
        private final double z;
        private final int rotation;

        private Snapshot(
                HabboItem item)
        {
            this.item = item;
            this.x = item.getX();
            this.y = item.getY();
            this.z = item.getZ();
            this.rotation =
                    item.getRotation();
        }
    }

    private static final class Target
    {
        private final Snapshot snapshot;
        private final short x;
        private final short y;
        private final double z;

        private Target(
                Snapshot snapshot,
                short x,
                short y,
                double z)
        {
            this.snapshot = snapshot;
            this.x = x;
            this.y = y;
            this.z = z;
        }
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final int affectedCount;

        private Result(
                boolean success,
                int code,
                String message,
                int affectedCount)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.affectedCount =
                    affectedCount;
        }

        public static Result success(
                int affectedCount)
        {
            return new Result(
                    true,
                    0,
                    "OK",
                    affectedCount
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
                    0
            );
        }
    }
}
