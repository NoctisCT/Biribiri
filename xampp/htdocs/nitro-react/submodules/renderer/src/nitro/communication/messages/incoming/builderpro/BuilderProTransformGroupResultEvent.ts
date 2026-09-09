import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProTransformGroupResultParser } from '../../parser/builderpro';

export class BuilderProTransformGroupResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProTransformGroupResultParser
        );
    }

    public getParser(): BuilderProTransformGroupResultParser
    {
        return this.parser as BuilderProTransformGroupResultParser;
    }
}
