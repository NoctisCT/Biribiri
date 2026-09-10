import { RoomEngineTileHoverEvent, RoomEngineTileClickEvent, BuilderProHistoryResultEvent, BuilderProHistoryComposer, BuilderProOffsetGroupResultEvent, BuilderProOffsetGroupComposer, BuilderProLayoutGroupResultEvent, BuilderProLayoutGroupComposer, BuilderProPasteGroupResultEvent, BuilderProPasteGroupComposer, BuilderProCopyGroupComposer, BuilderProCopyGroupResultEvent, BuilderProMoveGroupComposer, BuilderProMoveGroupResultEvent, BuilderProTransformGroupComposer, BuilderProTransformGroupResultEvent, RoomControllerLevel, RoomEngineObjectEvent, RoomObjectCategory, Vector3d, RoomObjectVariable} from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { BuilderProSelectionVisualizer, CanManipulateFurniture, GetRoomEngine, GetSessionDataManager, SendMessageComposer, SetBuilderProSelectionModeActive } from '../../../../api';
import { useMessageEvent, useRoom, useRoomEngineEvent } from '../../../../hooks';
import './BuilderProView.scss';

const MAX_SELECTION = 100;
const KEYBOARD_REPEAT_INTERVAL_MS = 200;
const MOVE_CONFIRM_TIMEOUT_MS = 2500;

const TRANSFORM_HEIGHT = 1;
const TRANSFORM_ROTATE_STRUCTURE = 2;
const TRANSFORM_ORIENT = 3;

const FORMATION_ROW_LEFT = 1;
const FORMATION_ROW_RIGHT = 2;
const FORMATION_COLUMN_UP = 3;
const FORMATION_COLUMN_DOWN = 4;
const FORMATION_STACK = 5;

type BuilderProDragLocation = {
    id: number;
    x: number;
    y: number;
    z: number;
};

type BuilderProTransformSnapshot = {
    id: number;
    x: number;
    y: number;
    z: number;
    directionX: number;
    directionY: number;
    directionZ: number;
};

type BuilderProClipboardPreviewEntry = {
    baseItemId: number;
    offsetX: number;
    offsetY: number;
    offsetZ: number;
    rotation: number;
};

type BuilderProClipboardPreview = {
    sourceAnchorZ: number;
    entries: BuilderProClipboardPreviewEntry[];
};

const BUILDER_PRO_PASTE_GHOST_ID_BASE = -1900000000;

