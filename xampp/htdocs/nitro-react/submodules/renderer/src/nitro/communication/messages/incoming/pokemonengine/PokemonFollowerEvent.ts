import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { PokemonFollowerParser } from '../../parser/pokemonengine';

export class PokemonFollowerEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: (event: PokemonFollowerEvent) => void)
    {
        super(callBack, PokemonFollowerParser);
    }

    public getParser(): PokemonFollowerParser
    {
        return this.parser as PokemonFollowerParser;
    }
}
