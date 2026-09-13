package com.retro.builderpro;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;

import java.util.LinkedHashSet;
import java.util.List;

public final class BuilderProItemLockGuard
{
    private BuilderProItemLockGuard()
    {
    }

    public static Result validate(
            Habbo actor,
            List<Integer> requestedIds)
    {
        if(actor == null)
        {
            return Result.failure(
                    "Usuario no disponible."
            );
        }

        Room room =
                actor.getHabboInfo()
                        .getCurrentRoom();

        if(room == null)
        {
            return Result.failure(
                    "No hay una sala activa."
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
                    unique.add(
                            itemId.intValue()
                    );
                }
            }
        }

        try
        {
            for(Integer itemId : unique)
            {
                if(BuilderProItemLockService.isLocked(
                        room,
                        itemId.intValue()))
                {
                    return Result.failure(
                            "Furni #"
                                    + itemId
                                    + " bloqueado para construccion."
                    );
                }
            }
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return Result.failure(
                    "No se pudo verificar el bloqueo de construccion."
            );
        }

        return Result.success();
    }

    public static final class Result
    {
        public final boolean success;
        public final String message;

        private Result(
                boolean success,
                String message)
        {
            this.success = success;
            this.message = message == null
                    ? ""
                    : message;
        }

        public static Result success()
        {
            return new Result(
                    true,
                    ""
            );
        }

        public static Result failure(
                String message)
        {
            return new Result(
                    false,
                    message
            );
        }
    }
}
