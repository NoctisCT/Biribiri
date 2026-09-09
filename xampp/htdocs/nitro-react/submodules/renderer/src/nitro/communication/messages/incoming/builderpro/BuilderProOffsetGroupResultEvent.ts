import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProOffsetGroupResultParser } from '../../parser/builderpro';

export class BuilderProOffsetGroupResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProOffsetGroupResultParser
        );
    }

    public getParser(): BuilderProOffsetGroupResultParser
    {
        return this.parser as BuilderProOffsetGroupResultParser;
    }
}
