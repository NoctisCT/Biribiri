import {
    ArcadeCloseEvent,
    ArcadeGameStartComposer,
    ArcadeGameStartedEvent,
    ArcadeLeaderboardEvent,
    ArcadeScoreSubmitComposer,
    LiftShiftOpenEvent
} from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import { NitroCardContentView, NitroCardHeaderView, NitroCardView } from '../../common';
import { SendMessageComposer } from '../../api';
import { useMessageEvent } from '../../hooks/events';
import { ArcadeLeaderboardView } from '../arcade/ArcadeLeaderboardView';
import './LiftShiftView.scss';

type GamePhase = 'ready' | 'playing' | 'paused' | 'gameover';
type ServerResultState = 'idle' | 'accepted' | 'rejected';
type Side = 'left' | 'right';

interface Passenger
{
    id: number;
    from: number;
    to: number;
    side: Side;
    mood: number;
    vip: boolean;
    color: string;
}

interface Popup
{
    id: number;
    text: string;
    x: number;
    y: number;
    ttl: number;
    positive: boolean;
}

interface ElevatorState
{
    floor: number;
    y: number;
    targetFloor: number | null;
    direction: -1 | 0 | 1;
    door: number;
    doorTimer: number;
    passengers: Passenger[];
}

interface GameModel
{
    phase: GamePhase;
    score: number;
    level: number;
    delivered: number;
    combo: number;
    strikes: number;
    elapsed: number;
    spawnTimer: number;
    nextPassengerId: number;
    feedback: string;
    feedbackTime: number;
    queues: Passenger[][];
    elevator: ElevatorState;
    popups: Popup[];
}

interface LeaderboardEntry
{
    rank: number;
    username: string;
    score: number;
    level: number;
}

const GAME_KEY = 'liftshift';
const UI_MARKER = 'BIRIBIRI_LIFTSHIFT_BELLHOP_CONCEPT_V1';

const FLOORS = 7;
const FLOOR_STEP = 48;
const SHAFT_X = 198;
const SHAFT_W = 74;
const WAIT_LEFT_X = 70;
const WAIT_RIGHT_X = 370;
const CAB_W = 54;
const CAB_H = 36;
const SCREEN_W = 520;
const SCREEN_H = 380;
const CAPACITY = 4;
const MAX_STRIKES = 3;
const MAX_LEVEL = 99;

const PASSENGER_COLORS = [
    '#f6cb68',
    '#6fdef3',
    '#fd98c4',
    '#aaf08e',
    '#f39c6b',
    '#b7a2ff'
];

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

const floorY = (floor: number) => 48 + ((FLOORS - 1 - floor) * FLOOR_STEP);

const elevatorTargetY = (floor: number) => floorY(floor) + 3;

const randomRange = (min: number, max: number) =>
    min + (Math.random() * (max - min));

const randomInt = (maxExclusive: number) =>
    Math.floor(Math.random() * maxExclusive);

const statusLabel = (phase: GamePhase) =>
{
    if(phase === 'ready') return 'PREPARADO';
    if(phase === 'playing') return 'EN SERVICIO';
    if(phase === 'paused') return 'PAUSA';
    return 'SERVICIO CERRADO';
};

const phaseSubtitle = (phase: GamePhase) =>
{
    if(phase === 'ready') return 'Gestiona el ascensor y encadena rutas perfectas.';
    if(phase === 'paused') return 'Pulsa P para volver a ponerlo en marcha.';
    if(phase === 'playing') return 'El hotel está a pleno rendimiento.';
    return 'Se acabó el turno. ¿Otra ronda?';
};

const freshPassenger = (id: number, level: number): Passenger =>
{
    const from = randomInt(FLOORS);
    let to = randomInt(FLOORS - 1);

    if(to >= from) to += 1;

    return {
        id,
        from,
        to,
        side: Math.random() < 0.5 ? 'left' : 'right',
        mood: clamp(1.3 - (level * 0.02), 0.55, 1.25),
        vip: Math.random() < Math.min(0.09 + (level * 0.01), 0.30),
        color: PASSENGER_COLORS[id % PASSENGER_COLORS.length]
    };
};

const totalQueuePassengers = (queues: Passenger[][]) =>
    queues.reduce((sum, queue) => sum + queue.length, 0);

const freshGame = (phase: GamePhase = 'ready'): GameModel =>
{
    const queues: Passenger[][] = Array.from({ length: FLOORS }, () => []);
    const game: GameModel = {
        phase,
        score: 0,
        level: 1,
        delivered: 0,
        combo: 0,
        strikes: 0,
        elapsed: 0,
        spawnTimer: 1.0,
        nextPassengerId: 1,
        feedback: '',
        feedbackTime: 0,
        queues,
        elevator: {
            floor: 0,
            y: elevatorTargetY(0),
            targetFloor: null,
            direction: 0,
            door: 0,
            doorTimer: 0,
            passengers: []
        },
        popups: []
    };

    for(let i = 0; i < 3; i++)
    {
        const passenger = freshPassenger(game.nextPassengerId++, game.level);
        game.queues[passenger.from].push(passenger);
    }

    return game;
};

