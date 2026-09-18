import { IMessageComposer } from '../../../../../api';

export class PokemonCommandComposer implements IMessageComposer<ConstructorParameters<typeof PokemonCommandComposer>>
{
    private _data: ConstructorParameters<typeof PokemonCommandComposer>;

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
