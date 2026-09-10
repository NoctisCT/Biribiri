import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProGroupStateParser } from '../../parser/builderpro';

export class BuilderProGroupStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProGroupStateParser
        );
    }

    public getParser(): BuilderProGroupStateParser
    {
        return this.parser as BuilderProGroupStateParser;
    }
}
