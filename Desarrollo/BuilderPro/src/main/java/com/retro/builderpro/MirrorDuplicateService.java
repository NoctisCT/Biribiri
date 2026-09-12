package com.retro.builderpro;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

public final class MirrorDuplicateService
{
    public static final int AXIS_HORIZONTAL = 1;
    public static final int AXIS_VERTICAL = 2;

    private MirrorDuplicateService()
    {
    }

    public static Result prepare(
            Habbo actor,
            List<Integer> requestedIds,
            int axis,
            int pivotId,
            List<Integer> targetRotations)
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

        if(axis != AXIS_HORIZONTAL
                && axis != AXIS_VERTICAL)
        {
            return Result.failure(
                    4,
                    "Eje de espejo desconocido."
            );
        }

        if(requestedIds == null
                || requestedIds.isEmpty()
                || requestedIds.size()
                > CopyGroupService.MAX_GROUP_SIZE)
        {
            return Result.failure(
                    5,
                    "Seleccion invalida."
            );
        }

        LinkedHashSet<Integer> unique =
                new LinkedHashSet<Integer>(
                        requestedIds
                );

        if(unique.size() != requestedIds.size()
                || !unique.contains(
                        Integer.valueOf(
                                pivotId
                        )
                ))
        {
            return Result.failure(
                    6,
                    "La seleccion o el pivote no son validos."
            );
        }

        if(targetRotations == null
                || targetRotations.size()
                != requestedIds.size())
        {
            return Result.failure(
                    7,
                    "Faltan orientaciones reflejadas."
            );
        }

        int pivotIndex =
                requestedIds.indexOf(
                        Integer.valueOf(
                                pivotId
                        )
                );

        if(pivotIndex < 0)
        {
            return Result.failure(
                    8,
                    "El pivote no pertenece a la seleccion."
            );
        }

        List<Integer> orderedIds =
                new ArrayList<Integer>();

        List<Integer> orderedRotations =
                new ArrayList<Integer>();

        orderedIds.add(
                pivotId
        );

        orderedRotations.add(
                normalizeRotation(
                        targetRotations.get(
                                pivotIndex
                        ).intValue()
                )
        );

        for(int index = 0;
                index < requestedIds.size();
                index++)
        {
            if(index == pivotIndex)
            {
                continue;
            }

            orderedIds.add(
                    requestedIds.get(index)
            );

            orderedRotations.add(
                    normalizeRotation(
                            targetRotations.get(index)
                                    .intValue()
                    )
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        CopyGroupService.Clipboard previous =
                CopyGroupService.getClipboard(
                        actorId
                );

        CopyGroupService.Result copied =
                CopyGroupService.copy(
                        actor,
                        orderedIds
                );

        if(!copied.success)
        {
            CopyGroupService.setClipboard(
                    actorId,
                    previous
            );

            return Result.failure(
                    copied.code,
                    copied.message
            );
        }

        CopyGroupService.Clipboard source =
                CopyGroupService.getClipboard(
                        actorId
                );

        CopyGroupService.Clipboard mirrored =
                CopyGroupService.createMirroredClipboard(
                        source,
                        axis,
                        orderedRotations
                );

        if(mirrored == null
                || mirrored.size()
                != orderedIds.size())
        {
            CopyGroupService.setClipboard(
                    actorId,
                    previous
            );

            return Result.failure(
                    9,
                    "No se pudo preparar la copia reflejada."
            );
        }

        CopyGroupService.setClipboard(
                actorId,
                mirrored
        );

        return Result.success(
                mirrored,
                axis == AXIS_HORIZONTAL
                        ? "Espejo horizontal preparado."
                        : "Espejo vertical preparado."
        );
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

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final CopyGroupService.Clipboard clipboard;

        private Result(
                boolean success,
                int code,
                String message,
                CopyGroupService.Clipboard clipboard)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.clipboard = clipboard;
        }

        public int preparedCount()
        {
            return this.clipboard == null
                    ? 0
                    : this.clipboard.size();
        }

        public static Result success(
                CopyGroupService.Clipboard clipboard,
                String message)
        {
            return new Result(
                    true,
                    0,
                    message,
                    clipboard
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
                    null
            );
        }
    }
}
