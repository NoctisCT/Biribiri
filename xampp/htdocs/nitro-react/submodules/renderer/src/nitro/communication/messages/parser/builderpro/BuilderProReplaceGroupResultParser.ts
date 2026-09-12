import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export class BuilderProReplaceGroupResultParser implements IMessageParser
{
    private _requestId = 0;
    private _operation = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _needed = 0;
    private _available = 0;
    private _referenceId = 0;
    private _referenceBaseItemId = 0;
    private _referenceName = '';
    private _affectedCount = 0;
    private _itemIds: number[] = [];

    public flush(): boolean
    {
        this._requestId = 0;
        this._operation = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
        this._needed = 0;
        this._available = 0;
        this._referenceId = 0;
        this._referenceBaseItemId = 0;
        this._referenceName = '';
        this._affectedCount = 0;
        this._itemIds = [];

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._requestId = wrapper.readInt();
        this._operation = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._message = wrapper.readString();
        this._needed = wrapper.readInt();
        this._available = wrapper.readInt();
        this._referenceId = wrapper.readInt();
        this._referenceBaseItemId = wrapper.readInt();
        this._referenceName = wrapper.readString();
        this._affectedCount = wrapper.readInt();

        const count = wrapper.readInt();

        if(count < 0 || count > 100)
        {
            return false;
        }

        this._itemIds = [];

        for(let index = 0;
                index < count;
                index++)
        {
            this._itemIds.push(
                wrapper.readInt()
            );
        }

        return true;
    }

    public get requestId(): number { return this._requestId; }
    public get operation(): number { return this._operation; }
    public get success(): boolean { return this._success; }
    public get code(): number { return this._code; }
    public get message(): string { return this._message; }
    public get needed(): number { return this._needed; }
    public get available(): number { return this._available; }
    public get referenceId(): number { return this._referenceId; }
    public get referenceBaseItemId(): number { return this._referenceBaseItemId; }
    public get referenceName(): string { return this._referenceName; }
    public get affectedCount(): number { return this._affectedCount; }
    public get itemIds(): number[] { return [ ...this._itemIds ]; }
}
