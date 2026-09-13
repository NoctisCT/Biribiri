export type BuilderProInspectorGroupState = {
    id: number;
    name: string;
    locked: boolean;
    itemIds: number[];
};

export type BuilderProInspectorLayerState = {
    id: number;
    name: string;
    itemIds: number[];
};

export type BuilderProInspectorState = {
    groups: BuilderProInspectorGroupState[];
    layers: BuilderProInspectorLayerState[];
    traversableIds: number[];
    hiddenLayerIds: number[];
    isolatedLayerId: number | null;
    dimmedOthersLayerId: number | null;
    hiddenItemIds: number[];
    dimmedItemIds: number[];
    lockedItemIds: number[];
};

export type BuilderProInspectorItemState = {
    layerName: string;
    groupName: string;
    groupLocked: boolean;
    traversable: boolean;
    visibility: 'Normal' | 'Atenuado' | 'Oculto';
    locked: boolean;
};

const EMPTY_STATE: BuilderProInspectorState = {
    groups: [],
    layers: [],
    traversableIds: [],
    hiddenLayerIds: [],
    isolatedLayerId: null,
    dimmedOthersLayerId: null,
    hiddenItemIds: [],
    dimmedItemIds: [],
    lockedItemIds: []
};

let state: BuilderProInspectorState = EMPTY_STATE;

const listeners =
    new Set<() => void>();

const emit = (): void =>
{
    for(const listener of Array.from(listeners))
    {
        listener();
    }
};

export function SetBuilderProInspectorState(
    nextState: BuilderProInspectorState
): void
{
    state = nextState;
    emit();
}

export function ClearBuilderProInspectorState(): void
{
    state = EMPTY_STATE;
    emit();
}

export function SubscribeBuilderProInspectorState(
    listener: () => void
): () => void
{
    listeners.add(listener);

    return () =>
    {
        listeners.delete(listener);
    };
}

export function GetBuilderProInspectorItemState(
    itemId: number
): BuilderProInspectorItemState
{
    const layer =
        state.layers.find(
            entry =>
                entry.itemIds.includes(
                    itemId
                )
        ) || null;

    const group =
        state.groups.find(
            entry =>
                entry.itemIds.includes(
                    itemId
                )
        ) || null;

    const layerId =
        layer?.id ?? 0;

    const hiddenByLayer =
        state.hiddenLayerIds.includes(
            layerId
        ) ||
        (
            state.isolatedLayerId !== null &&
            state.isolatedLayerId !== layerId
        );

    const dimmedByLayer =
        state.dimmedOthersLayerId !== null &&
        state.dimmedOthersLayerId !== layerId;

    let visibility:
        BuilderProInspectorItemState['visibility'] =
        'Normal';

    if(
        state.hiddenItemIds.includes(itemId) ||
        hiddenByLayer
    )
    {
        visibility = 'Oculto';
    }
    else if(
        state.dimmedItemIds.includes(itemId) ||
        dimmedByLayer
    )
    {
        visibility = 'Atenuado';
    }

    return {
        layerName: layer?.name || 'Sin capa',
        groupName: group?.name || 'Sin grupo',
        groupLocked: !!group?.locked,
        traversable:
            state.traversableIds.includes(
                itemId
            ),
        visibility,
        locked:
            state.lockedItemIds.includes(
                itemId
            )
    };
}
