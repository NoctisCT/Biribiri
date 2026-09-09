import {
    ArcadeCloseEvent,
    ArcadeGameStartComposer,
    ArcadeGameStartedEvent,
    ArcadeLeaderboardEvent,
    ArcadeScoreSubmitComposer,
    PinballOpenEvent
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
import './PinballView.scss';

type Phase = 'ready' | 'playing' | 'paused' | 'gameover';
type ResultState = 'idle' | 'accepted' | 'rejected';

interface LeaderboardEntry
{
    rank: number;
    username: string;
    score: number;
    level: number;
}

interface Ball
{
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
}

interface Bumper
{
    x: number;
    y: number;
    r: number;
    value: number;
    label: string;
}

interface Segment
{
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface Target
{
    x: number;
    y: number;
    w: number;
    h: number;
}

interface Sensor
{
    x: number;
    y: number;
    w: number;
    h: number;
    value: number;
    label: string;
}

interface GameModel
{
    phase: Phase;
    score: number;
    level: number;
    balls: number;
    multiplier: number;
    ball: Ball;
    launched: boolean;
    serveDelay: number;
    plunger: number;
    leftFlipper: boolean;
    rightFlipper: boolean;
    leftFlipperAngle: number;
    rightFlipperAngle: number;
    bumperCooldown: number[];
    slingCooldown: number[];
    targetCooldown: number[];
    targets: boolean[];
    targetResetTimer: number;
    rolloverCooldown: number[];
    rollovers: boolean[];
    rolloverResetTimer: number;
    skillCooldown: number[];
    feedback: string;
    feedbackTime: number;
    flash: number;
}

const WIDTH = 640;
const HEIGHT = 460;
const RENDER_SCALE = 2;
const GAME_KEY = 'pinball';
const UI_MARKER = 'BIRIBIRI_PINBALL_V4_3_3_RAMP_ARROW_REMOVED';
const BALL_RADIUS = 7;

const LEFT_PIVOT = { x: 230, y: 395 };
const RIGHT_PIVOT = { x: 410, y: 395 };
const FLIPPER_LENGTH = 80;
const FLIPPER_THICKNESS = 9;
const LEFT_REST_ANGLE = .22;
const LEFT_UP_ANGLE = -.62;
const RIGHT_REST_ANGLE = Math.PI - .22;
const RIGHT_UP_ANGLE = Math.PI + .62;
const FLIPPER_SPEED = 8.6;

const BUMPERS: Bumper[] = [
    { x: 265, y: 155, r: 22, value: 50, label: 'BUMPER' },
    { x: 375, y: 155, r: 22, value: 50, label: 'BUMPER' },
    { x: 320, y: 218, r: 24, value: 100, label: 'SUPER BUMPER' }
];

const TARGETS: Target[] = [
    { x: 118, y: 135, w: 13, h: 34 },
    { x: 118, y: 190, w: 13, h: 34 },
    { x: 118, y: 245, w: 13, h: 34 }
];

const ROLLOVERS: Sensor[] = [
    { x: 215, y: 83, w: 34, h: 12, value: 150, label: 'LANE 1' },
    { x: 303, y: 74, w: 34, h: 12, value: 150, label: 'LANE 2' },
    { x: 391, y: 83, w: 34, h: 12, value: 150, label: 'LANE 3' }
];

const SKILL_SENSORS: Sensor[] = [
    { x: 86, y: 92, w: 27, h: 78, value: 200, label: 'ÓRBITA IZQ.' },
    { x: 500, y: 92, w: 30, h: 78, value: 200, label: 'ÓRBITA DER.' },
    { x: 452, y: 246, w: 50, h: 58, value: 250, label: 'RAMPA' }
];

const WALLS: Segment[] = [
    { x1: 82, y1: 88, x2: 82, y2: 306 },
    { x1: 82, y1: 88, x2: 98, y2: 68 },
    { x1: 98, y1: 68, x2: 132, y2: 54 },
    { x1: 132, y1: 54, x2: 510, y2: 54 },
    { x1: 510, y1: 54, x2: 536, y2: 72 },
    { x1: 536, y1: 72, x2: 536, y2: 312 },

    { x1: 82, y1: 306, x2: 128, y2: 354 },
    { x1: 128, y1: 354, x2: 162, y2: 418 },
    { x1: 536, y1: 312, x2: 512, y2: 354 },
    { x1: 512, y1: 354, x2: 478, y2: 418 },

    { x1: 540, y1: 132, x2: 540, y2: 442 },
    { x1: 578, y1: 88, x2: 578, y2: 442 },

    { x1: 145, y1: 322, x2: 183, y2: 368 },
    { x1: 183, y1: 368, x2: 198, y2: 394 },
    { x1: 495, y1: 322, x2: 457, y2: 368 },
    { x1: 457, y1: 368, x2: 442, y2: 394 },

    { x1: 430, y1: 286, x2: 478, y2: 248 },
    { x1: 448, y1: 306, x2: 505, y2: 264 }
];

const SLINGS: Segment[] = [
    { x1: 166, y1: 305, x2: 224, y2: 342 },
    { x1: 474, y1: 305, x2: 416, y2: 342 }
];

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

const approach = (
    value: number,
    target: number,
    amount: number) =>
{
    if(value < target) return Math.min(target, value + amount);
    if(value > target) return Math.max(target, value - amount);
    return target;
};

const pointOnFlipper = (
    pivotX: number,
    pivotY: number,
    angle: number,
    length: number) => ({
    x: pivotX + Math.cos(angle) * length,
    y: pivotY + Math.sin(angle) * length
});

const makeBall = (): Ball => ({
    x: 559,
    y: 414,
    vx: 0,
    vy: 0,
    r: BALL_RADIUS
});

const makeGame = (phase: Phase = 'ready'): GameModel => ({
    phase,
    score: 0,
    level: 1,
    balls: 3,
    multiplier: 1,
    ball: makeBall(),
    launched: false,
    serveDelay: 0,
    plunger: 0,
    leftFlipper: false,
    rightFlipper: false,
    leftFlipperAngle: LEFT_REST_ANGLE,
    rightFlipperAngle: RIGHT_REST_ANGLE,
    bumperCooldown: BUMPERS.map(() => 0),
    slingCooldown: SLINGS.map(() => 0),
    targetCooldown: TARGETS.map(() => 0),
    targets: TARGETS.map(() => false),
    targetResetTimer: 0,
    rolloverCooldown: ROLLOVERS.map(() => 0),
    rollovers: ROLLOVERS.map(() => false),
    rolloverResetTimer: 0,
    skillCooldown: SKILL_SENSORS.map(() => 0),
    feedback: '',
    feedbackTime: 0,
    flash: 0
});

export const PinballView: FC<{}> = () =>
{
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const visibleRef = useRef(false);
    const itemIdRef = useRef(0);
    const runTokenRef = useRef('');
    const submittedRef = useRef(false);
    const startPendingRef = useRef(false);
    const lastFrameRef = useRef(0);
    const gameRef = useRef<GameModel>(makeGame());
    const soundEnabledRef = useRef(true);
    const audioRef = useRef<AudioContext | null>(null);
    const heldLeftRef = useRef(false);
    const heldRightRef = useRef(false);
    const heldLaunchRef = useRef(false);

    const [ isVisible, setIsVisible ] = useState(false);
    const [ score, setScore ] = useState(0);
    const [ level, setLevel ] = useState(1);
    const [ balls, setBalls ] = useState(3);
    const [ multiplier, setMultiplier ] = useState(1);
    const [ phase, setPhase ] = useState<Phase>('ready');
    const [ soundEnabled, setSoundEnabled ] = useState(true);
    const [ startPending, setStartPending ] = useState(false);
    const [ leaderboard, setLeaderboard ] = useState<LeaderboardEntry[]>([]);
    const [ serverBest, setServerBest ] = useState(0);
    const [ personalRank, setPersonalRank ] = useState(0);
    const [ totalPlayers, setTotalPlayers ] = useState(0);
    const [ recordsOpen, setRecordsOpen ] = useState(false);
    const [ resultState, setResultState ] = useState<ResultState>('idle');
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
                    window.AudioContext ||
                    (window as any).webkitAudioContext;

                if(!AudioContextClass) return null;

                audioRef.current = new AudioContextClass();
            }

            if(audioRef.current.state === 'suspended')
            {
                void audioRef.current.resume();
            }

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
        volume = .035,
        delay = 0,
        endFrequency?: number) =>
    {
        const context = ensureAudio();
        if(!context) return;

        const start = context.currentTime + delay;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(frequency, start);

        if(endFrequency !== undefined)
        {
            oscillator.frequency.exponentialRampToValueAtTime(
                Math.max(1, endFrequency),
                start + duration
            );
        }

        gain.gain.setValueAtTime(.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume, start + .006);
        gain.gain.exponentialRampToValueAtTime(.0001, start + duration);

        oscillator.connect(gain);
        gain.connect(context.destination);
        oscillator.start(start);
        oscillator.stop(start + duration + .02);
    };

    const playBumper = () =>
    {
        tone(420, .045, 'square', .032, 0, 720);
        tone(780, .055, 'triangle', .026, .035, 980);
    };

    const playTarget = () =>
    {
        tone(630, .055, 'square', .03);
        tone(940, .065, 'square', .025, .045);
    };

    const playFlipper = () =>
    {
        tone(105, .035, 'square', .025, 0, 82);
    };

    const playLaunch = () =>
    {
        tone(95, .08, 'sawtooth', .035, 0, 210);
        tone(330, .07, 'square', .025, .07, 540);
    };

    const playDrain = () =>
    {
        tone(240, .10, 'square', .032, 0, 150);
        tone(150, .16, 'triangle', .03, .09, 72);
    };

    const playBonus = () =>
    {
        tone(520, .07, 'square', .03, 0);
        tone(660, .07, 'square', .032, .07);
        tone(820, .10, 'square', .035, .14);
        tone(1040, .13, 'square', .035, .24);
    };

    const playGameOver = () =>
    {
        tone(330, .11, 'square', .035, 0);
        tone(220, .14, 'square', .035, .11);
        tone(120, .22, 'sawtooth', .04, .24, 60);
    };

    const syncHud = () =>
    {
        const game = gameRef.current;
        setScore(game.score);
        setLevel(game.level);
        setBalls(game.balls);
        setMultiplier(game.multiplier);
        setPhase(game.phase);
    };

    const resetReady = () =>
    {
        gameRef.current = makeGame('ready');
        lastFrameRef.current = 0;
        runTokenRef.current = '';
        submittedRef.current = false;
        startPendingRef.current = false;
        heldLeftRef.current = false;
        heldRightRef.current = false;
        heldLaunchRef.current = false;

        setStartPending(false);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);
        syncHud();
    };

    const beginRun = (token: string) =>
    {
        const game = makeGame('playing');
        game.feedback = 'BOLA 1';
        game.feedbackTime = 1.0;

        gameRef.current = game;
        runTokenRef.current = token;
        submittedRef.current = false;
        startPendingRef.current = false;
        lastFrameRef.current = performance.now();

        setStartPending(false);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);
        syncHud();
        playBonus();

        window.setTimeout(
            () => canvasRef.current?.focus(),
            0
        );
    };

    const requestStart = () =>
    {
        if(
            !visibleRef.current ||
            itemIdRef.current <= 0 ||
            startPendingRef.current
        )
        {
            return;
        }

        ensureAudio();
        startPendingRef.current = true;
        setStartPending(true);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);

        SendMessageComposer(
            new ArcadeGameStartComposer(
                itemIdRef.current,
                GAME_KEY
            )
        );
    };

    const submitRun = (finalScore: number, finalLevel: number) =>
    {
        if(
            submittedRef.current ||
            !runTokenRef.current ||
            itemIdRef.current <= 0
        )
        {
            return;
        }

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
        heldLeftRef.current = false;
        heldRightRef.current = false;
        heldLaunchRef.current = false;

        setStartPending(false);
        setRecordsOpen(false);
        setIsVisible(false);
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
        else
        {
            return;
        }

        syncHud();
    };

    const toggleSound = () =>
    {
        const next = !soundEnabledRef.current;
        soundEnabledRef.current = next;
        setSoundEnabled(next);

        if(next)
        {
            ensureAudio();
            tone(520, .06, 'square', .026);
        }
    };

    const openRecords = () =>
    {
        if(gameRef.current.phase === 'playing')
        {
            gameRef.current.phase = 'paused';
            syncHud();
        }

        setRecordsOpen(true);
    };

    const closeRecords = () =>
    {
        setRecordsOpen(false);
        window.setTimeout(
            () => canvasRef.current?.focus(),
            0
        );
    };

    const addScore = (base: number, label: string) =>
    {
        const game = gameRef.current;
        const value = base * game.multiplier;

        game.score += value;
        game.level = clamp(
            1 + Math.floor(game.score / 5000),
            1,
            50
        );
        game.feedback = `${ label } +${ value }`;
        game.feedbackTime = .62;
        game.flash = .07;
        syncHud();
    };

    const launchBall = () =>
    {
        const game = gameRef.current;

        if(
            game.phase !== 'playing' ||
            game.launched ||
            game.serveDelay > 0
        )
        {
            return;
        }

        const power = .82 + game.plunger * .18;
        game.ball.x = 559;
        game.ball.y = 414;
        game.ball.vx = 0;
        game.ball.vy = -500 * power;
        game.launched = true;
        game.plunger = 0;
        playLaunch();
    };

    const drainBall = () =>
    {
        const game = gameRef.current;

        if(game.phase !== 'playing') return;

        game.balls -= 1;
        game.multiplier = 1;
        game.targets = TARGETS.map(() => false);
        game.rollovers = ROLLOVERS.map(() => false);
        game.targetResetTimer = 0;
        game.rolloverResetTimer = 0;
        playDrain();

        if(game.balls <= 0)
        {
            game.balls = 0;
            game.phase = 'gameover';
            game.launched = false;
            game.feedback = 'FIN DE PARTIDA';
            game.feedbackTime = 2;
            syncHud();
            playGameOver();
            submitRun(game.score, game.level);
            return;
        }

        game.ball = makeBall();
        game.launched = false;
        game.serveDelay = .72;
        game.plunger = 0;
        game.feedback = `BOLA ${ 4 - game.balls }`;
        game.feedbackTime = .9;
        syncHud();
    };

    const reflect = (
        ball: Ball,
        nx: number,
        ny: number,
        restitution = .88) =>
    {
        const dot = ball.vx * nx + ball.vy * ny;

        if(dot < 0)
        {
            ball.vx -= (1 + restitution) * dot * nx;
            ball.vy -= (1 + restitution) * dot * ny;
        }
    };

    const collideSegment = (
        ball: Ball,
        segment: Segment,
        thickness: number,
        boost = 0) =>
    {
        const dx = segment.x2 - segment.x1;
        const dy = segment.y2 - segment.y1;
        const len2 = dx * dx + dy * dy;

        if(len2 <= .0001) return false;

        const t = clamp(
            ((ball.x - segment.x1) * dx +
                (ball.y - segment.y1) * dy) / len2,
            0,
            1
        );

        const px = segment.x1 + dx * t;
        const py = segment.y1 + dy * t;

        let nx = ball.x - px;
        let ny = ball.y - py;
        let distance = Math.hypot(nx, ny);

        const radius = ball.r + thickness;

        if(distance >= radius) return false;

        if(distance < .0001)
        {
            const length = Math.hypot(dx, dy) || 1;
            nx = -dy / length;
            ny = dx / length;
            distance = 1;
        }
        else
        {
            nx /= distance;
            ny /= distance;
        }

        const penetration = radius - distance;

        ball.x += nx * penetration;
        ball.y += ny * penetration;

        reflect(ball, nx, ny, .88);

        if(boost > 0)
        {
            ball.vx += nx * boost;
            ball.vy += ny * boost;
        }

        return true;
    };

    const collideCircle = (
        ball: Ball,
        cx: number,
        cy: number,
        radius: number,
        boost: number) =>
    {
        let dx = ball.x - cx;
        let dy = ball.y - cy;
        let distance = Math.hypot(dx, dy);

        const limit = ball.r + radius;

        if(distance >= limit) return false;

        if(distance < .0001)
        {
            dx = 0;
            dy = -1;
            distance = 1;
        }

        const nx = dx / distance;
        const ny = dy / distance;
        const penetration = limit - distance;

        ball.x += nx * penetration;
        ball.y += ny * penetration;

        reflect(ball, nx, ny, .90);

        ball.vx += nx * boost;
        ball.vy += ny * boost;

        return true;
    };

    const collideRect = (ball: Ball, rect: Target) =>
    {
        const nearestX = clamp(
            ball.x,
            rect.x,
            rect.x + rect.w
        );

        const nearestY = clamp(
            ball.y,
            rect.y,
            rect.y + rect.h
        );

        let dx = ball.x - nearestX;
        let dy = ball.y - nearestY;
        let distance = Math.hypot(dx, dy);

        if(distance >= ball.r) return false;

        if(distance < .0001)
        {
            const left = Math.abs(ball.x - rect.x);
            const right = Math.abs(
                ball.x - (rect.x + rect.w)
            );
            const top = Math.abs(ball.y - rect.y);
            const bottom = Math.abs(
                ball.y - (rect.y + rect.h)
            );

            const minimum = Math.min(
                left,
                right,
                top,
                bottom
            );

            if(minimum === left)
            {
                dx = -1;
                dy = 0;
            }
            else if(minimum === right)
            {
                dx = 1;
                dy = 0;
            }
            else if(minimum === top)
            {
                dx = 0;
                dy = -1;
            }
            else
            {
                dx = 0;
                dy = 1;
            }

            distance = 1;
        }

        const nx = dx / distance;
        const ny = dy / distance;

        ball.x += nx * (ball.r - distance + .4);
        ball.y += ny * (ball.r - distance + .4);

        reflect(ball, nx, ny, .86);
        return true;
    };

    const isInsideSensor = (
        ball: Ball,
        sensor: Sensor) =>
    {
        return (
            ball.x >= sensor.x - ball.r &&
            ball.x <= sensor.x + sensor.w + ball.r &&
            ball.y >= sensor.y - ball.r &&
            ball.y <= sensor.y + sensor.h + ball.r
        );
    };

    const collideFlipper = (
        ball: Ball,
        pivotX: number,
        pivotY: number,
        angle: number,
        side: 1 | -1,
        swingImpulse: number) =>
    {
        const end = pointOnFlipper(
            pivotX,
            pivotY,
            angle,
            FLIPPER_LENGTH
        );

        const dx = end.x - pivotX;
        const dy = end.y - pivotY;
        const len2 = dx * dx + dy * dy;

        const t = clamp(
            ((ball.x - pivotX) * dx +
                (ball.y - pivotY) * dy) / len2,
            0,
            1
        );

        const px = pivotX + dx * t;
        const py = pivotY + dy * t;

        let nx = ball.x - px;
        let ny = ball.y - py;
        let distance = Math.hypot(nx, ny);

        const thickness =
            FLIPPER_THICKNESS +
            ((1 - t) * 2.0);

        const limit = ball.r + thickness;

        if(distance >= limit) return false;

        if(distance < .0001)
        {
            const length = Math.hypot(dx, dy) || 1;
            nx = -dy / length;
            ny = dx / length;
            distance = 1;
        }
        else
        {
            nx /= distance;
            ny /= distance;
        }

        const penetration = limit - distance;

        ball.x += nx * penetration;
        ball.y += ny * penetration;

        reflect(ball, nx, ny, .80);

        if(swingImpulse > 0)
        {
            const contact = .35 + (t * .65);
            const lift =
                swingImpulse *
                (.70 + (t * .50));

            ball.vy -= lift;
            ball.vx +=
                side *
                swingImpulse *
                (.12 + (t * .34));

            if(ball.vy > -70)
                ball.vy = -70 - (90 * contact);
        }

        return true;
    };

    const updatePhysics = (dt: number) =>
    {
        const game = gameRef.current;

        if(game.phase !== 'playing') return;

        if(game.feedbackTime > 0)
        {
            game.feedbackTime = Math.max(
                0,
                game.feedbackTime - dt
            );
        }

        game.flash = Math.max(0, game.flash - dt);

        if(game.targetResetTimer > 0)
        {
            game.targetResetTimer -= dt;

            if(game.targetResetTimer <= 0)
                game.targets = TARGETS.map(() => false);
        }

        if(game.rolloverResetTimer > 0)
        {
            game.rolloverResetTimer -= dt;

            if(game.rolloverResetTimer <= 0)
                game.rollovers = ROLLOVERS.map(() => false);
        }

        game.bumperCooldown = game.bumperCooldown.map(
            value => Math.max(0, value - dt)
        );

        game.slingCooldown = game.slingCooldown.map(
            value => Math.max(0, value - dt)
        );

        game.targetCooldown = game.targetCooldown.map(
            value => Math.max(0, value - dt)
        );

        game.rolloverCooldown = game.rolloverCooldown.map(
            value => Math.max(0, value - dt)
        );

        game.skillCooldown = game.skillCooldown.map(
            value => Math.max(0, value - dt)
        );

        const previousLeftAngle =
            game.leftFlipperAngle;

        const previousRightAngle =
            game.rightFlipperAngle;

        game.leftFlipper = heldLeftRef.current;
        game.rightFlipper = heldRightRef.current;

        game.leftFlipperAngle = approach(
            game.leftFlipperAngle,
            game.leftFlipper
                ? LEFT_UP_ANGLE
                : LEFT_REST_ANGLE,
            FLIPPER_SPEED * dt
        );

        game.rightFlipperAngle = approach(
            game.rightFlipperAngle,
            game.rightFlipper
                ? RIGHT_UP_ANGLE
                : RIGHT_REST_ANGLE,
            FLIPPER_SPEED * dt
        );

        const leftRising =
            game.leftFlipperAngle <
            previousLeftAngle - .001;

        const rightRising =
            game.rightFlipperAngle >
            previousRightAngle + .001;

        if(game.serveDelay > 0)
        {
            game.serveDelay = Math.max(
                0,
                game.serveDelay - dt
            );
            return;
        }

        if(!game.launched)
        {
            game.ball = makeBall();

            if(heldLaunchRef.current)
            {
                game.plunger = Math.min(
                    1,
                    game.plunger + dt * 1.15
                );

                game.ball.y =
                    414 +
                    (game.plunger * 13);
            }

            return;
        }

        const ball = game.ball;

        const frameTravel =
            Math.hypot(ball.vx, ball.vy) * dt;

        const substeps = clamp(
            Math.ceil(frameTravel / 1.75),
            10,
            24
        );

        const step = dt / substeps;

        let leftImpulseUsed = false;
        let rightImpulseUsed = false;

        for(let s = 0; s < substeps; s++)
        {
            ball.vy += 185 * step;
            ball.x += ball.vx * step;
            ball.y += ball.vy * step;

            if(
                ball.x > 540 &&
                ball.y < 88 &&
                ball.vy < 0
            )
            {
                ball.x = 515;
                ball.y = 82;
                ball.vx = -155;
                ball.vy = 72;
            }

            for(const wall of WALLS)
            {
                collideSegment(
                    ball,
                    wall,
                    4.5,
                    0
                );
            }

            for(let i = 0; i < BUMPERS.length; i++)
            {
                const bumper = BUMPERS[i];

                if(collideCircle(
                    ball,
                    bumper.x,
                    bumper.y,
                    bumper.r,
                    62
                ))
                {
                    if(game.bumperCooldown[i] <= 0)
                    {
                        game.bumperCooldown[i] = .32;
                        addScore(
                            bumper.value,
                            bumper.label
                        );
                        playBumper();
                    }
                }
            }

            for(let i = 0; i < SLINGS.length; i++)
            {
                if(collideSegment(
                    ball,
                    SLINGS[i],
                    8,
                    48
                ))
                {
                    if(game.slingCooldown[i] <= 0)
                    {
                        game.slingCooldown[i] = .32;
                        addScore(50, 'SLINGSHOT');
                        playBumper();
                    }
                }
            }

            for(let i = 0; i < TARGETS.length; i++)
            {
                if(collideRect(
                    ball,
                    TARGETS[i]
                ))
                {
                    if(game.targetCooldown[i] <= 0)
                    {
                        game.targetCooldown[i] = .34;

                        if(!game.targets[i])
                        {
                            game.targets[i] = true;
                            addScore(100, 'DIANA');
                            playTarget();

                            if(game.targets.every(Boolean))
                            {
                                addScore(
                                    750,
                                    'BANCO COMPLETO'
                                );

                                game.targetResetTimer = 1.6;
                                playBonus();
                            }
                        }
                    }
                }
            }

            for(let i = 0; i < ROLLOVERS.length; i++)
            {
                const lane = ROLLOVERS[i];

                if(
                    isInsideSensor(ball, lane) &&
                    game.rolloverCooldown[i] <= 0
                )
                {
                    game.rolloverCooldown[i] = .70;

                    if(!game.rollovers[i])
                    {
                        game.rollovers[i] = true;
                        addScore(
                            lane.value,
                            lane.label
                        );

                        if(game.rollovers.every(Boolean))
                        {
                            addScore(
                                500,
                                'LANES COMPLETOS'
                            );

                            if(game.multiplier < 3)
                            {
                                game.multiplier += 1;
                                game.feedback =
                                    `MULTI x${ game.multiplier }`;
                                game.feedbackTime = .95;
                                syncHud();
                            }

                            game.rolloverResetTimer = 1.2;
                            playBonus();
                        }
                    }
                }
            }

            for(let i = 0; i < SKILL_SENSORS.length; i++)
            {
                const sensor = SKILL_SENSORS[i];

                if(
                    isInsideSensor(ball, sensor) &&
                    game.skillCooldown[i] <= 0
                )
                {
                    const upwardSkill =
                        ball.vy < -25;

                    if(upwardSkill)
                    {
                        game.skillCooldown[i] = 1.0;
                        addScore(
                            sensor.value,
                            sensor.label
                        );
                    }
                }
            }

            const sweepT =
                (s + 1) / substeps;

            const leftAngle =
                previousLeftAngle +
                (
                    game.leftFlipperAngle -
                    previousLeftAngle
                ) *
                sweepT;

            const rightAngle =
                previousRightAngle +
                (
                    game.rightFlipperAngle -
                    previousRightAngle
                ) *
                sweepT;

            const leftHit = collideFlipper(
                ball,
                LEFT_PIVOT.x,
                LEFT_PIVOT.y,
                leftAngle,
                1,
                (
                    leftRising &&
                    !leftImpulseUsed
                )
                    ? 150
                    : 0
            );

            if(
                leftHit &&
                leftRising
            )
            {
                leftImpulseUsed = true;
            }

            const rightHit = collideFlipper(
                ball,
                RIGHT_PIVOT.x,
                RIGHT_PIVOT.y,
                rightAngle,
                -1,
                (
                    rightRising &&
                    !rightImpulseUsed
                )
                    ? 150
                    : 0
            );

            if(
                rightHit &&
                rightRising
            )
            {
                rightImpulseUsed = true;
            }

            const speed =
                Math.hypot(
                    ball.vx,
                    ball.vy
                );

            if(speed > 520)
            {
                const scale = 520 / speed;
                ball.vx *= scale;
                ball.vy *= scale;
            }

            if(ball.y > HEIGHT + 16)
            {
                drainBall();
                break;
            }
        }
    };

