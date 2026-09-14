import { BuilderProLayerStateComposer, BuilderProLayerStateEvent, BuilderProPickupGroupComposer, BuilderProPickupGroupResultEvent, RoomEngineTileHoverEvent, RoomEngineTileClickEvent, BuilderProHistoryResultEvent, BuilderProHistoryComposer, BuilderProOffsetGroupResultEvent, BuilderProOffsetGroupComposer, BuilderProReferencePlacementComposer, BuilderProMirrorDuplicateComposer, BuilderProMirrorDuplicateResultEvent, BuilderProReplaceGroupComposer, BuilderProReplaceGroupResultEvent, BuilderProLinearRepeatComposer, BuilderProLinearRepeatResultEvent, BuilderProGridRepeatComposer, BuilderProGridRepeatResultEvent, BuilderProRadialRepeatComposer, BuilderProRadialRepeatResultEvent, BuilderProFillRepeatComposer, BuilderProFillRepeatResultEvent, BuilderProLayoutGroupResultEvent, BuilderProLayoutGroupComposer, BuilderProPasteGroupResultEvent, BuilderProPasteGroupComposer, BuilderProCopyGroupComposer, BuilderProCopyGroupResultEvent, BuilderProMoveGroupComposer, BuilderProMoveGroupResultEvent, BuilderProTransformGroupComposer, BuilderProTransformGroupResultEvent, BuilderProGroupStateComposer, BuilderProGroupStateEvent, BuilderProTraversalStateComposer, BuilderProTraversalStateEvent, BuilderProBlueprintStateComposer, BuilderProBlueprintStateEvent, RoomControllerLevel, RoomEngineObjectEvent, RoomEngineObjectPlacedEvent, RoomObjectCategory, Vector3d, RoomObjectVariable, GridEngine, RoomEngineTilePointerEvent, ILinkEventTracker} from '@nitrots/nitro-renderer';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { FaBoxOpen, FaClone, FaCopy, FaEllipsisH, FaEye, FaEyeSlash, FaLock, FaMinus, FaPaste, FaPlus, FaQuestion, FaRedo, FaSearch, FaUndo, FaWalking } from 'react-icons/fa';
import { AddEventLinkTracker, BuilderProSelectionVisualizer, CanManipulateFurniture, ClearBuilderProInspectorState, CreateLinkEvent, GetRoomEngine, GetSessionDataManager, HasHabboClub, RemoveLinkEventTracker, SendMessageComposer, SetBuilderProInspectorState, SetBuilderProSelectionModeActive } from '../../../../api';
import { useMessageEvent, useRoom, useRoomEngineEvent } from '../../../../hooks';
import { useBuilderProItemLocks } from './useBuilderProItemLocks';
import { ClearBuilderProGhostPreview, RenderBuilderProGhostPreview, SyncBuilderProGhostPreview } from './BuilderProGhostPreview';
import { BuilderProToolId, BuilderProToolVariantId, ResolveBuilderProToolLifecycle, ResolveBuilderProTransientChannels } from './BuilderProToolLifecycle';
import { BuilderProGlobalToolbar } from './BuilderProGlobalToolbar';
import { BuilderProOutlinerPanel } from './BuilderProOutlinerPanel';
import { BuilderProSelectionContext } from './BuilderProSelectionContext';
import { BuilderProToolFlyout } from './BuilderProToolFlyout';
import { BuilderProToolPanel } from './BuilderProToolPanel';
import { BuilderProToolRail } from './BuilderProToolRail';
import './BuilderProView.scss';

const MAX_SELECTION = 100;
const KEYBOARD_REPEAT_INTERVAL_MS = 200;
const MOVE_CONFIRM_TIMEOUT_MS = 2500;
const formatBuilderProServerFailure = (
    code: number,
    message: string,
    fallback = 'No se pudo completar la operación.'
): string =>
{
    const normalized =
        (message || '').trim();

    console.warn(
        `[BuilderProTrace] SERVER_ERROR code=${ code } message=${ normalized || fallback }`
    );

    return normalized || fallback;
};

const TRANSFORM_HEIGHT = 1;
const TRANSFORM_ROTATE_STRUCTURE = 2;
const TRANSFORM_ORIENT = 3;
const TRANSFORM_FLOOR = 4;
const TRANSFORM_STATE_PREVIOUS = 5;
const TRANSFORM_STATE_NEXT = 6;
const TRANSFORM_MIRROR_HORIZONTAL = 7;
const TRANSFORM_MIRROR_VERTICAL = 8;

const MIRROR_AXIS_HORIZONTAL = 1;
const MIRROR_AXIS_VERTICAL = 2;

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

const LAYER_OP_LIST = 0;
const LAYER_OP_CREATE = 1;
const LAYER_OP_RENAME = 2;
const LAYER_OP_DELETE = 3;
const LAYER_OP_ASSIGN = 4;
const LAYER_OP_UNASSIGN = 5;

const LAYER_SCOPE_ALL = -1;

const TRAVERSAL_OP_QUERY = 0;
const TRAVERSAL_OP_SET = 1;

const BLUEPRINT_OP_LIST = 0;
const BLUEPRINT_OP_CREATE = 1;
const BLUEPRINT_OP_RENAME = 2;
const BLUEPRINT_OP_DELETE = 3;
const BLUEPRINT_OP_PLACE = 4;
const BLUEPRINT_OP_PREVIEW = 5;

const REFERENCE_OP_NONE = 0;
const REFERENCE_OP_EQUAL_Z = 1;
const REFERENCE_OP_PLACE_ABOVE = 2;

const REPLACE_OP_PREVIEW = 0;
const REPLACE_OP_EXECUTE = 1;

const LINEAR_REPEAT_OP_PREVIEW = 0;
const LINEAR_REPEAT_OP_EXECUTE = 1;

const LINEAR_REPEAT_DIRECTION_LEFT = 1;
const LINEAR_REPEAT_DIRECTION_RIGHT = 2;
const LINEAR_REPEAT_DIRECTION_UP = 3;
const LINEAR_REPEAT_DIRECTION_DOWN = 4;

const GRID_REPEAT_OP_PREVIEW = 0;
const GRID_REPEAT_OP_EXECUTE = 1;

const RADIAL_REPEAT_OP_PREVIEW = 0;
const RADIAL_REPEAT_OP_EXECUTE = 1;

const FILL_REPEAT_OP_PREVIEW = 0;
const FILL_REPEAT_OP_EXECUTE = 1;

const FILL_REPEAT_MODE_LINE = 1;
const FILL_REPEAT_MODE_AREA = 2;
const FILL_REPEAT_MODE_TILE_AREA = 3;

const FILL_REPEAT_DIRECTION_LEFT = 1;
const FILL_REPEAT_DIRECTION_RIGHT = 2;
const FILL_REPEAT_DIRECTION_UP = 3;
const FILL_REPEAT_DIRECTION_DOWN = 4;

type BuilderProTilePoint = {
    x: number;
    y: number;
    z: number;
};

type BuilderProTileArea = {
    start: BuilderProTilePoint;
    end: BuilderProTilePoint;
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
};

const createBuilderProTileArea = (
    start: BuilderProTilePoint,
    end: BuilderProTilePoint
): BuilderProTileArea => ({
    start,
    end,
    minX: Math.min(start.x, end.x),
    minY: Math.min(start.y, end.y),
    maxX: Math.max(start.x, end.x),
    maxY: Math.max(start.y, end.y)
});

const getBuilderProTileAreaTiles = (
    area: BuilderProTileArea
): Array<{ x: number; y: number }> =>
{
    const tiles: Array<{ x: number; y: number }> = [];

    for(let x = area.minX; x <= area.maxX; x++)
    {
        for(let y = area.minY; y <= area.maxY; y++)
        {
            tiles.push({ x, y });
        }
    }

    return tiles;
};

const setBuilderProRoomDraggingLocked = (
    locked: boolean
): void =>
{
    (globalThis as any).__builderProRoomDraggingLocked =
        locked;
};

type BuilderProReplacementContext = {
    itemIds: number[];
    referenceId: number;
    targetRotations: number[];
    sourceSnapshots: BuilderProTransformSnapshot[];
};

type BuilderProLinearRepeatContext = {
    itemIds: number[];
    direction: number;
    copies: number;
    spacing: number;
};

type BuilderProLinearRepeatPreviewEntry = {
    baseItemId: number;
    x: number;
    y: number;
    z: number;
    rotation: number;
    state: number;
};

type BuilderProGridRepeatContext = {
    itemIds: number[];
    columns: number;
    rows: number;
    spacingX: number;
    spacingY: number;
};

type BuilderProGridRepeatPreviewEntry = {
    baseItemId: number;
    x: number;
    y: number;
    z: number;
    rotation: number;
    state: number;
};

type BuilderProRadialRepeatContext = {
    itemIds: number[];
    copies: number;
    totalAngle: number;
    radius: number;
    rotateWithPattern: boolean;
    pivotId: number;
};

type BuilderProRadialRepeatPreviewEntry = {
    baseItemId: number;
    x: number;
    y: number;
    z: number;
    rotation: number;
    state: number;
};

type BuilderProFillRepeatContext = {
    itemIds: number[];
    mode: number;
    direction: number;
    spacing: number;
    area: BuilderProTileArea | null;
};

type BuilderProFillRepeatPreviewEntry = {
    baseItemId: number;
    x: number;
    y: number;
    z: number;
    rotation: number;
    state: number;
};

type BuilderProSavedGroupState = {
    id: number;
    name: string;
    locked: boolean;
    itemIds: number[];
};

type BuilderProSavedLayerState = {
    id: number;
    name: string;
    sortOrder: number;
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
    state: number;
};

type BuilderProClipboardPreview = {
    sourceAnchorZ: number;
    entries: BuilderProClipboardPreviewEntry[];
};

const BUILDER_PRO_PASTE_GHOST_ID_BASE = -1900000000;
const BUILDER_PRO_LINEAR_REPEAT_GHOST_ID_BASE = -1800000000;
const BUILDER_PRO_GRID_REPEAT_GHOST_ID_BASE = -1700000000;
const BUILDER_PRO_RADIAL_REPEAT_GHOST_ID_BASE = -1600000000;
const BUILDER_PRO_FILL_REPEAT_GHOST_ID_BASE = -1500000000;

const normalizeBuilderProRotation = (
    value: number
): number =>
    (
        (
            Math.round(value) %
            8
        ) +
        8
    ) %
    8;

const resolveNearestAllowedServerRotation = (
    directionDegrees: number,
    allowedDirections: number[] | null | undefined
): number =>
{
    const desired =
        normalizeBuilderProRotation(
            directionDegrees / 45
        );

    if(
        !allowedDirections ||
        !allowedDirections.length
    )
    {
        return desired;
    }

    let best = desired;
    let bestDistance = 9;

    for(const allowed of allowedDirections)
    {
        const candidate =
            normalizeBuilderProRotation(
                allowed / 45
            );

        const rawDistance =
            Math.abs(
                candidate - desired
            );

        const distance =
            Math.min(
                rawDistance,
                8 - rawDistance
            );

        if(distance < bestDistance)
        {
            best = candidate;
            bestDistance = distance;
        }
    }

    return best;
};

const resolveMirroredServerRotation = (
    directionDegrees: number,
    allowedDirections: number[] | null | undefined,
    axis: number
): number =>
{
    const current =
        normalizeBuilderProRotation(
            directionDegrees / 45
        );

    const desired =
        axis === MIRROR_AXIS_HORIZONTAL
            ? normalizeBuilderProRotation(
                -current
            )
            : normalizeBuilderProRotation(
                4 - current
            );

    if(
        !allowedDirections ||
        !allowedDirections.length
    )
    {
        return desired;
    }

    let best = desired;
    let bestDistance = 9;

    for(const allowed of allowedDirections)
    {
        const candidate =
            normalizeBuilderProRotation(
                allowed / 45
            );

        const rawDistance =
            Math.abs(
                candidate - desired
            );

        const distance =
            Math.min(
                rawDistance,
                8 - rawDistance
            );

        if(distance < bestDistance)
        {
            best = candidate;
            bestDistance = distance;
        }
    }

    return best;
};