const LiftShiftIcon: FC<{ active?: boolean }> = ({ active = false }) =>
{
    return (
        <svg
            className={ `liftshift-status-icon${ active ? ' is-active' : '' }` }
            viewBox="0 0 26 20"
            shapeRendering="crispEdges"
            aria-hidden="true">
            <rect className="liftshift-icon-frame" x="7" y="4" width="12" height="13" />
            <rect className="liftshift-icon-door" x="9" y="6" width="8" height="9" />
            <rect className="liftshift-icon-split" x="12" y="6" width="2" height="9" />
            <rect className="liftshift-icon-arrow" x="2" y="5" width="3" height="3" />
            <rect className="liftshift-icon-arrow" x="3" y="3" width="1" height="2" />
            <rect className="liftshift-icon-arrow" x="21" y="12" width="3" height="3" />
            <rect className="liftshift-icon-arrow" x="22" y="15" width="1" height="2" />
        </svg>
    );
};

export const LiftShiftView: FC<{}> = () =>
{
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const visibleRef = useRef(false);
    const gameRef = useRef<GameModel>(freshGame());
    const itemIdRef = useRef(0);
    const runTokenRef = useRef('');
    const submittedRunRef = useRef(false);
    const startPendingRef = useRef(false);
    const lastFrameRef = useRef(0);
    const soundEnabledRef = useRef(true);
    const audioRef = useRef<AudioContext | null>(null);

    const [ isVisible, setIsVisible ] = useState(false);
    const [ score, setScore ] = useState(0);
    const [ level, setLevel ] = useState(1);
    const [ delivered, setDelivered ] = useState(0);
    const [ combo, setCombo ] = useState(0);
    const [ phase, setPhase ] = useState<GamePhase>('ready');
    const [ soundEnabled, setSoundEnabled ] = useState(true);
    const [ startPending, setStartPending ] = useState(false);
    const [ leaderboard, setLeaderboard ] = useState<LeaderboardEntry[]>([]);
    const [ serverBest, setServerBest ] = useState(0);
    const [ personalRank, setPersonalRank ] = useState(0);
    const [ totalPlayers, setTotalPlayers ] = useState(0);
    const [ recordsOpen, setRecordsOpen ] = useState(false);
    const [ resultState, setResultState ] = useState<ServerResultState>('idle');
    const [ resultMessage, setResultMessage ] = useState('');
    const [ newServerRecord, setNewServerRecord ] = useState(false);

    const ensureAudio = (): AudioContext | null =>
    {
        if(!soundEnabledRef.current) return null;

        try
        {
            if(!audioRef.current)
            {
                const AudioContextClass =
                    window.AudioContext || (window as any).webkitAudioContext;

                if(!AudioContextClass) return null;
                audioRef.current = new AudioContextClass();
            }

            if(audioRef.current.state === 'suspended')
                void audioRef.current.resume();

            return audioRef.current;
        }
        catch
        {
            return null;
        }
    };

    const tone = (
        frequency: number,
        duration: number,
        type: OscillatorType = 'square',
        volume = 0.03,
        delay = 0,
        endFrequency?: number) =>
    {
        const context = ensureAudio();
        if(!context) return;

        const start = context.currentTime + delay;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(Math.max(1, frequency), start);

        if(endFrequency !== undefined)
        {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(1, endFrequency),
                start + duration
            );
        }

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(
            Math.max(0.0001, Math.min(0.12, volume)),
            start + 0.005
        );
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    };

    const playStart = () =>
    {
        tone(220, 0.06, 'square', 0.024);
        tone(330, 0.06, 'square', 0.026, 0.07);
        tone(494, 0.08, 'square', 0.029, 0.14);
    };

    const playMove = () => tone(280, 0.045, 'triangle', 0.020, 0, 440);
    const playOpen = () => tone(520, 0.05, 'square', 0.022);
    const playDeliver = () => tone(720, 0.055, 'square', 0.027, 0, 980);
    const playLevel = () =>
    {
        tone(440, 0.05, 'square', 0.024);
        tone(660, 0.05, 'square', 0.026, 0.06);
        tone(920, 0.09, 'square', 0.028, 0.12);
    };
    const playStrike = () => tone(170, 0.12, 'sawtooth', 0.032, 0, 100);
    const playGameOver = () =>
    {
        tone(240, 0.13, 'sawtooth', 0.030, 0, 130);
        tone(110, 0.20, 'square', 0.026, 0.09, 60);
    };

    const syncHud = () =>
    {
        const game = gameRef.current;
        setScore(game.score);
        setLevel(game.level);
        setDelivered(game.delivered);
        setCombo(game.combo);
        setPhase(game.phase);
    };

    const resetReadyGame = () =>
    {
        gameRef.current = freshGame('ready');
        runTokenRef.current = '';
        submittedRunRef.current = false;
        startPendingRef.current = false;
        lastFrameRef.current = 0;

        setStartPending(false);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);
        syncHud();
    };

    const beginLocalRun = (token: string) =>
    {
        const game = freshGame('playing');
        game.feedback = 'TURNO ABIERTO';
        game.feedbackTime = 1.0;

        gameRef.current = game;
        runTokenRef.current = token;
        submittedRunRef.current = false;
        lastFrameRef.current = performance.now();

        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);
        syncHud();
        playStart();

        window.setTimeout(() => canvasRef.current?.focus(), 0);
    };

    const requestStartGame = () =>
    {
        if(!visibleRef.current || itemIdRef.current <= 0 || startPendingRef.current)
            return;

        ensureAudio();
        startPendingRef.current = true;
        setStartPending(true);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);

        SendMessageComposer(new ArcadeGameStartComposer(itemIdRef.current, GAME_KEY));
    };

    const submitRunResult = (finalScore: number, finalLevel: number) =>
    {
        if(submittedRunRef.current || !runTokenRef.current || itemIdRef.current <= 0)
            return;

        submittedRunRef.current = true;

        SendMessageComposer(
            new ArcadeScoreSubmitComposer(
                itemIdRef.current,
                GAME_KEY,
                runTokenRef.current,
                finalScore,
                finalLevel
            )
        );
    };

    const close = () =>
    {
        visibleRef.current = false;
        runTokenRef.current = '';
        submittedRunRef.current = false;
        startPendingRef.current = false;
        setStartPending(false);
        setRecordsOpen(false);
        setIsVisible(false);

        if(gameRef.current.phase === 'playing')
            gameRef.current.phase = 'paused';
    };

    const togglePause = () =>
    {
        const game = gameRef.current;

        if(game.phase === 'playing')
        {
            game.phase = 'paused';
        }
        else if(game.phase === 'paused')
        {
            game.phase = 'playing';
            lastFrameRef.current = performance.now();
        }
        else return;

        setPhase(game.phase);
    };

    const toggleSound = () =>
    {
        const next = !soundEnabledRef.current;
        soundEnabledRef.current = next;
        setSoundEnabled(next);

        if(next)
        {
            ensureAudio();
            tone(520, 0.06, 'square', 0.025);
        }
    };

    const openRecords = () =>
    {
        if(gameRef.current.phase === 'playing')
        {
            gameRef.current.phase = 'paused';
            setPhase('paused');
        }

        setRecordsOpen(true);
    };

    const closeRecords = () =>
    {
        setRecordsOpen(false);
        window.setTimeout(() => canvasRef.current?.focus(), 0);
    };

    const addPopup = (text: string, x: number, y: number, positive = true) =>
    {
        const game = gameRef.current;
        game.popups.push({
            id: (Date.now() + randomInt(9999)),
            text,
            x,
            y,
            ttl: 0.8,
            positive
        });
    };

    const spawnPassenger = () =>
    {
        const game = gameRef.current;

        if(totalQueuePassengers(game.queues) >= 11) return;

        const passenger = freshPassenger(game.nextPassengerId++, game.level);
        const queue = game.queues[passenger.from];

        if(queue.length >= 3) return;

        queue.push(passenger);
    };

    const awardStrike = (floor: number) =>
    {
        const game = gameRef.current;
        game.combo = 0;
        game.strikes += 1;
        game.feedback = 'HUÉSPED PERDIDO';
        game.feedbackTime = 0.8;
        addPopup('-1', 40, floorY(floor) + 8, false);
        playStrike();
        syncHud();
    };

    const maybeLevelUp = () =>
    {
        const game = gameRef.current;
        const nextLevel = Math.min(MAX_LEVEL, 1 + Math.floor(game.delivered / 6));

        if(nextLevel > game.level)
        {
            game.level = nextLevel;
            game.feedback = `NIVEL ${ game.level }`;
            game.feedbackTime = 1.1;
            addPopup(`NIVEL ${ game.level }`, SCREEN_W / 2, 42, true);
            playLevel();
        }
    };

    const openDoors = () =>
    {
        const game = gameRef.current;
        const elevator = game.elevator;

        if(game.phase !== 'playing') return;
        if(elevator.targetFloor !== null) return;
        if(elevator.doorTimer > 0.05) return;

        elevator.door = 1;
        elevator.doorTimer = 0.9;
        playOpen();

        const currentFloor = elevator.floor;
        const remaining: Passenger[] = [];
        let unloads = 0;

        for(const passenger of elevator.passengers)
        {
            if(passenger.to === currentFloor)
            {
                unloads += 1;
                game.delivered += 1;
                game.combo += 1;

                const base = passenger.vip ? 180 : 100;
                const reward = base + (game.level * 12) + ((game.combo - 1) * 20);
                game.score += reward;

                addPopup(`+${ reward }`, SHAFT_X + SHAFT_W + 58, floorY(currentFloor) + 16, true);
                game.feedback = passenger.vip
                    ? `VIP · COMBO x${ game.combo }`
                    : `CHECK-IN x${ game.combo }`;
                game.feedbackTime = 0.7;
                playDeliver();
            }
            else
            {
                remaining.push(passenger);
            }
        }

        elevator.passengers = remaining;

        const queue = game.queues[currentFloor];
        let boardCount = 0;

        while(queue.length > 0 && elevator.passengers.length < CAPACITY)
        {
            const nextPassenger = queue.shift();
            if(!nextPassenger) break;
            elevator.passengers.push(nextPassenger);
            boardCount++;
        }

        if(unloads === 0 && boardCount === 0)
        {
            game.combo = 0;
            game.feedback = 'SIN PARADA ÚTIL';
            game.feedbackTime = 0.45;
        }
        else if(boardCount > 0 && unloads === 0)
        {
            game.feedback = boardCount > 1 ? `SUBEN ${ boardCount }` : 'SUBE 1 HUÉSPED';
            game.feedbackTime = 0.55;
        }

        maybeLevelUp();
        syncHud();
    };

    const queueMove = (direction: -1 | 1) =>
    {
        const game = gameRef.current;
        const elevator = game.elevator;

        if(game.phase !== 'playing') return;
        if(elevator.targetFloor !== null) return;
        if(elevator.doorTimer > 0.02) return;

        const nextFloor = clamp(elevator.floor + direction, 0, FLOORS - 1);

        if(nextFloor === elevator.floor) return;

        elevator.targetFloor = nextFloor;
        elevator.direction = direction;
        playMove();
    };

    useMessageEvent(LiftShiftOpenEvent, (event: LiftShiftOpenEvent) =>
    {
        const parser = event.getParser();

        itemIdRef.current = parser.itemId;
        resetReadyGame();
        setLeaderboard([]);
        setServerBest(0);
        setPersonalRank(0);
        setTotalPlayers(0);
        setRecordsOpen(false);

        visibleRef.current = true;
        setIsVisible(true);

        window.setTimeout(() => canvasRef.current?.focus(), 0);
    });

    useMessageEvent(ArcadeGameStartedEvent, (event: ArcadeGameStartedEvent) =>
    {
        const parser = event.getParser();

        if(
            !visibleRef.current ||
            parser.gameKey !== GAME_KEY ||
            parser.itemId !== itemIdRef.current
        ) return;

        startPendingRef.current = false;
        setStartPending(false);

        if(!parser.success)
        {
            setResultState('rejected');
            setResultMessage(parser.message || 'No se pudo iniciar la partida.');
            return;
        }

        beginLocalRun(parser.token);
    });

    useMessageEvent(ArcadeLeaderboardEvent, (event: ArcadeLeaderboardEvent) =>
    {
        const parser = event.getParser();
        if(parser.gameKey !== GAME_KEY) return;

        setLeaderboard(
            parser.entries.map(entry => ({
                rank: entry.rank,
                username: entry.username,
                score: entry.score,
                level: entry.level
            }))
        );
        setPersonalRank(parser.personalRank);
        setTotalPlayers(parser.totalPlayers);
        setServerBest(parser.personalBest);

        if(parser.context === 1)
        {
            setResultState('accepted');
            setResultMessage(parser.message || 'Puntuación registrada.');
            setNewServerRecord(parser.newRecord);
        }
        else if(parser.context === 2)
        {
            setResultState('rejected');
            setResultMessage(parser.message || 'La puntuación no pudo validarse.');
            setNewServerRecord(false);
        }
    });

    useMessageEvent(ArcadeCloseEvent, (event: ArcadeCloseEvent) =>
    {
        const parser = event.getParser();

        if(parser.gameKey !== GAME_KEY || parser.itemId !== itemIdRef.current)
            return;

        visibleRef.current = false;
        runTokenRef.current = '';
        submittedRunRef.current = false;
        startPendingRef.current = false;
        setStartPending(false);
        setRecordsOpen(false);
        setIsVisible(false);
    });

    useEffect(() =>
    {
        const down = (event: KeyboardEvent) =>
        {
            if(!visibleRef.current) return;

            const handled = [
                'ArrowDown', 'ArrowUp',
                'KeyS', 'KeyW',
                'Space', 'Enter', 'KeyP', 'Escape'
            ].includes(event.code);

            if(handled) event.preventDefault();

            if(event.code === 'Enter')
            {
                if(gameRef.current.phase === 'ready' || gameRef.current.phase === 'gameover')
                    requestStartGame();
                return;
            }

            if(event.code === 'KeyP' || event.code === 'Escape')
            {
                togglePause();
                return;
            }

            if(event.code === 'Space')
            {
                openDoors();
                return;
            }

            if(gameRef.current.phase !== 'playing') return;

            if(event.code === 'ArrowUp' || event.code === 'KeyW')
                queueMove(1);
            else if(event.code === 'ArrowDown' || event.code === 'KeyS')
                queueMove(-1);
        };

        const blur = () =>
        {
            if(visibleRef.current && gameRef.current.phase === 'playing')
            {
                gameRef.current.phase = 'paused';
                setPhase('paused');
            }
        };

        window.addEventListener('keydown', down, { passive: false });
        window.addEventListener('blur', blur);

        return () =>
        {
            window.removeEventListener('keydown', down);
            window.removeEventListener('blur', blur);
        };
    }, []);

    useEffect(() =>
    {
        let frameId = 0;

        const finishGame = () =>
        {
            const game = gameRef.current;
            if(game.phase === 'gameover') return;

            game.phase = 'gameover';
            game.feedback = 'SERVICIO CERRADO';
            game.feedbackTime = 1.4;
            setPhase('gameover');
            syncHud();
            playGameOver();
            submitRunResult(game.score, game.level);
        };

        const stepGame = (delta: number) =>
        {
            const game = gameRef.current;
            const elevator = game.elevator;

            game.elapsed += delta;

            if(game.feedbackTime > 0)
                game.feedbackTime = Math.max(0, game.feedbackTime - delta);

            for(const popup of game.popups)
            {
                popup.ttl -= delta;
                popup.y -= 20 * delta;
            }

            game.popups = game.popups.filter(popup => popup.ttl > 0);

            game.spawnTimer -= delta;

            if(game.spawnTimer <= 0)
            {
                spawnPassenger();
                game.spawnTimer = Math.max(0.60, 2.00 - (game.level * 0.08));
            }

            for(let floor = 0; floor < FLOORS; floor++)
            {
                const queue = game.queues[floor];

                for(const passenger of queue)
                    passenger.mood -= delta * (0.075 + (game.level * 0.004));

                const before = queue.length;
                game.queues[floor] = queue.filter(passenger => passenger.mood > 0);

                if(game.queues[floor].length < before)
                    awardStrike(floor);
            }

            if(game.strikes >= MAX_STRIKES)
            {
                finishGame();
                return;
            }

            if(elevator.targetFloor !== null)
            {
                const targetY = elevatorTargetY(elevator.targetFloor);
                const diff = targetY - elevator.y;
                const speed = 110 + (game.level * 7);

                if(Math.abs(diff) <= speed * delta)
                {
                    elevator.y = targetY;
                    elevator.floor = elevator.targetFloor;
                    elevator.targetFloor = null;
                    elevator.direction = 0;
                }
                else
                {
                    elevator.y += Math.sign(diff) * speed * delta;
                }
            }

            if(elevator.doorTimer > 0)
            {
                elevator.doorTimer -= delta;
                elevator.door = clamp(elevator.doorTimer / 0.18, 0, 1);

                if(elevator.doorTimer <= 0)
                    elevator.door = 0;
            }
        };

        const drawPassenger = (
            context: CanvasRenderingContext2D,
            passenger: Passenger,
            x: number,
            y: number,
            compact = false) =>
        {
            const bagW = compact ? 10 : 14;
            const bagH = compact ? 10 : 14;
            const left = Math.round(x - (bagW / 2));
            const top = Math.round(y - bagH);

            // shadow
            context.fillStyle = 'rgba(0,0,0,.30)';
            context.fillRect(left - 1, top + bagH, bagW + 2, 2);

            // luggage body
            context.fillStyle = passenger.color;
            context.fillRect(left, top + 2, bagW, bagH - 2);

            // trim
            context.fillStyle = 'rgba(255,255,255,.16)';
            context.fillRect(left + 1, top + 3, bagW - 2, 1);

            context.fillStyle = 'rgba(0,0,0,.18)';
            context.fillRect(left + 1, top + bagH - 3, bagW - 2, 1);

            // handle
            context.fillStyle = '#e1c782';
            context.fillRect(left + Math.floor((bagW - 4) / 2), top, 4, 2);

            // vip band
            if(passenger.vip)
            {
                context.fillStyle = '#f3d36f';
                context.fillRect(left, top + 5, bagW, 2);
            }

            // destination tag only while waiting
            if(!compact)
            {
                const tagW = 12;
                const tagH = 10;
                const tagX =
                    passenger.side === 'left'
                        ? x + 12
                        : x - 12;

                const tagY = top + 1;

                context.fillStyle = '#111816';
                context.fillRect(
                    Math.round(tagX - (tagW / 2)),
                    Math.round(tagY - (tagH / 2)),
                    tagW,
                    tagH
                );

                context.strokeStyle =
                    passenger.vip
                        ? '#e2be60'
                        : '#698b74';

                context.strokeRect(
                    Math.round(tagX - (tagW / 2)) + 0.5,
                    Math.round(tagY - (tagH / 2)) + 0.5,
                    tagW - 1,
                    tagH - 1
                );

                context.fillStyle =
                    passenger.vip
                        ? '#ffe48c'
                        : '#d9f1dc';

                context.font = 'bold 8px monospace';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(String(passenger.to), tagX, tagY + 1);
            }
        };

        const floorLabel = (floor: number) =>
        {
            return (floor === 0)
                ? 'LOBBY'
                : `P${ floor }`;
        };

        const drawFloorBand = (
            context: CanvasRenderingContext2D,
            floor: number,
            y: number) =>
        {
            const top = y - 7;

            context.fillStyle =
                floor % 2 === 0
                    ? '#24322d'
                    : '#273731';

            context.fillRect(28, top, 464, 35);

            context.fillStyle = '#8d6d42';
            context.fillRect(28, top, 464, 2);

            context.fillStyle = '#3f3024';
            context.fillRect(28, top + 28, 464, 4);

            // waiting platforms
            context.fillStyle = '#1a2521';
            context.fillRect(38, top + 8, 118, 16);
            context.fillRect(344, top + 8, 118, 16);

            context.strokeStyle = '#556a61';
            context.strokeRect(38.5, top + 8.5, 117, 15);
            context.strokeRect(344.5, top + 8.5, 117, 15);

            // lit floor plaques
            for(const plaqueX of [ 164, 326 ])
            {
                context.fillStyle = '#131a18';
                context.fillRect(plaqueX, top + 6, 28, 18);

                context.strokeStyle = '#b58a4a';
                context.strokeRect(plaqueX + 0.5, top + 6.5, 27, 17);

                context.fillStyle = '#f0d58d';
                context.font = 'bold 9px monospace';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(floorLabel(floor), plaqueX + 14, top + 15);
            }
        };

        const draw = () =>
        {
            const canvas = canvasRef.current;
            if(!canvas) return;

            const context = canvas.getContext('2d');
            if(!context) return;

            const game = gameRef.current;
            const elevator = game.elevator;

            context.setTransform(2, 0, 0, 2, 0, 0);
            context.imageSmoothingEnabled = false;
            context.textBaseline = 'alphabetic';

            const background = context.createLinearGradient(0, 0, 0, SCREEN_H);
            background.addColorStop(0, '#0d1412');
            background.addColorStop(1, '#060b09');

            context.fillStyle = background;
            context.fillRect(0, 0, SCREEN_W, SCREEN_H);

            // top instruction bar
            context.fillStyle = '#151e1b';
            context.fillRect(18, 10, SCREEN_W - 36, 30);

            context.strokeStyle = '#8d6d42';
            context.strokeRect(18.5, 10.5, SCREEN_W - 37, 29);

            context.fillStyle = '#ebd48e';
            context.font = 'bold 11px monospace';
            context.textAlign = 'left';
            context.fillText('BELLHOP RUSH · LLEVA LAS MALETAS A SU PLANTA', 28, 29);

            context.textAlign = 'right';
            context.fillStyle = '#b5c7bc';
            context.fillText(`CABINA ${ elevator.passengers.length }/${ CAPACITY }`, 402, 29);
            context.fillText(`FALLOS ${ game.strikes }/${ MAX_STRIKES }`, 490, 29);

            // floor rows
            for(let floor = 0; floor < FLOORS; floor++)
            {
                drawFloorBand(context, floor, floorY(floor));
            }

            // shaft frame
            context.fillStyle = '#101614';
            context.fillRect(SHAFT_X - 10, 42, SHAFT_W + 20, 300);

            context.strokeStyle = '#8d6d42';
            context.strokeRect(SHAFT_X - 9.5, 42.5, SHAFT_W + 19, 299);

            // shaft interior
            context.fillStyle = '#09100d';
            context.fillRect(SHAFT_X, 48, SHAFT_W, 286);

            // rails
            context.fillStyle = '#56645d';
            context.fillRect(SHAFT_X + 8, 50, 3, 282);
            context.fillRect(SHAFT_X + SHAFT_W - 11, 50, 3, 282);

            // floor indicator
            context.fillStyle = '#121917';
            context.fillRect(SHAFT_X + 10, 51, SHAFT_W - 20, 16);

            context.strokeStyle = '#b58a4a';
            context.strokeRect(SHAFT_X + 10.5, 51.5, SHAFT_W - 21, 15);

            context.fillStyle = '#f1d98e';
            context.font = 'bold 10px monospace';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(`PISO ${ floorLabel(elevator.floor) }`, SHAFT_X + (SHAFT_W / 2), 60);

            // destinations in cabin, clearer than floating numbers
            const dests =
                elevator.passengers
                    .slice(0, CAPACITY)
                    .map(passenger => floorLabel(passenger.to));

            const destText =
                dests.length
                    ? dests.join(' · ')
                    : 'VACIO';

            context.fillStyle = '#9fc2ad';
            context.font = 'bold 8px monospace';
            context.fillText(destText, SHAFT_X + (SHAFT_W / 2), 74);

            // waiting luggage
            for(let floor = 0; floor < FLOORS; floor++)
            {
                const y = floorY(floor);
                const queue = game.queues[floor];

                const left =
                    queue
                        .filter(passenger => passenger.side === 'left')
                        .slice(0, 3);

                const right =
                    queue
                        .filter(passenger => passenger.side === 'right')
                        .slice(0, 3);

                left.forEach((passenger, index) =>
                {
                    const x = 62 + (index * 28);

                    drawPassenger(context, passenger, x, y + 22);

                    context.fillStyle = '#111816';
                    context.fillRect(x - 8, y + 24, 16, 2);

                    context.fillStyle =
                        passenger.mood > 0.65
                            ? '#6ecb7a'
                            : passenger.mood > 0.30
                                ? '#d9b452'
                                : '#d9625f';

                    context.fillRect(
                        x - 8,
                        y + 24,
                        Math.max(1, Math.round(16 * clamp(passenger.mood, 0, 1))),
                        2
                    );
                });

                right.forEach((passenger, index) =>
                {
                    const x = 438 - (index * 28);

                    drawPassenger(context, passenger, x, y + 22);

                    context.fillStyle = '#111816';
                    context.fillRect(x - 8, y + 24, 16, 2);

                    context.fillStyle =
                        passenger.mood > 0.65
                            ? '#6ecb7a'
                            : passenger.mood > 0.30
                                ? '#d9b452'
                                : '#d9625f';

                    context.fillRect(
                        x - 8,
                        y + 24,
                        Math.max(1, Math.round(16 * clamp(passenger.mood, 0, 1))),
                        2
                    );
                });
            }

            const cabX = SHAFT_X + ((SHAFT_W - CAB_W) / 2);
            const cabY = elevator.y;

            // outer cabin
            context.fillStyle = '#a07c49';
            context.fillRect(cabX - 3, cabY - 3, CAB_W + 6, CAB_H + 6);

            context.fillStyle = '#212d29';
            context.fillRect(cabX, cabY, CAB_W, CAB_H);

            // back wall
            context.fillStyle = '#d1bc84';
            context.fillRect(cabX + 3, cabY + 3, CAB_W - 6, CAB_H - 6);

            // floor panel
            context.fillStyle = '#7b6648';
            context.fillRect(cabX + 3, cabY + CAB_H - 8, CAB_W - 6, 5);

            const openAmount = Math.round(elevator.door * 18);
            const half = Math.floor((CAB_W - 8) / 2);

            context.fillStyle = '#4e6258';

            context.fillRect(
                cabX + 4,
                cabY + 4,
                Math.max(0, half - openAmount),
                CAB_H - 12
            );

            context.fillRect(
                cabX + CAB_W - 4 - Math.max(0, half - openAmount),
                cabY + 4,
                Math.max(0, half - openAmount),
                CAB_H - 12
            );

            // luggage inside cabin, no overlapping tags
            elevator.passengers
                .slice(0, CAPACITY)
                .forEach((passenger, index) =>
                {
                    const row = Math.floor(index / 2);
                    const col = index % 2;

                    drawPassenger(
                        context,
                        passenger,
                        cabX + 17 + (col * 20),
                        cabY + 22 + (row * 12),
                        true
                    );
                });

            // current floor drop glow
            const currentY = floorY(elevator.floor);
            context.fillStyle = 'rgba(242, 206, 107, .18)';
            context.fillRect(150, currentY - 2, 204, 26);

            // footer hint
            context.fillStyle = '#101715';
            context.fillRect(164, 344, 192, 24);

            context.strokeStyle = '#8d6d42';
            context.strokeRect(164.5, 344.5, 191, 23);

            const helpText =
                game.feedbackTime > 0 && game.feedback
                    ? game.feedback
                    : 'RECOGE Y ENTREGA SEGUN LA ETIQUETA';

            context.fillStyle = '#f1d98e';
            context.font = 'bold 10px monospace';
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            context.fillText(helpText, SCREEN_W / 2, 357);

            // floating score popups
            for(const popup of game.popups)
            {
                const alpha = clamp(popup.ttl / 0.8, 0, 1);

                context.fillStyle =
                    popup.positive
                        ? `rgba(220, 241, 165, ${ alpha })`
                        : `rgba(255, 125, 125, ${ alpha })`;

                context.font = 'bold 11px monospace';
                context.textAlign = 'center';
                context.fillText(popup.text, popup.x, popup.y);
            }

            // light crt scanlines
            context.fillStyle = 'rgba(255,255,255,.016)';
            for(let y = 0; y < SCREEN_H; y += 4)
            {
                context.fillRect(0, y, SCREEN_W, 1);
            }
        };

        const loop = (now: number) =>
        {
            const game = gameRef.current;

            if(game.phase === 'playing')
            {
                if(!lastFrameRef.current) lastFrameRef.current = now;
                const delta = Math.min(0.05, Math.max(0.001, (now - lastFrameRef.current) / 1000));
                lastFrameRef.current = now;
                stepGame(delta);
            }
            else
            {
                lastFrameRef.current = now;
            }

            draw();
            frameId = window.requestAnimationFrame(loop);
        };

        frameId = window.requestAnimationFrame(loop);

        return () => window.cancelAnimationFrame(frameId);
    }, []);

    if(!isVisible) return null;

    const formattedScore =
        score.toString().padStart(5, '0');

    const formattedBest =
        serverBest.toString().padStart(5, '0');

    const phaseLabel =
        phase === 'playing'
            ? 'SERVICIO'
            : phase === 'paused'
                ? 'PAUSA'
                : phase === 'gameover'
                    ? 'FIN'
                    : 'PREPARADO';

    return (
        <>
            <NitroCardView
                uniqueKey="biribiri-liftshift"
                className="nitro-liftshift"
                theme="primary-slim"
                style={ { width: '760px' } }>
                <NitroCardHeaderView
                    headerText="Lift Shift"
                    onCloseClick={ close } />

                <NitroCardContentView
                    gap={ 0 }
                    className="liftshift-content">
                    <div
                        className="liftshift-shell"
                        data-engine={ UI_MARKER }>
                        <span
                            className="liftshift-cabinet-screw is-top-left"
                            aria-hidden="true" />
                        <span
                            className="liftshift-cabinet-screw is-top-right"
                            aria-hidden="true" />
                        <span
                            className="liftshift-cabinet-screw is-bottom-left"
                            aria-hidden="true" />
                        <span
                            className="liftshift-cabinet-screw is-bottom-right"
                            aria-hidden="true" />

                        <div className="liftshift-hud">
                            <div className="liftshift-hud-cell is-score">
                                <span className="liftshift-hud-label">
                                    PUNTUACIÓN
                                </span>
                                <strong className="liftshift-score-value">
                                    { formattedScore }
                                </strong>
                            </div>

                            <div className="liftshift-hud-cell is-round">
                                <span className="liftshift-hud-label">
                                    NIVEL
                                </span>
                                <strong className="liftshift-round-value">
                                    { level.toString().padStart(2, '0') }
                                </strong>
                            </div>

                            <div className="liftshift-hud-cell is-hits">
                                <span className="liftshift-hud-label">
                                    PASAJEROS
                                </span>
                                <strong className="liftshift-hits-value">
                                    { delivered }
                                </strong>
                            </div>

                            <div className="liftshift-hud-cell is-hits">
                                <span className="liftshift-hud-label">
                                    COMBO
                                </span>
                                <strong className="liftshift-hits-value">
                                    { combo > 0 ? `x${ combo }` : '—' }
                                </strong>
                            </div>

                            <div
                                className={
                                    `liftshift-hud-cell is-status is-${ phase }`
                                }>
                                <LiftShiftIcon active={ phase === 'playing' } />
                                <strong>{ phaseLabel }</strong>
                            </div>
                        </div>

                        <div className="liftshift-stage">
                            <canvas
                                ref={ canvasRef }
                                className="liftshift-canvas"
                                width={ SCREEN_W * 2 }
                                height={ SCREEN_H * 2 }
                                tabIndex={ 0 }
                                aria-label="Lift Shift" />

                            <div
                                className="liftshift-crt-lines"
                                aria-hidden="true" />

                            { phase === 'ready' &&
                                <div className="liftshift-game-overlay">
                                    <div className="liftshift-overlay-panel">
                                        <span className="liftshift-overlay-kicker">
                                            HOTEL · TURNO DE NOCHE
                                        </span>
                                        <strong className="liftshift-overlay-title">
                                            LIFT SHIFT
                                        </strong>
                                        <span className="liftshift-overlay-copy">
                                            Sube y baja el ascensor, recoge huéspedes
                                            y llévalos a su planta antes de que pierdan
                                            la paciencia.
                                        </span>

                                        <button
                                            type="button"
                                            className="liftshift-primary-button"
                                            disabled={ startPending }
                                            onClick={ requestStartGame }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'JUGAR' }
                                        </button>

                                        <span className="liftshift-overlay-hint">
                                            ↑ ↓ mover · ESPACIO abrir · P pausa
                                        </span>

                                        { resultState === 'rejected' &&
                                            <span className="liftshift-result-message is-error">
                                                { resultMessage }
                                            </span> }
                                    </div>
                                </div> }

                            { phase === 'paused' &&
                                <div className="liftshift-game-overlay is-pause">
                                    <div className="liftshift-overlay-panel is-compact">
                                        <span className="liftshift-overlay-kicker">
                                            SERVICIO DETENIDO
                                        </span>
                                        <strong className="liftshift-overlay-title">
                                            PAUSA
                                        </strong>

                                        <button
                                            type="button"
                                            className="liftshift-primary-button"
                                            onClick={ togglePause }>
                                            CONTINUAR
                                        </button>

                                        <span className="liftshift-overlay-hint">
                                            P o ESC para continuar
                                        </span>
                                    </div>
                                </div> }

                            { phase === 'gameover' &&
                                <div className="liftshift-game-overlay is-gameover">
                                    <div className="liftshift-overlay-panel">
                                        <span className="liftshift-overlay-kicker">
                                            TURNO FINALIZADO
                                        </span>
                                        <strong className="liftshift-overlay-title">
                                            FIN DEL SERVICIO
                                        </strong>

                                        <div className="liftshift-gameover-results">
                                            <span>
                                                PUNTUACIÓN
                                                <b>{ formattedScore }</b>
                                            </span>

                                            <span>
                                                NIVEL
                                                <b>{ level }</b>
                                            </span>

                                            <span>
                                                PASAJEROS
                                                <b>{ delivered }</b>
                                            </span>
                                        </div>

                                        { newServerRecord &&
                                            <div className="liftshift-new-record">
                                                ★ NUEVO RÉCORD PERSONAL ★
                                            </div> }

                                        { resultState !== 'idle' &&
                                            <span
                                                className={
                                                    `liftshift-result-message${
                                                        resultState === 'rejected'
                                                            ? ' is-error'
                                                            : ' is-success'
                                                    }`
                                                }>
                                                { resultMessage }
                                            </span> }

                                        <button
                                            type="button"
                                            className="liftshift-primary-button"
                                            disabled={ startPending }
                                            onClick={ requestStartGame }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'JUGAR DE NUEVO' }
                                        </button>
                                    </div>
                                </div> }
                        </div>

                        <div className="liftshift-console">
                            <div className="liftshift-controls-panel">
                                <div className="liftshift-control-group">
                                    <button
                                        type="button"
                                        className="liftshift-keycap"
                                        onClick={ () => queueMove(1) }>
                                        ↑
                                    </button>
                                    <button
                                        type="button"
                                        className="liftshift-keycap"
                                        onClick={ () => queueMove(-1) }>
                                        ↓
                                    </button>
                                    <span className="liftshift-control-action">
                                        ASCENSOR
                                    </span>
                                </div>

                                <span className="liftshift-console-divider" />

                                <div className="liftshift-control-group">
                                    <button
                                        type="button"
                                        className="liftshift-keycap is-click"
                                        onClick={ openDoors }>
                                        ESPACIO
                                    </button>
                                    <span className="liftshift-control-action">
                                        ABRIR
                                    </span>
                                </div>

                                <span className="liftshift-console-divider" />

                                <div className="liftshift-control-group">
                                    <button
                                        type="button"
                                        className="liftshift-keycap"
                                        onClick={ togglePause }>
                                        P
                                    </button>
                                    <span className="liftshift-control-action">
                                        PAUSA
                                    </span>
                                </div>
                            </div>

                            <div className="liftshift-console-actions">
                                <button
                                    type="button"
                                    className={
                                        `liftshift-sound-button${
                                            soundEnabled
                                                ? ' is-on'
                                                : ''
                                        }`
                                    }
                                    onClick={ toggleSound }
                                    aria-pressed={ soundEnabled }>
                                    <span
                                        className="liftshift-sound-icon"
                                        aria-hidden="true">
                                        ♪
                                    </span>
                                    <span>
                                        SONIDO
                                        <b>
                                            { soundEnabled ? 'ON' : 'OFF' }
                                        </b>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className="liftshift-restart-button"
                                    onClick={ resetReadyGame }>
                                    <span className="liftshift-restart-shine" />
                                    <span>REINICIAR</span>
                                </button>
                            </div>
                        </div>

                        <div className="liftshift-arcade-summary-bar">
                            <div className="liftshift-arcade-summary-brand">
                                <span>RANKING GLOBAL</span>
                                <strong>LIFT SHIFT</strong>
                            </div>

                            <div className="liftshift-arcade-summary-stats">
                                <span>
                                    TU RÉCORD
                                    <b>{ formattedBest }</b>
                                </span>

                                <span>
                                    TU PUESTO
                                    <b>
                                        { personalRank > 0
                                            ? `#${ personalRank }`
                                            : '—' }
                                    </b>
                                </span>

                                <span>
                                    JUGADORES
                                    <b>{ totalPlayers }</b>
                                </span>
                            </div>

                            <button
                                type="button"
                                className="liftshift-records-button"
                                onClick={ openRecords }>
                                <span
                                    className="liftshift-records-star"
                                    aria-hidden="true">
                                    ★
                                </span>
                                <span>RÉCORDS</span>
                            </button>
                        </div>
                    </div>
                </NitroCardContentView>
            </NitroCardView>

            <ArcadeLeaderboardView
                visible={ recordsOpen }
                gameName="Lift Shift"
                levelLabel="NIVEL"
                leaderboard={ leaderboard }
                personalBest={ serverBest }
                personalRank={ personalRank }
                totalPlayers={ totalPlayers }
                onClose={ closeRecords } />
        </>
    );
};

export default LiftShiftView;

