import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProPasteGroupResultParser } from '../../parser/builderpro';

export class BuilderProPasteGroupResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, BuilderProPasteGroupResultParser);
    }

    public getParser(): BuilderProPasteGroupResultParser
    {
        return this.parser as BuilderProPasteGroupResultParser;
    }
}