export const BuilderProView: FC<{}> = props =>
{
    const { roomSession = null } = useRoom();

    const [ active, setActive ] = useState(false);
    const [ avatarMovementLocked, setAvatarMovementLocked ] =
        useState(false);
    const [ selectedIds, setSelectedIds ] = useState<number[]>([]);
    const [ pending, setPending ] = useState(false);
    const [ status, setStatus ] = useState('');
    const [ pasteMode, setPasteMode ] = useState(false);
    const [ duplicateMode, setDuplicateMode ] = useState(false);
    const [ canUndo, setCanUndo ] = useState(false);
    const [ canRedo, setCanRedo ] = useState(false);
    const [ minimized, setMinimized ] = useState(false);
    const [ helpOpen, setHelpOpen ] = useState(false);
    const [ outlinerOpen, setOutlinerOpen ] = useState(true);
    const [ savedGroups, setSavedGroups ] =
        useState<BuilderProSavedGroupState[]>([]);
    const [ selectedGroupId, setSelectedGroupId ] =
        useState<number | null>(null);
    const [ groupName, setGroupName ] = useState('');
    const [ groupPending, setGroupPending ] = useState(false);
    const [ savedLayers, setSavedLayers ] =
        useState<BuilderProSavedLayerState[]>([]);
    const [ selectedLayerId, setSelectedLayerId ] =
        useState(0);
    const [ layerScopeId, setLayerScopeId ] =
        useState(LAYER_SCOPE_ALL);
    const [ layerName, setLayerName ] = useState('');
    const [ layerPending, setLayerPending ] = useState(false);
    const [ hiddenLayerIds, setHiddenLayerIds ] =
        useState<number[]>([]);
    const [ isolatedLayerId, setIsolatedLayerId ] =
        useState<number | null>(null);
    const [ dimmedOthersLayerId, setDimmedOthersLayerId ] =
        useState<number | null>(null);
    const [ individualHiddenItemIds, setIndividualHiddenItemIds ] =
        useState<number[]>([]);
    const [ individualDimmedItemIds, setIndividualDimmedItemIds ] =
        useState<number[]>([]);
    const [ outlinerQuery, setOutlinerQuery ] =
        useState('');
    const [ outlinerCollapsedLayerIds, setOutlinerCollapsedLayerIds ] =
        useState<number[]>([]);
    const [ outlinerCollapsedGroupIds, setOutlinerCollapsedGroupIds ] =
        useState<number[]>([]);
    const [ outlinerRevision, setOutlinerRevision ] =
        useState(0);
    const [ outlinerMenuLayerId, setOutlinerMenuLayerId ] =
        useState<number | null>(null);
    const [ outlinerRenameLayerId, setOutlinerRenameLayerId ] =
        useState<number | null>(null);
    const [ outlinerRenameValue, setOutlinerRenameValue ] =
        useState('');
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
    const [ linearRepeatCopies, setLinearRepeatCopies ] =
        useState('3');
    const [ linearRepeatSpacing, setLinearRepeatSpacing ] =
        useState('0');
    const [ linearRepeatDirection, setLinearRepeatDirection ] =
        useState(0);
    const [ linearRepeatPreviewReady, setLinearRepeatPreviewReady ] =
        useState(false);
    const [ gridRepeatColumns, setGridRepeatColumns ] =
        useState('3');
    const [ gridRepeatRows, setGridRepeatRows ] =
        useState('3');
    const [ gridRepeatSpacingX, setGridRepeatSpacingX ] =
        useState('0');
    const [ gridRepeatSpacingY, setGridRepeatSpacingY ] =
        useState('0');
    const [ gridRepeatPreviewReady, setGridRepeatPreviewReady ] =
        useState(false);
    const [ radialRepeatCopies, setRadialRepeatCopies ] =
        useState('8');
    const [ radialRepeatAngle, setRadialRepeatAngle ] =
        useState('360');
    const [ radialRepeatRadius, setRadialRepeatRadius ] =
        useState('4');
    const [ radialRepeatRotateWithPattern, setRadialRepeatRotateWithPattern ] =
        useState(true);
    const [ radialRepeatPreviewReady, setRadialRepeatPreviewReady ] =
        useState(false);
    const [ fillRepeatMode, setFillRepeatMode ] =
        useState(FILL_REPEAT_MODE_LINE);
    const [ fillRepeatDirection, setFillRepeatDirection ] =
        useState(FILL_REPEAT_DIRECTION_RIGHT);
    const [ fillRepeatSpacing, setFillRepeatSpacing ] =
        useState('0');
    const [ fillRepeatPreviewReady, setFillRepeatPreviewReady ] =
        useState(false);
    const [ fillAreaPickMode, setFillAreaPickMode ] =
        useState(false);
    const [ highlightSelection, setHighlightSelection ] =
        useState(BuilderProSelectionVisualizer.enabled);
    const [ pivotId, setPivotId ] =
        useState<number | null>(null);
    const [ pivotPickMode, setPivotPickMode ] =
        useState(false);
    const [ referencePickOperation, setReferencePickOperation ] =
        useState(REFERENCE_OP_NONE);
    const [ replacePickMode, setReplacePickMode ] =
        useState(false);
    const [ areaMode, setAreaMode ] = useState(false);

    const {
        lockedItemIds,
        itemLockPending,
        requestItemLockState
    } = useBuilderProItemLocks(
        active,
        roomSession?.roomId ?? null,
        setStatus
    );

    const activeRef = useRef(false);
    const pendingRef = useRef(false);
    const pasteModeRef = useRef(false);
    const duplicateModeRef = useRef(false);
    const duplicateRequestedRef = useRef(false);
    const mirrorDuplicateModeRef = useRef(false);
    const suppressPasteLayerAutoAssignRef = useRef(false);
    const placedSelectionTokenRef = useRef(0);
    const suppressPlacementSelectionEventsRef =
        useRef(false);
    const selectionVisualStabilizationTokenRef =
        useRef(0);
    const clipboardPreviewRef = useRef<BuilderProClipboardPreview | null>(null);
    const pastePreviewAnchorRef = useRef<{ x: number; y: number } | null>(null);
    const pasteGhostIdsRef = useRef<number[]>([]);
    const pastePreviewFrameRef = useRef<number | null>(null);
    const linearRepeatContextRef =
        useRef<BuilderProLinearRepeatContext | null>(
            null
        );
    const pendingLinearRepeatContextRef =
        useRef<BuilderProLinearRepeatContext | null>(
            null
        );
    const pendingLinearRepeatOperationRef =
        useRef<number | null>(
            null
        );
    const linearRepeatPreviewEntriesRef =
        useRef<BuilderProLinearRepeatPreviewEntry[]>(
            []
        );
    const linearRepeatGhostIdsRef =
        useRef<number[]>(
            []
        );
    const linearRepeatPreviewFrameRef =
        useRef<number | null>(
            null
        );
    const gridRepeatContextRef =
        useRef<BuilderProGridRepeatContext | null>(
            null
        );
    const pendingGridRepeatContextRef =
        useRef<BuilderProGridRepeatContext | null>(
            null
        );
    const pendingGridRepeatOperationRef =
        useRef<number | null>(
            null
        );
    const gridRepeatPreviewEntriesRef =
        useRef<BuilderProGridRepeatPreviewEntry[]>(
            []
        );
    const gridRepeatGhostIdsRef =
        useRef<number[]>(
            []
        );
    const gridRepeatPreviewFrameRef =
        useRef<number | null>(
            null
        );
    const radialRepeatContextRef =
        useRef<BuilderProRadialRepeatContext | null>(
            null
        );
    const pendingRadialRepeatContextRef =
        useRef<BuilderProRadialRepeatContext | null>(
            null
        );
    const pendingRadialRepeatOperationRef =
        useRef<number | null>(
            null
        );
    const radialRepeatPreviewEntriesRef =
        useRef<BuilderProRadialRepeatPreviewEntry[]>(
            []
        );
    const radialRepeatGhostIdsRef =
        useRef<number[]>(
            []
        );
    const radialRepeatPreviewFrameRef =
        useRef<number | null>(
            null
        );
    const fillRepeatContextRef =
        useRef<BuilderProFillRepeatContext | null>(
            null
        );
    const pendingFillRepeatContextRef =
        useRef<BuilderProFillRepeatContext | null>(
            null
        );
    const pendingFillRepeatOperationRef =
        useRef<number | null>(
            null
        );
    const fillRepeatPreviewEntriesRef =
        useRef<BuilderProFillRepeatPreviewEntry[]>(
            []
        );
    const fillRepeatGhostIdsRef =
        useRef<number[]>(
            []
        );
    const fillRepeatPreviewFrameRef =
        useRef<number | null>(
            null
        );
    const fillAreaPickModeRef =
        useRef(false);
    const fillAreaDraftContextRef =
        useRef<{
            itemIds: number[];
            spacing: number;
        } | null>(null);
    const fillAreaOverlayActiveRef =
        useRef(false);
    const requestFillRepeatRef =
        useRef<(
            operation: number,
            context: BuilderProFillRepeatContext
        ) => void>(
            () => undefined
        );
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
    const savedLayersRef =
        useRef<BuilderProSavedLayerState[]>([]);
    const layerPendingRef = useRef(false);
    const layerRequestIdRef = useRef(0);
    const layerOperationRef = useRef(LAYER_OP_LIST);
    const layerPendingTimeoutRef =
        useRef<number | null>(null);
    const layerScopeIdRef =
        useRef(LAYER_SCOPE_ALL);
    const layerSilentRequestRef =
        useRef(false);
    const layerAutoAssignQueueRef =
        useRef<Array<{
            layerId: number;
            itemId: number;
        }>>([]);
    const hiddenLayerIdsRef =
        useRef<Set<number>>(new Set());
    const isolatedLayerIdRef =
        useRef<number | null>(null);
    const dimmedOthersLayerIdRef =
        useRef<number | null>(null);
    const individualHiddenItemIdsRef =
        useRef<Set<number>>(new Set());
    const individualDimmedItemIdsRef =
        useRef<Set<number>>(new Set());
    const layerOriginalAlphaRef =
        useRef<Map<number, number>>(new Map());
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
    const outlinerRevisionFrameRef =
        useRef<number | null>(null);
    const invalidateRepeatPreviewsForRoomMutationRef =
        useRef<() => void>(
            () => undefined
        );
    const pivotIdRef = useRef<number | null>(null);
    const pivotPickModeRef = useRef(false);
    const referencePickOperationRef =
        useRef(REFERENCE_OP_NONE);
    const replacePickModeRef =
        useRef(false);
    const replacementContextRef =
        useRef<BuilderProReplacementContext | null>(
            null
        );
    const replacementSourceIdsRef =
        useRef<Set<number>>(
            new Set<number>()
        );
    const pendingReplaceOperationRef =
        useRef(REPLACE_OP_PREVIEW);
    const pendingReferenceOperationRef =
        useRef(REFERENCE_OP_NONE);
    const quickShiftRef = useRef(false);
    const quickCtrlRef = useRef(false);
    const areaStartRef = useRef<{
        startTile: BuilderProTilePoint;
        currentTile: BuilderProTilePoint;
        dragging: boolean;
        purpose: 'selection' | 'fill';
    } | null>(null);
    const selectedIdsRef = useRef<number[]>([]);
    const roomSessionRef = useRef(roomSession);

    roomSessionRef.current = roomSession;
    savedGroupsRef.current = savedGroups;
    savedLayersRef.current = savedLayers;
    layerScopeIdRef.current = layerScopeId;
    hiddenLayerIdsRef.current =
        new Set(hiddenLayerIds);
    isolatedLayerIdRef.current =
        isolatedLayerId;
    dimmedOthersLayerIdRef.current =
        dimmedOthersLayerId;
    individualHiddenItemIdsRef.current =
        new Set(individualHiddenItemIds);
    individualDimmedItemIdsRef.current =
        new Set(individualDimmedItemIds);
    selectedBlueprintIdRef.current =
        selectedBlueprintId;
    referencePickOperationRef.current =
        referencePickOperation;
    replacePickModeRef.current =
        replacePickMode;
    moveStepRef.current = moveStep;

    const scheduleOutlinerRevision =
        useCallback(() =>
        {
            if(
                outlinerRevisionFrameRef.current !==
                null
            )
            {
                return;
            }

            outlinerRevisionFrameRef.current =
                window.requestAnimationFrame(
                    () =>
                    {
                        outlinerRevisionFrameRef.current =
                            null;

                        setOutlinerRevision(
                            current =>
                                current + 1
                        );
                    }
                );
        }, []);

    useEffect(() =>
    {
        return () =>
        {
            if(
                outlinerRevisionFrameRef.current !==
                null
            )
            {
                window.cancelAnimationFrame(
                    outlinerRevisionFrameRef.current
                );

                outlinerRevisionFrameRef.current =
                    null;
            }
        };
    }, []);

    const sessionDataManager = GetSessionDataManager();

    const hasBiriClub =
        HasHabboClub();

    const canBuild = !!roomSession &&
        (
            roomSession.isRoomOwner ||
            roomSession.controllerLevel >= RoomControllerLevel.GUEST ||
            !!sessionDataManager?.isModerator
        );

    useEffect(() =>
    {
        if(
            !active ||
            !canBuild
        )
        {
            return;
        }

        const body =
            document.body;

        body.classList.add(
            'builder-pro-immersive'
        );

        let parentControls:
            HTMLElement | null =
            null;

        let previousParentDisplay =
            '';

        try
        {
            if(window.parent !== window)
            {
                const parentDocument =
                    window.parent.document;

                const reloadControl =
                    parentDocument.querySelector<HTMLElement>(
                        '#nitro-client [onclick="reloadClient()"]'
                    );

                parentControls =
                    reloadControl?.parentElement ||
                    parentDocument.querySelector<HTMLElement>(
                        '#nitro-client > div.absolute.top-4.left-4.z-10'
                    );

                if(parentControls)
                {
                    previousParentDisplay =
                        parentControls.style.display;

                    parentControls.style.display =
                        'none';
                }
            }
        }
        catch
        {
            // Si el iframe cambia de origen, el modo inmersivo
            // interno sigue funcionando sin romper Construcción Avanzada.
        }

        return () =>
        {
            body.classList.remove(
                'builder-pro-immersive'
            );

            if(parentControls)
            {
                parentControls.style.display =
                    previousParentDisplay;
            }
        };
    }, [
        active,
        canBuild
    ]);
    const selectedSavedGroup =
        selectedGroupId === null
            ? null
            : (
                savedGroups.find(
                    group =>
                        group.id === selectedGroupId
                ) || null
            );

    const selectedSavedLayer =
        selectedLayerId <= 0
            ? null
            : (
                savedLayers.find(
                    layer =>
                        layer.id === selectedLayerId
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


    const clearReferencePick =
        useCallback((
            updateStatus: boolean = false
        ) =>
        {
            referencePickOperationRef.current =
                REFERENCE_OP_NONE;

            setReferencePickOperation(
                REFERENCE_OP_NONE
            );

            if(updateStatus)
            {
                setStatus(
                    'Operación con referencia cancelada.'
                );
            }
        }, []);

    const applySelection = useCallback((next: number[]) =>
    {
        const previous = selectedIdsRef.current;

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
            BuilderProSelectionVisualizer.show(
                id
            );
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

    const stabilizeSelectionVisuals =
        useCallback((
            itemIds: number[]
        ) =>
        {
            const ids = [
                ...itemIds
            ];

            if(!ids.length)
            {
                return;
            }

            selectionVisualStabilizationTokenRef.current++;

            const token =
                selectionVisualStabilizationTokenRef.current;

            const delays = [
                0,
                25,
                50,
                100,
                175,
                275,
                400,
                600,
                850,
                1200
            ];

            for(const delay of delays)
            {
                window.setTimeout(
                    () =>
                    {
                        if(
                            !activeRef.current ||
                            selectionVisualStabilizationTokenRef.current !==
                                token
                        )
                        {
                            return;
                        }

                        const current =
                            selectedIdsRef.current;

                        if(
                            current.length !==
                                ids.length ||
                            ids.some(
                                id =>
                                    !current.includes(
                                        id
                                    )
                            )
                        )
                        {
                            return;
                        }

                        BuilderProSelectionVisualizer
                            .refresh(
                                ids
                            );
                    },
                    delay
                );
            }
        }, []);

    const clearSelection = useCallback(() =>
    {
        placedSelectionTokenRef.current++;
        selectionVisualStabilizationTokenRef.current++;
        suppressPlacementSelectionEventsRef.current =
            false;

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

    const settlePlacedSelection =
        useCallback((
            itemIds: number[]
        ) =>
        {
            const ids =
                Array.from(
                    new Set(
                        itemIds.filter(
                            id =>
                                Number.isSafeInteger(id) &&
                                id > 0
                        )
                    )
                ).slice(
                    0,
                    MAX_SELECTION
                );

            if(!ids.length)
            {
                return;
            }

            placedSelectionTokenRef.current++;

            const token =
                placedSelectionTokenRef.current;

            suppressPlacementSelectionEventsRef.current =
                true;

            const releaseSuppression = () =>
            {
                if(
                    placedSelectionTokenRef.current !==
                    token
                )
                {
                    return;
                }

                suppressPlacementSelectionEventsRef.current =
                    false;
            };

            const releaseAfterFrames = (
                remaining: number
            ) =>
            {
                if(
                    placedSelectionTokenRef.current !==
                    token
                )
                {
                    return;
                }

                if(remaining <= 0)
                {
                    releaseSuppression();
                    return;
                }

                window.requestAnimationFrame(
                    () =>
                        releaseAfterFrames(
                            remaining - 1
                        )
                );
            };

            const settle = (
                attempt: number
            ) =>
            {
                if(
                    !activeRef.current ||
                    placedSelectionTokenRef.current !==
                        token
                )
                {
                    return;
                }

                const currentRoomSession =
                    roomSessionRef.current;

                const roomEngine =
                    GetRoomEngine();

                if(
                    !currentRoomSession ||
                    !roomEngine
                )
                {
                    releaseSuppression();
                    return;
                }

                const allPresent =
                    ids.every(
                        id =>
                            !!roomEngine.getRoomObject(
                                currentRoomSession.roomId,
                                id,
                                RoomObjectCategory.FLOOR
                            )
                    );

                if(allPresent)
                {
                    applySelection(
                        ids
                    );

                    stabilizeSelectionVisuals(
                        ids
                    );

                    window.requestAnimationFrame(
                        () =>
                        {
                            if(
                                placedSelectionTokenRef.current !==
                                token
                            )
                            {
                                return;
                            }

                            releaseAfterFrames(
                                4
                            );
                        }
                    );

                    return;
                }

                if(attempt >= 200)
                {
                    releaseSuppression();

                    setStatus(
                        'La estructura se colocó, pero la selección tardó demasiado en sincronizarse.'
                    );

                    return;
                }

                window.setTimeout(
                    () =>
                        settle(
                            attempt + 1
                        ),
                    25
                );
            };

            settle(0);
        }, [
            applySelection,
            stabilizeSelectionVisuals
        ]);

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

                    areaStartRef.current = null;

                    GridEngine.clearTiles('builder-area');

                    suppressAreaClickRef.current = false;

                    setBuilderProRoomDraggingLocked(areaModeRef.current);

                    setAreaMode(false);

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



    const getLayerIdForItem =
        useCallback((
            itemId: number
        ): number =>
        {
            for(const layer of savedLayersRef.current)
            {
                if(
                    layer.itemIds.includes(
                        itemId
                    )
                )
                {
                    return layer.id;
                }
            }

            return 0;
        }, []);

    const isItemInWorkScope =
        useCallback((
            itemId: number
        ): boolean =>
        {
            const scope =
                layerScopeIdRef.current;

            if(scope === LAYER_SCOPE_ALL)
            {
                return true;
            }

            return (
                getLayerIdForItem(
                    itemId
                ) === scope
            );
        }, [
            getLayerIdForItem
        ]);

    const getSelectableGroupItemIds =
        useCallback((
            group: BuilderProSavedGroupState
        ): number[] =>
        {
            const available =
                getAvailableGroupItemIds(
                    group
                );

            if(
                layerScopeIdRef.current ===
                LAYER_SCOPE_ALL
            )
            {
                return available;
            }

            const inScope =
                available.filter(
                    itemId =>
                        isItemInWorkScope(
                            itemId
                        )
                );

            /*
             * Un grupo bloqueado sigue siendo atómico,
             * pero solo puede "arrancar" si al menos un
             * miembro pertenece a la capa de trabajo.
             */
            if(group.locked)
            {
                return inScope.length
                    ? available
                    : [];
            }

            return inScope;
        }, [
            getAvailableGroupItemIds,
            isItemInWorkScope
        ]);


    const isLayerLocallyVisible =
        useCallback((
            layerId: number
        ): boolean =>
        {
            if(
                hiddenLayerIdsRef.current.has(
                    layerId
                )
            )
            {
                return false;
            }

            const isolated =
                isolatedLayerIdRef.current;

            if(
                isolated !== null &&
                layerId !== isolated
            )
            {
                return false;
            }

            return true;
        }, []);

    const isItemLocallyVisible =
        useCallback((
            itemId: number
        ): boolean =>
            !individualHiddenItemIdsRef.current.has(
                itemId
            ) &&
            isLayerLocallyVisible(
                getLayerIdForItem(
                    itemId
                )
            ), [
            getLayerIdForItem,
            isLayerLocallyVisible
        ]);

    const restoreLayerVisibility =
        useCallback(() =>
        {
            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            if(
                currentRoomSession &&
                roomEngine
            )
            {
                for(
                    const [
                        itemId,
                        originalAlpha
                    ] of
                    layerOriginalAlphaRef.current.entries()
                )
                {
                    const roomObject =
                        roomEngine.getRoomObject(
                            currentRoomSession.roomId,
                            itemId,
                            RoomObjectCategory.FLOOR
                        );

                    if(!roomObject)
                    {
                        continue;
                    }

                    roomObject.model.setValue(
                        RoomObjectVariable.FURNITURE_ALPHA_MULTIPLIER,
                        originalAlpha
                    );
                }
            }

            layerOriginalAlphaRef.current.clear();
        }, []);

    const applyLayerVisibility =
        useCallback(() =>
        {
            if(!activeRef.current)
            {
                return;
            }

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

            const assignedLayerByItem =
                new Map<number, number>();

            for(const layer of savedLayersRef.current)
            {
                for(const itemId of layer.itemIds)
                {
                    assignedLayerByItem.set(
                        itemId,
                        layer.id
                    );
                }
            }

            const hidden =
                hiddenLayerIdsRef.current;

            const isolated =
                isolatedLayerIdRef.current;

            const dimmed =
                dimmedOthersLayerIdRef.current;

            const individualHidden =
                individualHiddenItemIdsRef.current;

            const individualDimmed =
                individualDimmedItemIdsRef.current;

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

                const itemId =
                    roomObject.id;

                const layerId =
                    assignedLayerByItem.get(
                        itemId
                    ) || 0;

                const shouldHide =
                    individualHidden.has(
                        itemId
                    ) ||
                    hidden.has(layerId) ||
                    (
                        isolated !== null &&
                        layerId !== isolated
                    );

                const shouldDim =
                    !shouldHide &&
                    (
                        individualDimmed.has(
                            itemId
                        ) ||
                        (
                            dimmed !== null &&
                            layerId !== dimmed
                        )
                    );

                /*
                 * Si este furni no necesita un efecto de capa,
                 * Construcción Avanzada no debe gestionar su alpha. Esto
                 * evita capturar el 0.5 temporal que Nitro usa
                 * al colocar/mover furnis.
                 */
                if(!shouldHide && !shouldDim)
                {
                    const originalAlpha =
                        layerOriginalAlphaRef.current.get(
                            itemId
                        );

                    if(originalAlpha !== undefined)
                    {
                        roomObject.model.setValue(
                            RoomObjectVariable.FURNITURE_ALPHA_MULTIPLIER,
                            originalAlpha
                        );

                        layerOriginalAlphaRef.current.delete(
                            itemId
                        );
                    }

                    continue;
                }

                if(
                    !layerOriginalAlphaRef.current.has(
                        itemId
                    )
                )
                {
                    const currentAlpha =
                        roomObject.model.getValue<number>(
                            RoomObjectVariable.FURNITURE_ALPHA_MULTIPLIER
                        );

                    layerOriginalAlphaRef.current.set(
                        itemId,
                        Number.isFinite(
                            currentAlpha
                        )
                            ? currentAlpha
                            : 1
                    );
                }

                const originalAlpha =
                    layerOriginalAlphaRef.current.get(
                        itemId
                    ) ?? 1;

                roomObject.model.setValue(
                    RoomObjectVariable.FURNITURE_ALPHA_MULTIPLIER,
                    shouldHide
                        ? 0
                        : originalAlpha * 0.2
                );
            }
        }, []);

    const showAllLayers =
        useCallback(() =>
        {
            hiddenLayerIdsRef.current =
                new Set();

            isolatedLayerIdRef.current =
                null;

            dimmedOthersLayerIdRef.current =
                null;

            setHiddenLayerIds([]);
            setIsolatedLayerId(null);
            setDimmedOthersLayerId(null);

            restoreLayerVisibility();

            setStatus(
                'Todas las capas visibles.'
            );
        }, [
            restoreLayerVisibility
        ]);


    const toggleLayerVisibility =
        useCallback((
            target: number
        ) =>
        {
            if(target === LAYER_SCOPE_ALL)
            {
                return;
            }

            const next =
                new Set(
                    hiddenLayerIdsRef.current
                );

            const isolated =
                isolatedLayerIdRef.current;

            const effectivelyVisible =
                !next.has(target) &&
                (
                    isolated === null ||
                    isolated === target
                );

            if(effectivelyVisible)
            {
                next.add(target);

                if(
                    isolatedLayerIdRef.current ===
                    target
                )
                {
                    isolatedLayerIdRef.current =
                        null;

                    setIsolatedLayerId(null);
                }

                if(
                    dimmedOthersLayerIdRef.current ===
                    target
                )
                {
                    dimmedOthersLayerIdRef.current =
                        null;

                    setDimmedOthersLayerId(null);
                }
            }
            else
            {
                next.delete(target);

                if(
                    isolatedLayerIdRef.current !== null &&
                    isolatedLayerIdRef.current !== target
                )
                {
                    isolatedLayerIdRef.current =
                        null;

                    setIsolatedLayerId(null);
                }
            }

            hiddenLayerIdsRef.current =
                next;

            setHiddenLayerIds(
                Array.from(next)
            );

            window.requestAnimationFrame(
                applyLayerVisibility
            );

            const label =
                target === 0
                    ? 'Sin capa'
                    : (
                        savedLayersRef.current.find(
                            layer =>
                                layer.id === target
                        )?.name ||
                        'Capa'
                    );

            setStatus(
                effectivelyVisible
                    ? `${ label } oculta localmente.`
                    : `${ label } visible.`
            );
        }, [
            applyLayerVisibility
        ]);

    const toggleIsolateWorkLayer =
        useCallback(() =>
        {
            const target =
                layerScopeIdRef.current;

            if(target === LAYER_SCOPE_ALL)
            {
                setStatus(
                    'Elige una capa de trabajo concreta para aislarla.'
                );

                return;
            }

            const next =
                isolatedLayerIdRef.current ===
                target
                    ? null
                    : target;

            isolatedLayerIdRef.current =
                next;

            dimmedOthersLayerIdRef.current =
                null;

            setIsolatedLayerId(
                next
            );

            setDimmedOthersLayerId(
                null
            );

            if(next !== null)
            {
                const hidden =
                    new Set(
                        hiddenLayerIdsRef.current
                    );

                hidden.delete(
                    target
                );

                hiddenLayerIdsRef.current =
                    hidden;

                setHiddenLayerIds(
                    Array.from(hidden)
                );
            }

            window.requestAnimationFrame(
                applyLayerVisibility
            );

            setStatus(
                next === null
                    ? 'Aislamiento desactivado.'
                    : 'Capa de trabajo aislada localmente.'
            );
        }, [
            applyLayerVisibility
        ]);

    const toggleDimOtherLayers =
        useCallback(() =>
        {
            const target =
                layerScopeIdRef.current;

            if(target === LAYER_SCOPE_ALL)
            {
                setStatus(
                    'Elige una capa de trabajo concreta para atenuar el resto.'
                );

                return;
            }

            const next =
                dimmedOthersLayerIdRef.current ===
                target
                    ? null
                    : target;

            dimmedOthersLayerIdRef.current =
                next;

            isolatedLayerIdRef.current =
                null;

            setDimmedOthersLayerId(
                next
            );

            setIsolatedLayerId(
                null
            );

            if(next !== null)
            {
                const hidden =
                    new Set(
                        hiddenLayerIdsRef.current
                    );

                hidden.delete(
                    target
                );

                hiddenLayerIdsRef.current =
                    hidden;

                setHiddenLayerIds(
                    Array.from(hidden)
                );
            }

            window.requestAnimationFrame(
                applyLayerVisibility
            );

            setStatus(
                next === null
                    ? 'Atenuación desactivada.'
                    : 'Resto de capas atenuado localmente.'
            );
        }, [
            applyLayerVisibility
        ]);


    const hideSelectedItemsLocally =
        useCallback(() =>
        {
            const ids = [
                ...selectedIdsRef.current
            ];

            if(!ids.length)
            {
                setStatus(
                    'Selecciona primero los furnis que quieres ocultar.'
                );

                return;
            }

            const hidden =
                new Set(
                    individualHiddenItemIdsRef.current
                );

            const dimmed =
                new Set(
                    individualDimmedItemIdsRef.current
                );

            for(const itemId of ids)
            {
                hidden.add(itemId);
                dimmed.delete(itemId);
            }

            individualHiddenItemIdsRef.current =
                hidden;

            individualDimmedItemIdsRef.current =
                dimmed;

            setIndividualHiddenItemIds(
                Array.from(hidden)
            );

            setIndividualDimmedItemIds(
                Array.from(dimmed)
            );

            window.requestAnimationFrame(
                applyLayerVisibility
            );

            clearSelection();

            setStatus(
                `${ ids.length } furnis ocultos localmente.`
            );
        }, [
            applyLayerVisibility,
            clearSelection
        ]);

    const dimSelectedItemsLocally =
        useCallback(() =>
        {
            const ids = [
                ...selectedIdsRef.current
            ];

            if(!ids.length)
            {
                setStatus(
                    'Selecciona primero los furnis que quieres atenuar.'
                );

                return;
            }

            const hidden =
                new Set(
                    individualHiddenItemIdsRef.current
                );

            const dimmed =
                new Set(
                    individualDimmedItemIdsRef.current
                );

            for(const itemId of ids)
            {
                hidden.delete(itemId);
                dimmed.add(itemId);
            }

            individualHiddenItemIdsRef.current =
                hidden;

            individualDimmedItemIdsRef.current =
                dimmed;

            setIndividualHiddenItemIds(
                Array.from(hidden)
            );

            setIndividualDimmedItemIds(
                Array.from(dimmed)
            );

            window.requestAnimationFrame(
                applyLayerVisibility
            );

            setStatus(
                `${ ids.length } furnis atenuados localmente.`
            );
        }, [
            applyLayerVisibility
        ]);

    const restoreIndividualItemVisibility =
        useCallback(() =>
        {
            individualHiddenItemIdsRef.current =
                new Set();

            individualDimmedItemIdsRef.current =
                new Set();

            setIndividualHiddenItemIds([]);
            setIndividualDimmedItemIds([]);

            window.requestAnimationFrame(
                applyLayerVisibility
            );

            setStatus(
                'Visibilidad individual restaurada.'
            );
        }, [
            applyLayerVisibility
        ]);

    const getAvailableLayerItemIds =
        useCallback((
            layerId: number
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

            const assigned =
                new Set<number>();

            for(const layer of savedLayersRef.current)
            {
                for(const itemId of layer.itemIds)
                {
                    assigned.add(itemId);
                }
            }

            const result: number[] = [];

            if(layerId > 0)
            {
                const layer =
                    savedLayersRef.current.find(
                        entry =>
                            entry.id === layerId
                    );

                if(!layer)
                {
                    return [];
                }

                for(const itemId of layer.itemIds)
                {
                    const roomObject =
                        roomEngine.getRoomObject(
                            currentRoomSession.roomId,
                            itemId,
                            RoomObjectCategory.FLOOR
                        );

                    if(!roomObject)
                    {
                        continue;
                    }

                    if(!CanManipulateFurniture(
                        currentRoomSession,
                        itemId,
                        RoomObjectCategory.FLOOR
                    ))
                    {
                        continue;
                    }

                    result.push(itemId);
                }

                return result;
            }

            const count =
                roomEngine.getRoomObjectCount(
                    currentRoomSession.roomId,
                    RoomObjectCategory.FLOOR
                );

            for(let index = 0;
                index < count;
                index++)
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

                if(assigned.has(roomObject.id))
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

                result.push(roomObject.id);
            }

            return result;
        }, []);

    const normalizeLayerSelection =
        useCallback((
            sourceIds: number[]
        ): {
            ids: number[];
            limitReached: boolean;
        } =>
        {
            const result: number[] = [];
            const resultSet =
                new Set<number>();

            const handledLockedGroups =
                new Set<number>();

            let limitReached = false;

            const append =
                (itemId: number) =>
                {
                    if(resultSet.has(itemId))
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
                                    !resultSet.has(id)
                            );

                        if(
                            result.length +
                            missing.length >
                            MAX_SELECTION
                        )
                        {
                            limitReached = true;
                            return;
                        }

                        for(const id of missing)
                        {
                            result.push(id);
                            resultSet.add(id);
                        }

                        return;
                    }

                    if(result.length >= MAX_SELECTION)
                    {
                        limitReached = true;
                        return;
                    }

                    result.push(itemId);
                    resultSet.add(itemId);
                };

            for(const itemId of sourceIds)
            {
                append(itemId);
            }

            return {
                ids: result,
                limitReached
            };
        }, [
            getAvailableGroupItemIds
        ]);

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

                if(
                    !isItemInWorkScope(
                        roomObject.id
                    )
                )
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
            getAvailableGroupItemIds,
            isItemInWorkScope
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
                        : formatBuilderProServerFailure(parser.code, parser.message)
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
                getSelectableGroupItemIds(
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
            getSelectableGroupItemIds
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


    const requestLayerState =
        useCallback((
            operation: number,
            layerId = 0,
            name = '',
            itemIds: number[] = [],
            silent = false
        ) =>
        {
            if(!activeRef.current) return;
            if(!roomSessionRef.current) return;
            if(layerPendingRef.current) return;

            layerRequestIdRef.current++;

            if(layerRequestIdRef.current > 2000000000)
            {
                layerRequestIdRef.current = 1;
            }

            const requestId =
                layerRequestIdRef.current;

            layerOperationRef.current =
                operation;

            layerSilentRequestRef.current =
                silent;

            layerPendingRef.current = true;
            setLayerPending(true);

            SendMessageComposer(
                new BuilderProLayerStateComposer(
                    requestId,
                    operation,
                    layerId,
                    name,
                    itemIds
                )
            );

            if(layerPendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    layerPendingTimeoutRef.current
                );
            }

            layerPendingTimeoutRef.current =
                window.setTimeout(
                    () =>
                    {
                        layerPendingTimeoutRef.current =
                            null;

                        if(
                            !layerPendingRef.current ||
                            layerRequestIdRef.current !==
                            requestId
                        )
                        {
                            return;
                        }

                        layerPendingRef.current = false;
                        setLayerPending(false);

                        setStatus(
                            'Sin respuesta al gestionar capas.'
                        );
                    },
                    3000
                );
        }, []);


    const flushLayerAutoAssignQueue =
        useCallback(() =>
        {
            if(!activeRef.current) return;
            if(layerPendingRef.current) return;

            const queue =
                layerAutoAssignQueueRef.current;

            if(!queue.length)
            {
                return;
            }

            const targetLayerId =
                queue[0].layerId;

            if(
                targetLayerId <= 0 ||
                !savedLayersRef.current.some(
                    layer =>
                        layer.id === targetLayerId
                )
            )
            {
                layerAutoAssignQueueRef.current =
                    queue.filter(
                        entry =>
                            entry.layerId !==
                            targetLayerId
                    );

                return;
            }

            const itemIds: number[] = [];
            const itemIdSet =
                new Set<number>();

            const remaining:
                Array<{
                    layerId: number;
                    itemId: number;
                }> = [];

            for(const entry of queue)
            {
                if(
                    entry.layerId === targetLayerId &&
                    itemIds.length < MAX_SELECTION &&
                    !itemIdSet.has(entry.itemId)
                )
                {
                    itemIds.push(
                        entry.itemId
                    );

                    itemIdSet.add(
                        entry.itemId
                    );

                    continue;
                }

                remaining.push(entry);
            }

            layerAutoAssignQueueRef.current =
                remaining;

            if(!itemIds.length)
            {
                return;
            }

            requestLayerState(
                LAYER_OP_ASSIGN,
                targetLayerId,
                '',
                itemIds,
                true
            );
        }, [
            requestLayerState
        ]);

    useMessageEvent<BuilderProLayerStateEvent>(
        BuilderProLayerStateEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            if(
                parser.requestId !==
                layerRequestIdRef.current
            )
            {
                return;
            }

            if(layerPendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    layerPendingTimeoutRef.current
                );

                layerPendingTimeoutRef.current =
                    null;
            }

            const silentRequest =
                layerSilentRequestRef.current;

            layerSilentRequestRef.current =
                false;

            layerPendingRef.current = false;
            setLayerPending(false);

            const nextLayers:
                BuilderProSavedLayerState[] =
                parser.layers
                    .map(
                        layer => ({
                            id: layer.id,
                            name: layer.name,
                            sortOrder: layer.sortOrder,
                            itemIds: [ ...layer.itemIds ]
                        })
                    )
                    .sort(
                        (left, right) =>
                            (
                                left.sortOrder -
                                right.sortOrder
                            ) ||
                            (
                                left.id -
                                right.id
                            )
                    );

            savedLayersRef.current =
                nextLayers;

            setSavedLayers(
                nextLayers
            );

            const operation =
                layerOperationRef.current;

            setLayerScopeId(
                current =>
                {
                    if(
                        parser.success &&
                        operation === LAYER_OP_CREATE &&
                        nextLayers.length
                    )
                    {
                        return nextLayers[
                            nextLayers.length - 1
                        ].id;
                    }

                    if(
                        current > 0 &&
                        !nextLayers.some(
                            layer =>
                                layer.id === current
                        )
                    )
                    {
                        return LAYER_SCOPE_ALL;
                    }

                    return current;
                }
            );

            setSelectedLayerId(
                current =>
                {
                    if(
                        parser.success &&
                        operation === LAYER_OP_CREATE &&
                        nextLayers.length
                    )
                    {
                        return nextLayers[
                            nextLayers.length - 1
                        ].id;
                    }

                    if(
                        current > 0 &&
                        nextLayers.some(
                            layer =>
                                layer.id === current
                        )
                    )
                    {
                        return current;
                    }

                    return 0;
                }
            );

            if(
                !silentRequest &&
                (
                    operation !== LAYER_OP_LIST ||
                    !parser.success
                )
            )
            {
                setStatus(
                    parser.success
                        ? parser.message
                        : formatBuilderProServerFailure(parser.code, parser.message)
                );
            }
            else if(
                silentRequest &&
                !parser.success
            )
            {
                setStatus(
                    `No se pudo asignar automáticamente el furni a la capa: ${ parser.message }`
                );
            }

            window.setTimeout(
                flushLayerAutoAssignQueue,
                0
            );
        }
    );


    useRoomEngineEvent<RoomEngineObjectPlacedEvent>(
        RoomEngineObjectEvent.PLACED,
        event =>
        {
            if(!activeRef.current)
            {
                return;
            }

            if(
                event.category !==
                RoomObjectCategory.FLOOR
            )
            {
                return;
            }

            /*
             * Inventario usa un itemId positivo.
             * Catalogo usa un id temporal negativo.
             */
            if(event.objectId <= 0)
            {
                return;
            }

            if(!event.placedInRoom)
            {
                return;
            }

            layerOriginalAlphaRef.current.delete(
                event.objectId
            );

            if(suppressPasteLayerAutoAssignRef.current)
            {
                return;
            }

            const targetLayerId =
                layerScopeIdRef.current;

            /*
             * -1 = Todas las capas
             *  0 = Sin capa
             * Solo una capa real recibe nuevos furnis.
             */
            if(targetLayerId <= 0)
            {
                return;
            }

            if(
                !savedLayersRef.current.some(
                    layer =>
                        layer.id === targetLayerId
                )
            )
            {
                return;
            }

            const queue =
                layerAutoAssignQueueRef.current;

            if(
                !queue.some(
                    entry =>
                        entry.layerId === targetLayerId &&
                        entry.itemId === event.objectId
                )
            )
            {
                layerAutoAssignQueueRef.current = [
                    ...queue,
                    {
                        layerId: targetLayerId,
                        itemId: event.objectId
                    }
                ];
            }

            window.setTimeout(
                flushLayerAutoAssignQueue,
                0
            );
        }
    );

    useEffect(() =>
    {
        if(!active) return;
        if(!roomSession) return;

        if(layerPendingTimeoutRef.current !== null)
        {
            window.clearTimeout(
                layerPendingTimeoutRef.current
            );

            layerPendingTimeoutRef.current =
                null;
        }

        layerPendingRef.current = false;
        setLayerPending(false);

        requestLayerState(
            LAYER_OP_LIST
        );
    }, [
        active,
        roomSession?.roomId,
        requestLayerState
    ]);



    useEffect(() =>
    {
        const validIds =
            new Set<number>([
                0,
                ...savedLayers.map(
                    layer =>
                        layer.id
                )
            ]);

        setHiddenLayerIds(
            current =>
                current.filter(
                    id =>
                        validIds.has(id)
                )
        );

        setIsolatedLayerId(
            current =>
                (
                    current !== null &&
                    !validIds.has(current)
                )
                    ? null
                    : current
        );

        setDimmedOthersLayerId(
            current =>
                (
                    current !== null &&
                    !validIds.has(current)
                )
                    ? null
                    : current
        );

        setOutlinerMenuLayerId(
            current =>
                (
                    current !== null &&
                    !validIds.has(current)
                )
                    ? null
                    : current
        );

        setOutlinerRenameLayerId(
            current =>
                (
                    current !== null &&
                    !validIds.has(current)
                )
                    ? null
                    : current
        );
    }, [
        savedLayers
    ]);

    useEffect(() =>
    {
        if(!active)
        {
            return;
        }

        window.requestAnimationFrame(
            applyLayerVisibility
        );
    }, [
        active,
        savedLayers,
        hiddenLayerIds,
        isolatedLayerId,
        dimmedOthersLayerId,
        roomSession?.roomId,
        applyLayerVisibility
    ]);

    useEffect(() =>
    {
        if(!active)
        {
            ClearBuilderProInspectorState();
            return;
        }

        SetBuilderProInspectorState({
            groups: savedGroups,
            layers: savedLayers,
            traversableIds,
            hiddenLayerIds,
            isolatedLayerId,
            dimmedOthersLayerId,
            hiddenItemIds: individualHiddenItemIds,
            dimmedItemIds: individualDimmedItemIds,
            lockedItemIds
        });
    }, [
        active,
        savedGroups,
        savedLayers,
        traversableIds,
        hiddenLayerIds,
        isolatedLayerId,
        dimmedOthersLayerId,
        individualHiddenItemIds,
        individualDimmedItemIds,
        lockedItemIds,
        pending,
        outlinerRevision
    ]);

    useEffect(() =>
    {
        if(selectedLayerId <= 0)
        {
            setLayerName('');
            return;
        }

        const layer =
            savedLayers.find(
                entry =>
                    entry.id ===
                    selectedLayerId
            );

        setLayerName(
            layer?.name || ''
        );
    }, [
        savedLayers,
        selectedLayerId
    ]);

    const selectSavedLayer =
        useCallback((
            layerId: number
        ) =>
        {
            const sourceIds =
                getAvailableLayerItemIds(
                    layerId
                );

            if(!sourceIds.length)
            {
                setStatus(
                    layerId === 0
                        ? 'No hay furnis disponibles en Sin capa.'
                        : 'Esta capa no contiene furnis disponibles.'
                );

                return;
            }

            const normalized =
                normalizeLayerSelection(
                    sourceIds
                );

            if(!normalized.ids.length)
            {
                setStatus(
                    'No hay furnis disponibles para seleccionar.'
                );

                return;
            }

            applySelection(
                normalized.ids
            );

            setSelectedLayerId(
                layerId
            );

            const layer =
                layerId === 0
                    ? null
                    : (
                        savedLayersRef.current.find(
                            entry =>
                                entry.id === layerId
                        ) || null
                    );

            const label =
                layer?.name ||
                'Sin capa';

            setStatus(
                `${ label }: ${ normalized.ids.length } furnis seleccionados.${ normalized.limitReached ? ` Límite de ${ MAX_SELECTION } alcanzado.` : '' }`
            );
        }, [
            applySelection,
            getAvailableLayerItemIds,
            normalizeLayerSelection
        ]);


    const getOutlinerItemName =
        useCallback((
            itemId: number
        ): string =>
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
                return `Furni #${ itemId }`;
            }

            const roomObject =
                roomEngine.getRoomObject(
                    currentRoomSession.roomId,
                    itemId,
                    RoomObjectCategory.FLOOR
                );

            if(!roomObject)
            {
                return `Furni #${ itemId }`;
            }

            let name =
                roomObject.type ||
                'Furni';

            const typeId =
                roomObject.model.getValue<number>(
                    RoomObjectVariable.FURNITURE_TYPE_ID
                );

            const furniData =
                GetSessionDataManager()
                    ?.getFloorItemData(
                        typeId
                    );

            if(
                furniData &&
                furniData.name?.length
            )
            {
                name =
                    furniData.name;
            }

            return name;
        }, []);

    const setOutlinerWorkLayer =
        useCallback((
            layerId: number
        ) =>
        {
            layerScopeIdRef.current =
                layerId;

            setLayerScopeId(
                layerId
            );

            setSelectedLayerId(
                layerId
            );

            setOutlinerMenuLayerId(
                null
            );
        }, []);

    const selectOutlinerLayer =
        useCallback((
            layerId: number
        ) =>
        {
            setOutlinerWorkLayer(
                layerId
            );

            const sourceIds =
                getAvailableLayerItemIds(
                    layerId
                );

            if(!sourceIds.length)
            {
                clearSelection();

                setStatus(
                    layerId === 0
                        ? 'Sin capa activa. No contiene furnis disponibles.'
                        : 'Capa de trabajo activa. No contiene furnis disponibles.'
                );

                return;
            }

            const normalized =
                normalizeLayerSelection(
                    sourceIds
                );

            applySelection(
                normalized.ids
            );

            const label =
                layerId === 0
                    ? 'Sin capa'
                    : (
                        savedLayersRef.current.find(
                            layer =>
                                layer.id === layerId
                        )?.name ||
                        'Capa'
                    );

            setStatus(
                `${ label } activa: ${ normalized.ids.length } furnis seleccionados.${ normalized.limitReached ? ` Límite de ${ MAX_SELECTION } alcanzado.` : '' }`
            );
        }, [
            applySelection,
            clearSelection,
            getAvailableLayerItemIds,
            normalizeLayerSelection,
            setOutlinerWorkLayer
        ]);

    const selectOutlinerGroup =
        useCallback((
            group: BuilderProSavedGroupState,
            layerId: number
        ) =>
        {
            setOutlinerWorkLayer(
                layerId
            );

            const ids =
                getSelectableGroupItemIds(
                    group
                );

            if(!ids.length)
            {
                setStatus(
                    'El grupo no contiene furnis disponibles.'
                );

                return;
            }

            if(ids.length > MAX_SELECTION)
            {
                setStatus(
                    `El grupo supera el límite de ${ MAX_SELECTION } furnis.`
                );

                return;
            }

            applySelection(
                ids
            );

            setSelectedGroupId(
                group.id
            );

            setStatus(
                `${ group.name }: ${ ids.length } furnis seleccionados.`
            );
        }, [
            applySelection,
            getSelectableGroupItemIds,
            setOutlinerWorkLayer
        ]);

    const selectOutlinerItem =
        useCallback((
            itemId: number,
            layerId: number
        ) =>
        {
            setOutlinerWorkLayer(
                layerId
            );

            const group =
                savedGroupsRef.current.find(
                    entry =>
                        entry.itemIds.includes(
                            itemId
                        )
                ) || null;

            if(group?.locked)
            {
                const ids =
                    getAvailableGroupItemIds(
                        group
                    );

                if(ids.length > MAX_SELECTION)
                {
                    setStatus(
                        `El grupo bloqueado supera el límite de ${ MAX_SELECTION } furnis.`
                    );

                    return;
                }

                applySelection(
                    ids
                );

                setSelectedGroupId(
                    group.id
                );

                setStatus(
                    `${ group.name } seleccionado como unidad bloqueada.`
                );

                return;
            }

            applySelection([
                itemId
            ]);

            setSelectedGroupId(
                group?.id ??
                null
            );

            setStatus(
                `${ getOutlinerItemName(itemId) } #${ itemId } seleccionado.`
            );
        }, [
            applySelection,
            getAvailableGroupItemIds,
            getOutlinerItemName,
            setOutlinerWorkLayer
        ]);


    const moveSelectionToOutlinerLayer =
        useCallback((
            layerId: number
        ) =>
        {
            if(!selectedIdsRef.current.length)
            {
                setStatus(
                    'Selecciona furnis antes de moverlos a una capa.'
                );

                return;
            }

            const normalized =
                normalizeLayerSelection(
                    selectedIdsRef.current
                );

            if(normalized.limitReached)
            {
                setStatus(
                    `La operación supera el límite de ${ MAX_SELECTION } furnis al completar grupos bloqueados.`
                );

                return;
            }

            if(!normalized.ids.length)
            {
                return;
            }

            if(
                normalized.ids.length !==
                selectedIdsRef.current.length
            )
            {
                applySelection(
                    normalized.ids
                );
            }

            setOutlinerWorkLayer(
                layerId
            );

            if(layerId > 0)
            {
                requestLayerState(
                    LAYER_OP_ASSIGN,
                    layerId,
                    '',
                    normalized.ids
                );
            }
            else
            {
                requestLayerState(
                    LAYER_OP_UNASSIGN,
                    0,
                    '',
                    normalized.ids
                );
            }

            setOutlinerMenuLayerId(
                null
            );
        }, [
            applySelection,
            normalizeLayerSelection,
            requestLayerState,
            setOutlinerWorkLayer
        ]);

    const beginOutlinerRename =
        useCallback((
            layerId: number
        ) =>
        {
            const layer =
                savedLayersRef.current.find(
                    entry =>
                        entry.id === layerId
                );

            if(!layer)
            {
                return;
            }

            setOutlinerRenameLayerId(
                layerId
            );

            setOutlinerRenameValue(
                layer.name
            );

            setOutlinerMenuLayerId(
                null
            );
        }, []);

    const cancelOutlinerRename =
        useCallback(() =>
        {
            setOutlinerRenameLayerId(
                null
            );

            setOutlinerRenameValue(
                ''
            );
        }, []);

    const confirmOutlinerRename =
        useCallback((
            layerId: number
        ) =>
        {
            const name =
                outlinerRenameValue
                    .trim();

            if(!name)
            {
                setStatus(
                    'Escribe un nombre para la capa.'
                );

                return;
            }

            requestLayerState(
                LAYER_OP_RENAME,
                layerId,
                name
            );

            setOutlinerRenameLayerId(
                null
            );

            setOutlinerRenameValue(
                ''
            );

            setOutlinerMenuLayerId(
                null
            );
        }, [
            outlinerRenameValue,
            requestLayerState
        ]);

    const deleteOutlinerLayer =
        useCallback((
            layerId: number
        ) =>
        {
            const layer =
                savedLayersRef.current.find(
                    entry =>
                        entry.id === layerId
                );

            if(!layer)
            {
                return;
            }

            if(
                !window.confirm(
                    `¿Eliminar la capa "${ layer.name }"? Sus furnis pasarán a Sin capa.`
                )
            )
            {
                return;
            }

            requestLayerState(
                LAYER_OP_DELETE,
                layerId
            );

            setOutlinerMenuLayerId(
                null
            );

            setOutlinerRenameLayerId(
                null
            );

            setOutlinerRenameValue(
                ''
            );
        }, [
            requestLayerState
        ]);

    const isolateOutlinerLayer =
        useCallback((
            layerId: number
        ) =>
        {
            layerScopeIdRef.current =
                layerId;

            setLayerScopeId(
                layerId
            );

            setSelectedLayerId(
                layerId
            );

            toggleIsolateWorkLayer();

            setOutlinerMenuLayerId(
                null
            );
        }, [
            toggleIsolateWorkLayer
        ]);

    const dimOutlinerLayer =
        useCallback((
            layerId: number
        ) =>
        {
            layerScopeIdRef.current =
                layerId;

            setLayerScopeId(
                layerId
            );

            setSelectedLayerId(
                layerId
            );

            toggleDimOtherLayers();

            setOutlinerMenuLayerId(
                null
            );
        }, [
            toggleDimOtherLayers
        ]);

    const createLayer =
        useCallback(() =>
        {
            requestLayerState(
                LAYER_OP_CREATE
            );
        }, [
            requestLayerState
        ]);

    const renameLayer =
        useCallback(() =>
        {
            if(!selectedSavedLayer)
            {
                return;
            }

            const name =
                layerName.trim();

            if(!name)
            {
                setStatus(
                    'Escribe un nombre para la capa.'
                );

                return;
            }

            requestLayerState(
                LAYER_OP_RENAME,
                selectedSavedLayer.id,
                name
            );
        }, [
            layerName,
            requestLayerState,
            selectedSavedLayer
        ]);

    const deleteLayer =
        useCallback(() =>
        {
            if(!selectedSavedLayer)
            {
                return;
            }

            if(
                !window.confirm(
                    `¿Eliminar la capa "${ selectedSavedLayer.name }"? Sus furnis pasarán a Sin capa.`
                )
            )
            {
                return;
            }

            requestLayerState(
                LAYER_OP_DELETE,
                selectedSavedLayer.id
            );
        }, [
            requestLayerState,
            selectedSavedLayer
        ]);

    const moveSelectionToLayer =
        useCallback(() =>
        {
            if(!selectedIdsRef.current.length)
            {
                setStatus(
                    'Selecciona furnis antes de cambiar su capa.'
                );

                return;
            }

            const normalized =
                normalizeLayerSelection(
                    selectedIdsRef.current
                );

            if(normalized.limitReached)
            {
                setStatus(
                    `La operación supera el límite de ${ MAX_SELECTION } furnis al completar grupos bloqueados.`
                );

                return;
            }

            if(!normalized.ids.length)
            {
                return;
            }

            if(
                normalized.ids.length !==
                selectedIdsRef.current.length
            )
            {
                applySelection(
                    normalized.ids
                );
            }

            if(selectedLayerId > 0)
            {
                requestLayerState(
                    LAYER_OP_ASSIGN,
                    selectedLayerId,
                    '',
                    normalized.ids
                );

                return;
            }

            requestLayerState(
                LAYER_OP_UNASSIGN,
                0,
                '',
                normalized.ids
            );
        }, [
            applySelection,
            normalizeLayerSelection,
            requestLayerState,
            selectedLayerId
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
                    settlePlacedSelection(
                        placedIds
                    );

                    setCanUndo(true);
                    setCanRedo(false);
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
                        : formatBuilderProServerFailure(parser.code, parser.message)
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
                        : formatBuilderProServerFailure(parser.code, parser.message)
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

    const setConstructionLockSelection =
        useCallback((
            enabled: boolean
        ) =>
        {
            const ids = [
                ...selectedIdsRef.current
            ];

            if(!ids.length)
            {
                setStatus(
                    'Selecciona furnis para cambiar su bloqueo.'
                );

                return;
            }

            requestItemLockState(
                1,
                enabled,
                ids
            );
        }, [
            requestItemLockState
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

    const captureMirrorTargetRotations =
        useCallback((
            ids: number[],
            axis: number
        ): number[] | null =>
        {
            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            if(
                !currentRoomSession ||
                !roomEngine ||
                (
                    axis !== MIRROR_AXIS_HORIZONTAL &&
                    axis !== MIRROR_AXIS_VERTICAL
                )
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

                const allowedDirections =
                    roomObject.model
                        ?.getValue<number[]>(
                            RoomObjectVariable
                                .FURNITURE_ALLOWED_DIRECTIONS
                        );

                rotations.push(
                    resolveMirroredServerRotation(
                        direction.x,
                        allowedDirections,
                        axis
                    )
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

                else if(
                    operation === TRANSFORM_MIRROR_HORIZONTAL ||
                    operation === TRANSFORM_MIRROR_VERTICAL
                )
                {
                    const dx =
                        snapshot.x -
                        pivot.x;

                    const dy =
                        snapshot.y -
                        pivot.y;

                    if(
                        operation ===
                        TRANSFORM_MIRROR_HORIZONTAL
                    )
                    {
                        x =
                            pivot.x -
                            dx;
                    }
                    else
                    {
                        y =
                            pivot.y -
                            dy;
                    }

                    const allowedDirections =
                        roomObject.model
                            ?.getValue<number[]>(
                                RoomObjectVariable
                                    .FURNITURE_ALLOWED_DIRECTIONS
                            );

                    const axis =
                        operation ===
                        TRANSFORM_MIRROR_HORIZONTAL
                            ? MIRROR_AXIS_HORIZONTAL
                            : MIRROR_AXIS_VERTICAL;

                    directionX =
                        resolveMirroredServerRotation(
                            snapshot.directionX,
                            allowedDirections,
                            axis
                        ) * 45;
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
        GridEngine.clearTiles('builder-area');
        suppressAreaClickRef.current = false;
        setBuilderProRoomDraggingLocked(areaModeRef.current);
        pointerDownRef.current = null;
        dragRef.current = null;
        suppressDragClickRef.current = false;
        mirrorDuplicateModeRef.current = false;
        suppressPasteLayerAutoAssignRef.current = false;
        replacePickModeRef.current = false;
        replacementContextRef.current = null;
        replacementSourceIdsRef.current =
            new Set<number>();
        pendingReplaceOperationRef.current =
            REPLACE_OP_PREVIEW;
        referencePickOperationRef.current =
            REFERENCE_OP_NONE;
        pendingReferenceOperationRef.current =
            REFERENCE_OP_NONE;

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

        ClearBuilderProInspectorState();

        clearSelection();

        restoreLayerVisibility();

        hiddenLayerIdsRef.current =
            new Set();
        isolatedLayerIdRef.current =
            null;
        dimmedOthersLayerIdRef.current =
            null;
        individualHiddenItemIdsRef.current =
            new Set();
        individualDimmedItemIdsRef.current =
            new Set();

        setHiddenLayerIds([]);
        setIsolatedLayerId(null);
        setDimmedOthersLayerId(null);
        setIndividualHiddenItemIds([]);
        setIndividualDimmedItemIds([]);

        setActive(false);
        setPending(false);
        setAreaMode(false);

        setReferencePickOperation(
            REFERENCE_OP_NONE
        );
        setReplacePickMode(false);
        setMinimized(false);
        setHelpOpen(false);
        setGroupPending(false);
        setSavedGroups([]);
        setLayerScopeId(LAYER_SCOPE_ALL);
        layerScopeIdRef.current = LAYER_SCOPE_ALL;
        layerSilentRequestRef.current = false;
        layerAutoAssignQueueRef.current = [];
        setOutlinerQuery('');
        setOutlinerCollapsedLayerIds([]);
        setOutlinerCollapsedGroupIds([]);
        setOutlinerMenuLayerId(null);
        setOutlinerRenameLayerId(null);
        setOutlinerRenameValue('');

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
    }, [
        clearSelection,
        restoreLayerVisibility
    ]);

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
        GridEngine.clearTiles('builder-area');
        suppressAreaClickRef.current = false;
        setBuilderProRoomDraggingLocked(areaModeRef.current);
        replacePickModeRef.current = false;
        replacementContextRef.current = null;
        replacementSourceIdsRef.current =
            new Set<number>();
        pendingReplaceOperationRef.current =
            REPLACE_OP_PREVIEW;
        referencePickOperationRef.current =
            REFERENCE_OP_NONE;
        pendingReferenceOperationRef.current =
            REFERENCE_OP_NONE;

        SetBuilderProSelectionModeActive(true);

        setActive(true);
        setPending(false);
        setAreaMode(false);

        setReferencePickOperation(
            REFERENCE_OP_NONE
        );
        setReplacePickMode(false);
        setMinimized(false);
        setHelpOpen(false);
        setGroupPending(false);
        setSavedGroups([]);
        setLayerScopeId(LAYER_SCOPE_ALL);
        layerScopeIdRef.current = LAYER_SCOPE_ALL;
        layerSilentRequestRef.current = false;
        layerAutoAssignQueueRef.current = [];
        setOutlinerQuery('');
        setOutlinerCollapsedLayerIds([]);
        setOutlinerCollapsedGroupIds([]);
        setOutlinerMenuLayerId(null);
        setOutlinerRenameLayerId(null);
        setOutlinerRenameValue('');

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


    const clearReplacePick =
        useCallback((
            silent = false
        ) =>
        {
            replacePickModeRef.current =
                false;

            replacementContextRef.current =
                null;

            replacementSourceIdsRef.current =
                new Set<number>();

            pendingReplaceOperationRef.current =
                REPLACE_OP_PREVIEW;

            setReplacePickMode(
                false
            );

            if(!silent)
            {
                setStatus(
                    'Reemplazo cancelado.'
                );
            }
        }, []);

    const captureReplacementRotations =
        useCallback((
            ids: number[],
            referenceId: number
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

            const reference =
                roomEngine.getRoomObject(
                    currentRoomSession.roomId,
                    referenceId,
                    RoomObjectCategory.FLOOR
                );

            if(!reference)
            {
                return null;
            }

            const allowedDirections =
                reference.model
                    ?.getValue<number[]>(
                        RoomObjectVariable
                            .FURNITURE_ALLOWED_DIRECTIONS
                    );

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
                    resolveNearestAllowedServerRotation(
                        direction.x,
                        allowedDirections
                    )
                );
            }

            return rotations;
        }, []);

    const validateReplacementVisualFootprints =
        useCallback((
            ids: number[],
            referenceId: number,
            targetRotations: number[]
        ): string | null =>
        {
            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            if(
                !currentRoomSession ||
                !roomEngine ||
                ids.length !== targetRotations.length
            )
            {
                return 'No se pudo comprobar la huella visual del reemplazo.';
            }

            const reference =
                roomEngine.getRoomObject(
                    currentRoomSession.roomId,
                    referenceId,
                    RoomObjectCategory.FLOOR
                );

            if(!reference || !reference.model)
            {
                return 'No se pudo leer la huella visual del furni de referencia.';
            }

            let referenceSizeX =
                reference.model.getValue<number>(
                    RoomObjectVariable.FURNITURE_SIZE_X
                );

            let referenceSizeY =
                reference.model.getValue<number>(
                    RoomObjectVariable.FURNITURE_SIZE_Y
                );

            if(!Number.isFinite(referenceSizeX) || referenceSizeX < 1)
            {
                referenceSizeX = 1;
            }

            if(!Number.isFinite(referenceSizeY) || referenceSizeY < 1)
            {
                referenceSizeY = 1;
            }

            const effectiveSize =
                (
                    sizeX: number,
                    sizeY: number,
                    rotation: number
                ): [number, number] =>
                {
                    const normalized =
                        normalizeBuilderProRotation(
                            rotation
                        );

                    if(normalized === 2 || normalized === 6)
                    {
                        return [ sizeY, sizeX ];
                    }

                    return [ sizeX, sizeY ];
                };

            const approximatelyEqual =
                (first: number, second: number): boolean =>
                    Math.abs(first - second) < 0.001;

            for(let index = 0; index < ids.length; index++)
            {
                const source =
                    roomEngine.getRoomObject(
                        currentRoomSession.roomId,
                        ids[index],
                        RoomObjectCategory.FLOOR
                    );

                const direction =
                    source?.getDirection();

                if(!source || !source.model || !direction)
                {
                    return 'No se pudo leer la huella visual completa de la selección.';
                }

                let sourceSizeX =
                    source.model.getValue<number>(
                        RoomObjectVariable.FURNITURE_SIZE_X
                    );

                let sourceSizeY =
                    source.model.getValue<number>(
                        RoomObjectVariable.FURNITURE_SIZE_Y
                    );

                if(!Number.isFinite(sourceSizeX) || sourceSizeX < 1)
                {
                    sourceSizeX = 1;
                }

                if(!Number.isFinite(sourceSizeY) || sourceSizeY < 1)
                {
                    sourceSizeY = 1;
                }

                const sourceRotation =
                    normalizeBuilderProRotation(
                        direction.x / 45
                    );

                const [ sourceEffectiveX, sourceEffectiveY ] =
                    effectiveSize(
                        sourceSizeX,
                        sourceSizeY,
                        sourceRotation
                    );

                const [ targetEffectiveX, targetEffectiveY ] =
                    effectiveSize(
                        referenceSizeX,
                        referenceSizeY,
                        targetRotations[index]
                    );

                if(
                    !approximatelyEqual(sourceEffectiveX, targetEffectiveX) ||
                    !approximatelyEqual(sourceEffectiveY, targetEffectiveY)
                )
                {
                    return (
                        'Huella visual incompatible: '
                        + `${ sourceEffectiveX }×${ sourceEffectiveY } → `
                        + `${ targetEffectiveX }×${ targetEffectiveY }. `
                        + 'Reemplazar solo admite furnis que ocupen visualmente las mismas casillas.'
                    );
                }
            }

            return null;
        }, []);

    const finalizeReplacementVisuals =
        useCallback((
            replacementIds: number[],
            context: BuilderProReplacementContext,
            successMessage: string
        ) =>
        {
            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            const finishMetadataRefresh =
                () =>
                {
                    requestGroupState(
                        GROUP_OP_LIST
                    );

                    requestLayerState(
                        LAYER_OP_LIST
                    );

                    requestTraversalState(
                        TRAVERSAL_OP_QUERY
                    );
                };

            if(
                !currentRoomSession ||
                !roomEngine ||
                replacementIds.length !==
                    context.sourceSnapshots.length ||
                replacementIds.length !==
                    context.targetRotations.length
            )
            {
                replacementSourceIdsRef.current =
                    new Set<number>();

                replacementContextRef.current =
                    null;

                applySelection(
                    replacementIds
                );

                finishMetadataRefresh();

                setStatus(
                    `${ successMessage } Aviso: no se pudo verificar la sincronización visual.`
                );

                return;
            }

            let attempts = 0;
            const maxAttempts = 45;

            const settle =
                () =>
                {
                    if(!activeRef.current)
                    {
                        replacementSourceIdsRef.current =
                            new Set<number>();

                        replacementContextRef.current =
                            null;

                        return;
                    }

                    let allPresent = true;
                    const presentIds: number[] = [];

                    for(
                        let index = 0;
                        index < replacementIds.length;
                        index++
                    )
                    {
                        const itemId =
                            replacementIds[index];

                        const snapshot =
                            context.sourceSnapshots[index];

                        const roomObject =
                            roomEngine.getRoomObject(
                                currentRoomSession.roomId,
                                itemId,
                                RoomObjectCategory.FLOOR
                            );

                        if(!roomObject)
                        {
                            allPresent = false;
                            continue;
                        }

                        presentIds.push(
                            itemId
                        );

                        roomObject.setLocation(
                            new Vector3d(
                                snapshot.x,
                                snapshot.y,
                                snapshot.z
                            )
                        );

                        roomObject.setDirection(
                            new Vector3d(
                                context.targetRotations[index] *
                                    45
                            )
                        );
                    }

                    attempts++;

                    if(allPresent)
                    {
                        replacementSourceIdsRef.current =
                            new Set<number>();

                        replacementContextRef.current =
                            null;

                        applySelection(
                            replacementIds
                        );

                        finishMetadataRefresh();

                        setStatus(
                            successMessage
                        );

                        window.requestAnimationFrame(
                            () =>
                            {
                                BuilderProSelectionVisualizer.refresh(
                                    replacementIds
                                );
                            }
                        );

                        return;
                    }

                    if(attempts < maxAttempts)
                    {
                        window.requestAnimationFrame(
                            settle
                        );

                        return;
                    }

                    replacementSourceIdsRef.current =
                        new Set<number>();

                    replacementContextRef.current =
                        null;

                    applySelection(
                        presentIds
                    );

                    finishMetadataRefresh();

                    setStatus(
                        `${ successMessage } Aviso: Nitro solo sincronizó ${ presentIds.length }/${ replacementIds.length } furnis; vuelve a entrar en la sala si no aparecen todos.`
                    );
                };

            window.requestAnimationFrame(
                settle
            );
        }, [
            applySelection,
            requestGroupState,
            requestLayerState,
            requestTraversalState
        ]);

    const sendReplaceRequest =
        useCallback((
            operation: number,
            context: BuilderProReplacementContext
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

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
            pendingReplaceOperationRef.current =
                operation;

            setPending(true);

            setStatus(
                operation === REPLACE_OP_PREVIEW
                    ? `Comprobando reemplazo con furni #${ context.referenceId }...`
                    : 'Reemplazando selección...'
            );

            try
            {
                SendMessageComposer(
                    new BuilderProReplaceGroupComposer(
                        context.itemIds,
                        operation,
                        context.referenceId,
                        context.targetRotations,
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

                            if(
                                !pendingRef.current ||
                                pendingRequestIdRef.current !==
                                requestId
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
                                'Reemplazo sin confirmación del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT REPLACE_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current = false;
                pendingRequestIdRef.current =
                    null;
                pendingStartedAtRef.current =
                    0;

                setPending(false);

                setStatus(
                    'No se pudo enviar el reemplazo.'
                );
            }
        }, []);

    const requestReplacePreview =
        useCallback((
            referenceId: number
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
                    'Selecciona primero lo que quieres reemplazar.'
                );

                return;
            }

            const rotations =
                captureReplacementRotations(
                    ids,
                    referenceId
                );

            if(!rotations || rotations.length !== ids.length)
            {
                setStatus(
                    'No se pudieron calcular las orientaciones del reemplazo.'
                );

                return;
            }

            const visualFootprintError =
                validateReplacementVisualFootprints(
                    ids,
                    referenceId,
                    rotations
                );

            if(visualFootprintError)
            {
                setStatus(
                    visualFootprintError
                );

                return;
            }

            const sourceSnapshots =
                captureTransformSnapshots(
                    ids
                );

            if(!sourceSnapshots || sourceSnapshots.length !== ids.length)
            {
                setStatus(
                    'No se pudo capturar la geometría completa del reemplazo.'
                );

                return;
            }

            const context: BuilderProReplacementContext = {
                itemIds: ids,
                referenceId,
                targetRotations: rotations,
                sourceSnapshots
            };

            replacementContextRef.current =
                context;

            sendReplaceRequest(
                REPLACE_OP_PREVIEW,
                context
            );
        }, [
            captureReplacementRotations,
            captureTransformSnapshots,
            sendReplaceRequest,
            validateReplacementVisualFootprints
        ]);

    const toggleReplacePick =
        useCallback(() =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;
            if(dragRef.current) return;

            if(replacePickModeRef.current)
            {
                clearReplacePick();
                return;
            }

            if(!selectedIdsRef.current.length)
            {
                setStatus(
                    'Selecciona primero lo que quieres reemplazar.'
                );

                return;
            }

            if(
                pasteModeRef.current ||
                duplicateModeRef.current ||
                blueprintPlaceModeRef.current
            )
            {
                setStatus(
                    'Cancela primero Pegar, Duplicar o Colocar blueprint.'
                );

                return;
            }

            clearReferencePick(true);

            if(pivotPickModeRef.current)
            {
                pivotPickModeRef.current =
                    false;

                setPivotPickMode(false);
            }

            if(areaModeRef.current)
            {
                areaModeRef.current =
                    false;
                areaStartRef.current = null;
                GridEngine.clearTiles('builder-area');
                suppressAreaClickRef.current = false;
                setBuilderProRoomDraggingLocked(areaModeRef.current);

                setAreaMode(false);

            }

            replacementContextRef.current =
                null;
            replacePickModeRef.current =
                true;

            setReplacePickMode(true);

            setStatus(
                'Reemplazar por: haz clic en un furni visible que servirá de modelo. Esc para cancelar.'
            );
        }, [
            clearReferencePick,
            clearReplacePick
        ]);


    const requestReferencePlacement =
        useCallback((
            operation: number,
            referenceId: number
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            const ids = [
                ...selectedIdsRef.current
            ];

            if(!ids.length)
            {
                clearReferencePick();

                setStatus(
                    'Selecciona primero lo que quieres modificar.'
                );

                return;
            }

            if(ids.includes(referenceId))
            {
                setStatus(
                    'El furni de referencia debe estar fuera de la selección.'
                );

                return;
            }

            const pivotId =
                (
                    pivotIdRef.current !== null &&
                    ids.includes(
                        pivotIdRef.current
                    )
                )
                    ? pivotIdRef.current
                    : ids[0];

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

            pendingReferenceOperationRef.current =
                operation;

            clearReferencePick();

            setPending(true);

            setStatus(
                operation === REFERENCE_OP_EQUAL_Z
                    ? `Igualando altura con furni #${ referenceId }...`
                    : `Colocando selección encima de furni #${ referenceId }...`
            );

            try
            {
                SendMessageComposer(
                    new BuilderProReferencePlacementComposer(
                        ids,
                        operation,
                        referenceId,
                        pivotId,
                        requestId
                    )
                );

                if(
                    pendingTimeoutRef.current !==
                    null
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

                            if(
                                !pendingRef.current ||
                                pendingRequestIdRef.current !==
                                requestId
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

                            pendingReferenceOperationRef.current =
                                REFERENCE_OP_NONE;

                            setPending(false);

                            setStatus(
                                'Operación con referencia sin confirmación del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT REFERENCE_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current = false;

                pendingRequestIdRef.current =
                    null;

                pendingStartedAtRef.current =
                    0;

                pendingReferenceOperationRef.current =
                    REFERENCE_OP_NONE;

                setPending(false);

                setStatus(
                    'No se pudo enviar la operación con referencia.'
                );
            }
        }, [
            clearReferencePick
        ]);

    const toggleReferencePick =
        useCallback((
            operation: number
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;
            if(dragRef.current) return;

            if(replacePickModeRef.current)
            {
                clearReplacePick(true);
            }

            if(
                operation !== REFERENCE_OP_EQUAL_Z &&
                operation !== REFERENCE_OP_PLACE_ABOVE
            )
            {
                return;
            }

            if(
                referencePickOperationRef.current ===
                operation
            )
            {
                clearReferencePick(true);
                return;
            }

            if(!selectedIdsRef.current.length)
            {
                setStatus(
                    'Selecciona primero lo que quieres modificar.'
                );

                return;
            }

            if(
                pasteModeRef.current ||
                duplicateModeRef.current ||
                blueprintPlaceModeRef.current
            )
            {
                setStatus(
                    'Cancela primero Pegar, Duplicar o Colocar blueprint.'
                );

                return;
            }

            if(pivotPickModeRef.current)
            {
                pivotPickModeRef.current =
                    false;

                setPivotPickMode(false);
            }

            if(areaModeRef.current)
            {
                areaModeRef.current =
                    false;

                areaStartRef.current = null;

                GridEngine.clearTiles('builder-area');

                suppressAreaClickRef.current = false;

                setBuilderProRoomDraggingLocked(areaModeRef.current);

                setAreaMode(false);

            }

            referencePickOperationRef.current =
                operation;

            setReferencePickOperation(
                operation
            );

            setStatus(
                operation === REFERENCE_OP_EQUAL_Z
                    ? 'Igualar altura: haz clic en el furni cuya altura quieres copiar. Esc para cancelar.'
                    : 'Colocar encima: haz clic en el furni que servirá de superficie. Esc para cancelar.'
            );
        }, [
            clearReferencePick,
            clearReplacePick
        ]);

    const toggleAreaMode = useCallback(() =>
    {
        if(!activeRef.current) return;
        if(pendingRef.current) return;
        if(dragRef.current) return;

        if(fillAreaPickModeRef.current)
        {
            fillAreaPickModeRef.current =
                false;

            fillAreaDraftContextRef.current =
                null;

            fillAreaOverlayActiveRef.current =
                false;

            setFillAreaPickMode(
                false
            );

            GridEngine.clearTiles(
                'builder-area'
            );
        }

        const next =
            !areaModeRef.current;

        areaModeRef.current =
            next;

        areaStartRef.current =
            null;

        GridEngine.clearTiles(
            'builder-area'
        );

        suppressAreaClickRef.current =
            false;

        setBuilderProRoomDraggingLocked(
            next
        );

        setAreaMode(next);

        setStatus(
            next
                ? 'Selección por área activa. Arrastra sobre las casillas de la sala.'
                : 'Selección por clic activa.'
        );
    }, []);

    const selectObjectsInArea = useCallback((
        area: BuilderProTileArea
    ) =>
    {
        const currentRoomSession =
            roomSessionRef.current;

        if(!currentRoomSession) return;

        const roomEngine =
            GetRoomEngine();

        if(!roomEngine) return;

        const assignedLayerByItem =
            new Map<number, number>();

        for(const layer of savedLayersRef.current)
        {
            for(const itemId of layer.itemIds)
            {
                assignedLayerByItem.set(
                    itemId,
                    layer.id
                );
            }
        }

        const isInScope =
            (itemId: number): boolean =>
            {
                if(layerScopeId === LAYER_SCOPE_ALL) return true;

                return (
                    assignedLayerByItem.get(itemId) || 0
                ) === layerScopeId;
            };

        const initialIds =
            layerScopeId === LAYER_SCOPE_ALL
                ? [ ...selectedIdsRef.current ]
                : selectedIdsRef.current.filter(isInScope);

        const next: number[] = [];
        const nextSet = new Set<number>();
        const handledLockedGroups = new Set<number>();

        let added = 0;
        let limitReached = false;

        const appendCandidate = (
            itemId: number,
            countAsAdded = true
        ) =>
        {
            if(nextSet.has(itemId)) return;

            const lockedGroup =
                savedGroupsRef.current.find(
                    group =>
                        group.locked &&
                        group.itemIds.includes(itemId)
                );

            if(lockedGroup)
            {
                if(handledLockedGroups.has(lockedGroup.id)) return;

                handledLockedGroups.add(lockedGroup.id);

                const available =
                    getAvailableGroupItemIds(lockedGroup);

                const missing =
                    available.filter(id => !nextSet.has(id));

                if(next.length + missing.length > MAX_SELECTION)
                {
                    limitReached = true;
                    return;
                }

                for(const id of missing)
                {
                    next.push(id);
                    nextSet.add(id);
                }

                if(countAsAdded) added += missing.length;
                return;
            }

            if(next.length >= MAX_SELECTION)
            {
                limitReached = true;
                return;
            }

            next.push(itemId);
            nextSet.add(itemId);

            if(countAsAdded) added++;
        };

        for(const itemId of initialIds)
        {
            appendCandidate(itemId, false);
        }

        const count =
            roomEngine.getRoomObjectCount(
                currentRoomSession.roomId,
                RoomObjectCategory.FLOOR
            );

        for(let index = 0; index < count; index++)
        {
            if(next.length >= MAX_SELECTION)
            {
                limitReached = true;
                break;
            }

            const roomObject =
                roomEngine.getRoomObjectByIndex(
                    currentRoomSession.roomId,
                    index,
                    RoomObjectCategory.FLOOR
                );

            if(!roomObject) continue;
            if(!isInScope(roomObject.id)) continue;
            if(!isItemLocallyVisible(roomObject.id)) continue;
            if(nextSet.has(roomObject.id)) continue;

            if(!CanManipulateFurniture(
                currentRoomSession,
                roomObject.id,
                RoomObjectCategory.FLOOR
            ))
            {
                continue;
            }

            const location = roomObject.getLocation();
            const direction = roomObject.getDirection();

            if(!location || !direction || !roomObject.model) continue;

            let sizeX =
                roomObject.model.getValue<number>(
                    RoomObjectVariable.FURNITURE_SIZE_X
                );

            let sizeY =
                roomObject.model.getValue<number>(
                    RoomObjectVariable.FURNITURE_SIZE_Y
                );

            if(!Number.isFinite(sizeX) || sizeX < 1) sizeX = 1;
            if(!Number.isFinite(sizeY) || sizeY < 1) sizeY = 1;

            sizeX = Math.max(1, Math.round(sizeX));
            sizeY = Math.max(1, Math.round(sizeY));

            const rotation =
                normalizeBuilderProRotation(
                    direction.x / 45
                );

            if(rotation === 2 || rotation === 6)
            {
                const swap = sizeX;
                sizeX = sizeY;
                sizeY = swap;
            }

            const objectMinX = Math.round(location.x);
            const objectMinY = Math.round(location.y);
            const objectMaxX = objectMinX + sizeX - 1;
            const objectMaxY = objectMinY + sizeY - 1;

            const intersects =
                objectMinX <= area.maxX &&
                objectMaxX >= area.minX &&
                objectMinY <= area.maxY &&
                objectMaxY >= area.minY;

            if(!intersects) continue;

            appendCandidate(roomObject.id);
        }

        applySelection(next);

        const scopeLabel =
            layerScopeId === LAYER_SCOPE_ALL
                ? 'Todas las capas'
                : (
                    layerScopeId === 0
                        ? 'Sin capa'
                        : (
                            savedLayersRef.current.find(
                                layer => layer.id === layerScopeId
                            )?.name || 'Capa'
                        )
                );

        const areaLabel =
            `${ area.minX },${ area.minY } → ${ area.maxX },${ area.maxY }`;

        if(limitReached)
        {
            setStatus(
                `Área ${ areaLabel } · ${ scopeLabel }: ${ added } añadidos. Límite ${ MAX_SELECTION } alcanzado sin partir grupos bloqueados.`
            );
            return;
        }

        setStatus(
            `Área ${ areaLabel } · ${ scopeLabel }: ${ added } añadidos. ${ next.length } seleccionados.`
        );
    }, [
        applySelection,
        getAvailableGroupItemIds,
        isItemLocallyVisible,
        layerScopeId
    ]);

    useRoomEngineEvent<RoomEngineTilePointerEvent>(
        [
            RoomEngineTilePointerEvent.TILE_POINTER_DOWN,
            RoomEngineTilePointerEvent.TILE_POINTER_MOVE,
            RoomEngineTilePointerEvent.TILE_POINTER_UP
        ],
        event =>
        {
            if(!activeRef.current) return;

            const tile: BuilderProTilePoint = {
                x: event.tileX,
                y: event.tileY,
                z: event.tileZ
            };

            if(
                event.type ===
                    RoomEngineTilePointerEvent.TILE_POINTER_DOWN
            )
            {
                if(pasteModeRef.current) return;
                if(pendingRef.current) return;
                if(dragRef.current) return;

                const altDrag =
                    event.altKey &&
                    !event.ctrlKey &&
                    !event.shiftKey;

                const fillAreaDrag =
                    fillAreaPickModeRef.current;

                if(
                    !altDrag &&
                    !areaModeRef.current &&
                    !fillAreaDrag
                )
                {
                    return;
                }

                areaStartRef.current = {
                    startTile: { ...tile },
                    currentTile: { ...tile },
                    dragging: false,
                    purpose:
                        fillAreaDrag
                            ? 'fill'
                            : 'selection'
                };

                if(fillAreaDrag)
                {
                    fillAreaOverlayActiveRef.current =
                        true;
                }

                setBuilderProRoomDraggingLocked(
                    true
                );

                GridEngine.setTiles(
                    'builder-area',
                    [ tile ]
                );

                return;
            }

            const start =
                areaStartRef.current;

            if(!start) return;

            if(
                event.type ===
                    RoomEngineTilePointerEvent.TILE_POINTER_MOVE
            )
            {
                /*
                 * HoloGrid solo necesita repintar al CAMBIAR de casilla.
                 * Antes reconstruíamos el área en cada mousemove dentro
                 * del mismo tile.
                 */
                if(
                    tile.x === start.currentTile.x &&
                    tile.y === start.currentTile.y
                )
                {
                    return;
                }

                start.currentTile = {
                    ...tile
                };

                if(
                    tile.x !== start.startTile.x ||
                    tile.y !== start.startTile.y
                )
                {
                    start.dragging = true;
                }

                const area =
                    createBuilderProTileArea(
                        start.startTile,
                        start.currentTile
                    );

                GridEngine.setTiles(
                    'builder-area',
                    getBuilderProTileAreaTiles(
                        area
                    )
                );

                const width =
                    area.maxX - area.minX + 1;

                const height =
                    area.maxY - area.minY + 1;

                setStatus(
                    start.purpose === 'fill'
                        ? `Rellenar área: ${ area.minX },${ area.minY } → ${ area.maxX },${ area.maxY } · ${ width }×${ height } casillas.`
                        : `Área: ${ area.minX },${ area.minY } → ${ area.maxX },${ area.maxY } · ${ width }×${ height } casillas.`
                );

                return;
            }

            if(
                event.type !==
                    RoomEngineTilePointerEvent.TILE_POINTER_UP
            )
            {
                return;
            }

            start.currentTile = {
                ...tile
            };

            const wasAreaDrag =
                start.dragging ||
                tile.x !== start.startTile.x ||
                tile.y !== start.startTile.y;

            const area =
                createBuilderProTileArea(
                    start.startTile,
                    start.currentTile
                );

            const purpose =
                start.purpose;

            areaStartRef.current =
                null;

            if(purpose === 'fill')
            {
                const draft =
                    fillAreaDraftContextRef.current;

                fillAreaPickModeRef.current =
                    false;

                fillAreaDraftContextRef.current =
                    null;

                setFillAreaPickMode(
                    false
                );

                setBuilderProRoomDraggingLocked(
                    areaModeRef.current
                );

                suppressAreaClickRef.current =
                    true;

                if(!draft)
                {
                    fillAreaOverlayActiveRef.current =
                        false;

                    GridEngine.clearTiles(
                        'builder-area'
                    );

                    setStatus(
                        'No se pudo recuperar el módulo de Fill Area.'
                    );

                    return;
                }

                requestFillRepeatRef.current(
                    FILL_REPEAT_OP_PREVIEW,
                    {
                        itemIds: [
                            ...draft.itemIds
                        ],
                        mode:
                            FILL_REPEAT_MODE_TILE_AREA,
                        direction:
                            0,
                        spacing:
                            draft.spacing,
                        area
                    }
                );

                return;
            }

            GridEngine.clearTiles(
                'builder-area'
            );

            setBuilderProRoomDraggingLocked(
                areaModeRef.current
            );

            if(!wasAreaDrag)
            {
                return;
            }

            suppressAreaClickRef.current =
                true;

            selectObjectsInArea(
                area
            );
        }
    );

    useEffect(() =>
    {
        if(!active) return;

        /*
         * Si se suelta fuera de un plano de suelo no llega TILE_POINTER_UP.
         * Cancelamos la sesión compartida sin mover la cámara ni dejar
         * Builder Pro bloqueado.
         */
        const onWindowMouseUp = () =>
        {
            const start =
                areaStartRef.current;

            if(!start) return;

            areaStartRef.current =
                null;

            if(start.purpose === 'fill')
            {
                fillAreaPickModeRef.current =
                    false;

                fillAreaDraftContextRef.current =
                    null;

                fillAreaOverlayActiveRef.current =
                    false;

                setFillAreaPickMode(
                    false
                );
            }

            GridEngine.clearTiles(
                'builder-area'
            );

            suppressAreaClickRef.current =
                false;

            setBuilderProRoomDraggingLocked(
                areaModeRef.current
            );

            setStatus(
                start.purpose === 'fill'
                    ? 'Fill Area cancelado. Selecciona de nuevo Rellenar área.'
                    : (
                        areaModeRef.current
                            ? 'Selección por área activa. Arrastra sobre las casillas de la sala.'
                            : 'Selección por clic activa.'
                    )
            );
        };

        window.addEventListener(
            'mouseup',
            onWindowMouseUp
        );

        return () =>
        {
            window.removeEventListener(
                'mouseup',
                onWindowMouseUp
            );
        };
    }, [ active ]);


    useEffect(() =>
    {
        activeRef.current = false;
        pendingRef.current = false;
        areaModeRef.current = false;
        areaStartRef.current = null;
        GridEngine.clearTiles('builder-area');
        suppressAreaClickRef.current = false;
        setBuilderProRoomDraggingLocked(areaModeRef.current);

        SetBuilderProSelectionModeActive(false);

        ClearBuilderProInspectorState();

        restoreLayerVisibility();

        individualHiddenItemIdsRef.current =
            new Set();

        individualDimmedItemIdsRef.current =
            new Set();

        setIndividualHiddenItemIds([]);
        setIndividualDimmedItemIds([]);

        clearSelection();

        setActive(false);
        setPending(false);
        setAreaMode(false);

        setStatus('');
    }, [
        roomSession?.roomId,
        clearSelection,
        restoreLayerVisibility
    ]);

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
            setBuilderProRoomDraggingLocked(false);
            GridEngine.clearTiles('builder-area');
            areaStartRef.current = null;
            GridEngine.clearTiles('builder-area');
            suppressAreaClickRef.current = false;
            setBuilderProRoomDraggingLocked(areaModeRef.current);

            SetBuilderProSelectionModeActive(false);

            ClearBuilderProInspectorState();

            restoreLayerVisibility();

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

            if(layerPendingTimeoutRef.current !== null)
            {
                window.clearTimeout(
                    layerPendingTimeoutRef.current
                );
            }

            BuilderProSelectionVisualizer.clear(
                selectedIdsRef.current
            );
        };
    }, [ restoreLayerVisibility ]);



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
            RoomEngineObjectEvent.ADDED,
            RoomEngineObjectEvent.REMOVED,
            RoomEngineObjectEvent.CONTENT_UPDATED,
            RoomEngineObjectEvent.REQUEST_MOVE
        ],
        event =>
        {
            if(!activeRef.current) return;
            if(event.category !== RoomObjectCategory.FLOOR) return;

            if(
                event.objectId > 0 &&
                (
                    event.type ===
                        RoomEngineObjectEvent.ADDED ||
                    event.type ===
                        RoomEngineObjectEvent.REMOVED ||
                    event.type ===
                        RoomEngineObjectEvent.CONTENT_UPDATED ||
                    event.type ===
                        RoomEngineObjectEvent.REQUEST_MOVE
                )
            )
            {
                invalidateRepeatPreviewsForRoomMutationRef
                    .current();
            }

            if(event.type === RoomEngineObjectEvent.ADDED)
            {
                layerOriginalAlphaRef.current.delete(
                    event.objectId
                );

                scheduleOutlinerRevision();

                window.requestAnimationFrame(
                    applyLayerVisibility
                );

                if(
                    selectedIdsRef.current.includes(
                        event.objectId
                    )
                )
                {
                    window.requestAnimationFrame(
                        () =>
                            BuilderProSelectionVisualizer
                                .show(
                                    event.objectId
                                )
                    );
                }

                return;
            }

            if(
                event.type ===
                    RoomEngineObjectEvent.CONTENT_UPDATED
            )
            {
                if(
                    selectedIdsRef.current.includes(
                        event.objectId
                    )
                )
                {
                    window.requestAnimationFrame(
                        () =>
                            BuilderProSelectionVisualizer
                                .show(
                                    event.objectId
                                )
                    );
                }

                return;
            }

            if(event.type === RoomEngineObjectEvent.REQUEST_MOVE)
            {
                if(
                    !isItemInWorkScope(
                        event.objectId
                    )
                )
                {
                    setStatus(
                        'Ese furni pertenece a otra capa de trabajo.'
                    );

                    return;
                }

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

                layerOriginalAlphaRef.current.delete(
                    removedId
                );

                if(
                    individualHiddenItemIdsRef.current.has(
                        removedId
                    ) ||
                    individualDimmedItemIdsRef.current.has(
                        removedId
                    )
                )
                {
                    const nextHidden =
                        new Set(
                            individualHiddenItemIdsRef.current
                        );

                    const nextDimmed =
                        new Set(
                            individualDimmedItemIdsRef.current
                        );

                    nextHidden.delete(
                        removedId
                    );

                    nextDimmed.delete(
                        removedId
                    );

                    individualHiddenItemIdsRef.current =
                        nextHidden;

                    individualDimmedItemIdsRef.current =
                        nextDimmed;

                    setIndividualHiddenItemIds(
                        Array.from(nextHidden)
                    );

                    setIndividualDimmedItemIds(
                        Array.from(nextDimmed)
                    );
                }

                scheduleOutlinerRevision();

                if(
                    replacementSourceIdsRef.current.has(
                        removedId
                    )
                )
                {
                    return;
                }

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

            if(
                suppressPlacementSelectionEventsRef.current
            )
            {
                return;
            }

            const currentRoomSession =
                roomSessionRef.current;

            if(!currentRoomSession) return;

            if(replacePickModeRef.current)
            {
                if(
                    selectedIdsRef.current.includes(
                        event.objectId
                    )
                )
                {
                    setStatus(
                        'El furni de referencia debe estar fuera de la selección.'
                    );

                    return;
                }

                if(
                    !isItemLocallyVisible(
                        event.objectId
                    )
                )
                {
                    setStatus(
                        'El furni de referencia debe ser visible.'
                    );

                    return;
                }

                requestReplacePreview(
                    event.objectId
                );

                return;
            }

            if(
                referencePickOperationRef.current !==
                REFERENCE_OP_NONE
            )
            {
                if(
                    selectedIdsRef.current.includes(
                        event.objectId
                    )
                )
                {
                    setStatus(
                        'El furni de referencia debe estar fuera de la selección.'
                    );

                    return;
                }

                if(
                    !isItemLocallyVisible(
                        event.objectId
                    )
                )
                {
                    setStatus(
                        'El furni de referencia debe ser visible.'
                    );

                    return;
                }

                requestReferencePlacement(
                    referencePickOperationRef.current,
                    event.objectId
                );

                return;
            }

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

            if(
                !isItemInWorkScope(
                    event.objectId
                )
            )
            {
                const scope =
                    layerScopeIdRef.current;

                const label =
                    scope === 0
                        ? 'Sin capa'
                        : (
                            savedLayersRef.current.find(
                                layer =>
                                    layer.id === scope
                            )?.name ||
                            'la capa de trabajo'
                        );

                setStatus(
                    `Furni fuera de ${ label }. Cambia de capa para interactuar con él.`
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
                formatBuilderProServerFailure(parser.code, parser.message)
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
                formatBuilderProServerFailure(parser.code, parser.message)
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

                requestLayerState(
                    LAYER_OP_LIST
                );

                requestTraversalState(
                    TRAVERSAL_OP_QUERY
                );

                return;
            }

            setStatus(
                formatBuilderProServerFailure(parser.code, parser.message)
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

                requestLayerState(
                    LAYER_OP_LIST
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
                formatBuilderProServerFailure(parser.code, parser.message)
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
                formatBuilderProServerFailure(parser.code, parser.message)
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

            const referenceOperation =
                pendingReferenceOperationRef.current;

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

            pendingReferenceOperationRef.current =
                REFERENCE_OP_NONE;

            setPending(false);

            if(parser.success)
            {
                if(parser.affectedCount > 0)
                {
                    setCanUndo(true);
                    setCanRedo(false);
                }

                setStatus(
                    referenceOperation !==
                    REFERENCE_OP_NONE
                        ? parser.message
                        : `Offset aplicado a ${ parser.affectedCount } furnis.`
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
                formatBuilderProServerFailure(parser.code, parser.message)
            );
        }
    );

    useMessageEvent<BuilderProReplaceGroupResultEvent>(
        BuilderProReplaceGroupResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            if(
                pendingRequestIdRef.current !==
                    parser.requestId ||
                !pendingRef.current
            )
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

            const operation =
                parser.operation;

            pendingReplaceOperationRef.current =
                REPLACE_OP_PREVIEW;

            setPending(false);

            if(!parser.success)
            {
                if(operation === REPLACE_OP_EXECUTE)
                {
                    replacementSourceIdsRef.current =
                        new Set<number>();

                    replacementContextRef.current =
                        null;

                    replacePickModeRef.current =
                        false;

                    setReplacePickMode(false);

                    requestGroupState(
                        GROUP_OP_LIST
                    );

                    requestLayerState(
                        LAYER_OP_LIST
                    );

                    requestTraversalState(
                        TRAVERSAL_OP_QUERY
                    );
                }

                setStatus(
                    `${ formatBuilderProServerFailure(parser.code, parser.message) }${
                        parser.needed > 0
                            ? ` Necesarios: ${ parser.needed } · Disponibles: ${ parser.available }.`
                            : ''
                    }`
                );

                return;
            }

            if(operation === REPLACE_OP_PREVIEW)
            {
                const context =
                    replacementContextRef.current;

                if(!context)
                {
                    setStatus(
                        'La preparación del reemplazo ya no está disponible.'
                    );

                    return;
                }

                const accepted =
                    window.confirm(
                        `Reemplazar ${ parser.needed } furnis por "${ parser.referenceName }"?

` +
                        `Necesarios: ${ parser.needed }
` +
                        `Disponibles: ${ parser.available }

` +
                        'Se conservarán posición, altura, orientación compatible, capa, grupo y Atravesable. ' +
                        'El estado del furni nuevo volverá a su estado inicial cuando corresponda.'
                    );

                if(!accepted)
                {
                    clearReplacePick(true);
                    setStatus(
                        'Reemplazo cancelado.'
                    );
                    return;
                }

                replacePickModeRef.current =
                    false;
                setReplacePickMode(false);

                replacementSourceIdsRef.current =
                    new Set<number>(
                        context.itemIds
                    );

                window.setTimeout(
                    () =>
                    {
                        const latest =
                            replacementContextRef.current;

                        if(!latest)
                        {
                            return;
                        }

                        sendReplaceRequest(
                            REPLACE_OP_EXECUTE,
                            latest
                        );
                    },
                    0
                );

                return;
            }

            if(operation === REPLACE_OP_EXECUTE)
            {
                const replacementIds = [
                    ...parser.itemIds
                ];

                const context =
                    replacementContextRef.current;

                replacePickModeRef.current =
                    false;

                setReplacePickMode(false);

                if(parser.affectedCount > 0)
                {
                    setCanUndo(true);
                    setCanRedo(false);
                }

                if(!context)
                {
                    replacementSourceIdsRef.current =
                        new Set<number>();

                    applySelection(
                        replacementIds
                    );

                    requestGroupState(
                        GROUP_OP_LIST
                    );

                    requestLayerState(
                        LAYER_OP_LIST
                    );

                    requestTraversalState(
                        TRAVERSAL_OP_QUERY
                    );

                    setStatus(
                        `${ parser.message } Aviso: faltó el contexto visual del reemplazo.`
                    );

                    return;
                }

                setStatus(
                    `${ parser.message } Sincronizando vista...`
                );

                finalizeReplacementVisuals(
                    replacementIds,
                    context,
                    parser.message
                );
            }
        }
    );

    useMessageEvent<BuilderProMirrorDuplicateResultEvent>(
        BuilderProMirrorDuplicateResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            if(
                pendingRequestIdRef.current !==
                parser.requestId ||
                !pendingRef.current
            )
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

            if(!parser.success)
            {
                mirrorDuplicateModeRef.current =
                    false;

                setStatus(
                    formatBuilderProServerFailure(parser.code, parser.message)
                );

                return;
            }

            const entries =
                parser.previewEntries;

            if(
                entries.length !==
                parser.preparedCount
            )
            {
                mirrorDuplicateModeRef.current =
                    false;

                clipboardPreviewRef.current =
                    null;

                setStatus(
                    'La preview del espejo no coincide con la copia.'
                );

                return;
            }

            clearPastePreview();

            clipboardPreviewRef.current = {
                sourceAnchorZ:
                    parser.sourceAnchorZ,
                entries:
                    entries.map(
                        entry => ({
                            ...entry
                        })
                    )
            };

            duplicateRequestedRef.current =
                false;

            mirrorDuplicateModeRef.current =
                true;

            duplicateModeRef.current =
                true;

            setDuplicateMode(
                true
            );

            pasteModeRef.current =
                true;

            setPasteMode(
                true
            );

            setStatus(
                'Duplicar espejo: mueve el cursor y haz clic para colocar la copia.'
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

                const mirrorOperation =
                    completedOperation ===
                        TRANSFORM_MIRROR_HORIZONTAL ||
                    completedOperation ===
                        TRANSFORM_MIRROR_VERTICAL;

                setStatus(
                    mirrorOperation
                        ? `Espejo ${ completedOperation === TRANSFORM_MIRROR_HORIZONTAL ? 'horizontal' : 'vertical' }: ${ parser.affectedCount } furnis.`
                        : `Transformacion completada: ${ parser.affectedCount } furnis.`
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
                formatBuilderProServerFailure(parser.code, parser.message)
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

    const cancelCursorPlacement =
        useCallback((
            updateStatus: boolean = true
        ): boolean =>
        {
            if(
                pendingRef.current ||
                blueprintPendingRef.current
            )
            {
                return false;
            }

            const hadBlueprint =
                blueprintPlaceModeRef.current;

            const hadPaste =
                pasteModeRef.current ||
                duplicateModeRef.current ||
                duplicateRequestedRef.current ||
                mirrorDuplicateModeRef.current;

            if(!hadBlueprint && !hadPaste)
            {
                return false;
            }

            clearPastePreview();

            if(hadBlueprint)
            {
                blueprintPlaceModeRef.current =
                    false;

                blueprintPreviewRef.current =
                    null;

                setBlueprintPlaceMode(
                    false
                );
            }

            if(hadPaste)
            {
                pasteModeRef.current =
                    false;

                duplicateRequestedRef.current =
                    false;

                duplicateModeRef.current =
                    false;

                mirrorDuplicateModeRef.current =
                    false;

                setPasteMode(
                    false
                );

                setDuplicateMode(
                    false
                );
            }

            if(updateStatus)
            {
                setStatus(
                    'Colocación cancelada.'
                );
            }

            return true;
        }, [
            clearPastePreview
        ]);

    useRoomEngineEvent<RoomEngineObjectEvent>(
        RoomEngineObjectEvent.DESELECTED,
        event =>
        {
            if(!activeRef.current)
            {
                return;
            }

            if(
                event.objectId !== -1 ||
                event.category !==
                    RoomObjectCategory.MINIMUM
            )
            {
                return;
            }

            cancelCursorPlacement();
        }
    );


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
                    entry.state,
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



    const clearFillRepeatPreview =
        useCallback(() =>
        {
            ClearBuilderProGhostPreview(
                roomSessionRef.current?.roomId ?? null,
                fillRepeatGhostIdsRef,
                fillRepeatPreviewEntriesRef,
                fillRepeatPreviewFrameRef
            );
        }, []);
    const syncFillRepeatPreview =
        useCallback(() =>
        {
            SyncBuilderProGhostPreview(
                roomSessionRef.current?.roomId ?? null,
                BUILDER_PRO_FILL_REPEAT_GHOST_ID_BASE,
                fillRepeatGhostIdsRef,
                fillRepeatPreviewEntriesRef
            );
        }, []);
    const renderFillRepeatPreview =
        useCallback((
            entries: BuilderProFillRepeatPreviewEntry[]
        ) =>
        {
            RenderBuilderProGhostPreview(
                entries,
                fillRepeatPreviewEntriesRef,
                fillRepeatPreviewFrameRef,
                clearFillRepeatPreview,
                syncFillRepeatPreview
            );
        }, [
            clearFillRepeatPreview,
            syncFillRepeatPreview
        ]);
    const resetFillRepeatPreview =
        useCallback((
            preserveTileArea: boolean = false
        ) =>
        {
            clearFillRepeatPreview();

            fillRepeatContextRef.current =
                null;

            pendingFillRepeatContextRef.current =
                null;

            setFillRepeatPreviewReady(
                false
            );

            if(
                !preserveTileArea &&
                fillAreaOverlayActiveRef.current
            )
            {
                fillAreaOverlayActiveRef.current =
                    false;

                GridEngine.clearTiles(
                    'builder-area'
                );
            }
        }, [
            clearFillRepeatPreview
        ]);


    const finalizeFillRepeatVisuals =
        useCallback((
            repeatedIds: number[],
            mode: number,
            copies: number,
            placedCount: number
        ) =>
        {
            const settle = (
                attempt: number
            ) =>
            {
                if(!activeRef.current)
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    return;
                }

                const currentRoomSession =
                    roomSessionRef.current;

                const roomEngine =
                    GetRoomEngine();

                if(
                    !currentRoomSession ||
                    !roomEngine
                )
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    return;
                }

                const presentIds =
                    repeatedIds.filter(
                        id =>
                            !!roomEngine.getRoomObject(
                                currentRoomSession.roomId,
                                id,
                                RoomObjectCategory.FLOOR
                            )
                    );

                if(
                    presentIds.length ===
                        repeatedIds.length ||
                    attempt >= 120
                )
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    applySelection(
                        presentIds
                    );


                    scheduleOutlinerRevision();

                    requestLayerState(
                        LAYER_OP_LIST
                    );

                    requestTraversalState(
                        TRAVERSAL_OP_QUERY
                    );

                    const label =
                        mode === FILL_REPEAT_MODE_TILE_AREA
                            ? 'Área rellenada'
                            : (
                                mode === FILL_REPEAT_MODE_AREA
                                    ? 'Sala rellenada'
                                    : 'Relleno hasta límite creado'
                            );

                    if(
                        presentIds.length ===
                        repeatedIds.length
                    )
                    {
                        setStatus(
                            `${ label }: ${ copies } módulos · ${ placedCount } furnis nuevos.`
                        );
                    }
                    else
                    {
                        setStatus(
                            `${ label } en servidor, pero Nitro solo sincronizó ${ presentIds.length }/${ repeatedIds.length } furnis.`
                        );
                    }

                    window.requestAnimationFrame(
                        () =>
                        {
                            BuilderProSelectionVisualizer
                                .refresh(
                                    presentIds
                                );
                        }
                    );

                    return;
                }

                window.requestAnimationFrame(
                    () =>
                        settle(
                            attempt + 1
                        )
                );
            };

            settle(
                0
            );
        }, [
            applySelection,
            requestLayerState,
            requestTraversalState
        ]);

    const requestFillRepeat =
        useCallback((
            operation: number,
            context: BuilderProFillRepeatContext
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            if(
                operation !== FILL_REPEAT_OP_PREVIEW &&
                operation !== FILL_REPEAT_OP_EXECUTE
            )
            {
                return;
            }

            if(
                !context ||
                !context.itemIds.length
            )
            {
                setStatus(
                    'Selecciona primero lo que quieres rellenar.'
                );

                return;
            }

            duplicateRequestedRef.current =
                false;

            mirrorDuplicateModeRef.current =
                false;

            duplicateModeRef.current =
                false;

            setDuplicateMode(
                false
            );

            clearPastePreview();

            pasteModeRef.current =
                false;

            setPasteMode(
                false
            );

            blueprintPlaceModeRef.current =
                false;

            setBlueprintPlaceMode(
                false
            );

            replacePickModeRef.current =
                false;

            setReplacePickMode(
                false
            );

            if(operation === FILL_REPEAT_OP_PREVIEW)
            {
                resetFillRepeatPreview(
                    context.mode ===
                        FILL_REPEAT_MODE_TILE_AREA
                );
            }
            else
            {
                clearFillRepeatPreview();

                setFillRepeatPreviewReady(
                    false
                );
            }

            requestIdRef.current++;

            if(requestIdRef.current > 2000000000)
            {
                requestIdRef.current = 1;
            }

            const requestId =
                requestIdRef.current;

            pendingRef.current =
                true;

            pendingRequestIdRef.current =
                requestId;

            pendingStartedAtRef.current =
                performance.now();

            pendingFillRepeatOperationRef.current =
                operation;

            pendingFillRepeatContextRef.current = {
                itemIds: [
                    ...context.itemIds
                ],
                mode:
                    context.mode,
                direction:
                    context.direction,
                spacing:
                    context.spacing,
                area:
                    context.area
                        ? {
                            ...context.area,
                            start: {
                                ...context.area.start
                            },
                            end: {
                                ...context.area.end
                            }
                        }
                        : null
            };

            if(operation === FILL_REPEAT_OP_EXECUTE)
            {
                suppressPasteLayerAutoAssignRef.current =
                    true;
            }

            setPending(
                true
            );

            const isRoomFill =
                context.mode ===
                    FILL_REPEAT_MODE_AREA;

            const isTileAreaFill =
                context.mode ===
                    FILL_REPEAT_MODE_TILE_AREA;

            setStatus(
                operation === FILL_REPEAT_OP_PREVIEW
                    ? (
                        isTileAreaFill
                            ? 'Calculando Fill Area...'
                            : (
                                isRoomFill
                                    ? 'Calculando relleno de sala...'
                                    : 'Calculando relleno hasta el límite...'
                            )
                    )
                    : (
                        isTileAreaFill
                            ? 'Rellenando área seleccionada...'
                            : (
                                isRoomFill
                                    ? 'Rellenando sala...'
                                    : 'Rellenando hasta el límite...'
                            )
                    )
            );

            try
            {
                SendMessageComposer(
                    new BuilderProFillRepeatComposer(
                        context.itemIds,
                        operation,
                        context.mode,
                        context.direction,
                        context.spacing,
                        requestId,
                        context.area?.minX ?? 0,
                        context.area?.minY ?? 0,
                        context.area?.maxX ?? 0,
                        context.area?.maxY ?? 0
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

                            if(
                                !pendingRef.current ||
                                pendingRequestIdRef.current !==
                                    requestId ||
                                pendingFillRepeatOperationRef.current !==
                                    operation
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

                            pendingFillRepeatOperationRef.current =
                                null;

                            pendingFillRepeatContextRef.current =
                                null;

                            suppressPasteLayerAutoAssignRef.current =
                                false;

                            setPending(
                                false
                            );

                            if(
                                context.mode ===
                                    FILL_REPEAT_MODE_TILE_AREA
                            )
                            {
                                fillAreaOverlayActiveRef.current =
                                    false;

                                GridEngine.clearTiles(
                                    'builder-area'
                                );
                            }

                            setStatus(
                                'Relleno sin confirmación del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT FILL_REPEAT_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current =
                    false;

                pendingRequestIdRef.current =
                    null;

                pendingStartedAtRef.current =
                    0;

                pendingFillRepeatOperationRef.current =
                    null;

                pendingFillRepeatContextRef.current =
                    null;

                suppressPasteLayerAutoAssignRef.current =
                    false;

                setPending(
                    false
                );

                if(
                    context.mode ===
                        FILL_REPEAT_MODE_TILE_AREA
                )
                {
                    fillAreaOverlayActiveRef.current =
                        false;

                    GridEngine.clearTiles(
                        'builder-area'
                    );
                }

                setStatus(
                    'No se pudo enviar el relleno al servidor.'
                );
            }
        }, [
            clearFillRepeatPreview,
            clearPastePreview,
            resetFillRepeatPreview
        ]);

    requestFillRepeatRef.current =
        requestFillRepeat;

    const clearOtherRepeatPreviewsForFill =
        useCallback(() =>
        {
            const currentRoomSession =
                roomSessionRef.current;

            const roomEngine =
                GetRoomEngine();

            const clearGhostSet = (
                ids: number[]
            ) =>
            {
                if(currentRoomSession && roomEngine)
                {
                    for(const id of ids)
                    {
                        roomEngine.removeRoomObjectFloor(
                            currentRoomSession.roomId,
                            id
                        );
                    }
                }
            };

            if(linearRepeatPreviewFrameRef.current !== null)
            {
                window.cancelAnimationFrame(
                    linearRepeatPreviewFrameRef.current
                );
                linearRepeatPreviewFrameRef.current =
                    null;
            }

            if(gridRepeatPreviewFrameRef.current !== null)
            {
                window.cancelAnimationFrame(
                    gridRepeatPreviewFrameRef.current
                );
                gridRepeatPreviewFrameRef.current =
                    null;
            }

            if(radialRepeatPreviewFrameRef.current !== null)
            {
                window.cancelAnimationFrame(
                    radialRepeatPreviewFrameRef.current
                );
                radialRepeatPreviewFrameRef.current =
                    null;
            }

            clearGhostSet(
                linearRepeatGhostIdsRef.current
            );

            clearGhostSet(
                gridRepeatGhostIdsRef.current
            );

            clearGhostSet(
                radialRepeatGhostIdsRef.current
            );

            linearRepeatGhostIdsRef.current = [];
            gridRepeatGhostIdsRef.current = [];
            radialRepeatGhostIdsRef.current = [];

            linearRepeatPreviewEntriesRef.current = [];
            gridRepeatPreviewEntriesRef.current = [];
            radialRepeatPreviewEntriesRef.current = [];

            linearRepeatContextRef.current = null;
            gridRepeatContextRef.current = null;
            radialRepeatContextRef.current = null;

            setLinearRepeatPreviewReady(false);
            setGridRepeatPreviewReady(false);
            setRadialRepeatPreviewReady(false);
        }, []);

    const startFillRepeatPreview =
        useCallback((
            mode: number,
            direction: number
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

            const spacing =
                Number.parseInt(
                    fillRepeatSpacing,
                    10
                );

            if(
                !Number.isSafeInteger(spacing) ||
                spacing < 0 ||
                spacing > 50
            )
            {
                setStatus(
                    'La separación debe estar entre 0 y 50.'
                );

                return;
            }

            if(
                mode !== FILL_REPEAT_MODE_LINE &&
                mode !== FILL_REPEAT_MODE_AREA
            )
            {
                return;
            }

            if(
                mode === FILL_REPEAT_MODE_LINE &&
                (
                    direction < FILL_REPEAT_DIRECTION_LEFT ||
                    direction > FILL_REPEAT_DIRECTION_DOWN
                )
            )
            {
                return;
            }

            clearOtherRepeatPreviewsForFill();

            setFillRepeatMode(
                mode
            );

            setFillRepeatDirection(
                direction
            );

            requestFillRepeat(
                FILL_REPEAT_OP_PREVIEW,
                {
                    itemIds: ids,
                    mode,
                    direction,
                    spacing,
                    area: null
                }
            );
        }, [
            fillRepeatSpacing,
            clearOtherRepeatPreviewsForFill,
            requestFillRepeat
        ]);

    const startFillAreaPick =
        useCallback(() =>
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

            const spacing =
                Number.parseInt(
                    fillRepeatSpacing,
                    10
                );

            if(
                !Number.isSafeInteger(spacing) ||
                spacing < 0 ||
                spacing > 50
            )
            {
                setStatus(
                    'La separación debe estar entre 0 y 50.'
                );

                return;
            }

            clearOtherRepeatPreviewsForFill();
            resetFillRepeatPreview();

            if(areaModeRef.current)
            {
                areaModeRef.current =
                    false;

                setAreaMode(
                    false
                );
            }

            areaStartRef.current =
                null;

            GridEngine.clearTiles(
                'builder-area'
            );

            fillAreaOverlayActiveRef.current =
                false;

            fillAreaDraftContextRef.current = {
                itemIds: [
                    ...ids
                ],
                spacing
            };

            fillAreaPickModeRef.current =
                true;

            setFillAreaPickMode(
                true
            );

            setFillRepeatMode(
                FILL_REPEAT_MODE_TILE_AREA
            );

            setFillRepeatDirection(
                0
            );

            suppressAreaClickRef.current =
                false;

            setBuilderProRoomDraggingLocked(
                true
            );

            setStatus(
                'Rellenar área: arrastra sobre las casillas que quieres rellenar. Esc para cancelar.'
            );
        }, [
            fillRepeatSpacing,
            clearOtherRepeatPreviewsForFill,
            resetFillRepeatPreview
        ]);

    const confirmFillRepeat =
        useCallback(() =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            const context =
                fillRepeatContextRef.current;

            if(
                !context ||
                !fillRepeatPreviewReady
            )
            {
                setStatus(
                    'Genera primero una vista previa válida.'
                );

                return;
            }

            requestFillRepeat(
                FILL_REPEAT_OP_EXECUTE,
                context
            );
        }, [
            fillRepeatPreviewReady,
            requestFillRepeat
        ]);

    useMessageEvent<BuilderProFillRepeatResultEvent>(
        BuilderProFillRepeatResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            const requestId =
                parser.requestId;

            if(
                pendingRequestIdRef.current !==
                    requestId ||
                !pendingRef.current
            )
            {
                return;
            }

            const expectedOperation =
                pendingFillRepeatOperationRef.current;

            const context =
                pendingFillRepeatContextRef.current;

            if(
                expectedOperation === null ||
                parser.operation !==
                    expectedOperation
            )
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

            pendingRef.current =
                false;

            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            pendingFillRepeatOperationRef.current =
                null;

            pendingFillRepeatContextRef.current =
                null;

            setPending(
                false
            );

            setCanUndo(parser.canUndo);
            setCanRedo(parser.canRedo);

            if(!parser.success)
            {
                suppressPasteLayerAutoAssignRef.current =
                    false;

                if(expectedOperation ===
                    FILL_REPEAT_OP_PREVIEW)
                {
                    resetFillRepeatPreview();
                }

                setStatus(
                    formatBuilderProServerFailure(parser.code, parser.message)
                );

                return;
            }

            if(!context)
            {
                suppressPasteLayerAutoAssignRef.current =
                    false;

                resetFillRepeatPreview();

                setStatus(
                    'El contexto del relleno ya no está disponible.'
                );

                return;
            }

            if(expectedOperation ===
                FILL_REPEAT_OP_PREVIEW)
            {
                const entries =
                    parser.previewEntries;

                if(
                    entries.length < 1 ||
                    parser.copies < 1
                )
                {
                    resetFillRepeatPreview();

                    setStatus(
                        'El servidor no encontró posiciones nuevas para rellenar.'
                    );

                    return;
                }

                fillRepeatContextRef.current = {
                    itemIds: [
                        ...context.itemIds
                    ],
                    mode:
                        context.mode,
                    direction:
                        context.direction,
                    spacing:
                        context.spacing,
                    area:
                        context.area
                            ? {
                                ...context.area,
                                start: {
                                    ...context.area.start
                                },
                                end: {
                                    ...context.area.end
                                }
                            }
                            : null
                };

                renderFillRepeatPreview(
                    entries
                );

                setFillRepeatMode(
                    context.mode
                );

                setFillRepeatDirection(
                    context.direction
                );

                setFillRepeatPreviewReady(
                    true
                );

                setStatus(
                    context.mode === FILL_REPEAT_MODE_TILE_AREA
                        ? `Vista previa Fill Area: ${ parser.copies } módulos válidos · ${ entries.length } furnis nuevos.`
                        : (
                            context.mode === FILL_REPEAT_MODE_AREA
                                ? `Vista previa de sala: ${ parser.copies } módulos válidos · ${ entries.length } furnis nuevos.`
                                : `Vista previa hasta límite: ${ parser.copies } módulos · ${ entries.length } furnis nuevos.`
                        )
                );

                return;
            }

            const repeatedIds =
                parser.itemIds;

            const copies =
                parser.copies;

            const placedCount =
                parser.placedCount;

            clearFillRepeatPreview();

            fillRepeatContextRef.current =
                null;

            setFillRepeatPreviewReady(
                false
            );

            if(
                context.mode ===
                    FILL_REPEAT_MODE_TILE_AREA
            )
            {
                fillAreaOverlayActiveRef.current =
                    false;

                GridEngine.clearTiles(
                    'builder-area'
                );
            }

            finalizeFillRepeatVisuals(
                repeatedIds,
                context.mode,
                copies,
                placedCount
            );
        }
    );

    useEffect(() =>
    {
        if(active)
        {
            return;
        }

        resetFillRepeatPreview();
    }, [
        active,
        resetFillRepeatPreview
    ]);


    useEffect(() =>
    {
        if(active) return;

        fillAreaPickModeRef.current =
            false;

        fillAreaDraftContextRef.current =
            null;

        fillAreaOverlayActiveRef.current =
            false;

        setFillAreaPickMode(
            false
        );

        GridEngine.clearTiles(
            'builder-area'
        );

        setBuilderProRoomDraggingLocked(
            false
        );
    }, [ active ]);

    const clearLinearRepeatPreview = useCallback(() =>
    {
        ClearBuilderProGhostPreview(
            roomSessionRef.current?.roomId ?? null,
            linearRepeatGhostIdsRef,
            linearRepeatPreviewEntriesRef,
            linearRepeatPreviewFrameRef
        );
    }, []);
    const syncLinearRepeatPreview = useCallback(() =>
    {
        SyncBuilderProGhostPreview(
            roomSessionRef.current?.roomId ?? null,
            BUILDER_PRO_LINEAR_REPEAT_GHOST_ID_BASE,
            linearRepeatGhostIdsRef,
            linearRepeatPreviewEntriesRef
        );
    }, []);
    const renderLinearRepeatPreview =
        useCallback((
            entries: BuilderProLinearRepeatPreviewEntry[]
        ) =>
        {
            RenderBuilderProGhostPreview(
                entries,
                linearRepeatPreviewEntriesRef,
                linearRepeatPreviewFrameRef,
                clearLinearRepeatPreview,
                syncLinearRepeatPreview
            );
        }, [
            clearLinearRepeatPreview,
            syncLinearRepeatPreview
        ]);
    const resetLinearRepeatPreview =
        useCallback((
            clearDirection: boolean = true
        ) =>
        {
            clearLinearRepeatPreview();

            linearRepeatContextRef.current =
                null;

            pendingLinearRepeatContextRef.current =
                null;

            setLinearRepeatPreviewReady(
                false
            );

            if(clearDirection)
            {
                setLinearRepeatDirection(
                    0
                );
            }
        }, [
            clearLinearRepeatPreview
        ]);


    const finalizeLinearRepeatVisuals =
        useCallback((
            repeatedIds: number[],
            copies: number,
            placedCount: number
        ) =>
        {
            const settle = (
                attempt: number
            ) =>
            {
                if(!activeRef.current)
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    return;
                }

                const currentRoomSession =
                    roomSessionRef.current;

                const roomEngine =
                    GetRoomEngine();

                if(
                    !currentRoomSession ||
                    !roomEngine
                )
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    return;
                }

                const presentIds =
                    repeatedIds.filter(
                        id =>
                            !!roomEngine.getRoomObject(
                                currentRoomSession.roomId,
                                id,
                                RoomObjectCategory.FLOOR
                            )
                    );

                if(
                    presentIds.length ===
                        repeatedIds.length ||
                    attempt >= 45
                )
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    applySelection(
                        presentIds
                    );

                    setCanUndo(
                        true
                    );

                    setCanRedo(
                        false
                    );

                    scheduleOutlinerRevision();

                    requestLayerState(
                        LAYER_OP_LIST
                    );

                    requestTraversalState(
                        TRAVERSAL_OP_QUERY
                    );

                    if(
                        presentIds.length ===
                        repeatedIds.length
                    )
                    {
                        setStatus(
                            `Repetición creada: ${ copies } copias · ${ placedCount } furnis.`
                        );
                    }
                    else
                    {
                        setStatus(
                            `Repetición creada en servidor, pero Nitro solo sincronizó ${ presentIds.length }/${ repeatedIds.length } furnis.`
                        );
                    }

                    window.requestAnimationFrame(
                        () =>
                        {
                            BuilderProSelectionVisualizer
                                .refresh(
                                    presentIds
                                );
                        }
                    );

                    return;
                }

                window.requestAnimationFrame(
                    () =>
                        settle(
                            attempt + 1
                        )
                );
            };

            settle(
                0
            );
        }, [
            applySelection,
            requestLayerState,
            requestTraversalState
        ]);

    const requestLinearRepeat =
        useCallback((
            operation: number,
            context: BuilderProLinearRepeatContext
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            resetFillRepeatPreview();

            if(
                operation !== LINEAR_REPEAT_OP_PREVIEW &&
                operation !== LINEAR_REPEAT_OP_EXECUTE
            )
            {
                return;
            }

            if(
                !context ||
                !context.itemIds.length
            )
            {
                setStatus(
                    'Selecciona primero lo que quieres repetir.'
                );

                return;
            }

            duplicateRequestedRef.current =
                false;

            mirrorDuplicateModeRef.current =
                false;

            duplicateModeRef.current =
                false;

            setDuplicateMode(
                false
            );

            clearPastePreview();

            pasteModeRef.current =
                false;

            setPasteMode(
                false
            );

            blueprintPlaceModeRef.current =
                false;

            setBlueprintPlaceMode(
                false
            );

            replacePickModeRef.current =
                false;

            setReplacePickMode(
                false
            );

            if(operation === LINEAR_REPEAT_OP_PREVIEW)
            {
                resetLinearRepeatPreview(
                    false
                );
            }
            else
            {
                clearLinearRepeatPreview();

                setLinearRepeatPreviewReady(
                    false
                );
            }

            requestIdRef.current++;

            if(requestIdRef.current > 2000000000)
            {
                requestIdRef.current = 1;
            }

            const requestId =
                requestIdRef.current;

            pendingRef.current =
                true;

            pendingRequestIdRef.current =
                requestId;

            pendingStartedAtRef.current =
                performance.now();

            pendingLinearRepeatOperationRef.current =
                operation;

            pendingLinearRepeatContextRef.current = {
                itemIds: [
                    ...context.itemIds
                ],
                direction:
                    context.direction,
                copies:
                    context.copies,
                spacing:
                    context.spacing
            };

            if(operation === LINEAR_REPEAT_OP_EXECUTE)
            {
                suppressPasteLayerAutoAssignRef.current =
                    true;
            }

            setPending(
                true
            );

            setStatus(
                operation === LINEAR_REPEAT_OP_PREVIEW
                    ? 'Preparando vista previa de la repetición...'
                    : 'Creando repetición lineal...'
            );

            try
            {
                SendMessageComposer(
                    new BuilderProLinearRepeatComposer(
                        context.itemIds,
                        operation,
                        context.direction,
                        context.copies,
                        context.spacing,
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

                            if(
                                !pendingRef.current ||
                                pendingRequestIdRef.current !==
                                    requestId ||
                                pendingLinearRepeatOperationRef.current !==
                                    operation
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

                            pendingLinearRepeatOperationRef.current =
                                null;

                            pendingLinearRepeatContextRef.current =
                                null;

                            suppressPasteLayerAutoAssignRef.current =
                                false;

                            setPending(
                                false
                            );

                            setStatus(
                                'Repetición sin confirmación del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT LINEAR_REPEAT_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current =
                    false;

                pendingRequestIdRef.current =
                    null;

                pendingStartedAtRef.current =
                    0;

                pendingLinearRepeatOperationRef.current =
                    null;

                pendingLinearRepeatContextRef.current =
                    null;

                suppressPasteLayerAutoAssignRef.current =
                    false;

                setPending(
                    false
                );

                setStatus(
                    'No se pudo enviar la repetición al servidor.'
                );
            }
        }, [
            clearLinearRepeatPreview,
            clearPastePreview,
            resetLinearRepeatPreview
        ]);

    const startLinearRepeatPreview =
        useCallback((
            direction: number
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
                    'Selecciona primero lo que quieres repetir.'
                );

                return;
            }

            const copies =
                Number.parseInt(
                    linearRepeatCopies,
                    10
                );

            const spacing =
                Number.parseInt(
                    linearRepeatSpacing,
                    10
                );

            if(
                !Number.isInteger(copies) ||
                copies < 1 ||
                copies > 100
            )
            {
                setStatus(
                    'Copias debe estar entre 1 y 100.'
                );

                return;
            }

            if(
                !Number.isInteger(spacing) ||
                spacing < 0 ||
                spacing > 50
            )
            {
                setStatus(
                    'Separación debe estar entre 0 y 50.'
                );

                return;
            }

            const total =
                ids.length * copies;

            if(total > MAX_SELECTION)
            {
                setStatus(
                    `La repetición generaría ${ total } furnis; el límite actual es ${ MAX_SELECTION }.`
                );

                return;
            }

            setLinearRepeatDirection(
                direction
            );

            requestLinearRepeat(
                LINEAR_REPEAT_OP_PREVIEW,
                {
                    itemIds: ids,
                    direction,
                    copies,
                    spacing
                }
            );
        }, [
            linearRepeatCopies,
            linearRepeatSpacing,
            requestLinearRepeat
        ]);

    const confirmLinearRepeat =
        useCallback(() =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            const context =
                linearRepeatContextRef.current;

            if(
                !context ||
                !linearRepeatPreviewReady
            )
            {
                setStatus(
                    'Genera primero una vista previa válida.'
                );

                return;
            }

            requestLinearRepeat(
                LINEAR_REPEAT_OP_EXECUTE,
                context
            );
        }, [
            linearRepeatPreviewReady,
            requestLinearRepeat
        ]);

    useMessageEvent<BuilderProLinearRepeatResultEvent>(
        BuilderProLinearRepeatResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            const requestId =
                parser.requestId;

            if(
                pendingRequestIdRef.current !==
                    requestId ||
                !pendingRef.current
            )
            {
                return;
            }

            const expectedOperation =
                pendingLinearRepeatOperationRef.current;

            const context =
                pendingLinearRepeatContextRef.current;

            if(
                expectedOperation === null ||
                parser.operation !==
                    expectedOperation
            )
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

            pendingRef.current =
                false;

            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            pendingLinearRepeatOperationRef.current =
                null;

            pendingLinearRepeatContextRef.current =
                null;

            setPending(
                false
            );

            if(!parser.success)
            {
                suppressPasteLayerAutoAssignRef.current =
                    false;

                if(
                    expectedOperation ===
                    LINEAR_REPEAT_OP_PREVIEW
                )
                {
                    resetLinearRepeatPreview(
                        false
                    );
                }

                setStatus(
                    formatBuilderProServerFailure(parser.code, parser.message)
                );

                return;
            }

            if(
                expectedOperation ===
                LINEAR_REPEAT_OP_PREVIEW
            )
            {
                if(!context)
                {
                    resetLinearRepeatPreview();

                    setStatus(
                        'La vista previa perdió su contexto.'
                    );

                    return;
                }

                const entries =
                    parser.previewEntries;

                const expectedCount =
                    context.itemIds.length
                        * context.copies;

                if(entries.length !== expectedCount)
                {
                    resetLinearRepeatPreview();

                    setStatus(
                        'La vista previa no coincide con la repetición solicitada.'
                    );

                    return;
                }

                linearRepeatContextRef.current = {
                    itemIds: [
                        ...context.itemIds
                    ],
                    direction:
                        context.direction,
                    copies:
                        context.copies,
                    spacing:
                        context.spacing
                };

                setLinearRepeatDirection(
                    context.direction
                );

                setLinearRepeatPreviewReady(
                    true
                );

                renderLinearRepeatPreview(
                    entries
                );

                setStatus(
                    `Vista previa: ${ context.copies } copias · ${ entries.length } furnis.`
                );

                return;
            }

            resetLinearRepeatPreview();

            finalizeLinearRepeatVisuals(
                parser.itemIds,
                parser.copies,
                parser.placedCount
            );
        }
    );

    useEffect(() =>
    {
        if(active) return;

        resetLinearRepeatPreview();

        pendingLinearRepeatOperationRef.current =
            null;

        pendingLinearRepeatContextRef.current =
            null;
    }, [
        active,
        resetLinearRepeatPreview
    ]);


    useEffect(() =>
    {
        return () =>
        {
            clearLinearRepeatPreview();
        };
    }, [
        clearLinearRepeatPreview
    ]);

    useEffect(() =>
    {
        const context =
            linearRepeatContextRef.current;

        if(!context)
        {
            return;
        }

        if(
            context.itemIds.length !==
                selectedIds.length ||
            context.itemIds.some(
                (id, index) =>
                    id !== selectedIds[index]
            )
        )
        {
            resetLinearRepeatPreview();
        }
    }, [
        selectedIds,
        resetLinearRepeatPreview
    ]);


    const clearGridRepeatPreview = useCallback(() =>
    {
        ClearBuilderProGhostPreview(
            roomSessionRef.current?.roomId ?? null,
            gridRepeatGhostIdsRef,
            gridRepeatPreviewEntriesRef,
            gridRepeatPreviewFrameRef
        );
    }, []);
    const syncGridRepeatPreview = useCallback(() =>
    {
        SyncBuilderProGhostPreview(
            roomSessionRef.current?.roomId ?? null,
            BUILDER_PRO_GRID_REPEAT_GHOST_ID_BASE,
            gridRepeatGhostIdsRef,
            gridRepeatPreviewEntriesRef
        );
    }, []);
    const renderGridRepeatPreview =
        useCallback((
            entries: BuilderProGridRepeatPreviewEntry[]
        ) =>
        {
            RenderBuilderProGhostPreview(
                entries,
                gridRepeatPreviewEntriesRef,
                gridRepeatPreviewFrameRef,
                clearGridRepeatPreview,
                syncGridRepeatPreview
            );
        }, [
            clearGridRepeatPreview,
            syncGridRepeatPreview
        ]);
    const resetGridRepeatPreview =
        useCallback(() =>
        {
            clearGridRepeatPreview();

            gridRepeatContextRef.current =
                null;

            pendingGridRepeatContextRef.current =
                null;

            setGridRepeatPreviewReady(
                false
            );
        }, [
            clearGridRepeatPreview
        ]);

    const finalizeGridRepeatVisuals =
        useCallback((
            repeatedIds: number[],
            columns: number,
            rows: number,
            placedCount: number
        ) =>
        {
            const settle = (
                attempt: number
            ) =>
            {
                if(!activeRef.current)
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    return;
                }

                const currentRoomSession =
                    roomSessionRef.current;

                const roomEngine =
                    GetRoomEngine();

                if(
                    !currentRoomSession ||
                    !roomEngine
                )
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    return;
                }

                const presentIds =
                    repeatedIds.filter(
                        id =>
                            !!roomEngine.getRoomObject(
                                currentRoomSession.roomId,
                                id,
                                RoomObjectCategory.FLOOR
                            )
                    );

                if(
                    presentIds.length ===
                        repeatedIds.length ||
                    attempt >= 45
                )
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    applySelection(
                        presentIds
                    );

                    setCanUndo(
                        true
                    );

                    setCanRedo(
                        false
                    );

                    scheduleOutlinerRevision();

                    requestLayerState(
                        LAYER_OP_LIST
                    );

                    requestTraversalState(
                        TRAVERSAL_OP_QUERY
                    );

                    if(
                        presentIds.length ===
                        repeatedIds.length
                    )
                    {
                        setStatus(
                            `Cuadrícula creada: ${ columns } × ${ rows } · ${ placedCount } furnis nuevos.`
                        );
                    }
                    else
                    {
                        setStatus(
                            `Cuadrícula creada en servidor, pero Nitro solo sincronizó ${ presentIds.length }/${ repeatedIds.length } furnis.`
                        );
                    }

                    window.requestAnimationFrame(
                        () =>
                        {
                            BuilderProSelectionVisualizer
                                .refresh(
                                    presentIds
                                );
                        }
                    );

                    return;
                }

                window.requestAnimationFrame(
                    () =>
                        settle(
                            attempt + 1
                        )
                );
            };

            settle(
                0
            );
        }, [
            applySelection,
            requestLayerState,
            requestTraversalState
        ]);

    const requestGridRepeat =
        useCallback((
            operation: number,
            context: BuilderProGridRepeatContext
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            resetFillRepeatPreview();

            if(
                operation !== GRID_REPEAT_OP_PREVIEW &&
                operation !== GRID_REPEAT_OP_EXECUTE
            )
            {
                return;
            }

            if(
                !context ||
                !context.itemIds.length
            )
            {
                setStatus(
                    'Selecciona primero lo que quieres repetir.'
                );

                return;
            }

            duplicateRequestedRef.current =
                false;

            mirrorDuplicateModeRef.current =
                false;

            duplicateModeRef.current =
                false;

            setDuplicateMode(
                false
            );

            clearPastePreview();

            pasteModeRef.current =
                false;

            setPasteMode(
                false
            );

            blueprintPlaceModeRef.current =
                false;

            setBlueprintPlaceMode(
                false
            );

            replacePickModeRef.current =
                false;

            setReplacePickMode(
                false
            );

            if(operation === GRID_REPEAT_OP_PREVIEW)
            {
                resetGridRepeatPreview();
            }
            else
            {
                clearGridRepeatPreview();

                setGridRepeatPreviewReady(
                    false
                );
            }

            requestIdRef.current++;

            if(requestIdRef.current > 2000000000)
            {
                requestIdRef.current = 1;
            }

            const requestId =
                requestIdRef.current;

            pendingRef.current =
                true;

            pendingRequestIdRef.current =
                requestId;

            pendingStartedAtRef.current =
                performance.now();

            pendingGridRepeatOperationRef.current =
                operation;

            pendingGridRepeatContextRef.current = {
                itemIds: [
                    ...context.itemIds
                ],
                columns:
                    context.columns,
                rows:
                    context.rows,
                spacingX:
                    context.spacingX,
                spacingY:
                    context.spacingY
            };

            if(operation === GRID_REPEAT_OP_EXECUTE)
            {
                suppressPasteLayerAutoAssignRef.current =
                    true;
            }

            setPending(
                true
            );

            setStatus(
                operation === GRID_REPEAT_OP_PREVIEW
                    ? 'Preparando vista previa de la cuadrícula...'
                    : 'Creando cuadrícula...'
            );

            try
            {
                SendMessageComposer(
                    new BuilderProGridRepeatComposer(
                        context.itemIds,
                        operation,
                        context.columns,
                        context.rows,
                        context.spacingX,
                        context.spacingY,
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

                            if(
                                !pendingRef.current ||
                                pendingRequestIdRef.current !==
                                    requestId ||
                                pendingGridRepeatOperationRef.current !==
                                    operation
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

                            pendingGridRepeatOperationRef.current =
                                null;

                            pendingGridRepeatContextRef.current =
                                null;

                            suppressPasteLayerAutoAssignRef.current =
                                false;

                            setPending(
                                false
                            );

                            setStatus(
                                'Cuadrícula sin confirmación del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT GRID_REPEAT_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current =
                    false;

                pendingRequestIdRef.current =
                    null;

                pendingStartedAtRef.current =
                    0;

                pendingGridRepeatOperationRef.current =
                    null;

                pendingGridRepeatContextRef.current =
                    null;

                suppressPasteLayerAutoAssignRef.current =
                    false;

                setPending(
                    false
                );

                setStatus(
                    'No se pudo enviar la cuadrícula al servidor.'
                );
            }
        }, [
            clearGridRepeatPreview,
            clearPastePreview,
            resetGridRepeatPreview
        ]);

    const startGridRepeatPreview =
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

            const columns =
                Number.parseInt(
                    gridRepeatColumns,
                    10
                );

            const rows =
                Number.parseInt(
                    gridRepeatRows,
                    10
                );

            const spacingX =
                Number.parseInt(
                    gridRepeatSpacingX,
                    10
                );

            const spacingY =
                Number.parseInt(
                    gridRepeatSpacingY,
                    10
                );

            if(
                !Number.isSafeInteger(columns) ||
                columns < 1 ||
                columns > 100 ||
                !Number.isSafeInteger(rows) ||
                rows < 1 ||
                rows > 100
            )
            {
                setStatus(
                    'Filas y columnas deben estar entre 1 y 100.'
                );

                return;
            }

            const copies =
                (
                    columns *
                    rows
                ) -
                1;

            if(copies < 1)
            {
                setStatus(
                    'La cuadrícula debe ser mayor que 1 × 1.'
                );

                return;
            }

            if(
                !Number.isSafeInteger(spacingX) ||
                spacingX < 0 ||
                spacingX > 50 ||
                !Number.isSafeInteger(spacingY) ||
                spacingY < 0 ||
                spacingY > 50
            )
            {
                setStatus(
                    'Las separaciones deben estar entre 0 y 50.'
                );

                return;
            }

            const total =
                ids.length *
                copies;

            if(total > MAX_SELECTION)
            {
                setStatus(
                    `La cuadrícula generaría ${ total } furnis; el límite actual es ${ MAX_SELECTION }.`
                );

                return;
            }

            requestGridRepeat(
                GRID_REPEAT_OP_PREVIEW,
                {
                    itemIds: ids,
                    columns,
                    rows,
                    spacingX,
                    spacingY
                }
            );
        }, [
            gridRepeatColumns,
            gridRepeatRows,
            gridRepeatSpacingX,
            gridRepeatSpacingY,
            requestGridRepeat
        ]);

    const confirmGridRepeat =
        useCallback(() =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            const context =
                gridRepeatContextRef.current;

            if(
                !context ||
                !gridRepeatPreviewReady
            )
            {
                setStatus(
                    'Genera primero una vista previa válida.'
                );

                return;
            }

            requestGridRepeat(
                GRID_REPEAT_OP_EXECUTE,
                context
            );
        }, [
            gridRepeatPreviewReady,
            requestGridRepeat
        ]);

    useMessageEvent<BuilderProGridRepeatResultEvent>(
        BuilderProGridRepeatResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            const requestId =
                parser.requestId;

            if(
                pendingRequestIdRef.current !==
                    requestId ||
                !pendingRef.current
            )
            {
                return;
            }

            const expectedOperation =
                pendingGridRepeatOperationRef.current;

            const context =
                pendingGridRepeatContextRef.current;

            if(
                expectedOperation === null ||
                parser.operation !==
                    expectedOperation
            )
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

            pendingRef.current =
                false;

            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            pendingGridRepeatOperationRef.current =
                null;

            pendingGridRepeatContextRef.current =
                null;

            setPending(
                false
            );

            if(!parser.success)
            {
                suppressPasteLayerAutoAssignRef.current =
                    false;

                if(
                    expectedOperation ===
                    GRID_REPEAT_OP_PREVIEW
                )
                {
                    resetGridRepeatPreview();
                }

                setStatus(
                    formatBuilderProServerFailure(parser.code, parser.message)
                );

                return;
            }

            if(
                expectedOperation ===
                GRID_REPEAT_OP_PREVIEW
            )
            {
                if(!context)
                {
                    resetGridRepeatPreview();

                    setStatus(
                        'La vista previa perdió su contexto.'
                    );

                    return;
                }

                const entries =
                    parser.previewEntries;

                const expectedCount =
                    context.itemIds.length *
                    (
                        (
                            context.columns *
                            context.rows
                        ) -
                        1
                    );

                if(
                    parser.columns !==
                        context.columns ||
                    parser.rows !==
                        context.rows ||
                    entries.length !==
                        expectedCount
                )
                {
                    resetGridRepeatPreview();

                    setStatus(
                        'La vista previa no coincide con la cuadrícula solicitada.'
                    );

                    return;
                }

                gridRepeatContextRef.current = {
                    itemIds: [
                        ...context.itemIds
                    ],
                    columns:
                        context.columns,
                    rows:
                        context.rows,
                    spacingX:
                        context.spacingX,
                    spacingY:
                        context.spacingY
                };

                setGridRepeatPreviewReady(
                    true
                );

                renderGridRepeatPreview(
                    entries
                );

                const copies =
                    (
                        context.columns *
                        context.rows
                    ) -
                    1;

                setStatus(
                    `Vista previa: ${ context.columns } × ${ context.rows } · ${ copies } copias · ${ entries.length } furnis.`
                );

                return;
            }

            resetGridRepeatPreview();

            finalizeGridRepeatVisuals(
                parser.itemIds,
                parser.columns,
                parser.rows,
                parser.placedCount
            );
        }
    );

    useEffect(() =>
    {
        if(active) return;

        resetGridRepeatPreview();

        pendingGridRepeatOperationRef.current =
            null;

        pendingGridRepeatContextRef.current =
            null;
    }, [
        active,
        resetGridRepeatPreview
    ]);

    useEffect(() =>
    {
        return () =>
        {
            clearGridRepeatPreview();
        };
    }, [
        clearGridRepeatPreview
    ]);

    useEffect(() =>
    {
        const context =
            gridRepeatContextRef.current;

        if(!context)
        {
            return;
        }

        if(
            context.itemIds.length !==
                selectedIds.length ||
            context.itemIds.some(
                (id, index) =>
                    id !== selectedIds[index]
            )
        )
        {
            resetGridRepeatPreview();
        }
    }, [
        selectedIds,
        resetGridRepeatPreview
    ]);


    const clearRadialRepeatPreview = useCallback(() =>
    {
        ClearBuilderProGhostPreview(
            roomSessionRef.current?.roomId ?? null,
            radialRepeatGhostIdsRef,
            radialRepeatPreviewEntriesRef,
            radialRepeatPreviewFrameRef
        );
    }, []);
    const syncRadialRepeatPreview = useCallback(() =>
    {
        SyncBuilderProGhostPreview(
            roomSessionRef.current?.roomId ?? null,
            BUILDER_PRO_RADIAL_REPEAT_GHOST_ID_BASE,
            radialRepeatGhostIdsRef,
            radialRepeatPreviewEntriesRef
        );
    }, []);
    const renderRadialRepeatPreview =
        useCallback((
            entries: BuilderProRadialRepeatPreviewEntry[]
        ) =>
        {
            RenderBuilderProGhostPreview(
                entries,
                radialRepeatPreviewEntriesRef,
                radialRepeatPreviewFrameRef,
                clearRadialRepeatPreview,
                syncRadialRepeatPreview
            );
        }, [
            clearRadialRepeatPreview,
            syncRadialRepeatPreview
        ]);
    const resetRadialRepeatPreview =
        useCallback(() =>
        {
            clearRadialRepeatPreview();

            radialRepeatContextRef.current =
                null;

            pendingRadialRepeatContextRef.current =
                null;

            setRadialRepeatPreviewReady(
                false
            );
        }, [
            clearRadialRepeatPreview
        ]);

    invalidateRepeatPreviewsForRoomMutationRef.current =
        () =>
        {
            /*
             * Las mutaciones externas invalidan previews preparados.
             *
             * Durante EXECUTE, el propio servidor empieza a emitir
             * ADDED / CONTENT_UPDATED antes del ResultEvent. Esas
             * mutaciones pertenecen a la operación en curso y no
             * deben borrar su pending context.
             */
            const invalidateFill =
                !!fillRepeatContextRef.current &&
                pendingFillRepeatOperationRef.current !==
                    FILL_REPEAT_OP_EXECUTE;

            const invalidateLinear =
                !!linearRepeatContextRef.current &&
                pendingLinearRepeatOperationRef.current !==
                    LINEAR_REPEAT_OP_EXECUTE;

            const invalidateGrid =
                !!gridRepeatContextRef.current &&
                pendingGridRepeatOperationRef.current !==
                    GRID_REPEAT_OP_EXECUTE;

            const invalidateRadial =
                !!radialRepeatContextRef.current &&
                pendingRadialRepeatOperationRef.current !==
                    RADIAL_REPEAT_OP_EXECUTE;

            const hadInvalidatablePreview =
                invalidateFill ||
                invalidateLinear ||
                invalidateGrid ||
                invalidateRadial;

            if(!hadInvalidatablePreview)
            {
                return;
            }

            if(invalidateFill)
            {
                resetFillRepeatPreview();
            }

            if(invalidateLinear)
            {
                resetLinearRepeatPreview();
            }

            if(invalidateGrid)
            {
                resetGridRepeatPreview();
            }

            if(invalidateRadial)
            {
                resetRadialRepeatPreview();
            }

            setStatus(
                'La sala cambió. Genera de nuevo la vista previa.'
            );
        };

    const finalizeRadialRepeatVisuals =
        useCallback((
            repeatedIds: number[],
            copies: number,
            placedCount: number
        ) =>
        {
            const settle = (
                attempt: number
            ) =>
            {
                if(!activeRef.current)
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    return;
                }

                const currentRoomSession =
                    roomSessionRef.current;

                const roomEngine =
                    GetRoomEngine();

                if(
                    !currentRoomSession ||
                    !roomEngine
                )
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    return;
                }

                const presentIds =
                    repeatedIds.filter(
                        id =>
                            !!roomEngine.getRoomObject(
                                currentRoomSession.roomId,
                                id,
                                RoomObjectCategory.FLOOR
                            )
                    );

                if(
                    presentIds.length ===
                        repeatedIds.length ||
                    attempt >= 45
                )
                {
                    suppressPasteLayerAutoAssignRef.current =
                        false;

                    applySelection(
                        presentIds
                    );

                    setCanUndo(
                        true
                    );

                    setCanRedo(
                        false
                    );

                    scheduleOutlinerRevision();

                    requestLayerState(
                        LAYER_OP_LIST
                    );

                    requestTraversalState(
                        TRAVERSAL_OP_QUERY
                    );

                    if(
                        presentIds.length ===
                        repeatedIds.length
                    )
                    {
                        setStatus(
                            `Patrón radial creado: ${ copies } copias · ${ placedCount } furnis nuevos.`
                        );
                    }
                    else
                    {
                        setStatus(
                            `Patrón radial creado en servidor, pero Nitro solo sincronizó ${ presentIds.length }/${ repeatedIds.length } furnis.`
                        );
                    }

                    window.requestAnimationFrame(
                        () =>
                        {
                            BuilderProSelectionVisualizer
                                .refresh(
                                    presentIds
                                );
                        }
                    );

                    return;
                }

                window.requestAnimationFrame(
                    () =>
                        settle(
                            attempt + 1
                        )
                );
            };

            settle(
                0
            );
        }, [
            applySelection,
            requestLayerState,
            requestTraversalState
        ]);

    const requestRadialRepeat =
        useCallback((
            operation: number,
            context: BuilderProRadialRepeatContext
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            resetFillRepeatPreview();

            if(
                operation !== RADIAL_REPEAT_OP_PREVIEW &&
                operation !== RADIAL_REPEAT_OP_EXECUTE
            )
            {
                return;
            }

            if(
                !context ||
                !context.itemIds.length
            )
            {
                setStatus(
                    'Selecciona primero lo que quieres repetir.'
                );

                return;
            }

            duplicateRequestedRef.current =
                false;

            mirrorDuplicateModeRef.current =
                false;

            duplicateModeRef.current =
                false;

            setDuplicateMode(
                false
            );

            clearPastePreview();

            pasteModeRef.current =
                false;

            setPasteMode(
                false
            );

            blueprintPlaceModeRef.current =
                false;

            setBlueprintPlaceMode(
                false
            );

            replacePickModeRef.current =
                false;

            setReplacePickMode(
                false
            );

            if(operation === RADIAL_REPEAT_OP_PREVIEW)
            {
                resetRadialRepeatPreview();
            }
            else
            {
                clearRadialRepeatPreview();

                setRadialRepeatPreviewReady(
                    false
                );
            }

            requestIdRef.current++;

            if(requestIdRef.current > 2000000000)
            {
                requestIdRef.current = 1;
            }

            const requestId =
                requestIdRef.current;

            pendingRef.current =
                true;

            pendingRequestIdRef.current =
                requestId;

            pendingStartedAtRef.current =
                performance.now();

            pendingRadialRepeatOperationRef.current =
                operation;

            pendingRadialRepeatContextRef.current = {
                itemIds: [
                    ...context.itemIds
                ],
                copies:
                    context.copies,
                totalAngle:
                    context.totalAngle,
                radius:
                    context.radius,
                rotateWithPattern:
                    context.rotateWithPattern,
                pivotId:
                    context.pivotId
            };

            if(operation === RADIAL_REPEAT_OP_EXECUTE)
            {
                suppressPasteLayerAutoAssignRef.current =
                    true;
            }

            setPending(
                true
            );

            setStatus(
                operation === RADIAL_REPEAT_OP_PREVIEW
                    ? 'Preparando vista previa del patrón radial...'
                    : 'Creando patrón radial...'
            );

            try
            {
                SendMessageComposer(
                    new BuilderProRadialRepeatComposer(
                        context.itemIds,
                        operation,
                        context.copies,
                        context.totalAngle,
                        context.radius,
                        context.rotateWithPattern,
                        context.pivotId,
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

                            if(
                                !pendingRef.current ||
                                pendingRequestIdRef.current !==
                                    requestId ||
                                pendingRadialRepeatOperationRef.current !==
                                    operation
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

                            pendingRadialRepeatOperationRef.current =
                                null;

                            pendingRadialRepeatContextRef.current =
                                null;

                            suppressPasteLayerAutoAssignRef.current =
                                false;

                            setPending(
                                false
                            );

                            setStatus(
                                'Patrón radial sin confirmación del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT RADIAL_REPEAT_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current =
                    false;

                pendingRequestIdRef.current =
                    null;

                pendingStartedAtRef.current =
                    0;

                pendingRadialRepeatOperationRef.current =
                    null;

                pendingRadialRepeatContextRef.current =
                    null;

                suppressPasteLayerAutoAssignRef.current =
                    false;

                setPending(
                    false
                );

                setStatus(
                    'No se pudo enviar el patrón radial al servidor.'
                );
            }
        }, [
            clearRadialRepeatPreview,
            clearPastePreview,
            resetRadialRepeatPreview
        ]);

    const startRadialRepeatPreview =
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

            const copies =
                Number.parseInt(
                    radialRepeatCopies,
                    10
                );

            const totalAngle =
                Number.parseInt(
                    radialRepeatAngle,
                    10
                );

            const radius =
                Number.parseInt(
                    radialRepeatRadius,
                    10
                );

            if(
                !Number.isSafeInteger(copies) ||
                copies < 1 ||
                copies > 100
            )
            {
                setStatus(
                    'Las copias deben estar entre 1 y 100.'
                );

                return;
            }

            if(
                !Number.isSafeInteger(totalAngle) ||
                totalAngle < 1 ||
                totalAngle > 360
            )
            {
                setStatus(
                    'El ángulo total debe estar entre 1° y 360°.'
                );

                return;
            }

            if(
                !Number.isSafeInteger(radius) ||
                radius < 1 ||
                radius > 100
            )
            {
                setStatus(
                    'El radio debe estar entre 1 y 100 casillas.'
                );

                return;
            }

            const total =
                ids.length *
                copies;

            if(total > MAX_SELECTION)
            {
                setStatus(
                    `El patrón radial generaría ${ total } furnis; el límite actual es ${ MAX_SELECTION }.`
                );

                return;
            }

            const currentPivotId =
                pivotIdRef.current ?? 0;

            if(
                currentPivotId !== 0 &&
                !ids.includes(
                    currentPivotId
                )
            )
            {
                setStatus(
                    'El pivote debe pertenecer a la selección.'
                );

                return;
            }

            requestRadialRepeat(
                RADIAL_REPEAT_OP_PREVIEW,
                {
                    itemIds: ids,
                    copies,
                    totalAngle,
                    radius,
                    rotateWithPattern:
                        radialRepeatRotateWithPattern,
                    pivotId:
                        currentPivotId
                }
            );
        }, [
            radialRepeatCopies,
            radialRepeatAngle,
            radialRepeatRadius,
            radialRepeatRotateWithPattern,
            pivotId,
            requestRadialRepeat
        ]);

    const confirmRadialRepeat =
        useCallback(() =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;

            const context =
                radialRepeatContextRef.current;

            if(
                !context ||
                !radialRepeatPreviewReady
            )
            {
                setStatus(
                    'Genera primero una vista previa válida.'
                );

                return;
            }

            requestRadialRepeat(
                RADIAL_REPEAT_OP_EXECUTE,
                context
            );
        }, [
            radialRepeatPreviewReady,
            requestRadialRepeat
        ]);

    useMessageEvent<BuilderProRadialRepeatResultEvent>(
        BuilderProRadialRepeatResultEvent,
        event =>
        {
            const parser =
                event.getParser();

            if(!parser) return;

            const requestId =
                parser.requestId;

            if(
                pendingRequestIdRef.current !==
                    requestId ||
                !pendingRef.current
            )
            {
                return;
            }

            const expectedOperation =
                pendingRadialRepeatOperationRef.current;

            const context =
                pendingRadialRepeatContextRef.current;

            if(
                expectedOperation === null ||
                parser.operation !==
                    expectedOperation
            )
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

            pendingRef.current =
                false;

            pendingRequestIdRef.current =
                null;

            pendingStartedAtRef.current =
                0;

            pendingRadialRepeatOperationRef.current =
                null;

            pendingRadialRepeatContextRef.current =
                null;

            setPending(
                false
            );

            if(!parser.success)
            {
                suppressPasteLayerAutoAssignRef.current =
                    false;

                if(
                    expectedOperation ===
                    RADIAL_REPEAT_OP_PREVIEW
                )
                {
                    resetRadialRepeatPreview();
                }

                setStatus(
                    formatBuilderProServerFailure(parser.code, parser.message)
                );

                return;
            }

            if(
                expectedOperation ===
                RADIAL_REPEAT_OP_PREVIEW
            )
            {
                if(!context)
                {
                    resetRadialRepeatPreview();

                    setStatus(
                        'La vista previa perdió su contexto.'
                    );

                    return;
                }

                const entries =
                    parser.previewEntries;

                const expectedCount =
                    context.itemIds.length *
                    context.copies;

                if(
                    parser.copies !==
                        context.copies ||
                    parser.totalAngle !==
                        context.totalAngle ||
                    parser.radius !==
                        context.radius ||
                    parser.rotateWithPattern !==
                        context.rotateWithPattern ||
                    parser.pivotId !==
                        context.pivotId ||
                    entries.length !==
                        expectedCount
                )
                {
                    resetRadialRepeatPreview();

                    setStatus(
                        'La vista previa no coincide con el patrón radial solicitado.'
                    );

                    return;
                }

                radialRepeatContextRef.current = {
                    itemIds: [
                        ...context.itemIds
                    ],
                    copies:
                        context.copies,
                    totalAngle:
                        context.totalAngle,
                    radius:
                        context.radius,
                    rotateWithPattern:
                        context.rotateWithPattern,
                    pivotId:
                        context.pivotId
                };

                setRadialRepeatPreviewReady(
                    true
                );

                renderRadialRepeatPreview(
                    entries
                );

                setStatus(
                    `Vista previa radial: ${ context.copies } copias · ${ context.totalAngle }° · radio ${ context.radius } · ${ entries.length } furnis.`
                );

                return;
            }

            resetRadialRepeatPreview();

            finalizeRadialRepeatVisuals(
                parser.itemIds,
                parser.copies,
                parser.placedCount
            );
        }
    );

    useEffect(() =>
    {
        if(active) return;

        resetRadialRepeatPreview();

        pendingRadialRepeatOperationRef.current =
            null;

        pendingRadialRepeatContextRef.current =
            null;
    }, [
        active,
        resetRadialRepeatPreview
    ]);

    useEffect(() =>
    {
        return () =>
        {
            clearRadialRepeatPreview();
        };
    }, [
        clearRadialRepeatPreview
    ]);

    useEffect(() =>
    {
        const context =
            radialRepeatContextRef.current;

        if(!context)
        {
            return;
        }

        if(
            context.itemIds.length !==
                selectedIds.length ||
            context.itemIds.some(
                (id, index) =>
                    id !== selectedIds[index]
            ) ||
            context.pivotId !==
                (pivotId ?? 0)
        )
        {
            resetRadialRepeatPreview();
        }
    }, [
        selectedIds,
        pivotId,
        resetRadialRepeatPreview
    ]);

    const cancelReadyRepeatPreviews =
        useCallback((
            updateStatus: boolean = true
        ): boolean =>
        {
            const hadPreview =
                linearRepeatPreviewReady ||
                gridRepeatPreviewReady ||
                radialRepeatPreviewReady ||
                fillRepeatPreviewReady;

            if(!hadPreview)
            {
                return false;
            }

            if(linearRepeatPreviewReady)
            {
                resetLinearRepeatPreview();
            }

            if(gridRepeatPreviewReady)
            {
                resetGridRepeatPreview();
            }

            if(radialRepeatPreviewReady)
            {
                resetRadialRepeatPreview();
            }

            if(fillRepeatPreviewReady)
            {
                resetFillRepeatPreview();
            }

            if(updateStatus)
            {
                setStatus(
                    'Vista previa de repetición cancelada.'
                );
            }

            return true;
        }, [
            linearRepeatPreviewReady,
            gridRepeatPreviewReady,
            radialRepeatPreviewReady,
            fillRepeatPreviewReady,
            resetLinearRepeatPreview,
            resetGridRepeatPreview,
            resetRadialRepeatPreview,
            resetFillRepeatPreview
        ]);

    useEffect(() =>
    {
        if(!pending)
        {
            return;
        }

        if(
            pendingLinearRepeatOperationRef.current ===
                null
        )
        {
            resetLinearRepeatPreview();
        }

        if(
            pendingGridRepeatOperationRef.current ===
                null
        )
        {
            resetGridRepeatPreview();
        }

        if(
            pendingRadialRepeatOperationRef.current ===
                null
        )
        {
            resetRadialRepeatPreview();
        }

        if(
            pendingFillRepeatOperationRef.current ===
                null
        )
        {
            resetFillRepeatPreview();
        }
    }, [
        pending,
        resetLinearRepeatPreview,
        resetGridRepeatPreview,
        resetRadialRepeatPreview,
        resetFillRepeatPreview
    ]);

    const cancelTransientOperation =
        useCallback((): boolean =>
        {
            /*
             * Unified Escape policy for transient Builder Pro modes.
             * A tool switch alone still never cancels an operation.
             */
            if(replacePickModeRef.current)
            {
                clearReplacePick();
                return true;
            }

            if(
                referencePickOperationRef.current !==
                    REFERENCE_OP_NONE
            )
            {
                clearReferencePick(true);
                return true;
            }

            if(pivotPickModeRef.current)
            {
                pivotPickModeRef.current =
                    false;

                setPivotPickMode(
                    false
                );

                setStatus(
                    pivotIdRef.current !== null
                        ? `Selección de pivote cancelada. Pivote actual: furni #${ pivotIdRef.current }.`
                        : 'Selección de pivote cancelada. Se mantiene el pivote automático.'
                );

                return true;
            }

            if(fillAreaPickModeRef.current)
            {
                fillAreaPickModeRef.current =
                    false;

                fillAreaDraftContextRef.current =
                    null;

                fillAreaOverlayActiveRef.current =
                    false;

                areaStartRef.current =
                    null;

                GridEngine.clearTiles(
                    'builder-area'
                );

                suppressAreaClickRef.current =
                    false;

                setFillAreaPickMode(
                    false
                );

                setBuilderProRoomDraggingLocked(
                    areaModeRef.current
                );

                setStatus(
                    'Fill Area cancelado.'
                );

                return true;
            }

            if(areaModeRef.current)
            {
                areaModeRef.current =
                    false;

                areaStartRef.current = null;

                GridEngine.clearTiles('builder-area');

                suppressAreaClickRef.current = false;

                setBuilderProRoomDraggingLocked(areaModeRef.current);

                suppressAreaClickRef.current =
                    false;

                setAreaMode(
                    false
                );

                setStatus(
                    'Selección por área cancelada. Selección por clic activa.'
                );

                return true;
            }

            if(cancelCursorPlacement())
            {
                return true;
            }

            if(cancelReadyRepeatPreviews())
            {
                return true;
            }

            return false;
        }, [
            clearReferencePick,
            clearReplacePick,
            cancelCursorPlacement,
            cancelReadyRepeatPreviews
        ]);
    useEffect(() =>
    {
        if(!active)
        {
            return;
        }

        const onTransientEscape = (
            event: globalThis.KeyboardEvent
        ) =>
        {
            if(event.key !== 'Escape')
            {
                return;
            }

            const target =
                event.target;

            if(
                target instanceof HTMLInputElement ||
                target instanceof HTMLTextAreaElement ||
                target instanceof HTMLSelectElement ||
                (
                    target instanceof HTMLElement &&
                    target.isContentEditable
                )
            )
            {
                return;
            }

            if(!cancelTransientOperation())
            {
                return;
            }

            if(event.cancelable)
            {
                event.preventDefault();
            }

            event.stopPropagation();
            event.stopImmediatePropagation();
        };

        window.addEventListener(
            'keydown',
            onTransientEscape,
            true
        );

        return () =>
        {
            window.removeEventListener(
                'keydown',
                onTransientEscape,
                true
            );
        };
    }, [
        active,
        cancelTransientOperation
    ]);

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
                mirrorDuplicateModeRef.current = false;
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

            if(suppressAreaClickRef.current)
            {
                suppressAreaClickRef.current =
                    false;

                event.consume();
                return;
            }

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

            suppressPasteLayerAutoAssignRef.current =
                true;

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

                            suppressPasteLayerAutoAssignRef.current =
                                false;

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

                suppressPasteLayerAutoAssignRef.current =
                    false;

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

            suppressPasteLayerAutoAssignRef.current =
                false;

            setPending(false);

            if(parser.success)
            {
                const pastedIds =
                    parser.itemIds;

                settlePlacedSelection(
                    pastedIds
                );

                setCanUndo(true);
                setCanRedo(false);

                setStatus(
                    duplicateModeRef.current
                        ? (
                            mirrorDuplicateModeRef.current
                                ? `Duplicados en espejo ${ parser.placedCount } furnis. Mueve el cursor para seguir duplicando.`
                                : `Duplicados ${ parser.placedCount } furnis. Mueve el cursor para seguir duplicando.`
                        )
                        : `Pegados ${ parser.placedCount } furnis.`
                );

                return;
            }

            setStatus(
                formatBuilderProServerFailure(parser.code, parser.message)
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

    const duplicateMirror =
        useCallback((
            axis: number
        ) =>
        {
            if(!activeRef.current) return;
            if(pendingRef.current) return;
            if(dragRef.current) return;

            let ids = [
                ...selectedIdsRef.current
            ];

            if(!ids.length)
            {
                setStatus(
                    'Selecciona al menos un furni.'
                );

                return;
            }

            const pivotId =
                (
                    pivotIdRef.current !== null &&
                    ids.includes(
                        pivotIdRef.current
                    )
                )
                    ? pivotIdRef.current
                    : ids[0];

            ids = [
                pivotId,
                ...ids.filter(
                    id =>
                        id !== pivotId
                )
            ];

            const targetRotations =
                captureMirrorTargetRotations(
                    ids,
                    axis
                );

            if(
                !targetRotations ||
                targetRotations.length !==
                ids.length
            )
            {
                setStatus(
                    'No se pudieron calcular las orientaciones del espejo.'
                );

                return;
            }

            clearPastePreview();

            duplicateRequestedRef.current =
                false;

            duplicateModeRef.current =
                false;

            mirrorDuplicateModeRef.current =
                false;

            setDuplicateMode(
                false
            );

            pasteModeRef.current =
                false;

            setPasteMode(
                false
            );

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
                `Preparando duplicado en espejo ${ axis === MIRROR_AXIS_HORIZONTAL ? 'horizontal' : 'vertical' }...`
            );

            try
            {
                SendMessageComposer(
                    new BuilderProMirrorDuplicateComposer(
                        ids,
                        axis,
                        pivotId,
                        targetRotations,
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

                            if(
                                !pendingRef.current ||
                                pendingRequestIdRef.current !==
                                requestId
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

                            mirrorDuplicateModeRef.current =
                                false;

                            setPending(
                                false
                            );

                            setStatus(
                                'Preparación del espejo sin confirmación del servidor.'
                            );
                        },
                        MOVE_CONFIRM_TIMEOUT_MS
                    );
            }
            catch(error)
            {
                console.error(
                    `[BuilderProTrace] CLIENT MIRROR_PREPARE_SEND_ERROR #${ requestId }`,
                    error
                );

                pendingRef.current =
                    false;

                pendingRequestIdRef.current =
                    null;

                pendingStartedAtRef.current =
                    0;

                mirrorDuplicateModeRef.current =
                    false;

                setPending(
                    false
                );

                setStatus(
                    'No se pudo preparar el duplicado en espejo.'
                );
            }
        }, [
            captureMirrorTargetRotations,
            clearPastePreview
        ]);

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
            (
                operation === TRANSFORM_ROTATE_STRUCTURE ||
                operation === TRANSFORM_MIRROR_HORIZONTAL ||
                operation === TRANSFORM_MIRROR_VERTICAL
            ) &&
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

        if(
            operation === TRANSFORM_ORIENT ||
            operation === TRANSFORM_MIRROR_HORIZONTAL ||
            operation === TRANSFORM_MIRROR_VERTICAL
        )
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
        else if(
            operation === TRANSFORM_MIRROR_HORIZONTAL ||
            operation === TRANSFORM_MIRROR_VERTICAL
        )
        {
            const pivotText =
                pivotIdRef.current !== null
                    ? `furni #${ pivotIdRef.current }`
                    : 'primer seleccionado';

            setStatus(
                `Aplicando espejo ${ operation === TRANSFORM_MIRROR_HORIZONTAL ? 'horizontal' : 'vertical' }. Pivote: ${ pivotText }.`
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
         * del canvas; Construcción Avanzada solo calcula
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
        const enabled =
            active &&
            avatarMovementLocked;

        (globalThis as any).__builderProAvatarMovementLocked = enabled;

        if(
            !active &&
            avatarMovementLocked
        )
        {
            setAvatarMovementLocked(
                false
            );
        }

        return () =>
        {
            (globalThis as any).__builderProAvatarMovementLocked = false;
        };
    }, [
        active,
        avatarMovementLocked
    ]);

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
             * Construcción Avanzada genera su propia cadena
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

    const lockedItemIdSet =
        new Set(
            lockedItemIds
        );

    const selectedLockedCount =
        selectedIds.filter(
            itemId =>
                lockedItemIdSet.has(
                    itemId
                )
        ).length;

    const allSelectedLocked =
        selectedIds.length > 0 &&
        selectedLockedCount ===
        selectedIds.length;

    const renderOutlinerLayer = (
        layerId: number,
        layerName: string
    ) =>
    {
        const itemIds =
            getAvailableLayerItemIds(
                layerId
            );

        const itemIdSet =
            new Set(itemIds);

        const query =
            outlinerQuery
                .trim()
                .toLocaleLowerCase();

        const layerNameMatches =
            !query ||
            layerName
                .toLocaleLowerCase()
                .includes(query);

        const itemMatches =
            (itemId: number) =>
            {
                if(!query)
                {
                    return true;
                }

                const name =
                    getOutlinerItemName(
                        itemId
                    )
                        .toLocaleLowerCase();

                return (
                    name.includes(query) ||
                    String(itemId)
                        .includes(query)
                );
            };

        const groupedIds =
            new Set<number>();

        const groupRows =
            savedGroups
                .map(
                    group =>
                    {
                        const memberIds =
                            group.itemIds.filter(
                                itemId =>
                                    itemIdSet.has(
                                        itemId
                                    )
                            );

                        if(!memberIds.length)
                        {
                            return null;
                        }

                        for(const itemId of memberIds)
                        {
                            groupedIds.add(
                                itemId
                            );
                        }

                        const groupNameMatches =
                            !query ||
                            group.name
                                .toLocaleLowerCase()
                                .includes(query);

                        const matchingMembers =
                            memberIds.filter(
                                itemMatches
                            );

                        if(
                            !layerNameMatches &&
                            !groupNameMatches &&
                            !matchingMembers.length
                        )
                        {
                            return null;
                        }

                        const visibleMembers =
                            (
                                layerNameMatches ||
                                groupNameMatches ||
                                !query
                            )
                                ? memberIds
                                : matchingMembers;

                        return {
                            group,
                            visibleMembers
                        };
                    }
                )
                .filter(
                    entry =>
                        entry !== null
                );

        const ungroupedIds =
            itemIds.filter(
                itemId =>
                    (
                        !groupedIds.has(
                            itemId
                        )
                    ) &&
                    (
                        layerNameMatches ||
                        itemMatches(
                            itemId
                        )
                    )
            );

        if(
            query &&
            !layerNameMatches &&
            !groupRows.length &&
            !ungroupedIds.length
        )
        {
            return null;
        }

        const collapsed =
            outlinerCollapsedLayerIds.includes(
                layerId
            ) &&
            !query;

        const effectivelyHidden =
            hiddenLayerIds.includes(
                layerId
            ) ||
            (
                isolatedLayerId !== null &&
                isolatedLayerId !== layerId
            );

        return (
            <div
                key={ `outliner-layer-${ layerId }` }
                className={
                    `builder-pro-outliner-layer ${
                        layerScopeId === layerId
                            ? 'is-active'
                            : ''
                    } ${
                        effectivelyHidden
                            ? 'is-hidden'
                            : ''
                    }`
                }>
                <div className="builder-pro-outliner-layer-row">
                    <button
                        type="button"
                        className="builder-pro-outliner-disclosure"
                        title={
                            collapsed
                                ? 'Expandir capa'
                                : 'Contraer capa'
                        }
                        aria-label={
                            collapsed
                                ? 'Expandir capa'
                                : 'Contraer capa'
                        }
                        onClick={ () =>
                            setOutlinerCollapsedLayerIds(
                                current =>
                                    current.includes(
                                        layerId
                                    )
                                        ? current.filter(
                                            id =>
                                                id !== layerId
                                        )
                                        : [
                                            ...current,
                                            layerId
                                        ]
                            )
                        }>
                        { collapsed
                            ? '›'
                            : '⌄' }
                    </button>

                    <button
                        type="button"
                        className="builder-pro-outliner-eye"
                        title={
                            effectivelyHidden
                                ? `Mostrar ${ layerName }`
                                : `Ocultar ${ layerName }`
                        }
                        aria-label={
                            effectivelyHidden
                                ? `Mostrar ${ layerName }`
                                : `Ocultar ${ layerName }`
                        }
                        onClick={
                            () =>
                                toggleLayerVisibility(
                                    layerId
                                )
                        }>
                        { effectivelyHidden
                            ? <FaEyeSlash />
                            : <FaEye /> }
                    </button>

                    { outlinerRenameLayerId === layerId &&
                        layerId > 0
                        ? <input
                            type="text"
                            className="builder-pro-outliner-layer-rename-input"
                            maxLength={ 40 }
                            autoFocus
                            value={ outlinerRenameValue }
                            aria-label={ `Renombrar ${ layerName }` }
                            onChange={
                                event =>
                                    setOutlinerRenameValue(
                                        event.target.value
                                    )
                            }
                            onMouseDown={
                                event =>
                                    event.stopPropagation()
                            }
                            onClick={
                                event =>
                                    event.stopPropagation()
                            }
                            onKeyDown={
                                event =>
                                {
                                    if(
                                        event.key === 'Enter' ||
                                        event.key === 'NumpadEnter'
                                    )
                                    {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        event.nativeEvent.stopImmediatePropagation();

                                        confirmOutlinerRename(
                                            layerId
                                        );

                                        return;
                                    }

                                    if(event.key === 'Escape')
                                    {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        event.nativeEvent.stopImmediatePropagation();

                                        cancelOutlinerRename();
                                    }
                                }
                            }
                            onKeyUp={
                                event =>
                                {
                                    if(
                                        event.key === 'Enter' ||
                                        event.key === 'NumpadEnter' ||
                                        event.key === 'Escape'
                                    )
                                    {
                                        event.preventDefault();
                                        event.stopPropagation();
                                        event.nativeEvent.stopImmediatePropagation();
                                    }
                                }
                            } />
                        : <button
                            type="button"
                            className="builder-pro-outliner-name"
                            title={
                                layerId > 0
                                    ? 'Clic: activar capa · Doble clic: renombrar'
                                    : 'Activar Sin capa y seleccionar contenido'
                            }
                            onClick={
                                () =>
                                    selectOutlinerLayer(
                                        layerId
                                    )
                            }
                            onDoubleClick={
                                event =>
                                {
                                    if(layerId <= 0)
                                    {
                                        return;
                                    }

                                    event.preventDefault();
                                    event.stopPropagation();

                                    beginOutlinerRename(
                                        layerId
                                    );
                                }
                            }>
                            <span>
                                { layerName }
                            </span>
                        </button> }

                    <span className="builder-pro-outliner-count">
                        { itemIds.length }
                    </span>

                    <button
                        type="button"
                        className="builder-pro-outliner-more"
                        title={ `Acciones de ${ layerName }` }
                        aria-label={ `Acciones de ${ layerName }` }
                        onClick={
                            () =>
                            {
                                setOutlinerMenuLayerId(
                                    current =>
                                        current === layerId
                                            ? null
                                            : layerId
                                );

                                setOutlinerRenameLayerId(
                                    null
                                );

                                setOutlinerRenameValue(
                                    ''
                                );
                            }
                        }>
                        <FaEllipsisH />
                    </button>
                </div>


                { outlinerMenuLayerId === layerId &&
                    <div className="builder-pro-outliner-menu">
                        { layerId > 0 &&
                            <button
                                type="button"
                                disabled={
                                    pending ||
                                    layerPending
                                }
                                onClick={
                                    () =>
                                        beginOutlinerRename(
                                            layerId
                                        )
                                }>
                                Renombrar
                            </button> }

                        <button
                            type="button"
                            disabled={
                                pending ||
                                layerPending ||
                                !selectedIds.length
                            }
                            onClick={
                                () =>
                                    moveSelectionToOutlinerLayer(
                                        layerId
                                    )
                            }>
                            Mover selección aquí
                        </button>

                        <button
                            type="button"
                            className={
                                isolatedLayerId === layerId
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={
                                pending ||
                                layerPending
                            }
                            onClick={
                                () =>
                                    isolateOutlinerLayer(
                                        layerId
                                    )
                            }>
                            { isolatedLayerId === layerId
                                ? 'Quitar aislamiento'
                                : 'Aislar capa' }
                        </button>

                        <button
                            type="button"
                            className={
                                dimmedOthersLayerId === layerId
                                    ? 'is-selected'
                                    : ''
                            }
                            disabled={
                                pending ||
                                layerPending
                            }
                            onClick={
                                () =>
                                    dimOutlinerLayer(
                                        layerId
                                    )
                            }>
                            { dimmedOthersLayerId === layerId
                                ? 'Quitar atenuación'
                                : 'Atenuar resto' }
                        </button>

                        { layerId > 0 &&
                            <button
                                type="button"
                                className="is-danger"
                                disabled={
                                    pending ||
                                    layerPending
                                }
                                onClick={
                                    () =>
                                        deleteOutlinerLayer(
                                            layerId
                                        )
                                }>
                                Eliminar capa
                            </button> }
                    </div> }

                { !collapsed &&

                    <div className="builder-pro-outliner-children">
                        { groupRows.map(
                            entry =>
                            {
                                if(!entry)
                                {
                                    return null;
                                }

                                const {
                                    group,
                                    visibleMembers
                                } = entry;

                                const groupCollapsed =
                                    outlinerCollapsedGroupIds.includes(
                                        group.id
                                    ) &&
                                    !query;

                                const fullGroupIds =
                                    getAvailableGroupItemIds(
                                        group
                                    );

                                const groupSelected =
                                    fullGroupIds.length > 0 &&
                                    fullGroupIds.every(
                                        itemId =>
                                            selectedIds.includes(
                                                itemId
                                            )
                                    );

                                return (
                                    <div
                                        key={
                                            `outliner-group-${ layerId }-${ group.id }`
                                        }
                                        className="builder-pro-outliner-group">
                                        <div
                                            className={
                                                `builder-pro-outliner-group-row ${
                                                    groupSelected
                                                        ? 'is-selected'
                                                        : ''
                                                }`
                                            }>
                                            <button
                                                type="button"
                                                className="builder-pro-outliner-disclosure"
                                                title={
                                                    groupCollapsed
                                                        ? 'Expandir grupo'
                                                        : 'Contraer grupo'
                                                }
                                                onClick={
                                                    () =>
                                                        setOutlinerCollapsedGroupIds(
                                                            current =>
                                                                current.includes(
                                                                    group.id
                                                                )
                                                                    ? current.filter(
                                                                        id =>
                                                                            id !==
                                                                            group.id
                                                                    )
                                                                    : [
                                                                        ...current,
                                                                        group.id
                                                                    ]
                                                        )
                                                }>
                                                { groupCollapsed
                                                    ? '›'
                                                    : '⌄' }
                                            </button>

                                            <button
                                                type="button"
                                                className="builder-pro-outliner-name"
                                                title="Seleccionar grupo completo"
                                                onClick={
                                                    () =>
                                                        selectOutlinerGroup(
                                                            group,
                                                            layerId
                                                        )
                                                }>
                                                { group.locked &&
                                                    <FaLock /> }

                                                <span>
                                                    { group.name }
                                                </span>
                                            </button>

                                            <span className="builder-pro-outliner-count">
                                                { visibleMembers.length }
                                            </span>
                                        </div>

                                        { !groupCollapsed &&
                                            <div className="builder-pro-outliner-group-children">
                                                { visibleMembers.map(
                                                    itemId =>
                                                        <button
                                                            key={
                                                                `outliner-item-${ layerId }-${ itemId }`
                                                            }
                                                            type="button"
                                                            className={
                                                                `builder-pro-outliner-item ${
                                                                    selectedIds.includes(
                                                                        itemId
                                                                    )
                                                                        ? 'is-selected'
                                                                        : ''
                                                                }`
                                                            }
                                                            title={
                                                                `${ getOutlinerItemName(itemId) } #${ itemId }${ lockedItemIdSet.has(itemId) ? ' · Bloqueado' : '' }`
                                                            }
                                                            onClick={
                                                                () =>
                                                                    selectOutlinerItem(
                                                                        itemId,
                                                                        layerId
                                                                    )
                                                            }>
                                                            <span>
                                                                { getOutlinerItemName(
                                                                    itemId
                                                                ) }
                                                            </span>

                                                            <small>
                                                                { lockedItemIdSet.has(itemId) &&
                                                                    <FaLock
                                                                        title="Bloqueado para construcción" /> }
                                                                { lockedItemIdSet.has(itemId) && ' ' }
                                                                #{ itemId }
                                                            </small>
                                                        </button>
                                                ) }
                                            </div> }
                                    </div>
                                );
                            }
                        ) }

                        { ungroupedIds.map(
                            itemId =>
                                <button
                                    key={
                                        `outliner-item-${ layerId }-${ itemId }`
                                    }
                                    type="button"
                                    className={
                                        `builder-pro-outliner-item ${
                                            selectedIds.includes(
                                                itemId
                                            )
                                                ? 'is-selected'
                                                : ''
                                        }`
                                    }
                                    title={
                                        `${ getOutlinerItemName(itemId) } #${ itemId }${ lockedItemIdSet.has(itemId) ? ' · Bloqueado' : '' }`
                                    }
                                    onClick={
                                        () =>
                                            selectOutlinerItem(
                                                itemId,
                                                layerId
                                            )
                                    }>
                                    <span>
                                        { getOutlinerItemName(
                                            itemId
                                        ) }
                                    </span>

                                    <small>
                                        { lockedItemIdSet.has(itemId) &&
                                            <FaLock
                                                title="Bloqueado para construcción" /> }
                                        { lockedItemIdSet.has(itemId) && ' ' }
                                        #{ itemId }
                                    </small>
                                </button>
                        ) }

                        { !itemIds.length &&
                            <div className="builder-pro-outliner-empty">
                                Capa vacía
                            </div> }
                    </div> }
            </div>
        );
    };

    const [ activeTool, setActiveTool ] =
        useState<BuilderProToolId>('selection');
    const [ toolFlyout, setToolFlyout ] =
        useState<BuilderProToolId | null>(null);
    const [ activeTransformVariant, setActiveTransformVariant ] =
        useState<BuilderProToolVariantId>(
            'transform-orient'
        );
    const [ activeRepeatVariant, setActiveRepeatVariant ] =
        useState<BuilderProToolVariantId>(
            'repeat-linear'
        );

    const lifecycleChannels =
        ResolveBuilderProTransientChannels({
            pending: {
                fillRepeat:
                    pendingFillRepeatOperationRef.current !== null,
                radialRepeat:
                    pendingRadialRepeatOperationRef.current !== null,
                gridRepeat:
                    pendingGridRepeatOperationRef.current !== null,
                linearRepeat:
                    pendingLinearRepeatOperationRef.current !== null,
                replaceExecute:
                    pendingReplaceOperationRef.current ===
                        REPLACE_OP_EXECUTE &&
                    pendingRef.current,
                referenceEqualHeight:
                    pendingReferenceOperationRef.current ===
                        REFERENCE_OP_EQUAL_Z,
                referencePlaceAbove:
                    pendingReferenceOperationRef.current ===
                        REFERENCE_OP_PLACE_ABOVE,
                blueprintPlace:
                    blueprintPendingRef.current &&
                    blueprintOperationRef.current ===
                        BLUEPRINT_OP_PLACE,
                fillRepeatPreview:
                    pendingFillRepeatOperationRef.current ===
                        FILL_REPEAT_OP_PREVIEW,
                radialRepeatPreview:
                    pendingRadialRepeatOperationRef.current ===
                        RADIAL_REPEAT_OP_PREVIEW,
                gridRepeatPreview:
                    pendingGridRepeatOperationRef.current ===
                        GRID_REPEAT_OP_PREVIEW,
                linearRepeatPreview:
                    pendingLinearRepeatOperationRef.current ===
                        LINEAR_REPEAT_OP_PREVIEW,
                replacePreview:
                    pendingRef.current &&
                    pendingReplaceOperationRef.current ===
                        REPLACE_OP_PREVIEW,
                blueprintPreview:
                    blueprintPendingRef.current &&
                    blueprintOperationRef.current ===
                        BLUEPRINT_OP_PREVIEW
            },
            placement: {
                blueprintPlace:
                    blueprintPlaceMode,
                duplicate:
                    duplicateMode,
                mirrorDuplicate:
                    mirrorDuplicateModeRef.current,
                paste:
                    pasteMode
            },
            capture: {
                replace:
                    replacePickMode,
                referenceEqualHeight:
                    referencePickOperation ===
                        REFERENCE_OP_EQUAL_Z,
                referencePlaceAbove:
                    referencePickOperation ===
                        REFERENCE_OP_PLACE_ABOVE,
                pivot:
                    pivotPickMode,
                area:
                    areaMode
            },
            preview: {
                fillRepeat:
                    fillRepeatPreviewReady,
                radialRepeat:
                    radialRepeatPreviewReady,
                gridRepeat:
                    gridRepeatPreviewReady,
                linearRepeat:
                    linearRepeatPreviewReady,
                replacePrepared:
                    !!replacementContextRef.current
            }
        });

    const toolLifecycle =
        ResolveBuilderProToolLifecycle({
            active,
            pending,
            ...lifecycleChannels
        });

    const contextualTool:
        BuilderProToolId =
        activeTool;

    const activeSelectionVariant:
        BuilderProToolVariantId =
        areaMode
            ? 'selection-area'
            : 'selection-click';

    const normalizedTransformVariant:
        BuilderProToolVariantId =
        activeTransformVariant ===
            'transform-mirror-duplicate'
            ? 'transform-mirror'
            : activeTransformVariant;

    const activeToolVariant:
        BuilderProToolVariantId | null =
        contextualTool === 'selection'
            ? activeSelectionVariant
            : contextualTool === 'transform'
                ? normalizedTransformVariant
                : contextualTool === 'repeat'
                    ? activeRepeatVariant
                    : null;
    const selectPrimaryTool = (
        tool: BuilderProToolId
    ) =>
    {
        if(pending)
        {
            return;
        }

        const hasFlyout =
            tool === 'selection' ||
            tool === 'transform' ||
            tool === 'repeat';

        if(
            activeTool === tool &&
            hasFlyout
        )
        {
            setToolFlyout(
                current =>
                    current === tool
                        ? null
                        : tool
            );

            return;
        }

        setActiveTool(tool);
        setToolFlyout(
            hasFlyout
                ? tool
                : null
        );
    };

    const selectToolVariant = (
        variant: BuilderProToolVariantId
    ) =>
    {
        if(pending)
        {
            return;
        }

        if(
            variant === 'selection-click' ||
            variant === 'selection-area'
        )
        {
            const nextAreaMode =
                variant === 'selection-area';

            if(areaMode !== nextAreaMode)
            {
                toggleAreaMode();
            }

            setToolFlyout(null);
            return;
        }

        if(toolLifecycle.isTransient)
        {
            return;
        }

        if(
            variant === 'transform-orient' ||
            variant === 'transform-structure' ||
            variant === 'transform-mirror'
        )
        {
            setActiveTransformVariant(
                variant
            );
        }
        else if(
            variant === 'repeat-linear' ||
            variant === 'repeat-grid' ||
            variant === 'repeat-radial' ||
            variant === 'repeat-fill'
        )
        {
            setActiveRepeatVariant(
                variant
            );
        }

        setToolFlyout(null);
    };

    return (

        <>
            { active &&
                <div
                    className={
                        `builder-pro-workspace-shell${
                            minimized
                                ? ' is-minimized'
                                : ''
                        }`
                    }>

                                        <div className="builder-pro-shell-controls">
                        <span
                            className="builder-pro-shell-counter"
                            title="Furnis seleccionados">
                            { selectedIds.length }/{ MAX_SELECTION }
                        </span>

                        <button
                            type="button"
                            className={
                                `builder-pro-shell-control ${
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

                        <button
                            type="button"
                            className="builder-pro-shell-control"
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
                                    current =>
                                        !current
                                );

                                setHelpOpen(false);
                            } }>
                            <FaMinus />
                        </button>

                        <button
                            type="button"
                            className="builder-pro-shell-control builder-pro-shell-close"
                            title="Cerrar Construcción Avanzada"
                            aria-label="Cerrar Construcción Avanzada"
                            onClick={ deactivate }>
                            ×
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
                    <div className="builder-pro-shell-content">
                                        { status &&
                        <div
                            className="builder-pro-status-toast"
                            role="status"
                            aria-live="polite"
                            aria-atomic="true"
                            data-builder-pro-phase={
                                toolLifecycle.phase
                            }
                            data-builder-pro-operation={
                                toolLifecycle.operation
                            }
                            data-builder-pro-source={
                                toolLifecycle.source
                            }>
                            { status }
                        </div> }
<div className="builder-pro-workspace">
                        <BuilderProToolPanel
                            tool={ contextualTool }
                            phase={ toolLifecycle.phase }>
                                            { contextualTool === 'selection' &&
                            <BuilderProSelectionContext
                                pending={ pending }
                                selectedCount={ selectedIds.length }
                                areaMode={ areaMode }
                                pivotId={ pivotId }
                                pivotPickMode={ pivotPickMode }
                                onOpenModeMenu={
                                    () =>
                                        setToolFlyout(
                                            'selection'
                                        )
                                }
                                onTogglePivotPick={ togglePivotPick }
                                onClearPivot={ clearStructuralPivot }
                                onStatePrevious={
                                    () =>
                                        transformGroup(
                                            TRANSFORM_STATE_PREVIOUS,
                                            0
                                        )
                                }
                                onStateNext={
                                    () =>
                                        transformGroup(
                                            TRANSFORM_STATE_NEXT,
                                            0
                                        )
                                }
                                onSelectAdvanced={
                                    criterion =>
                                        selectByAdvancedCriterion(
                                            criterion
                                        )
                                }
                                canRestoreVisibility={
                                    !!individualHiddenItemIds.length ||
                                    !!individualDimmedItemIds.length
                                }
                                onHideSelection={
                                    hideSelectedItemsLocally
                                }
                                onDimSelection={
                                    dimSelectedItemsLocally
                                }
                                onRestoreVisibility={
                                    restoreIndividualItemVisibility
                                }
                                itemLockPending={ itemLockPending }
                                allSelectedLocked={ allSelectedLocked }
                                selectedLockedCount={
                                    selectedLockedCount
                                }
                                onLockSelection={
                                    () =>
                                        setConstructionLockSelection(
                                            true
                                        )
                                }
                                onUnlockSelection={
                                    () =>
                                        setConstructionLockSelection(
                                            false
                                        )
                                }
                                groups={ savedGroups }
                                selectedGroupId={ selectedGroupId }
                                selectedGroupLocked={
                                    !!selectedSavedGroup?.locked
                                }
                                hasSelectedGroup={
                                    !!selectedSavedGroup
                                }
                                groupName={ groupName }
                                groupPending={ groupPending }
                                onSelectedGroupIdChange={
                                    setSelectedGroupId
                                }
                                onGroupNameChange={
                                    setGroupName
                                }
                                onCreateGroup={
                                    createSavedGroup
                                }
                                onSelectGroup={
                                    () =>
                                        selectedSavedGroup &&
                                        selectSavedGroup(
                                            selectedSavedGroup
                                        )
                                }
                                onToggleGroupLock={
                                    toggleSavedGroupLock
                                }
                                onUpdateGroupMembers={
                                    updateSavedGroupMembers
                                }
                                onRenameGroup={
                                    renameSavedGroup
                                }
                                onDeleteGroup={
                                    deleteSavedGroup
                                } /> }
<div
                        className="builder-pro-sections"
                        data-builder-pro-active-tool={ contextualTool }
                        data-builder-pro-active-variant={
                            activeToolVariant || undefined
                        }
                        data-builder-pro-tool={
                            toolLifecycle.suggestedTool
                        }
                        data-builder-pro-operation={
                            toolLifecycle.operation
                        }
                        data-builder-pro-phase={
                            toolLifecycle.phase
                        }
                        data-builder-pro-preview={
                            toolLifecycle.hasPreview
                                ? 'true'
                                : 'false'
                        }
                        data-builder-pro-cancelable={
                            toolLifecycle.canCancel
                                ? 'true'
                                : 'false'
                        }>

                        <details className="builder-pro-section" data-builder-pro-family="selection" open>
                            <summary>Selección</summary>

                            <div className="builder-pro-section-body">

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
                                    Visibilidad local
                                </div>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            hideSelectedItemsLocally
                                        }>
                                        Ocultar selección
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            dimSelectedItemsLocally
                                        }>
                                        Atenuar selección
                                    </button>
                                </div>

                                <button
                                    type="button"
                                    className="builder-pro-full"
                                    disabled={
                                        pending ||
                                        (
                                            !individualHiddenItemIds.length &&
                                            !individualDimmedItemIds.length
                                        )
                                    }
                                    onClick={
                                        restoreIndividualItemVisibility
                                    }>
                                    Restaurar visibilidad
                                </button>

                                <div className="builder-pro-hint">
                                    Solo cambia tu vista. Ocultar limpia la selección; restaurar no modifica la visibilidad de las capas.
                                </div>

                                <div className="builder-pro-subtitle">
                                    Bloqueo de construcción
                                </div>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        className={
                                            allSelectedLocked
                                                ? 'is-selected'
                                                : ''
                                        }
                                        disabled={
                                            pending ||
                                            itemLockPending ||
                                            !selectedIds.length ||
                                            allSelectedLocked
                                        }
                                        onClick={
                                            () =>
                                                setConstructionLockSelection(
                                                    true
                                                )
                                        }>
                                        Bloquear selección
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            itemLockPending ||
                                            !selectedIds.length ||
                                            selectedLockedCount === 0
                                        }
                                        onClick={
                                            () =>
                                                setConstructionLockSelection(
                                                    false
                                                )
                                        }>
                                        Desbloquear selección
                                    </button>
                                </div>

                                <div className="builder-pro-hint">
                                    { selectedIds.length
                                        ? `${ selectedLockedCount }/${ selectedIds.length } bloqueados. `
                                        : '' }
                                    Impide mover, girar, cambiar altura/estado de construcción, recoger, reemplazar y cambiar Atravesable. Usar, doble clic y WIRED siguen funcionando.
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


                        <details className="builder-pro-section" data-builder-pro-family="blueprints" open>
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

                        <details className="builder-pro-section" data-builder-pro-family="collision" open>
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

                        <details className="builder-pro-section" data-builder-pro-family="move" open>
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

                                <div className="builder-pro-subtitle">
                                    Referencia de altura
                                </div>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => toggleReferencePick(
                                                REFERENCE_OP_EQUAL_Z
                                            )
                                        }>
                                        {
                                            referencePickOperation ===
                                            REFERENCE_OP_EQUAL_Z
                                                ? 'Cancelar Igualar altura'
                                                : 'Igualar altura'
                                        }
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => toggleReferencePick(
                                                REFERENCE_OP_PLACE_ABOVE
                                            )
                                        }>
                                        {
                                            referencePickOperation ===
                                            REFERENCE_OP_PLACE_ABOVE
                                                ? 'Cancelar Colocar encima'
                                                : 'Colocar encima'
                                        }
                                    </button>
                                </div>

                                <div className="builder-pro-hint">
                                    Igualar altura conserva las diferencias internas de la estructura. Colocar encima usa el pivote actual para X/Y.
                                </div>
                            </div>
                        </details>

                        <details className="builder-pro-section" data-builder-pro-family="replace" open>
                            <summary>Reemplazar</summary>

                            <div className="builder-pro-section-body">
                                <button
                                    type="button"
                                    className="builder-pro-full"
                                    disabled={
                                        pending ||
                                        !selectedIds.length
                                    }
                                    onClick={
                                        toggleReplacePick
                                    }>
                                    {
                                        replacePickMode
                                            ? 'Cancelar reemplazo'
                                            : 'Reemplazar por...'
                                    }
                                </button>

                                <div className="builder-pro-hint">
                                    Elige un furni visible de la sala como modelo. Usa unidades reales de tu inventario y cancela toda la operación si una sola pieza no cabe.
                                </div>
                            </div>
                        </details>

                        <details className="builder-pro-section" data-builder-pro-family="arrange" open>
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


                        <details className="builder-pro-section" data-builder-pro-family="repeat" data-builder-pro-variant="repeat-linear" open>
                            <summary>Repetición lineal</summary>

                            <div className="builder-pro-section-body">
                                <label className="builder-pro-field-row">
                                    <span>Copias</span>

                                    <input
                                        className="builder-pro-small-input"
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={ linearRepeatCopies }
                                        disabled={ pending }
                                        onChange={
                                            event =>
                                            {
                                                resetLinearRepeatPreview();
                                                setLinearRepeatCopies(
                                                    event.target.value
                                                );
                                            }
                                        } />
                                </label>

                                <label className="builder-pro-field-row">
                                    <span>Separación</span>

                                    <input
                                        className="builder-pro-small-input"
                                        type="number"
                                        min="0"
                                        max="50"
                                        step="1"
                                        value={ linearRepeatSpacing }
                                        disabled={ pending }
                                        onChange={
                                            event =>
                                            {
                                                resetLinearRepeatPreview();
                                                setLinearRepeatSpacing(
                                                    event.target.value
                                                );
                                            }
                                        } />
                                </label>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        className={
                                            linearRepeatPreviewReady &&
                                            linearRepeatDirection ===
                                                LINEAR_REPEAT_DIRECTION_LEFT
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                startLinearRepeatPreview(
                                                    LINEAR_REPEAT_DIRECTION_LEFT
                                                )
                                        }>
                                        Izquierda
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            linearRepeatPreviewReady &&
                                            linearRepeatDirection ===
                                                LINEAR_REPEAT_DIRECTION_RIGHT
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                startLinearRepeatPreview(
                                                    LINEAR_REPEAT_DIRECTION_RIGHT
                                                )
                                        }>
                                        Derecha
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            linearRepeatPreviewReady &&
                                            linearRepeatDirection ===
                                                LINEAR_REPEAT_DIRECTION_UP
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                startLinearRepeatPreview(
                                                    LINEAR_REPEAT_DIRECTION_UP
                                                )
                                        }>
                                        Arriba
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            linearRepeatPreviewReady &&
                                            linearRepeatDirection ===
                                                LINEAR_REPEAT_DIRECTION_DOWN
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                startLinearRepeatPreview(
                                                    LINEAR_REPEAT_DIRECTION_DOWN
                                                )
                                        }>
                                        Abajo
                                    </button>
                                </div>

                                {
                                    linearRepeatPreviewReady &&
                                    <div className="builder-pro-grid-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary"
                                            disabled={ pending }
                                            onClick={
                                                confirmLinearRepeat
                                            }>
                                            Confirmar
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            disabled={ pending }
                                            onClick={
                                                () =>
                                                {
                                                    resetLinearRepeatPreview();

                                                    setStatus(
                                                        'Repetición cancelada.'
                                                    );
                                                }
                                            }>
                                            Cancelar
                                        </button>
                                    </div>
                                }

                                <div className="builder-pro-hint">
                                    Copias nuevas; el original no cuenta. Separación 0 coloca cada módulo pegado al anterior. La vista previa se valida completa antes de confirmar.
                                </div>
                            </div>
                        </details>


                        <details className="builder-pro-section" data-builder-pro-family="repeat" data-builder-pro-variant="repeat-grid" open>
                            <summary>Cuadrícula</summary>

                            <div className="builder-pro-section-body">
                                <div className="builder-pro-grid-2">
                                    <label className="builder-pro-field-row">
                                        <span>Columnas</span>

                                        <input
                                            className="builder-pro-small-input"
                                            type="number"
                                            min="1"
                                            max="100"
                                            step="1"
                                            value={ gridRepeatColumns }
                                            disabled={ pending }
                                            onChange={
                                                event =>
                                                {
                                                    resetGridRepeatPreview();
                                                    setGridRepeatColumns(
                                                        event.target.value
                                                    );
                                                }
                                            } />
                                    </label>

                                    <label className="builder-pro-field-row">
                                        <span>Filas</span>

                                        <input
                                            className="builder-pro-small-input"
                                            type="number"
                                            min="1"
                                            max="100"
                                            step="1"
                                            value={ gridRepeatRows }
                                            disabled={ pending }
                                            onChange={
                                                event =>
                                                {
                                                    resetGridRepeatPreview();
                                                    setGridRepeatRows(
                                                        event.target.value
                                                    );
                                                }
                                            } />
                                    </label>
                                </div>

                                <div className="builder-pro-grid-2">
                                    <label className="builder-pro-field-row">
                                        <span>Sep. horizontal</span>

                                        <input
                                            className="builder-pro-small-input"
                                            type="number"
                                            min="0"
                                            max="50"
                                            step="1"
                                            value={ gridRepeatSpacingX }
                                            disabled={ pending }
                                            onChange={
                                                event =>
                                                {
                                                    resetGridRepeatPreview();
                                                    setGridRepeatSpacingX(
                                                        event.target.value
                                                    );
                                                }
                                            } />
                                    </label>

                                    <label className="builder-pro-field-row">
                                        <span>Sep. vertical</span>

                                        <input
                                            className="builder-pro-small-input"
                                            type="number"
                                            min="0"
                                            max="50"
                                            step="1"
                                            value={ gridRepeatSpacingY }
                                            disabled={ pending }
                                            onChange={
                                                event =>
                                                {
                                                    resetGridRepeatPreview();
                                                    setGridRepeatSpacingY(
                                                        event.target.value
                                                    );
                                                }
                                            } />
                                    </label>
                                </div>

                                {
                                    !gridRepeatPreviewReady &&
                                    <button
                                        type="button"
                                        className="builder-pro-full"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            startGridRepeatPreview
                                        }>
                                        Vista previa
                                    </button>
                                }

                                {
                                    gridRepeatPreviewReady &&
                                    <div className="builder-pro-grid-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary"
                                            disabled={ pending }
                                            onClick={
                                                confirmGridRepeat
                                            }>
                                            Confirmar
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            disabled={ pending }
                                            onClick={
                                                () =>
                                                {
                                                    resetGridRepeatPreview();

                                                    setStatus(
                                                        'Cuadrícula cancelada.'
                                                    );
                                                }
                                            }>
                                            Cancelar
                                        </button>
                                    </div>
                                }

                                <div className="builder-pro-hint">
                                    Filas × columnas cuenta también el módulo original: 3 × 3 son 9 módulos, por lo que se crean 8 copias. Se expande hacia la derecha y abajo. Las separaciones 0 dejan los módulos pegados.
                                </div>
                            </div>
                        </details>


                        <details className="builder-pro-section" data-builder-pro-family="repeat" data-builder-pro-variant="repeat-radial" open>
                            <summary>Patrón radial</summary>

                            <div className="builder-pro-section-body">
                                <div className="builder-pro-grid-2">
                                    <label className="builder-pro-field-row">
                                        <span>Copias</span>

                                        <input
                                            className="builder-pro-small-input"
                                            type="number"
                                            min="1"
                                            max="100"
                                            step="1"
                                            value={ radialRepeatCopies }
                                            disabled={ pending }
                                            onChange={
                                                event =>
                                                {
                                                    resetRadialRepeatPreview();
                                                    setRadialRepeatCopies(
                                                        event.target.value
                                                    );
                                                }
                                            } />
                                    </label>

                                    <label className="builder-pro-field-row">
                                        <span>Ángulo total</span>

                                        <input
                                            className="builder-pro-small-input"
                                            type="number"
                                            min="1"
                                            max="360"
                                            step="1"
                                            value={ radialRepeatAngle }
                                            disabled={ pending }
                                            onChange={
                                                event =>
                                                {
                                                    resetRadialRepeatPreview();
                                                    setRadialRepeatAngle(
                                                        event.target.value
                                                    );
                                                }
                                            } />
                                    </label>
                                </div>

                                <label className="builder-pro-field-row">
                                    <span>Radio</span>

                                    <input
                                        className="builder-pro-small-input"
                                        type="number"
                                        min="1"
                                        max="100"
                                        step="1"
                                        value={ radialRepeatRadius }
                                        disabled={ pending }
                                        onChange={
                                            event =>
                                            {
                                                resetRadialRepeatPreview();
                                                setRadialRepeatRadius(
                                                    event.target.value
                                                );
                                            }
                                        } />
                                </label>

                                <label className="builder-pro-field-row">
                                    <span>Orientar siguiendo el círculo</span>

                                    <input
                                        type="checkbox"
                                        checked={ radialRepeatRotateWithPattern }
                                        disabled={ pending }
                                        onChange={
                                            event =>
                                            {
                                                resetRadialRepeatPreview();
                                                setRadialRepeatRotateWithPattern(
                                                    event.target.checked
                                                );
                                            }
                                        } />
                                </label>

                                <div className="builder-pro-hint">
                                    { pivotId !== null
                                        ? `Centro: pivote #${ pivotId }`
                                        : 'Centro: centro de la selección' }
                                </div>

                                {
                                    !radialRepeatPreviewReady &&
                                    <button
                                        type="button"
                                        className="builder-pro-full"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            startRadialRepeatPreview
                                        }>
                                        Vista previa
                                    </button>
                                }

                                {
                                    radialRepeatPreviewReady &&
                                    <div className="builder-pro-grid-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary"
                                            disabled={ pending }
                                            onClick={
                                                confirmRadialRepeat
                                            }>
                                            Confirmar
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            disabled={ pending }
                                            onClick={
                                                () =>
                                                {
                                                    resetRadialRepeatPreview();

                                                    setStatus(
                                                        'Patrón radial cancelado.'
                                                    );
                                                }
                                            }>
                                            Cancelar
                                        </button>
                                    </div>
                                }

                                <div className="builder-pro-hint">
                                    Empieza arriba y avanza en sentido horario. A 360° reparte las copias uniformemente; en un arco menor incluye sus extremos. La geometría interna del módulo se conserva. “Orientar” gira cada furni al paso Habbo compatible más cercano.
                                </div>
                            </div>
                        </details>


                        <details className="builder-pro-section" data-builder-pro-family="repeat" data-builder-pro-variant="repeat-fill" open>
                            <summary>Rellenar hasta límite / área</summary>

                            <div className="builder-pro-section-body">
                                <label className="builder-pro-field-row">
                                    <span>Separación</span>

                                    <input
                                        className="builder-pro-small-input"
                                        type="number"
                                        min="0"
                                        max="50"
                                        step="1"
                                        value={ fillRepeatSpacing }
                                        disabled={ pending }
                                        onChange={
                                            event =>
                                            {
                                                resetFillRepeatPreview();

                                                setFillRepeatSpacing(
                                                    event.target.value
                                                );
                                            }
                                        } />
                                </label>

                                <div className="builder-pro-subtitle">
                                    Hasta límite
                                </div>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        className={
                                            fillRepeatPreviewReady &&
                                            fillRepeatMode ===
                                                FILL_REPEAT_MODE_LINE &&
                                            fillRepeatDirection ===
                                                FILL_REPEAT_DIRECTION_LEFT
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                startFillRepeatPreview(
                                                    FILL_REPEAT_MODE_LINE,
                                                    FILL_REPEAT_DIRECTION_LEFT
                                                )
                                        }>
                                        Izquierda
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            fillRepeatPreviewReady &&
                                            fillRepeatMode ===
                                                FILL_REPEAT_MODE_LINE &&
                                            fillRepeatDirection ===
                                                FILL_REPEAT_DIRECTION_RIGHT
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                startFillRepeatPreview(
                                                    FILL_REPEAT_MODE_LINE,
                                                    FILL_REPEAT_DIRECTION_RIGHT
                                                )
                                        }>
                                        Derecha
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            fillRepeatPreviewReady &&
                                            fillRepeatMode ===
                                                FILL_REPEAT_MODE_LINE &&
                                            fillRepeatDirection ===
                                                FILL_REPEAT_DIRECTION_UP
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                startFillRepeatPreview(
                                                    FILL_REPEAT_MODE_LINE,
                                                    FILL_REPEAT_DIRECTION_UP
                                                )
                                        }>
                                        Arriba
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            fillRepeatPreviewReady &&
                                            fillRepeatMode ===
                                                FILL_REPEAT_MODE_LINE &&
                                            fillRepeatDirection ===
                                                FILL_REPEAT_DIRECTION_DOWN
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                startFillRepeatPreview(
                                                    FILL_REPEAT_MODE_LINE,
                                                    FILL_REPEAT_DIRECTION_DOWN
                                                )
                                        }>
                                        Abajo
                                    </button>
                                </div>

                                <div className="builder-pro-subtitle">
                                    Área
                                </div>

                                <div className="builder-pro-grid-2">
                                    <button
                                        type="button"
                                        className={
                                            fillRepeatPreviewReady &&
                                            fillRepeatMode ===
                                                FILL_REPEAT_MODE_AREA
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () =>
                                                startFillRepeatPreview(
                                                    FILL_REPEAT_MODE_AREA,
                                                    0
                                                )
                                        }>
                                        Rellenar sala
                                    </button>

                                    <button
                                        type="button"
                                        className={
                                            (
                                                fillAreaPickMode ||
                                                (
                                                    fillRepeatPreviewReady &&
                                                    fillRepeatMode ===
                                                        FILL_REPEAT_MODE_TILE_AREA
                                                )
                                            )
                                                ? 'btn btn-sm btn-primary'
                                                : 'btn btn-sm btn-secondary'
                                        }
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            startFillAreaPick
                                        }>
                                        Rellenar área
                                    </button>
                                </div>

                                {
                                    fillRepeatPreviewReady &&
                                    <div className="builder-pro-grid-2">
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-primary"
                                            disabled={ pending }
                                            onClick={
                                                confirmFillRepeat
                                            }>
                                            Confirmar
                                        </button>

                                        <button
                                            type="button"
                                            className="btn btn-sm btn-secondary"
                                            disabled={ pending }
                                            onClick={
                                                () =>
                                                {
                                                    resetFillRepeatPreview();

                                                    setStatus(
                                                        'Relleno cancelado.'
                                                    );
                                                }
                                            }>
                                            Cancelar
                                        </button>
                                    </div>
                                }

                                <div className="builder-pro-hint">
                                    Hasta límite repite el módulo hasta el primer borde, tile inválido u obstáculo. Rellenar sala conserva el comportamiento actual sobre toda la sala. Rellenar área permite trazar casillas concretas y solo crea módulos que caben completamente dentro de esos límites. La operación final es atómica y usa unidades reales del inventario.
                                </div>
                            </div>
                        </details>


                        <details className="builder-pro-section" data-builder-pro-family="transform" open>
                            <summary>Rotación</summary>

                            <div className="builder-pro-section-body">
                                <button
                                    data-builder-pro-tool-variant="transform-orient"
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

                                <div
                                    className="builder-pro-grid-2"
                                    data-builder-pro-tool-variant="transform-structure">
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

                                <div
                                    className="builder-pro-subtitle"
                                    data-builder-pro-tool-variant="transform-mirror">
                                    Espejo
                                </div>

                                <div
                                    className="builder-pro-grid-2"
                                    data-builder-pro-tool-variant="transform-mirror">
                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => transformGroup(
                                                TRANSFORM_MIRROR_HORIZONTAL,
                                                0
                                            )
                                        }>
                                        Espejo horizontal
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => transformGroup(
                                                TRANSFORM_MIRROR_VERTICAL,
                                                0
                                            )
                                        }>
                                        Espejo vertical
                                    </button>
                                </div>

                                <div
                                    className="builder-pro-grid-2"
                                    data-builder-pro-tool-variant="transform-mirror">
                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => duplicateMirror(
                                                MIRROR_AXIS_HORIZONTAL
                                            )
                                        }>
                                        Duplicar espejo H
                                    </button>

                                    <button
                                        type="button"
                                        disabled={
                                            pending ||
                                            !selectedIds.length
                                        }
                                        onClick={
                                            () => duplicateMirror(
                                                MIRROR_AXIS_VERTICAL
                                            )
                                        }>
                                        Duplicar espejo V
                                    </button>
                                </div>

                                <div
                                    className="builder-pro-hint"
                                    data-builder-pro-tool-variant="transform-mirror">
                                    Duplicar espejo crea una copia completa reflejada y la deja en el cursor para colocarla donde quieras.
                                </div>
                            </div>
                        </details>



                    </div>
                        </BuilderProToolPanel>
                    </div>


                    <BuilderProGlobalToolbar
                        pending={ pending }
                        hasSelection={ !!selectedIds.length }
                        onClearSelection={ clearSelection }
                        highlightSelection={ highlightSelection }
                        onToggleHighlight={ toggleHighlight }
                        outlinerOpen={ outlinerOpen }
                        onToggleOutliner={
                            () =>
                                setOutlinerOpen(
                                    current =>
                                        !current
                                )
                        }>
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
                                                                        mirrorDuplicateModeRef.current = false;
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

                                                                    mirrorDuplicateModeRef.current = false;
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
                            className={
                                `btn btn-sm ${
                                    avatarMovementLocked
                                        ? 'btn-primary'
                                        : 'btn-secondary'
                                } builder-pro-icon-button`
                            }
                            title={
                                avatarMovementLocked
                                    ? 'Permitir movimiento del avatar'
                                    : 'Bloquear movimiento del avatar'
                            }
                            aria-label={
                                avatarMovementLocked
                                    ? 'Permitir movimiento del avatar'
                                    : 'Bloquear movimiento del avatar'
                            }
                            onClick={ () =>
                            {
                                const next =
                                    !avatarMovementLocked;

                                setAvatarMovementLocked(
                                    next
                                );

                                setStatus(
                                    next
                                        ? 'Movimiento del avatar bloqueado.'
                                        : 'Movimiento del avatar permitido.'
                                );
                            } }>
                            <FaWalking />
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
                    </BuilderProGlobalToolbar>
                    </div> }
                </div> }

            { active && canBuild &&
                <>
                    <BuilderProToolRail
                        activeTool={ activeTool }
                        displayTool={ contextualTool }
                        locked={ pending }
                        onSelectTool={ selectPrimaryTool } />

                    <div
                        className="builder-pro-floating-tool-flyout"
                        data-tool-flyout={
                            toolFlyout ||
                            undefined
                        }>
                        <BuilderProToolFlyout
                            tool={ toolFlyout }
                            activeVariant={ activeToolVariant }
                            disabled={
                                pending ||
                                (
                                    toolLifecycle.isTransient &&
                                    contextualTool !== 'selection'
                                )
                            }
                            onSelectVariant={ selectToolVariant }
                            onClose={
                                () => setToolFlyout(null)
                            } />
                    </div>

                    <BuilderProOutlinerPanel
                        open={ outlinerOpen }
                        onClose={
                            () => setOutlinerOpen(false)
                        }>
                        <details className="builder-pro-section" data-builder-pro-family="layers" open>
                        <summary>Capas</summary>


                        <div className="builder-pro-section-body">
                        <div className="builder-pro-subtitle">
                        Capa de trabajo
                        </div>

                        <select
                        className="builder-pro-group-select"
                        disabled={
                        pending ||
                        layerPending
                        }
                        value={ layerScopeId }
                        onChange={
                        event =>
                        {
                        const value =
                        Number(
                        event.target.value
                        );

                        if(
                        value ===
                        LAYER_SCOPE_ALL
                        )
                        {
                        layerScopeIdRef.current =
                        LAYER_SCOPE_ALL;

                        setLayerScopeId(
                        LAYER_SCOPE_ALL
                        );

                        clearSelection();

                        setStatus(
                        'Capa de trabajo: todas las capas. Construcción Avanzada puede interactuar con cualquier furni; los nuevos quedarán en Sin capa.'
                        );

                        return;
                        }

                        if(
                        Number.isSafeInteger(
                        value
                        ) &&
                        value >= 0
                        )
                        {
                        layerScopeIdRef.current =
                        value;

                        setLayerScopeId(
                        value
                        );

                        clearSelection();

                        const label =
                        value === 0
                        ? 'Sin capa'
                        : (
                        savedLayersRef.current.find(
                        layer =>
                        layer.id === value
                        )?.name ||
                        'Capa'
                        );

                        setStatus(
                        value > 0
                        ? `Capa de trabajo: ${ label }. Todo Construcción Avanzada queda limitado a esta capa y los furnis nuevos entran en ella.`
                        : 'Capa de trabajo: Sin capa. Todo Construcción Avanzada queda limitado a los furnis sin capa.'
                        );
                        }
                        }
                        }>
                        <option
                        value={ LAYER_SCOPE_ALL }>
                        Todas las capas
                        </option>

                        <option value={ 0 }>
                        Sin capa
                        </option>

                        { savedLayers.map(
                        layer =>
                        <option
                        key={ `work-${ layer.id }` }
                        value={ layer.id }>
                        { `${ layer.name } · ${ layer.itemIds.length } furnis` }
                        </option>
                        ) }
                        </select>

                        <div className="builder-pro-hint">
                        La capa de trabajo limita toda la interacción de Construcción Avanzada: selección, área, mover, rotar, recoger y acciones avanzadas. Los furnis nuevos entran directamente en ella. Los grupos bloqueados siguen siendo atómicos aunque crucen capas.
                        </div>


                        <div className="builder-pro-subtitle">
                        Outliner
                        </div>

                        <div className="builder-pro-outliner-search">
                        <FaSearch />

                        <input
                        type="text"
                        value={ outlinerQuery }
                        placeholder="Buscar furni, grupo o ID..."
                        onChange={
                        event =>
                        setOutlinerQuery(
                        event.target.value
                        )
                        } />

                        <button
                        type="button"
                        className="builder-pro-outliner-toolbar-button"
                        title="Crear capa"
                        aria-label="Crear capa"
                        disabled={
                        pending ||
                        layerPending ||
                        savedLayers.length >= 50
                        }
                        onClick={ createLayer }>
                        <FaPlus />
                        </button>

                        <button
                        type="button"
                        className="builder-pro-outliner-toolbar-button"
                        title="Mostrar todas las capas"
                        aria-label="Mostrar todas las capas"
                        disabled={
                        pending ||
                        layerPending ||
                        (
                        !hiddenLayerIds.length &&
                        isolatedLayerId === null &&
                        dimmedOthersLayerId === null
                        )
                        }
                        onClick={ showAllLayers }>
                        <FaEye />
                        </button>
                        </div>

                        <div
                        className="builder-pro-outliner"
                        data-revision={ outlinerRevision }>
                        { savedLayers.map(
                        layer =>
                        renderOutlinerLayer(
                        layer.id,
                        layer.name
                        )
                        ) }

                        { renderOutlinerLayer(
                        0,
                        'Sin capa'
                        ) }
                        </div>


                        <div className="builder-pro-hint">
                        Clic activa la capa. Doble clic en su nombre renombra; ⋯ reúne mover, aislar, atenuar y eliminar.
                        </div>
                        </div>
                        </details>
                    </BuilderProOutlinerPanel>
                </> }
        </>
    );
}
