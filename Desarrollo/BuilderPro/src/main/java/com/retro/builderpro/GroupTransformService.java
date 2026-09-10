package com.retro.builderpro;

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

public final class GroupTransformService
{
    public static final int MAX_GROUP_SIZE = 100;

    public static final int OP_HEIGHT = 1;
    public static final int OP_ROTATE_STRUCTURE = 2;
    public static final int OP_ORIENT = 3;
    public static final int OP_FLOOR = 4;

    private static final double EPSILON = 0.000001D;

    private GroupTransformService()
    {
    }

    public static Result transform(
            Habbo actor,
            List<Integer> requestedIds,
            int operation,
            int argument,
            List<Integer> requestedRotations,
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

        if(uniqueIds.size() > MAX_GROUP_SIZE)
        {
            return Result.failure(
                    5,
                    "La seleccion supera el limite de Builder Pro."
            );
        }

        if(operation == OP_HEIGHT)
        {
            if(argument == 0)
            {
                return Result.failure(
                        6,
                        "El desplazamiento Z es cero."
                );
            }

            if(Math.abs(argument) > 40000)
            {
                return Result.failure(
                        6,
                        "El desplazamiento Z es demasiado grande."
                );
            }
        }
        else if(operation == OP_FLOOR)
        {
            if(argument != 0)
            {
                return Result.failure(
                        6,
                        "Bajar al suelo no admite argumento."
                );
            }
        }
        else if(operation == OP_ROTATE_STRUCTURE
                || operation == OP_ORIENT)
        {
            if(argument != -1
                    && argument != 1)
            {
                return Result.failure(
                        6,
                        "La direccion de giro debe ser -1 o 1."
                );
            }
        }
        else
        {
            return Result.failure(
                    6,
                    "Transformacion desconocida."
            );
        }

        Map<Integer, Integer> exactOrientationTargets =
                new HashMap<Integer, Integer>();

        if(operation == OP_ORIENT)
        {
            if(requestedRotations == null
                    || requestedRotations.size()
                    != requestedIds.size())
            {
                return Result.failure(
                        18,
                        "No se recibieron todas las orientaciones exactas."
                );
            }

            if(uniqueIds.size()
                    != requestedIds.size())
            {
                return Result.failure(
                        18,
                        "La seleccion contiene IDs duplicados."
                );
            }

            for(int index = 0;
                    index < requestedIds.size();
                    index++)
            {
                Integer itemId =
                        requestedIds.get(index);

                Integer targetRotation =
                        requestedRotations.get(index);

                if(itemId == null
                        || targetRotation == null
                        || targetRotation < 0
                        || targetRotation > 7)
                {
                    return Result.failure(
                            18,
                            "Se recibio una orientacion invalida."
                    );
                }

                exactOrientationTargets.put(
                        itemId,
                        targetRotation
                );
            }
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
                        "Builder Pro solo transforma furnis de suelo."
                );
            }

            if(item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return Result.failure(
                        10,
                        "Builder Pro no transforma baldosas de arquitecto."
                );
            }

            if(item.getZ() > Room.MAXIMUM_FURNI_HEIGHT)
            {
                return Result.failure(
                        11,
                        "La seleccion contiene una altura no admitida."
                );
            }

            Snapshot snapshot =
                    new Snapshot(item);