const draw = () =>
    {
        const canvas = canvasRef.current;
        if(!canvas) return;

        const ctx = canvas.getContext('2d');
        if(!ctx) return;

        const game = gameRef.current;

        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(
            RENDER_SCALE,
            0,
            0,
            RENDER_SCALE,
            0,
            0
        );

        const bg = ctx.createLinearGradient(
            0,
            0,
            0,
            HEIGHT
        );

        bg.addColorStop(0, '#102b43');
        bg.addColorStop(.52, '#0a1c31');
        bg.addColorStop(1, '#06101c');

        ctx.fillStyle = bg;
        ctx.fillRect(
            0,
            0,
            WIDTH,
            HEIGHT
        );

        const field = ctx.createLinearGradient(
            70,
            55,
            530,
            420
        );

        field.addColorStop(0, '#123c52');
        field.addColorStop(.52, '#112a43');
        field.addColorStop(1, '#241a3e');

        ctx.fillStyle = field;
        ctx.beginPath();
        ctx.moveTo(82, 88);
        ctx.lineTo(98, 68);
        ctx.lineTo(132, 54);
        ctx.lineTo(510, 54);
        ctx.lineTo(536, 72);
        ctx.lineTo(536, 312);
        ctx.lineTo(512, 354);
        ctx.lineTo(478, 418);
        ctx.lineTo(442, 418);
        ctx.lineTo(410, 395);
        ctx.lineTo(230, 395);
        ctx.lineTo(198, 418);
        ctx.lineTo(162, 418);
        ctx.lineTo(128, 354);
        ctx.lineTo(82, 306);
        ctx.closePath();
        ctx.fill();

        ctx.globalAlpha = .14;
        ctx.fillStyle = '#7bd6ff';

        for(let y = 105; y < 315; y += 28)
        {
            ctx.fillRect(
                98,
                y,
                420,
                1
            );
        }

        ctx.globalAlpha = 1;

        const drawRail = (
            segment: Segment,
            outer = '#6d93b1',
            inner = '#152638') =>
        {
            ctx.lineCap = 'round';

            ctx.strokeStyle = outer;
            ctx.lineWidth = 7;
            ctx.beginPath();
            ctx.moveTo(
                segment.x1,
                segment.y1
            );
            ctx.lineTo(
                segment.x2,
                segment.y2
            );
            ctx.stroke();

            ctx.strokeStyle = inner;
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.moveTo(
                segment.x1,
                segment.y1
            );
            ctx.lineTo(
                segment.x2,
                segment.y2
            );
            ctx.stroke();
        };

        for(const wall of WALLS)
            drawRail(wall);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#8fb9d5';
        ctx.font = '900 8px monospace';
        ctx.fillText(
            'BONUS',
            320,
            66
        );

        for(let i = 0; i < ROLLOVERS.length; i++)
        {
            const lane = ROLLOVERS[i];
            const lit = game.rollovers[i];

            ctx.fillStyle =
                lit
                    ? '#ffe46c'
                    : '#27445d';

            ctx.fillRect(
                lane.x,
                lane.y,
                lane.w,
                lane.h
            );

            ctx.strokeStyle =
                lit
                    ? '#fff1a2'
                    : '#7595ad';

            ctx.lineWidth = 2;
            ctx.strokeRect(
                lane.x,
                lane.y,
                lane.w,
                lane.h
            );

            ctx.fillStyle =
                lit
                    ? '#473300'
                    : '#9bb6c7';

            ctx.font = '900 8px monospace';
            ctx.fillText(
                `${ i + 1 }`,
                lane.x + lane.w / 2,
                lane.y + 9
            );
        }

        ctx.save();
        ctx.translate(101, 205);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = '#8fb9d5';
        ctx.font = '900 8px monospace';
        ctx.fillText(
            'DIANAS',
            0,
            0
        );
        ctx.restore();

        for(let i = 0; i < TARGETS.length; i++)
        {
            const target = TARGETS[i];
            const lit = game.targets[i];

            ctx.fillStyle =
                lit
                    ? '#ffe26a'
                    : '#566f85';

            ctx.fillRect(
                target.x,
                target.y,
                target.w,
                target.h
            );

            ctx.fillStyle =
                lit
                    ? '#fff4ad'
                    : '#91a5b5';

            ctx.fillRect(
                target.x + 2,
                target.y + 3,
                2,
                target.h - 6
            );

            ctx.strokeStyle = '#142434';
            ctx.lineWidth = 2;
            ctx.strokeRect(
                target.x,
                target.y,
                target.w,
                target.h
            );
        }

        for(let i = 0; i < BUMPERS.length; i++)
        {
            const bumper = BUMPERS[i];
            const active =
                game.bumperCooldown[i] > 0;

            const glow = ctx.createRadialGradient(
                bumper.x - 5,
                bumper.y - 6,
                3,
                bumper.x,
                bumper.y,
                bumper.r + 8
            );

            glow.addColorStop(
                0,
                active
                    ? '#fff6b0'
                    : '#d5f3ff'
            );

            glow.addColorStop(
                .38,
                active
                    ? '#ffbf54'
                    : '#54bce4'
            );

            glow.addColorStop(
                .78,
                i === 2
                    ? '#d05bd6'
                    : '#277aa6'
            );

            glow.addColorStop(
                1,
                '#102037'
            );

            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(
                bumper.x,
                bumper.y,
                bumper.r + 6,
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.strokeStyle = '#f2d967';
            ctx.lineWidth = 2.5;
            ctx.beginPath();
            ctx.arc(
                bumper.x,
                bumper.y,
                bumper.r - 2,
                0,
                Math.PI * 2
            );
            ctx.stroke();

            ctx.fillStyle = '#07111f';
            ctx.font = '900 9px monospace';
            ctx.fillText(
                bumper.value.toString(),
                bumper.x,
                bumper.y + 3
            );
        }

        ctx.strokeStyle = '#70c8e8';
        ctx.lineWidth = 2;
        ctx.globalAlpha = .65;

        ctx.beginPath();
        ctx.moveTo(96, 112);
        ctx.lineTo(96, 178);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(518, 112);
        ctx.lineTo(518, 178);
        ctx.stroke();

        ctx.globalAlpha = 1;

        ctx.fillStyle = '#7fbad4';
        ctx.font = '900 7px monospace';

        ctx.save();
        ctx.translate(92, 132);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(
            '+200',
            0,
            0
        );
        ctx.restore();

        ctx.save();
        ctx.translate(522, 132);
        ctx.rotate(Math.PI / 2);
        ctx.fillText(
            '+200',
            0,
            0
        );
        ctx.restore();

        ctx.fillStyle = 'rgba(54, 171, 203, .10)';
        ctx.beginPath();
        ctx.moveTo(430, 286);
        ctx.lineTo(478, 248);
        ctx.lineTo(505, 264);
        ctx.lineTo(448, 306);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = '#8fd8e9';
        ctx.font = '900 8px monospace';




        const drawSling = (
            segment: Segment,
            left: boolean,
            active: boolean) =>
        {
            const baseX =
                left
                    ? 194
                    : 446;

            const baseY = 365;

            ctx.fillStyle =
                active
                    ? '#8d4635'
                    : '#572b33';

            ctx.beginPath();
            ctx.moveTo(
                segment.x1,
                segment.y1
            );
            ctx.lineTo(
                segment.x2,
                segment.y2
            );
            ctx.lineTo(
                baseX,
                baseY
            );
            ctx.closePath();
            ctx.fill();

            ctx.strokeStyle =
                active
                    ? '#ffb06f'
                    : '#ef865f';

            ctx.lineWidth = 8;
            ctx.lineCap = 'round';
            ctx.beginPath();
            ctx.moveTo(
                segment.x1,
                segment.y1
            );
            ctx.lineTo(
                segment.x2,
                segment.y2
            );
            ctx.stroke();

            ctx.strokeStyle = '#6e2e35';
            ctx.lineWidth = 3;
            ctx.stroke();
        };

        drawSling(
            SLINGS[0],
            true,
            game.slingCooldown[0] > 0
        );

        drawSling(
            SLINGS[1],
            false,
            game.slingCooldown[1] > 0
        );

        const drawFlipper = (
            pivotX: number,
            pivotY: number,
            angle: number,
            active: boolean) =>
        {
            const end = pointOnFlipper(
                pivotX,
                pivotY,
                angle,
                FLIPPER_LENGTH
            );

            const dx = end.x - pivotX;
            const dy = end.y - pivotY;
            const length =
                Math.hypot(dx, dy) || 1;

            const nx = -dy / length;
            const ny = dx / length;

            const rootHalf = 10;
            const tipHalf = 5.5;

            const gradient =
                ctx.createLinearGradient(
                    pivotX,
                    pivotY,
                    end.x,
                    end.y
                );

            gradient.addColorStop(
                0,
                active
                    ? '#ffcf4e'
                    : '#efb93e'
            );

            gradient.addColorStop(
                1,
                active
                    ? '#fff08b'
                    : '#ffd66b'
            );

            ctx.fillStyle = '#4c211d';
            ctx.beginPath();
            ctx.moveTo(
                pivotX + nx * (rootHalf + 3),
                pivotY + ny * (rootHalf + 3)
            );
            ctx.lineTo(
                end.x + nx * (tipHalf + 3),
                end.y + ny * (tipHalf + 3)
            );
            ctx.lineTo(
                end.x - nx * (tipHalf + 3),
                end.y - ny * (tipHalf + 3)
            );
            ctx.lineTo(
                pivotX - nx * (rootHalf + 3),
                pivotY - ny * (rootHalf + 3)
            );
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.moveTo(
                pivotX + nx * rootHalf,
                pivotY + ny * rootHalf
            );
            ctx.lineTo(
                end.x + nx * tipHalf,
                end.y + ny * tipHalf
            );
            ctx.lineTo(
                end.x - nx * tipHalf,
                end.y - ny * tipHalf
            );
            ctx.lineTo(
                pivotX - nx * rootHalf,
                pivotY - ny * rootHalf
            );
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = '#9a4a2d';
            ctx.beginPath();
            ctx.arc(
                pivotX,
                pivotY,
                9,
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.fillStyle = '#e0a43e';
            ctx.beginPath();
            ctx.arc(
                pivotX,
                pivotY,
                4,
                0,
                Math.PI * 2
            );
            ctx.fill();
        };

        drawFlipper(
            LEFT_PIVOT.x,
            LEFT_PIVOT.y,
            game.leftFlipperAngle,
            game.leftFlipper
        );

        drawFlipper(
            RIGHT_PIVOT.x,
            RIGHT_PIVOT.y,
            game.rightFlipperAngle,
            game.rightFlipper
        );

        ctx.fillStyle = '#050b12';
        ctx.beginPath();
        ctx.moveTo(300, 424);
        ctx.lineTo(340, 424);
        ctx.lineTo(352, 460);
        ctx.lineTo(288, 460);
        ctx.closePath();
        ctx.fill();

        ctx.strokeStyle = '#24384a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(302, 426);
        ctx.lineTo(338, 426);
        ctx.stroke();

        ctx.fillStyle = '#0b1a29';
        ctx.fillRect(
            540,
            132,
            38,
            310
        );

        ctx.fillStyle = '#2c4b63';
        ctx.fillRect(
            543,
            135,
            3,
            304
        );

        ctx.fillRect(
            572,
            92,
            3,
            347
        );

        ctx.fillStyle = '#879baa';

        const springY =
            430 +
            (game.plunger * 12);

        for(
            let y = springY;
            y < 452;
            y += 7
        )
        {
            ctx.fillRect(
                551,
                y,
                16,
                2
            );
        }

        if(
            game.serveDelay <= 0 ||
            game.launched
        )
        {
            const ball = game.ball;

            const ballGradient =
                ctx.createRadialGradient(
                    ball.x - 3,
                    ball.y - 4,
                    1,
                    ball.x,
                    ball.y,
                    ball.r + 2
                );

            ballGradient.addColorStop(
                0,
                '#ffffff'
            );

            ballGradient.addColorStop(
                .32,
                '#dce7ef'
            );

            ballGradient.addColorStop(
                .68,
                '#8398a7'
            );

            ballGradient.addColorStop(
                1,
                '#263844'
            );

            ctx.fillStyle = ballGradient;
            ctx.beginPath();
            ctx.arc(
                ball.x,
                ball.y,
                ball.r,
                0,
                Math.PI * 2
            );
            ctx.fill();

            ctx.strokeStyle = '#14222d';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        ctx.fillStyle = '#08131f';
        ctx.fillRect(
            208,
            435,
            224,
            20
        );

        ctx.fillStyle = '#31495e';
        ctx.fillRect(
            212,
            439,
            216,
            2
        );

        ctx.fillStyle = '#8297a8';
        ctx.font = '900 7px monospace';

        ctx.fillText(
            game.launched
                ? `MULTI x${ game.multiplier } · NIVEL ${ game.level }`
                : 'MANTÉN ESPACIO Y SUELTA PARA LANZAR',
            320,
            449
        );

        if(
            game.feedbackTime > 0 &&
            game.feedback
        )
        {
            ctx.save();

            ctx.globalAlpha = clamp(
                game.feedbackTime * 1.5,
                0,
                1
            );

            ctx.fillStyle = '#fff0a2';
            ctx.font = '900 13px monospace';
            ctx.shadowColor = '#000';
            ctx.shadowBlur = 4;

            ctx.fillText(
                game.feedback,
                320,
                287
            );

            ctx.restore();
        }

        if(game.flash > 0)
        {
            ctx.save();

            ctx.globalAlpha =
                game.flash * 1.1;

            ctx.fillStyle = '#fff3b0';
            ctx.fillRect(
                0,
                0,
                WIDTH,
                HEIGHT
            );

            ctx.restore();
        }
    };

useMessageEvent(
        PinballOpenEvent,
        (event: PinballOpenEvent) =>
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

            window.setTimeout(
                () => canvasRef.current?.focus(),
                0
            );
        }
    );

    useMessageEvent(
        ArcadeGameStartedEvent,
        (event: ArcadeGameStartedEvent) =>
        {
            const parser = event.getParser();

            if(
                !visibleRef.current ||
                parser.gameKey !== GAME_KEY ||
                parser.itemId !== itemIdRef.current
            )
            {
                return;
            }

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
        }
    );

    useMessageEvent(
        ArcadeLeaderboardEvent,
        (event: ArcadeLeaderboardEvent) =>
        {
            const parser = event.getParser();

            if(parser.gameKey !== GAME_KEY)
                return;

            setLeaderboard(
                parser.entries.map(
                    entry => ({
                        rank: entry.rank,
                        username: entry.username,
                        score: entry.score,
                        level: entry.level
                    })
                )
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
                setNewServerRecord(parser.newRecord);
            }
            else if(parser.context === 2)
            {
                setResultState('rejected');
                setResultMessage(
                    parser.message ||
                    'La puntuación no pudo validarse.'
                );
                setNewServerRecord(false);
            }
        }
    );

    useMessageEvent(
        ArcadeCloseEvent,
        (event: ArcadeCloseEvent) =>
        {
            const parser = event.getParser();

            if(
                parser.gameKey !== GAME_KEY ||
                parser.itemId !== itemIdRef.current
            )
            {
                return;
            }

            close();
        }
    );

    useEffect(
        () =>
        {
            const keyDown = (event: KeyboardEvent) =>
            {
                if(!visibleRef.current) return;

                const handled = [
                    'ArrowLeft',
                    'ArrowRight',
                    'KeyA',
                    'KeyD',
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
                    )
                    {
                        requestStart();
                    }
                    return;
                }

                if(event.code === 'KeyP' || event.code === 'Escape')
                {
                    if(!event.repeat) togglePause();
                    return;
                }

                if(event.code === 'ArrowLeft' || event.code === 'KeyA')
                {
                    if(!heldLeftRef.current && gameRef.current.phase === 'playing')
                        playFlipper();
                    heldLeftRef.current = true;
                    return;
                }

                if(event.code === 'ArrowRight' || event.code === 'KeyD')
                {
                    if(!heldRightRef.current && gameRef.current.phase === 'playing')
                        playFlipper();
                    heldRightRef.current = true;
                    return;
                }

                if(event.code === 'Space' && gameRef.current.phase === 'playing')
                {
                    heldLaunchRef.current = true;
                }
            };

            const keyUp = (event: KeyboardEvent) =>
            {
                if(event.code === 'ArrowLeft' || event.code === 'KeyA')
                    heldLeftRef.current = false;

                if(event.code === 'ArrowRight' || event.code === 'KeyD')
                    heldRightRef.current = false;

                if(event.code === 'Space')
                {
                    const wasHeld = heldLaunchRef.current;
                    heldLaunchRef.current = false;

                    if(wasHeld)
                        launchBall();
                }
            };

            window.addEventListener('keydown', keyDown);
            window.addEventListener('keyup', keyUp);

            return () =>
            {
                window.removeEventListener('keydown', keyDown);
                window.removeEventListener('keyup', keyUp);
            };
        },
        []
    );

    useEffect(
        () =>
        {
            let frameId = 0;

            const frame = (now: number) =>
            {
                if(visibleRef.current)
                {
                    if(lastFrameRef.current <= 0)
                        lastFrameRef.current = now;

                    const dt = clamp(
                        (now - lastFrameRef.current) / 1000,
                        0,
                        .033
                    );

                    lastFrameRef.current = now;

                    if(gameRef.current.phase === 'playing')
                        updatePhysics(dt);

                    draw();
                }
                else
                {
                    lastFrameRef.current = now;
                }

                frameId = requestAnimationFrame(frame);
            };

            frameId = requestAnimationFrame(frame);

            return () => cancelAnimationFrame(frameId);
        },
        []
    );

    if(!isVisible) return null;

    const statusText =
        phase === 'playing'
            ? 'EN JUEGO'
            : phase === 'paused'
                ? 'PAUSA'
                : phase === 'gameover'
                    ? 'FIN'
                    : 'PREPARADO';

    const formattedScore = score.toString().padStart(6, '0');
    const formattedBest = serverBest.toString().padStart(6, '0');

    return (
        <>
            <NitroCardView
                uniqueKey="pinball"
                className="nitro-pinball"
                theme="primary-slim"
                style={ { width: '760px' } }>
                <NitroCardHeaderView
                    headerText="Pinball"
                    onCloseClick={ close } />

                <NitroCardContentView
                    gap={ 0 }
                    className="pinball-content">
                    <div
                        className="pinball-shell"
                        data-pinball-ui={ UI_MARKER }>
                        <span className="pinball-cabinet-screw is-top-left" />
                        <span className="pinball-cabinet-screw is-top-right" />
                        <span className="pinball-cabinet-screw is-bottom-left" />
                        <span className="pinball-cabinet-screw is-bottom-right" />

                        <div className="pinball-hud">
                            <div className="pinball-hud-cell">
                                <span className="pinball-hud-label">PUNTOS</span>
                                <strong className="pinball-score-value">
                                    { formattedScore }
                                </strong>
                            </div>

                            <div className="pinball-hud-cell">
                                <span className="pinball-hud-label">NIVEL</span>
                                <strong className="pinball-level-value">
                                    { level }
                                </strong>
                            </div>

                            <div className="pinball-hud-cell">
                                <span className="pinball-hud-label">MULTI</span>
                                <strong className="pinball-multi-value">
                                    x{ multiplier }
                                </strong>
                            </div>

                            <div className="pinball-hud-cell">
                                <span className="pinball-hud-label">BOLAS</span>
                                <div className="pinball-ball-row">
                                    { [ 0, 1, 2 ].map(index =>
                                        <span
                                            key={ index }
                                            className={
                                                `pinball-life-ball${
                                                    index < balls
                                                        ? ' is-active'
                                                        : ''
                                                }`
                                            } />) }
                                </div>
                            </div>

                            <div
                                className={
                                    `pinball-hud-cell is-status is-${ phase }`
                                }>
                                <span className="pinball-status-ball" />
                                <strong>{ statusText }</strong>
                            </div>
                        </div>

                        <div className="pinball-stage">
                            <canvas
                                ref={ canvasRef }
                                className="pinball-canvas"
                                width={ WIDTH * RENDER_SCALE }
                                height={ HEIGHT * RENDER_SCALE }
                                tabIndex={ 0 } />

                            { phase === 'ready' &&
                                <div className="pinball-game-overlay">
                                    <div className="pinball-overlay-panel">
                                        <span className="pinball-overlay-kicker">
                                            MESA CLÁSICA
                                        </span>
                                        <strong className="pinball-overlay-title">
                                            PINBALL
                                        </strong>
                                        <span className="pinball-overlay-copy">
                                            Apunta a órbitas, dianas y skill lanes.
                                            El momento del golpe cambia cada tiro.
                                        </span>
                                        <button
                                            className="pinball-primary-button"
                                            type="button"
                                            disabled={ startPending }
                                            onClick={ requestStart }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'JUGAR' }
                                        </button>
                                        <span className="pinball-overlay-hint">
                                            ENTER también inicia la partida
                                        </span>
                                    </div>
                                </div> }

                            { phase === 'paused' &&
                                <div className="pinball-game-overlay is-pause">
                                    <div className="pinball-overlay-panel is-compact">
                                        <span className="pinball-overlay-kicker">
                                            PARTIDA DETENIDA
                                        </span>
                                        <strong className="pinball-overlay-title">
                                            PAUSA
                                        </strong>
                                        <button
                                            className="pinball-primary-button"
                                            type="button"
                                            onClick={ togglePause }>
                                            CONTINUAR
                                        </button>
                                    </div>
                                </div> }

                            { phase === 'gameover' &&
                                <div className="pinball-game-overlay is-gameover">
                                    <div className="pinball-overlay-panel">
                                        <span className="pinball-overlay-kicker">
                                            PARTIDA TERMINADA
                                        </span>
                                        <strong className="pinball-overlay-title">
                                            FIN DE PARTIDA
                                        </strong>

                                        <div className="pinball-gameover-results">
                                            <span>
                                                PUNTOS
                                                <b>{ formattedScore }</b>
                                            </span>
                                            <span>
                                                NIVEL
                                                <b>{ level }</b>
                                            </span>
                                            <span>
                                                MULTI MÁX.
                                                <b>x3</b>
                                            </span>
                                        </div>

                                        { newServerRecord &&
                                            <div className="pinball-new-record">
                                                ★ NUEVO RÉCORD PERSONAL
                                            </div> }

                                        { resultState !== 'idle' &&
                                            <div
                                                className={
                                                    `pinball-result-message is-${ resultState }`
                                                }>
                                                { resultMessage }
                                            </div> }

                                        <button
                                            className="pinball-primary-button"
                                            type="button"
                                            disabled={ startPending }
                                            onClick={ requestStart }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'OTRA PARTIDA' }
                                        </button>
                                    </div>
                                </div> }
                        </div>

                        <div className="pinball-console">
                            <div className="pinball-controls-panel">
                                <div className="pinball-control-group">
                                    <span className="pinball-keycap">←</span>
                                    <span className="pinball-keycap">A</span>
                                    <span className="pinball-control-action">
                                        ALETA IZQ.
                                    </span>
                                </div>

                                <span className="pinball-console-divider" />

                                <div className="pinball-control-group">
                                    <span className="pinball-keycap">→</span>
                                    <span className="pinball-keycap">D</span>
                                    <span className="pinball-control-action">
                                        ALETA DER.
                                    </span>
                                </div>

                                <span className="pinball-console-divider" />

                                <div className="pinball-control-group">
                                    <span className="pinball-keycap is-wide">ESPACIO</span>
                                    <span className="pinball-control-action">
                                        LANZAR
                                    </span>
                                </div>

                                <span className="pinball-console-divider" />

                                <div className="pinball-control-group">
                                    <span className="pinball-keycap">P</span>
                                    <span className="pinball-control-action">
                                        PAUSA
                                    </span>
                                </div>
                            </div>

                            <div className="pinball-console-actions">
                                <button
                                    type="button"
                                    className={
                                        `pinball-sound-button${
                                            soundEnabled ? ' is-on' : ''
                                        }`
                                    }
                                    onClick={ toggleSound }>
                                    <span className="pinball-sound-icon">♪</span>
                                    SONIDO
                                    <b>{ soundEnabled ? 'ON' : 'OFF' }</b>
                                </button>

                                <button
                                    type="button"
                                    className="pinball-restart-button"
                                    disabled={ startPending }
                                    onClick={ requestStart }>
                                    <span className="pinball-restart-shine" />
                                    REINICIAR
                                </button>
                            </div>
                        </div>

                        <div className="pinball-summary-bar">
                            <div className="pinball-summary-brand">
                                <strong>PINBALL</strong>
                                <span>MESA CLÁSICA</span>
                            </div>

                            <div className="pinball-summary-stats">
                                <span>
                                    MEJOR
                                    <b>{ formattedBest }</b>
                                </span>
                                <span>
                                    PUESTO
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
                                className="pinball-records-button"
                                onClick={ openRecords }>
                                <span>★</span>
                                RÉCORDS
                            </button>
                        </div>
                    </div>
                </NitroCardContentView>
            </NitroCardView>

            <ArcadeLeaderboardView
                visible={ recordsOpen }
                gameName="Pinball"
                levelLabel="NIVEL"
                leaderboard={ leaderboard }
                personalBest={ serverBest }
                personalRank={ personalRank }
                totalPlayers={ totalPlayers }
                onClose={ closeRecords } />
        </>
    );
};
