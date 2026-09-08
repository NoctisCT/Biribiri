import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { ReactionProfileParser } from '../../parser/reactions';

export class ReactionProfileEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, ReactionProfileParser);
    }

    public getParser(): ReactionProfileParser
    {
        return this.parser as ReactionProfileParser;
    }
}
