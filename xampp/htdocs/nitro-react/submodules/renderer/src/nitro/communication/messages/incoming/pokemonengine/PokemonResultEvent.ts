import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { PokemonResultParser } from '../../parser/pokemonengine';

export class PokemonResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, PokemonResultParser);
    }

    public getParser(): PokemonResultParser
    {
        return this.parser as PokemonResultParser;
    }
}
