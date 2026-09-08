import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { DuelPublicParser } from '../../parser/interactions';

export class DuelPublicEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, DuelPublicParser);
    }

    public getParser(): DuelPublicParser
    {
        return this.parser as DuelPublicParser;
    }
}
