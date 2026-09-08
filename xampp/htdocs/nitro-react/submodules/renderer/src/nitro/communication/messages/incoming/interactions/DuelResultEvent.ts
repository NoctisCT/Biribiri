import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { DuelResultParser } from '../../parser/interactions';

export class DuelResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, DuelResultParser);
    }

    public getParser(): DuelResultParser
    {
        return this.parser as DuelResultParser;
    }
}
