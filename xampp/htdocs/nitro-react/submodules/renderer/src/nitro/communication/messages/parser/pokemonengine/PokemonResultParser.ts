import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export interface PokemonResultError
{
    code: string;
    message: string;
}

export type PokemonResultPayload = Record<string, unknown> | null;

export class PokemonResultParser implements IMessageParser
{
    private _action = 0;
    private _success = false;
    private _payload: PokemonResultPayload = null;

    public flush(): boolean
    {
        this._action = 0;
        this._success = false;
        this._payload = null;

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._action = wrapper.readInt();
        this._success = wrapper.readBoolean();

        const raw = wrapper.readString();

        try
        {
            this._payload = JSON.parse(raw) as PokemonResultPayload;
        }
        catch
        {
            this._payload = null;
            this._success = false;
        }

        return true;
    }

    public get action(): number
    {
        return this._action;
    }

    public get success(): boolean
    {
        return this._success;
    }

    public get payload(): PokemonResultPayload
    {
        return this._payload;
    }

    public get error(): PokemonResultError | null
    {
        if(this._success || !this._payload) return null;

        return this._payload as unknown as PokemonResultError;
    }
}
