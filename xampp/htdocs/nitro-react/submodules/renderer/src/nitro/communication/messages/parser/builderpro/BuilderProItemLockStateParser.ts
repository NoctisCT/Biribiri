import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class BuilderProItemLockStateParser implements IMessageParser
{
    private _requestId = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _itemIds: number[] = [];

    public flush(): boolean
    {
        this._requestId = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
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

        const count = wrapper.readInt();

        if(count < 0 || count > 10000)
        {
            return false;
        }

        const ids: number[] = [];

        for(let index = 0; index < count; index++)
        {
            ids.push(
                wrapper.readInt()
            );
        }

        this._itemIds = ids;

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

    public get itemIds(): number[]
    {
        return this._itemIds;
    }
}
