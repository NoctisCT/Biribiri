package com.retro.builderpro;

import java.util.Collections;
import java.util.HashMap;
import java.util.Map;

public final class BuilderProContext
{
    private static final ThreadLocal<Operation> ACTIVE =
            new ThreadLocal<Operation>();

    private BuilderProContext()
    {
    }

    public static void begin(
            int actorId,
            Map<Integer, Double> forcedHeights)
    {
        if(ACTIVE.get() != null)
        {
            throw new IllegalStateException(
                    "Ya existe una operacion Builder Pro activa en este hilo."
            );
        }

        ACTIVE.set(
                new Operation(
                        actorId,
                        forcedHeights
                )
        );
    }

    public static void clear()
    {
        ACTIVE.remove();
    }

    public static boolean appliesTo(
            int actorId,
            int itemId)
    {
        Operation operation = ACTIVE.get();

        return operation != null
                && operation.actorId == actorId
                && operation.forcedHeights.containsKey(itemId);
    }

    public static Double getForcedHeight(
            int actorId,
            int itemId)
    {
        Operation operation = ACTIVE.get();

        if(operation == null
                || operation.actorId != actorId)
        {
            return null;
        }

        return operation.forcedHeights.get(itemId);
    }

    private static final class Operation
    {
        private final int actorId;
        private final Map<Integer, Double> forcedHeights;

        private Operation(
                int actorId,
                Map<Integer, Double> forcedHeights)
        {
            this.actorId = actorId;
            this.forcedHeights =
                    Collections.unmodifiableMap(
                            new HashMap<Integer, Double>(
                                    forcedHeights
                            )
                    );
        }
    }
}
