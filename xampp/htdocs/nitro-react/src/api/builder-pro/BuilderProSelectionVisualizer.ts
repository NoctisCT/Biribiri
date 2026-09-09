import { IRoomObject, IRoomObjectSpriteVisualization, RoomObjectCategory } from '@nitrots/nitro-renderer';
import { GetRoomEngine } from '../nitro/room/GetRoomEngine';
import { WiredSelectionFilter } from '../wired/WiredSelectionFilter';

export class BuilderProSelectionVisualizer
{
    private static readonly _selectionFilter =
        new WiredSelectionFilter(0xFFFFFF, 0x55B7FF);

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

    public static show(objectId: number): void
    {
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
