import { BuilderProMoveGroupComposer, BuilderProMoveGroupResultEvent, RoomControllerLevel, RoomEngineObjectEvent, RoomObjectCategory } from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { BuilderProSelectionVisualizer, CanManipulateFurniture, GetSessionDataManager, SendMessageComposer, SetBuilderProSelectionModeActive } from '../../../../api';
import { useMessageEvent, useRoom, useRoomEngineEvent } from '../../../../hooks';
import './BuilderProView.scss';

const MAX_SELECTION = 100;

export const BuilderProView: FC<{}> = props =>
{
    const { roomSession = null } = useRoom();

    const [ active, setActive ] = useState(false);
    const [ selectedIds, setSelectedIds ] = useState<number[]>([]);
    const [ pending, setPending ] = useState(false);
    const [ status, setStatus ] = useState('');
    const [ moveStep, setMoveStep ] = useState(1);

    const activeRef = useRef(false);
    const pendingRef = useRef(false);
    const selectedIdsRef = useRef<number[]>([]);
    const roomSessionRef = useRef(roomSession);

    roomSessionRef.current = roomSession;

    const sessionDataManager = GetSessionDataManager();

    const canBuild = !!roomSession &&
        (
            roomSession.isRoomOwner ||
            roomSession.controllerLevel >= RoomControllerLevel.GUEST ||
            !!sessionDataManager?.isModerator
        );

    const applySelection = useCallback((next: number[]) =>
    {
        const previous = selectedIdsRef.current;

        const previousSet = new Set(previous);
        const nextSet = new Set(next);

        for(const id of previous)
        {
            if(!nextSet.has(id))
            {
                BuilderProSelectionVisualizer.hide(id);
            }
        }

        for(const id of next)
        {
            if(!previousSet.has(id))
            {
                BuilderProSelectionVisualizer.show(id);
            }
        }

        selectedIdsRef.current = next;
        setSelectedIds(next);
    }, []);

    const clearSelection = useCallback(() =>
    {
        BuilderProSelectionVisualizer.clear(
            selectedIdsRef.current
        );

        selectedIdsRef.current = [];
        setSelectedIds([]);
    }, []);

    const deactivate = useCallback(() =>
    {
        activeRef.current = false;
        pendingRef.current = false;

        SetBuilderProSelectionModeActive(false);

        clearSelection();

        setActive(false);
        setPending(false);
        setStatus('');
    }, [ clearSelection ]);

    const activate = useCallback(() =>
    {
        if(!canBuild) return;

        clearSelection();

        activeRef.current = true;
        pendingRef.current = false;

        SetBuilderProSelectionModeActive(true);

        setActive(true);
        setPending(false);
        setStatus(
            'Haz clic en los furnis para a?adirlos o quitarlos.'
        );
    }, [ canBuild, clearSelection ]);

    const toggleMode = useCallback(() =>
    {
        if(activeRef.current)
        {
            deactivate();
            return;
        }

        activate();
    }, [ activate, deactivate ]);

    useEffect(() =>
    {
        activeRef.current = false;
        pendingRef.current = false;

        SetBuilderProSelectionModeActive(false);

        clearSelection();

        setActive(false);
        setPending(false);
        setStatus('');
    }, [ roomSession?.roomId, clearSelection ]);

    useEffect(() =>
    {
        if(canBuild) return;
        if(!activeRef.current) return;

        deactivate();
    }, [ canBuild, deactivate ]);

    useEffect(() =>
    {
        return () =>
        {
            activeRef.current = false;
            pendingRef.current = false;

            SetBuilderProSelectionModeActive(false);

            BuilderProSelectionVisualizer.clear(
                selectedIdsRef.current
            );
        };
    }, []);

    useRoomEngineEvent<RoomEngineObjectEvent>(
        [
            RoomEngineObjectEvent.SELECTED,
            RoomEngineObjectEvent.REMOVED
        ],
        event =>
        {
            if(!activeRef.current) return;
            if(event.category !== RoomObjectCategory.FLOOR) return;

            if(event.type === RoomEngineObjectEvent.REMOVED)
            {
                if(!selectedIdsRef.current.includes(event.objectId))
                {
                    return;
                }

                applySelection(
                    selectedIdsRef.current.filter(
                        id => id !== event.objectId
                    )
                );

                return;
            }

            if(event.type !== RoomEngineObjectEvent.SELECTED)
            {
                return;
            }

            const currentRoomSession =
                roomSessionRef.current;

            if(!currentRoomSession) return;

            if(!CanManipulateFurniture(
                currentRoomSession,
                event.objectId,
                event.category
            ))
            {
                setStatus(
                    'No puedes manipular este furni.'
                );

                return;
            }

            const current = selectedIdsRef.current;

            if(current.includes(event.objectId))
            {
                const next = current.filter(
                    id => id !== event.objectId
                );

                applySelection(next);

                setStatus(
                    `${ next.length } furnis seleccionados.`
                );

                return;
            }

            if(current.length >= MAX_SELECTION)
            {
                setStatus(
                    `L?mite de ${ MAX_SELECTION } furnis alcanzado.`
                );

                return;
            }

            const next = [
                ...current,
                event.objectId
            ];

            applySelection(next);

            setStatus(
                `${ next.length } furnis seleccionados.`
            );
        }
    );

    useMessageEvent<BuilderProMoveGroupResultEvent>(
        BuilderProMoveGroupResultEvent,
        event =>
        {
            if(!pendingRef.current) return;

            const parser = event.getParser();

            if(!parser) return;

            pendingRef.current = false;

            setPending(false);

            if(parser.success)
            {
                setStatus(
                    `Movimiento completado: ${ parser.movedCount } furnis.`
                );

                window.requestAnimationFrame(() =>
                {
                    BuilderProSelectionVisualizer.refresh(
                        selectedIdsRef.current
                    );
                });

                return;
            }

            setStatus(
                `Error ${ parser.code }: ${ parser.message }`
            );
        }
    );

    const moveGroup = useCallback(
        (deltaX: number, deltaY: number) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            const ids = [
                ...selectedIdsRef.current
            ];

            if(!ids.length)
            {
                setStatus(
                    'Selecciona al menos un furni.'
                );

                return;
            }

            pendingRef.current = true;

            setPending(true);
            setStatus(
                `Moviendo ${ ids.length } furnis...`
            );

            try
            {
                SendMessageComposer(
                    new BuilderProMoveGroupComposer(
                        ids,
                        deltaX,
                        deltaY
                    )
                );
            }
            catch(error)
            {
                pendingRef.current = false;

                setPending(false);
                setStatus(
                    'No se pudo enviar la operaci?n al servidor.'
                );
            }
        },
        []
    );

    if(!roomSession || !canBuild) return null;

    return (
        <div className="builder-pro-shell">
            <button
                type="button"
                className={
                    `builder-pro-toggle ${
                        active
                            ? 'is-active'
                            : ''
                    }`
                }
                onClick={ toggleMode }>
                { active
                    ? 'Cerrar Builder Pro'
                    : 'Builder Pro' }
            </button>

            { active &&
                <div className="builder-pro-panel">
                    <div className="builder-pro-header">
                        <strong>Builder Pro</strong>

                        <span>
                            { selectedIds.length } / { MAX_SELECTION }
                        </span>
                    </div>

                    <div className="builder-pro-status">
                        { status }
                    </div>

                    <div className="builder-pro-step">
                        <span>Paso</span>

                        <button
                            type="button"
                            className={
                                moveStep === 1
                                    ? 'is-selected'
                                    : ''
                            }
                            onClick={ () => setMoveStep(1) }>
                            1
                        </button>

                        <button
                            type="button"
                            className={
                                moveStep === 3
                                    ? 'is-selected'
                                    : ''
                            }
                            onClick={ () => setMoveStep(3) }>
                            3
                        </button>
                    </div>

                    <div className="builder-pro-actions">
                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={
                                () => moveGroup(-moveStep, 0)
                            }>
                            X ?
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={
                                () => moveGroup(moveStep, 0)
                            }>
                            X +
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={
                                () => moveGroup(0, -moveStep)
                            }>
                            Y ?
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={
                                () => moveGroup(0, moveStep)
                            }>
                            Y +
                        </button>
                    </div>

                    <button
                        type="button"
                        className="builder-pro-clear"
                        disabled={
                            pending ||
                            !selectedIds.length
                        }
                        onClick={ clearSelection }>
                        Limpiar selecci?n
                    </button>
                </div> }
        </div>
    );
}
