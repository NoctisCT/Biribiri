import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class AirHockeyStateParser implements IMessageParser
{
    private _itemId: number;
    private _playing: boolean;
    private _scoreLeft: number;
    private _scoreRight: number;
    private _puckX: number;
    private _puckY: number;
    private _puckVX: number;
    private _puckVY: number;
    private _leftX: number;
    private _leftY: number;
    private _rightX: number;
    private _rightY: number;
    private _playerLeft: number;
    private _playerRight: number;
    private _leftReady: boolean;
    private _rightReady: boolean;

    public flush(): boolean
    {
        this._itemId = 0;
        this._playing = false;
        this._scoreLeft = 0;
        this._scoreRight = 0;
        this._puckX = 5000;
        this._puckY = 3000;
        this._puckVX = 0;
        this._puckVY = 0;
        this._leftX = 1800;
        this._leftY = 3000;
        this._rightX = 8200;
        this._rightY = 3000;
        this._playerLeft = 0;
        this._playerRight = 0;
        this._leftReady = false;
        this._rightReady = false;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;
        this._itemId = wrapper.readInt();
        this._playing = wrapper.readInt() === 1;
        this._scoreLeft = wrapper.readInt();
        this._scoreRight = wrapper.readInt();
        this._puckX = wrapper.readInt();
        this._puckY = wrapper.readInt();
        this._puckVX = wrapper.readInt();
        this._puckVY = wrapper.readInt();
        this._leftX = wrapper.readInt();
        this._leftY = wrapper.readInt();
        this._rightX = wrapper.readInt();
        this._rightY = wrapper.readInt();
        this._playerLeft = wrapper.readInt();
        this._playerRight = wrapper.readInt();
        this._leftReady = wrapper.readInt() === 1;
        this._rightReady = wrapper.readInt() === 1;
        return true;
    }

    public get itemId(): number { return this._itemId; }
    public get playing(): boolean { return this._playing; }
    public get scoreLeft(): number { return this._scoreLeft; }
    public get scoreRight(): number { return this._scoreRight; }
    public get puckX(): number { return this._puckX; }
    public get puckY(): number { return this._puckY; }
    public get puckVX(): number { return this._puckVX; }
    public get puckVY(): number { return this._puckVY; }
    public get leftX(): number { return this._leftX; }
    public get leftY(): number { return this._leftY; }
    public get rightX(): number { return this._rightX; }
    public get rightY(): number { return this._rightY; }
    public get playerLeft(): number { return this._playerLeft; }
    public get playerRight(): number { return this._playerRight; }
    public get leftReady(): boolean { return this._leftReady; }
    public get rightReady(): boolean { return this._rightReady; }
}
