package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

public final class BuilderProLayerService
{
    public static final int OP_LIST = 0;
    public static final int OP_CREATE = 1;
    public static final int OP_RENAME = 2;
    public static final int OP_DELETE = 3;
    public static final int OP_ASSIGN = 4;
    public static final int OP_UNASSIGN = 5;

    public static final int MAX_LAYERS = 50;
    public static final int MAX_BATCH_SIZE = Room.MAXIMUM_FURNI;
    public static final int MAX_NAME_LENGTH = 40;

    private BuilderProLayerService()
    {
    }

    public static Result execute(
            Habbo actor,
            int operation,
            int layerId,
            String requestedName,
            List<Integer> requestedIds)
    {
        if(actor == null)
        {
            return Result.failure(
                    1,
                    "Usuario no disponible.",
                    new ArrayList<BuilderProLayerRepository.SavedLayer>()
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
                    new ArrayList<BuilderProLayerRepository.SavedLayer>()
            );
        }

        if(!room.hasRights(actor))
        {
            return Result.failure(
                    3,
                    "No tienes permisos de construccion en esta sala.",
                    safeList(room.getId())
            );
        }

        int roomId =
                room.getId();

        try
        {
            pruneMissingMembers(room);

            switch(operation)
            {
                case OP_LIST:
                    return Result.success(
                            "Capas cargadas.",
                            BuilderProLayerRepository.list(roomId)
                    );

                case OP_CREATE:
                {
                    if(BuilderProLayerRepository.count(roomId)
                            >= MAX_LAYERS)
                    {
                        return Result.failure(
                                10,
                                "La sala ha alcanzado el limite de 50 capas.",
                                BuilderProLayerRepository.list(roomId)
                        );
                    }

                    String name =
                            normalizeName(requestedName);

                    if(name.isEmpty())
                    {
                        name =
                                BuilderProLayerRepository
                                        .nextDefaultName(roomId);
                    }

                    if(name.length() > MAX_NAME_LENGTH)
                    {
                        return Result.failure(
                                11,
                                "El nombre de la capa es demasiado largo.",
                                BuilderProLayerRepository.list(roomId)
                        );
                    }

                    if(BuilderProLayerRepository.nameExists(
                            roomId,
                            name,
                            0))
                    {
                        return Result.failure(
                                12,
                                "Ya existe una capa con ese nombre.",
                                BuilderProLayerRepository.list(roomId)
                        );
                    }

                    BuilderProLayerRepository.create(
                            roomId,
                            actor.getHabboInfo().getId(),
                            name,
                            BuilderProLayerRepository
                                    .nextSortOrder(roomId)
                    );

                    return Result.success(
                            "Capa creada.",
                            BuilderProLayerRepository.list(roomId)
                    );
                }

                case OP_RENAME:
                {
                    if(requireLayer(roomId, layerId) == null)
                    {
                        return missingLayer(roomId);
                    }

                    String name =
                            normalizeName(requestedName);

                    if(name.isEmpty())
                    {
                        return Result.failure(
                                13,
                                "Escribe un nombre para la capa.",
                                BuilderProLayerRepository.list(roomId)
                        );
                    }

                    if(name.length() > MAX_NAME_LENGTH)
                    {
                        return Result.failure(
                                14,
                                "El nombre de la capa es demasiado largo.",
                                BuilderProLayerRepository.list(roomId)
                        );
                    }

                    if(BuilderProLayerRepository.nameExists(
                            roomId,
                            name,
                            layerId))
                    {
                        return Result.failure(
                                15,
                                "Ya existe una capa con ese nombre.",
                                BuilderProLayerRepository.list(roomId)
                        );
                    }

                    BuilderProLayerRepository.rename(
                            roomId,
                            layerId,
                            name
                    );

                    return Result.success(
                            "Capa renombrada.",
                            BuilderProLayerRepository.list(roomId)
                    );
                }

                case OP_DELETE:
                {
                    if(requireLayer(roomId, layerId) == null)
                    {
                        return missingLayer(roomId);
                    }

                    BuilderProLayerRepository.delete(
                            roomId,
                            layerId
                    );

                    return Result.success(
                            "Capa eliminada. Sus furnis vuelven a Sin capa.",
                            BuilderProLayerRepository.list(roomId)
                    );
                }

                case OP_ASSIGN:
                {
                    if(requireLayer(roomId, layerId) == null)
                    {
                        return missingLayer(roomId);
                    }

                    Validation validation =
                            validateItems(
                                    actor,
                                    room,
                                    requestedIds
                            );

                    if(!validation.success)
                    {
                        return Result.failure(
                                validation.code,
                                validation.message,
                                BuilderProLayerRepository.list(roomId)
                        );
                    }

                    BuilderProLayerRepository.assignItems(
                            roomId,
                            layerId,
                            validation.itemIds
                    );

                    return Result.success(
                            "Seleccion movida a la capa.",
                            BuilderProLayerRepository.list(roomId)
                    );
                }

                case OP_UNASSIGN:
                {
                    Validation validation =
                            validateItems(
                                    actor,
                                    room,
                                    requestedIds
                            );

                    if(!validation.success)
                    {
                        return Result.failure(
                                validation.code,
                                validation.message,
                                BuilderProLayerRepository.list(roomId)
                        );
                    }

                    BuilderProLayerRepository.unassignItems(
                            validation.itemIds
                    );

                    return Result.success(
                            "Seleccion movida a Sin capa.",
                            BuilderProLayerRepository.list(roomId)
                    );
                }

                default:
                    return Result.failure(
                            16,
                            "Operacion de capa desconocida.",
                            BuilderProLayerRepository.list(roomId)
                    );
            }
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return Result.failure(
                    90,
                    "Error interno al gestionar las capas.",
                    safeList(roomId)
            );
        }
    }

