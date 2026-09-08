import { AvatarReactionEvent, ReactionProfileEvent, RoomObjectCategory } from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { useMessageEvent } from '../../../../hooks';
import { ObjectLocationView } from '../object-location/ObjectLocationView';
import { ReactionCustomizerView } from './ReactionCustomizerView';
import { ApplyReactionProfile, REACTION_DISPLAY_FLOATING, REACTION_DISPLAY_HIDDEN, RequestReactionProfile, useReactionProfile } from './ReactionState';
import './AvatarReactionsView.scss';

interface ReactionItem
{
    key: number;
    objectId: number;
    reactionId: number;
    glyph: string;
}

const REACTION_DURATION = 2200;

export const AvatarReactionsView: FC<{}> = props =>
{
    const profile = useReactionProfile();
    const [ reactions, setReactions ] = useState<ReactionItem[]>([]);
    const nextKey = useRef(0);
    const timers = useRef<number[]>([]);

    useMessageEvent<ReactionProfileEvent>(ReactionProfileEvent, event =>
    {
        ApplyReactionProfile(event.getParser());
    });

    useMessageEvent<AvatarReactionEvent>(AvatarReactionEvent, event =>
    {
        const parser = event.getParser();

        if(!parser.glyph) return;

        const key = ++nextKey.current;

        setReactions(current => [
            ...current.filter(item => item.objectId !== parser.objectId),
            {
                key,
                objectId: parser.objectId,
                reactionId: parser.reactionId,
                glyph: parser.glyph
            }
        ]);

        const timer = window.setTimeout(() =>
        {
            setReactions(current => current.filter(item => item.key !== key));
        }, REACTION_DURATION);

        timers.current.push(timer);
    });

    useEffect(() =>
    {
        RequestReactionProfile();

        return () =>
        {
            for(const timer of timers.current) window.clearTimeout(timer);
            timers.current = [];
        };
    }, []);

    const isHidden = profile.displayMode === REACTION_DISPLAY_HIDDEN;
    const isFloating = profile.displayMode === REACTION_DISPLAY_FLOATING;

    return (
        <>
            { !isHidden && reactions.map(item =>
                <ObjectLocationView
                    key={ item.key }
                    objectId={ item.objectId }
                    category={ RoomObjectCategory.UNIT }
                    className="avatar-reaction-location">
                    <div className={ `avatar-reaction-bubble ${ isFloating ? 'is-floating' : 'is-boxed' }` }>
                        { item.glyph }
                    </div>
                </ObjectLocationView>
            ) }

            <ReactionCustomizerView />
        </>
    );
}
