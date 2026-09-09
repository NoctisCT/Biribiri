import { IRoomObject, IRoomObjectSpriteVisualization, RoomObjectCategory } from '@nitrots/nitro-renderer';
import { GetRoomEngine } from '../nitro/room/GetRoomEngine';
import { WiredSelectionFilter } from '../wired/WiredSelectionFilter';

export class BuilderProSelectionVisualizer
{
    private static readonly _selectionFilter =
        new WiredSelectionFilter(0xFFFFFF, 0x55B7FF);

    private static readonly _pivotFilter =
        new WiredSelectionFilter(0xFFFFFF, 0xFFB000);

    private static _pivotId: number | null = null;

    private static _enabled = true;

    public static get enabled(): boolean
    {
        return BuilderProSelectionVisualizer._enabled;
    }

    public static setEnabled(
        enabled: boolean,
        objectIds: number[] = []
    ): void
    {
        BuilderProSelectionVisualizer._enabled =
            enabled;

        if(enabled)
        {
            BuilderProSelectionVisualizer.refresh(
                objectIds
            );

            return;
        }

        BuilderProSelectionVisualizer.clear(
            objectIds
        );
    }

    private static getRoomObject(objectId: number): IRoomObject
    {
        const roomEngine = GetRoomEngine();

        if(!roomEngine) return null;

        return roomEngine.getRoomObject(
            roomEngine.activeRoomId,
            objectId,
            RoomObjectCategory.FLOOR
        );
    }

    private static showPivotVisual(
        objectId: number
    ): void
    {
        const roomObject =
            BuilderProSelectionVisualizer.getRoomObject(
                objectId
            );

        if(!roomObject) return;

        const visualization =
            roomObject.visualization as
                IRoomObjectSpriteVisualization;

        if(!visualization) return;

        for(const sprite of visualization.sprites)
        {
            if(sprite.blendMode === 1) continue;

            const filters = sprite.filters
                ? [ ...sprite.filters ]
                : [];

            const withoutSelection =
                filters.filter(
                    filter =>
                        filter !==
                        BuilderProSelectionVisualizer
                            ._selectionFilter &&
                        filter !==
                        BuilderProSelectionVisualizer
                            ._pivotFilter
                );

            sprite.filters = [
                ...withoutSelection,
                BuilderProSelectionVisualizer
                    ._pivotFilter
            ];
        }
    }

    private static hidePivotVisual(
        objectId: number
    ): void
    {
        const roomObject =
            BuilderProSelectionVisualizer.getRoomObject(
                objectId
            );

        if(!roomObject) return;

        const visualization =
            roomObject.visualization as
                IRoomObjectSpriteVisualization;

        if(!visualization) return;

        for(const sprite of visualization.sprites)
        {
            if(!sprite.filters) continue;

            sprite.filters =
                sprite.filters.filter(
                    filter =>
                        filter !==
                        BuilderProSelectionVisualizer
                            ._pivotFilter
                );
        }
    }

    public static setPivot(
        objectId: number | null
    ): void
    {
        const previous =
            BuilderProSelectionVisualizer._pivotId;

        BuilderProSelectionVisualizer._pivotId =
            null;

        if(previous !== null)
        {
            BuilderProSelectionVisualizer
                .hidePivotVisual(previous);

            if(
                BuilderProSelectionVisualizer
                    ._enabled
            )
            {
                BuilderProSelectionVisualizer
                    .show(previous);
            }
        }

        BuilderProSelectionVisualizer._pivotId =
            objectId;

        if(objectId === null)
        {
            return;
        }

        BuilderProSelectionVisualizer.hide(
            objectId
        );

        BuilderProSelectionVisualizer
            .showPivotVisual(objectId);
    }

    public static clearPivot(): void
    {
        BuilderProSelectionVisualizer.setPivot(
            null
        );
    }

    public static show(objectId: number): void
    {
        if(!BuilderProSelectionVisualizer._enabled)
        {
            BuilderProSelectionVisualizer.hide(
                objectId
            );

            if(
                objectId ===
                BuilderProSelectionVisualizer._pivotId
            )
            {
                BuilderProSelectionVisualizer
                    .showPivotVisual(objectId);
            }

            return;
        }

        if(
            objectId ===
            BuilderProSelectionVisualizer._pivotId
        )
        {
            BuilderProSelectionVisualizer
                .showPivotVisual(objectId);

            return;
        }

        const roomObject =
            BuilderProSelectionVisualizer.getRoomObject(objectId);

        if(!roomObject) return;

        const visualization =
            roomObject.visualization as IRoomObjectSpriteVisualization;

        if(!visualization) return;

        for(const sprite of visualization.sprites)
        {
            if(sprite.blendMode === 1) continue;

            const filters = sprite.filters
                ? [ ...sprite.filters ]
                : [];

            if(filters.includes(
                BuilderProSelectionVisualizer._selectionFilter
            ))
            {
                continue;
            }

            sprite.filters = [
                ...filters,
                BuilderProSelectionVisualizer._selectionFilter
            ];
        }
    }

    public static hide(objectId: number): void
    {
        const roomObject =
            BuilderProSelectionVisualizer.getRoomObject(objectId);

        if(!roomObject) return;

        const visualization =
            roomObject.visualization as IRoomObjectSpriteVisualization;

        if(!visualization) return;

        for(const sprite of visualization.sprites)
        {
            if(!sprite.filters) continue;

            sprite.filters = sprite.filters.filter(
                filter =>
                    filter !==
                    BuilderProSelectionVisualizer._selectionFilter
            );
        }
    }

    public static clear(objectIds: number[]): void
    {
        for(const objectId of objectIds)
        {
            BuilderProSelectionVisualizer.hide(objectId);
        }
    }

    public static refresh(objectIds: number[]): void
    {
        for(const objectId of objectIds)
        {
            BuilderProSelectionVisualizer.show(objectId);
        }
    }
}
