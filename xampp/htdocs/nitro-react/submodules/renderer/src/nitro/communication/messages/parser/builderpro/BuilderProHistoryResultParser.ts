import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class BuilderProHistoryResultParser implements IMessageParser
{
    private _requestId = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _affectedCount = 0;
    private _canUndo = false;
    private _canRedo = false;

    public flush(): boolean
    {
        this._requestId = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
        this._affectedCount = 0;
        this._canUndo = false;
        this._canRedo = false;

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._requestId = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._message = wrapper.readString();
        this._affectedCount = wrapper.readInt();
        this._canUndo = wrapper.readBoolean();
        this._canRedo = wrapper.readBoolean();

        return true;
    }

    public get requestId(): number
    {
        return this._requestId;
    }

    public get success(): boolean
    {
        return this._success;
    }

    public get code(): number
    {
        return this._code;
    }

    public get message(): string
    {
        return this._message;
    }

    public get affectedCount(): number
    {
        return this._affectedCount;
    }

    public get canUndo(): boolean
    {
        return this._canUndo;
    }

    public get canRedo(): boolean
    {
        return this._canRedo;
    }
}
