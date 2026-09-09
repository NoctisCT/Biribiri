package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.interactions.InteractionStackHelper;
import com.eu.habbo.habbohotel.items.interactions.InteractionTileWalkMagic;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

public final class CopyGroupService
{
    public static final int MAX_GROUP_SIZE = 100;

    private static final ConcurrentMap<Integer, Clipboard> CLIPBOARDS =
            new ConcurrentHashMap<Integer, Clipboard>();

    private CopyGroupService()
    {
    }

    public static Result copy(
            Habbo actor,
            List<Integer> requestedIds)
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

        if(uniqueIds.size() != requestedIds.size())
        {
            return Result.failure(
                    5,
                    "La seleccion contiene IDs duplicados."
            );
        }

        if(uniqueIds.size() > MAX_GROUP_SIZE)
        {
            return Result.failure(
                    6,
                    "La seleccion supera el limite de Builder Pro."
            );
        }

        List<SourceSnapshot> snapshots =
                new ArrayList<SourceSnapshot>();

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
                        "Builder Pro Copy solo admite furnis de suelo."
                );
            }

            if(item instanceof InteractionStackHelper
                    || item instanceof InteractionTileWalkMagic)
            {
                return Result.failure(
                        10,
                        "Builder Pro Copy no admite baldosas de arquitecto."
                );
            }

            SourceSnapshot snapshot =
                    new SourceSnapshot(item);

            snapshots.add(snapshot);

        }

        SourceSnapshot anchor =
                snapshots.get(0);

        short originX = anchor.x;
        short originY = anchor.y;
        double originZ = anchor.z;

        List<Entry> entries =
                new ArrayList<Entry>(
                        snapshots.size()
                );

        for(SourceSnapshot snapshot : snapshots)
        {
            entries.add(
                    new Entry(
                            snapshot.baseItemId,
                            snapshot.baseItemName,
                            snapshot.x - originX,
                            snapshot.y - originY,
                            roundZ(
                                    snapshot.z - originZ
                            ),
                            snapshot.rotation,
                            snapshot.extraData
                    )
            );
        }

        int actorId =
                actor.getHabboInfo()
                        .getId();

        Clipboard clipboard =
                new Clipboard(
                        originZ,
                        entries
                );

        CLIPBOARDS.put(
                actorId,
                clipboard
        );

        System.out.println(
                "[BuilderProTrace] SERVER COPY items="
                        + entries.size()
                        + " actor="
                        + actorId
        );

        return Result.success(
                entries.size()
        );
    }

    public static Clipboard getClipboard(
            int actorId)
    {
        return CLIPBOARDS.get(
                actorId
        );
    }

    public static void clear(
            int actorId)
    {
        CLIPBOARDS.remove(
                actorId
        );
    }

    public static void clearAll()
    {
        CLIPBOARDS.clear();
    }

    private static int normalizeRotation(
            int rotation)
    {
        int normalized =
                rotation % 8;

        if(normalized < 0)
        {
            normalized += 8;
        }

        return normalized;
    }

    private static double roundZ(
            double value)
    {
        return Math.round(
                value * 1000000.0D
        ) / 1000000.0D;
    }

    private static final class SourceSnapshot
    {
        private final int baseItemId;
        private final String baseItemName;
        private final short x;
        private final short y;
        private final double z;
        private final int rotation;
        private final String extraData;

        private SourceSnapshot(
                HabboItem item)
        {
            this.baseItemId =
                    item.getBaseItem()
                            .getId();

            this.baseItemName =
                    item.getBaseItem()
                            .getName();

            this.x = item.getX();
            this.y = item.getY();
            this.z = item.getZ();

            this.rotation =
                    normalizeRotation(
                            item.getRotation()
                    );

            this.extraData =
                    item.getExtradata() == null
                            ? ""
                            : item.getExtradata();
        }
    }

    public static final class Clipboard
    {
        private final double sourceOriginZ;
        private final List<Entry> entries;

        private Clipboard(
                double sourceOriginZ,
                List<Entry> entries)
        {
            this.sourceOriginZ =
                    roundZ(sourceOriginZ);

            this.entries =
                    Collections.unmodifiableList(
                            new ArrayList<Entry>(
                                    entries
                            )
                    );
        }

        public double getSourceOriginZ()
        {
            return this.sourceOriginZ;
        }

        public List<Entry> getEntries()
        {
            return this.entries;
        }

        public int size()
        {
            return this.entries.size();
        }
    }

    public static final class Entry
    {
        private final int baseItemId;
        private final String baseItemName;
        private final int offsetX;
        private final int offsetY;
        private final double offsetZ;
        private final int rotation;
        private final String extraData;

        private Entry(
                int baseItemId,
                String baseItemName,
                int offsetX,
                int offsetY,
                double offsetZ,
                int rotation,
                String extraData)
        {
            this.baseItemId = baseItemId;
            this.baseItemName =
                    baseItemName == null
                            ? ""
                            : baseItemName;
            this.offsetX = offsetX;
            this.offsetY = offsetY;
            this.offsetZ = offsetZ;
            this.rotation =
                    normalizeRotation(
                            rotation
                    );
            this.extraData = extraData;
        }

        public int getBaseItemId()
        {
            return this.baseItemId;
        }

        public String getBaseItemName()
        {
            return this.baseItemName;
        }

        public int getOffsetX()
        {
            return this.offsetX;
        }

        public int getOffsetY()
        {
            return this.offsetY;
        }

        public double getOffsetZ()
        {
            return this.offsetZ;
        }

        public int getRotation()
        {
            return this.rotation;
        }

        public String getExtraData()
        {
            return this.extraData;
        }
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final int copiedCount;

        private Result(
                boolean success,
                int code,
                String message,
                int copiedCount)
        {
            this.success = success;
            this.code = code;
            this.message = message;
            this.copiedCount = copiedCount;
        }

        public static Result success(
                int copiedCount)
        {
            return new Result(
                    true,
                    0,
                    "OK",
                    copiedCount
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
