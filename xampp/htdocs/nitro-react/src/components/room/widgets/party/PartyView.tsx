import { FollowUserComposer, PartyActionComposer, PartyInviteEvent, PartyInviteResponseComposer, PartyRallyEvent, PartyStateEvent, PartyVisitComposer, RoomObjectCategory } from '@nitrots/nitro-renderer';
import { FC, MouseEvent as ReactMouseEvent, useEffect, useRef, useState } from 'react';
import { CreateLinkEvent, SendMessageComposer } from '../../../../api';
import { Button, Column, Flex, LayoutAvatarImageView, NitroCardContentView, NitroCardView, Text } from '../../../../common';
import { useMessageEvent } from '../../../../hooks';
import { GetFollowInteractionState, SubscribeFollowInteractionState } from '../interactions/InteractionState';
import { ObjectLocationView } from '../object-location/ObjectLocationView';
import { ClearPartyMenuState, SetPartyMenuState } from './PartyState';
import './PartyView.scss';

const ACTION_LEAVE = 0;
const ACTION_KICK = 1;
const ACTION_TRANSFER = 2;
const ACTION_RALLY = 3;
const ACTION_DISBAND = 4;
const ACTION_REQUEST_STATE = 5;

type Member = {
    userId: number;
    username: string;
    figure: string;
    roomId: number;
    roomName: string;
    canVisit: boolean;
    sameRoom: boolean;
};

type PartyState = {
    partyId: number;
    threadKey: number;
    leaderUserId: number;
    selfUserId: number;
    members: Member[];
};

type Invite = {
    inviteId: number;
    inviterName: string;
    inviterObjectId: number;
};

type Rally = {
    leaderUserId: number;
    leaderName: string;
    roomName: string;
    canVisit: boolean;
};

