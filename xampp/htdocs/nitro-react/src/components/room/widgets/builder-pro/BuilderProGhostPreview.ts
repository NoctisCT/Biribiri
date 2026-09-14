import { RoomObjectCategory, RoomObjectVariable, Vector3d } from '@nitrots/nitro-renderer';
import { GetRoomEngine } from '../../../../api';

type BuilderProMutableRef<T> = {
    current: T;
};

export interface BuilderProGhostPreviewEntry
{
    baseItemId: number;
    x: number;
    y: number;
    z: number;
    rotation: number;
    state: number;
}

export const ClearBuilderProGhostPreview = <
    T extends BuilderProGhostPreviewEntry
>(
    roomId: number | null,
    ghostIdsRef: BuilderProMutableRef<number[]>,
    entriesRef: BuilderProMutableRef<T[]>,
    frameRef: BuilderProMutableRef<number | null>
): void =>
{
    if(frameRef.current !== null)
    {
        window.cancelAnimationFrame(
            frameRef.current
        );

        frameRef.current = null;
    }

    const roomEngine =
        GetRoomEngine();

    if(roomId !== null && roomEngine)
    {
        for(const ghostId of ghostIdsRef.current)
        {
            roomEngine.removeRoomObjectFloor(
                roomId,
                ghostId
            );
        }
    }

    ghostIdsRef.current = [];
    entriesRef.current = [];
};

export const SyncBuilderProGhostPreview = <
    T extends BuilderProGhostPreviewEntry
>(
    roomId: number | null,
    ghostIdBase: number,
    ghostIdsRef: BuilderProMutableRef<number[]>,
    entriesRef: BuilderProMutableRef<T[]>
): void =>
{
    const entries =
        entriesRef.current;

    const roomEngine =
        GetRoomEngine();

    if(
        !entries.length ||
        roomId === null ||
        !roomEngine
    )
    {
        return;
    }

    for(
        let index = 0;
        index < entries.length;
        index++
    )
    {
        const entry =
            entries[index];

        const ghostId =
            ghostIdBase - index;

        if(
            !ghostIdsRef.current.includes(
                ghostId
            )
        )
        {
            const queued =
                roomEngine.addFurnitureFloor(
                    roomId,
                    ghostId,
                    entry.baseItemId,
                    new Vector3d(
                        entry.x,
                        entry.y,
                        entry.z
                    ),
                    new Vector3d(
                        entry.rotation * 45
                    ),
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

            if(queued)
            {
                ghostIdsRef.current.push(
                    ghostId
                );
            }
        }

        const roomObject =
            roomEngine.getRoomObject(
                roomId,
                ghostId,
                RoomObjectCategory.FLOOR
            ) as any;

        if(!roomObject)
        {
            continue;
        }

        roomObject.setLocation(
            new Vector3d(
                entry.x,
                entry.y,
                entry.z
            )
        );

        roomObject.setDirection(
            new Vector3d(
                entry.rotation * 45
            )
        );

        if(roomObject.model)
        {
            roomObject.model.setValue(
                RoomObjectVariable
                    .FURNITURE_ALPHA_MULTIPLIER,
                0.45
            );
        }

        const sprites =
            (
                roomObject.visualization as any
            )?.sprites;

        if(Array.isArray(sprites))
        {
            for(const sprite of sprites)
            {
                if(sprite)
                {
                    sprite.clickHandling =
                        false;
                }
            }
        }
    }
};

export const RenderBuilderProGhostPreview = <
    T extends BuilderProGhostPreviewEntry
>(
    entries: T[],
    entriesRef: BuilderProMutableRef<T[]>,
    frameRef: BuilderProMutableRef<number | null>,
    clearPreview: () => void,
    syncPreview: () => void
): void =>
{
    clearPreview();

    entriesRef.current =
        entries.map(
            entry => ({
                ...entry
            } as T)
        );

    syncPreview();

    frameRef.current =
        window.requestAnimationFrame(
            () =>
            {
                frameRef.current =
                    null;

                syncPreview();

                window.requestAnimationFrame(
                    () =>
                        syncPreview()
                );
            }
        );
};
