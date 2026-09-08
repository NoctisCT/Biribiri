import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { FollowStateParser } from '../../parser/interactions';

export class FollowStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, FollowStateParser);
    }

    public getParser(): FollowStateParser
    {
        return this.parser as FollowStateParser;
    }
}
