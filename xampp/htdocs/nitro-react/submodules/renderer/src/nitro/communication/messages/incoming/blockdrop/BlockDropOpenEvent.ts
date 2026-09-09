import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BlockDropOpenParser } from '../../parser';

export class BlockDropOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BlockDropOpenParser
        );
    }

    public getParser(): BlockDropOpenParser
    {
        return this.parser as BlockDropOpenParser;
    }
}
