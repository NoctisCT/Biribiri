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

public final class GroupMoveService
{
    public static final int MAX_GROUP_SIZE = Room.MAXIMUM_FURNI;

    private static final double EPSILON = 0.000001D;

    private static final int DIRECT_UPDATE_LIMIT = 100;
    private static final int UPDATE_CHUNK_SIZE = 50;
    private static final long UPDATE_CHUNK_DELAY_MS = 25L;

    private GroupMoveService()
    {
    }

    public static Result move(
            Habbo actor,
            List<Integer> requestedIds,
            int deltaX,
            int deltaY,
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
                    "La seleccion supera el limite del MVP."
            );
        }

        if(deltaX == 0 && deltaY == 0)
        {
            return Result.failure(
                    6,
                    "El desplazamiento es cero."
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
                        "El MVP solo admite furnis de suelo."
                );
            }

            /*
             * Los stack tiles tienen reglas especiales en
             * Room.moveFurniTo() que sustituyen su Z por la
             * altura del tile. Se excluyen del MVP para no
             * introducir una excepcion silenciosa.
             */
            if(item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return Result.failure(
                        10,
                        "El MVP no mueve baldosas de arquitecto."
                );
            }

            if(item.getZ() > Room.MAXIMUM_FURNI_HEIGHT)
            {
                return Result.failure(
                        11,
                        "La seleccion contiene una altura no admitida."
                );
            }

            snapshots.add(
                    new Snapshot(item)
            );

            selectedIds.add(
                    item.getId()
            );
        }

        snapshots.sort(
                Comparator.comparingInt(
                        snapshot ->
                                snapshot.item.getId()
                )
        );

        THashSet<RoomTile> affectedTiles =
                new THashSet<RoomTile>();

        long validationStartedNs =
                System.nanoTime();

        Result validation =
                validateDestination(
                        room,
                        snapshots,
                        selectedIds,
                        deltaX,
                        deltaY,
                        affectedTiles
                );

        long validationMs =
                (System.nanoTime()
                        - validationStartedNs)
                        / 1_000_000L;

        System.out.println(
                "[BuilderProTrace] SERVER VALIDATE #"
                        + requestId
                        + " ms="
                        + validationMs
                        + " success="
                        + validation.success
        );

        if(!validation.success)
        {
            return validation;
        }

        Map<Integer, Double> forcedHeights =
                new HashMap<Integer, Double>();

        for(Snapshot snapshot : snapshots)
        {
            forcedHeights.put(
                    snapshot.item.getId(),
                    snapshot.z
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        int movedCount = 0;

        boolean deferredUpdates =
                snapshots.size() > DIRECT_UPDATE_LIMIT;

        BuilderProContext.begin(
                actorId,
                forcedHeights
        );

        try
        {
            long moveStartedNs =
                    System.nanoTime();

            System.out.println(
                    "[BuilderProTrace] SERVER MOVE_BEGIN #"
                            + requestId
                            + " items="
                            + snapshots.size()
            );

            for(Snapshot snapshot : snapshots)
            {
                short newX =
                        checkedShort(
                                snapshot.x + deltaX
                        );

                short newY =
                        checkedShort(
                                snapshot.y + deltaY
                        );

                RoomTile destination =
                        room.getLayout()
                                .getTile(
                                        newX,
                                        newY
                                );

                FurnitureMovementError error =
                        room.moveFurniTo(
                                snapshot.item,
                                destination,
                                snapshot.rotation,
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
                            "Movimiento cancelado por el servidor: "
                                    + error.name()
                    );
                }

                if(Math.abs(
                        snapshot.item.getZ()
                                - snapshot.z
                ) > EPSILON)
                {
                    rollback(
                            room,
                            snapshots,
                            affectedTiles
                    );

                    return Result.failure(
                            21,
                            "La altura de un furni cambio durante el movimiento."
                    );
                }

                movedCount++;
            }

            /*
             * moveFurniTo() ya marca el furni para guardar
             * y programa su persistencia mediante el threading
             * normal del emulador.
             *
             * No forzamos item.run() aqui: hacerlo de forma
             * sincronica en cada paso del teclado bloqueaba
             * innecesariamente la confirmacion al cliente.
             *
             * El rollback conserva persistencia sincronica,
             * porque en ese caso prima restaurar el snapshot.
             */
            long moveMs =
                    (System.nanoTime()
                            - moveStartedNs)
                            / 1_000_000L;

            System.out.println(
                    "[BuilderProTrace] SERVER MOVE_END #"
                            + requestId
                            + " ms="
                            + moveMs
                            + " moved="
                            + movedCount
            );

            long refreshStartedNs =
                    System.nanoTime();

            System.out.println(
                    "[BuilderProTrace] SERVER REFRESH_BEGIN #"
                            + requestId
                            + " tiles="
                            + affectedTiles.size()
            );

            refreshAffectedTiles(
                    room,
                    affectedTiles
            );

            if(deferredUpdates)
            {
                scheduleDeferredUpdates(
                        room,
                        snapshots
                );
            }

            long refreshMs =
                    (System.nanoTime()
                            - refreshStartedNs)
                            / 1_000_000L;

            System.out.println(
                    "[BuilderProTrace] SERVER REFRESH_END #"
                            + requestId
                            + " ms="
                            + refreshMs
            );

            return Result.success(
                    movedCount
            );
        }
        catch(Exception exception)
        {
            System.out.println(
                    "[BuilderProTrace] SERVER EXCEPTION #"
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
                    "La operacion fue revertida por un error interno."
            );
        }
        finally
        {
            BuilderProContext.clear();
        }
    }

    private static Result validateDestination(
            Room room,
            List<Snapshot> snapshots,
            Set<Integer> selectedIds,
            int deltaX,
            int deltaY,
            THashSet<RoomTile> affectedTiles)
    {
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

            int rawX =
                    snapshot.x + deltaX;

            int rawY =
                    snapshot.y + deltaY;

            if(rawX < Short.MIN_VALUE
                    || rawX > Short.MAX_VALUE
                    || rawY < Short.MIN_VALUE
                    || rawY > Short.MAX_VALUE)
            {
                return Result.failure(
                        12,
                        "El destino queda fuera del mapa."
                );
            }

            short newX =
                    (short)rawX;

            short newY =
                    (short)rawY;

            RoomTile anchor =
                    layout.getTile(
                            newX,
                            newY
                    );

            if(anchor == null)
            {
                return Result.failure(
                        12,
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
                    snapshot.rotation))
            {
                return Result.failure(
                        12,
                        "El furni no cabe dentro del mapa."
                );
            }

            Rectangle destination =
                    RoomLayout.getRectangle(
                            newX,
                            newY,
                            snapshot.item
                                    .getBaseItem()
                                    .getWidth(),
                            snapshot.item
                                    .getBaseItem()
                                    .getLength(),
                            snapshot.rotation
                    );

            /*
             * Builder Pro trabaja con volumen 3D.
             *
             * Dos furnis pueden compartir X/Y si sus
             * intervalos verticales no se solapan.
             * Esto permite mover construcciones sobre
             * pavimentos, tarimas, maderas, etc. sin
             * incluir el suelo decorativo en la seleccion.
             */
            double movingBottom =
                    snapshot.z;

            double movingTop =
                    snapshot.z
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
                                13,
                                "El destino contiene tiles invalidos."
                        );
                    }

                    affectedTiles.add(tile);

                    if(snapshot.z
                            < layout.getHeightAtSquare(
                                    x,
                                    y
                            ))
                    {
                        return Result.failure(
                                14,
                                "La altura original quedaria por debajo del suelo destino."
                        );
                    }

                    if(room.hasHabbosAt(x, y)
                            || room.hasBotsAt(x, y)
                            || room.hasPetsAt(x, y))
                    {
                        return Result.failure(
                                15,
                                "Hay una unidad ocupando el destino."
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
                                    16,
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
                                    16,
                                    "El destino contiene un furni que invade el volumen de la seleccion."
                            );
                        }
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
        /*
         * Tocar una superficie no es colision.
         *
         * Ejemplo:
         * pavimento 0.00 -> 0.10
         * furni      0.10 -> 1.10
         * se permite.
         */
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

    private static void scheduleDeferredUpdates(
            Room room,
            List<Snapshot> snapshots)
    {
        for(int offset = 0;
                offset < snapshots.size();
                offset += UPDATE_CHUNK_SIZE)
        {
            int end =
                    Math.min(
                            snapshots.size(),
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
                        snapshots.get(index).item
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

            /*
             * Se guarda sincronicamente para que incluso
             * una escritura asincrona pendiente observe ya
             * el estado restaurado.
             */
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

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final int movedCount;

        private Result(
                boolean success,
                int code,
                String message,
                int movedCount)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.movedCount = movedCount;
        }

        public static Result success(
                int movedCount)
        {
            return new Result(
                    true,
                    0,
                    "OK",
                    movedCount
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
