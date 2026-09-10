package com.retro.builderpro;

import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public final class BuilderProGroupGuard
{
    private BuilderProGroupGuard()
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

        LinkedHashSet<Integer> requested =
                new LinkedHashSet<Integer>();

        if(requestedIds != null)
        {
            for(Integer itemId :
                    requestedIds)
            {
                if(itemId != null)
                {
                    requested.add(
                            itemId
                    );
                }
            }
        }

        if(requested.isEmpty())
        {
            return Result.success();
        }

        try
        {
            List<Integer> ids =
                    new ArrayList<Integer>(
                            requested
                    );

            Map<Integer, Integer> memberships =
                    BuilderProGroupRepository
                            .memberships(
                                    ids
                            );

            Set<Integer> touchedGroups =
                    new HashSet<Integer>(
                            memberships.values()
                    );

            for(Integer groupId :
                    touchedGroups)
            {
                BuilderProGroupRepository.SavedGroup group =
                        BuilderProGroupRepository.find(
                                room.getId(),
                                groupId.intValue()
                        );

                if(group == null)
                {
                    for(Map.Entry<Integer, Integer> entry :
                            memberships.entrySet())
                    {
                        if(
                            entry.getValue()
                                    .equals(
                                            groupId
                                    )
                        )
                        {
                            BuilderProGroupRepository.removeItem(
                                    entry.getKey()
                                            .intValue()
                            );
                        }
                    }

                    continue;
                }

                if(!group.locked)
                {
                    continue;
                }

                List<Integer> liveMembers =
                        new ArrayList<Integer>();

                for(Integer memberId :
                        group.itemIds)
                {
                    if(
                        room.getHabboItem(
                                memberId.intValue()
                        ) == null
                    )
                    {
                        BuilderProGroupRepository.removeItem(
                                memberId.intValue()
                        );

                        continue;
                    }

                    liveMembers.add(
                            memberId
                    );
                }

                for(Integer memberId :
                        liveMembers)
                {
                    if(
                        !requested.contains(
                                memberId
                        )
                    )
                    {
                        return Result.failure(
                                "Un grupo bloqueado debe manipularse completo."
                        );
                    }
                }
            }

            return Result.success();
        }
        catch(Exception exception)
        {
            exception.printStackTrace();

            return Result.failure(
                    "No se pudo validar el bloqueo del grupo."
            );
        }
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
            this.message = message;
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
