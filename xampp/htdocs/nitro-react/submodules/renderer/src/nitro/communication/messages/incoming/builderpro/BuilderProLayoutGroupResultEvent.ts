import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProLayoutGroupResultParser } from '../../parser/builderpro';

export class BuilderProLayoutGroupResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProLayoutGroupResultParser
        );
    }

    public getParser(): BuilderProLayoutGroupResultParser
    {
        return this.parser as BuilderProLayoutGroupResultParser;
    }
}
