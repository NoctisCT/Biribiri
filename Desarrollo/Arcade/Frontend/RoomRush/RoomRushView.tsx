import {
    ArcadeCloseEvent,
    ArcadeGameStartComposer,
    ArcadeGameStartedEvent,
    ArcadeLeaderboardEvent,
    ArcadeScoreSubmitComposer,
    LiftShiftOpenEvent
} from '@nitrots/nitro-renderer';
import { FC, useEffect, useRef, useState } from 'react';
import {
    NitroCardContentView,
    NitroCardHeaderView,
    NitroCardView
} from '../../common';
import { SendMessageComposer } from '../../api';
import { useMessageEvent } from '../../hooks/events';
import { ArcadeLeaderboardView } from '../arcade/ArcadeLeaderboardView';
import './LiftShiftView.scss';

type Phase = 'ready' | 'playing' | 'paused' | 'gameover';
type ResultState = 'idle' | 'accepted' | 'rejected';
type Service = 'towels' | 'food' | 'clean' | 'repair';

interface Request
{
    id: number;
    room: number;
    service: Service;
    ttl: number;
    maxTtl: number;
    vip: boolean;
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

interface Spark
{
    x: number;
    y: number;
    vx: number;
    vy: number;
    ttl: number;
}

interface Model
{
    phase: Phase;
    score: number;
    level: number;
    served: number;
    combo: number;
    strikes: number;
    selected: Service;
    targetRoom: number;
    playerX: number;
    targetX: number;
    spawnTimer: number;
    requestId: number;
    feedback: string;
    feedbackTime: number;
    rushTime: number;
    requests: Array<Request | null>;
    doorFx: number[];
    popups: Popup[];
    sparks: Spark[];
}

interface LeaderboardEntry
{
    rank: number;
    username: string;
    score: number;
    level: number;
}

const GAME_KEY = 'room_rush';
const UI_MARKER = 'BIRIBIRI_ROOM_RUSH_DIFFICULTY_V1';

const W = 640;
const H = 420;
const ROOM_COUNT = 8;
const MAX_STRIKES = 3;
const MAX_LEVEL = 99;

const DOOR_W = 50;
const DOOR_H = 118;
const DOOR_Y = 128;
const FLOOR_Y = 310;

const ROOM_X = [ 48, 122, 196, 270, 344, 418, 492, 566 ];

const SERVICES: Service[] = [ 'towels', 'food', 'clean', 'repair' ];

const LABEL: Record<Service, string> = {
    towels: 'TOALLAS',
    food: 'ROOM SERVICE',
    clean: 'LIMPIEZA',
    repair: 'MANTENIMIENTO'
};

const SHORT: Record<Service, string> = {
    towels: 'TOA',
    food: 'ROOM',
    clean: 'LIM',
    repair: 'REP'
};

const COLOR: Record<Service, string> = {
    towels: '#76d9e8',
    food: '#f2c65b',
    clean: '#83df78',
    repair: '#9da9ff'
};

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

const rnd = (max: number) => Math.floor(Math.random() * max);

const centerX = (room: number) => ROOM_X[room] + (DOOR_W / 2);

const fmt = (value: number) => value.toString().padStart(5, '0');

const freshGame = (phase: Phase = 'ready'): Model => ({
    phase,
    score: 0,
    level: 1,
    served: 0,
    combo: 0,
    strikes: 0,
    selected: 'towels',
    targetRoom: 3,
    playerX: centerX(3),
    targetX: centerX(3),
    spawnTimer: 0.9,
    requestId: 1,
    feedback: '',
    feedbackTime: 0,
    rushTime: 0,
    requests: Array.from({ length: ROOM_COUNT }, () => null),
    doorFx: Array.from({ length: ROOM_COUNT }, () => 0),
    popups: [],
    sparks: []
});

const PixelService: FC<{ service: Service }> = ({ service }) =>
{
    return (
        <span
            className={ `room-rush-service-icon is-${ service }` }
            aria-hidden="true">
            { service === 'towels' &&
                <>
                    <i className="p1" />
                    <i className="p2" />
                </> }
            { service === 'food' &&
                <>
                    <i className="p1" />
                    <i className="p2" />
                    <i className="p3" />
                </> }
            { service === 'clean' &&
                <>
                    <i className="p1" />
                    <i className="p2" />
                </> }
            { service === 'repair' &&
                <>
                    <i className="p1" />
                    <i className="p2" />
                    <i className="p3" />
                </> }
        </span>
    );
};

const StatusBell: FC<{}> = () =>
{
    return (
        <span className="room-rush-bell" aria-hidden="true">
            <i className="top" />
            <i className="body" />
            <i className="base" />
            <i className="shine" />
        </span>
    );
};

export const LiftShiftView: FC<{}> = () =>
{
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const visibleRef = useRef(false);
    const gameRef = useRef<Model>(freshGame());
    const itemIdRef = useRef(0);
    const runTokenRef = useRef('');
    const submittedRef = useRef(false);
    const startPendingRef = useRef(false);
    const lastFrameRef = useRef(0);
    const soundRef = useRef(true);
    const audioRef = useRef<AudioContext | null>(null);

    const [ isVisible, setIsVisible ] = useState(false);
    const [ score, setScore ] = useState(0);
    const [ level, setLevel ] = useState(1);
    const [ served, setServed ] = useState(0);
    const [ combo, setCombo ] = useState(0);
    const [ strikes, setStrikes ] = useState(0);
    const [ phase, setPhase ] = useState<Phase>('ready');
    const [ selected, setSelected ] = useState<Service>('towels');
    const [ sound, setSound ] = useState(true);
    const [ startPending, setStartPending ] = useState(false);
    const [ leaderboard, setLeaderboard ] = useState<LeaderboardEntry[]>([]);
    const [ serverBest, setServerBest ] = useState(0);
    const [ personalRank, setPersonalRank ] = useState(0);
    const [ totalPlayers, setTotalPlayers ] = useState(0);
    const [ recordsOpen, setRecordsOpen ] = useState(false);
    const [ resultState, setResultState ] = useState<ResultState>('idle');
    const [ resultMessage, setResultMessage ] = useState('');
    const [ newRecord, setNewRecord ] = useState(false);

    const ensureAudio = (): AudioContext | null =>
    {
        if(!soundRef.current) return null;

        try
        {
            if(!audioRef.current)
            {
                const AudioContextClass =
                    window.AudioContext ||
                    (window as any).webkitAudioContext;

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
        volume = 0.025,
        delay = 0,
        endFrequency?: number) =>
    {
        const context = ensureAudio();
        if(!context) return;

        const start = context.currentTime + delay;
        const osc = context.createOscillator();
        const gain = context.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(Math.max(1, frequency), start);

        if(endFrequency !== undefined)
            osc.frequency.exponentialRampToValueAtTime(
                Math.max(1, endFrequency),
                start + duration
            );

        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + 0.005);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

        osc.connect(gain);
        gain.connect(context.destination);
        osc.start(start);
        osc.stop(start + duration + 0.02);
    };

    const playStart = () =>
    {
        tone(330, 0.05);
        tone(494, 0.05, 'square', 0.025, 0.06);
        tone(659, 0.09, 'square', 0.027, 0.12);
    };

    const playStep = () => tone(145, 0.025, 'triangle', 0.012);
    const playServe = () =>
    {
        tone(660, 0.05);
        tone(880, 0.07, 'square', 0.025, 0.05);
    };
    const playWrong = () => tone(145, 0.13, 'sawtooth', 0.03, 0, 80);
    const playRush = () =>
    {
        tone(523, 0.05);
        tone(784, 0.05, 'square', 0.026, 0.06);
        tone(1046, 0.09, 'square', 0.028, 0.12);
    };
    const playGameOver = () =>
    {
        tone(250, 0.12);
        tone(165, 0.18, 'sawtooth', 0.03, 0.10, 85);
    };

    const syncHud = () =>
    {
        const g = gameRef.current;
        setScore(g.score);
        setLevel(g.level);
        setServed(g.served);
        setCombo(g.combo);
        setStrikes(g.strikes);
        setPhase(g.phase);
        setSelected(g.selected);
    };

    const addPopup = (
        text: string,
        x: number,
        y: number,
        positive = true) =>
    {
        gameRef.current.popups.push({
            id: Date.now() + rnd(9999),
            text,
            x,
            y,
            ttl: 0.85,
            positive
        });
    };

    const addSparks = (x: number, y: number) =>
    {
        for(let i = 0; i < 10; i++)
        {
            gameRef.current.sparks.push({
                x,
                y,
                vx: -45 + (Math.random() * 90),
                vy: -65 + (Math.random() * 30),
                ttl: 0.35 + (Math.random() * 0.35)
            });
        }
    };

    const resetReady = () =>
    {
        gameRef.current = freshGame('ready');
        runTokenRef.current = '';
        submittedRef.current = false;
        startPendingRef.current = false;
        lastFrameRef.current = 0;

        setStartPending(false);
        setResultState('idle');
        setResultMessage('');
        setNewRecord(false);
        syncHud();
    };

    const spawnRequest = (forced = false) =>
    {
        const g = gameRef.current;
        const active = g.requests.filter(Boolean).length;
        const maxActive = Math.min(
            7,
            2 + Math.floor((g.level - 1) / 2)
        );

        if(!forced && active >= maxActive) return;

        const free = g.requests
            .map((request, room) => request ? -1 : room)
            .filter(room => room >= 0);

        if(free.length === 0) return;

        const room = free[rnd(free.length)];
        const service = SERVICES[rnd(SERVICES.length)];
        const baseTtl = Math.max(
            4.2,
            10.5 - ((g.level - 1) * 0.48)
        );
        const vip = Math.random() < Math.min(
            0.08 + (g.level * 0.012),
            0.28
        );
        const ttl = vip ? baseTtl * 0.72 : baseTtl;

        g.requests[room] = {
            id: g.requestId++,
            room,
            service,
            ttl,
            maxTtl: ttl,
            vip
        };
    };

    const beginRun = (token: string) =>
    {
        gameRef.current = freshGame('playing');
        gameRef.current.feedback = 'TURNO ABIERTO';
        gameRef.current.feedbackTime = 1.0;

        runTokenRef.current = token;
        submittedRef.current = false;
        lastFrameRef.current = performance.now();

        spawnRequest(true);
        spawnRequest(true);

        setResultState('idle');
        setResultMessage('');
        setNewRecord(false);
        syncHud();
        playStart();

        window.setTimeout(() => canvasRef.current?.focus(), 0);
    };

    const requestStart = () =>
    {
        if(
            !visibleRef.current ||
            itemIdRef.current <= 0 ||
            startPendingRef.current
        ) return;

        ensureAudio();
        startPendingRef.current = true;
        setStartPending(true);
        setResultState('idle');
        setResultMessage('');
        setNewRecord(false);

        SendMessageComposer(
            new ArcadeGameStartComposer(
                itemIdRef.current,
                GAME_KEY
            )
        );
    };

    const submitScore = (finalScore: number, finalLevel: number) =>
    {
        if(
            submittedRef.current ||
            !runTokenRef.current ||
            itemIdRef.current <= 0
        ) return;

        submittedRef.current = true;

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
        submittedRef.current = false;
        startPendingRef.current = false;

        setStartPending(false);
        setRecordsOpen(false);
        setIsVisible(false);

        if(gameRef.current.phase === 'playing')
            gameRef.current.phase = 'paused';
    };

    const togglePause = () =>
    {
        const g = gameRef.current;

        if(g.phase === 'playing')
            g.phase = 'paused';
        else if(g.phase === 'paused')
        {
            g.phase = 'playing';
            lastFrameRef.current = performance.now();
        }
        else return;

        setPhase(g.phase);
    };

    const toggleSound = () =>
    {
        const next = !soundRef.current;
        soundRef.current = next;
        setSound(next);

        if(next)
        {
            ensureAudio();
            tone(520, 0.05);
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

    const selectService = (service: Service) =>
    {
        gameRef.current.selected = service;
        setSelected(service);

        tone(
            300 + (SERVICES.indexOf(service) * 70),
            0.035,
            'square',
            0.012
        );
    };

    const moveTarget = (direction: -1 | 1) =>
    {
        const g = gameRef.current;
        if(g.phase !== 'playing') return;

        const next = clamp(
            g.targetRoom + direction,
            0,
            ROOM_COUNT - 1
        );

        if(next === g.targetRoom) return;

        g.targetRoom = next;
        g.targetX = centerX(next);
        playStep();
    };

    const strike = (room: number, message: string) =>
    {
        const g = gameRef.current;

        g.strikes += 1;
        g.combo = 0;
        g.feedback = message;
        g.feedbackTime = 0.8;
        g.doorFx[room] = -0.7;

        addPopup('FALLO', centerX(room), 103, false);
        playWrong();
        syncHud();
    };

    const maybeLevel = () =>
    {
        const g = gameRef.current;
        const next = Math.min(
            MAX_LEVEL,
            1 + Math.floor(g.served / 8)
        );

        if(next > g.level)
        {
            g.level = next;
            g.feedback = `NIVEL ${ g.level }`;
            g.feedbackTime = 1.1;

            addPopup(`NIVEL ${ g.level }`, W / 2, 78, true);
            playRush();
        }
    };

    const serve = () =>
    {
        const g = gameRef.current;
        if(g.phase !== 'playing') return;

        if(Math.abs(g.playerX - g.targetX) > 12)
        {
            g.feedback = 'ACÉRCATE A LA PUERTA';
            g.feedbackTime = 0.45;
            return;
        }

        const room = g.targetRoom;
        const request = g.requests[room];

        if(!request)
        {
            g.feedback = 'SIN PETICIÓN';
            g.feedbackTime = 0.4;
            tone(190, 0.04, 'triangle', 0.01);
            return;
        }

        if(request.service !== g.selected)
        {
            strike(room, 'SERVICIO INCORRECTO');
            return;
        }

        g.requests[room] = null;
        g.served += 1;
        g.combo += 1;

        const rushMultiplier = g.rushTime > 0 ? 1.5 : 1;
        const vipMultiplier = request.vip ? 2 : 1;
        const base =
            100 +
            (g.level * 12) +
            (Math.max(0, g.combo - 1) * 18);

        const reward = Math.round(
            base *
            rushMultiplier *
            vipMultiplier
        );

        g.score += reward;
        g.doorFx[room] = 0.75;
        g.feedback = request.vip
            ? `VIP +${ reward }`
            : `PERFECTO +${ reward }`;
        g.feedbackTime = 0.65;

        addPopup(`+${ reward }`, centerX(room), 103, true);
        addSparks(centerX(room), 144);
        playServe();

        if(g.combo > 0 && g.combo % 5 === 0)
        {
            g.rushTime = 4.5;
            g.feedback = '★ RUSH MODE ★';
            g.feedbackTime = 1.0;
            playRush();
        }

        maybeLevel();
        g.spawnTimer = Math.min(g.spawnTimer, 0.8);
        syncHud();
    };

    useMessageEvent(LiftShiftOpenEvent, (event: LiftShiftOpenEvent) =>
    {
        const parser = event.getParser();

        itemIdRef.current = parser.itemId;
        resetReady();
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
            setResultMessage(
                parser.message ||
                'No se pudo iniciar la partida.'
            );
            return;
        }

        beginRun(parser.token);
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
            setResultMessage(
                parser.message ||
                'Puntuación registrada.'
            );
            setNewRecord(parser.newRecord);
        }
        else if(parser.context === 2)
        {
            setResultState('rejected');
            setResultMessage(
                parser.message ||
                'La puntuación no pudo validarse.'
            );
            setNewRecord(false);
        }
    });

    useMessageEvent(ArcadeCloseEvent, (event: ArcadeCloseEvent) =>
    {
        const parser = event.getParser();

        if(
            parser.gameKey !== GAME_KEY ||
            parser.itemId !== itemIdRef.current
        ) return;

        visibleRef.current = false;
        runTokenRef.current = '';
        submittedRef.current = false;
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
                'ArrowLeft',
                'ArrowRight',
                'KeyA',
                'KeyD',
                'Digit1',
                'Digit2',
                'Digit3',
                'Digit4',
                'Space',
                'Enter',
                'KeyP',
                'Escape'
            ].includes(event.code);

            if(handled) event.preventDefault();

            if(event.code === 'Enter')
            {
                if(
                    gameRef.current.phase === 'ready' ||
                    gameRef.current.phase === 'gameover'
                ) requestStart();
                return;
            }

            if(event.code === 'KeyP' || event.code === 'Escape')
            {
                togglePause();
                return;
            }

            if(event.code === 'Digit1')
            {
                selectService('towels');
                return;
            }

            if(event.code === 'Digit2')
            {
                selectService('food');
                return;
            }

            if(event.code === 'Digit3')
            {
                selectService('clean');
                return;
            }

            if(event.code === 'Digit4')
            {
                selectService('repair');
                return;
            }

            if(event.code === 'Space')
            {
                serve();
                return;
            }

            if(gameRef.current.phase !== 'playing') return;

            if(event.code === 'ArrowLeft' || event.code === 'KeyA')
                moveTarget(-1);
            else if(event.code === 'ArrowRight' || event.code === 'KeyD')
                moveTarget(1);
        };

        const blur = () =>
        {
            if(
                visibleRef.current &&
                gameRef.current.phase === 'playing'
            )
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

        const finish = () =>
        {
            const g = gameRef.current;
            if(g.phase === 'gameover') return;

            g.phase = 'gameover';
            g.feedback = 'TURNO CERRADO';
            g.feedbackTime = 1.2;

            setPhase('gameover');
            syncHud();
            playGameOver();
            submitScore(g.score, g.level);
        };

        const step = (dt: number) =>
        {
            const g = gameRef.current;
            if(g.phase !== 'playing') return;

            g.feedbackTime = Math.max(0, g.feedbackTime - dt);
            g.rushTime = Math.max(0, g.rushTime - dt);

            const speed = g.rushTime > 0 ? 560 : 410;
            const diff = g.targetX - g.playerX;

            if(Math.abs(diff) <= speed * dt)
                g.playerX = g.targetX;
            else
                g.playerX += Math.sign(diff) * speed * dt;

            g.spawnTimer -= dt;

            if(g.spawnTimer <= 0)
            {
                spawnRequest();
                g.spawnTimer = Math.max(
                    0.70,
                    2.35 - (g.level * 0.12)
                );
            }

            for(let room = 0; room < ROOM_COUNT; room++)
            {
                g.doorFx[room] =
                    g.doorFx[room] > 0
                        ? Math.max(0, g.doorFx[room] - dt)
                        : g.doorFx[room] < 0
                            ? Math.min(0, g.doorFx[room] + dt)
                            : 0;

                const request = g.requests[room];
                if(!request) continue;

                request.ttl -= dt;

                if(request.ttl <= 0)
                {
                    g.requests[room] = null;
                    strike(room, 'PETICIÓN PERDIDA');
                }
            }

            for(const popup of g.popups)
            {
                popup.ttl -= dt;
                popup.y -= 24 * dt;
            }

            g.popups = g.popups.filter(popup => popup.ttl > 0);

            for(const spark of g.sparks)
            {
                spark.ttl -= dt;
                spark.x += spark.vx * dt;
                spark.y += spark.vy * dt;
                spark.vy += 110 * dt;
            }

            g.sparks = g.sparks.filter(spark => spark.ttl > 0);

            if(g.strikes >= MAX_STRIKES)
                finish();
        };

        const drawIcon = (
            ctx: CanvasRenderingContext2D,
            service: Service,
            x: number,
            y: number,
            scale = 1) =>
        {
            ctx.save();
            ctx.translate(x, y);
            ctx.scale(scale, scale);

            const c = COLOR[service];

            ctx.fillStyle = '#111716';
            ctx.fillRect(-13, -13, 26, 26);
            ctx.strokeStyle = c;
            ctx.lineWidth = 2;
            ctx.strokeRect(-12, -12, 24, 24);
            ctx.fillStyle = c;

            if(service === 'towels')
            {
                ctx.fillRect(-8, -5, 16, 4);
                ctx.fillStyle = '#d9fbff';
                ctx.fillRect(-8, 1, 16, 6);
                ctx.fillStyle = '#31575c';
                ctx.fillRect(-5, 4, 10, 2);
            }
            else if(service === 'food')
            {
                ctx.fillRect(-9, 6, 18, 3);
                ctx.fillRect(-7, 3, 14, 3);
                ctx.fillRect(-5, -3, 10, 6);
                ctx.fillRect(-2, -7, 4, 4);
                ctx.fillStyle = '#fff2b6';
                ctx.fillRect(-1, -10, 2, 3);
            }
            else if(service === 'clean')
            {
                ctx.fillRect(-1, -9, 3, 14);
                ctx.fillRect(-7, 4, 15, 3);
                ctx.fillStyle = '#d9ffd4';
                ctx.fillRect(-9, 7, 19, 4);
            }
            else
            {
                ctx.fillRect(-8, -8, 5, 5);
                ctx.fillRect(3, 3, 5, 5);
                ctx.fillRect(-4, -4, 8, 8);
                ctx.fillStyle = '#e8eaff';
                ctx.fillRect(-2, -2, 4, 4);
            }

            ctx.restore();
        };

        const drawBellhop = (
            ctx: CanvasRenderingContext2D,
            x: number,
            y: number,
            service: Service,
            moving: boolean) =>
        {
            const bob = moving
                ? Math.sin(performance.now() / 70) * 1.5
                : 0;

            const px = Math.round(x);
            const py = Math.round(y + bob);

            ctx.fillStyle = 'rgba(0,0,0,.34)';
            ctx.fillRect(px - 11, py + 1, 22, 3);

            ctx.fillStyle = '#25211f';
            ctx.fillRect(px - 7, py - 12, 5, 13);
            ctx.fillRect(px + 2, py - 12, 5, 13);

            ctx.fillStyle = '#a83237';
            ctx.fillRect(px - 10, py - 30, 20, 18);

            ctx.fillStyle = '#d74b4d';
            ctx.fillRect(px - 8, py - 28, 6, 13);

            ctx.fillStyle = '#f0ca67';
            ctx.fillRect(px - 10, py - 16, 20, 2);
            ctx.fillRect(px - 1, py - 25, 2, 2);
            ctx.fillRect(px - 1, py - 21, 2, 2);

            ctx.fillStyle = '#edbe93';
            ctx.fillRect(px - 6, py - 38, 12, 9);

            ctx.fillStyle = '#30251f';
            ctx.fillRect(px - 7, py - 41, 14, 5);

            ctx.fillStyle = '#8e282d';
            ctx.fillRect(px - 8, py - 46, 16, 5);

            ctx.fillStyle = '#e2b94f';
            ctx.fillRect(px - 8, py - 42, 16, 2);

            ctx.fillStyle = COLOR[service];
            ctx.fillRect(px + 11, py - 26, 7, 7);

            ctx.fillStyle = '#151a18';
            ctx.fillRect(px + 13, py - 24, 3, 3);
        };

        const drawDoor = (
            ctx: CanvasRenderingContext2D,
            room: number,
            request: Request | null,
            selectedRoom: boolean,
            fx: number) =>
        {
            const x = ROOM_X[room];

            ctx.fillStyle = '#4e3734';
            ctx.fillRect(
                x - 5,
                DOOR_Y - 12,
                DOOR_W + 10,
                DOOR_H + 18
            );

            ctx.fillStyle = '#2a1b1b';
            ctx.fillRect(x, DOOR_Y, DOOR_W, DOOR_H);

            ctx.fillStyle =
                fx > 0
                    ? '#8b653d'
                    : fx < 0
                        ? '#703737'
                        : '#6f4d35';

            ctx.fillRect(
                x + 3,
                DOOR_Y + 3,
                DOOR_W - 6,
                DOOR_H - 6
            );

            ctx.fillStyle = '#523725';
            ctx.fillRect(x + 8, DOOR_Y + 18, DOOR_W - 16, 28);
            ctx.fillRect(x + 8, DOOR_Y + 57, DOOR_W - 16, 40);

            ctx.strokeStyle = '#98704a';
            ctx.strokeRect(
                x + 8.5,
                DOOR_Y + 18.5,
                DOOR_W - 17,
                27
            );
            ctx.strokeRect(
                x + 8.5,
                DOOR_Y + 57.5,
                DOOR_W - 17,
                39
            );

            ctx.fillStyle = '#d4af5b';
            ctx.fillRect(
                x + 13,
                DOOR_Y + 6,
                DOOR_W - 26,
                10
            );

            ctx.fillStyle = '#402d18';
            ctx.font = 'bold 8px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(
                String(201 + room),
                x + (DOOR_W / 2),
                DOOR_Y + 11
            );

            ctx.fillStyle = '#d9b95e';
            ctx.fillRect(
                x + DOOR_W - 11,
                DOOR_Y + 55,
                4,
                4
            );

            if(selectedRoom)
            {
                ctx.strokeStyle = '#f6d677';
                ctx.lineWidth = 2;
                ctx.strokeRect(
                    x - 4,
                    DOOR_Y - 11,
                    DOOR_W + 8,
                    DOOR_H + 16
                );

                ctx.fillStyle = '#f6d677';
                ctx.beginPath();
                ctx.moveTo(x + (DOOR_W / 2), DOOR_Y - 22);
                ctx.lineTo(x + (DOOR_W / 2) - 6, DOOR_Y - 14);
                ctx.lineTo(x + (DOOR_W / 2) + 6, DOOR_Y - 14);
                ctx.closePath();
                ctx.fill();
            }

            if(request)
            {
                const ratio = clamp(
                    request.ttl / request.maxTtl,
                    0,
                    1
                );

                const bubbleY = DOOR_Y - 45;

                drawIcon(
                    ctx,
                    request.service,
                    x + (DOOR_W / 2),
                    bubbleY,
                    request.vip ? 1.08 : 1
                );

                if(request.vip)
                {
                    ctx.fillStyle = '#ffe477';
                    ctx.font = 'bold 10px monospace';
                    ctx.textAlign = 'center';
                    ctx.fillText(
                        '★ VIP',
                        x + (DOOR_W / 2),
                        bubbleY - 20
                    );
                }

                ctx.fillStyle = '#111716';
                ctx.fillRect(
                    x + 4,
                    DOOR_Y - 10,
                    DOOR_W - 8,
                    4
                );

                ctx.fillStyle =
                    ratio > 0.55
                        ? '#65d883'
                        : ratio > 0.25
                            ? '#e6bd55'
                            : '#e66661';

                ctx.fillRect(
                    x + 4,
                    DOOR_Y - 10,
                    Math.max(
                        1,
                        Math.round((DOOR_W - 8) * ratio)
                    ),
                    4
                );
            }
        };

        const draw = () =>
        {
            const canvas = canvasRef.current;
            if(!canvas) return;

            const ctx = canvas.getContext('2d');
            if(!ctx) return;

            const g = gameRef.current;

            ctx.setTransform(2, 0, 0, 2, 0, 0);
            ctx.imageSmoothingEnabled = false;

            const wall = ctx.createLinearGradient(0, 0, 0, H);
            wall.addColorStop(0, '#4a3235');
            wall.addColorStop(0.58, '#332426');
            wall.addColorStop(1, '#1e191a');

            ctx.fillStyle = wall;
            ctx.fillRect(0, 0, W, H);

            for(let x = 0; x < W; x += 20)
            {
                ctx.fillStyle =
                    x % 40 === 0
                        ? 'rgba(232,195,121,.045)'
                        : 'rgba(0,0,0,.035)';
                ctx.fillRect(x, 0, 10, 300);
            }

            ctx.fillStyle = '#c8a864';
            ctx.fillRect(0, 18, W, 4);

            ctx.fillStyle = '#6d5433';
            ctx.fillRect(0, 22, W, 7);

            ctx.fillStyle = '#171514';
            ctx.fillRect(218, 38, 204, 35);

            ctx.strokeStyle = '#d1ad5b';
            ctx.strokeRect(219, 39, 202, 33);

            ctx.fillStyle = '#f1d787';
            ctx.font = 'bold 16px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('GRAND BIRIBIRI', W / 2, 52);

            ctx.fillStyle = '#bba675';
            ctx.font = 'bold 8px monospace';
            ctx.fillText('ROOM SERVICE · FLOOR 2', W / 2, 65);

            for(const x of [ 18, 612 ])
            {
                ctx.fillStyle = '#d7b557';
                ctx.fillRect(x - 3, 72, 6, 12);

                ctx.fillStyle = '#f4dc90';
                ctx.fillRect(x - 6, 68, 12, 5);
            }

            ctx.fillStyle = '#5c1f2a';
            ctx.fillRect(0, FLOOR_Y, W, H - FLOOR_Y);

            ctx.fillStyle = '#b28b43';
            ctx.fillRect(0, FLOOR_Y, W, 4);
            ctx.fillRect(0, H - 13, W, 3);

            ctx.fillStyle = '#43151e';
            for(let x = 0; x < W; x += 32)
            {
                ctx.fillRect(x, FLOOR_Y + 34, 16, 3);
                ctx.fillRect(x + 8, FLOOR_Y + 68, 16, 3);
            }

            for(let room = 0; room < ROOM_COUNT; room++)
            {
                drawDoor(
                    ctx,
                    room,
                    g.requests[room],
                    room === g.targetRoom,
                    g.doorFx[room]
                );
            }

            if(g.rushTime > 0)
            {
                ctx.fillStyle = '#2a2110';
                ctx.fillRect(452, 84, 172, 30);

                ctx.strokeStyle = '#f6d76e';
                ctx.strokeRect(452.5, 84.5, 171, 29);

                ctx.fillStyle = '#ffe88e';
                ctx.font = 'bold 11px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(
                    `★ RUSH ${ g.rushTime.toFixed(1) }`,
                    538,
                    102
                );
            }

            const moving = Math.abs(g.playerX - g.targetX) > 2;

            drawBellhop(
                ctx,
                g.playerX,
                361,
                g.selected,
                moving
            );

            for(const popup of g.popups)
            {
                const alpha = clamp(
                    popup.ttl / 0.85,
                    0,
                    1
                );

                ctx.fillStyle = popup.positive
                    ? `rgba(255,232,142,${ alpha })`
                    : `rgba(255,116,110,${ alpha })`;

                ctx.font = 'bold 12px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(popup.text, popup.x, popup.y);
            }

            for(const spark of g.sparks)
            {
                const alpha = clamp(spark.ttl / 0.7, 0, 1);
                ctx.fillStyle = `rgba(255,220,104,${ alpha })`;
                ctx.fillRect(
                    Math.round(spark.x),
                    Math.round(spark.y),
                    2,
                    2
                );
            }

            if(g.feedbackTime > 0 && g.feedback)
            {
                ctx.fillStyle = 'rgba(18,15,14,.92)';
                ctx.fillRect(208, 384, 224, 24);

                ctx.strokeStyle = '#bd9650';
                ctx.strokeRect(208.5, 384.5, 223, 23);

                ctx.fillStyle = '#f0d68d';
                ctx.font = 'bold 10px monospace';
                ctx.textAlign = 'center';
                ctx.fillText(g.feedback, W / 2, 400);
            }

            ctx.fillStyle = 'rgba(255,255,255,.014)';
            for(let y = 0; y < H; y += 4)
                ctx.fillRect(0, y, W, 1);
        };

        const frame = (now: number) =>
        {
            if(visibleRef.current)
            {
                const last = lastFrameRef.current;
                lastFrameRef.current = now;

                if(
                    last > 0 &&
                    gameRef.current.phase === 'playing'
                )
                {
                    const dt = Math.min(
                        0.033,
                        Math.max(0, (now - last) / 1000)
                    );
                    step(dt);
                }

                draw();
            }
            else
            {
                lastFrameRef.current = now;
            }

            frameId = window.requestAnimationFrame(frame);
        };

        frameId = window.requestAnimationFrame(frame);

        return () => window.cancelAnimationFrame(frameId);
    }, []);

    if(!isVisible) return null;

    const phaseLabel =
        phase === 'playing'
            ? 'SERVICIO'
            : phase === 'paused'
                ? 'PAUSA'
                : phase === 'gameover'
                    ? 'FIN'
                    : 'PREPARADO';

    const formattedScore = fmt(score);
    const formattedBest = fmt(serverBest);

    return (
        <>
            <NitroCardView
                uniqueKey="room-rush"
                className="nitro-room-rush"
                theme="primary-slim"
                style={ { width: '760px' } }>
                <NitroCardHeaderView
                    headerText="Room Rush"
                    onCloseClick={ close } />

                <NitroCardContentView
                    gap={ 0 }
                    className="room-rush-content">
                    <div
                        className="room-rush-shell"
                        data-engine={ UI_MARKER }>
                        <span
                            className="room-rush-cabinet-screw is-top-left"
                            aria-hidden="true" />
                        <span
                            className="room-rush-cabinet-screw is-top-right"
                            aria-hidden="true" />
                        <span
                            className="room-rush-cabinet-screw is-bottom-left"
                            aria-hidden="true" />
                        <span
                            className="room-rush-cabinet-screw is-bottom-right"
                            aria-hidden="true" />

                        <div className="room-rush-hud">
                            <div className="room-rush-hud-cell is-score">
                                <span className="room-rush-hud-label">
                                    PUNTUACIÓN
                                </span>
                                <strong className="room-rush-score-value">
                                    { formattedScore }
                                </strong>
                            </div>

                            <div className="room-rush-hud-cell is-round">
                                <span className="room-rush-hud-label">
                                    NIVEL
                                </span>
                                <strong className="room-rush-level-value">
                                    { level.toString().padStart(2, '0') }
                                </strong>
                            </div>

                            <div className="room-rush-hud-cell is-hits">
                                <span className="room-rush-hud-label">
                                    ATENDIDAS
                                </span>
                                <strong className="room-rush-served-value">
                                    { served }
                                </strong>
                            </div>

                            <div className="room-rush-hud-cell is-hits">
                                <span className="room-rush-hud-label">
                                    COMBO
                                </span>
                                <strong className="room-rush-served-value">
                                    { combo > 0 ? `x${ combo }` : '—' }
                                </strong>
                            </div>

                            <div
                                className={
                                    `room-rush-hud-cell is-status is-${ phase }`
                                }>
                                <StatusBell />
                                <strong>{ phaseLabel }</strong>
                            </div>
                        </div>

                        <div className="room-rush-stage">
                            <canvas
                                ref={ canvasRef }
                                className="room-rush-canvas"
                                width={ W * 2 }
                                height={ H * 2 }
                                tabIndex={ 0 }
                                aria-label="Room Rush" />

                            { phase === 'ready' &&
                                <div className="room-rush-game-overlay">
                                    <div className="room-rush-overlay-panel">
                                        <span className="room-rush-overlay-kicker">
                                            GRAND BIRIBIRI
                                        </span>

                                        <strong className="room-rush-overlay-title">
                                            ROOM RUSH
                                        </strong>

                                        <span className="room-rush-overlay-copy">
                                            Corre hasta la habitación,
                                            selecciona el servicio que pide
                                            y atiéndela antes de que expire.
                                        </span>

                                        <button
                                            type="button"
                                            className="room-rush-primary-button"
                                            disabled={ startPending }
                                            onClick={ requestStart }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'JUGAR' }
                                        </button>

                                        <span className="room-rush-overlay-hint">
                                            ENTER TAMBIÉN INICIA
                                        </span>

                                        { resultState === 'rejected' &&
                                            <span className="room-rush-result-message is-error">
                                                { resultMessage }
                                            </span> }
                                    </div>
                                </div> }

                            { phase === 'paused' &&
                                <div className="room-rush-game-overlay is-pause">
                                    <div className="room-rush-overlay-panel is-compact">
                                        <span className="room-rush-overlay-kicker">
                                            TURNO DETENIDO
                                        </span>

                                        <strong className="room-rush-overlay-title">
                                            PAUSA
                                        </strong>

                                        <button
                                            type="button"
                                            className="room-rush-primary-button"
                                            onClick={ togglePause }>
                                            CONTINUAR
                                        </button>

                                        <span className="room-rush-overlay-hint">
                                            P o ESC para continuar
                                        </span>
                                    </div>
                                </div> }

                            { phase === 'gameover' &&
                                <div className="room-rush-game-overlay is-gameover">
                                    <div className="room-rush-overlay-panel">
                                        <span className="room-rush-overlay-kicker">
                                            TURNO FINALIZADO
                                        </span>

                                        <strong className="room-rush-overlay-title">
                                            FIN DEL TURNO
                                        </strong>

                                        <div className="room-rush-gameover-results">
                                            <span>
                                                PUNTUACIÓN
                                                <b>{ formattedScore }</b>
                                            </span>
                                            <span>
                                                NIVEL
                                                <b>{ level }</b>
                                            </span>
                                            <span>
                                                ATENDIDAS
                                                <b>{ served }</b>
                                            </span>
                                        </div>

                                        { newRecord &&
                                            <div className="room-rush-new-record">
                                                ★ NUEVO RÉCORD PERSONAL ★
                                            </div> }

                                        { resultState !== 'idle' &&
                                            <span
                                                className={
                                                    `room-rush-result-message${
                                                        resultState === 'rejected'
                                                            ? ' is-error'
                                                            : ' is-success'
                                                    }`
                                                }>
                                                { resultMessage }
                                            </span> }

                                        <button
                                            type="button"
                                            className="room-rush-primary-button"
                                            disabled={ startPending }
                                            onClick={ requestStart }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'JUGAR DE NUEVO' }
                                        </button>
                                    </div>
                                </div> }
                        </div>

                        <div className="room-rush-console">
                            <div className="room-rush-controls-panel">
                                <div className="room-rush-control-group">
                                    <span className="room-rush-keycap">←</span>
                                    <span className="room-rush-keycap">→</span>
                                    <span className="room-rush-control-action">
                                        MOVER
                                    </span>
                                </div>

                                <span className="room-rush-console-divider" />

                                <div className="room-rush-tool-row">
                                    { SERVICES.map((service, index) =>
                                        <button
                                            key={ service }
                                            type="button"
                                            className={
                                                `room-rush-tool-button${
                                                    selected === service
                                                        ? ' is-selected'
                                                        : ''
                                                }`
                                            }
                                            onClick={ () => selectService(service) }>
                                            <b>{ index + 1 }</b>
                                            <PixelService service={ service } />
                                        </button>
                                    ) }
                                </div>

                                <span className="room-rush-console-divider" />

                                <div className="room-rush-control-group">
                                    <button
                                        type="button"
                                        className="room-rush-keycap is-click"
                                        onClick={ serve }>
                                        ESPACIO
                                    </button>
                                    <span className="room-rush-control-action">
                                        ATENDER
                                    </span>
                                </div>

                                <span className="room-rush-console-divider" />

                                <div className="room-rush-control-group">
                                    <span className="room-rush-keycap">P</span>
                                    <span className="room-rush-control-action">
                                        PAUSA
                                    </span>
                                </div>
                            </div>

                            <div className="room-rush-console-actions">
                                <button
                                    type="button"
                                    className={
                                        `room-rush-sound-button${
                                            sound ? ' is-on' : ''
                                        }`
                                    }
                                    onClick={ toggleSound }
                                    aria-pressed={ sound }>
                                    <span
                                        className="room-rush-sound-icon"
                                        aria-hidden="true">
                                        ♪
                                    </span>
                                    <span>
                                        SONIDO
                                        <b>{ sound ? 'ON' : 'OFF' }</b>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className="room-rush-restart-button"
                                    disabled={ startPending }
                                    onClick={ requestStart }>
                                    <span className="room-rush-restart-shine" />
                                    <span>REINICIAR</span>
                                </button>
                            </div>
                        </div>

                        <div className="room-rush-arcade-summary-bar">
                            <div className="room-rush-arcade-summary-brand">
                                <span>RANKING GLOBAL</span>
                                <strong>ROOM RUSH</strong>
                            </div>

                            <div className="room-rush-arcade-summary-stats">
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
                                className="room-rush-records-button"
                                onClick={ openRecords }>
                                <span
                                    className="room-rush-records-star"
                                    aria-hidden="true">
                                    ★
                                </span>
                                <span>RÉCORDS</span>
                            </button>
                        </div>

                        <div
                            className="room-rush-strikes"
                            aria-label={ `${ strikes } fallos de ${ MAX_STRIKES }` }>
                            <b>FALLOS</b>
                            { Array.from(
                                { length: MAX_STRIKES },
                                (_, index) =>
                                    <span
                                        key={ index }
                                        className={
                                            index < strikes
                                                ? 'is-lost'
                                                : ''
                                        }>
                                        ◆
                                    </span>
                            ) }
                        </div>
                    </div>
                </NitroCardContentView>
            </NitroCardView>

            <ArcadeLeaderboardView
                visible={ recordsOpen }
                gameName="Room Rush"
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
