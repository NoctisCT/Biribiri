import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProFillRepeatResultParser } from '../../parser/builderpro';

export class BuilderProFillRepeatResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProFillRepeatResultParser
        );
    }

    public getParser(): BuilderProFillRepeatResultParser
    {
        return this.parser as BuilderProFillRepeatResultParser;
    }
}
