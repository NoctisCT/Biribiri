import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProLayerStateParser } from '../../parser/builderpro';

export class BuilderProLayerStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProLayerStateParser
        );
    }

    public getParser(): BuilderProLayerStateParser
    {
        return this.parser as BuilderProLayerStateParser;
    }
}
