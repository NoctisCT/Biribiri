import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class BuilderProPasteGroupResultParser implements IMessageParser
{
    private _requestId = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _placedCount = 0;
    private _itemIds: number[] = [];

    public flush(): boolean
    {
        this._requestId = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
        this._placedCount = 0;
        this._itemIds = [];

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._requestId = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._message = wrapper.readString();
        this._placedCount = wrapper.readInt();

        const count = wrapper.readInt();

        this._itemIds = [];

        for(let index = 0; index < count; index++)
        {
            this._itemIds.push(
                wrapper.readInt()
            );
        }

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

    public get placedCount(): number
    {
        return this._placedCount;
    }

    public get itemIds(): number[]
    {
        return [ ...this._itemIds ];
    }
}