    private static Validation validateItems(
            Habbo actor,
            Room room,
            List<Integer> requestedIds)
    {
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
            return Validation.failure(
                    20,
                    "Selecciona al menos un furni."
            );
        }

        if(unique.size() > MAX_BATCH_SIZE)
        {
            return Validation.failure(
                    21,
                    "Solo se pueden mover " + MAX_BATCH_SIZE + " furnis de capa a la vez."
            );
        }

        List<Integer> itemIds =
                new ArrayList<Integer>(unique);

        BuilderProGroupGuard.Result groupGuard =
                BuilderProGroupGuard.validate(
                        actor,
                        itemIds
                );

        if(!groupGuard.success)
        {
            return Validation.failure(
                    22,
                    groupGuard.message
            );
        }

        for(Integer itemId : itemIds)
        {
            HabboItem item =
                    room.getHabboItem(
                            itemId.intValue()
                    );

            if(item == null)
            {
                return Validation.failure(
                        23,
                        "Uno de los furnis ya no esta en la sala."
                );
            }

            if(item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR)
            {
                return Validation.failure(
                        24,
                        "Las capas solo admiten furnis de suelo por ahora."
                );
            }
        }

        return Validation.success(itemIds);
    }

    private static void pruneMissingMembers(
            Room room)
            throws Exception
    {
        List<BuilderProLayerRepository.SavedLayer> layers =
                BuilderProLayerRepository.list(
                        room.getId()
                );

        for(BuilderProLayerRepository.SavedLayer layer : layers)
        {
            for(Integer itemId : layer.itemIds)
            {
                if(room.getHabboItem(
                        itemId.intValue()) != null)
                {
                    continue;
                }

                BuilderProLayerRepository.removeItem(
                        itemId.intValue()
                );
            }
        }
    }

    private static BuilderProLayerRepository.SavedLayer requireLayer(
            int roomId,
            int layerId)
            throws Exception
    {
        if(layerId <= 0)
        {
            return null;
        }

        return BuilderProLayerRepository.find(
                roomId,
                layerId
        );
    }

    private static Result missingLayer(
            int roomId)
            throws Exception
    {
        return Result.failure(
                25,
                "La capa ya no existe en esta sala.",
                BuilderProLayerRepository.list(roomId)
        );
    }

    private static String normalizeName(
            String name)
    {
        if(name == null)
        {
            return "";
        }

        return name.trim()
                .replaceAll(
                        "\\s+",
                        " "
                );
    }

    private static List<BuilderProLayerRepository.SavedLayer> safeList(
            int roomId)
    {
        try
        {
            return BuilderProLayerRepository.list(roomId);
        }
        catch(Exception ignored)
        {
            return new ArrayList<BuilderProLayerRepository.SavedLayer>();
        }
    }

    private static final class Validation
    {
        final boolean success;
        final int code;
        final String message;
        final List<Integer> itemIds;

        private Validation(
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

        static Validation success(
                List<Integer> itemIds)
        {
            return new Validation(
                    true,
                    0,
                    "",
                    itemIds
            );
        }

        static Validation failure(
                int code,
                String message)
        {
            return new Validation(
                    false,
                    code,
                    message,
                    new ArrayList<Integer>()
            );
        }
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final List<BuilderProLayerRepository.SavedLayer> layers;

        private Result(
                boolean success,
                int code,
                String message,
                List<BuilderProLayerRepository.SavedLayer> layers)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.layers = layers;
        }

        public static Result success(
                String message,
                List<BuilderProLayerRepository.SavedLayer> layers)
        {
            return new Result(
                    true,
                    0,
                    message,
                    layers
            );
        }

        public static Result failure(
                int code,
                String message,
                List<BuilderProLayerRepository.SavedLayer> layers)
        {
            return new Result(
                    false,
                    code,
                    message,
                    layers
            );
        }
    }
}
