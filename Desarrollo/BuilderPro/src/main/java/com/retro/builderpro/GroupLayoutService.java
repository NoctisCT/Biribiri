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

public final class GroupLayoutService
{
    public static final int MAX_GROUP_SIZE = Room.MAXIMUM_FURNI;

    public static final int ROW_LEFT = 1;
    public static final int ROW_RIGHT = 2;
    public static final int COLUMN_UP = 3;
    public static final int COLUMN_DOWN = 4;
    public static final int STACK = 5;

    private static final double EPSILON = 0.000001D;

    private static final int DIRECT_UPDATE_LIMIT = 100;
    private static final int UPDATE_CHUNK_SIZE = 50;
    private static final long UPDATE_CHUNK_DELAY_MS = 25L;

    private GroupLayoutService()
    {
    }

    public static Result layout(
            Habbo actor,
            List<Integer> requestedIds,
            int operation,
            int pivotId,
            int spacing,
            int requestId)
    {
        if(actor == null)
        {
            return Result.failure(1, "Usuario no disponible.");
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return Result.failure(2, "No hay una sala activa.");
        }

        if(!room.hasRights(actor))
        {
            return Result.failure(
                    3,
                    "No tienes permisos de construccion en esta sala."
            );
        }

        if(operation < ROW_LEFT
                || operation > STACK)
        {
            return Result.failure(
                    4,
                    "Formacion invalida."
            );
        }

        if(spacing < 0
                || spacing > 50)
        {
            return Result.failure(
                    40,
                    "La separacion debe estar entre 0 y 50."
            );
        }

        if(requestedIds == null
                || requestedIds.size() < 2)
        {
            return Result.failure(
                    5,
                    "La formacion requiere al menos 2 furnis."
            );
        }

        LinkedHashSet<Integer> uniqueIds =
                new LinkedHashSet<Integer>(
                        requestedIds
                );

        if(uniqueIds.size() != requestedIds.size()
                || uniqueIds.size() > MAX_GROUP_SIZE)
        {
            return Result.failure(
                    6,
                    "Seleccion invalida."
            );
        }

        if(!uniqueIds.contains(pivotId))
        {
            return Result.failure(
                    7,
                    "El eje no pertenece a la seleccion."
            );
        }

        List<Snapshot> snapshots =
                new ArrayList<Snapshot>();

        Set<Integer> selectedIds =
                new HashSet<Integer>();

        Snapshot pivot = null;

        for(Integer id : uniqueIds)
        {
            if(id == null)
            {
                return Result.failure(
                        8,
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
                        9,
                        "Uno de los furnis ya no existe."
                );
            }

            if(item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR)
            {
                return Result.failure(
                        10,
                        "Builder Pro solo admite furnis de suelo."
                );
            }

            if(item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return Result.failure(
                        11,
                        "Builder Pro no modifica baldosas auxiliares."
                );
            }

            Snapshot snapshot =
                    new Snapshot(item);

            snapshots.add(snapshot);
            selectedIds.add(item.getId());

            if(item.getId() == pivotId)
            {
                pivot = snapshot;
            }
        }

        if(pivot == null)
        {
            return Result.failure(
                    12,
                    "No se pudo resolver el eje."
            );
        }

        List<Snapshot> others =
                new ArrayList<Snapshot>();

        for(Snapshot snapshot : snapshots)
        {
            if(snapshot.item.getId()
                    != pivot.item.getId())
            {
                others.add(snapshot);
            }
        }

        final Snapshot pivotFinal = pivot;

        others.sort(
                Comparator
                        .comparingInt(
                                (Snapshot snapshot) ->
                                        Math.abs(
                                                snapshot.x
                                                        - pivotFinal.x
                                        )
                                        + Math.abs(
                                                snapshot.y
                                                        - pivotFinal.y
                                        )
                        )
                        .thenComparingDouble(
                                snapshot ->
                                        Math.abs(
                                                snapshot.z
                                                        - pivotFinal.z
                                        )
                        )
                        .thenComparingInt(
                                snapshot ->
                                        snapshot.item.getId()
                        )
        );

        List<Target> targets =
                buildFormation(
                        pivot,
                        others,
                        operation,
                        spacing
                );

        if(targets == null)
        {
            return Result.failure(
                    13,
                    "No se pudo calcular la formacion."
            );
        }

        int changedCount = 0;

        for(Target target : targets)
        {
            if(target.changed())
            {
                changedCount++;
            }
        }

        if(changedCount == 0)
        {
            return Result.failure(
                    14,
                    "La seleccion ya tiene esa formacion."
            );
        }

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        RoomLayout layout =
                room.getLayout();

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
        }

