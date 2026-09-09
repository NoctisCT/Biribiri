import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { LiftShiftOpenParser } from '../../parser';

export class LiftShiftOpenEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            LiftShiftOpenParser
        );
    }

    public getParser(): LiftShiftOpenParser
    {
        return this.parser as LiftShiftOpenParser;
    }
}
