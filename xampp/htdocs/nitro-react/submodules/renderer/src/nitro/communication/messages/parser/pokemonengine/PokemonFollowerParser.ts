import { IMessageDataWrapper, IMessageParser } from '../../../../../api';

export const POKEMON_FOLLOWER_SNAPSHOT = 1;
export const POKEMON_FOLLOWER_STEP = 2;
export const POKEMON_FOLLOWER_ADDED = 3;
export const POKEMON_FOLLOWER_REMOVED = 4;
export const POKEMON_FOLLOWER_ANIMATION = 5;

export interface PokemonFollowerEntry
{
    userId: number;
    ownedId: number;
    speciesId: number;
    formId: number;
    shiny: boolean;
    x: number;
    y: number;
    z: number;
    direction: number;
    state: string;
    animation: string;
    fallback: string;
    name: string;
}

export class PokemonFollowerParser implements IMessageParser
{
    private _type = 0;
    private _entries: PokemonFollowerEntry[] = [];

    public flush(): boolean
    {
        this._type = 0;
        this._entries = [];

        return true;
    }

    public parse(wrapper: IMessageDataWrapper): boolean
    {
        if(!wrapper) return false;

        this._type = wrapper.readInt();
        this._entries = [];

        const total = wrapper.readInt();

        for(let i = 0; i < total; i++)
        {
            const userId = wrapper.readInt();
            const ownedId = wrapper.readInt();
            const speciesId = wrapper.readInt();
            const formId = wrapper.readInt();
            const shiny = wrapper.readBoolean();
            const x = wrapper.readInt();
            const y = wrapper.readInt();
            const hundredths = wrapper.readInt();
            const direction = wrapper.readInt();
            const state = wrapper.readString();
            const animation = wrapper.readString();
            const fallback = wrapper.readString();
            const name = wrapper.readString();

            this._entries.push({
                userId,
                ownedId,
                speciesId,
                formId,
                shiny,
                x,
                y,
                z: hundredths / 100,
                direction,
                state,
                animation,
                fallback,
                name
            });
        }

        return true;
    }

    public get type(): number
    {
        return this._type;
    }

    public get entries(): PokemonFollowerEntry[]
    {
        return this._entries;
    }
}
