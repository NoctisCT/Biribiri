import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProCopyGroupResultParser } from '../../parser/builderpro';

export class BuilderProCopyGroupResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProCopyGroupResultParser
        );
    }

    public getParser(): BuilderProCopyGroupResultParser
    {
        return this.parser as BuilderProCopyGroupResultParser;
    }
}