        for(Target target : targets)
        {
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
        }

        Result internal =
                validateInternalTargets(
                        targets
                );

        if(!internal.success)
        {
            return internal;
        }

        List<Target> moving =
                new ArrayList<Target>();

        for(Target target : targets)
        {
            if(target.changed())
            {
                moving.add(target);
            }
        }

        sortApplyOrder(
                moving,
                operation
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

        BuilderProContext.begin(
                actor.getHabboInfo().getId(),
                forcedHeights
        );

        int affectedCount = 0;

        boolean deferredUpdates =
                moving.size() > DIRECT_UPDATE_LIMIT;

        try
        {
            System.out.println(
                    "[BuilderProTrace] SERVER FORMATION_BEGIN #"
                            + requestId
                            + " operation="
                            + operation
                            + " pivot="
                            + pivotId
                            + " spacing="
                            + spacing
                            + " items="
                            + snapshots.size()
            );

            for(Target target : moving)
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
                            30,
                            "Formacion cancelada por el servidor: "
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
                            31,
                            "El servidor altero la geometria de la formacion."
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
                                moving.size()
                        );

                for(Target target : moving)
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
                    "[BuilderProTrace] SERVER FORMATION_END #"
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
            rollback(
                    room,
                    snapshots,
                    affectedTiles
            );

            return Result.failure(
                    32,
                    "La formacion fue revertida por un error interno."
            );
        }
        finally
        {
            BuilderProContext.clear();
        }
    }

    public static String operationLabel(
            int operation)
    {
        switch(operation)
        {
            case ROW_LEFT:
                return "Izquierda";

            case ROW_RIGHT:
                return "Derecha";

            case COLUMN_UP:
                return "Arriba";

            case COLUMN_DOWN:
                return "Abajo";

            case STACK:
                return "Apilar";

            default:
                return "Formacion";
        }
    }

    private static List<Target> buildFormation(
            Snapshot pivot,
            List<Snapshot> others,
            int operation,
            int spacing)
    {
        List<Target> targets =
                new ArrayList<Target>();

        targets.add(
                new Target(
                        pivot,
                        pivot.x,
                        pivot.y,
                        pivot.z
                )
        );

        Rectangle pivotRectangle =
                sourceRectangle(pivot);

        if(operation == ROW_RIGHT)
        {
            int cursor =
                    pivotRectangle.x
                            + pivotRectangle.width
                            + spacing;

            for(Snapshot snapshot : others)
            {
                Rectangle rectangle =
                        sourceRectangle(snapshot);

                targets.add(
                        target(
                                snapshot,
                                cursor,
                                pivot.y,
                                pivot.z
                        )
                );

                cursor +=
                        rectangle.width
                                + spacing;
            }
        }
        else if(operation == ROW_LEFT)
        {
            int cursor =
                    pivotRectangle.x;

            for(Snapshot snapshot : others)
            {
                Rectangle rectangle =
                        sourceRectangle(snapshot);

                cursor -=
                        rectangle.width
                                + spacing;

                targets.add(
                        target(
                                snapshot,
                                cursor,
                                pivot.y,
                                pivot.z
                        )
                );
            }
        }
        else if(operation == COLUMN_DOWN)
        {
            int cursor =
                    pivotRectangle.y
                            + pivotRectangle.height
                            + spacing;

            for(Snapshot snapshot : others)
            {
                Rectangle rectangle =
                        sourceRectangle(snapshot);

                targets.add(
                        target(
                                snapshot,
                                pivot.x,
                                cursor,
                                pivot.z
                        )
                );

                cursor +=
                        rectangle.height
                                + spacing;
            }
        }
        else if(operation == COLUMN_UP)
        {
            int cursor =
                    pivotRectangle.y;

            for(Snapshot snapshot : others)
            {
                Rectangle rectangle =
                        sourceRectangle(snapshot);

                cursor -=
                        rectangle.height
                                + spacing;

                targets.add(
                        target(
                                snapshot,
                                pivot.x,
                                cursor,
                                pivot.z
                        )
                );
            }
        }
        else if(operation == STACK)
        {
            double cursor =
                    roundZ(
                            pivot.z
                                    + Item.getCurrentHeight(
                                            pivot.item
                                    )
                    );

            for(Snapshot snapshot : others)
            {
                targets.add(
                        target(
                                snapshot,
                                pivot.x,
                                pivot.y,
                                cursor
                        )
                );

                cursor =
                        roundZ(
                                cursor
                                        + Item.getCurrentHeight(
                                                snapshot.item
                                        )
                        );
            }
        }

        return targets;
    }

    private static Target target(
            Snapshot snapshot,
            int x,
            int y,
            double z)
    {
        if(x < Short.MIN_VALUE
                || x > Short.MAX_VALUE
                || y < Short.MIN_VALUE
                || y > Short.MAX_VALUE)
        {
            return new Target(
                    snapshot,
                    Short.MIN_VALUE,
                    Short.MIN_VALUE,
                    z,
                    false
            );
        }

        return new Target(
                snapshot,
                (short)x,
                (short)y,
                roundZ(z)
        );
    }

    private static Result validateTarget(
            Room room,
            Target target,
            Set<Integer> selectedIds,
            THashSet<RoomTile> affectedTiles)
    {
        if(!target.valid)
        {
            return Result.failure(
                    20,
                    "La formacion queda fuera del rango de coordenadas."
            );
        }

        if(target.z > Room.MAXIMUM_FURNI_HEIGHT
                || target.z < -9999.0D)
        {
            return Result.failure(
                    21,
                    "La altura de la formacion queda fuera del rango admitido."
            );
        }

        RoomLayout layout =
                room.getLayout();

        HabboItem item =
                target.snapshot.item;

        RoomTile anchor =
                layout.getTile(
                        target.x,
                        target.y
                );

        if(anchor == null
                || !layout.fitsOnMap(
                        anchor,
                        item.getBaseItem().getWidth(),
                        item.getBaseItem().getLength(),
                        target.snapshot.rotation))
        {
            return Result.failure(
                    22,
                    "La formacion queda fuera del mapa."
            );
        }

        Rectangle rectangle =
                targetRectangle(target);

        double bottom =
                target.z;

        double top =
                bottom
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
                    return Result.failure(
                            23,
                            "La formacion contiene tiles invalidos."
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
                            24,
                            "Un furni quedaria por debajo del suelo."
                    );
                }

                if(room.hasHabbosAt(x, y)
                        || room.hasBotsAt(x, y)
                        || room.hasPetsAt(x, y))
                {
                    return Result.failure(
                            25,
                            "Hay una unidad ocupando el destino."
                    );
                }

                for(HabboItem existing
                        : room.getItemsAt(tile))
                {
                    if(existing == null
                            || selectedIds.contains(
                                    existing.getId()
                            ))
                    {
                        continue;
                    }

                    if(existing.getBaseItem() == null)
                    {
                        return Result.failure(
                                26,
                                "Hay un furni externo invalido en el destino."
                        );
                    }

                    double existingBottom =
                            existing.getZ();

                    double existingTop =
                            existingBottom
                                    + Item.getCurrentHeight(
                                            existing
                                    );

                    if(verticalRangesOverlap(
                            bottom,
                            top,
                            existingBottom,
                            existingTop))
                    {
                        return Result.failure(
                                26,
                                "La formacion colisiona con un furni externo."
                        );
                    }
                }
            }
        }

        return Result.success(0);
    }

    private static Result validateInternalTargets(
            List<Target> targets)
    {
        Map<Long, List<Target>> occupied =
                new HashMap<Long, List<Target>>();

        for(Target target : targets)
        {
            Rectangle rectangle =
                    targetRectangle(target);

            double bottom =
                    target.z;

            double top =
                    target.z
                            + Item.getCurrentHeight(
                                    target.snapshot.item
                            );

            for(int x = rectangle.x;
                    x < rectangle.x + rectangle.width;
                    x++)
            {
                for(int y = rectangle.y;
                        y < rectangle.y + rectangle.height;
                        y++)
                {
                    List<Target> existingTargets =
                            occupied.get(
                                    tileKey(
                                            x,
                                            y
                                    )
                            );

                    if(existingTargets == null)
                    {
                        continue;
                    }

                    for(Target existing : existingTargets)
                    {
                        double existingBottom =
                                existing.z;

                        double existingTop =
                                existing.z
                                        + Item.getCurrentHeight(
                                                existing.snapshot.item
                                        );

                        if(verticalRangesOverlap(
                                bottom,
                                top,
                                existingBottom,
                                existingTop))
                        {
                            return Result.failure(
                                    27,
                                    "La formacion produciria una colision interna."
                            );
                        }
                    }
                }
            }

            for(int x = rectangle.x;
                    x < rectangle.x + rectangle.width;
                    x++)
            {
                for(int y = rectangle.y;
                        y < rectangle.y + rectangle.height;
                        y++)
                {
                    occupied.computeIfAbsent(
                            tileKey(
                                    x,
                                    y
                            ),
                            ignored ->
                                    new ArrayList<Target>()
                    ).add(
                            target
                    );
                }
            }
        }

        return Result.success(0);
    }

    private static long tileKey(
            int x,
            int y)
    {
        return (
            ((long)x) << 32
        ) ^ (
            y & 0xffffffffL
        );
    }

    private static void sortApplyOrder(
            List<Target> targets,
            int operation)
    {
        if(operation == ROW_LEFT)
        {
            targets.sort(
                    Comparator.comparingInt(
                            target -> target.x
                    )
            );
        }
        else if(operation == ROW_RIGHT)
        {
            targets.sort(
                    Comparator.comparingInt(
                            (Target target) -> target.x
                    ).reversed()
            );
        }
        else if(operation == COLUMN_UP)
        {
            targets.sort(
                    Comparator.comparingInt(
                            target -> target.y
                    )
            );
        }
        else if(operation == COLUMN_DOWN)
        {
            targets.sort(
                    Comparator.comparingInt(
                            (Target target) -> target.y
                    ).reversed()
            );
        }
        else
        {
            targets.sort(
                    Comparator.comparingDouble(
                            (Target target) -> target.z
                    ).reversed()
            );
        }
    }

    private static Rectangle sourceRectangle(
            Snapshot snapshot)
    {
        return RoomLayout.getRectangle(
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
    }

    private static Rectangle targetRectangle(
            Target target)
    {
        return RoomLayout.getRectangle(
                target.x,
                target.y,
                target.snapshot.item
                        .getBaseItem()
                        .getWidth(),
                target.snapshot.item
                        .getBaseItem()
                        .getLength(),
                target.snapshot.rotation
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
            item.setRotation(snapshot.rotation);

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
        return ((rotation % 8) + 8) % 8;
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
            this.rotation = item.getRotation();
        }
    }

    private static final class Target
    {
        private final Snapshot snapshot;
        private final short x;
        private final short y;
        private final double z;
        private final boolean valid;

        private Target(
                Snapshot snapshot,
                short x,
                short y,
                double z)
        {
            this(
                    snapshot,
                    x,
                    y,
                    z,
                    true
            );
        }

        private Target(
                Snapshot snapshot,
                short x,
                short y,
                double z,
                boolean valid)
        {
            this.snapshot = snapshot;
            this.x = x;
            this.y = y;
            this.z = z;
            this.valid = valid;
        }

        private boolean changed()
        {
            return this.x != snapshot.x
                    || this.y != snapshot.y
                    || Math.abs(
                            this.z - snapshot.z
                    ) > EPSILON;
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
            this.affectedCount = affectedCount;
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
