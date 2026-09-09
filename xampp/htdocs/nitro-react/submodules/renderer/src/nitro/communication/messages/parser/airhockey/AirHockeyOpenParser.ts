import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class AirHockeyOpenParser implements IMessageParser
{
    private _itemId: number;
    private _side: number;
    private _fieldWidth: number;
    private _fieldHeight: number;
    private _winScore: number;
    private _playerLeft: number;
    private _playerRight: number;

    public flush(): boolean
    {
        this._itemId = 0;
        this._side = 0;
        this._fieldWidth = 10000;
        this._fieldHeight = 6000;
        this._winScore = 7;
        this._playerLeft = 0;
        this._playerRight = 0;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;
        console.log('[AH-CLIENT-TRACE] PARSE_6003');
        this._itemId = wrapper.readInt();
        this._side = wrapper.readInt();
        this._fieldWidth = wrapper.readInt();
        this._fieldHeight = wrapper.readInt();
        this._winScore = wrapper.readInt();
        this._playerLeft = wrapper.readInt();
        this._playerRight = wrapper.readInt();
        return true;
    }

    public get itemId(): number { return this._itemId; }
    public get side(): number { return this._side; }
    public get fieldWidth(): number { return this._fieldWidth; }
    public get fieldHeight(): number { return this._fieldHeight; }
    public get winScore(): number { return this._winScore; }
    public get playerLeft(): number { return this._playerLeft; }
    public get playerRight(): number { return this._playerRight; }
}
