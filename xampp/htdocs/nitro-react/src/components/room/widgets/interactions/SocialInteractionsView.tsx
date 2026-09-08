import { CoinResponseComposer, CoinTossEvent, DuelChoiceComposer, DuelInviteEvent, DuelPublicEvent, DuelResponseComposer, DuelResultEvent, DuelStateEvent, FollowStateEvent, GetReactionProfileComposer, ReactionProfileEvent, RoomObjectCategory } from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { SendMessageComposer } from '../../../../api';
import { useMessageEvent } from '../../../../hooks';
import { ObjectLocationView } from '../object-location/ObjectLocationView';
import '../reactions/AvatarReactionsView.scss';
import { SetFollowInteractionState } from './InteractionState';
import './SocialInteractionsView.scss';

const STATE_PENDING = 0;
const STATE_ACTIVE = 1;
const STATE_REJECTED = 2;
const STATE_CANCELLED = 3;
const STATE_UNAVAILABLE = 4;
const STATE_CHOICE_LOCKED = 5;

const DISPLAY_BOXED = 0;
const DISPLAY_FLOATING = 1;
const DISPLAY_HIDDEN = 2;

const CHOICES = [
    { id: 0, glyph: '🪨', label: 'Piedra' },
    { id: 1, glyph: '📄', label: 'Papel' },
    { id: 2, glyph: '✂️', label: 'Tijera' }
];

interface PrivateOverlay
{
    duelId: number;
    objectId: number;
    type: 'invite' | 'pending' | 'choose' | 'waiting' | 'rejected' | 'cancelled' | 'unavailable';
}

interface PublicDuel
{
    duelId: number;
    challengerObjectId: number;
    targetObjectId: number;
}

interface Reveal
{
    key: number;
    objectId: number;
    choice: number;
    winner: boolean;
}

interface CoinChallengeOverlay
{
    challengeId: number;
    objectId: number;
    type: 'invite' | 'pending' | 'rejected' | 'cancelled' | 'unavailable';
}

interface CoinVisual
{
    key: number;
    objectId: number;
    phase: 'spin' | 'result';
    side: 0 | 1;
    winner: boolean;
}

