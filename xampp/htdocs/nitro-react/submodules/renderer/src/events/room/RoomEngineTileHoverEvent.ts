import { RoomEngineEvent } from './RoomEngineEvent';

export class RoomEngineTileHoverEvent extends RoomEngineEvent
{
    public static TILE_HOVER: string = 'REE_TILE_HOVER';
    private _tileX: number;
    private _tileY: number;
    private _tileZ: number;

    constructor(roomId: number, tileX: number, tileY: number, tileZ: number)
    {
        super(RoomEngineTileHoverEvent.TILE_HOVER, roomId);
        this._tileX = tileX;
        this._tileY = tileY;
        this._tileZ = tileZ;
    }

    public get tileX(): number { return this._tileX; }
    public get tileY(): number { return this._tileY; }
    public get tileZ(): number { return this._tileZ; }
}
