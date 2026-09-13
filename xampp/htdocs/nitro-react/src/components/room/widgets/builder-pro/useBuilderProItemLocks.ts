import { BuilderProItemLockStateComposer, BuilderProItemLockStateEvent } from '@nitrots/nitro-renderer';
import { Dispatch, SetStateAction, useCallback, useEffect, useRef, useState } from 'react';
import { SendMessageComposer, SetBuilderProItemLockRequestHandler } from '../../../../api';
import { useMessageEvent } from '../../../../hooks';

const ITEM_LOCK_OP_QUERY = 0;
const ITEM_LOCK_OP_SET = 1;

type UseBuilderProItemLocksResult = {
    lockedItemIds: number[];
    itemLockPending: boolean;
    requestItemLockState: (
        operation: number,
        enabled?: boolean,
        itemIds?: number[]
    ) => boolean;
};

export const useBuilderProItemLocks = (
    active: boolean,
    roomId: number | null,
    setStatus: Dispatch<SetStateAction<string>>
): UseBuilderProItemLocksResult =>
{
    const [ lockedItemIds, setLockedItemIds ] =
        useState<number[]>([]);
    const [ itemLockPending, setItemLockPending ] =
        useState(false);

    const activeRef = useRef(active);
    const pendingRef = useRef(false);
    const requestIdRef = useRef(0);
    const operationRef = useRef(ITEM_LOCK_OP_QUERY);
    const timeoutRef = useRef<number | null>(null);

    useEffect(() =>
    {
        activeRef.current = active;
    }, [ active ]);

    const clearTimeoutRef = useCallback(() =>
    {
        if(timeoutRef.current === null)
        {
            return;
        }

        window.clearTimeout(
            timeoutRef.current
        );

        timeoutRef.current = null;
    }, []);

    const requestItemLockState =
        useCallback((
            operation: number,
            enabled = false,
            itemIds: number[] = []
        ): boolean =>
        {
            if(!activeRef.current)
            {
                return false;
            }

            if(pendingRef.current)
            {
                return false;
            }

            requestIdRef.current++;

            if(requestIdRef.current > 2000000000)
            {
                requestIdRef.current = 1;
            }

            const requestId =
                requestIdRef.current;

            operationRef.current =
                operation;

            pendingRef.current =
                true;

            setItemLockPending(
                true
            );

            SendMessageComposer(
                new BuilderProItemLockStateComposer(
                    requestId,
                    operation,
                    enabled,
                    itemIds
                )
            );

            clearTimeoutRef();

            timeoutRef.current =
                window.setTimeout(
                    () =>
                    {
                        timeoutRef.current =
                            null;

                        if(
                            !pendingRef.current ||
                            requestIdRef.current !==
                            requestId
                        )
                        {
                            return;
                        }

                        pendingRef.current =
                            false;

                        setItemLockPending(
                            false
                        );

                        setStatus(
                            'Sin respuesta al actualizar el bloqueo.'
                        );
                    },
                    3000
                );

            return true;
        }, [
            clearTimeoutRef,
            setStatus
        ]);

    useMessageEvent<BuilderProItemLockStateEvent>(
        BuilderProItemLockStateEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            if(
                parser.requestId !==
                requestIdRef.current
            )
            {
                return;
            }

            clearTimeoutRef();

            pendingRef.current =
                false;

            setItemLockPending(
                false
            );

            setLockedItemIds([
                ...parser.itemIds
            ]);

            if(
                operationRef.current !==
                ITEM_LOCK_OP_QUERY ||
                !parser.success
            )
            {
                setStatus(
                    parser.success
                        ? parser.message
                        : `Error ${ parser.code }: ${ parser.message }`
                );
            }
        }
    );

    useEffect(() =>
    {
        if(!active || !roomId)
        {
            clearTimeoutRef();
            pendingRef.current = false;
            setItemLockPending(false);
            setLockedItemIds([]);
            return;
        }

        pendingRef.current = false;
        setItemLockPending(false);

        requestItemLockState(
            ITEM_LOCK_OP_QUERY
        );
    }, [
        active,
        roomId,
        clearTimeoutRef,
        requestItemLockState
    ]);

    useEffect(() =>
    {
        if(!active)
        {
            SetBuilderProItemLockRequestHandler(
                null
            );

            return;
        }

        SetBuilderProItemLockRequestHandler(
            (
                itemIds: number[],
                enabled: boolean
            ) =>
                requestItemLockState(
                    ITEM_LOCK_OP_SET,
                    enabled,
                    itemIds
                )
        );

        return () =>
        {
            SetBuilderProItemLockRequestHandler(
                null
            );
        };
    }, [
        active,
        requestItemLockState
    ]);

    useEffect(() =>
    {
        return () =>
        {
            clearTimeoutRef();
            pendingRef.current = false;

            SetBuilderProItemLockRequestHandler(
                null
            );
        };
    }, [ clearTimeoutRef ]);

    return {
        lockedItemIds,
        itemLockPending,
        requestItemLockState
    };
};
