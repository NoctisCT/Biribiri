import { RoomEngineEvent } from './RoomEngineEvent';

export class RoomEngineTilePointerEvent extends RoomEngineEvent
{
    public static TILE_POINTER_DOWN: string = 'REE_TILE_POINTER_DOWN';
    public static TILE_POINTER_MOVE: string = 'REE_TILE_POINTER_MOVE';
    public static TILE_POINTER_UP: string = 'REE_TILE_POINTER_UP';

    private _tileX: number;
    private _tileY: number;
    private _tileZ: number;
    private _altKey: boolean;
    private _ctrlKey: boolean;
    private _shiftKey: boolean;

    constructor(
        type: string,
        roomId: number,
        tileX: number,
        tileY: number,
        tileZ: number,
        altKey: boolean = false,
        ctrlKey: boolean = false,
        shiftKey: boolean = false)
    {
        super(type, roomId);

        this._tileX = tileX;
        this._tileY = tileY;
        this._tileZ = tileZ;
        this._altKey = altKey;
        this._ctrlKey = ctrlKey;
        this._shiftKey = shiftKey;
    }

    public get tileX(): number { return this._tileX; }
    public get tileY(): number { return this._tileY; }
    public get tileZ(): number { return this._tileZ; }
    public get altKey(): boolean { return this._altKey; }
    public get ctrlKey(): boolean { return this._ctrlKey; }
    public get shiftKey(): boolean { return this._shiftKey; }
}
