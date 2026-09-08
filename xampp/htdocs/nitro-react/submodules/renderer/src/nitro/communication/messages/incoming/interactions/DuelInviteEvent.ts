import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { DuelInviteParser } from '../../parser/interactions';

export class DuelInviteEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, DuelInviteParser);
    }

    public getParser(): DuelInviteParser
    {
        return this.parser as DuelInviteParser;
    }
}
