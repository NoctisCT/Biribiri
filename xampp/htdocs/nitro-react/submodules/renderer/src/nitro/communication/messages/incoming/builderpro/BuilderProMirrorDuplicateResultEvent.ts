import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProMirrorDuplicateResultParser } from '../../parser/builderpro';

export class BuilderProMirrorDuplicateResultEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProMirrorDuplicateResultParser
        );
    }

    public getParser(): BuilderProMirrorDuplicateResultParser
    {
        return this.parser as BuilderProMirrorDuplicateResultParser;
    }
}
