import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { DuelStateParser } from '../../parser/interactions';

export class DuelStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, DuelStateParser);
    }

    public getParser(): DuelStateParser
    {
        return this.parser as DuelStateParser;
    }
}
