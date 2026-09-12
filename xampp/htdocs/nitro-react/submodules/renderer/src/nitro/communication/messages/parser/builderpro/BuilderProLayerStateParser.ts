import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface BuilderProSavedLayer
{
    id: number;
    name: string;
    sortOrder: number;
    itemIds: number[];
}

export class BuilderProLayerStateParser implements IMessageParser
{
    private _requestId = 0;
    private _success = false;
    private _code = 0;
    private _message = '';
    private _layers: BuilderProSavedLayer[] = [];

    public flush(): boolean
    {
        this._requestId = 0;
        this._success = false;
        this._code = 0;
        this._message = '';
        this._layers = [];

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._requestId = wrapper.readInt();
        this._success = wrapper.readBoolean();
        this._code = wrapper.readInt();
        this._message = wrapper.readString();

        const layerCount = wrapper.readInt();

        if(layerCount < 0 || layerCount > 200)
        {
            return false;
        }

        const layers: BuilderProSavedLayer[] = [];

        for(let layerIndex = 0;
            layerIndex < layerCount;
            layerIndex++)
        {
            const id = wrapper.readInt();
            const name = wrapper.readString();
            const sortOrder = wrapper.readInt();
            const itemCount = wrapper.readInt();

            if(itemCount < 0 || itemCount > 10000)
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

            layers.push({
                id,
                name,
                sortOrder,
                itemIds
            });
        }

        this._layers = layers;

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

    public get layers(): BuilderProSavedLayer[]
    {
        return this._layers;
    }
}