export const BuilderProView: FC<{}> = props =>
{
    const { roomSession = null } = useRoom();

    const [ active, setActive ] = useState(false);
    const [ selectedIds, setSelectedIds ] = useState<number[]>([]);
    const [ pending, setPending ] = useState(false);
    const [ status, setStatus ] = useState('');
    const [ pasteMode, setPasteMode ] = useState(false);
    const [ duplicateMode, setDuplicateMode ] = useState(false);
    const [ canUndo, setCanUndo ] = useState(false);
    const [ canRedo, setCanRedo ] = useState(false);
    const [ moveStep, setMoveStep ] = useState(1);
    const [ heightStep, setHeightStep ] = useState(0.1);
    const [ offsetX, setOffsetX ] = useState('');
    const [ offsetY, setOffsetY ] = useState('');
    const [ offsetZ, setOffsetZ ] = useState('');
    const [ formationSpacing, setFormationSpacing ] = useState('0');
    const [ highlightSelection, setHighlightSelection ] =
        useState(BuilderProSelectionVisualizer.enabled);
    const [ pivotId, setPivotId ] =
        useState<number | null>(null);
    const [ pivotPickMode, setPivotPickMode ] =
        useState(false);
    const [ areaMode, setAreaMode ] = useState(false);
    const [ selectionBox, setSelectionBox ] = useState<{
        left: number;
        top: number;
        width: number;
        height: number;
    } | null>(null);

    const activeRef = useRef(false);
    const pendingRef = useRef(false);
    const pasteModeRef = useRef(false);
    const duplicateModeRef = useRef(false);
    const duplicateRequestedRef = useRef(false);
    const clipboardPreviewRef = useRef<BuilderProClipboardPreview | null>(null);
    const pastePreviewAnchorRef = useRef<{ x: number; y: number } | null>(null);
    const pasteGhostIdsRef = useRef<number[]>([]);
    const pastePreviewFrameRef = useRef<number | null>(null);
    const heldArrowRef = useRef<string | null>(null);
    const keyboardBlockedRef = useRef(false);
    const keyboardRepeatTimerRef = useRef<number | null>(null);
    const pendingTimeoutRef = useRef<number | null>(null);
    const scheduleKeyboardRepeatRef = useRef<(() => void) | null>(null);
    const moveStepRef = useRef(moveStep);
    const requestIdRef = useRef(0);
    const pendingRequestIdRef = useRef<number | null>(null);
    const pendingStartedAtRef = useRef(0);
    const pendingTransformPreviewRef = useRef<{
        requestId: number;
        snapshots: BuilderProTransformSnapshot[];
    } | null>(null);
    const pointerDownRef = useRef<{
        canvas: HTMLCanvasElement;
        clientX: number;
        clientY: number;
    } | null>(null);
    const dragRef = useRef<{
        anchorId: number;
        startClientX: number;
        startClientY: number;
        basisXScreenX: number;
        basisXScreenY: number;
        basisYScreenX: number;
        basisYScreenY: number;
        determinant: number;
        deltaX: number;
        deltaY: number;
        insideCanvas: boolean;
        originalLocations: BuilderProDragLocation[];
    } | null>(null);
    const pendingDragPreviewRef = useRef<{
        requestId: number;
        locations: BuilderProDragLocation[];
    } | null>(null);
    const suppressDragClickRef = useRef(false);
    const suppressDragClickTimerRef =
        useRef<number | null>(null);
    const areaModeRef = useRef(false);
    const suppressAreaClickRef = useRef(false);
    const pivotIdRef = useRef<number | null>(null);
    const pivotPickModeRef = useRef(false);
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
    moveStepRef.current = moveStep;

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

        if(
            pivotIdRef.current !== null &&
            !nextSet.has(
                pivotIdRef.current
            )
        )
        {
            BuilderProSelectionVisualizer
                .clearPivot();

            pivotIdRef.current = null;
            pivotPickModeRef.current = false;

            setPivotId(null);
            setPivotPickMode(false);
        }

        selectedIdsRef.current = next;
        setSelectedIds(next);
    }, []);

    const clearSelection = useCallback(() =>
    {
        BuilderProSelectionVisualizer.clear(
            selectedIdsRef.current
        );

        BuilderProSelectionVisualizer.clearPivot();

        pivotIdRef.current = null;
        pivotPickModeRef.current = false;

        setPivotId(null);
        setPivotPickMode(false);

        selectedIdsRef.current = [];
        setSelectedIds([]);
    }, []);

    const applyPreviewLocations = useCallback((
        locations: BuilderProDragLocation[],
        deltaX: number,
        deltaY: number
    ): boolean =>
    {
        const currentRoomSession =
            roomSessionRef.current;

        const roomEngine =
            GetRoomEngine();

        if(
            !currentRoomSession ||
            !roomEngine
        )
        {
            return false;
        }

        const targets: {
            object: ReturnType<typeof roomEngine.getRoomObject>;
            location: Vector3d;
        }[] = [];

        for(const snapshot of locations)
        {
            const roomObject =
                roomEngine.getRoomObject(
                    currentRoomSession.roomId,
                    snapshot.id,
                    RoomObjectCategory.FLOOR
                );

            if(!roomObject)
            {
                return false;
            }

            targets.push({
                object: roomObject,
                location: new Vector3d(
                    snapshot.x + deltaX,
                    snapshot.y + deltaY,
                    snapshot.z
                )
            });
        }

        for(const target of targets)
        {
            target.object.setLocation(
                target.location
            );
        }

        return true;
    }, []);

    const clearStructuralPivot =
        useCallback(() =>
        {
            BuilderProSelectionVisualizer
                .clearPivot();

            pivotIdRef.current = null;
            pivotPickModeRef.current = false;

            setPivotId(null);
            setPivotPickMode(false);

            setStatus(
                'Pivote automatico: primer furni de la seleccion.'
            );
        }, []);

    const togglePivotPick =
        useCallback(() =>
        {
            if(pendingRef.current) return;

            if(!selectedIdsRef.current.length)
            {
                setStatus(
                    'Selecciona furnis antes de elegir pivote.'
                );

                return;
            }

            const next =
                !pivotPickModeRef.current;

            pivotPickModeRef.current =
                next;

            setPivotPickMode(
                next
            );

            if(next)
            {
                if(areaModeRef.current)
                {
                    areaModeRef.current =
                        false;

                    areaStartRef.current =
                        null;

                    setAreaMode(false);
                    setSelectionBox(null);
                }

                setStatus(
                    'Haz clic en uno de los furnis seleccionados para usarlo como pivote.'
                );

                return;
            }

            setStatus(
                pivotIdRef.current !== null
                    ? `Pivote actual: furni #${ pivotIdRef.current }.`
                    : 'Pivote automatico: primer furni seleccionado.'
            );
        }, []);

    const toggleHighlight = useCallback(() =>
    {
        const next =
            !BuilderProSelectionVisualizer.enabled;

        BuilderProSelectionVisualizer.setEnabled(
            next,
            selectedIdsRef.current
        );

        setHighlightSelection(next);

        setStatus(
            next
                ? 'Resaltado de seleccion visible.'
                : 'Resaltado oculto. La seleccion sigue activa.'
        );
    }, []);

    const captureTransformSnapshots =
        useCallback((
            orderedIds?: number[]
        ): BuilderProTransformSnapshot[] | null =>
        {
            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            if(
                !currentRoomSession ||
                !roomEngine
            )
            {
                return null;
            }

            const snapshots:
                BuilderProTransformSnapshot[] = [];

            const ids =
                orderedIds?.length
                    ? orderedIds
                    : selectedIdsRef.current;

            for(
                const id of
                ids
            )
            {
                const roomObject =
                    roomEngine.getRoomObject(
                        currentRoomSession.roomId,
                        id,
                        RoomObjectCategory.FLOOR
                    );

                const location =
                    roomObject?.getLocation();

                const direction =
                    roomObject?.getDirection();

                if(
                    !roomObject ||
                    !location ||
                    !direction
                )
                {
                    return null;
                }

                snapshots.push({
                    id,
                    x: location.x,
                    y: location.y,
                    z: location.z,
                    directionX: direction.x,
                    directionY: direction.y,
                    directionZ: direction.z
                });
            }

            return snapshots.length
                ? snapshots
                : null;
        }, []);

    const capturePreviewServerRotations =
        useCallback((
            ids: number[]
        ): number[] | null =>
        {
            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            if(
                !currentRoomSession ||
                !roomEngine
            )
            {
                return null;
            }

            const rotations: number[] = [];

            for(const id of ids)
            {
                const roomObject =
                    roomEngine.getRoomObject(
                        currentRoomSession.roomId,
                        id,
                        RoomObjectCategory.FLOOR
                    );

                const direction =
                    roomObject?.getDirection();

                if(!roomObject || !direction)
                {
                    return null;
                }

                rotations.push(
                    (
                        (
                            Math.round(
                                direction.x / 45
                            ) %
                            8
                        ) +
                        8
                    ) %
                    8
                );
            }

            return rotations;
        }, []);

    const restoreTransformSnapshots =
        useCallback((
            snapshots: BuilderProTransformSnapshot[]
        ): boolean =>
        {
            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            if(
                !currentRoomSession ||
                !roomEngine
            )
            {
                return false;
            }

            const targets: {
                object: ReturnType<typeof roomEngine.getRoomObject>;
                location: Vector3d;
                direction: Vector3d;
            }[] = [];

            for(const snapshot of snapshots)
            {
                const roomObject =
                    roomEngine.getRoomObject(
                        currentRoomSession.roomId,
                        snapshot.id,
                        RoomObjectCategory.FLOOR
                    );

                if(!roomObject)
                {
                    return false;
                }

                targets.push({
                    object: roomObject,
                    location: new Vector3d(
                        snapshot.x,
                        snapshot.y,
                        snapshot.z
                    ),
                    direction: new Vector3d(
                        snapshot.directionX,
                        snapshot.directionY,
                        snapshot.directionZ
                    )
                });
            }

            for(const target of targets)
            {
                target.object.setLocation(
                    target.location
                );

                target.object.setDirection(
                    target.direction
                );
            }

            return true;
        }, []);

    const applyTransformPreview =
        useCallback((
            snapshots: BuilderProTransformSnapshot[],
            operation: number,
            argument: number
        ): boolean =>
        {
            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            if(
                !currentRoomSession ||
                !roomEngine ||
                !snapshots.length
            )
            {
                return false;
            }

            const pivot =
                snapshots[0];

            const targets: {
                object: ReturnType<typeof roomEngine.getRoomObject>;
                location: Vector3d;
                direction: Vector3d;
            }[] = [];

            for(const snapshot of snapshots)
            {
                const roomObject =
                    roomEngine.getRoomObject(
                        currentRoomSession.roomId,
                        snapshot.id,
                        RoomObjectCategory.FLOOR
                    );

                if(!roomObject)
                {
                    return false;
                }

                let x = snapshot.x;
                let y = snapshot.y;
                let z = snapshot.z;

                let directionX =
                    snapshot.directionX;

                if(operation === TRANSFORM_HEIGHT)
                {
                    z =
                        Math.round(
                            (
                                snapshot.z +
                                (
                                    argument /
                                    1000
                                )
                            ) *
                            1000000
                        ) /
                        1000000;
                }

                const getNextAllowedDirection = () =>
                {
                    const allowedDirections =
                        roomObject.model
                            ?.getValue<number[]>(
                                RoomObjectVariable
                                    .FURNITURE_ALLOWED_DIRECTIONS
                            );

                    if(
                        !allowedDirections ||
                        !allowedDirections.length
                    )
                    {
                        return directionX;
                    }

                    let directionIndex =
                        allowedDirections
                            .indexOf(
                                directionX
                            );

                    if(directionIndex < 0)
                    {
                        directionIndex = 0;

                        let scan = 0;

                        while(
                            scan <
                            allowedDirections.length
                        )
                        {
                            if(
                                directionX <=
                                allowedDirections[scan]
                            )
                            {
                                break;
                            }

                            directionIndex++;
                            scan++;
                        }

                        directionIndex =
                            directionIndex %
                            allowedDirections.length;
                    }

                    if(argument > 0)
                    {
                        directionIndex =
                            (
                                directionIndex +
                                1
                            ) %
                            allowedDirections.length;
                    }
                    else
                    {
                        directionIndex =
                            (
                                directionIndex -
                                1 +
                                allowedDirections.length
                            ) %
                            allowedDirections.length;
                    }

                    return allowedDirections[
                        directionIndex
                    ];
                };

                if(operation === TRANSFORM_ORIENT)
                {
                    directionX =
                        getNextAllowedDirection();
                }

                else if(operation === TRANSFORM_ROTATE_STRUCTURE)
                {
                    const dx =
                        snapshot.x -
                        pivot.x;

                    const dy =
                        snapshot.y -
                        pivot.y;

                    if(argument > 0)
                    {
                        x =
                            pivot.x -
                            dy;

                        y =
                            pivot.y +
                            dx;
                    }
                    else
                    {
                        x =
                            pivot.x +
                            dy;

                        y =
                            pivot.y -
                            dx;
                    }

                    directionX =
                        (
                            (
                                snapshot.directionX +
                                (
                                    argument *
                                    90
                                )
                            ) %
                            360 +
                            360
                        ) %
                        360;
                }

                else if(operation !== TRANSFORM_HEIGHT)
                {
                    return false;
                }

                targets.push({
                    object: roomObject,
                    location: new Vector3d(
                        x,
                        y,
                        z
                    ),
                    direction: new Vector3d(
                        directionX,
                        snapshot.directionY,
                        snapshot.directionZ
                    )
                });
            }

            for(const target of targets)
            {
                target.object.setLocation(
                    target.location
                );

                target.object.setDirection(
                    target.direction
                );
            }

            return true;
        }, []);

    const deactivate = useCallback(() =>
    {
        activeRef.current = false;
        pendingRef.current = false;
        areaModeRef.current = false;
        areaStartRef.current = null;
        pointerDownRef.current = null;
        dragRef.current = null;
        suppressDragClickRef.current = false;

        if(suppressDragClickTimerRef.current !== null)
        {
            window.clearTimeout(
                suppressDragClickTimerRef.current
            );

            suppressDragClickTimerRef.current = null;
        }

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
            'Haz clic para seleccionar. Alt + arrastra un furni seleccionado para mover el grupo.'
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
        if(dragRef.current) return;

        const next = !areaModeRef.current;

        areaModeRef.current = next;
        areaStartRef.current = null;

        setAreaMode(next);
        setSelectionBox(null);

        setStatus(
            next
                ? 'Seleccion por area activa. Arrastra para seleccionar; los clics normales siguen disponibles.'
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
            if(pasteModeRef.current) return;
            if(event.altKey) return;
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

            suppressAreaClickRef.current = false;
        };

        const onMouseMove = (
            event: globalThis.MouseEvent
        ) =>
        {
            const start =
                areaStartRef.current;

            if(!start) return;

            const dragWidth = Math.abs(
                event.clientX -
                start.startClientX
            );

            const dragHeight = Math.abs(
                event.clientY -
                start.startClientY
            );

            if(!suppressAreaClickRef.current)
            {
                if(
                    dragWidth < 4 &&
                    dragHeight < 4
                )
                {
                    return;
                }

                suppressAreaClickRef.current = true;
            }

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
                width: dragWidth,
                height: dragHeight
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

            const wasAreaDrag =
                suppressAreaClickRef.current;

            if(!wasAreaDrag)
            {
                setSelectionBox(null);
                return;
            }

            stopNativeEvent(event);
            setSelectionBox(null);

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
            if(!suppressAreaClickRef.current)
            {
                return;
            }

            if(
                !(event.target instanceof
                    HTMLCanvasElement)
            )
            {
                return;
            }

            suppressAreaClickRef.current = false;
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
            suppressAreaClickRef.current = false;
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

            if(keyboardRepeatTimerRef.current !== null)
            {
                window.clearTimeout(
                    keyboardRepeatTimerRef.current
                );
            }

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );
            }

            BuilderProSelectionVisualizer.clear(
                selectedIdsRef.current
            );
        };
    }, []);

    useRoomEngineEvent<RoomEngineObjectEvent>(
        [
            RoomEngineObjectEvent.SELECTED,
            RoomEngineObjectEvent.REMOVED,
            RoomEngineObjectEvent.REQUEST_MOVE
        ],
        event =>
        {
            if(!activeRef.current) return;
            if(event.category !== RoomObjectCategory.FLOOR) return;

            if(event.type === RoomEngineObjectEvent.REQUEST_MOVE)
            {
                if(pendingRef.current) return;

                if(!selectedIdsRef.current.includes(
                    event.objectId
                ))
                {
                    return;
                }

                const currentRoomSession =
                    roomSessionRef.current;

                const pointer =
                    pointerDownRef.current;

                if(
                    !currentRoomSession ||
                    !pointer ||
                    currentRoomSession.roomId !== event.roomId
                )
                {
                    setStatus(
                        'No se pudo iniciar el arrastre.'
                    );

                    return;
                }

                const roomEngine =
                    GetRoomEngine();

                const anchorObject =
                    roomEngine?.getRoomObject(
                        currentRoomSession.roomId,
                        event.objectId,
                        RoomObjectCategory.FLOOR
                    );

                const geometry =
                    roomEngine?.getRoomInstanceGeometry(
                        currentRoomSession.roomId,
                        1
                    );

                if(!anchorObject || !geometry)
                {
                    setStatus(
                        'No se pudo leer la geometria de la sala.'
                    );

                    return;
                }

                const anchorLocation =
                    anchorObject.getLocation();

                if(!anchorLocation)
                {
                    setStatus(
                        'No se pudo localizar el furni de anclaje.'
                    );

                    return;
                }

                const origin =
                    geometry.getScreenPosition(
                        new Vector3d(
                            anchorLocation.x,
                            anchorLocation.y,
                            anchorLocation.z
                        )
                    );

                const xPoint =
                    geometry.getScreenPosition(
                        new Vector3d(
                            anchorLocation.x + 1,
                            anchorLocation.y,
                            anchorLocation.z
                        )
                    );

                const yPoint =
                    geometry.getScreenPosition(
                        new Vector3d(
                            anchorLocation.x,
                            anchorLocation.y + 1,
                            anchorLocation.z
                        )
                    );

                if(!origin || !xPoint || !yPoint)
                {
                    setStatus(
                        'No se pudo proyectar la geometria de arrastre.'
                    );

                    return;
                }

                const basisXScreenX =
                    xPoint.x - origin.x;

                const basisXScreenY =
                    xPoint.y - origin.y;

                const basisYScreenX =
                    yPoint.x - origin.x;

                const basisYScreenY =
                    yPoint.y - origin.y;

                const determinant =
                    (
                        basisXScreenX *
                        basisYScreenY
                    ) -
                    (
                        basisYScreenX *
                        basisXScreenY
                    );

                if(Math.abs(determinant) < 0.0001)
                {
                    setStatus(
                        'Geometria de arrastre invalida.'
                    );

                    return;
                }

                const originalLocations:
                    BuilderProDragLocation[] = [];

                for(
                    const selectedId of
                    selectedIdsRef.current
                )
                {
                    const selectedObject =
                        roomEngine?.getRoomObject(
                            currentRoomSession.roomId,
                            selectedId,
                            RoomObjectCategory.FLOOR
                        );

                    const selectedLocation =
                        selectedObject?.getLocation();

                    if(
                        !selectedObject ||
                        !selectedLocation
                    )
                    {
                        pointerDownRef.current = null;

                        setStatus(
                            'No se pudo leer la posicion completa de la seleccion.'
                        );

                        return;
                    }

                    originalLocations.push({
                        id: selectedId,
                        x: selectedLocation.x,
                        y: selectedLocation.y,
                        z: selectedLocation.z
                    });
                }

                if(!originalLocations.length)
                {
                    pointerDownRef.current = null;

                    setStatus(
                        'No hay furnis seleccionados para arrastrar.'
                    );

                    return;
                }

                dragRef.current = {
                    anchorId: event.objectId,
                    startClientX: pointer.clientX,
                    startClientY: pointer.clientY,
                    basisXScreenX,
                    basisXScreenY,
                    basisYScreenX,
                    basisYScreenY,
                    determinant,
                    deltaX: 0,
                    deltaY: 0,
                    insideCanvas: true,
                    originalLocations
                };

                suppressDragClickRef.current = true;

                if(
                    suppressDragClickTimerRef.current
                    !== null
                )
                {
                    window.clearTimeout(
                        suppressDragClickTimerRef.current
                    );

                    suppressDragClickTimerRef.current = null;
                }

                heldArrowRef.current = null;
                keyboardBlockedRef.current = false;

                if(
                    keyboardRepeatTimerRef.current
                    !== null
                )
                {
                    window.clearTimeout(
                        keyboardRepeatTimerRef.current
                    );

                    keyboardRepeatTimerRef.current = null;
                }

                setStatus(
                    `Arrastrando ${ selectedIdsRef.current.length } furnis. Suelta para mover el grupo.`
                );

                return;
            }

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

            if(pivotPickModeRef.current)
            {
                if(
                    !selectedIdsRef.current.includes(
                        event.objectId
                    )
                )
                {
                    setStatus(
                        'El pivote debe ser uno de los furnis ya seleccionados.'
                    );

                    return;
                }

                pivotPickModeRef.current =
                    false;

                pivotIdRef.current =
                    event.objectId;

                setPivotPickMode(false);

                setPivotId(
                    event.objectId
                );

                BuilderProSelectionVisualizer
                    .setPivot(
                        event.objectId
                    );

                setStatus(
                    `Pivote fijado en furni #${ event.objectId }.`
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
            const parser = event.getParser();

            if(!parser) return;

            const receivedRequestId =
                parser.requestId;

            const receiveAgeMs =
                pendingStartedAtRef.current > 0
                    ? Math.round(
                        performance.now() -
                        pendingStartedAtRef.current
                    )
                    : -1;

            console.log(
                `[BuilderProTrace] CLIENT RECEIVE #${ receivedRequestId } success=${ parser.success } code=${ parser.code } moved=${ parser.movedCount } ageMs=${ receiveAgeMs } pending=${ pendingRef.current } expected=${ pendingRequestIdRef.current }`
            );

            if(
                pendingRequestIdRef.current !==
                receivedRequestId
            )
            {
                console.warn(
                    `[BuilderProTrace] CLIENT STALE #${ receivedRequestId } expected=${ pendingRequestIdRef.current }`
                );

                return;
            }

            if(!pendingRef.current)
            {
                console.warn(
                    `[BuilderProTrace] CLIENT LATE #${ receivedRequestId } arrived after pending cleared`
                );

                return;
            }

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );

                pendingTimeoutRef.current = null;
            }

            const dragPreview =
                pendingDragPreviewRef.current;

            pendingRef.current = false;
            pendingRequestIdRef.current = null;
            pendingStartedAtRef.current = 0;

            setPending(false);

            if(parser.success)
            {
                if(
                    dragPreview?.requestId ===
                    receivedRequestId
                )
                {
                    pendingDragPreviewRef.current =
                        null;
                }
                setCanUndo(true);
                setCanRedo(false);

                setStatus(
                    `Movimiento completado: ${ parser.movedCount } furnis.`
                );

                window.requestAnimationFrame(() =>
                {
                    BuilderProSelectionVisualizer.refresh(
                        selectedIdsRef.current
                    );
                });

                if(scheduleKeyboardRepeatRef.current)
                {
                    scheduleKeyboardRepeatRef.current();
                }

                return;
            }

            if(
                dragPreview?.requestId ===
                receivedRequestId
            )
            {
                applyPreviewLocations(
                    dragPreview.locations,
                    0,
                    0
                );

                pendingDragPreviewRef.current =
                    null;
            }

            if(keyboardRepeatTimerRef.current !== null)
            {
                window.clearTimeout(
                    keyboardRepeatTimerRef.current
                );

                keyboardRepeatTimerRef.current = null;
            }

            heldArrowRef.current = null;
            keyboardBlockedRef.current = true;

            setStatus(
                `Error ${ parser.code }: ${ parser.message }`
            );
        }
    );

    useMessageEvent<BuilderProCopyGroupResultEvent>(
        BuilderProCopyGroupResultEvent,
        event =>
        {
            const parser = event.getParser();

            if(!parser) return;

            const requestId = parser.requestId;

            if(
                pendingRequestIdRef.current !==
                requestId
            )
            {
                return;
            }

            if(!pendingRef.current)
            {
                return;
            }

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );

                pendingTimeoutRef.current = null;
            }

            pendingRef.current = false;
            pendingRequestIdRef.current = null;
            pendingStartedAtRef.current = 0;

            setPending(false);

            if(parser.success)
            {
                setStatus(
                    `Copiados ${ parser.copiedCount } furnis.`
                );

                return;
            }

            setStatus(
                `Error ${ parser.code }: ${ parser.message }`
            );
        }
    );

    useMessageEvent<BuilderProHistoryResultEvent>(
        BuilderProHistoryResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            const requestId =
                parser.requestId;

            if(
                pendingRequestIdRef.current !==
                requestId
            )
            {
                return;
            }

            if(!pendingRef.current)
            {
                return;
            }

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );

                pendingTimeoutRef.current = null;
            }

            pendingRef.current = false;
            pendingRequestIdRef.current = null;
            pendingStartedAtRef.current = 0;

            setPending(false);

            setCanUndo(
                parser.canUndo
            );

            setCanRedo(
                parser.canRedo
            );

            if(parser.success)
            {
                setStatus(
                    parser.message
                );

                window.requestAnimationFrame(
                    () =>
                    {
                        BuilderProSelectionVisualizer.refresh(
                            selectedIdsRef.current
                        );
                    }
                );

                return;
            }

            setStatus(
                `Error ${ parser.code }: ${ parser.message }`
            );
        }
    );



    useMessageEvent<BuilderProLayoutGroupResultEvent>(
        BuilderProLayoutGroupResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            const requestId =
                parser.requestId;

            if(
                pendingRequestIdRef.current
                !== requestId
                || !pendingRef.current
            )
            {
                return;
            }

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );

                pendingTimeoutRef.current = null;
            }

            pendingRef.current = false;
            pendingRequestIdRef.current = null;
            pendingStartedAtRef.current = 0;

            setPending(false);

            if(parser.success)
            {
                setCanUndo(true);
                setCanRedo(false);

                setStatus(
                    `Formacion aplicada: ${ parser.affectedCount } furnis movidos.`
                );

                window.requestAnimationFrame(
                    () =>
                    {
                        BuilderProSelectionVisualizer.refresh(
                            selectedIdsRef.current
                        );
                    }
                );

                return;
            }

            setStatus(
                `Error ${ parser.code }: ${ parser.message }`
            );
        }
    );

    useMessageEvent<BuilderProOffsetGroupResultEvent>(
        BuilderProOffsetGroupResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            const requestId =
                parser.requestId;

            if(
                pendingRequestIdRef.current
                !== requestId
            )
            {
                return;
            }

            if(!pendingRef.current)
            {
                return;
            }

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );

                pendingTimeoutRef.current =
                    null;
            }

            pendingRef.current = false;
            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            setPending(false);

            if(parser.success)
            {
                setCanUndo(true);
                setCanRedo(false);

                setStatus(
                    `Offset aplicado a ${ parser.affectedCount } furnis.`
                );

                window.requestAnimationFrame(
                    () =>
                    {
                        BuilderProSelectionVisualizer.refresh(
                            selectedIdsRef.current
                        );
                    }
                );

                return;
            }

            setStatus(
                `Error ${ parser.code }: ${ parser.message }`
            );
        }
    );

    useMessageEvent<BuilderProTransformGroupResultEvent>(
        BuilderProTransformGroupResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            const requestId =
                parser.requestId;

            console.log(
                `[BuilderProTrace] CLIENT TRANSFORM_RECEIVE #${ requestId } success=${ parser.success } code=${ parser.code } affected=${ parser.affectedCount }`
            );

            if(
                pendingRequestIdRef.current !==
                requestId
            )
            {
                console.warn(
                    `[BuilderProTrace] CLIENT TRANSFORM_STALE #${ requestId } expected=${ pendingRequestIdRef.current }`
                );

                return;
            }

            if(!pendingRef.current)
            {
                return;
            }

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );

                pendingTimeoutRef.current =
                    null;
            }

            const preview =
                pendingTransformPreviewRef.current;

            pendingRef.current = false;
            pendingRequestIdRef.current = null;
            pendingStartedAtRef.current = 0;
            pendingTransformPreviewRef.current =
                null;

            setPending(false);

            if(parser.success)
            {
                setCanUndo(true);
                setCanRedo(false);

                setStatus(
                    `Transformacion completada: ${ parser.affectedCount } furnis.`
                );

                window.requestAnimationFrame(
                    () =>
                    {
                        BuilderProSelectionVisualizer.refresh(
                            selectedIdsRef.current
                        );
                    }
                );

                return;
            }

            if(
                preview?.requestId ===
                requestId
            )
            {
                restoreTransformSnapshots(
                    preview.snapshots
                );
            }

            setStatus(
                `Error ${ parser.code }: ${ parser.message }`
            );
        }
    );


    const clearPastePreview = useCallback(() =>
    {
        if(pastePreviewFrameRef.current !== null)
        {
            window.cancelAnimationFrame(pastePreviewFrameRef.current);
            pastePreviewFrameRef.current = null;
        }

        const currentRoomSession = roomSessionRef.current;
        const roomEngine = GetRoomEngine();

        if(currentRoomSession && roomEngine)
        {
            for(const ghostId of pasteGhostIdsRef.current)
            {
                roomEngine.removeRoomObjectFloor(currentRoomSession.roomId, ghostId);
            }
        }

        pasteGhostIdsRef.current = [];
        pastePreviewAnchorRef.current = null;
    }, []);

    const syncPastePreview = useCallback(() =>
    {
        if(!pasteModeRef.current) return;

        const preview = clipboardPreviewRef.current;
        const anchor = pastePreviewAnchorRef.current;
        const currentRoomSession = roomSessionRef.current;
        const roomEngine = GetRoomEngine();

        if(!preview || !anchor || !currentRoomSession || !roomEngine) return;

        const roomId = currentRoomSession.roomId;

        for(let index = 0; index < preview.entries.length; index++)
        {
            const entry = preview.entries[index];
            const ghostId = BUILDER_PRO_PASTE_GHOST_ID_BASE - index;
            const x = anchor.x + entry.offsetX;
            const y = anchor.y + entry.offsetY;
            const z = preview.sourceAnchorZ + entry.offsetZ;

            if(!pasteGhostIdsRef.current.includes(ghostId))
            {
                const queued = roomEngine.addFurnitureFloor(
                    roomId,
                    ghostId,
                    entry.baseItemId,
                    new Vector3d(x, y, z),
                    new Vector3d(entry.rotation * 45),
                    0,
                    null,
                    Number.NaN,
                    -1,
                    0,
                    0,
                    '',
                    false,
                    false
                );

                if(queued) pasteGhostIdsRef.current.push(ghostId);
            }

            const roomObject = roomEngine.getRoomObject(roomId, ghostId, RoomObjectCategory.FLOOR) as any;
            if(!roomObject) continue;

            roomObject.setLocation(new Vector3d(x, y, z));
            roomObject.setDirection(new Vector3d(entry.rotation * 45));

            if(roomObject.model)
            {
                roomObject.model.setValue(RoomObjectVariable.FURNITURE_ALPHA_MULTIPLIER, 0.5);
            }

            const sprites = (roomObject.visualization as any)?.sprites;
            if(Array.isArray(sprites))
            {
                for(const sprite of sprites)
                {
                    if(sprite) sprite.clickHandling = false;
                }
            }
        }
    }, []);

    const renderPastePreview = useCallback((anchorX: number, anchorY: number) =>
    {
        pastePreviewAnchorRef.current = { x: Math.trunc(anchorX), y: Math.trunc(anchorY) };
        syncPastePreview();

        if(pastePreviewFrameRef.current !== null)
        {
            window.cancelAnimationFrame(pastePreviewFrameRef.current);
        }

        pastePreviewFrameRef.current = window.requestAnimationFrame(() =>
        {
            pastePreviewFrameRef.current = null;
            syncPastePreview();
            window.requestAnimationFrame(() => syncPastePreview());
        });
    }, [ syncPastePreview ]);

    useMessageEvent<BuilderProCopyGroupResultEvent>(
        BuilderProCopyGroupResultEvent,
        event =>
        {
            const parser = event.getParser();
            if(!parser) return;

            if(!parser.success)
            {
                duplicateRequestedRef.current = false;
                return;
            }

            const entries = parser.previewEntries;
            if(entries.length !== parser.copiedCount)
            {
                clipboardPreviewRef.current = null;
                duplicateRequestedRef.current = false;
                return;
            }

            clearPastePreview();

            clipboardPreviewRef.current = {
                sourceAnchorZ: parser.sourceAnchorZ,
                entries: entries.map(entry => ({ ...entry }))
            };

            if(duplicateRequestedRef.current)
            {
                duplicateRequestedRef.current = false;
                duplicateModeRef.current = true;
                setDuplicateMode(true);

                pasteModeRef.current = true;
                setPasteMode(true);

                setStatus(
                    'Duplicar: mueve el cursor y haz clic para crear copias.'
                );
            }
            else
            {
                duplicateModeRef.current = false;
                setDuplicateMode(false);

                pasteModeRef.current = false;
                setPasteMode(false);
            }
        }
    );

    useRoomEngineEvent<RoomEngineTileHoverEvent>(
        RoomEngineTileHoverEvent.TILE_HOVER,
        event =>
        {
            if(!activeRef.current || !pasteModeRef.current || pendingRef.current) return;
            renderPastePreview(event.tileX, event.tileY);
        }
    );

    const togglePasteMode = useCallback(() =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;

        duplicateRequestedRef.current = false;
        duplicateModeRef.current = false;
        setDuplicateMode(false);

        if(!pasteModeRef.current && !clipboardPreviewRef.current)
        {
            setStatus('Copia una estructura antes de pegar.');
            return;
        }

        const next =
            !pasteModeRef.current;

        pasteModeRef.current =
            next;

        setPasteMode(
            next
        );

        if(!next) clearPastePreview();

        heldArrowRef.current = null;
        keyboardBlockedRef.current = false;

        if(keyboardRepeatTimerRef.current !== null)
        {
            window.clearTimeout(
                keyboardRepeatTimerRef.current
            );

            keyboardRepeatTimerRef.current =
                null;
        }

        setStatus(
            next
                ? 'Pegar: mueve el cursor y haz clic en el destino.'
                : 'Pegado cancelado.'
        );
    }, [ clearPastePreview ]);

    useEffect(() =>
    {
        if(active) return;

        clearPastePreview();

        duplicateRequestedRef.current = false;
        duplicateModeRef.current = false;
        setDuplicateMode(false);

        pasteModeRef.current = false;
        setPasteMode(false);
    }, [ active, clearPastePreview ]);

    useEffect(() =>
    {
        return () =>
        {
            clearPastePreview();
        };
    }, [ clearPastePreview ]);

    useRoomEngineEvent<RoomEngineTileClickEvent>(
        RoomEngineTileClickEvent.TILE_CLICK,
        event =>
        {
            if(!activeRef.current) return;
            if(!pasteModeRef.current) return;

            event.consume();

            if(pendingRef.current)
            {
                return;
            }

            clearPastePreview();

            if(!duplicateModeRef.current)
            {
                pasteModeRef.current = false;
                setPasteMode(false);
            }

            requestIdRef.current++;

            if(requestIdRef.current > 2000000000)
            {
                requestIdRef.current = 1;
            }

            const requestId =
                requestIdRef.current;

            pendingRef.current = true;
            pendingRequestIdRef.current =
                requestId;

            pendingStartedAtRef.current =
                performance.now();

            setPending(true);

            setStatus(
                `Pegando en ${ event.tileX }, ${ event.tileY }...`
            );

            try
            {
                SendMessageComposer(
                    new BuilderProPasteGroupComposer(
                        event.tileX,
                        event.tileY,
                        requestId
                    )
                );

                if(pendingTimeoutRef.current !== null)
                {
                    window.clearTimeout(
                        pendingTimeoutRef.current
                    );
                }

                pendingTimeoutRef.current =
                    window.setTimeout(
                        () =>
                        {
                            pendingTimeoutRef.current =
                                null;

                            if(!pendingRef.current)
                            {
                                return;
                            }

                            if(
                                pendingRequestIdRef.current
                                !== requestId
                            )
                            {
                                return;
                            }

                            pendingRef.current = false;
                            pendingRequestIdRef.current =
                                null;

                            pendingStartedAtRef.current =
                                0;

                            setPending(false);

                            setStatus(
                                'Pegado sin confirmacion del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT PASTE_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current = false;
                pendingRequestIdRef.current =
                    null;

                pendingStartedAtRef.current =
                    0;

                setPending(false);

                setStatus(
                    'No se pudo enviar el pegado al servidor.'
                );
            }
        }
    );

    useMessageEvent<BuilderProPasteGroupResultEvent>(
        BuilderProPasteGroupResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            const requestId =
                parser.requestId;

            if(
                pendingRequestIdRef.current
                !== requestId
            )
            {
                return;
            }

            if(!pendingRef.current)
            {
                return;
            }

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );

                pendingTimeoutRef.current =
                    null;
            }

            pendingRef.current = false;
            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            setPending(false);

            if(parser.success)
            {
                const pastedIds =
                    parser.itemIds;

                applySelection(
                    pastedIds
                );

                setCanUndo(true);
                setCanRedo(false);

                setStatus(
                    duplicateModeRef.current
                        ? `Duplicados ${ parser.placedCount } furnis. Mueve el cursor para seguir duplicando.`
                        : `Pegados ${ parser.placedCount } furnis.`
                );

                window.requestAnimationFrame(
                    () =>
                    {
                        BuilderProSelectionVisualizer.refresh(
                            pastedIds
                        );
                    }
                );

                return;
            }

            setStatus(
                `Error ${ parser.code }: ${ parser.message }`
            );
        }
    );

    const moveGroup = useCallback(
        (
            deltaX: number,
            deltaY: number,
            previewLocations?: BuilderProDragLocation[]
        ) =>
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

            requestIdRef.current++;

            if(requestIdRef.current > 2000000000)
            {
                requestIdRef.current = 1;
            }

            const requestId =
                requestIdRef.current;

            pendingDragPreviewRef.current =
                previewLocations?.length
                    ? {
                        requestId,
                        locations:
                            previewLocations.map(
                                location => ({
                                    ...location
                                })
                            )
                    }
                    : null;

            pendingRef.current = true;
            pendingRequestIdRef.current = requestId;
            pendingStartedAtRef.current =
                performance.now();

            console.log(
                `[BuilderProTrace] CLIENT SEND #${ requestId } count=${ ids.length } dx=${ deltaX } dy=${ deltaY }`
            );

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
                        deltaY,
                        requestId
                    )
                );

                if(pendingTimeoutRef.current !== null)
                {
                    window.clearTimeout(
                        pendingTimeoutRef.current
                    );
                }

                pendingTimeoutRef.current =
                    window.setTimeout(
                        () =>
                        {
                            pendingTimeoutRef.current = null;

                            if(!pendingRef.current)
                            {
                                return;
                            }

                            const timedOutRequestId =
                                pendingRequestIdRef.current;

                            const timeoutAgeMs =
                                pendingStartedAtRef.current > 0
                                    ? Math.round(
                                        performance.now() -
                                        pendingStartedAtRef.current
                                    )
                                    : -1;

                            console.warn(
                                `[BuilderProTrace] CLIENT TIMEOUT #${ timedOutRequestId } ageMs=${ timeoutAgeMs }`
                            );

                            const dragPreview =
                                pendingDragPreviewRef.current;

                            if(
                                dragPreview?.requestId ===
                                timedOutRequestId
                            )
                            {
                                applyPreviewLocations(
                                    dragPreview.locations,
                                    0,
                                    0
                                );

                                pendingDragPreviewRef.current =
                                    null;
                            }

                            pendingRef.current = false;

                            heldArrowRef.current = null;
                            keyboardBlockedRef.current = true;

                            if(
                                keyboardRepeatTimerRef.current
                                !== null
                            )
                            {
                                window.clearTimeout(
                                    keyboardRepeatTimerRef.current
                                );

                                keyboardRepeatTimerRef.current = null;
                            }

                            setPending(false);

                            setStatus(
                                'Movimiento sin confirmacion. Hold detenido; vuelve a pulsar una flecha.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT SEND_ERROR #${ pendingRequestIdRef.current }`,
                    error
                );

                const dragPreview =
                    pendingDragPreviewRef.current;

                if(
                    dragPreview?.requestId ===
                    pendingRequestIdRef.current
                )
                {
                    applyPreviewLocations(
                        dragPreview.locations,
                        0,
                        0
                    );

                    pendingDragPreviewRef.current =
                        null;
                }

                pendingRef.current = false;
                pendingRequestIdRef.current = null;
                pendingStartedAtRef.current = 0;

                setPending(false);
                setStatus(
                    'No se pudo enviar la operaci?n al servidor.'
                );
            }
        },
        [ applyPreviewLocations ]
    );


    const applyNumericOffset =
        useCallback(() =>
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

            const parseValue = (
                raw: string
            ) =>
            {
                const normalized =
                    raw.trim()
                        .replace(',', '.');

                if(!normalized.length)
                {
                    return 0;
                }

                const value =
                    Number(normalized);

                return Number.isFinite(value)
                    ? value
                    : null;
            };

            const parsedX =
                parseValue(offsetX);

            const parsedY =
                parseValue(offsetY);

            const parsedZ =
                parseValue(offsetZ);

            if(
                parsedX === null ||
                parsedY === null ||
                parsedZ === null
            )
            {
                setStatus(
                    'Offset invalido.'
                );

                return;
            }

            if(
                !Number.isSafeInteger(parsedX) ||
                !Number.isSafeInteger(parsedY)
            )
            {
                setStatus(
                    'X e Y deben ser numeros enteros.'
                );

                return;
            }

            const deltaZMillis =
                Math.round(
                    parsedZ * 1000
                );

            if(
                deltaZMillis < -40000 ||
                deltaZMillis > 40000
            )
            {
                setStatus(
                    'Z debe estar entre -40 y 40.'
                );

                return;
            }

            if(
                parsedX === 0 &&
                parsedY === 0 &&
                deltaZMillis === 0
            )
            {
                setStatus(
                    'Introduce un offset distinto de cero.'
                );

                return;
            }

            duplicateRequestedRef.current =
                false;

            duplicateModeRef.current =
                false;

            setDuplicateMode(false);

            clearPastePreview();

            pasteModeRef.current =
                false;

            setPasteMode(false);

            heldArrowRef.current =
                null;

            if(
                keyboardRepeatTimerRef.current
                !== null
            )
            {
                window.clearTimeout(
                    keyboardRepeatTimerRef.current
                );

                keyboardRepeatTimerRef.current =
                    null;
            }

            requestIdRef.current++;

            if(requestIdRef.current > 2000000000)
            {
                requestIdRef.current = 1;
            }

            const requestId =
                requestIdRef.current;

            pendingRef.current = true;
            pendingRequestIdRef.current =
                requestId;

            pendingStartedAtRef.current =
                performance.now();

            setPending(true);

            const format = (
                value: number
            ) =>
                value > 0
                    ? `+${ value }`
                    : `${ value }`;

            setStatus(
                `Aplicando offset X ${ format(parsedX) }, Y ${ format(parsedY) }, Z ${ format(deltaZMillis / 1000) }...`
            );

            try
            {
                SendMessageComposer(
                    new BuilderProOffsetGroupComposer(
                        ids,
                        parsedX,
                        parsedY,
                        deltaZMillis,
                        requestId
                    )
                );

                if(
                    pendingTimeoutRef.current
                    !== null
                )
                {
                    window.clearTimeout(
                        pendingTimeoutRef.current
                    );
                }

                pendingTimeoutRef.current =
                    window.setTimeout(
                        () =>
                        {
                            pendingTimeoutRef.current =
                                null;

                            if(!pendingRef.current)
                            {
                                return;
                            }

                            if(
                                pendingRequestIdRef.current
                                !== requestId
                            )
                            {
                                return;
                            }

                            pendingRef.current =
                                false;

                            pendingRequestIdRef.current =
                                null;

                            pendingStartedAtRef.current =
                                0;

                            setPending(false);

                            setStatus(
                                'Offset sin confirmacion del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT OFFSET_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current = false;
                pendingRequestIdRef.current =
                    null;

                pendingStartedAtRef.current =
                    0;

                setPending(false);

                setStatus(
                    'No se pudo enviar el offset al servidor.'
                );
            }
        }, [
            clearPastePreview,
            offsetX,
            offsetY,
            offsetZ
        ]);


    const layoutGroup =
        useCallback((operation: number) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            const ids = [
                ...selectedIdsRef.current
            ];

            if(ids.length < 2)
            {
                setStatus(
                    'Selecciona al menos 2 furnis.'
                );

                return;
            }

            const axisId =
                pivotIdRef.current
                ?? ids[0];

            if(!ids.includes(axisId))
            {
                setStatus(
                    'El eje debe pertenecer a la seleccion.'
                );

                return;
            }

            let spacing = 0;

            if(operation !== FORMATION_STACK)
            {
                const normalized =
                    formationSpacing.trim();

                const parsedSpacing =
                    normalized.length
                        ? Number(normalized)
                        : 0;

                if(
                    !Number.isSafeInteger(parsedSpacing)
                    || parsedSpacing < 0
                    || parsedSpacing > 50
                )
                {
                    setStatus(
                        'La separacion debe ser un entero entre 0 y 50.'
                    );

                    return;
                }

                spacing = parsedSpacing;
            }

            duplicateRequestedRef.current = false;
            duplicateModeRef.current = false;
            setDuplicateMode(false);

            clearPastePreview();

            pasteModeRef.current = false;
            setPasteMode(false);

            heldArrowRef.current = null;

            if(keyboardRepeatTimerRef.current !== null)
            {
                window.clearTimeout(
                    keyboardRepeatTimerRef.current
                );

                keyboardRepeatTimerRef.current = null;
            }

            requestIdRef.current++;

            if(requestIdRef.current > 2000000000)
            {
                requestIdRef.current = 1;
            }

            const requestId =
                requestIdRef.current;

            pendingRef.current = true;
            pendingRequestIdRef.current = requestId;
            pendingStartedAtRef.current =
                performance.now();

            setPending(true);
            setStatus('Organizando...');

            try
            {
                SendMessageComposer(
                    new BuilderProLayoutGroupComposer(
                        ids,
                        operation,
                        axisId,
                        spacing,
                        requestId
                    )
                );

                if(pendingTimeoutRef.current !== null)
                {
                    window.clearTimeout(
                        pendingTimeoutRef.current
                    );
                }

                pendingTimeoutRef.current =
                    window.setTimeout(
                        () =>
                        {
                            pendingTimeoutRef.current = null;

                            if(
                                !pendingRef.current
                                || pendingRequestIdRef.current
                                !== requestId
                            )
                            {
                                return;
                            }

                            pendingRef.current = false;
                            pendingRequestIdRef.current = null;
                            pendingStartedAtRef.current = 0;

                            setPending(false);

                            setStatus(
                                'Operacion sin confirmacion del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT FORMATION_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current = false;
                pendingRequestIdRef.current = null;
                pendingStartedAtRef.current = 0;

                setPending(false);

                setStatus(
                    'No se pudo enviar la operacion al servidor.'
                );
            }
        }, [
            clearPastePreview,
            formationSpacing
        ]);

    const historyAction = useCallback((
        action: number
    ) =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;

        if(
            action !== 1 &&
            action !== 2
        )
        {
            return;
        }

        duplicateRequestedRef.current = false;
        duplicateModeRef.current = false;
        setDuplicateMode(false);

        clearPastePreview();

        pasteModeRef.current = false;
        setPasteMode(false);

        heldArrowRef.current = null;

        if(keyboardRepeatTimerRef.current !== null)
        {
            window.clearTimeout(
                keyboardRepeatTimerRef.current
            );

            keyboardRepeatTimerRef.current = null;
        }

        requestIdRef.current++;

        if(requestIdRef.current > 2000000000)
        {
            requestIdRef.current = 1;
        }

        const requestId =
            requestIdRef.current;

        pendingRef.current = true;
        pendingRequestIdRef.current =
            requestId;

        pendingStartedAtRef.current =
            performance.now();

        setPending(true);

        setStatus(
            action === 1
                ? 'Deshaciendo...'
                : 'Rehaciendo...'
        );

        try
        {
            SendMessageComposer(
                new BuilderProHistoryComposer(
                    action,
                    requestId
                )
            );

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );
            }

            pendingTimeoutRef.current =
                window.setTimeout(
                    () =>
                    {
                        pendingTimeoutRef.current =
                            null;

                        if(!pendingRef.current)
                        {
                            return;
                        }

                        pendingRef.current = false;
                        pendingRequestIdRef.current =
                            null;

                        pendingStartedAtRef.current =
                            0;

                        setPending(false);

                        setStatus(
                            'Undo/Redo sin confirmacion del servidor.'
                        );
                    },
                    MOVE_CONFIRM_TIMEOUT_MS
                );
        }
        catch(error)
        {
            console.error(
                `[BuilderProTrace] CLIENT HISTORY_SEND_ERROR #${ requestId }`,
                error
            );

            pendingRef.current = false;
            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            setPending(false);

            setStatus(
                'No se pudo enviar Undo/Redo al servidor.'
            );
        }
    }, [ clearPastePreview ]);

    const copyGroup = useCallback(() =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;
        if(dragRef.current) return;

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

        requestIdRef.current++;

        if(requestIdRef.current > 2000000000)
        {
            requestIdRef.current = 1;
        }

        const requestId =
            requestIdRef.current;

        heldArrowRef.current = null;

        if(keyboardRepeatTimerRef.current !== null)
        {
            window.clearTimeout(
                keyboardRepeatTimerRef.current
            );

            keyboardRepeatTimerRef.current = null;
        }

        pendingRef.current = true;
        pendingRequestIdRef.current =
            requestId;

        pendingStartedAtRef.current =
            performance.now();

        setPending(true);

        setStatus(
            `Copiando ${ ids.length } furnis...`
        );

        try
        {
            SendMessageComposer(
                new BuilderProCopyGroupComposer(
                    ids,
                    requestId
                )
            );

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );
            }

            pendingTimeoutRef.current =
                window.setTimeout(
                    () =>
                    {
                        pendingTimeoutRef.current =
                            null;

                        if(!pendingRef.current)
                        {
                            return;
                        }

                        pendingRef.current = false;
                        pendingRequestIdRef.current =
                            null;

                        pendingStartedAtRef.current =
                            0;

                        setPending(false);

                        setStatus(
                            'Copia sin confirmacion del servidor.'
                        );
                    },
                    MOVE_CONFIRM_TIMEOUT_MS
                );
        }
        catch(error)
        {
            console.error(
                `[BuilderProTrace] CLIENT COPY_SEND_ERROR #${ requestId }`,
                error
            );

            pendingRef.current = false;
            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            setPending(false);

            setStatus(
                'No se pudo enviar la copia al servidor.'
            );
        }
    }, []);

    const transformGroup = useCallback((
        operation: number,
        argument: number
    ) =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;

        let ids = [
            ...selectedIdsRef.current
        ];

        if(
            operation === TRANSFORM_ROTATE_STRUCTURE &&
            pivotIdRef.current !== null &&
            ids.includes(
                pivotIdRef.current
            )
        )
        {
            ids = [
                pivotIdRef.current,
                ...ids.filter(
                    id =>
                        id !==
                        pivotIdRef.current
                )
            ];
        }

        if(!ids.length)
        {
            setStatus(
                'Selecciona al menos un furni.'
            );

            return;
        }

        const snapshots =
            captureTransformSnapshots(
                ids
            );

        if(!snapshots)
        {
            setStatus(
                'No se pudo capturar la geometria completa.'
            );

            return;
        }

        if(!applyTransformPreview(
            snapshots,
            operation,
            argument
        ))
        {
            setStatus(
                'No se pudo mostrar el preview de la transformacion.'
            );

            return;
        }

        let targetRotations: number[] = [];

        if(operation === TRANSFORM_ORIENT)
        {
            const exactRotations =
                capturePreviewServerRotations(
                    ids
                );

            if(!exactRotations)
            {
                restoreTransformSnapshots(
                    snapshots
                );

                setStatus(
                    'No se pudieron leer las orientaciones nativas.'
                );

                return;
            }

            targetRotations =
                exactRotations;
        }

        requestIdRef.current++;

        if(requestIdRef.current > 2000000000)
        {
            requestIdRef.current = 1;
        }

        const requestId =
            requestIdRef.current;

        pendingRef.current = true;
        pendingRequestIdRef.current =
            requestId;

        pendingStartedAtRef.current =
            performance.now();

        pendingTransformPreviewRef.current = {
            requestId,
            snapshots
        };

        heldArrowRef.current = null;
        keyboardBlockedRef.current = false;

        if(keyboardRepeatTimerRef.current !== null)
        {
            window.clearTimeout(
                keyboardRepeatTimerRef.current
            );

            keyboardRepeatTimerRef.current =
                null;
        }

        console.log(
            `[BuilderProTrace] CLIENT TRANSFORM_SEND #${ requestId } op=${ operation } arg=${ argument } count=${ ids.length }`
        );

        setPending(true);

        if(operation === TRANSFORM_HEIGHT)
        {
            const delta =
                argument / 1000;

            setStatus(
                `Altura Z ${ delta > 0 ? '+' : '' }${ delta } en ${ ids.length } furnis...`
            );
        }
        else if(operation === TRANSFORM_ORIENT)
        {
            setStatus(
                `Girando orientacion de ${ ids.length } furnis como Holo...`
            );
        }
        else
        {
            const pivotText =
                pivotIdRef.current !== null
                    ? `furni #${ pivotIdRef.current }`
                    : 'primer seleccionado';

            setStatus(
                `Rotando estructura ${ argument > 0 ? '+90' : '-90' }. Pivote: ${ pivotText }.`
            );
        }

        try
        {
            SendMessageComposer(
                new BuilderProTransformGroupComposer(
                    ids,
                    operation,
                    argument,
                    requestId,
                    targetRotations
                )
            );

            if(pendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    pendingTimeoutRef.current
                );
            }

            pendingTimeoutRef.current =
                window.setTimeout(
                    () =>
                    {
                        pendingTimeoutRef.current =
                            null;

                        if(!pendingRef.current)
                        {
                            return;
                        }

                        const preview =
                            pendingTransformPreviewRef.current;

                        if(
                            preview?.requestId ===
                            pendingRequestIdRef.current
                        )
                        {
                            restoreTransformSnapshots(
                                preview.snapshots
                            );
                        }

                        console.warn(
                            `[BuilderProTrace] CLIENT TRANSFORM_TIMEOUT #${ pendingRequestIdRef.current }`
                        );

                        pendingRef.current = false;
                        pendingRequestIdRef.current =
                            null;

                        pendingStartedAtRef.current =
                            0;

                        pendingTransformPreviewRef.current =
                            null;

                        setPending(false);

                        setStatus(
                            'Transformacion sin confirmacion. Preview restaurado.'
                        );
                    },
                    MOVE_CONFIRM_TIMEOUT_MS
                );
        }
        catch(error)
        {
            restoreTransformSnapshots(
                snapshots
            );

            console.error(
                `[BuilderProTrace] CLIENT TRANSFORM_SEND_ERROR #${ requestId }`,
                error
            );

            pendingRef.current = false;
            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            pendingTransformPreviewRef.current =
                null;

            setPending(false);

            setStatus(
                'No se pudo enviar la transformacion al servidor.'
            );
        }
    }, [
        applyTransformPreview,
        capturePreviewServerRotations,
        captureTransformSnapshots,
        restoreTransformSnapshots
    ]);


    useEffect(() =>
    {
        if(!active) return;

        const onMouseDown = (
            event: globalThis.MouseEvent
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;
            if(event.button !== 0) return;

            if(
                !event.altKey ||
                event.ctrlKey ||
                event.metaKey ||
                event.shiftKey
            )
            {
                return;
            }

            if(
                !(event.target instanceof
                    HTMLCanvasElement)
            )
            {
                return;
            }

            pointerDownRef.current = {
                canvas: event.target,
                clientX: event.clientX,
                clientY: event.clientY
            };
        };

        const onMouseMove = (
            event: globalThis.MouseEvent
        ) =>
        {
            const drag =
                dragRef.current;

            if(!drag) return;
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            drag.insideCanvas =
                event.target instanceof
                    HTMLCanvasElement;

            const screenDeltaX =
                event.clientX -
                drag.startClientX;

            const screenDeltaY =
                event.clientY -
                drag.startClientY;

            const rawDeltaX =
                (
                    (
                        screenDeltaX *
                        drag.basisYScreenY
                    ) -
                    (
                        drag.basisYScreenX *
                        screenDeltaY
                    )
                ) /
                drag.determinant;

            const rawDeltaY =
                (
                    (
                        drag.basisXScreenX *
                        screenDeltaY
                    ) -
                    (
                        screenDeltaX *
                        drag.basisXScreenY
                    )
                ) /
                drag.determinant;

            const deltaX =
                Math.round(rawDeltaX);

            const deltaY =
                Math.round(rawDeltaY);

            if(
                deltaX === drag.deltaX &&
                deltaY === drag.deltaY
            )
            {
                return;
            }

            drag.deltaX = deltaX;
            drag.deltaY = deltaY;

            if(!drag.insideCanvas)
            {
                setStatus(
                    'Arrastre fuera de la sala. Vuelve al canvas para soltar.'
                );

                return;
            }

            if(!applyPreviewLocations(
                drag.originalLocations,
                deltaX,
                deltaY
            ))
            {
                setStatus(
                    'No se pudo actualizar el preview completo.'
                );

                return;
            }

            const formatDelta = (
                value: number
            ) =>
            {
                if(value > 0)
                {
                    return `+${ value }`;
                }

                return `${ value }`;
            };

            setStatus(
                `Arrastre: X ${ formatDelta(deltaX) }, Y ${ formatDelta(deltaY) }. Suelta para mover ${ selectedIdsRef.current.length } furnis.`
            );
        };

        const armClickRelease = () =>
        {
            if(
                suppressDragClickTimerRef.current
                !== null
            )
            {
                window.clearTimeout(
                    suppressDragClickTimerRef.current
                );
            }

            suppressDragClickTimerRef.current =
                window.setTimeout(
                    () =>
                    {
                        suppressDragClickRef.current =
                            false;

                        suppressDragClickTimerRef.current =
                            null;
                    },
                    100
                );
        };

        const onMouseUp = (
            event: globalThis.MouseEvent
        ) =>
        {
            pointerDownRef.current = null;

            const drag =
                dragRef.current;

            if(!drag) return;

            dragRef.current = null;

            armClickRelease();

            if(event.button !== 0)
            {
                applyPreviewLocations(
                    drag.originalLocations,
                    0,
                    0
                );

                setStatus(
                    'Arrastre cancelado.'
                );

                return;
            }

            if(
                !(event.target instanceof
                    HTMLCanvasElement)
            )
            {
                applyPreviewLocations(
                    drag.originalLocations,
                    0,
                    0
                );

                setStatus(
                    'Arrastre cancelado: suelta dentro de la sala.'
                );

                return;
            }

            const deltaX =
                drag.deltaX;

            const deltaY =
                drag.deltaY;

            if(
                deltaX === 0 &&
                deltaY === 0
            )
            {
                applyPreviewLocations(
                    drag.originalLocations,
                    0,
                    0
                );

                setStatus(
                    `${ selectedIdsRef.current.length } furnis seleccionados.`
                );

                return;
            }

            moveGroup(
                deltaX,
                deltaY,
                drag.originalLocations
            );
        };

        const onClick = (
            event: globalThis.MouseEvent
        ) =>
        {
            if(!suppressDragClickRef.current)
            {
                return;
            }

            if(
                !(event.target instanceof
                    HTMLCanvasElement)
            )
            {
                return;
            }

            suppressDragClickRef.current = false;

            if(
                suppressDragClickTimerRef.current
                !== null
            )
            {
                window.clearTimeout(
                    suppressDragClickTimerRef.current
                );

                suppressDragClickTimerRef.current = null;
            }

            if(event.cancelable)
            {
                event.preventDefault();
            }

            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        window.addEventListener(
            'mousedown',
            onMouseDown,
            true
        );

        /*
         * Bubble phase intencionada:
         * RoomView procesa primero el mousemove
         * del canvas; Builder Pro solo calcula
         * el delta despues.
         */
        window.addEventListener(
            'mousemove',
            onMouseMove,
            false
        );

        window.addEventListener(
            'mouseup',
            onMouseUp,
            false
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
                false
            );

            window.removeEventListener(
                'mouseup',
                onMouseUp,
                false
            );

            window.removeEventListener(
                'click',
                onClick,
                true
            );

            pointerDownRef.current = null;
            dragRef.current = null;
            suppressDragClickRef.current = false;

            if(
                suppressDragClickTimerRef.current
                !== null
            )
            {
                window.clearTimeout(
                    suppressDragClickTimerRef.current
                );

                suppressDragClickTimerRef.current = null;
            }
        };
    }, [
        active,
        moveGroup,
        applyPreviewLocations
    ]);

    const moveHeldArrow = useCallback(() =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;
        if(keyboardBlockedRef.current) return;
        if(areaStartRef.current) return;
        if(dragRef.current) return;

        const key = heldArrowRef.current;

        if(!key) return;

        const step = moveStepRef.current;

        switch(key)
        {
            case 'ArrowUp':
                moveGroup(0, -step);
                return;

            case 'ArrowDown':
                moveGroup(0, step);
                return;

            case 'ArrowLeft':
                moveGroup(-step, 0);
                return;

            case 'ArrowRight':
                moveGroup(step, 0);
                return;
        }
    }, [ moveGroup ]);

    const scheduleKeyboardRepeat = useCallback(() =>
    {
        if(!heldArrowRef.current) return;
        if(keyboardBlockedRef.current) return;

        if(keyboardRepeatTimerRef.current !== null)
        {
            window.clearTimeout(
                keyboardRepeatTimerRef.current
            );
        }

        keyboardRepeatTimerRef.current =
            window.setTimeout(
                () =>
                {
                    keyboardRepeatTimerRef.current = null;

                    moveHeldArrow();
                },
                KEYBOARD_REPEAT_INTERVAL_MS
            );
    }, [ moveHeldArrow ]);

    scheduleKeyboardRepeatRef.current =
        scheduleKeyboardRepeat;

    useEffect(() =>
    {
        if(!active) return;

        const arrowKeys = new Set([
            'ArrowUp',
            'ArrowDown',
            'ArrowLeft',
            'ArrowRight'
        ]);

        const isEditableTarget = (
            target: EventTarget | null
        ): boolean =>
        {
            if(!(target instanceof HTMLElement))
            {
                return false;
            }

            return (
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                target.isContentEditable
            );
        };

        const stopArrowEvent = (
            event: globalThis.KeyboardEvent
        ) =>
        {
            if(event.cancelable)
            {
                event.preventDefault();
            }

            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        const shouldCapture = (
            event: globalThis.KeyboardEvent
        ): boolean =>
        {
            if(!activeRef.current) return false;
            if(!arrowKeys.has(event.key)) return false;
            if(isEditableTarget(event.target)) return false;

            return (
                selectedIdsRef.current.length > 0
            );
        };

        const onKeyDown = (
            event: globalThis.KeyboardEvent
        ) =>
        {
            if(!shouldCapture(event)) return;

            stopArrowEvent(event);

            /*
             * El autorepeat nativo solo se consume.
             * Builder Pro genera su propia cadena
             * despues de cada ACK del servidor.
             */
            if(event.repeat) return;

            if(keyboardRepeatTimerRef.current !== null)
            {
                window.clearTimeout(
                    keyboardRepeatTimerRef.current
                );

                keyboardRepeatTimerRef.current = null;
            }

            heldArrowRef.current = event.key;
            keyboardBlockedRef.current = false;

            moveHeldArrow();
        };

        const onKeyUp = (
            event: globalThis.KeyboardEvent
        ) =>
        {
            if(!activeRef.current) return;
            if(!arrowKeys.has(event.key)) return;
            if(isEditableTarget(event.target)) return;

            if(selectedIdsRef.current.length)
            {
                stopArrowEvent(event);
            }

            if(
                heldArrowRef.current === event.key
            )
            {
                heldArrowRef.current = null;
            }

            if(keyboardRepeatTimerRef.current !== null)
            {
                window.clearTimeout(
                    keyboardRepeatTimerRef.current
                );

                keyboardRepeatTimerRef.current = null;
            }

            keyboardBlockedRef.current = false;
        };

        window.addEventListener(
            'keydown',
            onKeyDown,
            true
        );

        window.addEventListener(
            'keyup',
            onKeyUp,
            true
        );

        return () =>
        {
            window.removeEventListener(
                'keydown',
                onKeyDown,
                true
            );

            window.removeEventListener(
                'keyup',
                onKeyUp,
                true
            );

            heldArrowRef.current = null;
            keyboardBlockedRef.current = false;

            if(keyboardRepeatTimerRef.current !== null)
            {
                window.clearTimeout(
                    keyboardRepeatTimerRef.current
                );

                keyboardRepeatTimerRef.current = null;
            }
        };
    }, [
        active,
        moveHeldArrow
    ]);

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

                        <button
                            type="button"
                            className={
                                !highlightSelection
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={ pending }
                            onClick={ toggleHighlight }>
                            { highlightSelection
                                ? 'Resaltado: visible'
                                : 'Resaltado: oculto' }
                        </button>
                    </div>

                    <div className="builder-pro-step">
                        <span>Paso ? mantener flecha</span>

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

                    <div className="builder-pro-actions">
                        <button
                            type="button"
                            disabled={
                                pending ||
                                !canUndo
                            }
                            onClick={
                                () => historyAction(1)
                            }>
                            Deshacer
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !canRedo
                            }
                            onClick={
                                () => historyAction(2)
                            }>
                            Rehacer
                        </button>
                    </div>



                    <div className="builder-pro-layout">
                        <span>Formaciones</span>

                        <div className="builder-pro-layout-grid">
                            <button
                                type="button"
                                disabled={
                                    pending ||
                                    selectedIds.length < 2
                                }
                                onClick={
                                    () => layoutGroup(
                                        FORMATION_ROW_LEFT
                                    )
                                }>
                                Izquierda
                            </button>

                            <button
                                type="button"
                                disabled={
                                    pending ||
                                    selectedIds.length < 2
                                }
                                onClick={
                                    () => layoutGroup(
                                        FORMATION_ROW_RIGHT
                                    )
                                }>
                                Derecha
                            </button>

                            <button
                                type="button"
                                disabled={
                                    pending ||
                                    selectedIds.length < 2
                                }
                                onClick={
                                    () => layoutGroup(
                                        FORMATION_COLUMN_UP
                                    )
                                }>
                                Arriba
                            </button>

                            <button
                                type="button"
                                disabled={
                                    pending ||
                                    selectedIds.length < 2
                                }
                                onClick={
                                    () => layoutGroup(
                                        FORMATION_COLUMN_DOWN
                                    )
                                }>
                                Abajo
                            </button>

                            <button
                                type="button"
                                className="builder-pro-layout-stack"
                                disabled={
                                    pending ||
                                    selectedIds.length < 2
                                }
                                onClick={
                                    () => layoutGroup(
                                        FORMATION_STACK
                                    )
                                }>
                                Apilar
                            </button>
                        </div>

                        <span>Separacion</span>

                        <div className="builder-pro-layout-spacing">
                            { [ 0, 1, 2, 3, 4 ].map(
                                value =>
                                    <button
                                        key={ value }
                                        type="button"
                                        className={
                                            formationSpacing === `${ value }`
                                                ? 'is-selected'
                                                : ''
                                        }
                                        disabled={ pending }
                                        onClick={
                                            () => setFormationSpacing(
                                                `${ value }`
                                            )
                                        }>
                                        { value }
                                    </button>
                            ) }

                            <input
                                type="number"
                                min="0"
                                max="50"
                                step="1"
                                value={ formationSpacing }
                                disabled={ pending }
                                onChange={
                                    event =>
                                        setFormationSpacing(
                                            event.target.value
                                        )
                                } />
                        </div>

                        <span>
                            { pivotId !== null
                                ? `Eje: #${ pivotId }`
                                : 'Eje: primer seleccionado' }
                        </span>
                    </div>

                    <div className="builder-pro-offset">
                        <span>Offset exacto</span>

                        <input
                            type="text"
                            inputMode="numeric"
                            value={ offsetX }
                            disabled={ pending }
                            placeholder="X"
                            onChange={
                                event =>
                                    setOffsetX(
                                        event.target.value
                                    )
                            } />

                        <input
                            type="text"
                            inputMode="numeric"
                            value={ offsetY }
                            disabled={ pending }
                            placeholder="Y"
                            onChange={
                                event =>
                                    setOffsetY(
                                        event.target.value
                                    )
                            } />

                        <input
                            type="text"
                            inputMode="decimal"
                            value={ offsetZ }
                            disabled={ pending }
                            placeholder="Z"
                            onChange={
                                event =>
                                    setOffsetZ(
                                        event.target.value
                                    )
                            } />

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={
                                applyNumericOffset
                            }>
                            Aplicar
                        </button>
                    </div>

                    <div className="builder-pro-step">
                        <span>Altura Z</span>

                        <button
                            type="button"
                            className={
                                heightStep === 0.1
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={ pending }
                            onClick={
                                () => setHeightStep(0.1)
                            }>
                            0.1
                        </button>

                        <button
                            type="button"
                            className={
                                heightStep === 0.5
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={ pending }
                            onClick={
                                () => setHeightStep(0.5)
                            }>
                            0.5
                        </button>

                        <button
                            type="button"
                            className={
                                heightStep === 1
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={ pending }
                            onClick={
                                () => setHeightStep(1)
                            }>
                            1
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
                                () => transformGroup(
                                    TRANSFORM_HEIGHT,
                                    -Math.round(
                                        heightStep *
                                        1000
                                    )
                                )
                            }>
                            Z -
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={
                                () => transformGroup(
                                    TRANSFORM_HEIGHT,
                                    Math.round(
                                        heightStep *
                                        1000
                                    )
                                )
                            }>
                            Z +
                        </button>



                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={
                                () => transformGroup(
                                    TRANSFORM_ORIENT,
                                    1
                                )
                            }>
                            Girar furnis
                        </button>
                    </div>

                    <div className="builder-pro-selection-tools">
                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={ () =>
                            {
                                duplicateRequestedRef.current = false;
                                duplicateModeRef.current = false;
                                setDuplicateMode(false);

                                clearPastePreview();
                                pasteModeRef.current = false;
                                setPasteMode(false);

                                copyGroup();
                            } }>
                            Copiar
                        </button>

                        <button
                            type="button"
                            className={
                                duplicateMode
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={
                                pending ||
                                (
                                    !duplicateMode &&
                                    !selectedIds.length
                                )
                            }
                            onClick={ () =>
                            {
                                if(duplicateModeRef.current)
                                {
                                    duplicateRequestedRef.current = false;
                                    duplicateModeRef.current = false;
                                    setDuplicateMode(false);

                                    clearPastePreview();
                                    pasteModeRef.current = false;
                                    setPasteMode(false);

                                    setStatus('Duplicado cancelado.');
                                    return;
                                }

                                if(
                                    pendingRef.current ||
                                    dragRef.current ||
                                    !selectedIdsRef.current.length
                                )
                                {
                                    return;
                                }

                                clearPastePreview();

                                pasteModeRef.current = false;
                                setPasteMode(false);

                                duplicateRequestedRef.current = true;

                                copyGroup();
                            } }>
                            { duplicateMode
                                ? 'Cancelar duplicado'
                                : 'Duplicar' }
                        </button>
                    </div>

                    <div className="builder-pro-selection-tools">
                        <button
                            type="button"
                            className={
                                pasteMode
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={ pending || duplicateMode }
                            onClick={ togglePasteMode }>
                            { pasteMode
                                ? 'Cancelar pegado'
                                : 'Pegar' }
                        </button>
                    </div>

                    <div className="builder-pro-step">
                        <span>
                            Rotar estructura
                        </span>
                    </div>

                    <div className="builder-pro-selection-tools">
                        <button
                            type="button"
                            className={
                                pivotPickMode
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={ togglePivotPick }>
                            { pivotPickMode
                                ? 'Haz clic en el pivote'
                                : (
                                    pivotId !== null
                                        ? `Cambiar pivote #${ pivotId }`
                                        : 'Elegir pivote'
                                ) }
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                pivotId === null
                            }
                            onClick={ clearStructuralPivot }>
                            Pivote automatico
                        </button>
                    </div>

                    <div className="builder-pro-step">
                        <span>
                            { pivotId !== null
                                ? `Pivote: furni #${ pivotId }`
                                : 'Pivote: primer seleccionado (auto)' }
                        </span>
                    </div>

                    <div className="builder-pro-actions">
                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={
                                () => transformGroup(
                                    TRANSFORM_ROTATE_STRUCTURE,
                                    -1
                                )
                            }>
                            Estructura -90
                        </button>

                        <button
                            type="button"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={
                                () => transformGroup(
                                    TRANSFORM_ROTATE_STRUCTURE,
                                    1
                                )
                            }>
                            Estructura +90
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