export const PartyView: FC<{}> = props =>
{
    const [ party, setParty ] = useState<PartyState>(null);
    const [ follow, setFollow ] = useState(GetFollowInteractionState());
    const [ invite, setInvite ] = useState<Invite>(null);
    const [ rally, setRally ] = useState<Rally>(null);
    const [ collapsed, setCollapsed ] = useState(false);
    const timers = useRef<number[]>([]);

    useEffect(() =>
    {
        const unsub = SubscribeFollowInteractionState(setFollow);

        SendMessageComposer(
            new PartyActionComposer(
                ACTION_REQUEST_STATE,
                0
            )
        );

        return () =>
        {
            unsub();

            timers.current.forEach(
                timer => window.clearTimeout(timer)
            );

            timers.current = [];
        };
    }, []);

    useMessageEvent<PartyStateEvent>(PartyStateEvent, event =>
    {
        const p = event.getParser();

        if(!p.active)
        {
            setParty(null);
            setRally(null);
            ClearPartyMenuState();

            return;
        }

        setParty({
            partyId: p.partyId,
            threadKey: p.threadKey,
            leaderUserId: p.leaderUserId,
            selfUserId: p.selfUserId,
            members: p.members.map(member => ({ ...member }))
        });

        SetPartyMenuState({
            active: true,
            partyId: p.partyId,
            leaderUserId: p.leaderUserId,
            selfUserId: p.selfUserId,
            memberIds: p.members.map(member => member.userId)
        });
    });

    useMessageEvent<PartyInviteEvent>(PartyInviteEvent, event =>
    {
        const p = event.getParser();

        const next = {
            inviteId: p.inviteId,
            inviterName: p.inviterName,
            inviterObjectId: p.inviterObjectId
        };

        setInvite(next);

        const timer = window.setTimeout(
            () =>
                setInvite(
                    current =>
                        current === next
                            ? null
                            : current
                ),
            15000
        );

        timers.current.push(timer);
    });

    useMessageEvent<PartyRallyEvent>(PartyRallyEvent, event =>
    {
        const p = event.getParser();

        const next = {
            leaderUserId: p.leaderUserId,
            leaderName: p.leaderName,
            roomName: p.roomName,
            canVisit: p.canVisit
        };

        setRally(next);

        const timer = window.setTimeout(
            () =>
                setRally(
                    current =>
                        current === next
                            ? null
                            : current
                ),
            10000
        );

        timers.current.push(timer);
    });

    const respondInvite = (accepted: boolean) =>
    {
        if(!invite) return;

        SendMessageComposer(
            new PartyInviteResponseComposer(
                invite.inviteId,
                accepted ? 1 : 0
            )
        );

        setInvite(null);
    };

    const action = (
        id: number,
        targetUserId = 0
    ) =>
    {
        SendMessageComposer(
            new PartyActionComposer(
                id,
                targetUserId
            )
        );
    };

    const visit = (member: Member) =>
    {
        if(
            !party
            || member.userId === party.selfUserId
            || member.sameRoom
            || !member.canVisit
        )
        {
            return;
        }

        SendMessageComposer(
            new PartyVisitComposer(
                member.userId
            )
        );
    };

    const leaderControl = (
        event: ReactMouseEvent,
        id: number,
        userId: number
    ) =>
    {
        event.stopPropagation();

        action(
            id,
            userId
        );
    };

    const leader =
        party?.members.find(
            member =>
                member.userId === party.leaderUserId
        );

    const isLeader =
        !!party
        && party.selfUserId === party.leaderUserId;

    const leaderSameRoom =
        !!leader
        && leader.sameRoom
        && !isLeader;

    const followingLeader =
        !!leader
        && follow.active
        && follow.targetUserId === leader.userId;

    const toggleFollow = () =>
    {
        if(!leaderSameRoom || !leader) return;

        SendMessageComposer(
            new FollowUserComposer(
                leader.userId
            )
        );
    };

    const openChat = () =>
    {
        if(
            !party
            || party.threadKey >= 0
        )
        {
            return;
        }

        CreateLinkEvent(
            `friends-messenger/${ party.threadKey }`
        );
    };

    const goRally = () =>
    {
        if(!rally?.canVisit) return;

        SendMessageComposer(
            new PartyVisitComposer(
                rally.leaderUserId
            )
        );

        setRally(null);
    };

    const stopHeaderControlDrag = (
        event: ReactMouseEvent
    ) =>
    {
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation();
    };

    return (
        <>
            { invite && (invite.inviterObjectId >= 0) &&
                <ObjectLocationView
                    objectId={ invite.inviterObjectId }
                    category={ RoomObjectCategory.UNIT }
                    className="biribiri-duel-location">

                    <div className="biribiri-duel-inline">
                        <div
                            className="avatar-reaction-bubble biribiri-duel-reaction biribiri-duel-static"
                            title={ `Invitación de ${ invite.inviterName }` }>
                            👥
                        </div>

                        <button
                            type="button"
                            className="biribiri-duel-round-action is-accept"
                            onClick={ () => respondInvite(true) }>
                            ✓
                        </button>

                        <button
                            type="button"
                            className="biribiri-duel-round-action is-reject"
                            onClick={ () => respondInvite(false) }>
                            ×
                        </button>
                    </div>
                </ObjectLocationView> }

            { party &&
                <NitroCardView
                    uniqueKey={ 'biribiri-equipo' }
                    className="biribiri-equipo-card no-resize"
                    theme="holo-classic">

                    <Column
                        center
                        position="relative"
                        classNames={ [
                            'drag-handler',
                            'container-fluid',
                            'nitro-card-header',
                            'biribiri-equipo-header'
                        ] }>

                        <Flex
                            fullWidth
                            center
                            className="nitro-card-header-holder">

                            <span className="nitro-card-header-text">
                                Equipo
                            </span>

                            <Flex
                                center
                                position="absolute"
                                className="end-2 biribiri-equipo-header-controls"
                                onMouseDownCapture={ stopHeaderControlDrag }>

                                <span className="biribiri-equipo-count">
                                    { party.members.length }/8
                                </span>

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    classNames={ [ 'biribiri-equipo-collapse' ] }
                                    title={ collapsed ? 'Desplegar' : 'Plegar' }
                                    onClick={
                                        () =>
                                            setCollapsed(
                                                value => !value
                                            )
                                    }>
                                    { collapsed ? '▼' : '▲' }
                                </Button>
                            </Flex>
                        </Flex>
                    </Column>

                    { !collapsed &&
                        <NitroCardContentView
                            classNames={ [ 'biribiri-equipo-content' ] }
                            overflow="visible">

                            { rally &&
                                <Column
                                    gap={ 1 }
                                    classNames={ [ 'biribiri-equipo-rally' ] }>

                                    <Text small>
                                        <strong>{ rally.leaderName }</strong>
                                        { ' quiere reunir al equipo en ' }
                                        <strong>{ rally.roomName }</strong>
                                    </Text>

                                    <Flex>
                                        <Button
                                            variant="secondary"
                                            size="sm"
                                            disabled={ !rally.canVisit }
                                            onClick={ goRally }>
                                            { rally.canVisit ? 'Ir' : 'No accesible' }
                                        </Button>
                                    </Flex>
                                </Column> }

                            <Column
                                gap={ 1 }
                                classNames={ [ 'biribiri-equipo-members' ] }>

                                { party.members.map(member =>
                                {
                                    const memberIsLeader =
                                        member.userId === party.leaderUserId;

                                    const memberIsSelf =
                                        member.userId === party.selfUserId;

                                    const clickable =
                                        !memberIsSelf
                                        && !member.sameRoom
                                        && member.canVisit;

                                    return (
                                        <Flex
                                            key={ member.userId }
                                            alignItems="center"
                                            gap={ 2 }
                                            classNames={ [
                                                'biribiri-equipo-member',
                                                memberIsSelf ? 'is-self' : '',
                                                clickable ? 'is-clickable' : ''
                                            ] }
                                            onClick={ () => visit(member) }>

                                            <div className="biribiri-equipo-avatar-frame">
                                                <LayoutAvatarImageView
                                                    figure={ member.figure }
                                                    headOnly={ true }
                                                    direction={ 2 }
                                                    classNames={ [ 'biribiri-equipo-avatar-image' ] } />
                                            </div>

                                            <Column
                                                gap={ 0 }
                                                classNames={ [ 'biribiri-equipo-member-copy' ] }>

                                                <Flex
                                                    alignItems="center"
                                                    gap={ 1 }
                                                    wrap>

                                                    <Text
                                                        bold
                                                        className="biribiri-equipo-member-name">
                                                        { member.username }
                                                    </Text>

                                                    { memberIsLeader &&
                                                        <span className="biribiri-equipo-role">
                                                            Líder
                                                        </span> }
                                                </Flex>

                                                <Text
                                                    small
                                                    className={
                                                        member.sameRoom
                                                            ? 'biribiri-equipo-room is-here'
                                                            : member.canVisit
                                                                ? 'biribiri-equipo-room is-visit'
                                                                : 'biribiri-equipo-room'
                                                    }>
                                                    { member.sameRoom
                                                        ? 'Aquí'
                                                        : member.roomId <= 0
                                                            ? 'Fuera de sala'
                                                            : member.canVisit
                                                                ? member.roomName
                                                                : `${ member.roomName } · No accesible` }
                                                </Text>
                                            </Column>

                                            { isLeader && !memberIsSelf &&
                                                <Flex
                                                    gap={ 1 }
                                                    className="ms-auto biribiri-equipo-member-controls"
                                                    onClick={ event => event.stopPropagation() }>

                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        classNames={ [ 'biribiri-equipo-member-action' ] }
                                                        title="Ascender a líder"
                                                        onClick={
                                                            event =>
                                                                leaderControl(
                                                                    event,
                                                                    ACTION_TRANSFER,
                                                                    member.userId
                                                                )
                                                        }>
                                                        Ascender
                                                    </Button>

                                                    <Button
                                                        variant="danger"
                                                        size="sm"
                                                        classNames={ [ 'biribiri-equipo-member-action' ] }
                                                        title="Expulsar"
                                                        onClick={
                                                            event =>
                                                                leaderControl(
                                                                    event,
                                                                    ACTION_KICK,
                                                                    member.userId
                                                                )
                                                        }>
                                                        Expulsar
                                                    </Button>
                                                </Flex> }
                                        </Flex>
                                    );
                                }) }
                            </Column>

                            <div className="biribiri-equipo-actions">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={ openChat }>
                                    Chat
                                </Button>

                                { leaderSameRoom &&
                                    <Button
                                        variant={
                                            followingLeader
                                                ? 'success'
                                                : 'secondary'
                                        }
                                        size="sm"
                                        onClick={ toggleFollow }>
                                        { followingLeader
                                            ? 'Dejar de seguir'
                                            : 'Seguir líder' }
                                    </Button> }

                                { isLeader &&
                                    <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={
                                            () =>
                                                action(
                                                    ACTION_RALLY
                                                )
                                        }>
                                        Reunir aquí
                                    </Button> }

                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={
                                        () =>
                                            action(
                                                ACTION_LEAVE
                                            )
                                    }>
                                    Salir
                                </Button>

                                { isLeader &&
                                    <Button
                                        variant="danger"
                                        size="sm"
                                        classNames={ [ 'biribiri-equipo-disband' ] }
                                        onClick={
                                            () =>
                                                action(
                                                    ACTION_DISBAND
                                                )
                                        }>
                                        Disolver
                                    </Button> }
                            </div>
                        </NitroCardContentView> }
                </NitroCardView> }
        </>
    );
};
