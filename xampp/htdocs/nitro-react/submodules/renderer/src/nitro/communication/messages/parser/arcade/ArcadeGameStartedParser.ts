import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class ArcadeGameStartedParser implements IMessageParser
{
    private _success = false;
    private _message = '';
    private _itemId = 0;
    private _gameKey = '';
    private _token = '';

    public flush(): boolean
    {
        this._success = false;
        this._message = '';
        this._itemId = 0;
        this._gameKey = '';
        this._token = '';

        return true;
    }

    public parse(
        wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._success = wrapper.readBoolean();
        this._message = wrapper.readString();
        this._itemId = wrapper.readInt();
        this._gameKey = wrapper.readString();
        this._token = wrapper.readString();

        return true;
    }

    public get success(): boolean
    {
        return this._success;
    }

    public get message(): string
    {
        return this._message;
    }

    public get itemId(): number
    {
        return this._itemId;
    }

    public get gameKey(): string
    {
        return this._gameKey;
    }

    public get token(): string
    {
        return this._token;
    }
}
