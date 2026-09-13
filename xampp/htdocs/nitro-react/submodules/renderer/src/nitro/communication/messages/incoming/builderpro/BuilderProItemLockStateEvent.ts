import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProItemLockStateParser } from '../../parser/builderpro';

export class BuilderProItemLockStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProItemLockStateParser
        );
    }

    public getParser(): BuilderProItemLockStateParser
    {
        return this.parser as BuilderProItemLockStateParser;
    }
}
