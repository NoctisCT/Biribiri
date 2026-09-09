import { AirHockeyLeaveComposer } from '@nitrots/nitro-renderer';
import { SendMessageComposer } from '..';

export function LeaveAirHockey(itemId: number): void
{
    if(itemId <= 0) return;
    SendMessageComposer(new AirHockeyLeaveComposer(itemId));
}
