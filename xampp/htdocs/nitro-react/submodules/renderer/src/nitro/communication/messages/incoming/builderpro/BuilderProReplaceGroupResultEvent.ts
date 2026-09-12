import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProReplaceGroupResultParser } from '../../parser/builderpro';

export class BuilderProReplaceGroupResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProReplaceGroupResultParser
        );
    }

    public getParser(): BuilderProReplaceGroupResultParser
    {
        return this.parser as BuilderProReplaceGroupResultParser;
    }
}
