import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProLinearRepeatResultParser } from '../../parser/builderpro';

export class BuilderProLinearRepeatResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProLinearRepeatResultParser
        );
    }

    public getParser(): BuilderProLinearRepeatResultParser
    {
        return this.parser as BuilderProLinearRepeatResultParser;
    }
}
