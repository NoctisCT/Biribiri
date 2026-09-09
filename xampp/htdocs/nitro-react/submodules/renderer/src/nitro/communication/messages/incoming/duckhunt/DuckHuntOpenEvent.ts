import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { DuckHuntOpenParser } from '../../parser';

export class DuckHuntOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            DuckHuntOpenParser
        );
    }

    public getParser(): DuckHuntOpenParser
    {
        return this.parser as DuckHuntOpenParser;
    }
}
