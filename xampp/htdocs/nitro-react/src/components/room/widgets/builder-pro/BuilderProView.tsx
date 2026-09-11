import { BuilderProPickupGroupComposer, BuilderProPickupGroupResultEvent, RoomEngineTileHoverEvent, RoomEngineTileClickEvent, BuilderProHistoryResultEvent, BuilderProHistoryComposer, BuilderProOffsetGroupResultEvent, BuilderProOffsetGroupComposer, BuilderProLayoutGroupResultEvent, BuilderProLayoutGroupComposer, BuilderProPasteGroupResultEvent, BuilderProPasteGroupComposer, BuilderProCopyGroupComposer, BuilderProCopyGroupResultEvent, BuilderProMoveGroupComposer, BuilderProMoveGroupResultEvent, BuilderProTransformGroupComposer, BuilderProTransformGroupResultEvent, BuilderProGroupStateComposer, BuilderProGroupStateEvent, BuilderProTraversalStateComposer, BuilderProTraversalStateEvent, BuilderProBlueprintStateComposer, BuilderProBlueprintStateEvent, RoomControllerLevel, RoomEngineObjectEvent, RoomObjectCategory, Vector3d, RoomObjectVariable, ILinkEventTracker} from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { FaBoxOpen, FaClone, FaCopy, FaMinus, FaPaste, FaQuestion, FaRedo, FaUndo } from 'react-icons/fa';
import { AddEventLinkTracker, BuilderProSelectionVisualizer, CanManipulateFurniture, CreateLinkEvent, GetRoomEngine, GetSessionDataManager, HasHabboClub, RemoveLinkEventTracker, SendMessageComposer, SetBuilderProSelectionModeActive } from '../../../../api';
import { useMessageEvent, useRoom, useRoomEngineEvent } from '../../../../hooks';
import { NitroCardContentView, NitroCardHeaderView, NitroCardView } from '../../../../common';
import './BuilderProView.scss';

const MAX_SELECTION = 100;
const KEYBOARD_REPEAT_INTERVAL_MS = 200;
const MOVE_CONFIRM_TIMEOUT_MS = 2500;

const TRANSFORM_HEIGHT = 1;
const TRANSFORM_ROTATE_STRUCTURE = 2;
const TRANSFORM_ORIENT = 3;
const TRANSFORM_FLOOR = 4;
const TRANSFORM_STATE_PREVIOUS = 5;
const TRANSFORM_STATE_NEXT = 6;

const FORMATION_ROW_LEFT = 1;
const FORMATION_ROW_RIGHT = 2;
const FORMATION_COLUMN_UP = 3;
const FORMATION_COLUMN_DOWN = 4;
const FORMATION_STACK = 5;

const GROUP_OP_LIST = 0;
const GROUP_OP_CREATE = 1;
const GROUP_OP_RENAME = 2;
const GROUP_OP_SET_LOCKED = 3;
const GROUP_OP_DELETE = 4;
const GROUP_OP_REPLACE_MEMBERS = 5;

const TRAVERSAL_OP_QUERY = 0;
const TRAVERSAL_OP_SET = 1;

const BLUEPRINT_OP_LIST = 0;
const BLUEPRINT_OP_CREATE = 1;
const BLUEPRINT_OP_RENAME = 2;
const BLUEPRINT_OP_DELETE = 3;
const BLUEPRINT_OP_PLACE = 4;
const BLUEPRINT_OP_PREVIEW = 5;

type BuilderProSavedGroupState = {
    id: number;
    name: string;
    locked: boolean;
    itemIds: number[];
};

