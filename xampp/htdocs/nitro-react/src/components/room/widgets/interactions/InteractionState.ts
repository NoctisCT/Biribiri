export interface FollowInteractionState
{
    active: boolean;
    targetUserId: number;
    targetName: string;
}

type FollowListener = (state: FollowInteractionState) => void;

let followState: FollowInteractionState = {
    active: false,
    targetUserId: 0,
    targetName: ''
};

const followListeners = new Set<FollowListener>();

export const GetFollowInteractionState = (): FollowInteractionState =>
{
    return followState;
}

export const SetFollowInteractionState = (
    active: boolean,
    targetUserId: number,
    targetName: string
): void =>
{
    followState = {
        active,
        targetUserId,
        targetName
    };

    followListeners.forEach(listener => listener(followState));
}

export const SubscribeFollowInteractionState = (
    listener: FollowListener
): (() => void) =>
{
    followListeners.add(listener);

    return () =>
    {
        followListeners.delete(listener);
    }
}
