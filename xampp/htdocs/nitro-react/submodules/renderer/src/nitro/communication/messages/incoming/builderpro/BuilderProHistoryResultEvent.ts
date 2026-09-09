import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProHistoryResultParser } from '../../parser/builderpro';

export class BuilderProHistoryResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, BuilderProHistoryResultParser);
    }

    public getParser(): BuilderProHistoryResultParser
    {
        return this.parser as BuilderProHistoryResultParser;
    }
}
