import { IMessageEvent } from '../../../../../api';
import { MessageEvent } from '../../../../../events';
import { BuilderProRoomBackupStateParser } from '../../parser/builderpro';

export class BuilderProRoomBackupStateEvent extends MessageEvent implements IMessageEvent
{
    constructor(callBack: Function)
    {
        super(
            callBack,
            BuilderProRoomBackupStateParser
        );
    }

    public getParser(): BuilderProRoomBackupStateParser
    {
        return this.parser as BuilderProRoomBackupStateParser;
    }
}
