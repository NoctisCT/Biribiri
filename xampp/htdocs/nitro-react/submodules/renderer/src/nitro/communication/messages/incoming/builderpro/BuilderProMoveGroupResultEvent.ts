import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProMoveGroupResultParser } from '../../parser/builderpro';

export class BuilderProMoveGroupResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(callBack, BuilderProMoveGroupResultParser);
    }

    public getParser(): BuilderProMoveGroupResultParser
    {
        return this.parser as BuilderProMoveGroupResultParser;
    }
}