type BuilderProSavedBlueprintState = {
    id: number;
    name: string;
    itemCount: number;
};

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
    const [ minimized, setMinimized ] = useState(false);
    const [ helpOpen, setHelpOpen ] = useState(false);
    const [ savedGroups, setSavedGroups ] =
        useState<BuilderProSavedGroupState[]>([]);
    const [ selectedGroupId, setSelectedGroupId ] =
        useState<number | null>(null);
    const [ groupName, setGroupName ] = useState('');
    const [ groupPending, setGroupPending ] = useState(false);
    const [ traversableIds, setTraversableIds ] =
        useState<number[]>([]);
    const [ traversalPending, setTraversalPending ] =
        useState(false);
    const [ savedBlueprints, setSavedBlueprints ] =
        useState<BuilderProSavedBlueprintState[]>([]);
    const [ selectedBlueprintId, setSelectedBlueprintId ] =
        useState<number | null>(null);
    const [ blueprintName, setBlueprintName ] =
        useState('');
    const [ blueprintPending, setBlueprintPending ] =
        useState(false);
    const [ blueprintPlaceMode, setBlueprintPlaceMode ] =
        useState(false);
    const [ moveStep, setMoveStep ] = useState(1);
    const [ heightStep, setHeightStep ] = useState(1);
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
    const pendingTransformOperationRef =
        useRef<number | null>(null);
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
    const savedGroupsRef =
        useRef<BuilderProSavedGroupState[]>([]);
    const groupPendingRef = useRef(false);
    const groupRequestIdRef = useRef(0);
    const groupOperationRef = useRef(GROUP_OP_LIST);
    const groupPendingTimeoutRef =
        useRef<number | null>(null);
    const traversableIdsRef =
        useRef<Set<number>>(new Set());
    const traversalPendingRef = useRef(false);
    const traversalRequestIdRef = useRef(0);
    const traversalOperationRef =
        useRef(TRAVERSAL_OP_QUERY);
    const traversalTimeoutRef =
        useRef<number | null>(null);
    const blueprintPendingRef =
        useRef(false);
    const blueprintRequestIdRef =
        useRef(0);
    const blueprintOperationRef =
        useRef(BLUEPRINT_OP_LIST);
    const blueprintTimeoutRef =
        useRef<number | null>(null);
    const blueprintPlaceModeRef =
        useRef(false);
    const selectedBlueprintIdRef =
        useRef<number | null>(null);
    const blueprintPreviewRef =
        useRef<BuilderProClipboardPreview | null>(null);
    const suppressAreaClickRef = useRef(false);
    const pivotIdRef = useRef<number | null>(null);
    const pivotPickModeRef = useRef(false);
    const quickShiftRef = useRef(false);
    const quickCtrlRef = useRef(false);
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
    savedGroupsRef.current = savedGroups;
    selectedBlueprintIdRef.current =
        selectedBlueprintId;
    moveStepRef.current = moveStep;

    const sessionDataManager = GetSessionDataManager();

    const hasBiriClub =
        HasHabboClub();

    const canBuild = !!roomSession &&
        (
            roomSession.isRoomOwner ||
            roomSession.controllerLevel >= RoomControllerLevel.GUEST ||
            !!sessionDataManager?.isModerator
        );

    const selectedSavedGroup =
        selectedGroupId === null
            ? null
            : (
                savedGroups.find(
                    group =>
                        group.id === selectedGroupId
                ) || null
            );

    const selectedSavedBlueprint =
        selectedBlueprintId === null
            ? null
            : (
                savedBlueprints.find(
                    blueprint =>
                        blueprint.id === selectedBlueprintId
                ) || null
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
                'Pivote automático: primer furni de la selección.'
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
                    : 'Pivote automático: primer furni seleccionado.'
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
                ? 'Resaltado de selección visible.'
                : 'Resaltado oculto. La selección sigue activa.'
        );
    }, []);


    const getAvailableGroupItemIds =
        useCallback((
            group: BuilderProSavedGroupState
        ): number[] =>
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
                return [];
            }

            return group.itemIds.filter(
                itemId =>
                {
                    const roomObject =
                        roomEngine.getRoomObject(
                            currentRoomSession.roomId,
                            itemId,
                            RoomObjectCategory.FLOOR
                        );

                    if(!roomObject)
                    {
                        return false;
                    }

                    return CanManipulateFurniture(
                        currentRoomSession,
                        itemId,
                        RoomObjectCategory.FLOOR
                    );
                }
            );
        }, []);

    const selectByAdvancedCriterion =
        useCallback((
            mode:
                'identical' |
                'height' |
                'state' |
                'rotation' |
                'all' |
                'invert'
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            if(
                !currentRoomSession ||
                !roomEngine
            )
            {
                return;
            }

            const requiresReference =
                mode !== 'all' &&
                mode !== 'invert';

            let referenceObject:
                ReturnType<typeof roomEngine.getRoomObject> =
                null;

            let referenceTypeId = 0;
            let referenceZ = 0;
            let referenceState = 0;
            let referenceRotation = 0;

            if(requiresReference)
            {
                const referenceId =
                    (
                        pivotIdRef.current !== null &&
                        selectedIdsRef.current.includes(
                            pivotIdRef.current
                        )
                    )
                        ? pivotIdRef.current
                        : (
                            selectedIdsRef.current.length
                                ? selectedIdsRef.current[0]
                                : null
                        );

                if(referenceId === null)
                {
                    setStatus(
                        'Selecciona primero un furni de referencia.'
                    );

                    return;
                }

                referenceObject =
                    roomEngine.getRoomObject(
                        currentRoomSession.roomId,
                        referenceId,
                        RoomObjectCategory.FLOOR
                    );

                if(!referenceObject)
                {
                    setStatus(
                        'No se pudo leer el furni de referencia.'
                    );

                    return;
                }

                const referenceLocation =
                    referenceObject.getLocation();

                const referenceDirection =
                    referenceObject.getDirection();

                if(
                    !referenceLocation ||
                    !referenceDirection
                )
                {
                    setStatus(
                        'No se pudo leer la geometría del furni de referencia.'
                    );

                    return;
                }

                referenceTypeId =
                    referenceObject.model.getValue<number>(
                        RoomObjectVariable.FURNITURE_TYPE_ID
                    );

                referenceZ =
                    referenceLocation.z;

                referenceState =
                    referenceObject.getState(0);

                referenceRotation =
                    (
                        (
                            Math.round(
                                referenceDirection.x /
                                45
                            ) %
                            8
                        ) +
                        8
                    ) %
                    8;
            }

            const currentSet =
                new Set(
                    selectedIdsRef.current
                );

            const next: number[] = [];
            const nextSet =
                new Set<number>();

            const handledLockedGroups =
                new Set<number>();

            let limitReached = false;

            const appendCandidate =
                (itemId: number) =>
                {
                    if(nextSet.has(itemId))
                    {
                        return;
                    }

                    const lockedGroup =
                        savedGroupsRef.current.find(
                            group =>
                                group.locked &&
                                group.itemIds.includes(
                                    itemId
                                )
                        );

                    if(lockedGroup)
                    {
                        if(
                            handledLockedGroups.has(
                                lockedGroup.id
                            )
                        )
                        {
                            return;
                        }

                        handledLockedGroups.add(
                            lockedGroup.id
                        );

                        const available =
                            getAvailableGroupItemIds(
                                lockedGroup
                            );

                        const missing =
                            available.filter(
                                id =>
                                    !nextSet.has(id)
                            );

                        if(
                            next.length +
                            missing.length >
                            MAX_SELECTION
                        )
                        {
                            limitReached = true;
                            return;
                        }

                        for(const id of missing)
                        {
                            next.push(id);
                            nextSet.add(id);
                        }

                        return;
                    }

                    if(next.length >= MAX_SELECTION)
                    {
                        limitReached = true;
                        return;
                    }

                    next.push(itemId);
                    nextSet.add(itemId);
                };

            const count =
                roomEngine.getRoomObjectCount(
                    currentRoomSession.roomId,
                    RoomObjectCategory.FLOOR
                );

            for(
                let index = 0;
                index < count;
                index++
            )
            {
                const roomObject =
                    roomEngine.getRoomObjectByIndex(
                        currentRoomSession.roomId,
                        index,
                        RoomObjectCategory.FLOOR
                    );

                if(!roomObject)
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

                let matches = false;

                if(mode === 'all')
                {
                    matches = true;
                }
                else if(mode === 'invert')
                {
                    matches =
                        !currentSet.has(
                            roomObject.id
                        );
                }
                else if(mode === 'identical')
                {
                    const typeId =
                        roomObject.model.getValue<number>(
                            RoomObjectVariable.FURNITURE_TYPE_ID
                        );

                    matches =
                        typeId ===
                        referenceTypeId;
                }
                else if(mode === 'height')
                {
                    const location =
                        roomObject.getLocation();

                    matches =
                        !!location &&
                        Math.abs(
                            location.z -
                            referenceZ
                        ) < 0.001;
                }
                else if(mode === 'state')
                {
                    const typeId =
                        roomObject.model.getValue<number>(
                            RoomObjectVariable.FURNITURE_TYPE_ID
                        );

                    matches =
                        typeId ===
                        referenceTypeId &&
                        roomObject.getState(0) ===
                        referenceState;
                }
                else if(mode === 'rotation')
                {
                    const typeId =
                        roomObject.model.getValue<number>(
                            RoomObjectVariable.FURNITURE_TYPE_ID
                        );

                    const direction =
                        roomObject.getDirection();

                    if(direction)
                    {
                        const rotation =
                            (
                                (
                                    Math.round(
                                        direction.x /
                                        45
                                    ) %
                                    8
                                ) +
                                8
                            ) %
                            8;

                        matches =
                            typeId ===
                            referenceTypeId &&
                            rotation ===
                            referenceRotation;
                    }
                }

                if(!matches)
                {
                    continue;
                }

                appendCandidate(
                    roomObject.id
                );
            }

            applySelection(
                next
            );

            const labels = {
                identical: 'Idénticos',
                height: 'Misma altura',
                state: 'Mismo estado',
                rotation: 'Misma rotación',
                all: 'Todos',
                invert: 'Selección invertida'
            };

            setStatus(
                `${ labels[mode] }: ${ next.length } furnis seleccionados.${ limitReached ? ` Límite de ${ MAX_SELECTION } alcanzado.` : '' }`
            );
        }, [
            applySelection,
            getAvailableGroupItemIds
        ]);

    const requestGroupState =
        useCallback((
            operation: number,
            groupId = 0,
            name = '',
            locked = false,
            itemIds: number[] = []
        ) =>
        {
            if(!activeRef.current) return;
            if(!roomSessionRef.current) return;
            if(groupPendingRef.current) return;

            groupRequestIdRef.current++;

            if(groupRequestIdRef.current > 2000000000)
            {
                groupRequestIdRef.current = 1;
            }

            const requestId =
                groupRequestIdRef.current;

            groupOperationRef.current =
                operation;

            groupPendingRef.current = true;
            setGroupPending(true);

            SendMessageComposer(
                new BuilderProGroupStateComposer(
                    requestId,
                    operation,
                    groupId,
                    name,
                    locked,
                    itemIds
                )
            );

            if(groupPendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    groupPendingTimeoutRef.current
                );
            }

            groupPendingTimeoutRef.current =
                window.setTimeout(
                    () =>
                    {
                        groupPendingTimeoutRef.current =
                            null;

                        if(
                            !groupPendingRef.current ||
                            groupRequestIdRef.current !==
                            requestId
                        )
                        {
                            return;
                        }

                        groupPendingRef.current = false;
                        setGroupPending(false);

                        setStatus(
                            'Sin respuesta al gestionar grupos.'
                        );
                    },
                    3000
                );
        }, []);

    useMessageEvent<BuilderProGroupStateEvent>(
        BuilderProGroupStateEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            if(
                parser.requestId !==
                groupRequestIdRef.current
            )
            {
                return;
            }

            if(groupPendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    groupPendingTimeoutRef.current
                );

                groupPendingTimeoutRef.current =
                    null;
            }

            groupPendingRef.current = false;
            setGroupPending(false);

            const nextGroups:
                BuilderProSavedGroupState[] =
                parser.groups.map(
                    group => ({
                        id: group.id,
                        name: group.name,
                        locked: group.locked,
                        itemIds: [ ...group.itemIds ]
                    })
                );

            savedGroupsRef.current =
                nextGroups;

            setSavedGroups(
                nextGroups
            );

            const operation =
                groupOperationRef.current;

            setSelectedGroupId(
                current =>
                {
                    if(
                        parser.success &&
                        operation === GROUP_OP_CREATE &&
                        nextGroups.length
                    )
                    {
                        return nextGroups[
                            nextGroups.length - 1
                        ].id;
                    }

                    if(
                        current !== null &&
                        nextGroups.some(
                            group =>
                                group.id === current
                        )
                    )
                    {
                        return current;
                    }

                    return nextGroups.length
                        ? nextGroups[0].id
                        : null;
                }
            );

            /*
             * Una selección existente nunca puede
             * quedarse parcialmente dentro de un
             * grupo que acaba de ser bloqueado.
             */
            if(parser.success)
            {
                let normalized = [
                    ...selectedIdsRef.current
                ];

                const normalizedSet =
                    new Set(normalized);

                for(const group of nextGroups)
                {
                    if(!group.locked)
                    {
                        continue;
                    }

                    const available =
                        getAvailableGroupItemIds(
                            group
                        );

                    if(
                        !available.some(
                            itemId =>
                                normalizedSet.has(
                                    itemId
                                )
                        )
                    )
                    {
                        continue;
                    }

                    for(const itemId of available)
                    {
                        if(
                            normalizedSet.has(
                                itemId
                            )
                        )
                        {
                            continue;
                        }

                        if(
                            normalized.length >=
                            MAX_SELECTION
                        )
                        {
                            break;
                        }

                        normalized.push(
                            itemId
                        );

                        normalizedSet.add(
                            itemId
                        );
                    }
                }

                if(
                    normalized.length !==
                    selectedIdsRef.current.length
                )
                {
                    applySelection(
                        normalized
                    );
                }
            }

            if(
                operation !== GROUP_OP_LIST ||
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
        if(!active) return;
        if(!roomSession) return;

        if(groupPendingTimeoutRef.current !== null)
        {
            window.clearTimeout(
                groupPendingTimeoutRef.current
            );

            groupPendingTimeoutRef.current = null;
        }

        groupPendingRef.current = false;
        setGroupPending(false);

        requestGroupState(
            GROUP_OP_LIST
        );
    }, [
        active,
        roomSession?.roomId,
        requestGroupState
    ]);

    useEffect(() =>
    {
        if(selectedGroupId === null)
        {
            setGroupName('');
            return;
        }

        const group =
            savedGroups.find(
                entry =>
                    entry.id ===
                    selectedGroupId
            );

        setGroupName(
            group?.name || ''
        );
    }, [
        savedGroups,
        selectedGroupId
    ]);

    const selectSavedGroup =
        useCallback((
            group: BuilderProSavedGroupState
        ) =>
        {
            const ids =
                getAvailableGroupItemIds(
                    group
                );

            if(!ids.length)
            {
                setStatus(
                    'Este grupo no contiene furnis disponibles en la sala.'
                );

                return;
            }

            applySelection(
                ids.slice(
                    0,
                    MAX_SELECTION
                )
            );

            setSelectedGroupId(
                group.id
            );

            setStatus(
                `${ group.name }: ${ ids.length } furnis seleccionados.`
            );
        }, [
            applySelection,
            getAvailableGroupItemIds
        ]);

    const createSavedGroup =
        useCallback(() =>
        {
            if(!selectedIdsRef.current.length)
            {
                setStatus(
                    'Selecciona furnis antes de crear un grupo.'
                );

                return;
            }

            requestGroupState(
                GROUP_OP_CREATE,
                0,
                '',
                false,
                selectedIdsRef.current
            );
        }, [ requestGroupState ]);

    const renameSavedGroup =
        useCallback(() =>
        {
            if(!selectedSavedGroup)
            {
                return;
            }

            const name =
                groupName.trim();

            if(!name)
            {
                setStatus(
                    'Escribe un nombre para el grupo.'
                );

                return;
            }

            requestGroupState(
                GROUP_OP_RENAME,
                selectedSavedGroup.id,
                name
            );
        }, [
            groupName,
            requestGroupState,
            selectedSavedGroup
        ]);

    const toggleSavedGroupLock =
        useCallback(() =>
        {
            if(!selectedSavedGroup)
            {
                return;
            }

            requestGroupState(
                GROUP_OP_SET_LOCKED,
                selectedSavedGroup.id,
                '',
                !selectedSavedGroup.locked
            );
        }, [
            requestGroupState,
            selectedSavedGroup
        ]);

    const updateSavedGroupMembers =
        useCallback(() =>
        {
            if(!selectedSavedGroup)
            {
                return;
            }

            if(selectedSavedGroup.locked)
            {
                setStatus(
                    'Desbloquea el grupo antes de cambiar sus miembros.'
                );

                return;
            }

            if(!selectedIdsRef.current.length)
            {
                setStatus(
                    'Selecciona los furnis que formarán el grupo.'
                );

                return;
            }

            requestGroupState(
                GROUP_OP_REPLACE_MEMBERS,
                selectedSavedGroup.id,
                '',
                false,
                selectedIdsRef.current
            );
        }, [
            requestGroupState,
            selectedSavedGroup
        ]);

    const deleteSavedGroup =
        useCallback(() =>
        {
            if(!selectedSavedGroup)
            {
                return;
            }

            if(
                !window.confirm(
                    `¿Desagrupar "${ selectedSavedGroup.name }"? Los furnis no se eliminarán.`
                )
            )
            {
                return;
            }

            requestGroupState(
                GROUP_OP_DELETE,
                selectedSavedGroup.id
            );
        }, [
            requestGroupState,
            selectedSavedGroup
        ]);

    const requestBlueprintState =
        useCallback((
            operation: number,
            blueprintId = 0,
            name = '',
            anchorX = 0,
            anchorY = 0,
            itemIds: number[] = []
        ) =>
        {
            if(!activeRef.current) return;
            if(!roomSessionRef.current) return;
            if(blueprintPendingRef.current) return;

            blueprintRequestIdRef.current++;

            if(
                blueprintRequestIdRef.current >
                2000000000
            )
            {
                blueprintRequestIdRef.current = 1;
            }

            const requestId =
                blueprintRequestIdRef.current;

            blueprintOperationRef.current =
                operation;

            blueprintPendingRef.current =
                true;

            setBlueprintPending(
                true
            );

            SendMessageComposer(
                new BuilderProBlueprintStateComposer(
                    requestId,
                    operation,
                    blueprintId,
                    name,
                    anchorX,
                    anchorY,
                    itemIds
                )
            );

            if(
                blueprintTimeoutRef.current !==
                null
            )
            {
                window.clearTimeout(
                    blueprintTimeoutRef.current
                );
            }

            blueprintTimeoutRef.current =
                window.setTimeout(
                    () =>
                    {
                        blueprintTimeoutRef.current =
                            null;

                        if(
                            !blueprintPendingRef.current ||
                            blueprintRequestIdRef.current !==
                            requestId
                        )
                        {
                            return;
                        }

                        blueprintPendingRef.current =
                            false;

                        setBlueprintPending(
                            false
                        );

                        setStatus(
                            'Sin respuesta al gestionar blueprints.'
                        );
                    },
                    3000
                );
        }, []);

    useMessageEvent<BuilderProBlueprintStateEvent>(
        BuilderProBlueprintStateEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            if(
                parser.requestId !==
                blueprintRequestIdRef.current
            )
            {
                return;
            }

            if(
                blueprintTimeoutRef.current !==
                null
            )
            {
                window.clearTimeout(
                    blueprintTimeoutRef.current
                );

                blueprintTimeoutRef.current =
                    null;
            }

            blueprintPendingRef.current =
                false;

            setBlueprintPending(
                false
            );

            const nextBlueprints:
                BuilderProSavedBlueprintState[] =
                parser.blueprints.map(
                    blueprint => ({
                        id: blueprint.id,
                        name: blueprint.name,
                        itemCount: blueprint.itemCount
                    })
                );

            setSavedBlueprints(
                nextBlueprints
            );

            const operation =
                blueprintOperationRef.current;

            if(
                parser.success &&
                operation === BLUEPRINT_OP_PREVIEW
            )
            {
                const entries = [
                    ...parser.previewEntries
                ];

                if(
                    parser.previewBlueprintId !==
                    selectedBlueprintIdRef.current ||
                    !entries.length
                )
                {
                    blueprintPreviewRef.current =
                        null;

                    blueprintPlaceModeRef.current =
                        false;

                    setBlueprintPlaceMode(
                        false
                    );

                    setStatus(
                        'No se pudo preparar la vista previa del blueprint.'
                    );
                }
                else
                {
                    blueprintPreviewRef.current = {
                        sourceAnchorZ: 0,
                        entries:
                            entries.map(
                                entry => ({
                                    ...entry
                                })
                            )
                    };

                    blueprintPlaceModeRef.current =
                        true;

                    setBlueprintPlaceMode(
                        true
                    );

                    setStatus(
                        'Blueprint: mueve el cursor y haz clic en el destino.'
                    );
                }
            }

            if(
                parser.success &&
                operation === BLUEPRINT_OP_PLACE
            )
            {
                const placedIds = [
                    ...parser.placedItemIds
                ];

                if(placedIds.length)
                {
                    applySelection(
                        placedIds
                    );

                    setCanUndo(true);
                    setCanRedo(false);

                    window.requestAnimationFrame(
                        () =>
                        {
                            BuilderProSelectionVisualizer.refresh(
                                placedIds
                            );
                        }
                    );
                }
            }

            setSelectedBlueprintId(
                current =>
                {
                    if(
                        parser.success &&
                        operation ===
                        BLUEPRINT_OP_CREATE &&
                        nextBlueprints.length
                    )
                    {
                        return nextBlueprints[0].id;
                    }

                    if(
                        current !== null &&
                        nextBlueprints.some(
                            blueprint =>
                                blueprint.id === current
                        )
                    )
                    {
                        return current;
                    }

                    return nextBlueprints.length
                        ? nextBlueprints[0].id
                        : null;
                }
            );

            if(
                (
                    operation !==
                    BLUEPRINT_OP_LIST &&
                    operation !==
                    BLUEPRINT_OP_PREVIEW
                ) ||
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
        if(!active) return;
        if(!roomSession) return;

        if(
            blueprintTimeoutRef.current !==
            null
        )
        {
            window.clearTimeout(
                blueprintTimeoutRef.current
            );

            blueprintTimeoutRef.current =
                null;
        }

        blueprintPendingRef.current =
            false;

        setBlueprintPending(
            false
        );

        requestBlueprintState(
            BLUEPRINT_OP_LIST
        );
    }, [
        active,
        roomSession?.roomId,
        requestBlueprintState
    ]);

    useEffect(() =>
    {
        if(selectedBlueprintId === null)
        {
            setBlueprintName('');
            return;
        }

        const blueprint =
            savedBlueprints.find(
                entry =>
                    entry.id ===
                    selectedBlueprintId
            );

        setBlueprintName(
            blueprint?.name || ''
        );
    }, [
        savedBlueprints,
        selectedBlueprintId
    ]);

    const createBlueprint =
        useCallback(() =>
        {
            if(!selectedIdsRef.current.length)
            {
                setStatus(
                    'Selecciona furnis antes de guardar un blueprint.'
                );

                return;
            }

            requestBlueprintState(
                BLUEPRINT_OP_CREATE,
                0,
                '',
                0,
                0,
                selectedIdsRef.current
            );
        }, [
            requestBlueprintState
        ]);

    const renameBlueprint =
        useCallback(() =>
        {
            if(!selectedSavedBlueprint)
            {
                return;
            }

            const name =
                blueprintName.trim();

            if(!name)
            {
                setStatus(
                    'Escribe un nombre para el blueprint.'
                );

                return;
            }

            requestBlueprintState(
                BLUEPRINT_OP_RENAME,
                selectedSavedBlueprint.id,
                name
            );
        }, [
            blueprintName,
            requestBlueprintState,
            selectedSavedBlueprint
        ]);

    const deleteBlueprint =
        useCallback(() =>
        {
            if(!selectedSavedBlueprint)
            {
                return;
            }

            if(
                !window.confirm(
                    `¿Eliminar "${ selectedSavedBlueprint.name }"?`
                )
            )
            {
                return;
            }

            requestBlueprintState(
                BLUEPRINT_OP_DELETE,
                selectedSavedBlueprint.id
            );
        }, [
            requestBlueprintState,
            selectedSavedBlueprint
        ]);

    const toggleBlueprintPlaceMode =
        useCallback(() =>
        {
            if(pendingRef.current) return;
            if(blueprintPendingRef.current) return;

            if(blueprintPlaceModeRef.current)
            {
                blueprintPlaceModeRef.current =
                    false;

                blueprintPreviewRef.current =
                    null;

                setBlueprintPlaceMode(
                    false
                );

                setStatus(
                    'Colocación de blueprint cancelada.'
                );

                return;
            }

            const blueprintId =
                selectedBlueprintIdRef.current;

            if(!blueprintId)
            {
                setStatus(
                    'Selecciona un blueprint para colocarlo.'
                );

                return;
            }

            if(pasteModeRef.current)
            {
                setStatus(
                    'Cancela primero el modo Pegar o Duplicar.'
                );

                return;
            }

            blueprintPreviewRef.current =
                null;

            setStatus(
                'Preparando vista previa del blueprint...'
            );

            requestBlueprintState(
                BLUEPRINT_OP_PREVIEW,
                blueprintId
            );
        }, [
            requestBlueprintState
        ]);

    useEffect(() =>
    {
        if(active) return;

        blueprintPlaceModeRef.current =
            false;

        setBlueprintPlaceMode(
            false
        );
    }, [ active ]);

    const requestTraversalState =
        useCallback((
            operation: number,
            enabled = false,
            itemIds: number[] = []
        ) =>
        {
            if(!activeRef.current) return;
            if(!roomSessionRef.current) return;
            if(traversalPendingRef.current) return;

            traversalRequestIdRef.current++;

            if(traversalRequestIdRef.current > 2000000000)
            {
                traversalRequestIdRef.current = 1;
            }

            const requestId =
                traversalRequestIdRef.current;

            traversalOperationRef.current =
                operation;

            traversalPendingRef.current =
                true;

            setTraversalPending(
                true
            );

            SendMessageComposer(
                new BuilderProTraversalStateComposer(
                    requestId,
                    operation,
                    enabled,
                    itemIds
                )
            );

            if(traversalTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    traversalTimeoutRef.current
                );
            }

            traversalTimeoutRef.current =
                window.setTimeout(
                    () =>
                    {
                        traversalTimeoutRef.current =
                            null;

                        if(
                            !traversalPendingRef.current ||
                            traversalRequestIdRef.current !==
                            requestId
                        )
                        {
                            return;
                        }

                        traversalPendingRef.current =
                            false;

                        setTraversalPending(
                            false
                        );

                        setStatus(
                            'Sin respuesta al actualizar la colisión.'
                        );
                    },
                    3000
                );
        }, []);

    useMessageEvent<BuilderProTraversalStateEvent>(
        BuilderProTraversalStateEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            if(
                parser.requestId !==
                traversalRequestIdRef.current
            )
            {
                return;
            }

            if(traversalTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    traversalTimeoutRef.current
                );

                traversalTimeoutRef.current =
                    null;
            }

            traversalPendingRef.current =
                false;

            setTraversalPending(
                false
            );

            const ids = [
                ...parser.itemIds
            ];

            traversableIdsRef.current =
                new Set(
                    ids
                );

            setTraversableIds(
                ids
            );

            if(
                traversalOperationRef.current !==
                TRAVERSAL_OP_QUERY ||
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
        if(!active) return;
        if(!roomSession) return;

        traversalPendingRef.current =
            false;

        setTraversalPending(
            false
        );

        requestTraversalState(
            TRAVERSAL_OP_QUERY
        );
    }, [
        active,
        roomSession?.roomId,
        requestTraversalState
    ]);

    const toggleTraversableSelection =
        useCallback(() =>
        {
            if(!selectedIdsRef.current.length)
            {
                setStatus(
                    'Selecciona furnis para cambiar su colisión.'
                );

                return;
            }

            const allEnabled =
                selectedIdsRef.current.every(
                    itemId =>
                        traversableIdsRef.current.has(
                            itemId
                        )
                );

            requestTraversalState(
                TRAVERSAL_OP_SET,
                !allEnabled,
                selectedIdsRef.current
            );
        }, [
            requestTraversalState
        ]);

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

        if(groupPendingTimeoutRef.current !== null)
        {
            window.clearTimeout(
                groupPendingTimeoutRef.current
            );

            groupPendingTimeoutRef.current = null;
        }

        groupPendingRef.current = false;
        savedGroupsRef.current = [];

        SetBuilderProSelectionModeActive(false);

        clearSelection();

        setActive(false);
        setPending(false);
        setAreaMode(false);
        setSelectionBox(null);
        setMinimized(false);
        setHelpOpen(false);
        setGroupPending(false);
        setSavedGroups([]);

        if(traversalTimeoutRef.current !== null)
        {
            window.clearTimeout(
                traversalTimeoutRef.current
            );

            traversalTimeoutRef.current = null;
        }

        traversalPendingRef.current = false;
        traversableIdsRef.current = new Set();

        setTraversalPending(false);
        setTraversableIds([]);
        setSelectedGroupId(null);
        setGroupName('');
        setStatus('');
    }, [ clearSelection ]);

    const activate = useCallback(() =>
    {
        if(!canBuild) return;

        clearSelection();

        if(groupPendingTimeoutRef.current !== null)
        {
            window.clearTimeout(
                groupPendingTimeoutRef.current
            );

            groupPendingTimeoutRef.current = null;
        }

        groupPendingRef.current = false;
        savedGroupsRef.current = [];

        activeRef.current = true;
        pendingRef.current = false;
        areaModeRef.current = false;
        areaStartRef.current = null;

        SetBuilderProSelectionModeActive(true);

        setActive(true);
        setPending(false);
        setAreaMode(false);
        setSelectionBox(null);
        setMinimized(false);
        setHelpOpen(false);
        setGroupPending(false);
        setSavedGroups([]);

        if(traversalTimeoutRef.current !== null)
        {
            window.clearTimeout(
                traversalTimeoutRef.current
            );

            traversalTimeoutRef.current = null;
        }

        traversalPendingRef.current = false;
        traversableIdsRef.current = new Set();

        setTraversalPending(false);
        setTraversableIds([]);
        setSelectedGroupId(null);
        setGroupName('');
        setStatus('');
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
        const linkTracker: ILinkEventTracker = {
            linkReceived: (url: string) =>
            {
                const parts = url.split('/');

                if(parts.length < 2) return;

                switch(parts[1])
                {
                    case 'show':
                        activate();
                        return;

                    case 'hide':
                        deactivate();
                        return;

                    case 'toggle':
                        toggleMode();
                        return;
                }
            },
            eventUrlPrefix: 'builder-pro/'
        };

        AddEventLinkTracker(linkTracker);

        return () =>
            RemoveLinkEventTracker(linkTracker);
    }, [
        activate,
        deactivate,
        toggleMode
    ]);

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
                ? 'Selección por área activa. Arrastra sobre la sala.'
                : 'Selección por clic activa.'
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

        for(const group of savedGroupsRef.current)
        {
            if(!group.locked)
            {
                continue;
            }

            if(
                !group.itemIds.some(
                    itemId =>
                        nextSet.has(
                            itemId
                        )
                )
            )
            {
                continue;
            }

            const available =
                getAvailableGroupItemIds(
                    group
                );

            for(const itemId of available)
            {
                if(nextSet.has(itemId))
                {
                    continue;
                }

                if(next.length >= MAX_SELECTION)
                {
                    break;
                }

                next.push(itemId);
                nextSet.add(itemId);
            }
        }

        applySelection(next);

        if(
            next.length >= MAX_SELECTION &&
            added > 0
        )
        {
            setStatus(
                `Área: ${ added } añadidos. Límite ${ MAX_SELECTION } alcanzado.`
            );

            return;
        }

        setStatus(
            `Área: ${ added } añadidos. ${ next.length } seleccionados.`
        );
    }, [
        applySelection,
        getAvailableGroupItemIds
    ]);

    useEffect(() =>
    {
        if(!active) return;

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
            if(pasteModeRef.current) return;
            if(pendingRef.current) return;
            if(event.button !== 0) return;

            const altDrag =
                event.altKey &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.shiftKey;

            /*
             * El arrastre de area puede comenzar:
             *
             * - por Alt+arrastrar, siempre;
             * - sin Alt cuando el usuario ha pulsado
             *   el boton Seleccionar area.
             */
            if(
                !altDrag &&
                !areaModeRef.current
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

            const startCanvasX =
                (event.clientX - rect.left) *
                scaleX;

            const startCanvasY =
                (event.clientY - rect.top) *
                scaleY;

            /*
             * REGLA DE PRIORIDAD:
             *
             * Alt + arrastrar iniciado sobre un
             * furni YA seleccionado pertenece al
             * movimiento del grupo.
             *
             * Solo discriminamos asi cuando Alt
             * es el gesto utilizado. El modo
             * manual de Area sigue disponible
             * para tactil/movil.
             */
            if(altDrag)
            {
                const currentRoomSession =
                    roomSessionRef.current;

                const roomEngine =
                    GetRoomEngine();

                if(currentRoomSession && roomEngine)
                {
                    for(const id of selectedIdsRef.current)
                    {
                        const bounds =
                            roomEngine
                                .getRoomObjectBoundingRectangle(
                                    currentRoomSession.roomId,
                                    id,
                                    RoomObjectCategory.FLOOR,
                                    1
                                );

                        if(!bounds)
                        {
                            continue;
                        }

                        const right =
                            bounds.x +
                            bounds.width;

                        const bottom =
                            bounds.y +
                            bounds.height;

                        if(
                            startCanvasX >= bounds.x &&
                            startCanvasX <= right &&
                            startCanvasY >= bounds.y &&
                            startCanvasY <= bottom
                        )
                        {
                            return;
                        }
                    }
                }
            }

            areaStartRef.current = {
                canvas,
                startClientX: event.clientX,
                startClientY: event.clientY,
                startCanvasX,
                startCanvasY
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

            /*
             * Si Nitro ya ha convertido el gesto
             * en movimiento de grupo, abandonamos
             * inmediatamente la seleccion de area.
             */
            if(dragRef.current)
            {
                areaStartRef.current = null;
                suppressAreaClickRef.current = false;
                setSelectionBox(null);
                return;
            }

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

            if(dragRef.current)
            {
                areaStartRef.current = null;
                suppressAreaClickRef.current = false;
                setSelectionBox(null);
                return;
            }

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

    useEffect(() =>
    {
        if(!active)
        {
            quickShiftRef.current = false;
            quickCtrlRef.current = false;
            return;
        }

        const onKeyDown = (
            event: globalThis.KeyboardEvent
        ) =>
        {
            quickShiftRef.current =
                event.shiftKey;

            quickCtrlRef.current =
                event.ctrlKey;
        };

        const onKeyUp = (
            event: globalThis.KeyboardEvent
        ) =>
        {
            quickShiftRef.current =
                event.shiftKey;

            quickCtrlRef.current =
                event.ctrlKey;
        };

        const onBlur = () =>
        {
            quickShiftRef.current = false;
            quickCtrlRef.current = false;
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

        window.addEventListener(
            'blur',
            onBlur
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

            window.removeEventListener(
                'blur',
                onBlur
            );

            quickShiftRef.current = false;
            quickCtrlRef.current = false;
        };
    }, [ active ]);

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
                    const lockedGroup =
                        savedGroupsRef.current.find(
                            group =>
                                group.locked &&
                                group.itemIds.includes(
                                    event.objectId
                                )
                        );

                    if(!lockedGroup)
                    {
                        return;
                    }

                    const groupIds =
                        getAvailableGroupItemIds(
                            lockedGroup
                        );

                    if(
                        !groupIds.includes(
                            event.objectId
                        )
                    )
                    {
                        return;
                    }

                    applySelection(
                        groupIds.slice(
                            0,
                            MAX_SELECTION
                        )
                    );

                    setSelectedGroupId(
                        lockedGroup.id
                    );
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
                        'No se pudo leer la geometría de la sala.'
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
                const removedId =
                    event.objectId;

                if(
                    traversableIdsRef.current.has(
                        removedId
                    )
                )
                {
                    const nextTraversable =
                        new Set(
                            traversableIdsRef.current
                        );

                    nextTraversable.delete(
                        removedId
                    );

                    traversableIdsRef.current =
                        nextTraversable;

                    setTraversableIds(
                        Array.from(
                            nextTraversable
                        )
                    );
                }

                const currentGroups =
                    savedGroupsRef.current;

                let groupsChanged =
                    false;

                const nextGroups =
                    currentGroups
                        .map(
                            group =>
                            {
                                if(
                                    !group.itemIds.includes(
                                        removedId
                                    )
                                )
                                {
                                    return group;
                                }

                                groupsChanged = true;

                                return {
                                    ...group,
                                    itemIds:
                                        group.itemIds.filter(
                                            itemId =>
                                                itemId !==
                                                removedId
                                        )
                                };
                            }
                        )
                        .filter(
                            group =>
                                group.itemIds.length >
                                0
                        );

                if(groupsChanged)
                {
                    savedGroupsRef.current =
                        nextGroups;

                    setSavedGroups(
                        nextGroups
                    );

                    setSelectedGroupId(
                        current =>
                        {
                            if(
                                current !== null &&
                                nextGroups.some(
                                    group =>
                                        group.id ===
                                        current
                                )
                            )
                            {
                                return current;
                            }

                            return nextGroups.length
                                ? nextGroups[0].id
                                : null;
                        }
                    );
                }

                if(
                    selectedIdsRef.current.includes(
                        removedId
                    )
                )
                {
                    applySelection(
                        selectedIdsRef.current.filter(
                            id =>
                                id !==
                                removedId
                        )
                    );
                }

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

            if(
                quickCtrlRef.current &&
                quickShiftRef.current
            )
            {
                setStatus(
                    'Usa Ctrl o Shift por separado.'
                );

                return;
            }

            if(quickCtrlRef.current)
            {
                if(pendingRef.current)
                {
                    return;
                }

                const lockedQuickGroup =
                    savedGroupsRef.current.find(
                        group =>
                            group.locked &&
                            group.itemIds.includes(
                                event.objectId
                            )
                    );

                const quickIds =
                    lockedQuickGroup
                        ? getAvailableGroupItemIds(
                            lockedQuickGroup
                        )
                        : [
                            event.objectId
                        ];

                if(!quickIds.length)
                {
                    setStatus(
                        'No hay furnis disponibles para recoger.'
                    );

                    return;
                }

                pickupSelection(
                    quickIds
                );

                return;
            }

            if(quickShiftRef.current)
            {
                if(pendingRef.current)
                {
                    return;
                }

                const lockedQuickGroup =
                    savedGroupsRef.current.find(
                        group =>
                            group.locked &&
                            group.itemIds.includes(
                                event.objectId
                            )
                    );

                const quickIds =
                    lockedQuickGroup
                        ? getAvailableGroupItemIds(
                            lockedQuickGroup
                        )
                        : [
                            event.objectId
                        ];

                if(!quickIds.length)
                {
                    setStatus(
                        'No hay furnis disponibles para girar.'
                    );

                    return;
                }

                transformGroup(
                    TRANSFORM_ORIENT,
                    1,
                    quickIds
                );

                return;
            }

            const current = selectedIdsRef.current;

            const lockedGroup =
                savedGroupsRef.current.find(
                    group =>
                        group.locked &&
                        group.itemIds.includes(
                            event.objectId
                        )
                );

            if(lockedGroup)
            {
                const groupIds =
                    getAvailableGroupItemIds(
                        lockedGroup
                    );

                const groupSet =
                    new Set(groupIds);

                const allSelected =
                    groupIds.length > 0 &&
                    groupIds.every(
                        itemId =>
                            current.includes(
                                itemId
                            )
                    );

                if(allSelected)
                {
                    const next =
                        current.filter(
                            itemId =>
                                !groupSet.has(
                                    itemId
                                )
                        );

                    applySelection(next);

                    setSelectedGroupId(
                        lockedGroup.id
                    );

                    setStatus(
                        `${ lockedGroup.name } deseleccionado.`
                    );

                    return;
                }

                const next = [
                    ...current
                ];

                const nextSet =
                    new Set(next);

                for(const itemId of groupIds)
                {
                    if(nextSet.has(itemId))
                    {
                        continue;
                    }

                    if(next.length >= MAX_SELECTION)
                    {
                        setStatus(
                            `El grupo no cabe en el límite de ${ MAX_SELECTION } furnis.`
                        );

                        return;
                    }

                    next.push(itemId);
                    nextSet.add(itemId);
                }

                applySelection(next);

                setSelectedGroupId(
                    lockedGroup.id
                );

                setStatus(
                    `${ lockedGroup.name }: ${ groupIds.length } furnis seleccionados.`
                );

                return;
            }

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

    useMessageEvent<BuilderProPickupGroupResultEvent>(
        BuilderProPickupGroupResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            if(
                parser.requestId !==
                pendingRequestIdRef.current
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

            setPending(
                false
            );

            setCanUndo(
                parser.canUndo
            );

            setCanRedo(
                parser.canRedo
            );

            if(parser.success)
            {
                clearSelection();

                setStatus(
                    parser.message
                );

                requestGroupState(
                    GROUP_OP_LIST
                );

                requestTraversalState(
                    TRAVERSAL_OP_QUERY
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

                requestGroupState(
                    GROUP_OP_LIST
                );

                requestTraversalState(
                    TRAVERSAL_OP_QUERY
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

            const completedOperation =
                pendingTransformOperationRef.current;

            pendingRef.current = false;
            pendingRequestIdRef.current = null;
            pendingStartedAtRef.current = 0;
            pendingTransformPreviewRef.current =
                null;
            pendingTransformOperationRef.current =
                null;

            setPending(false);

            if(parser.success)
            {
                const stateOperation =
                    completedOperation ===
                        TRANSFORM_STATE_PREVIOUS ||
                    completedOperation ===
                        TRANSFORM_STATE_NEXT;

                if(stateOperation)
                {
                    if(parser.affectedCount > 0)
                    {
                        setCanUndo(true);
                        setCanRedo(false);
                    }

                    const omitted =
                        Math.max(
                            0,
                            selectedIdsRef.current.length -
                            parser.affectedCount
                        );

                    setStatus(
                        `${ completedOperation === TRANSFORM_STATE_PREVIOUS ? 'Estado anterior' : 'Estado siguiente' }: ${ parser.affectedCount } actualizados · ${ omitted } omitidos.`
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
        const isBlueprintPreview =
            blueprintPlaceModeRef.current;

        if(
            !pasteModeRef.current &&
            !isBlueprintPreview
        )
        {
            return;
        }

        const preview =
            isBlueprintPreview
                ? blueprintPreviewRef.current
                : clipboardPreviewRef.current;

        const anchor =
            pastePreviewAnchorRef.current;

        const currentRoomSession =
            roomSessionRef.current;

        const roomEngine =
            GetRoomEngine();

        if(
            !preview ||
            !anchor ||
            !currentRoomSession ||
            !roomEngine
        )
        {
            return;
        }

        const roomId =
            currentRoomSession.roomId;

        let originZ =
            preview.sourceAnchorZ;

        if(isBlueprintPreview)
        {
            const heightMap =
                (roomEngine as any)
                    .getFurnitureStackingHeightMap?.(
                        roomId
                    );

            const surfaceZ =
                Number(
                    heightMap?.getTileHeight(
                        anchor.x,
                        anchor.y
                    )
                );

            if(!Number.isFinite(surfaceZ))
            {
                return;
            }

            let minimumOffsetZ =
                Number.POSITIVE_INFINITY;

            for(const entry of preview.entries)
            {
                minimumOffsetZ =
                    Math.min(
                        minimumOffsetZ,
                        entry.offsetZ
                    );
            }

            if(!Number.isFinite(minimumOffsetZ))
            {
                return;
            }

            originZ =
                surfaceZ -
                minimumOffsetZ;
        }

        for(let index = 0; index < preview.entries.length; index++)
        {
            const entry = preview.entries[index];
            const ghostId = BUILDER_PRO_PASTE_GHOST_ID_BASE - index;
            const x = anchor.x + entry.offsetX;
            const y = anchor.y + entry.offsetY;
            const z = originZ + entry.offsetZ;

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
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            if(
                !pasteModeRef.current &&
                !blueprintPlaceModeRef.current
            )
            {
                return;
            }

            renderPastePreview(
                event.tileX,
                event.tileY
            );
        }
    );

    const togglePasteMode = useCallback(() =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;

        if(blueprintPlaceModeRef.current)
        {
            blueprintPlaceModeRef.current =
                false;

            setBlueprintPlaceMode(
                false
            );
        }

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
        if(blueprintPlaceMode)
        {
            return;
        }

        if(pasteModeRef.current)
        {
            return;
        }

        clearPastePreview();
    }, [
        blueprintPlaceMode,
        clearPastePreview
    ]);

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

            if(blueprintPlaceModeRef.current)
            {
                event.consume();

                if(
                    pendingRef.current ||
                    blueprintPendingRef.current
                )
                {
                    return;
                }

                const blueprintId =
                    selectedBlueprintIdRef.current;

                if(!blueprintId)
                {
                    blueprintPlaceModeRef.current =
                        false;

                    setBlueprintPlaceMode(
                        false
                    );

                    setStatus(
                        'Selecciona un blueprint para colocarlo.'
                    );

                    return;
                }

                clearPastePreview();

                blueprintPreviewRef.current =
                    null;

                blueprintPlaceModeRef.current =
                    false;

                setBlueprintPlaceMode(
                    false
                );

                setStatus(
                    `Colocando blueprint en ${ event.tileX }, ${ event.tileY }...`
                );

                requestBlueprintState(
                    BLUEPRINT_OP_PLACE,
                    blueprintId,
                    '',
                    event.tileX,
                    event.tileY
                );

                return;
            }

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
                                'Pegado sin confirmación del servidor.'
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
                                'Movimiento sin confirmación. Hold detenido; vuelve a pulsar una flecha.'
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
                    'No se pudo enviar la operación al servidor.'
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
                                'Offset sin confirmación del servidor.'
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
                                'Operacion sin confirmación del servidor.'
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
                            'Undo/Redo sin confirmación del servidor.'
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

    const pickupSelection = useCallback((requestedIds?: number[]) =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;

        const ids = requestedIds
            ? [
                ...requestedIds
            ]
            : [
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

        pendingRef.current = true;
        pendingRequestIdRef.current =
            requestId;

        pendingStartedAtRef.current =
            performance.now();

        setPending(
            true
        );

        setStatus(
            `Recogiendo ${ ids.length } furnis...`
        );

        try
        {
            SendMessageComposer(
                new BuilderProPickupGroupComposer(
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

                        setPending(
                            false
                        );

                        setStatus(
                            'Recogida sin confirmacion del servidor.'
                        );
                    },
                    MOVE_CONFIRM_TIMEOUT_MS
                );
        }
        catch(error)
        {
            pendingRef.current = false;
            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            setPending(
                false
            );

            setStatus(
                'No se pudo enviar la recogida.'
            );
        }
    }, []);

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
                            'Copia sin confirmación del servidor.'
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
        argument: number,
        explicitIds?: number[]
    ) =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;

        let ids =
            explicitIds
                ? Array.from(
                    new Set(
                        explicitIds
                            .map(
                                id =>
                                    Math.trunc(id)
                            )
                            .filter(
                                id =>
                                    Number.isSafeInteger(id) &&
                                    id > 0
                            )
                    )
                )
                : [
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

        const stateOperation =
            operation === TRANSFORM_STATE_PREVIOUS ||
            operation === TRANSFORM_STATE_NEXT;

        let snapshots:
            BuilderProTransformSnapshot[] = [];

        if(!stateOperation)
        {
            const capturedSnapshots =
                captureTransformSnapshots(
                    ids
                );

            if(!capturedSnapshots)
            {
                setStatus(
                    'No se pudo capturar la geometría completa.'
                );

                return;
            }

            snapshots =
                capturedSnapshots;

            if(
                operation !== TRANSFORM_FLOOR &&
                !applyTransformPreview(
                    snapshots,
                    operation,
                    argument
                )
            )
            {
                setStatus(
                    'No se pudo mostrar el preview de la transformación.'
                );

                return;
            }
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

        pendingTransformOperationRef.current =
            operation;

        pendingTransformPreviewRef.current =
            (
                operation === TRANSFORM_FLOOR ||
                stateOperation
            )
                ? null
                : {
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

        if(operation === TRANSFORM_FLOOR)
        {
            setStatus(
                `Bajando ${ ids.length } furnis al suelo...`
            );
        }
        else if(operation === TRANSFORM_HEIGHT)
        {
            const delta =
                argument / 1000;

            setStatus(
                `Altura Z ${ delta > 0 ? '+' : '' }${ delta } en ${ ids.length } furnis...`
            );
        }
        else if(operation === TRANSFORM_STATE_PREVIOUS)
        {
            setStatus(
                `Aplicando estado anterior a ${ ids.length } furnis...`
            );
        }
        else if(operation === TRANSFORM_STATE_NEXT)
        {
            setStatus(
                `Aplicando estado siguiente a ${ ids.length } furnis...`
            );
        }
        else if(operation === TRANSFORM_ORIENT)
        {
            setStatus(
                `Girando orientación de ${ ids.length } furnis como Holo...`
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

                        pendingTransformOperationRef.current =
                            null;

                        setPending(false);

                        setStatus(
                            'Transformacion sin confirmación. Preview restaurado.'
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

            pendingTransformOperationRef.current =
                null;

            setPending(false);

            setStatus(
                'No se pudo enviar la transformación al servidor.'
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


    const selectedTraversableCount =
        selectedIds.filter(
            itemId =>
                traversableIdsRef.current.has(
                    itemId
                )
        ).length;

    const allSelectedTraversable =
        selectedIds.length > 0 &&
        selectedTraversableCount ===
        selectedIds.length;


    return (
        <>
            { active &&
                <NitroCardView
                    uniqueKey="builder-pro"
                    className="builder-pro-panel no-resize"
                    theme="primary-slim">
                    <NitroCardHeaderView
                        headerText="Construcción"
                        onCloseClick={ deactivate } />

                    <div className="builder-pro-header-actions">
                        <button
                            type="button"
                            className="builder-pro-header-button"
                            title={
                                minimized
                                    ? 'Restaurar'
                                    : 'Minimizar'
                            }
                            aria-label={
                                minimized
                                    ? 'Restaurar'
                                    : 'Minimizar'
                            }
                            onClick={ () =>
                            {
                                setMinimized(
                                    current => !current
                                );

                                setHelpOpen(false);
                            } }>
                            <FaMinus />
                        </button>

                        <button
                            type="button"
                            className={
                                `builder-pro-header-button ${
                                    helpOpen
                                        ? 'is-active'
                                        : ''
                                }`
                            }
                            title="Ayuda"
                            aria-label="Ayuda"
                            onClick={ () =>
                            {
                                const next =
                                    !helpOpen;

                                setHelpOpen(next);

                                if(next)
                                {
                                    setMinimized(false);
                                }
                            } }>
                            <FaQuestion />
                        </button>
                    </div>

                    { helpOpen &&
                        <div className="builder-pro-help">
                            <div className="builder-pro-help-title">
                                Ayuda
                            </div>

                            <div className="builder-pro-help-row">
                                <strong>Clic en furni</strong>
                                <span>
                                    Añadir o quitar de la selección
                                </span>
                            </div>

                            <div className="builder-pro-help-row">
                                <strong>Alt + arrastrar en suelo</strong>
                                <span>
                                    Seleccionar varios furnis por área
                                </span>
                            </div>

                            <div className="builder-pro-help-row">
                                <strong>
                                    Alt + arrastrar desde furni seleccionado
                                </strong>
                                <span>
                                    Mover todo el grupo
                                </span>
                            </div>

                            <div className="builder-pro-help-row">
                                <strong>Flechas del teclado</strong>
                                <span>
                                    Mover el grupo según el valor de Casillas
                                </span>
                            </div>

                            <div className="builder-pro-help-row">
                                <strong>Mantener una flecha</strong>
                                <span>
                                    Movimiento continuo
                                </span>
                            </div>

                        </div> }


                    { !minimized &&
                    <NitroCardContentView
                        className="builder-pro-content">
                    <div className="builder-pro-status">
                        <span className="builder-pro-status-text">
                            { status }
                        </span>

                        <span
                            className="builder-pro-counter"
                            title="Furnis seleccionados">
                            { selectedIds.length }/{ MAX_SELECTION }
                        </span>
                    </div>

                    <div className="builder-pro-sections">

                        <details className="builder-pro-section">
                            <summary>Selección</summary>

                            <div className="builder-pro-section-body">
                                <div className="builder-pro-grid-2">
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
                                            ? 'Área activa'
                                            : 'Seleccionar área' }
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
                                            ? 'Ocultar resaltado'
                                            : 'Mostrar resaltado' }
                                    </button>
                                </div>

                                <div className="builder-pro-subtitle">
                                    Selección avanzada
                                </div>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                selectByAdvancedCriterion(
                                                    'identical'
                                                )
                                        }>
                                        Idénticos
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                selectByAdvancedCriterion(
                                                    'height'
                                                )
                                        }>
                                        Misma altura
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                selectByAdvancedCriterion(
                                                    'state'
                                                )
                                        }>
                                        Mismo estado
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                selectByAdvancedCriterion(
                                                    'rotation'
                                                )
                                        }>
                                        Misma rotación
                                    </button>

                                    <button
                                        type="button"
                                        disabled={ pending }
                                        onClick={
                                            () =>
                                                selectByAdvancedCriterion(
                                                    'all'
                                                )
                                        }>
                                        Todos
                                    </button>

                                    <button
                                        type="button"
                                        disabled={ pending }
                                        onClick={
                                            () =>
                                                selectByAdvancedCriterion(
                                                    'invert'
                                                )
                                        }>
                                        Invertir
                                    </button>
                                </div>

                                <div className="builder-pro-hint">
                                    Idénticos, altura, estado y rotación usan el pivote o el primer furni seleccionado como referencia.
                                </div>

                                <div className="builder-pro-subtitle">
                                    Estado
                                </div>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                transformGroup(
                                                    TRANSFORM_STATE_PREVIOUS,
                                                    0
                                                )
                                        }>
                                        Estado anterior
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                transformGroup(
                                                    TRANSFORM_STATE_NEXT,
                                                    0
                                                )
                                        }>
                                        Estado siguiente
                                    </button>
                                </div>

                                <div className="builder-pro-hint">
                                    Los furnis sin estados compatibles se omiten.
                                </div>

                                <div className="builder-pro-subtitle">
                                    Pivote
                                </div>

                                <div className="builder-pro-grid-2">
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
                                                    ? `Cambiar #${ pivotId }`
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
                                        Automático
                                    </button>
                                </div>

                                <div className="builder-pro-hint">
                                    { pivotId !== null
                                        ? `Pivote actual: furni #${ pivotId }`
                                        : 'Pivote automático: primer furni seleccionado' }
                                </div>

                                <button
                                    type="button"
                                    className="builder-pro-full"
                                    disabled={
                                        pending ||
                                        !selectedIds.length
                                    }
                                    onClick={ clearSelection }>
                                    Limpiar selección
                                </button>

                                <div className="builder-pro-subtitle">
                                    Grupos
                                </div>

                                <select
                                    className="builder-pro-group-select"
                                    disabled={
                                        pending ||
                                        groupPending ||
                                        !savedGroups.length
                                    }
                                    value={
                                        selectedGroupId ??
                                        ''
                                    }
                                    onChange={
                                        event =>
                                        {
                                            const value =
                                                Number(
                                                    event.target.value
                                                );

                                            setSelectedGroupId(
                                                Number.isSafeInteger(value) &&
                                                value > 0
                                                    ? value
                                                    : null
                                            );
                                        }
                                    }>
                                    { !savedGroups.length &&
                                        <option value="">
                                            Sin grupos
                                        </option> }

                                    { savedGroups.map(
                                        group =>
                                            <option
                                                key={ group.id }
                                                value={ group.id }>
                                                { `${ group.name } · ${ group.itemIds.length } furnis${ group.locked ? ' · Bloqueado' : '' }` }
                                            </option>
                                    ) }
                                </select>

                                <div className="builder-pro-grid-2 builder-pro-group-actions">
                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            groupPending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            createSavedGroup
                                        }>
                                        Crear grupo
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            groupPending ||
                                            !selectedSavedGroup
                                        }
                                        onClick={
                                            () =>
                                                selectedSavedGroup &&
                                                selectSavedGroup(
                                                    selectedSavedGroup
                                                )
                                        }>
                                        Seleccionar
                                    </button>
                                </div>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        className={
                                            selectedSavedGroup?.locked
                                                ? 'is-selected'
                                                : ''
                                        }
                                        disabled={
                                            pending ||
                                            groupPending ||
                                            !selectedSavedGroup
                                        }
                                        onClick={
                                            toggleSavedGroupLock
                                        }>
                                        { selectedSavedGroup?.locked
                                            ? 'Desbloquear'
                                            : 'Bloquear' }
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            groupPending ||
                                            !selectedSavedGroup ||
                                            selectedSavedGroup.locked ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            updateSavedGroupMembers
                                        }>
                                        Actualizar miembros
                                    </button>
                                </div>

                                <div className="builder-pro-group-rename">
                                    <input
                                        type="text"
                                        maxLength={ 40 }
                                        placeholder="Nombre del grupo"
                                        disabled={
                                            pending ||
                                            groupPending ||
                                            !selectedSavedGroup
                                        }
                                        value={ groupName }
                                        onChange={
                                            event =>
                                                setGroupName(
                                                    event.target.value
                                                )
                                        } />

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            groupPending ||
                                            !selectedSavedGroup ||
                                            !groupName.trim()
                                        }
                                        onClick={
                                            renameSavedGroup
                                        }>
                                        Renombrar
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="builder-pro-full"
                                    disabled={
                                        pending ||
                                        groupPending ||
                                        !selectedSavedGroup
                                    }
                                    onClick={
                                        deleteSavedGroup
                                    }>
                                    Desagrupar
                                </button>

                            </div>
                        </details>

                        <details className="builder-pro-section">
                            <summary>Blueprints</summary>

                            <div className="builder-pro-section-body">
                                <select
                                    className="builder-pro-group-select"
                                    disabled={
                                        pending ||
                                        blueprintPending ||
                                        !savedBlueprints.length
                                    }
                                    value={
                                        selectedBlueprintId ??
                                        ''
                                    }
                                    onChange={
                                        event =>
                                        {
                                            const value =
                                                Number(
                                                    event.target.value
                                                );

                                            if(
                                                blueprintPlaceModeRef.current
                                            )
                                            {
                                                blueprintPlaceModeRef.current =
                                                    false;

                                                blueprintPreviewRef.current =
                                                    null;

                                                setBlueprintPlaceMode(
                                                    false
                                                );
                                            }

                                            setSelectedBlueprintId(
                                                Number.isSafeInteger(value) &&
                                                value > 0
                                                    ? value
                                                    : null
                                            );
                                        }
                                    }>
                                    { !savedBlueprints.length &&
                                        <option value="">
                                            Sin blueprints
                                        </option> }

                                    { savedBlueprints.map(
                                        blueprint =>
                                            <option
                                                key={ blueprint.id }
                                                value={ blueprint.id }>
                                                { `${ blueprint.name } · ${ blueprint.itemCount } furnis` }
                                            </option>
                                    ) }
                                </select>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            blueprintPending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                            {
                                                if(!hasBiriClub)
                                                {
                                                    setStatus(
                                                        'Guardar blueprints requiere Biri Club.'
                                                    );

                                                    CreateLinkEvent(
                                                        'habboUI/open/hccenter'
                                                    );

                                                    return;
                                                }

                                                createBlueprint();
                                            }
                                        }>
                                        { hasBiriClub
                                            ? 'Guardar selección'
                                            : 'Guardar · Biri Club' }
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            blueprintPlaceMode
                                                ? 'is-selected'
                                                : ''
                                        }
                                        disabled={
                                            pending ||
                                            blueprintPending ||
                                            !selectedSavedBlueprint
                                        }
                                        onClick={
                                            () =>
                                            {
                                                if(!hasBiriClub)
                                                {
                                                    setStatus(
                                                        'Colocar blueprints requiere Biri Club.'
                                                    );

                                                    CreateLinkEvent(
                                                        'habboUI/open/hccenter'
                                                    );

                                                    return;
                                                }

                                                toggleBlueprintPlaceMode();
                                            }
                                        }>
                                        { blueprintPlaceMode
                                            ? 'Cancelar'
                                            : (
                                                hasBiriClub
                                                    ? 'Colocar'
                                                    : 'Colocar · Biri Club'
                                            ) }
                                    </button>
                                </div>

                                <div className="builder-pro-group-rename">
                                    <input
                                        type="text"
                                        maxLength={ 50 }
                                        placeholder="Nombre del blueprint"
                                        disabled={
                                            pending ||
                                            blueprintPending ||
                                            !selectedSavedBlueprint
                                        }
                                        value={ blueprintName }
                                        onChange={
                                            event =>
                                                setBlueprintName(
                                                    event.target.value
                                                )
                                        } />

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            blueprintPending ||
                                            !selectedSavedBlueprint ||
                                            !blueprintName.trim()
                                        }
                                        onClick={
                                            renameBlueprint
                                        }>
                                        Renombrar
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="builder-pro-full"
                                    disabled={
                                        pending ||
                                        blueprintPending ||
                                        !selectedSavedBlueprint
                                    }
                                    onClick={
                                        deleteBlueprint
                                    }>
                                    Eliminar
                                </button>

                                { !hasBiriClub &&
                                    <button
                                        type="button"
                                        className="builder-pro-full"
                                        disabled={
                                            pending ||
                                            blueprintPending
                                        }
                                        onClick={
                                            () =>
                                                CreateLinkEvent(
                                                    'habboUI/open/hccenter'
                                                )
                                        }>
                                        Ver Biri Club
                                    </button> }

                                <div className="builder-pro-hint">
                                    { !hasBiriClub
                                        ? 'Blueprints requiere Biri Club para guardar y colocar. Puedes conservar, renombrar y eliminar los que ya tengas.'
                                        : (
                                            selectedSavedBlueprint
                                                ? `${ selectedSavedBlueprint.itemCount } furnis guardados · reutilizable entre salas`
                                                : 'Guarda una selección para reutilizarla después.'
                                        ) }
                                </div>
                            </div>
                        </details>

                        <details className="builder-pro-section">
                            <summary>Colisión</summary>

                            <div className="builder-pro-section-body">
                                <button
                                    type="button"
                                    className={
                                        `builder-pro-full ${
                                            allSelectedTraversable
                                                ? 'is-selected'
                                                : ''
                                        }`
                                    }
                                    disabled={
                                        pending ||
                                        traversalPending ||
                                        !selectedIds.length
                                    }
                                    onClick={
                                        toggleTraversableSelection
                                    }>
                                    { allSelectedTraversable
                                        ? 'Quitar atravesable'
                                        : 'Hacer atravesable' }
                                </button>

                                <div className="builder-pro-hint">
                                    { selectedIds.length
                                        ? `${ selectedTraversableCount }/${ selectedIds.length } seleccionados son atravesables`
                                        : 'El avatar podrá pasar por el furni sin alterar su posición ni su apilado.' }
                                </div>
                            </div>
                        </details>

                        <details className="builder-pro-section">
                            <summary>Movimiento</summary>

                            <div className="builder-pro-section-body">
                                <label className="builder-pro-field-row">
                                    <span>Casillas</span>

                                    <input
                                        className="builder-pro-small-input"
                                        type="number"
                                        min="1"
                                        max="50"
                                        step="1"
                                        value={ moveStep }
                                        disabled={ pending }
                                        onChange={
                                            event =>
                                            {
                                                const value =
                                                    Number(
                                                        event.target.value
                                                    );

                                                if(
                                                    Number.isSafeInteger(value) &&
                                                    value >= 1 &&
                                                    value <= 50
                                                )
                                                {
                                                    setMoveStep(value);
                                                }
                                            }
                                        } />
                                </label>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => moveGroup(
                                                -moveStep,
                                                0
                                            )
                                        }>
                                        Izquierda
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => moveGroup(
                                                moveStep,
                                                0
                                            )
                                        }>
                                        Derecha
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => moveGroup(
                                                0,
                                                -moveStep
                                            )
                                        }>
                                        Arriba
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => moveGroup(
                                                0,
                                                moveStep
                                            )
                                        }>
                                        Abajo
                                    </button>
                                </div>

                                <div className="builder-pro-subtitle">
                                    Desplazamiento exacto
                                </div>

                                <div className="builder-pro-offset-row">
                                    <input
                                        type="text"
                                        inputMode="numeric"
                                        value={ offsetX }
                                        disabled={ pending }
                                        placeholder="X"
                                        title="Desplazamiento X"
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
                                        title="Desplazamiento Y"
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
                                        title="Desplazamiento Z"
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
                                        onClick={ applyNumericOffset }>
                                        Aplicar
                                    </button>
                                </div>

                                <label className="builder-pro-field-row">
                                    <span>Altura</span>

                                    <input
                                        className="builder-pro-small-input"
                                        type="number"
                                        min="0.001"
                                        max="40"
                                        step="0.001"
                                        value={ heightStep }
                                        disabled={ pending }
                                        onChange={
                                            event =>
                                            {
                                                const value =
                                                    Number(
                                                        event.target.value
                                                    );

                                                if(
                                                    Number.isFinite(value) &&
                                                    value > 0 &&
                                                    value <= 40
                                                )
                                                {
                                                    setHeightStep(value);
                                                }
                                            }
                                        } />
                                </label>

                                <div className="builder-pro-grid-2">
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
                                        Bajar
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
                                        Subir
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="builder-pro-full"
                                    disabled={
                                        pending ||
                                        !selectedIds.length
                                    }
                                    onClick={
                                        () => transformGroup(
                                            TRANSFORM_FLOOR,
                                            0
                                        )
                                    }>
                                    Bajar al suelo
                                </button>
                            </div>
                        </details>

                        <details className="builder-pro-section">
                            <summary>Formaciones</summary>

                            <div className="builder-pro-section-body">
                                <div className="builder-pro-grid-2">
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
                                        className="builder-pro-full-grid"
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

                                <label className="builder-pro-field-row">
                                    <span>Separación</span>

                                    <input
                                        className="builder-pro-small-input"
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
                                </label>

                                <div className="builder-pro-hint">
                                    { pivotId !== null
                                        ? `Pivote: furni #${ pivotId }`
                                        : 'Pivote: primer furni seleccionado' }
                                </div>
                            </div>
                        </details>

                        <details className="builder-pro-section">
                            <summary>Rotación</summary>

                            <div className="builder-pro-section-body">
                                <button
                                    type="button"
                                    className="builder-pro-full"
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

                                <div className="builder-pro-grid-2">
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
                                        Estructura -90°
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
                                        Estructura +90°
                                    </button>
                                </div>
                            </div>
                        </details>



                    </div>

                    <div className="builder-pro-bottom-toolbar">
                        <button
                                                                type="button"
                                                                className="btn btn-sm btn-secondary builder-pro-icon-button"
                                title="Copiar"
                                                                aria-label="Copiar"
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
                                                                <FaCopy />
                                                            </button>

                        <button
                                                                type="button"
                                                                className={
                                    `btn btn-sm ${
                                        pasteMode
                                            ? 'btn-primary'
                                            : 'btn-secondary'
                                    } builder-pro-icon-button`
                                }
                                title={
                                                                    pasteMode
                                                                        ? 'Cancelar pegado'
                                                                        : 'Pegar'
                                                                }
                                                                aria-label={
                                                                    pasteMode
                                                                        ? 'Cancelar pegado'
                                                                        : 'Pegar'
                                                                }
                                                                disabled={
                                    pending ||
                                    duplicateMode ||
                                    !clipboardPreviewRef.current
                                }
                                                                onClick={ togglePasteMode }>
                                                                <FaPaste />
                                                            </button>

                        <button
                                                                type="button"
                                                                className={
                                    `btn btn-sm ${
                                        duplicateMode
                                            ? 'btn-primary'
                                            : 'btn-secondary'
                                    } builder-pro-icon-button`
                                }
                                title={
                                                                    duplicateMode
                                                                        ? 'Cancelar duplicado'
                                                                        : 'Duplicar'
                                                                }
                                                                aria-label={
                                                                    duplicateMode
                                                                        ? 'Cancelar duplicado'
                                                                        : 'Duplicar'
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
                                                                <FaClone />
                                                            </button>

                        <button
                            type="button"
                            className="btn btn-sm btn-secondary builder-pro-icon-button"
                            title="Recoger selección"
                            aria-label="Recoger selección"
                            disabled={
                                pending ||
                                !selectedIds.length
                            }
                            onClick={ () => pickupSelection() }>
                            <FaBoxOpen />
                        </button>

                        <button
                                                    type="button"
                                                    className="btn btn-sm btn-secondary builder-pro-icon-button"
                                title="Deshacer"
                                                    aria-label="Deshacer"
                                                    disabled={
                                                        pending ||
                                                        !canUndo
                                                    }
                                                    onClick={
                                                        () => historyAction(1)
                                                    }>
                                                    <FaUndo />
                                                </button>

                        <button
                                                    type="button"
                                                    className="btn btn-sm btn-secondary builder-pro-icon-button"
                                title="Rehacer"
                                                    aria-label="Rehacer"
                                                    disabled={
                                                        pending ||
                                                        !canRedo
                                                    }
                                                    onClick={
                                                        () => historyAction(2)
                                                    }>
                                                    <FaRedo />
                                                </button>
                    </div>
                    </NitroCardContentView> }
                </NitroCardView> }

            { selectionBox &&
                <div
                    className="builder-pro-selection-box"
                    style={ selectionBox } /> }
        </>
    );
}
