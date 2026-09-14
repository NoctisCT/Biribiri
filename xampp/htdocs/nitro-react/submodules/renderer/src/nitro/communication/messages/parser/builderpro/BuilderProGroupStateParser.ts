import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface BuilderProSavedGroup
{
    id: number;
    name: string;
    locked: boolean;
    itemIds: number[];
}

export class BuilderProGroupStateParser implements IMessageParser
{
    private _requestId = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _groups: BuilderProSavedGroup[] = [];

    public flush(): boolean
    {
        this._requestId = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
        this._groups = [];

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._requestId = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._message = wrapper.readString();

        const groupCount = wrapper.readInt();

        if(groupCount < 0 || groupCount > 1000)
        {
            return false;
        }

        const groups: BuilderProSavedGroup[] = [];

        for(let groupIndex = 0;
            groupIndex < groupCount;
            groupIndex++)
        {
            const id = wrapper.readInt();
            const name = wrapper.readString();
            const locked = wrapper.readBoolean();
            const itemCount = wrapper.readInt();

            if(itemCount < 0 || itemCount > 4000)
            {
                return false;
            }

            const itemIds: number[] = [];

            for(let itemIndex = 0;
                itemIndex < itemCount;
                itemIndex++)
            {
                itemIds.push(
                    wrapper.readInt()
                );
            }

            groups.push({
                id,
                name,
                locked,
                itemIds
            });
        }

        this._groups = groups;

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

    public get groups(): BuilderProSavedGroup[]
    {
        return this._groups;
    }
}
