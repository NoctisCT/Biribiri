package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.Item;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

public final class BuilderProReferencePlacementService
{
    public static final int OP_EQUAL_Z = 1;
    public static final int OP_PLACE_ABOVE = 2;

    private BuilderProReferencePlacementService()
    {
    }

    public static Result apply(
            Habbo actor,
            List<Integer> requestedIds,
            int operation,
            int referenceId,
            int pivotId,
            int requestId)
    {
        if(actor == null)
        {
            return Result.failure(1, "Usuario no disponible.");
        }

        Room room = actor.getHabboInfo().getCurrentRoom();

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

        if(operation != OP_EQUAL_Z
                && operation != OP_PLACE_ABOVE)
        {
            return Result.failure(
                    4,
                    "Operacion de referencia desconocida."
            );
        }

        if(requestedIds == null
                || requestedIds.isEmpty())
        {
            return Result.failure(
                    5,
                    "La seleccion esta vacia."
            );
        }

        LinkedHashSet<Integer> uniqueIds =
                new LinkedHashSet<Integer>(requestedIds);

        if(uniqueIds.size() != requestedIds.size()
                || uniqueIds.size() > GroupOffsetService.MAX_GROUP_SIZE)
        {
            return Result.failure(
                    6,
                    "La seleccion no es valida."
            );
        }

        if(uniqueIds.contains(referenceId))
        {
            return Result.failure(
                    7,
                    "El furni de referencia no puede formar parte de la seleccion."
            );
        }

        HabboItem reference =
                room.getHabboItem(referenceId);

        if(reference == null
                || reference.getBaseItem() == null
                || reference.getBaseItem().getType()
                != FurnitureType.FLOOR)
        {
            return Result.failure(
                    8,
                    "El furni de referencia ya no esta disponible."
            );
        }

        List<HabboItem> selected =
                new ArrayList<HabboItem>(uniqueIds.size());

        double minimumZ =
                Double.POSITIVE_INFINITY;

        for(Integer id : uniqueIds)
        {
            if(id == null)
            {
                return Result.failure(
                        9,
                        "La seleccion contiene un ID invalido."
                );
            }

            HabboItem item =
                    room.getHabboItem(id.intValue());

            if(item == null
                    || item.getBaseItem() == null
                    || item.getBaseItem().getType()
                    != FurnitureType.FLOOR)
            {
                return Result.failure(
                        10,
                        "Uno de los furnis seleccionados ya no esta disponible."
                );
            }

            selected.add(item);

            minimumZ =
                    Math.min(
                            minimumZ,
                            item.getZ()
                    );
        }

        if(!Double.isFinite(minimumZ))
        {
            return Result.failure(
                    11,
                    "No se pudo calcular la altura de la seleccion."
            );
        }

        int deltaX = 0;
        int deltaY = 0;

        double targetMinimumZ;

        if(operation == OP_EQUAL_Z)
        {
            targetMinimumZ =
                    reference.getZ();
        }
        else
        {
            if(!uniqueIds.contains(pivotId))
            {
                return Result.failure(
                        12,
                        "El pivote debe pertenecer a la seleccion."
                );
            }

            HabboItem pivot =
                    room.getHabboItem(pivotId);

            if(pivot == null)
            {
                return Result.failure(
                        13,
                        "El pivote ya no esta disponible."
                );
            }

            deltaX =
                    reference.getX()
                            - pivot.getX();

            deltaY =
                    reference.getY()
                            - pivot.getY();

            targetMinimumZ =
                    reference.getZ()
                            + Item.getCurrentHeight(reference);
        }

        int deltaZMillis =
                (int)Math.round(
                        (
                            targetMinimumZ
                                    - minimumZ
                        ) * 1000.0D
                );

        if(deltaZMillis < -40000
                || deltaZMillis > 40000)
        {
            return Result.failure(
                    14,
                    "La diferencia de altura supera el limite de Builder Pro."
            );
        }

        if(deltaX == 0
                && deltaY == 0
                && deltaZMillis == 0)
        {
            return Result.success(
                    0,
                    operation == OP_EQUAL_Z
                            ? "La seleccion ya esta a la misma altura."
                            : "La seleccion ya esta colocada sobre la referencia."
            );
        }

        GroupOffsetService.Result offset =
                GroupOffsetService.offset(
                        actor,
                        requestedIds,
                        deltaX,
                        deltaY,
                        deltaZMillis,
                        requestId
                );

        if(!offset.success)
        {
            return Result.failure(
                    offset.code,
                    offset.message
            );
        }

        return Result.success(
                offset.affectedCount,
                operation == OP_EQUAL_Z
                        ? "Altura igualada con furni #"
                            + referenceId
                            + ": "
                            + offset.affectedCount
                            + " furnis."
                        : "Colocados encima de furni #"
                            + referenceId
                            + ": "
                            + offset.affectedCount
                            + " furnis."
        );
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
                int affectedCount,
                String message)
        {
            return new Result(
                    true,
                    0,
                    message,
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
