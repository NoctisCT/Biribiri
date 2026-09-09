import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { PacManOpenParser } from '../../parser';

export class PacManOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            PacManOpenParser
        );
    }

    public getParser(): PacManOpenParser
    {
        return this.parser as PacManOpenParser;
    }
}
