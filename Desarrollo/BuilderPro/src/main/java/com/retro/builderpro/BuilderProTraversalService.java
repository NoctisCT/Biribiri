package com.retro.builderpro;

import com.eu.habbo.Emulator;
import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.items.interactions.InteractionStackHelper;
import com.eu.habbo.habbohotel.items.interactions.InteractionTileWalkMagic;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.rooms.RoomLayout;
import com.eu.habbo.habbohotel.rooms.RoomTile;
import com.eu.habbo.habbohotel.rooms.RoomTileState;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;

import java.awt.Rectangle;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public final class BuilderProTraversalService
{
    public static final int OP_QUERY = 0;
    public static final int OP_SET = 1;

    public static final int MAX_SELECTION = 100;

    // P55G2_NATIVE_TRAVERSAL
    private static final long STEP_HELPER_LIFETIME_MS =
            100L;

    private static final AtomicInteger HELPER_IDS =
            new AtomicInteger(
                    -1800000000
            );

    private static final Map<Integer, Set<Integer>> ROOM_CACHE =
            new ConcurrentHashMap<Integer, Set<Integer>>();

    private static final Map<String, ActiveHelper> ACTIVE_HELPERS =
            new ConcurrentHashMap<String, ActiveHelper>();

    private static volatile Item helperBaseItem;

    private BuilderProTraversalService()
    {
    }

    public static void initialize()
            throws Exception
    {
        BuilderProTraversalRepository.initialize();

        helperBaseItem =
                findHelperBaseItem();

        if(helperBaseItem == null)
        {
            System.err.println(
                    "[BuilderPro] Atravesables: no se encontro un furni auxiliar 1x1 compatible."
            );
        }
        else
        {
            System.out.println(
                    "[BuilderPro] Atravesables preparados. Helper base #"
                            + helperBaseItem.getId()
                            + " "
                            + helperBaseItem.getName()
            );
        }
    }

    public static Result execute(
            Habbo actor,
            int operation,
            boolean enabled,
            List<Integer> requestedIds)
    {
        if(actor == null)
        {
            return Result.failure(
                    1,
                    "Usuario no disponible.",
                    new ArrayList<Integer>()
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
                    new ArrayList<Integer>()
            );
        }

        if(!room.hasRights(actor))
        {
            return Result.failure(
                    3,
                    "No tienes permisos de construccion en esta sala.",
                    safeList(room)
            );
        }

        try
        {
            if(operation == OP_QUERY)
            {
                return Result.success(
                        "Estado de colision cargado.",
                        loadRoomIds(
                                room
                        )
                );
            }

            if(operation != OP_SET)
            {
                return Result.failure(
                        4,
                        "Operacion de colision desconocida.",
                        loadRoomIds(
                                room
                        )
                );
            }

            if(enabled
                    && helperBaseItem == null)
            {
                return Result.failure(
                        5,
                        "El servidor no tiene un helper de paso compatible.",
                        loadRoomIds(
                                room
                        )
                );
            }

            LinkedHashSet<Integer> unique =
                    new LinkedHashSet<Integer>();

            if(requestedIds != null)
            {
                for(Integer itemId :
                        requestedIds)
                {
                    if(itemId != null
                            && itemId.intValue() > 0)
                    {
                        unique.add(
                                itemId.intValue()
                        );
                    }
                }
            }

            if(unique.isEmpty())
            {
                return Result.failure(
                        6,
                        "Selecciona al menos un furni.",
                        loadRoomIds(
                                room
                        )
                );
            }

            if(unique.size() > MAX_SELECTION)
            {
                return Result.failure(
                        7,
                        "La seleccion supera 100 furnis.",
                        loadRoomIds(
                                room
                        )
                );
            }

            List<Integer> itemIds =
                    new ArrayList<Integer>(
                            unique
                    );

            for(Integer itemId :
                    itemIds)
            {
                HabboItem item =
                        room.getHabboItem(
                                itemId.intValue()
                        );

                if(item == null)
                {
                    return Result.failure(
                            8,
                            "Uno de los furnis ya no esta en la sala.",
                            loadRoomIds(
                                    room
                            )
                    );
                }

                if(item.getBaseItem() == null
                        || item.getBaseItem().getType()
                        != FurnitureType.FLOOR)
                {
                    return Result.failure(
                            9,
                            "Solo se pueden hacer atravesables furnis de suelo.",
                            loadRoomIds(
                                    room
                            )
                    );
                }

                if(item instanceof InteractionStackHelper
                        || item instanceof InteractionTileWalkMagic)
                {
                    return Result.failure(
                            10,
                            "Las baldosas auxiliares no pueden usar este modo.",
                            loadRoomIds(
                                    room
                            )
                    );
                }
            }

            BuilderProTraversalRepository.set(
                    room.getId(),
                    actor.getHabboInfo()
                            .getId(),
                    itemIds,
                    enabled
            );

            ROOM_CACHE.remove(
                    room.getId()
            );

            List<Integer> current =
                    loadRoomIds(
                            room
                    );

            restoreItemTiles(
                    room,
                    itemIds
            );

            refreshRoomCollision(
                    room
            );

            return Result.success(
                    enabled
                            ? itemIds.size()
                                    + " furnis ahora son atravesables."
                            : itemIds.size()
                                    + " furnis vuelven a tener colision normal.",
                    current
            );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return Result.failure(
                    90,
                    "Error interno al actualizar la colision.",
                    safeList(room)
            );
        }
    }

    public static void refreshRoomCollision(
            Room room)
    {
        if(room == null
                || room.getLayout() == null)
        {
            return;
        }

        try
        {
            Set<Integer> ids =
                    getRoomIds(
                            room
                    );

            if(ids.isEmpty())
            {
                return;
            }

            for(Integer itemId :
                    ids)
            {
                HabboItem item =
                        room.getHabboItem(
                                itemId.intValue()
                        );

                if(item == null
                        || item.getBaseItem() == null)
                {
                    continue;
                }

                Rectangle rectangle =
                        RoomLayout.getRectangle(
                                item.getX(),
                                item.getY(),
                                item.getBaseItem()
                                        .getWidth(),
                                item.getBaseItem()
                                        .getLength(),
                                item.getRotation()
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
                                room.getLayout()
                                        .getTile(
                                                (short)x,
                                                (short)y
                                        );

                        refreshTileCollision(
                                room,
                                tile,
                                ids
                        );
                    }
                }
            }
        }
        catch(Exception exception)
        {
            System.err.println(
                    "[BuilderPro] Error refrescando colision atravesable."
            );

            exception.printStackTrace();
        }
    }

    private static void restoreItemTiles(
            Room room,
            List<Integer> itemIds)
    {
        if(room == null
                || room.getLayout() == null
                || itemIds == null)
        {
            return;
        }

        Set<Integer> touched =
                new HashSet<Integer>();

        for(Integer itemId :
                itemIds)
        {
            if(itemId == null)
            {
                continue;
            }

            HabboItem item =
                    room.getHabboItem(
                            itemId.intValue()
                    );

            if(item == null
                    || item.getBaseItem() == null)
            {
                continue;
            }

            Rectangle rectangle =
                    RoomLayout.getRectangle(
                            item.getX(),
                            item.getY(),
                            item.getBaseItem()
                                    .getWidth(),
                            item.getBaseItem()
                                    .getLength(),
                            item.getRotation()
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
                            room.getLayout()
                                    .getTile(
                                            (short)x,
                                            (short)y
                                    );

                    if(tile == null)
                    {
                        continue;
                    }

                    int key =
                            tileKey(
                                    tile.x,
                                    tile.y
                            );

                    if(!touched.add(key))
                    {
                        continue;
                    }

                    room.tileCache.remove(
                            tile
                    );

                    room.updateTile(
                            tile
                    );
                }
            }
        }
    }

    private static void refreshTileCollision(
            Room room,
            RoomTile tile,
            Set<Integer> ids)
    {
        if(room == null
                || tile == null
                || room.getLayout() == null)
        {
            return;
        }

        if(ids == null
                || ids.isEmpty())
        {
            room.tileCache.remove(
                    tile
            );

            room.updateTile(
                    tile
            );

            return;
        }

        TraversalSurface surface =
                resolveTraversalSurface(
                        room,
                        tile,
                        ids
                );

        if(surface == null)
        {
            room.tileCache.remove(
                    tile
            );

            room.updateTile(
                    tile
            );

            return;
        }

        tile.setStackHeight(
                surface.z
        );

        tile.setState(
                RoomTileState.OPEN
        );
    }

    public static Double getTraversalSurfaceZ(
            Room room,
            RoomTile tile)
    {
        if(room == null
                || tile == null
                || room.getLayout() == null)
        {
            return null;
        }

        Set<Integer> ids;

        try
        {
            ids =
                    getRoomIds(
                            room
                    );
        }
        catch(Exception exception)
        {
            return null;
        }

        if(ids.isEmpty())
        {
            return null;
        }

        TraversalSurface surface =
                resolveTraversalSurface(
                        room,
                        tile,
                        ids
                );

        if(surface == null)
        {
            return null;
        }

        return Double.valueOf(
                surface.z
        );
    }


    public static void prepareStep(
            Habbo actor,
            Room room,
            RoomTile from,
            RoomTile to)
    {
        if(actor == null
                || room == null
                || to == null)
        {
            return;
        }

        try
        {
            Set<Integer> ids =
                    getRoomIds(
                            room
                    );

            if(ids.isEmpty())
            {
                return;
            }

            prepareStepTile(
                    actor,
                    room,
                    to,
                    ids
            );
        }
        catch(Exception exception)
        {
            System.err.println(
                    "[BuilderPro] Error preparando paso atravesable."
            );

            exception.printStackTrace();
        }
    }


    public static void removeItem(
            int roomId,
            int itemId)
    {
        try
        {
            BuilderProTraversalRepository.removeItem(
                    itemId
            );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();
        }

        if(roomId > 0)
        {
            Set<Integer> cached =
                    ROOM_CACHE.get(
                            roomId
                    );

            if(cached != null)
            {
                cached.remove(
                        itemId
                );
            }
        }
    }

    public static void clearAll()
    {
        ROOM_CACHE.clear();

        List<ActiveHelper> helpers =
                new ArrayList<ActiveHelper>(
                        ACTIVE_HELPERS.values()
                );

        ACTIVE_HELPERS.clear();

        for(ActiveHelper active :
                helpers)
        {
            removeHelperNow(
                    active
            );
        }
    }

    private static void prepareStepTile(
            Habbo actor,
            Room room,
            RoomTile tile,
            Set<Integer> ids)
    {
        if(tile == null)
        {
            return;
        }

        TraversalSurface surface =
                resolveTraversalSurface(
                        room,
                        tile,
                        ids
                );

        if(surface == null)
        {
            return;
        }

        ensureHelper(
                room,
                tile,
                surface.z,
                actor.getHabboInfo()
                        .getId(),
                STEP_HELPER_LIFETIME_MS
        );
    }

    private static Map<Integer, TraversalSurface> collectTraversalSurfaces(
            Room room,
            Set<Integer> ids)
    {
        Map<Integer, TraversalSurface> result =
                new HashMap<Integer, TraversalSurface>();

        for(Integer itemId :
                ids)
        {
            HabboItem item =
                    room.getHabboItem(
                            itemId.intValue()
                    );

            if(item == null
                    || item.getBaseItem() == null)
            {
                continue;
            }

            Rectangle rectangle =
                    RoomLayout.getRectangle(
                            item.getX(),
                            item.getY(),
                            item.getBaseItem()
                                    .getWidth(),
                            item.getBaseItem()
                                    .getLength(),
                            item.getRotation()
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
                            room.getLayout()
                                    .getTile(
                                            (short)x,
                                            (short)y
                                    );

                    if(tile == null)
                    {
                        continue;
                    }

                    int key =
                            tileKey(
                                    tile.x,
                                    tile.y
                            );

                    if(result.containsKey(key))
                    {
                        continue;
                    }

                    TraversalSurface surface =
                            resolveTraversalSurface(
                                    room,
                                    tile,
                                    ids
                            );

                    if(surface != null)
                    {
                        result.put(
                                key,
                                surface
                        );
                    }
                }
            }
        }

        return result;
    }

    private static TraversalSurface resolveTraversalSurface(
            Room room,
            RoomTile tile,
            Set<Integer> ids)
    {
        if(room == null
                || tile == null
                || room.getLayout() == null)
        {
            return null;
        }

        /*
         * Los helpers temporales entran y salen de roomItems.
         * No debemos resolver esta casilla contra una tileCache antigua.
         */
        room.tileCache.remove(
                tile
        );

        boolean hasTraversable =
                false;

        double z =
                room.getLayout()
                        .getHeightAtSquare(
                                tile.x,
                                tile.y
                        );

        for(HabboItem item :
                room.getItemsAt(
                        tile.x,
                        tile.y
                ))
        {
            if(item == null
                    || item instanceof InteractionTileWalkMagic)
            {
                continue;
            }

            if(ids.contains(
                    item.getId()
            ))
            {
                hasTraversable = true;
                continue;
            }

            if(item.getBaseItem() == null)
            {
                return null;
            }

            /*
             * Nunca abrimos el paso si hay otro
             * furni solido no marcado en esa casilla.
             */
            boolean naturallyWalkable =
                    item.isWalkable()
                            || item.getBaseItem()
                                    .allowWalk();

            if(!naturallyWalkable)
            {
                return null;
            }

            if(item.getBaseItem().allowSit()
                    || item.getBaseItem().allowLay())
            {
                return null;
            }

            double itemTop =
                    item.getZ()
                            + Item.getCurrentHeight(
                                    item
                            );

            if(itemTop > z)
            {
                z = itemTop;
            }
        }

        if(!hasTraversable)
        {
            return null;
        }

        return new TraversalSurface(
                tile,
                z
        );
    }

    private static void ensureHelper(
            Room room,
            RoomTile tile,
            double z,
            int ownerId,
            long lifetimeMs)
    {
        if(helperBaseItem == null
                || room == null
                || tile == null)
        {
            return;
        }

        String key =
                room.getId()
                        + ":"
                        + tile.x
                        + ":"
                        + tile.y;

        long expiresAt =
                System.currentTimeMillis()
                        + lifetimeMs;

        synchronized(ACTIVE_HELPERS)
        {
            ActiveHelper existing =
                    ACTIVE_HELPERS.get(
                            key
                    );

            if(existing != null
                    && room.getHabboItem(
                            existing.helper.getId()
                    ) == existing.helper)
            {
                existing.expiresAt =
                        Math.max(
                                existing.expiresAt,
                                expiresAt
                        );

                if(Math.abs(
                        existing.helper.getZ()
                                - z
                ) > 0.000001D)
                {
                    existing.helper.setZ(
                            z
                    );

                    room.tileCache.remove(
                            tile
                    );
                }

                return;
            }

            if(existing != null)
            {
                ACTIVE_HELPERS.remove(
                        key
                );
            }

            int helperId =
                    nextHelperId(
                            room
                    );

            InteractionTileWalkMagic helper =
                    new InteractionTileWalkMagic(
                            helperId,
                            ownerId,
                            helperBaseItem,
                            "",
                            0,
                            0
                    );

            helper.setX(
                    tile.x
            );

            helper.setY(
                    tile.y
            );

            helper.setZ(
                    z
            );

            helper.setRotation(
                    0
            );

            helper.setRoomId(
                    room.getId()
            );

            room.tileCache.remove(
                    tile
            );

            room.addHabboItem(
                    helper
            );

            room.tileCache.remove(
                    tile
            );

            ActiveHelper active =
                    new ActiveHelper(
                            key,
                            room,
                            tile,
                            helper,
                            expiresAt
                    );

            ACTIVE_HELPERS.put(
                    key,
                    active
            );

            scheduleRemoval(
                    active,
                    lifetimeMs
            );
        }
    }

    private static int nextHelperId(
            Room room)
    {
        for(int attempts = 0;
                attempts < 10000;
                attempts++)
        {
            int id =
                    HELPER_IDS.getAndIncrement();

            if(id >= -1000000000)
            {
                HELPER_IDS.set(
                        -1800000000
                );

                id =
                        HELPER_IDS.getAndIncrement();
            }

            if(room.getHabboItem(id) == null)
            {
                return id;
            }
        }

        throw new IllegalStateException(
                "No se pudo reservar un ID de helper."
        );
    }

    private static void scheduleRemoval(
            ActiveHelper active,
            long delay)
    {
        Emulator.getThreading().run(
                () ->
                {
                    long remaining;

                    synchronized(ACTIVE_HELPERS)
                    {
                        ActiveHelper current =
                                ACTIVE_HELPERS.get(
                                        active.key
                                );

                        if(current != active)
                        {
                            return;
                        }

                        remaining =
                                active.expiresAt
                                        - System.currentTimeMillis();

                        if(remaining <= 0)
                        {
                            ACTIVE_HELPERS.remove(
                                    active.key
                            );
                        }
                    }

                    if(remaining > 0)
                    {
                        scheduleRemoval(
                                active,
                                remaining
                        );

                        return;
                    }

                    removeHelperNow(
                            active
                    );
                },
                Math.max(
                        1L,
                        delay
                )
        );
    }

    private static void removeHelperNow(
            ActiveHelper active)
    {
        try
        {
            if(active == null
                    || active.room == null)
            {
                return;
            }

            Room room =
                    active.room;

            room.tileCache.remove(
                    active.tile
            );

            if(room.getHabboItem(
                    active.helper.getId()
            ) == active.helper)
            {
                room.removeHabboItem(
                        active.helper
                );
            }

            room.tileCache.remove(
                    active.tile
            );

            if(room.getLayout() == null)
            {
                return;
            }

            RoomTile current =
                    room.getLayout()
                            .getTile(
                                    active.tile.x,
                                    active.tile.y
                            );

            if(current == null)
            {
                return;
            }

            refreshTileCollision(
                    room,
                    current,
                    getRoomIds(
                            room
                    )
            );
        }
        catch(Exception exception)
        {
            System.err.println(
                    "[BuilderPro] Error retirando helper atravesable."
            );

            exception.printStackTrace();
        }
    }


    private static Set<Integer> getRoomIds(
            Room room)
            throws Exception
    {
        Set<Integer> cached =
                ROOM_CACHE.get(
                        room.getId()
                );

        if(cached != null)
        {
            return new HashSet<Integer>(
                    cached
            );
        }

        loadRoomIds(
                room
        );

        cached =
                ROOM_CACHE.get(
                        room.getId()
                );

        return cached == null
                ? new HashSet<Integer>()
                : new HashSet<Integer>(
                        cached
                );
    }

    private static List<Integer> loadRoomIds(
            Room room)
            throws Exception
    {
        List<Integer> persisted =
                BuilderProTraversalRepository.list(
                        room.getId()
                );

        List<Integer> live =
                new ArrayList<Integer>();

        for(Integer itemId :
                persisted)
        {
            if(room.getHabboItem(
                    itemId.intValue()
            ) != null)
            {
                live.add(
                        itemId
                );

                continue;
            }

            BuilderProTraversalRepository.removeItem(
                    itemId.intValue()
            );
        }

        Set<Integer> cached =
                ConcurrentHashMap.newKeySet();

        cached.addAll(
                live
        );

        ROOM_CACHE.put(
                room.getId(),
                cached
        );

        return live;
    }

    private static List<Integer> safeList(
            Room room)
    {
        try
        {
            return loadRoomIds(
                    room
            );
        }
        catch(Exception ignored)
        {
            return new ArrayList<Integer>();
        }
    }

    private static Item findHelperBaseItem()
    {
        Item fallback =
                null;

        for(Item item :
                Emulator.getGameEnvironment()
                        .getItemManager()
                        .getItems()
                        .valueCollection())
        {
            if(item == null
                    || item.getType()
                    != FurnitureType.FLOOR
                    || item.getWidth() != 1
                    || item.getLength() != 1)
            {
                continue;
            }

            if(item.getInteractionType() != null
                    && item.getInteractionType()
                            .getType()
                    == InteractionTileWalkMagic.class)
            {
                return item;
            }

            if(item.allowSit()
                    || item.allowLay()
                    || item.getHeight() > 0.01D)
            {
                continue;
            }

            if(fallback == null
                    || item.getHeight()
                    < fallback.getHeight())
            {
                fallback =
                        item;
            }
        }

        return fallback;
    }

    private static int tileKey(
            int x,
            int y)
    {
        return (x & 0xFFFF)
                | (y << 16);
    }

    private static final class TraversalSurface
    {
        final RoomTile tile;
        final double z;

        TraversalSurface(
                RoomTile tile,
                double z)
        {
            this.tile = tile;
            this.z = z;
        }
    }

    private static final class ActiveHelper
    {
        final String key;
        final Room room;
        final RoomTile tile;
        final InteractionTileWalkMagic helper;
        volatile long expiresAt;

        ActiveHelper(
                String key,
                Room room,
                RoomTile tile,
                InteractionTileWalkMagic helper,
                long expiresAt)
        {
            this.key = key;
            this.room = room;
            this.tile = tile;
            this.helper = helper;
            this.expiresAt = expiresAt;
        }
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
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
            this.itemIds = itemIds;
        }

        public static Result success(
                String message,
                List<Integer> itemIds)
        {
            return new Result(
                    true,
                    0,
                    message,
                    itemIds
            );
        }

        public static Result failure(
                int code,
                String message,
                List<Integer> itemIds)
        {
            return new Result(
                    false,
                    code,
                    message,
                    itemIds
            );
        }
    }
}
