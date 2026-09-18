import { IMessageComposer } from '../../../../../api';

export const POKEMON_FOLLOWER_REQUEST_SNAPSHOT = 1;
export const POKEMON_FOLLOWER_INTERACT = 2;
export const POKEMON_FOLLOWER_OWN_GESTURE = 3;

export class PokemonFollowerComposer implements IMessageComposer<ConstructorParameters<typeof PokemonFollowerComposer>>
{
    private _data: ConstructorParameters<typeof PokemonFollowerComposer>;

    constructor(action: number, ...args: Array<string | number | boolean>)
    {
        this._data = [ action, ...args ];
    }

    public getMessageArray()
    {
        return this._data;
    }

    public dispose(): void
    {
        return;
    }
}
