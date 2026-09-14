package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.interactions.InteractionStackHelper;
import com.eu.habbo.habbohotel.items.interactions.InteractionTileWalkMagic;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

public final class BuilderProItemLockService
{
    public static final int OP_QUERY = 0;
    public static final int OP_SET = 1;
    public static final int MAX_SELECTION = Room.MAXIMUM_FURNI;

    private static final ConcurrentHashMap<Integer, Set<Integer>> ROOM_CACHE =
            new ConcurrentHashMap<Integer, Set<Integer>>();

    private BuilderProItemLockService()
    {
    }

    public static void initialize()
            throws Exception
    {
        BuilderProItemLockRepository.initialize();
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
                        "Bloqueos de construccion cargados.",
                        loadRoomIds(room)
                );
            }

            if(operation != OP_SET)
            {
                return Result.failure(
                        4,
                        "Operacion de bloqueo desconocida.",
                        loadRoomIds(room)
                );
            }

            LinkedHashSet<Integer> unique =
                    new LinkedHashSet<Integer>();

            if(requestedIds != null)
            {
                for(Integer itemId : requestedIds)
                {
                    if(itemId != null
                            && itemId.intValue() > 0)
                    {
                        unique.add(itemId.intValue());
                    }
                }
            }

            if(unique.isEmpty())
            {
                return Result.failure(
                        5,
                        "Selecciona al menos un furni.",
                        loadRoomIds(room)
                );
            }

            if(unique.size() > MAX_SELECTION)
            {
                return Result.failure(
                        6,
                        "La seleccion supera " + MAX_SELECTION + " furnis.",
                        loadRoomIds(room)
                );
            }

            List<Integer> itemIds =
                    new ArrayList<Integer>(unique);

            for(Integer itemId : itemIds)
            {
                HabboItem item =
                        room.getHabboItem(
                                itemId.intValue()
                        );

                if(item == null
                        || item.getRoomId() != room.getId())
                {
                    return Result.failure(
                            7,
                            "Uno de los furnis ya no esta en la sala.",
                            loadRoomIds(room)
                    );
                }

                if(item.getBaseItem() == null
                        || item.getBaseItem().getType()
                        != FurnitureType.FLOOR)
                {
                    return Result.failure(
                            8,
                            "Solo se pueden bloquear furnis de suelo.",
                            loadRoomIds(room)
                    );
                }

                if(item instanceof InteractionStackHelper
                        || item instanceof InteractionTileWalkMagic)
                {
                    return Result.failure(
                            9,
                            "Las baldosas auxiliares no pueden bloquearse.",
                            loadRoomIds(room)
                    );
                }
            }

            BuilderProItemLockRepository.set(
                    room.getId(),
                    actor.getHabboInfo().getId(),
                    itemIds,
                    enabled
            );

            ROOM_CACHE.remove(room.getId());

            List<Integer> current =
                    loadRoomIds(room);

            return Result.success(
                    enabled
                            ? itemIds.size()
                                    + " furnis bloqueados para construccion."
                            : itemIds.size()
                                    + " furnis desbloqueados.",
                    current
            );
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return Result.failure(
                    90,
                    "Error interno al actualizar el bloqueo.",
                    safeList(room)
            );
        }
    }

    public static boolean isLocked(
            Room room,
            int itemId)
            throws Exception
    {
        if(room == null
                || itemId <= 0)
        {
            return false;
        }

        return getRoomIds(room)
                .contains(
                        Integer.valueOf(itemId)
                );
    }

    public static void warmRoom(
            Room room)
    {
        if(room == null)
        {
            return;
        }

        try
        {
            getRoomIds(room);
        }
        catch(Exception exception)
        {
            System.err.println(
                    "[BuilderPro] No se pudieron precargar los bloqueos de construccion."
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
            BuilderProItemLockRepository.removeItem(
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
                    ROOM_CACHE.get(roomId);

            if(cached != null)
            {
                cached.remove(itemId);
            }
        }
    }

    public static void clearAll()
    {
        ROOM_CACHE.clear();
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

        loadRoomIds(room);

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
                BuilderProItemLockRepository.list(
                        room.getId()
                );

        List<Integer> live =
                new ArrayList<Integer>();

        for(Integer itemId : persisted)
        {
            if(room.getHabboItem(
                    itemId.intValue()
            ) != null)
            {
                live.add(itemId);
                continue;
            }

            BuilderProItemLockRepository.removeItem(
                    itemId.intValue()
            );
        }

        Set<Integer> cached =
                ConcurrentHashMap.newKeySet();

        cached.addAll(live);

        ROOM_CACHE.put(
                room.getId(),
                cached
        );

        return live;
    }

    private static List<Integer> safeList(
            Room room)
    {
        if(room == null)
        {
            return new ArrayList<Integer>();
        }

        try
        {
            return loadRoomIds(room);
        }
        catch(Exception ignored)
        {
            return new ArrayList<Integer>();
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
            this.message = message == null
                    ? ""
                    : message;
            this.itemIds = itemIds == null
                    ? new ArrayList<Integer>()
                    : itemIds;
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
