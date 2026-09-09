import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class AirHockeyCloseParser implements IMessageParser
{
    private _itemId: number;
    private _reason: string;

    public flush(): boolean
    {
        this._itemId = 0;
        this._reason = '';
        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;
        this._itemId = wrapper.readInt();
        this._reason = wrapper.readString();
        return true;
    }

    public get itemId(): number { return this._itemId; }
    public get reason(): string { return this._reason; }
}
