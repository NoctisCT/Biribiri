import { BuilderProMoveGroupComposer, BuilderProMoveGroupResultEvent, RoomControllerLevel, RoomEngineObjectEvent, RoomObjectCategory } from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { BuilderProSelectionVisualizer, CanManipulateFurniture, GetRoomEngine, GetSessionDataManager, SendMessageComposer, SetBuilderProSelectionModeActive } from '../../../../api';
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
    const [ areaMode, setAreaMode ] = useState(false);
    const [ selectionBox, setSelectionBox ] = useState<{
        left: number;
        top: number;
        width: number;
        height: number;
    } | null>(null);

    const activeRef = useRef(false);
    const pendingRef = useRef(false);
    const areaModeRef = useRef(false);
    const areaStartRef = useRef<{
        canvas: HTMLCanvasElement;
        startClientX: number;
        startClientY: number;
        startCanvasX: number;
        startCanvasY: number;
    } | null>(null);
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
        areaModeRef.current = false;
        areaStartRef.current = null;

        SetBuilderProSelectionModeActive(false);

        clearSelection();

        setActive(false);
        setPending(false);
        setAreaMode(false);
        setSelectionBox(null);
        setStatus('');
    }, [ clearSelection ]);

    const activate = useCallback(() =>
    {
        if(!canBuild) return;

        clearSelection();

        activeRef.current = true;
        pendingRef.current = false;
        areaModeRef.current = false;
        areaStartRef.current = null;

        SetBuilderProSelectionModeActive(true);

        setActive(true);
        setPending(false);
        setAreaMode(false);
        setSelectionBox(null);
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

    const toggleAreaMode = useCallback(() =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;

        const next = !areaModeRef.current;

        areaModeRef.current = next;
        areaStartRef.current = null;

        setAreaMode(next);
        setSelectionBox(null);

        setStatus(
            next
                ? 'Seleccion por area activa. Arrastra sobre la sala.'
                : 'Seleccion por clic activa.'
        );
    }, []);

    const selectObjectsInArea = useCallback((
        canvas: HTMLCanvasElement,
        startCanvasX: number,
        startCanvasY: number,
        endClientX: number,
        endClientY: number
    ) =>
    {
        const currentRoomSession =
            roomSessionRef.current;

        if(!currentRoomSession) return;

        const canvasRect =
            canvas.getBoundingClientRect();

        if(
            canvasRect.width <= 0 ||
            canvasRect.height <= 0
        )
        {
            return;
        }

        const scaleX =
            canvas.width / canvasRect.width;

        const scaleY =
            canvas.height / canvasRect.height;

        const endCanvasX =
            (endClientX - canvasRect.left) *
            scaleX;

        const endCanvasY =
            (endClientY - canvasRect.top) *
            scaleY;

        const minX = Math.min(
            startCanvasX,
            endCanvasX
        );

        const maxX = Math.max(
            startCanvasX,
            endCanvasX
        );

        const minY = Math.min(
            startCanvasY,
            endCanvasY
        );

        const maxY = Math.max(
            startCanvasY,
            endCanvasY
        );

        const roomEngine =
            GetRoomEngine();

        if(!roomEngine) return;

        const next = [
            ...selectedIdsRef.current
        ];

        const nextSet =
            new Set(next);

        const count =
            roomEngine.getRoomObjectCount(
                currentRoomSession.roomId,
                RoomObjectCategory.FLOOR
            );

        let added = 0;

        for(
            let index = 0;
            index < count;
            index++
        )
        {
            if(next.length >= MAX_SELECTION)
            {
                break;
            }

            const roomObject =
                roomEngine.getRoomObjectByIndex(
                    currentRoomSession.roomId,
                    index,
                    RoomObjectCategory.FLOOR
                );

            if(!roomObject) continue;

            if(nextSet.has(roomObject.id))
            {
                continue;
            }

            if(!CanManipulateFurniture(
                currentRoomSession,
                roomObject.id,
                RoomObjectCategory.FLOOR
            ))
            {
                continue;
            }

            const bounds =
                roomEngine
                    .getRoomObjectBoundingRectangle(
                        currentRoomSession.roomId,
                        roomObject.id,
                        RoomObjectCategory.FLOOR,
                        1
                    );

            if(!bounds) continue;

            const boundsRight =
                bounds.x + bounds.width;

            const boundsBottom =
                bounds.y + bounds.height;

            const intersects =
                bounds.x <= maxX &&
                boundsRight >= minX &&
                bounds.y <= maxY &&
                boundsBottom >= minY;

            if(!intersects) continue;

            next.push(roomObject.id);
            nextSet.add(roomObject.id);
            added++;
        }

        applySelection(next);

        if(
            next.length >= MAX_SELECTION &&
            added > 0
        )
        {
            setStatus(
                `Area: ${ added } anadidos. Limite ${ MAX_SELECTION } alcanzado.`
            );

            return;
        }

        setStatus(
            `Area: ${ added } anadidos. ${ next.length } seleccionados.`
        );
    }, [ applySelection ]);

    useEffect(() =>
    {
        if(!active) return;
        if(!areaMode) return;

        const stopNativeEvent = (
            event: globalThis.MouseEvent
        ) =>
        {
            if(event.cancelable)
            {
                event.preventDefault();
            }

            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        const onMouseDown = (
            event: globalThis.MouseEvent
        ) =>
        {
            if(!activeRef.current) return;
            if(!areaModeRef.current) return;
            if(pendingRef.current) return;
            if(event.button !== 0) return;

            if(
                !(event.target instanceof
                    HTMLCanvasElement)
            )
            {
                return;
            }

            const canvas =
                event.target;

            const rect =
                canvas.getBoundingClientRect();

            if(
                rect.width <= 0 ||
                rect.height <= 0
            )
            {
                return;
            }

            const scaleX =
                canvas.width / rect.width;

            const scaleY =
                canvas.height / rect.height;

            areaStartRef.current = {
                canvas,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startCanvasX:
                    (event.clientX - rect.left) *
                    scaleX,
                startCanvasY:
                    (event.clientY - rect.top) *
                    scaleY
            };

            setSelectionBox({
                left: event.clientX,
                top: event.clientY,
                width: 0,
                height: 0
            });

            stopNativeEvent(event);
        };

        const onMouseMove = (
            event: globalThis.MouseEvent
        ) =>
        {
            const start =
                areaStartRef.current;

            if(!start) return;

            const left = Math.min(
                start.startClientX,
                event.clientX
            );

            const top = Math.min(
                start.startClientY,
                event.clientY
            );

            setSelectionBox({
                left,
                top,
                width: Math.abs(
                    event.clientX -
                    start.startClientX
                ),
                height: Math.abs(
                    event.clientY -
                    start.startClientY
                )
            });

            stopNativeEvent(event);
        };

        const onMouseUp = (
            event: globalThis.MouseEvent
        ) =>
        {
            const start =
                areaStartRef.current;

            if(!start) return;

            areaStartRef.current = null;
            setSelectionBox(null);

            const dragWidth = Math.abs(
                event.clientX -
                start.startClientX
            );

            const dragHeight = Math.abs(
                event.clientY -
                start.startClientY
            );

            stopNativeEvent(event);

            if(
                dragWidth < 4 &&
                dragHeight < 4
            )
            {
                setStatus(
                    'Arrastra para trazar un area de seleccion.'
                );

                return;
            }

            selectObjectsInArea(
                start.canvas,
                start.startCanvasX,
                start.startCanvasY,
                event.clientX,
                event.clientY
            );
        };

        const onClick = (
            event: globalThis.MouseEvent
        ) =>
        {
            if(!areaModeRef.current) return;

            if(
                !(event.target instanceof
                    HTMLCanvasElement)
            )
            {
                return;
            }

            stopNativeEvent(event);
        };

        window.addEventListener(
            'mousedown',
            onMouseDown,
            true
        );

        window.addEventListener(
            'mousemove',
            onMouseMove,
            true
        );

        window.addEventListener(
            'mouseup',
            onMouseUp,
            true
        );

        window.addEventListener(
            'click',
            onClick,
            true
        );

        return () =>
        {
            window.removeEventListener(
                'mousedown',
                onMouseDown,
                true
            );

            window.removeEventListener(
                'mousemove',
                onMouseMove,
                true
            );

            window.removeEventListener(
                'mouseup',
                onMouseUp,
                true
            );

            window.removeEventListener(
                'click',
                onClick,
                true
            );

            areaStartRef.current = null;
            setSelectionBox(null);
        };
    }, [
        active,
        areaMode,
        selectObjectsInArea
    ]);

    useEffect(() =>
    {
        activeRef.current = false;
        pendingRef.current = false;
        areaModeRef.current = false;
        areaStartRef.current = null;

        SetBuilderProSelectionModeActive(false);

        clearSelection();

        setActive(false);
        setPending(false);
        setAreaMode(false);
        setSelectionBox(null);
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
            areaModeRef.current = false;
            areaStartRef.current = null;

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

                    <div className="builder-pro-selection-tools">
                        <button
                            type="button"
                            className={
                                areaMode
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={ pending }
                            onClick={ toggleAreaMode }>
                            { areaMode
                                ? 'Area: activa'
                                : 'Seleccion por area' }
                        </button>
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

            { selectionBox &&
                <div
                    className="builder-pro-selection-box"
                    style={ selectionBox } /> }
        </div>
    );
}
