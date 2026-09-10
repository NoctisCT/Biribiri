package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

public final class BuilderProGroupService
{
    public static final int OP_LIST = 0;
    public static final int OP_CREATE = 1;
    public static final int OP_RENAME = 2;
    public static final int OP_SET_LOCKED = 3;
    public static final int OP_DELETE = 4;
    public static final int OP_REPLACE_MEMBERS = 5;

    public static final int MAX_GROUP_SIZE = 100;
    public static final int MAX_NAME_LENGTH = 40;

    private BuilderProGroupService()
    {
    }

    public static Result execute(
            Habbo actor,
            int operation,
            int groupId,
            String requestedName,
            boolean locked,
            List<Integer> requestedIds)
    {
        if(actor == null)
        {
            return Result.failure(
                    1,
                    "Usuario no disponible.",
                    new ArrayList<BuilderProGroupRepository.SavedGroup>()
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
                    new ArrayList<BuilderProGroupRepository.SavedGroup>()
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
            pruneMissingMembers(
                    room
            );

            switch(operation)
            {
                case OP_LIST:
                    return Result.success(
                            "Grupos cargados.",
                            BuilderProGroupRepository.list(
                                    roomId
                            )
                    );

                case OP_CREATE:
                {
                    Validation validation =
                            validateMembers(
                                    room,
                                    requestedIds,
                                    0
                            );

                    if(!validation.success)
                    {
                        return Result.failure(
                                validation.code,
                                validation.message,
                                BuilderProGroupRepository.list(
                                        roomId
                                )
                        );
                    }

                    String name =
                            normalizeName(
                                    requestedName
                            );

                    if(name.isEmpty())
                    {
                        name =
                                BuilderProGroupRepository
                                        .nextDefaultName(
                                                roomId
                                        );
                    }

                    if(name.length() > MAX_NAME_LENGTH)
                    {
                        return Result.failure(
                                12,
                                "El nombre del grupo es demasiado largo.",
                                BuilderProGroupRepository.list(
                                        roomId
                                )
                        );
                    }

                    if(BuilderProGroupRepository.nameExists(
                            roomId,
                            name,
                            0))
                    {
                        return Result.failure(
                                13,
                                "Ya existe un grupo con ese nombre.",
                                BuilderProGroupRepository.list(
                                        roomId
                                )
                        );
                    }

                    BuilderProGroupRepository.create(
                            roomId,
                            actor.getHabboInfo()
                                    .getId(),
                            name,
                            locked,
                            validation.itemIds
                    );

                    return Result.success(
                            "Grupo creado.",
                            BuilderProGroupRepository.list(
                                    roomId
                            )
                    );
                }

                case OP_RENAME:
                {
                    BuilderProGroupRepository.SavedGroup group =
                            requireGroup(
                                    roomId,
                                    groupId
                            );

                    if(group == null)
                    {
                        return missingGroup(roomId);
                    }

                    String name =
                            normalizeName(
                                    requestedName
                            );

                    if(name.isEmpty())
                    {
                        return Result.failure(
                                14,
                                "Escribe un nombre para el grupo.",
                                BuilderProGroupRepository.list(
                                        roomId
                                )
                        );
                    }

                    if(name.length() > MAX_NAME_LENGTH)
                    {
                        return Result.failure(
                                15,
                                "El nombre del grupo es demasiado largo.",
                                BuilderProGroupRepository.list(
                                        roomId
                                )
                        );
                    }

                    if(BuilderProGroupRepository.nameExists(
                            roomId,
                            name,
                            groupId))
                    {
                        return Result.failure(
                                16,
                                "Ya existe un grupo con ese nombre.",
                                BuilderProGroupRepository.list(
                                        roomId
                                )
                        );
                    }

                    BuilderProGroupRepository.rename(
                            roomId,
                            groupId,
                            name
                    );

                    return Result.success(
                            "Grupo renombrado.",
                            BuilderProGroupRepository.list(
                                    roomId
                            )
                    );
                }

                case OP_SET_LOCKED:
                {
                    if(requireGroup(
                            roomId,
                            groupId) == null)
                    {
                        return missingGroup(roomId);
                    }

                    BuilderProGroupRepository.setLocked(
                            roomId,
                            groupId,
                            locked
                    );

                    return Result.success(
                            locked
                                    ? "Grupo bloqueado."
                                    : "Grupo desbloqueado.",
                            BuilderProGroupRepository.list(
                                    roomId
                            )
                    );
                }

                case OP_DELETE:
                {
                    if(requireGroup(
                            roomId,
                            groupId) == null)
                    {
                        return missingGroup(roomId);
                    }

                    BuilderProGroupRepository.delete(
                            roomId,
                            groupId
                    );

                    return Result.success(
                            "Grupo eliminado.",
                            BuilderProGroupRepository.list(
                                    roomId
                            )
                    );
                }

                case OP_REPLACE_MEMBERS:
                {
                    BuilderProGroupRepository.SavedGroup group =
                            requireGroup(
                                    roomId,
                                    groupId
                            );

                    if(group == null)
                    {
                        return missingGroup(roomId);
                    }

                    if(group.locked)
                    {
                        return Result.failure(
                                17,
                                "Desbloquea el grupo antes de cambiar sus miembros.",
                                BuilderProGroupRepository.list(
                                        roomId
                                )
                        );
                    }

                    Validation validation =
                            validateMembers(
                                    room,
                                    requestedIds,
                                    groupId
                            );

                    if(!validation.success)
                    {
                        return Result.failure(
                                validation.code,
                                validation.message,
                                BuilderProGroupRepository.list(
                                        roomId
                                )
                        );
                    }

                    BuilderProGroupRepository.replaceMembers(
                            roomId,
                            groupId,
                            validation.itemIds
                    );

                    return Result.success(
                            "Miembros del grupo actualizados.",
                            BuilderProGroupRepository.list(
                                    roomId
                            )
                    );
                }

                default:
                    return Result.failure(
                            18,
                            "Operacion de grupo desconocida.",
                            BuilderProGroupRepository.list(
                                    roomId
                            )
                    );
            }
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return Result.failure(
                    90,
                    "Error interno al gestionar el grupo.",
                    safeList(roomId)
            );
        }
    }

    private static void pruneMissingMembers(
            Room room)
            throws Exception
    {
        List<BuilderProGroupRepository.SavedGroup> groups =
                BuilderProGroupRepository.list(
                        room.getId()
                );

        for(BuilderProGroupRepository.SavedGroup group :
                groups)
        {
            for(Integer itemId :
                    group.itemIds)
            {
                if(
                    room.getHabboItem(
                            itemId.intValue()
                    ) != null
                )
                {
                    continue;
                }

                BuilderProGroupRepository.removeItem(
                        itemId.intValue()
                );
            }
        }
    }

    private static BuilderProGroupRepository.SavedGroup requireGroup(
            int roomId,
            int groupId)
            throws Exception
    {
        if(groupId <= 0)
        {
            return null;
        }

        return BuilderProGroupRepository.find(
                roomId,
                groupId
        );
    }

    private static Result missingGroup(
            int roomId)
            throws Exception
    {
        return Result.failure(
                19,
                "El grupo ya no existe en esta sala.",
                BuilderProGroupRepository.list(
                        roomId
                )
        );
    }

    private static Validation validateMembers(
            Room room,
            List<Integer> requestedIds,
            int allowedGroupId)
            throws Exception
    {
        LinkedHashSet<Integer> unique =
                new LinkedHashSet<Integer>();

        if(requestedIds != null)
        {
            for(Integer id : requestedIds)
            {
                if(id != null && id.intValue() > 0)
                {
                    unique.add(
                            id.intValue()
                    );
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

        if(unique.size() > MAX_GROUP_SIZE)
        {
            return Validation.failure(
                    21,
                    "El grupo supera el limite de 100 furnis."
            );
        }

        List<Integer> itemIds =
                new ArrayList<Integer>(
                        unique
                );

        for(Integer id : itemIds)
        {
            HabboItem item =
                    room.getHabboItem(
                            id.intValue()
                    );

            if(item == null)
            {
                return Validation.failure(
                        22,
                        "Uno de los furnis ya no esta en la sala."
                );
            }

            if(item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR)
            {
                return Validation.failure(
                        23,
                        "Los grupos solo admiten furnis de suelo."
                );
            }
        }

        Map<Integer, Integer> memberships =
                BuilderProGroupRepository
                        .memberships(
                                itemIds
                        );

        for(Map.Entry<Integer, Integer> entry :
                memberships.entrySet())
        {
            if(entry.getValue().intValue()
                    != allowedGroupId)
            {
                return Validation.failure(
                        24,
                        "Uno de los furnis ya pertenece a otro grupo."
                );
            }
        }

        return Validation.success(
                itemIds
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

    private static List<BuilderProGroupRepository.SavedGroup> safeList(
            int roomId)
    {
        try
        {
            return BuilderProGroupRepository.list(
                    roomId
            );
        }
        catch(Exception ignored)
        {
            return new ArrayList<BuilderProGroupRepository.SavedGroup>();
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
        public final List<BuilderProGroupRepository.SavedGroup> groups;

        private Result(
                boolean success,
                int code,
                String message,
                List<BuilderProGroupRepository.SavedGroup> groups)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.groups = groups;
        }

        public static Result success(
                String message,
                List<BuilderProGroupRepository.SavedGroup> groups)
        {
            return new Result(
                    true,
                    0,
                    message,
                    groups
            );
        }

        public static Result failure(
                int code,
                String message,
                List<BuilderProGroupRepository.SavedGroup> groups)
        {
            return new Result(
                    false,
                    code,
                    message,
                    groups
            );
        }
    }
}
