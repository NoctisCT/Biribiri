import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { PinballOpenParser } from '../../parser';

export class PinballOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            PinballOpenParser
        );
    }

    public getParser(): PinballOpenParser
    {
        return this.parser as PinballOpenParser;
    }
}