export const SocialInteractionsView: FC<{}> = props =>
{
    const [ displayMode, setDisplayMode ] = useState(DISPLAY_BOXED);
    const [ privateOverlay, setPrivateOverlay ] = useState<PrivateOverlay>(null);
    const [ publicDuels, setPublicDuels ] = useState<PublicDuel[]>([]);
    const [ reveals, setReveals ] = useState<Reveal[]>([]);
    const [ coinVisuals, setCoinVisuals ] = useState<CoinVisual[]>([]);
    const [ coinChallenge, setCoinChallenge ] = useState<CoinChallengeOverlay>(null);

    const timers = useRef<number[]>([]);
    const revealKey = useRef(0);
    const coinKey = useRef(0);

    useEffect(() =>
    {
        SendMessageComposer(new GetReactionProfileComposer());

        return () =>
        {
            timers.current.forEach(timer => window.clearTimeout(timer));
            timers.current = [];
        };
    }, []);

    useMessageEvent<ReactionProfileEvent>(ReactionProfileEvent, event =>
    {
        const parser = event.getParser();

        if(parser && typeof parser.displayMode === 'number')
        {
            setDisplayMode(parser.displayMode);
        }
    });

    useMessageEvent<FollowStateEvent>(FollowStateEvent, event =>
    {
        const parser = event.getParser();

        SetFollowInteractionState(
            parser.active,
            parser.targetUserId,
            parser.targetName
        );
    });

    const clearPrivateAfter = (
        overlay: PrivateOverlay,
        delay = 2000
    ) =>
    {
        setPrivateOverlay(overlay);

        const timer = window.setTimeout(() =>
        {
            setPrivateOverlay(
                current =>
                    current === overlay
                        ? null
                        : current
            );
        }, delay);

        timers.current.push(timer);
    }

    useMessageEvent<DuelInviteEvent>(DuelInviteEvent, event =>
    {
        const parser = event.getParser();

        setPrivateOverlay({
            duelId: parser.duelId,
            objectId: parser.challengerObjectId,
            type: 'invite'
        });
    });

    useMessageEvent<DuelStateEvent>(DuelStateEvent, event =>
    {
        const parser = event.getParser();

        const ownOverlay: PrivateOverlay = {
            duelId: parser.duelId,
            objectId: parser.ownObjectId,
            type: 'pending'
        };

        switch(parser.state)
        {
            case STATE_PENDING:
                ownOverlay.type = 'pending';
                setPrivateOverlay(ownOverlay);
                break;

            case STATE_ACTIVE:
                ownOverlay.type = 'choose';
                setPrivateOverlay(ownOverlay);
                break;

            case STATE_CHOICE_LOCKED:
                ownOverlay.type = 'waiting';
                setPrivateOverlay(ownOverlay);
                break;

            case STATE_REJECTED:
                ownOverlay.type = 'rejected';
                clearPrivateAfter(ownOverlay);
                break;

            case STATE_CANCELLED:
                ownOverlay.type = 'cancelled';
                clearPrivateAfter(ownOverlay);
                break;

            case STATE_UNAVAILABLE:
                ownOverlay.type = 'unavailable';
                clearPrivateAfter(ownOverlay);
                break;
        }
    });

    useMessageEvent<DuelPublicEvent>(DuelPublicEvent, event =>
    {
        const parser = event.getParser();

        setPublicDuels(current =>
        {
            const without = current.filter(
                item =>
                    item.duelId !== parser.duelId
            );

            if(!parser.active) return without;

            return [
                ...without,
                {
                    duelId: parser.duelId,
                    challengerObjectId: parser.challengerObjectId,
                    targetObjectId: parser.targetObjectId
                }
            ];
        });
    });

    useMessageEvent<DuelResultEvent>(DuelResultEvent, event =>
    {
        const parser = event.getParser();

        setPrivateOverlay(
            current =>
                current?.duelId === parser.duelId
                    ? null
                    : current
        );

        setPublicDuels(
            current =>
                current.filter(
                    item =>
                        item.duelId !== parser.duelId
                )
        );

        const firstKey = ++revealKey.current;
        const secondKey = ++revealKey.current;

        const next: Reveal[] = [
            {
                key: firstKey,
                objectId: parser.challengerObjectId,
                choice: parser.challengerChoice,
                winner:
                    parser.winnerObjectId
                    === parser.challengerObjectId
            },
            {
                key: secondKey,
                objectId: parser.targetObjectId,
                choice: parser.targetChoice,
                winner:
                    parser.winnerObjectId
                    === parser.targetObjectId
            }
        ];

        setReveals(
            current => [
                ...current,
                ...next
            ]
        );

        const timer = window.setTimeout(() =>
        {
            setReveals(
                current =>
                    current.filter(
                        item =>
                            item.key !== firstKey
                            &&
                            item.key !== secondKey
                    )
            );
        }, 3000);

        timers.current.push(timer);
    });

    useMessageEvent<CoinTossEvent>(CoinTossEvent, event =>
    {
        const parser = event.getParser();

        switch(parser.eventType)
        {
            case 0: // invite
                setCoinChallenge({
                    challengeId: parser.challengeId,
                    objectId: parser.displayObjectId,
                    type: 'invite'
                });
                return;

            case 1: // pending
                setCoinChallenge({
                    challengeId: parser.challengeId,
                    objectId: parser.displayObjectId,
                    type: 'pending'
                });
                return;

            case 2: // rejected
            {
                const overlay: CoinChallengeOverlay = {
                    challengeId: parser.challengeId,
                    objectId: parser.displayObjectId,
                    type: 'rejected'
                };

                setCoinChallenge(overlay);

                const timer = window.setTimeout(() =>
                {
                    setCoinChallenge(current => current === overlay ? null : current);
                }, 1900);

                timers.current.push(timer);
                return;
            }

            case 3: // cancelled
            {
                const overlay: CoinChallengeOverlay = {
                    challengeId: parser.challengeId,
                    objectId: parser.displayObjectId,
                    type: 'cancelled'
                };

                setCoinChallenge(overlay);

                const timer = window.setTimeout(() =>
                {
                    setCoinChallenge(current => current === overlay ? null : current);
                }, 1900);

                timers.current.push(timer);
                return;
            }

            case 4: // unavailable
            {
                const overlay: CoinChallengeOverlay = {
                    challengeId: parser.challengeId,
                    objectId: parser.displayObjectId,
                    type: 'unavailable'
                };

                setCoinChallenge(overlay);

                const timer = window.setTimeout(() =>
                {
                    setCoinChallenge(current => current === overlay ? null : current);
                }, 1900);

                timers.current.push(timer);
                return;
            }

            case 5: // result public
                break;

            default:
                return;
        }

        setCoinChallenge(null);

        const spinA = ++coinKey.current;
        const spinB = ++coinKey.current;

        const spins: CoinVisual[] = [
            {
                key: spinA,
                objectId: parser.initiatorObjectId,
                phase: 'spin',
                side: 0,
                winner: false
            },
            {
                key: spinB,
                objectId: parser.targetObjectId,
                phase: 'spin',
                side: 1,
                winner: false
            }
        ];

        setCoinVisuals(current => [ ...current, ...spins ]);

        const revealTimer = window.setTimeout(() =>
        {
            setCoinVisuals(current =>
                current.filter(item => item.key !== spinA && item.key !== spinB)
            );

            const revealA = ++coinKey.current;
            const revealB = ++coinKey.current;

            const next: CoinVisual[] = [
                {
                    key: revealA,
                    objectId: parser.initiatorObjectId,
                    phase: 'result',
                    side: 0,
                    winner: parser.winnerObjectId === parser.initiatorObjectId
                },
                {
                    key: revealB,
                    objectId: parser.targetObjectId,
                    phase: 'result',
                    side: 1,
                    winner: parser.winnerObjectId === parser.targetObjectId
                }
            ];

            setCoinVisuals(current => [ ...current, ...next ]);

            const clearTimer = window.setTimeout(() =>
            {
                setCoinVisuals(current =>
                    current.filter(item => item.key !== revealA && item.key !== revealB)
                );
            }, 2600);

            timers.current.push(clearTimer);
        }, 1050);

        timers.current.push(revealTimer);
    });

    const respondCoin = (accepted: boolean) =>
    {
        if(!coinChallenge) return;

        SendMessageComposer(
            new CoinResponseComposer(
                coinChallenge.challengeId,
                accepted ? 1 : 0
            )
        );

        setCoinChallenge(null);
    }

    const respond = (accepted: boolean) =>
    {
        if(!privateOverlay) return;

        SendMessageComposer(
            new DuelResponseComposer(
                privateOverlay.duelId,
                accepted ? 1 : 0
            )
        );

        if(!accepted)
        {
            setPrivateOverlay(null);
        }
    }

    const choose = (choice: number) =>
    {
        if(!privateOverlay) return;

        SendMessageComposer(
            new DuelChoiceComposer(
                privateOverlay.duelId,
                choice
            )
        );
    }

    const getChoice = (id: number) =>
        CHOICES.find(
            choice =>
                choice.id === id
        );

    const reactionClass =
        `avatar-reaction-bubble biribiri-duel-reaction ${
            displayMode === DISPLAY_FLOATING
                ? 'is-floating'
                : ''
        }`;

    if(displayMode === DISPLAY_HIDDEN)
    {
        return null;
    }

    return (
        <>
            { publicDuels.flatMap(duel => [
                <ObjectLocationView
                    key={ `duel-public-a-${ duel.duelId }` }
                    objectId={ duel.challengerObjectId }
                    category={ RoomObjectCategory.UNIT }
                    className="biribiri-duel-location biribiri-duel-passive-location">
                    <div className={ `${ reactionClass } biribiri-duel-static` }>
                        ⚔️
                    </div>
                </ObjectLocationView>,

                <ObjectLocationView
                    key={ `duel-public-b-${ duel.duelId }` }
                    objectId={ duel.targetObjectId }
                    category={ RoomObjectCategory.UNIT }
                    className="biribiri-duel-location biribiri-duel-passive-location">
                    <div className={ `${ reactionClass } biribiri-duel-static` }>
                        ⚔️
                    </div>
                </ObjectLocationView>
            ]) }

            { privateOverlay && privateOverlay.objectId >= 0 &&
                <ObjectLocationView
                    objectId={ privateOverlay.objectId }
                    category={ RoomObjectCategory.UNIT }
                    className="biribiri-duel-location">

                    { privateOverlay.type === 'invite' &&
                        <div className="biribiri-duel-inline">
                            <div className={ `${ reactionClass } biribiri-duel-static` }>
                                ⚔️
                            </div>

                            <button
                                type="button"
                                className="biribiri-duel-round-action is-accept"
                                onClick={ () => respond(true) }>
                                ✓
                            </button>

                            <button
                                type="button"
                                className="biribiri-duel-round-action is-reject"
                                onClick={ () => respond(false) }>
                                ×
                            </button>
                        </div> }

                    { privateOverlay.type === 'pending' &&
                        <div className={ `${ reactionClass } biribiri-duel-static` }>
                            ⚔️
                        </div> }

                    { privateOverlay.type === 'choose' &&
                        <div className="biribiri-duel-choice-row">
                            { CHOICES.map(choice =>
                                <button
                                    key={ choice.id }
                                    type="button"
                                    title={ choice.label }
                                    className={ `${ reactionClass } biribiri-duel-choice biribiri-duel-static` }
                                    onClick={ () => choose(choice.id) }>
                                    { choice.glyph }
                                </button>
                            ) }
                        </div> }

                    { privateOverlay.type === 'waiting' &&
                        <div className={ `${ reactionClass } biribiri-duel-static` }>
                            ⚔️
                        </div> }

                    { privateOverlay.type === 'rejected' &&
                        <div className={ `${ reactionClass } biribiri-duel-static` }>
                            ❌
                        </div> }

                    { privateOverlay.type === 'cancelled' &&
                        <div className={ `${ reactionClass } biribiri-duel-static` }>
                            ❌
                        </div> }

                    { privateOverlay.type === 'unavailable' &&
                        <div className={ `${ reactionClass } biribiri-duel-static` }>
                            ❗
                        </div> }
                </ObjectLocationView> }

            { reveals.map(reveal =>
            {
                const choice = getChoice(
                    reveal.choice
                );

                return (
                    <ObjectLocationView
                        key={ reveal.key }
                        objectId={ reveal.objectId }
                        category={ RoomObjectCategory.UNIT }
                        className="biribiri-duel-location biribiri-duel-passive-location">

                        <div className={ `${ reactionClass } biribiri-duel-result ${ reveal.winner ? 'is-winner' : '' }` }>
                            { choice?.glyph || '?' }

                            { reveal.winner &&
                                <span className="biribiri-duel-trophy">
                                    🏆
                                </span> }
                        </div>
                    </ObjectLocationView>
                );
            }) }

            { coinChallenge && coinChallenge.objectId >= 0 &&
                <ObjectLocationView
                    objectId={ coinChallenge.objectId }
                    category={ RoomObjectCategory.UNIT }
                    className="biribiri-duel-location">

                    { coinChallenge.type === 'invite' &&
                        <div className="biribiri-duel-inline">
                            <div className={ `${ reactionClass } biribiri-duel-static` }>
                                🪙
                            </div>

                            <button
                                type="button"
                                className="biribiri-duel-round-action is-accept"
                                onClick={ () => respondCoin(true) }>
                                ✓
                            </button>

                            <button
                                type="button"
                                className="biribiri-duel-round-action is-reject"
                                onClick={ () => respondCoin(false) }>
                                ×
                            </button>
                        </div> }

                    { coinChallenge.type === 'pending' &&
                        <div className={ `${ reactionClass } biribiri-duel-static` }>
                            🪙
                        </div> }

                    { coinChallenge.type === 'rejected' &&
                        <div className={ `${ reactionClass } biribiri-duel-static` }>
                            ❌
                        </div> }

                    { coinChallenge.type === 'cancelled' &&
                        <div className={ `${ reactionClass } biribiri-duel-static` }>
                            ❌
                        </div> }

                    { coinChallenge.type === 'unavailable' &&
                        <div className={ `${ reactionClass } biribiri-duel-static` }>
                            ❗
                        </div> }
                </ObjectLocationView> }

            { coinVisuals.map(visual =>
                <ObjectLocationView
                    key={ `coin-${ visual.key }` }
                    objectId={ visual.objectId }
                    category={ RoomObjectCategory.UNIT }
                    className="biribiri-duel-location biribiri-duel-passive-location">

                    <div className={ `${ reactionClass } biribiri-duel-static biribiri-coin-visual ${ visual.winner ? 'is-winner' : '' }` }>
                        { visual.phase === 'spin' &&
                            <span className="biribiri-coin-spin">🪙</span> }

                        { visual.phase === 'result' &&
                            <span className="biribiri-coin-result-emoji">
                                { visual.side === 0 ? '🙂' : '❌' }
                            </span> }

                        { visual.phase === 'result' && visual.winner &&
                            <span className="biribiri-duel-trophy">
                                🏆
                            </span> }
                    </div>
                </ObjectLocationView>
            ) }
        </>
    );
}
