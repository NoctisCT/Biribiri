import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { SpaceInvadersOpenParser } from '../../parser';

export class SpaceInvadersOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, SpaceInvadersOpenParser);
    }

    public getParser(): SpaceInvadersOpenParser
    {
        return this.parser as SpaceInvadersOpenParser;
    }
}
