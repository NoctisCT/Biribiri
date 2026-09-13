import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProGridRepeatResultParser } from '../../parser/builderpro';

export class BuilderProGridRepeatResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProGridRepeatResultParser
        );
    }

    public getParser(): BuilderProGridRepeatResultParser
    {
        return this.parser as BuilderProGridRepeatResultParser;
    }
}
