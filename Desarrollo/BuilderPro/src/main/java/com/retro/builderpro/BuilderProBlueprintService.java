package com.retro.builderpro;

import com.eu.habbo.habbohotel.items.FurnitureType;
import com.eu.habbo.habbohotel.items.interactions.InteractionStackHelper;
import com.eu.habbo.habbohotel.items.interactions.InteractionTileWalkMagic;
import com.eu.habbo.habbohotel.rooms.Room;
import com.eu.habbo.habbohotel.users.Habbo;
import com.eu.habbo.habbohotel.users.HabboItem;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

public final class BuilderProBlueprintService
{
    public static final int OP_LIST = 0;
    public static final int OP_CREATE = 1;
    public static final int OP_RENAME = 2;
    public static final int OP_DELETE = 3;
    public static final int OP_PLACE = 4;
    public static final int OP_PREVIEW = 5;

    public static final int MAX_BLUEPRINTS = 100;
    public static final int MAX_BLUEPRINT_SIZE = Room.MAXIMUM_FURNI;
    public static final int MAX_NAME_LENGTH = 50;

    private BuilderProBlueprintService()
    {
    }

    public static Result execute(
            Habbo actor,
            int operation,
            int blueprintId,
            String name,
            int anchorX,
            int anchorY,
            List<Integer> itemIds)
    {
        if(actor == null
                || actor.getHabboInfo() == null)
        {
            return Result.failure(
                    1,
                    "Usuario no disponible.",
                    new ArrayList<BuilderProBlueprintRepository.SavedBlueprint>()
            );
        }

        int ownerId =
                actor.getHabboInfo()
                        .getId();

        try
        {
            if(operation == OP_LIST)
            {
                return Result.success(
                        "Blueprints cargados.",
                        BuilderProBlueprintRepository.list(
                                ownerId
                        ),
                        new ArrayList<Integer>()
                );
            }

            if(operation == OP_CREATE)
            {
                if(!actor.getHabboStats()
                        .hasActiveClub())
                {
                    return Result.failure(
                            18,
                            "Guardar blueprints requiere Biri Club.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                Room room =
                        actor.getHabboInfo()
                                .getCurrentRoom();

                if(room == null)
                {
                    return Result.failure(
                            20,
                            "No hay una sala activa.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(!room.hasRights(actor))
                {
                    return Result.failure(
                            21,
                            "No tienes permisos de construccion en esta sala.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(itemIds == null
                        || itemIds.isEmpty())
                {
                    return Result.failure(
                            22,
                            "Selecciona al menos un furni.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                LinkedHashSet<Integer> uniqueIds =
                        new LinkedHashSet<Integer>(
                                itemIds
                        );

                if(uniqueIds.size()
                        != itemIds.size())
                {
                    return Result.failure(
                            23,
                            "La seleccion contiene IDs duplicados.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(uniqueIds.size()
                        > MAX_BLUEPRINT_SIZE)
                {
                    return Result.failure(
                            24,
                            "La seleccion supera el limite de " + MAX_BLUEPRINT_SIZE + " furnis.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                List<BuilderProBlueprintRepository.SavedBlueprint> current =
                        BuilderProBlueprintRepository.list(
                                ownerId
                        );

                if(current.size()
                        >= MAX_BLUEPRINTS)
                {
                    return Result.failure(
                            25,
                            "Has alcanzado el limite de blueprints.",
                            current
                    );
                }

                String normalized =
                        normalizeName(
                                name
                        );

                if(normalized.isEmpty())
                {
                    normalized =
                            BuilderProBlueprintRepository
                                    .nextDefaultName(
                                            ownerId
                                    );
                }

                if(normalized.length()
                        > MAX_NAME_LENGTH)
                {
                    return Result.failure(
                            26,
                            "El nombre del blueprint es demasiado largo.",
                            current
                    );
                }

                if(BuilderProBlueprintRepository
                        .nameExists(
                                ownerId,
                                normalized,
                                0
                        ))
                {
                    return Result.failure(
                            27,
                            "Ya tienes un blueprint con ese nombre.",
                            current
                    );
                }

                List<HabboItem> sourceItems =
                        new ArrayList<HabboItem>(
                                uniqueIds.size()
                        );

                for(Integer itemId :
                        uniqueIds)
                {
                    if(itemId == null
                            || itemId.intValue() <= 0)
                    {
                        return Result.failure(
                                28,
                                "La seleccion contiene un furni invalido.",
                                current
                        );
                    }

                    HabboItem item =
                            room.getHabboItem(
                                    itemId.intValue()
                            );

                    if(item == null)
                    {
                        return Result.failure(
                                29,
                                "Uno de los furnis ya no existe en la sala.",
                                current
                        );
                    }

                    if(item.getBaseItem() == null
                            || item.getBaseItem()
                                    .getType()
                            != FurnitureType.FLOOR)
                    {
                        return Result.failure(
                                30,
                                "Los blueprints solo admiten furnis de suelo.",
                                current
                        );
                    }

                    if(item instanceof InteractionStackHelper
                            || item instanceof InteractionTileWalkMagic)
                    {
                        return Result.failure(
                                31,
                                "Los blueprints no admiten baldosas auxiliares.",
                                current
                        );
                    }

                    sourceItems.add(
                            item
                    );
                }

                HabboItem anchor =
                        sourceItems.get(0);

                short originX =
                        anchor.getX();

                short originY =
                        anchor.getY();

                double originZ =
                        anchor.getZ();

                List<BuilderProBlueprintRepository.BlueprintItem> entries =
                        new ArrayList<BuilderProBlueprintRepository.BlueprintItem>(
                                sourceItems.size()
                        );

                for(HabboItem item :
                        sourceItems)
                {
                    entries.add(
                            new BuilderProBlueprintRepository.BlueprintItem(
                                    item.getBaseItem()
                                            .getId(),
                                    item.getBaseItem()
                                            .getName(),
                                    item.getX()
                                            - originX,
                                    item.getY()
                                            - originY,
                                    roundZ(
                                            item.getZ()
                                                    - originZ
                                    ),
                                    normalizeRotation(
                                            item.getRotation()
                                    ),
                                    item.getExtradata() == null
                                            ? ""
                                            : item.getExtradata()
                            )
                    );
                }

                BuilderProBlueprintRepository.create(
                        ownerId,
                        normalized,
                        entries
                );

                return Result.success(
                        normalized
                                + " guardado con "
                                + entries.size()
                                + " furnis.",
                        BuilderProBlueprintRepository.list(
                                ownerId
                        ),
                        new ArrayList<Integer>()
                );
            }

            if(operation == OP_PREVIEW)
            {
                if(!actor.getHabboStats()
                        .hasActiveClub())
                {
                    return Result.failure(
                            42,
                            "Usar blueprints requiere Biri Club.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                BuilderProBlueprintRepository.StoredBlueprint blueprint =
                        BuilderProBlueprintRepository.find(
                                ownerId,
                                blueprintId
                        );

                if(blueprint == null)
                {
                    return Result.failure(
                            43,
                            "El blueprint ya no existe.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(blueprint.items == null
                        || blueprint.items.isEmpty()
                        || blueprint.items.size()
                        > MAX_BLUEPRINT_SIZE)
                {
                    return Result.failure(
                            44,
                            "El blueprint no se puede previsualizar.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                BuilderProRateLimiter.Result rateLimit =
                        BuilderProRateLimiter.acquireItems(
                                actor,
                                "blueprint-preview",
                                blueprint.items.size()
                        );

                if(!rateLimit.allowed)
                {
                    return Result.failure(
                            98,
                            rateLimit.message,
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                return Result.success(
                        "Blueprint preparado.",
                        BuilderProBlueprintRepository.list(
                                ownerId
                        ),
                        new ArrayList<Integer>()
                );
            }

            if(operation == OP_PLACE)
            {
                if(!actor.getHabboStats()
                        .hasActiveClub())
                {
                    return Result.failure(
                            32,
                            "Colocar blueprints requiere Biri Club.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                Room room =
                        actor.getHabboInfo()
                                .getCurrentRoom();

                if(room == null
                        || room.getLayout() == null)
                {
                    return Result.failure(
                            33,
                            "No hay una sala activa.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(!room.hasRights(actor))
                {
                    return Result.failure(
                            34,
                            "No tienes permisos de construccion en esta sala.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                BuilderProBlueprintRepository.StoredBlueprint blueprint =
                        BuilderProBlueprintRepository.find(
                                ownerId,
                                blueprintId
                        );

                if(blueprint == null)
                {
                    return Result.failure(
                            35,
                            "El blueprint ya no existe.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(blueprint.items == null
                        || blueprint.items.isEmpty())
                {
                    return Result.failure(
                            36,
                            "El blueprint esta vacio.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(blueprint.items.size()
                        > MAX_BLUEPRINT_SIZE)
                {
                    return Result.failure(
                            37,
                            "El blueprint supera el limite admitido.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(anchorX < Short.MIN_VALUE
                        || anchorX > Short.MAX_VALUE
                        || anchorY < Short.MIN_VALUE
                        || anchorY > Short.MAX_VALUE)
                {
                    return Result.failure(
                            38,
                            "La posicion destino es invalida.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(room.getLayout()
                        .getTile(
                                (short)anchorX,
                                (short)anchorY
                        ) == null)
                {
                    return Result.failure(
                            39,
                            "El destino queda fuera del mapa.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                double minimumOffsetZ =
                        Double.POSITIVE_INFINITY;

                for(BuilderProBlueprintRepository.BlueprintItem item :
                        blueprint.items)
                {
                    minimumOffsetZ =
                            Math.min(
                                    minimumOffsetZ,
                                    item.offsetZ
                            );
                }

                if(!Double.isFinite(
                        minimumOffsetZ
                ))
                {
                    return Result.failure(
                            40,
                            "La geometria vertical del blueprint es invalida.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                double destinationSurfaceZ =
                        room.getStackHeight(
                                (short)anchorX,
                                (short)anchorY,
                                true
                        );

                double destinationOriginZ =
                        roundZ(
                                destinationSurfaceZ
                                        - minimumOffsetZ
                        );

                CopyGroupService.Clipboard blueprintClipboard =
                        CopyGroupService.createBlueprintClipboard(
                                destinationOriginZ,
                                blueprint.items
                        );

                if(blueprintClipboard == null)
                {
                    return Result.failure(
                            40,
                            "No se pudo preparar el blueprint.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                CopyGroupService.Clipboard previousClipboard =
                        CopyGroupService.getClipboard(
                                ownerId
                        );

                PasteGroupService.Result pasteResult;

                try
                {
                    CopyGroupService.setClipboard(
                            ownerId,
                            blueprintClipboard
                    );

                    pasteResult =
                            PasteGroupService.paste(
                                    actor,
                                    anchorX,
                                    anchorY,
                                    blueprintId
                            );
                }
                finally
                {
                    CopyGroupService.setClipboard(
                            ownerId,
                            previousClipboard
                    );
                }

                if(!pasteResult.success)
                {
                    return Result.failure(
                            41,
                            pasteResult.message,
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                return Result.success(
                        blueprint.name
                                + " colocado con "
                                + pasteResult.placedCount
                                + " furnis.",
                        BuilderProBlueprintRepository.list(
                                ownerId
                        ),
                        pasteResult.itemIds
                );
            }

            if(operation == OP_RENAME)
            {
                if(blueprintId <= 0)
                {
                    return Result.failure(
                            10,
                            "Blueprint invalido.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                String normalized =
                        normalizeName(
                                name
                        );

                if(normalized.isEmpty())
                {
                    return Result.failure(
                            11,
                            "Escribe un nombre para el blueprint.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(normalized.length()
                        > MAX_NAME_LENGTH)
                {
                    return Result.failure(
                            12,
                            "El nombre del blueprint es demasiado largo.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(BuilderProBlueprintRepository
                        .nameExists(
                                ownerId,
                                normalized,
                                blueprintId
                        ))
                {
                    return Result.failure(
                            13,
                            "Ya tienes un blueprint con ese nombre.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(!BuilderProBlueprintRepository.rename(
                        ownerId,
                        blueprintId,
                        normalized
                ))
                {
                    return Result.failure(
                            14,
                            "El blueprint ya no existe.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                return Result.success(
                        "Blueprint renombrado.",
                        BuilderProBlueprintRepository.list(
                                ownerId
                        ),
                        new ArrayList<Integer>()
                );
            }

            if(operation == OP_DELETE)
            {
                if(blueprintId <= 0)
                {
                    return Result.failure(
                            15,
                            "Blueprint invalido.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                if(!BuilderProBlueprintRepository.delete(
                        ownerId,
                        blueprintId
                ))
                {
                    return Result.failure(
                            16,
                            "El blueprint ya no existe.",
                            BuilderProBlueprintRepository.list(
                                    ownerId
                            )
                    );
                }

                return Result.success(
                        "Blueprint eliminado.",
                        BuilderProBlueprintRepository.list(
                                ownerId
                        ),
                        new ArrayList<Integer>()
                );
            }

            return Result.failure(
                    17,
                    "Operacion de blueprint desconocida.",
                    BuilderProBlueprintRepository.list(
                            ownerId
                    )
            );
        }
        catch(Exception exception)
        {
            System.err.println(
                    "[BuilderPro] Error gestionando blueprints."
            );

            exception.printStackTrace();

            return Result.failure(
                    90,
                    "Error interno al gestionar blueprints.",
                    safeList(
                            ownerId
                    )
            );
        }
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

    private static String normalizeName(
            String value)
    {
        if(value == null)
        {
            return "";
        }

        return value
                .replace(
                        '\r',
                        ' '
                )
                .replace(
                        '\n',
                        ' '
                )
                .replace(
                        '\t',
                        ' '
                )
                .trim()
                .replaceAll(
                        "\\s+",
                        " "
                );
    }

    private static List<BuilderProBlueprintRepository.SavedBlueprint> safeList(
            int ownerId)
    {
        try
        {
            return BuilderProBlueprintRepository.list(
                    ownerId
            );
        }
        catch(Exception ignored)
        {
            return new ArrayList<BuilderProBlueprintRepository.SavedBlueprint>();
        }
    }

    public static final class Result
    {
        public final boolean success;
        public final int code;
        public final String message;
        public final List<BuilderProBlueprintRepository.SavedBlueprint> blueprints;
        public final List<Integer> placedItemIds;

        private Result(
                boolean success,
                int code,
                String message,
                List<BuilderProBlueprintRepository.SavedBlueprint> blueprints,
                List<Integer> placedItemIds)
        {
            this.success =
                    success;

            this.code =
                    code;

            this.message =
                    message == null
                            ? ""
                            : message;

            this.blueprints =
                    new ArrayList<BuilderProBlueprintRepository.SavedBlueprint>(
                            blueprints
                    );

            this.placedItemIds =
                    new ArrayList<Integer>(
                            placedItemIds
                    );
        }

        public static Result success(
                String message,
                List<BuilderProBlueprintRepository.SavedBlueprint> blueprints,
                List<Integer> placedItemIds)
        {
            return new Result(
                    true,
                    0,
                    message,
                    blueprints,
                    placedItemIds
            );
        }

        public static Result failure(
                int code,
                String message,
                List<BuilderProBlueprintRepository.SavedBlueprint> blueprints)
        {
            return new Result(
                    false,
                    code,
                    message,
                    blueprints,
                    new ArrayList<Integer>()
            );
        }
    }
}
