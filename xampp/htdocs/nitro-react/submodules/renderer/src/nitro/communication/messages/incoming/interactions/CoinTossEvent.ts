import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { CoinTossParser } from '../../parser/interactions';

export class CoinTossEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, CoinTossParser);
    }

    public getParser(): CoinTossParser
    {
        return this.parser as CoinTossParser;
    }
}
