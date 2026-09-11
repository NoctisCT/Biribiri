import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProBlueprintStateParser } from '../../parser/builderpro';

export class BuilderProBlueprintStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProBlueprintStateParser
        );
    }

    public getParser(): BuilderProBlueprintStateParser
    {
        return this.parser as BuilderProBlueprintStateParser;
    }
}
