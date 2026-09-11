import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProPickupGroupResultParser } from '../../parser/builderpro';

export class BuilderProPickupGroupResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProPickupGroupResultParser
        );
    }

    public getParser(): BuilderProPickupGroupResultParser
    {
        return this.parser as BuilderProPickupGroupResultParser;
    }
}