            snapshots.add(snapshot);
            selectedIds.add(item.getId());
        }

        Snapshot pivot =
                snapshots.get(0);

        List<Target> targets =
                new ArrayList<Target>();

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        double floorDelta = 0.0D;

        if(operation == OP_FLOOR)
        {
            double minimumClearance =
                    Double.MAX_VALUE;

            RoomLayout layout =
                    room.getLayout();

            for(Snapshot snapshot : snapshots)
            {
                Rectangle footprint =
                        RoomLayout.getRectangle(
                                snapshot.x,
                                snapshot.y,
                                snapshot.item
                                        .getBaseItem()
                                        .getWidth(),
                                snapshot.item
                                        .getBaseItem()
                                        .getLength(),
                                snapshot.rotation
                        );

                double floorHeight =
                        -Double.MAX_VALUE;

                for(int x = footprint.x;
                        x < footprint.x + footprint.width;
                        x++)
                {
                    for(int y = footprint.y;
                            y < footprint.y + footprint.height;
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
                                    "La seleccion ocupa tiles invalidos."
                            );
                        }

                        floorHeight =
                                Math.max(
                                        floorHeight,
                                        layout.getHeightAtSquare(
                                                x,
                                                y
                                        )
                                );
                    }
                }

                double clearance =
                        snapshot.z -
                                floorHeight;

                if(clearance < -EPSILON)
                {
                    return Result.failure(
                            15,
                            "Un furni ya esta por debajo del suelo."
                    );
                }

                minimumClearance =
                        Math.min(
                                minimumClearance,
                                clearance
                        );
            }

            if(minimumClearance != Double.MAX_VALUE)
            {
                floorDelta =
                        -roundZ(
                                Math.max(
                                        0.0D,
                                        minimumClearance
                                )
                        );
            }
        }

        for(Snapshot snapshot : snapshots)
        {
            Target target;

            if(operation == OP_FLOOR)
            {
                target =
                        new Target(
                                snapshot,
                                snapshot.x,
                                snapshot.y,
                                roundZ(
                                        snapshot.z +
                                                floorDelta
                                ),
                                snapshot.rotation
                        );
            }
            else
            {
                target =
                        buildTarget(
                                snapshot,
                                pivot,
                                operation,
                                argument,
                                exactOrientationTargets
                        );
            }

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

            targets.add(target);
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

        int transformedCount = 0;

        BuilderProContext.begin(
                actorId,
                forcedHeights
        );

        try
        {
            System.out.println(
                    "[BuilderProTrace] SERVER TRANSFORM_BEGIN #"
                            + requestId
                            + " op="
                            + operation
                            + " arg="
                            + argument
                            + " items="
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
                        room.moveFurniTo(
                                target.snapshot.item,
                                destination,
                                target.rotation,
                                actor,
                                true,
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
                            "Transformacion cancelada por el servidor: "
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
                        ) != target.rotation)
                {
                    rollback(
                            room,
                            snapshots,
                            affectedTiles
                    );

                    return Result.failure(
                            21,
                            "El servidor altero la geometria exacta de la transformacion."
                    );
                }

                transformedCount++;
            }

            refreshAffectedTiles(
                    room,
                    affectedTiles
            );

            System.out.println(
                    "[BuilderProTrace] SERVER TRANSFORM_END #"
                            + requestId
                            + " transformed="
                            + transformedCount
            );

            return Result.success(
                    transformedCount
            );
        }
        catch(Exception exception)
        {
            System.out.println(
                    "[BuilderProTrace] SERVER TRANSFORM_EXCEPTION #"
                            + requestId
                            + " "
                            + exception.getClass().getName()
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
                    "La transformacion fue revertida por un error interno."
            );
        }
        finally
        {
            BuilderProContext.clear();
        }
    }

    private static Target buildTarget(
            Snapshot snapshot,
            Snapshot pivot,
            int operation,
            int argument,
            Map<Integer, Integer> exactOrientationTargets)
    {
        if(operation == OP_HEIGHT)
        {
            double newZ =
                    roundZ(
                            snapshot.z
                                    + (
                                        argument
                                        / 1000.0D
                                    )
                    );

            return new Target(
                    snapshot,
                    snapshot.x,
                    snapshot.y,
                    newZ,
                    snapshot.rotation
            );
        }

        if(operation == OP_ORIENT)
        {
            Integer requestedRotation =
                    exactOrientationTargets.get(
                            snapshot.item.getId()
                    );

            if(requestedRotation == null)
            {
                throw new IllegalArgumentException(
                        "Falta orientacion exacta para un furni."
                );
            }

            return new Target(
                    snapshot,
                    snapshot.x,
                    snapshot.y,
                    snapshot.z,
                    requestedRotation.intValue()
            );
        }

        int dx =
                snapshot.x - pivot.x;

        int dy =
                snapshot.y - pivot.y;

        int rawX;
        int rawY;

        if(argument > 0)
        {
            rawX =
                    pivot.x - dy;

            rawY =
                    pivot.y + dx;
        }
        else
        {
            rawX =
                    pivot.x + dy;

            rawY =
                    pivot.y - dx;
        }

        short newX =
                checkedShort(rawX);

        short newY =
                checkedShort(rawY);

        int newRotation =
                normalizeRotation(
                        snapshot.rotation
                                + (
                                    argument * 2
                                )
                );

        return new Target(
                snapshot,
                newX,
                newY,
                snapshot.z,
                newRotation
        );
    }

    private static Result validateTarget(
            Room room,
            Target target,
            Set<Integer> selectedIds,
            THashSet<RoomTile> affectedTiles)
    {
        RoomLayout layout =
                room.getLayout();

        Snapshot snapshot =
                target.snapshot;

        addFootprint(
                layout,
                snapshot.x,
                snapshot.y,
                snapshot.item,
                snapshot.rotation,
                affectedTiles
        );

        if(target.z > Room.MAXIMUM_FURNI_HEIGHT
                || target.z < -9999.0D)
        {
            return Result.failure(
                    12,
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
                    13,
                    "El destino queda fuera del mapa."
            );
        }

        if(!layout.fitsOnMap(
                anchor,
                snapshot.item
                        .getBaseItem()
                        .getWidth(),
                snapshot.item
                        .getBaseItem()
                        .getLength(),
                target.rotation))
        {
            return Result.failure(
                    13,
                    "Un furni no cabe dentro del mapa tras la transformacion."
            );
        }

        Rectangle destination =
                RoomLayout.getRectangle(
                        target.x,
                        target.y,
                        snapshot.item
                                .getBaseItem()
                                .getWidth(),
                        snapshot.item
                                .getBaseItem()
                                .getLength(),
                        target.rotation
                );

        double movingBottom =
                target.z;

        double movingTop =
                target.z
                        + Item.getCurrentHeight(
                                snapshot.item
                        );

        for(int x = destination.x;
                x < destination.x + destination.width;
                x++)
        {
            for(int y = destination.y;
                    y < destination.y + destination.height;
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
                            "La transformacion pisaria tiles invalidos."
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
                                "La transformacion colisiona con un furni externo."
                        );
                    }
                }
            }
        }

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
                        item.getBaseItem()
                                .getWidth(),
                        item.getBaseItem()
                                .getLength(),
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
                    normalizeRotation(
                            item.getRotation()
                    );
        }
    }

    private static final class Target
    {
        private final Snapshot snapshot;
        private final short x;
        private final short y;
        private final double z;
        private final int rotation;

        private Target(
                Snapshot snapshot,
                short x,
                short y,
                double z,
                int rotation)
        {
            this.snapshot = snapshot;
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
        public final int transformedCount;

        private Result(
                boolean success,
                int code,
                String message,
                int transformedCount)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.transformedCount =
                    transformedCount;
        }

        public static Result success(
                int transformedCount)
        {
            return new Result(
                    true,
                    0,
                    "OK",
                    transformedCount
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
