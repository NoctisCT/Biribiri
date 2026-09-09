import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BiribiriWardrobeStateParser } from '../../parser';

export class BiribiriWardrobeStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, BiribiriWardrobeStateParser);
    }

    public getParser(): BiribiriWardrobeStateParser
    {
        return this.parser as BiribiriWardrobeStateParser;
    }
}
