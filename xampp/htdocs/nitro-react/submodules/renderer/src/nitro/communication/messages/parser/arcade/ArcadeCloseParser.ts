import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class ArcadeCloseParser implements IMessageParser
{
    private _itemId = 0;
    private _gameKey = '';
    private _reason = '';

    public flush(): boolean
    {
        this._itemId = 0;
        this._gameKey = '';
        this._reason = '';

        return true;
    }

    public parse(
        wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._itemId = wrapper.readInt();
        this._gameKey = wrapper.readString();
        this._reason = wrapper.readString();

        return true;
    }

    public get itemId(): number
    {
        return this._itemId;
    }

    public get gameKey(): string
    {
        return this._gameKey;
    }

    public get reason(): string
    {
        return this._reason;
    }
}
