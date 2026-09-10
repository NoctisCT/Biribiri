import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProTraversalStateParser } from '../../parser/builderpro';

export class BuilderProTraversalStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProTraversalStateParser
        );
    }

    public getParser(): BuilderProTraversalStateParser
    {
        return this.parser as BuilderProTraversalStateParser;
    }
}
