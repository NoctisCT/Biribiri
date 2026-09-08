import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { AvatarReactionParser } from '../../parser/reactions';

export class AvatarReactionEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, AvatarReactionParser);
    }

    public getParser(): AvatarReactionParser
    {
        return this.parser as AvatarReactionParser;
    }
}
