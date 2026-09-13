import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProRadialRepeatResultParser } from '../../parser/builderpro';

export class BuilderProRadialRepeatResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProRadialRepeatResultParser
        );
    }

    public getParser(): BuilderProRadialRepeatResultParser
    {
        return this.parser as BuilderProRadialRepeatResultParser;
    }
}
