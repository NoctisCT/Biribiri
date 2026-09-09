import { RoomEngineEvent } from './RoomEngineEvent';

export class RoomEngineTileClickEvent extends RoomEngineEvent
{
    public static TILE_CLICK: string = 'REE_TILE_CLICK';

    private _tileX: number;
    private _tileY: number;
    private _tileZ: number;
    private _consumed: boolean;

    constructor(
        roomId: number,
        tileX: number,
        tileY: number,
        tileZ: number)
    {
        super(
            RoomEngineTileClickEvent.TILE_CLICK,
            roomId
        );

        this._tileX = tileX;
        this._tileY = tileY;
        this._tileZ = tileZ;
        this._consumed = false;
    }

    public consume(): void
    {
        this._consumed = true;
    }

    public get consumed(): boolean
    {
        return this._consumed;
    }

    public get tileX(): number
    {
        return this._tileX;
    }

    public get tileY(): number
    {
        return this._tileY;
    }

    public get tileZ(): number
    {
        return this._tileZ;
    }
}
