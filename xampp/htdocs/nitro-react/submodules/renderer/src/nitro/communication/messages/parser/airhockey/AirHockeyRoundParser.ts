import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class AirHockeyRoundParser implements IMessageParser
{
    private _itemId: number;
    private _event: string;
    private _side: number;
    private _scoreLeft: number;
    private _scoreRight: number;

    public flush(): boolean
    {
        this._itemId = 0;
        this._event = '';
        this._side = 0;
        this._scoreLeft = 0;
        this._scoreRight = 0;
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;
        this._itemId = wrapper.readInt();
        this._event = wrapper.readString();
        this._side = wrapper.readInt();
        this._scoreLeft = wrapper.readInt();
        this._scoreRight = wrapper.readInt();
        return true;
    }

    public get itemId(): number { return this._itemId; }
    public get event(): string { return this._event; }
    public get side(): number { return this._side; }
    public get scoreLeft(): number { return this._scoreLeft; }
    public get scoreRight(): number { return this._scoreRight; }
}
