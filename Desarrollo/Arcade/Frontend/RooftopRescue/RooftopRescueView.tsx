import {
    ArcadeCloseEvent,
    ArcadeGameStartComposer,
    ArcadeGameStartedEvent,
    ArcadeLeaderboardEvent,
    ArcadeScoreSubmitComposer,
    RooftopRescueOpenEvent
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
import './RooftopRescueView.scss';

type Phase = 'ready' | 'playing' | 'paused' | 'gameover';
type ResultState = 'idle' | 'accepted' | 'rejected';

interface FallingPerson
{
    id: number;
    x: number;
    y: number;
    vx: number;
    vy: number;
    stage: number;
    variant: number;
    saved: boolean;
    savedTime: number;
    flip: boolean;
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
    warm: boolean;
}

interface Model
{
    phase: Phase;
    score: number;
    level: number;
    rescued: number;
    combo: number;
    misses: number;
    netX: number;
    targetX: number;
    people: FallingPerson[];
    popups: Popup[];
    sparks: Spark[];
    spawnTimer: number;
    nextPersonId: number;
    wind: number;
    windTimer: number;
    feedback: string;
    feedbackTime: number;
    netFlash: number;
    dangerFlash: number;
    levelFlash: number;
}

interface LeaderboardEntry
{
    rank: number;
    username: string;
    score: number;
    level: number;
}

const GAME_KEY = 'rooftop_rescue';
const UI_MARKER = 'BIRIBIRI_ROOFTOP_RESCUE_V1';
const PATCH_MARKER = 'BIRIBIRI_ROOFTOP_RESCUE_POLISH_V2';

const W = 640;
const H = 420;
const MAX_MISSES = 3;
const MAX_LEVEL = 50;

const BUILDING_RIGHT = 132;
const ROOF_Y = 91;
const CATCH_Y = 308;
const STREET_Y = 334;
const NET_HALF = 42;
const NET_MIN_X = 184;
const NET_MAX_X = 586;
const CATCH_GRACE = 8;
const PERSON_HALF_WIDTH = 6;
const SAFE_X = 586;

const clamp = (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value));

const rnd = (max: number) =>
    Math.floor(Math.random() * max);

const fmt = (value: number) =>
    value.toString().padStart(6, '0');

const freshGame = (phase: Phase = 'ready'): Model => ({
    phase,
    score: 0,
    level: 1,
    rescued: 0,
    combo: 0,
    misses: 0,
    netX: 300,
    targetX: 300,
    people: [],
    popups: [],
    sparks: [],
    spawnTimer: 0.8,
    nextPersonId: 1,
    wind: 0,
    windTimer: 5,
    feedback: '',
    feedbackTime: 0,
    netFlash: 0,
    dangerFlash: 0,
    levelFlash: 0
});

const RooftopSirenIcon: FC<{}> = () =>
{
    return (
        <span
            className="rooftop-status-icon"
            aria-hidden="true">
            <i className="lamp" />
            <i className="shine" />
            <i className="base" />
            <i className="ray is-left" />
            <i className="ray is-right" />
        </span>
    );
};

export const RooftopRescueView: FC<{}> = () =>
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
    const heldLeftRef = useRef(false);
    const heldRightRef = useRef(false);

    const [ isVisible, setIsVisible ] = useState(false);
    const [ score, setScore ] = useState(0);
    const [ level, setLevel ] = useState(1);
    const [ rescued, setRescued ] = useState(0);
    const [ combo, setCombo ] = useState(0);
    const [ misses, setMisses ] = useState(0);
    const [ phase, setPhase ] = useState<Phase>('ready');
    const [ soundEnabled, setSoundEnabled ] = useState(true);
    const [ startPending, setStartPending ] = useState(false);

    const [ leaderboard, setLeaderboard ] =
        useState<LeaderboardEntry[]>([]);
    const [ serverBest, setServerBest ] = useState(0);
    const [ personalRank, setPersonalRank ] = useState(0);
    const [ totalPlayers, setTotalPlayers ] = useState(0);
    const [ recordsOpen, setRecordsOpen ] = useState(false);
    const [ resultState, setResultState ] =
        useState<ResultState>('idle');
    const [ resultMessage, setResultMessage ] = useState('');
    const [ newServerRecord, setNewServerRecord ] = useState(false);

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
        volume = 0.028,
        delay = 0,
        endFrequency?: number) =>
    {
        const context = ensureAudio();
        if(!context) return;

        const start = context.currentTime + delay;
        const oscillator = context.createOscillator();
        const gain = context.createGain();

        oscillator.type = type;
        oscillator.frequency.setValueAtTime(
            Math.max(1, frequency),
            start
        );

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
        gain.gain.exponentialRampToValueAtTime(
            0.0001,
            start + duration
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start(start);
        oscillator.stop(start + duration + 0.02);
    };

    const playStart = () =>
    {
        tone(330, 0.05);
        tone(494, 0.05, 'square', 0.026, 0.06);
        tone(659, 0.10, 'square', 0.030, 0.12);
    };

    const playMove = () =>
        tone(110, 0.018, 'triangle', 0.008);

    const playBounce = (stage: number) =>
    {
        tone(220 + (stage * 70), 0.05, 'square', 0.026);
        tone(420 + (stage * 85), 0.07, 'triangle', 0.022, 0.04);
    };

    const playRescue = () =>
    {
        tone(523, 0.05, 'square', 0.026);
        tone(784, 0.06, 'square', 0.029, 0.06);
        tone(1046, 0.11, 'square', 0.031, 0.12);
    };

    const playMiss = () =>
    {
        tone(170, 0.12, 'sawtooth', 0.036, 0, 85);
        tone(115, 0.15, 'square', 0.026, 0.09, 62);
    };

    const playLevel = () =>
    {
        tone(392, 0.05, 'square', 0.025);
        tone(587, 0.05, 'square', 0.027, 0.06);
        tone(784, 0.10, 'square', 0.030, 0.12);
    };

    const playGameOver = () =>
    {
        tone(260, 0.12, 'square', 0.030);
        tone(174, 0.18, 'sawtooth', 0.032, 0.11, 75);
    };

    const syncHud = () =>
    {
        const game = gameRef.current;

        setScore(game.score);
        setLevel(game.level);
        setRescued(game.rescued);
        setCombo(game.combo);
        setMisses(game.misses);
        setPhase(game.phase);
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
            ttl: 0.9,
            positive
        });
    };

    const addSparks = (
        x: number,
        y: number,
        count: number,
        warm = true) =>
    {
        const game = gameRef.current;

        for(let i = 0; i < count; i++)
        {
            game.sparks.push({
                x,
                y,
                vx: -55 + (Math.random() * 110),
                vy: -75 + (Math.random() * 50),
                ttl: 0.3 + (Math.random() * 0.45),
                warm
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
        heldLeftRef.current = false;
        heldRightRef.current = false;

        setStartPending(false);
        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);

        syncHud();
    };

    const maxPeopleForLevel = (levelValue: number) =>
        Math.min(
            5,
            1 + Math.floor((levelValue - 1) / 3)
        );

    const spawnIntervalForLevel = (levelValue: number) =>
        Math.max(
            0.78,
            2.75 - (levelValue * 0.095)
        );

    const spawnPerson = (forced = false) =>
    {
        const game = gameRef.current;

        const active = game.people.filter(
            person => !person.saved
        ).length;

        if(
            !forced &&
            active >= maxPeopleForLevel(game.level)
        )
        {
            return;
        }

        const variant = rnd(5);
        const levelSpeed = Math.min(28, game.level * 1.15);

        game.people.push({
            id: game.nextPersonId++,
            x: BUILDING_RIGHT - 13,
            y: ROOF_Y + 4,
            vx: 68 + levelSpeed + (Math.random() * 10),
            vy: -34 - (Math.random() * 12),
            stage: 0,
            variant,
            saved: false,
            savedTime: 0,
            flip: Math.random() > 0.5
        });
    };

    const beginRun = (token: string) =>
    {
        const game = freshGame('playing');

        game.feedback = 'RESCATE EN CURSO';
        game.feedbackTime = 1.0;

        gameRef.current = game;
        runTokenRef.current = token;
        submittedRef.current = false;
        lastFrameRef.current = performance.now();

        spawnPerson(true);

        setResultState('idle');
        setResultMessage('');
        setNewServerRecord(false);

        syncHud();
        playStart();

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

    const submitScore = (
        finalScore: number,
        finalLevel: number) =>
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
            heldLeftRef.current = false;
            heldRightRef.current = false;
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

        setPhase(game.phase);
    };

    const toggleSound = () =>
    {
        const next = !soundRef.current;

        soundRef.current = next;
        setSoundEnabled(next);

        if(next)
        {
            ensureAudio();
            tone(520, 0.05, 'square', 0.025);
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

        window.setTimeout(
            () => canvasRef.current?.focus(),
            0
        );
    };

    const setMovement = (
        direction: -1 | 1,
        active: boolean) =>
    {
        const wasActive =
            direction < 0
                ? heldLeftRef.current
                : heldRightRef.current;

        if(direction < 0)
            heldLeftRef.current = active;
        else
            heldRightRef.current = active;

        if(
            active &&
            !wasActive &&
            gameRef.current.phase === 'playing'
        )
        {
            playMove();
        }
    };

    const maybeLevelUp = () =>
    {
        const game = gameRef.current;

        const nextLevel = Math.min(
            MAX_LEVEL,
            1 + Math.floor(game.rescued / 6)
        );

        if(nextLevel <= game.level)
            return;

        game.level = nextLevel;
        game.levelFlash = 1.0;
        game.feedback = `NIVEL ${ game.level }`;
        game.feedbackTime = 1.1;

        if(game.level >= 6 && game.wind === 0)
            game.wind = Math.random() > 0.5 ? 1 : -1;

        addPopup(
            `NIVEL ${ game.level }`,
            W / 2,
            74,
            true
        );

        playLevel();
    };

    const completeRescue = (person: FallingPerson) =>
    {
        const game = gameRef.current;

        game.rescued += 1;
        game.combo += 1;

        const comboBonus =
            Math.min(10, Math.max(0, game.combo - 1)) * 30;

        const reward =
            180 +
            (game.level * 20) +
            comboBonus;

        game.score += reward;
        game.feedback =
            game.combo >= 5
                ? `RACHA x${ game.combo } · +${ reward }`
                : `RESCATADO +${ reward }`;
        game.feedbackTime = 0.75;
        game.netFlash = 0.4;

        person.saved = true;
        person.savedTime = 0;
        person.vx = 135 + (game.level * 1.5);
        person.vy = -105;

        addPopup(
            `+${ reward }`,
            person.x,
            person.y - 14,
            true
        );

        addSparks(
            person.x,
            person.y,
            12,
            true
        );

        playRescue();
        maybeLevelUp();
        syncHud();
    };

    const registerMiss = (
        person: FallingPerson) =>
    {
        const game = gameRef.current;

        game.misses += 1;
        game.combo = 0;
        game.dangerFlash = 0.65;
        game.feedback = '¡SE ESCAPÓ!';
        game.feedbackTime = 0.8;

        addPopup(
            'FALLO',
            person.x,
            STREET_Y - 12,
            false
        );

        addSparks(
            person.x,
            STREET_Y - 2,
            9,
            false
        );

        playMiss();
        syncHud();
    };

    const bouncePerson = (person: FallingPerson) =>
    {
        const game = gameRef.current;

        person.stage += 1;
        person.y = CATCH_Y - 3;

        if(person.stage >= 3)
        {
            completeRescue(person);
            return;
        }

        const gravityBoost = Math.min(
            60,
            game.level * 3.5
        );

        if(person.stage === 1)
        {
            person.vx =
                86 +
                (game.level * 0.95) +
                (Math.random() * 8);

            person.vy =
                -165 +
                Math.min(18, gravityBoost * 0.14);
        }
        else
        {
            person.vx =
                94 +
                (game.level * 0.8) +
                (Math.random() * 7);

            person.vy =
                -150 +
                Math.min(15, gravityBoost * 0.12);
        }

        game.score += 40 + (person.stage * 20);
        game.netFlash = 0.32;

        addPopup(
            person.stage === 1
                ? '¡BOING!'
                : '¡OTRA!',
            person.x,
            CATCH_Y - 22,
            true
        );

        addSparks(
            person.x,
            CATCH_Y - 2,
            6,
            true
        );

        playBounce(person.stage);
        syncHud();
    };

    useMessageEvent(
        RooftopRescueOpenEvent,
        (event: RooftopRescueOpenEvent) =>
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

            visibleRef.current = false;
            runTokenRef.current = '';
            submittedRef.current = false;
            startPendingRef.current = false;

            setStartPending(false);
            setRecordsOpen(false);
            setIsVisible(false);
        }
    );

    useEffect(
        () =>
        {
            const keyDown = (event: KeyboardEvent) =>
            {
                if(!visibleRef.current)
                    return;

                const handled = [
                    'ArrowLeft',
                    'ArrowRight',
                    'KeyA',
                    'KeyD',
                    'Enter',
                    'KeyP',
                    'Escape'
                ].includes(event.code);

                if(handled)
                    event.preventDefault();

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

                if(
                    event.code === 'KeyP' ||
                    event.code === 'Escape'
                )
                {
                    togglePause();
                    return;
                }

                if(gameRef.current.phase !== 'playing')
                    return;

                if(
                    event.code === 'ArrowLeft' ||
                    event.code === 'KeyA'
                )
                {
                    setMovement(-1, true);
                }
                else if(
                    event.code === 'ArrowRight' ||
                    event.code === 'KeyD'
                )
                {
                    setMovement(1, true);
                }
            };

            const keyUp = (event: KeyboardEvent) =>
            {
                if(!visibleRef.current)
                    return;

                if(
                    event.code === 'ArrowLeft' ||
                    event.code === 'KeyA'
                )
                {
                    setMovement(-1, false);
                }
                else if(
                    event.code === 'ArrowRight' ||
                    event.code === 'KeyD'
                )
                {
                    setMovement(1, false);
                }
            };

            const blur = () =>
            {
                heldLeftRef.current = false;
                heldRightRef.current = false;

                if(
                    visibleRef.current &&
                    gameRef.current.phase === 'playing'
                )
                {
                    gameRef.current.phase = 'paused';
                    setPhase('paused');
                }
            };

            window.addEventListener(
                'keydown',
                keyDown,
                { passive: false }
            );

            window.addEventListener(
                'keyup',
                keyUp
            );

            window.addEventListener(
                'blur',
                blur
            );

            return () =>
            {
                window.removeEventListener(
                    'keydown',
                    keyDown
                );

                window.removeEventListener(
                    'keyup',
                    keyUp
                );

                window.removeEventListener(
                    'blur',
                    blur
                );
            };
        },
        []
    );

    useEffect(
        () =>
        {
            let frameId = 0;

            const finish = () =>
            {
                const game = gameRef.current;

                if(game.phase === 'gameover')
                    return;

                game.phase = 'gameover';
                game.feedback = 'RESCATE FINALIZADO';
                game.feedbackTime = 1.2;

                setPhase('gameover');
                syncHud();
                playGameOver();

                submitScore(
                    game.score,
                    game.level
                );
            };

            const update = (dt: number) =>
            {
                const game = gameRef.current;

                if(game.phase !== 'playing')
                    return;

                game.feedbackTime = Math.max(
                    0,
                    game.feedbackTime - dt
                );

                game.netFlash = Math.max(
                    0,
                    game.netFlash - dt
                );

                game.dangerFlash = Math.max(
                    0,
                    game.dangerFlash - dt
                );

                game.levelFlash = Math.max(
                    0,
                    game.levelFlash - dt
                );

                const movementSpeed =
                    332 +
                    Math.min(118, game.level * 4);

                if(
                    heldLeftRef.current &&
                    !heldRightRef.current
                )
                {
                    game.netX -= movementSpeed * dt;
                }
                else if(
                    heldRightRef.current &&
                    !heldLeftRef.current
                )
                {
                    game.netX += movementSpeed * dt;
                }

                game.netX = clamp(
                    game.netX,
                    NET_MIN_X,
                    NET_MAX_X
                );
                game.targetX = game.netX;

                game.spawnTimer -= dt;

                if(game.spawnTimer <= 0)
                {
                    spawnPerson();

                    game.spawnTimer =
                        spawnIntervalForLevel(game.level);
                }

                if(game.level >= 6)
                {
                    game.windTimer -= dt;

                    if(game.windTimer <= 0)
                    {
                        const roll = rnd(5);

                        game.wind =
                            roll === 0
                                ? 0
                                : roll <= 2
                                    ? -1
                                    : 1;

                        game.windTimer =
                            4.5 +
                            (Math.random() * 3.0);
                    }
                }
                else
                {
                    game.wind = 0;
                }

                const gravity =
                    176 +
                    Math.min(78, game.level * 3.6);

                const nextPeople: FallingPerson[] = [];

                for(const person of game.people)
                {
                    const previousY = person.y;

                    if(person.saved)
                    {
                        person.savedTime += dt;
                        person.vy += gravity * 0.55 * dt;
                        person.x += person.vx * dt;
                        person.y += person.vy * dt;

                        if(
                            person.x < SAFE_X + 28 &&
                            person.savedTime < 1.25
                        )
                        {
                            nextPeople.push(person);
                        }

                        continue;
                    }

                    person.vx += game.wind * 7.5 * dt;
                    person.vy += gravity * dt;
                    person.x += person.vx * dt;
                    person.y += person.vy * dt;

                    if(
                        previousY < CATCH_Y &&
                        person.y >= CATCH_Y &&
                        person.vy > 0
                    )
                    {
                        const catchLeft =
                            game.netX -
                            NET_HALF -
                            CATCH_GRACE;

                        const catchRight =
                            game.netX +
                            NET_HALF +
                            CATCH_GRACE;

                        const overlapsNet =
                            (
                                person.x +
                                PERSON_HALF_WIDTH
                            ) >= catchLeft &&
                            (
                                person.x -
                                PERSON_HALF_WIDTH
                            ) <= catchRight;

                        if(overlapsNet)
                        {
                            bouncePerson(person);
                            nextPeople.push(person);
                            continue;
                        }
                    }

                    if(person.y >= STREET_Y)
                    {
                        registerMiss(person);
                        continue;
                    }

                    if(person.x > W + 20)
                    {
                        registerMiss(person);
                        continue;
                    }

                    nextPeople.push(person);
                }

                game.people = nextPeople;

                for(const popup of game.popups)
                {
                    popup.ttl -= dt;
                    popup.y -= 25 * dt;
                }

                game.popups =
                    game.popups.filter(
                        popup => popup.ttl > 0
                    );

                for(const spark of game.sparks)
                {
                    spark.ttl -= dt;
                    spark.x += spark.vx * dt;
                    spark.y += spark.vy * dt;
                    spark.vy += 115 * dt;
                }

                game.sparks =
                    game.sparks.filter(
                        spark => spark.ttl > 0
                    );

                if(game.misses >= MAX_MISSES)
                    finish();
            };

            const drawPerson = (
                context: CanvasRenderingContext2D,
                person: FallingPerson) =>
            {
                const x = Math.round(person.x);
                const y = Math.round(person.y);
                const flip = person.flip ? -1 : 1;

                const palettes = [
                    [ '#e95c59', '#f2c89d', '#342823' ],
                    [ '#5da9e9', '#dca87c', '#282a35' ],
                    [ '#e8c34f', '#f1bf97', '#56352b' ],
                    [ '#82cf6a', '#c98e6d', '#221e20' ],
                    [ '#c184e8', '#e7b78c', '#382426' ]
                ];

                const palette =
                    palettes[
                        person.variant %
                        palettes.length
                    ];

                context.save();
                context.translate(x, y);
                context.scale(flip, 1);

                context.fillStyle = 'rgba(0,0,0,.18)';
                context.fillRect(-5, 10, 12, 2);

                context.fillStyle = palette[2];
                context.fillRect(-4, -10, 8, 4);

                context.fillStyle = palette[1];
                context.fillRect(-4, -6, 8, 7);

                context.fillStyle = palette[0];
                context.fillRect(-5, 1, 10, 10);

                context.fillStyle = '#efe6d1';
                context.fillRect(-4, 4, 2, 5);

                context.fillStyle = palette[2];
                context.fillRect(-5, 11, 4, 6);
                context.fillRect(2, 11, 4, 6);

                context.fillStyle = '#f0d6a5';
                context.fillRect(5, 3, 5, 3);

                context.restore();
            };

            const drawRescuer = (
                context: CanvasRenderingContext2D,
                x: number,
                y: number,
                flip: boolean) =>
            {
                context.save();
                context.translate(x, y);
                context.scale(flip ? -1 : 1, 1);

                context.fillStyle = '#1e2735';
                context.fillRect(-4, 7, 4, 10);
                context.fillRect(2, 7, 4, 10);

                context.fillStyle = '#d84a42';
                context.fillRect(-7, -8, 14, 16);

                context.fillStyle = '#f1c85f';
                context.fillRect(-7, -3, 14, 3);

                context.fillStyle = '#e5b487';
                context.fillRect(-5, -16, 10, 8);

                context.fillStyle = '#b62f32';
                context.fillRect(-6, -20, 12, 5);

                context.fillStyle = '#f3d05d';
                context.fillRect(-6, -16, 12, 2);

                context.fillStyle = '#e5b487';
                context.fillRect(6, -4, 9, 3);

                context.restore();
            };

            const drawNet = (
                context: CanvasRenderingContext2D,
                game: Model) =>
            {
                const x = Math.round(game.netX);
                const y = 316;
                const flash = game.netFlash > 0;

                drawRescuer(
                    context,
                    x - 50,
                    y + 18,
                    false
                );

                drawRescuer(
                    context,
                    x + 50,
                    y + 18,
                    true
                );

                context.fillStyle =
                    flash
                        ? '#fff09a'
                        : '#f0cf65';

                context.fillRect(
                    x - NET_HALF,
                    y,
                    NET_HALF * 2,
                    5
                );

                context.fillStyle =
                    flash
                        ? '#e4f5ff'
                        : '#d9e7e7';

                for(let stripe = 0; stripe < 7; stripe++)
                {
                    context.fillRect(
                        x - 34 + (stripe * 11),
                        y + 5,
                        6,
                        4
                    );
                }

                context.fillStyle = '#9b7b39';
                context.fillRect(
                    x - NET_HALF,
                    y + 9,
                    NET_HALF * 2,
                    2
                );
            };

            const drawAmbulance = (
                context: CanvasRenderingContext2D,
                time: number) =>
            {
                const flash =
                    Math.floor(time / 160) % 2 === 0;

                const x = 535;
                const y = 284;

                context.fillStyle = '#d9dedb';
                context.fillRect(x, y, 91, 38);

                context.fillStyle = '#efefdf';
                context.fillRect(x + 9, y - 15, 62, 18);

                context.fillStyle = '#283849';
                context.fillRect(x + 53, y - 11, 15, 12);

                context.fillStyle = '#d94b47';
                context.fillRect(x + 5, y + 10, 80, 8);

                context.fillStyle = '#d94b47';
                context.fillRect(x + 24, y - 7, 5, 17);
                context.fillRect(x + 18, y - 1, 17, 5);

                context.fillStyle = '#151b20';
                context.fillRect(x + 13, y + 31, 18, 10);
                context.fillRect(x + 61, y + 31, 18, 10);

                context.fillStyle =
                    flash
                        ? '#ff5d59'
                        : '#4b79e8';
                context.fillRect(x + 31, y - 19, 8, 4);

                context.fillStyle =
                    flash
                        ? '#4b79e8'
                        : '#ff5d59';
                context.fillRect(x + 43, y - 19, 8, 4);

                context.fillStyle =
                    flash
                        ? 'rgba(255,74,70,.12)'
                        : 'rgba(72,111,255,.12)';
                context.fillRect(x - 8, y - 26, 108, 55);
            };

            const drawCity = (
                context: CanvasRenderingContext2D,
                game: Model,
                time: number) =>
            {
                const sky =
                    context.createLinearGradient(
                        0,
                        0,
                        0,
                        H
                    );

                sky.addColorStop(0, '#0a1430');
                sky.addColorStop(0.48, '#16234b');
                sky.addColorStop(1, '#342240');

                context.fillStyle = sky;
                context.fillRect(0, 0, W, H);

                // stars
                context.fillStyle = '#d9e5ff';

                const stars = [
                    [ 169, 31 ], [ 201, 54 ], [ 238, 25 ],
                    [ 286, 45 ], [ 324, 18 ], [ 373, 56 ],
                    [ 420, 27 ], [ 466, 49 ], [ 515, 22 ],
                    [ 557, 60 ], [ 608, 35 ], [ 351, 83 ]
                ];

                for(const star of stars)
                    context.fillRect(star[0], star[1], 2, 2);

                // moon
                context.fillStyle = '#f2e9be';
                context.fillRect(524, 50, 28, 28);
                context.fillStyle = '#16234b';
                context.fillRect(518, 45, 22, 22);

                // far skyline
                const skyline = [
                    [ 146, 170, 52, 164 ],
                    [ 194, 205, 44, 129 ],
                    [ 234, 151, 62, 183 ],
                    [ 292, 194, 46, 140 ],
                    [ 334, 135, 72, 199 ],
                    [ 402, 188, 48, 146 ],
                    [ 446, 158, 62, 176 ],
                    [ 504, 199, 42, 135 ],
                    [ 542, 142, 62, 192 ],
                    [ 600, 180, 40, 154 ]
                ];

                for(let i = 0; i < skyline.length; i++)
                {
                    const b = skyline[i];

                    context.fillStyle =
                        i % 2 === 0
                            ? '#111a30'
                            : '#151b34';

                    context.fillRect(
                        b[0],
                        b[1],
                        b[2],
                        b[3]
                    );

                    for(
                        let wy = b[1] + 14;
                        wy < b[1] + b[3] - 10;
                        wy += 18
                    )
                    {
                        for(
                            let wx = b[0] + 9;
                            wx < b[0] + b[2] - 6;
                            wx += 15
                        )
                        {
                            if(
                                ((wx + wy + i) % 4) !== 0
                            )
                            {
                                context.fillStyle =
                                    ((wx + wy) % 3) === 0
                                        ? '#d39b50'
                                        : '#4c6288';

                                context.fillRect(
                                    wx,
                                    wy,
                                    5,
                                    6
                                );
                            }
                        }
                    }
                }

                // Biribiri Tower
                context.fillStyle = '#242938';
                context.fillRect(
                    0,
                    ROOF_Y,
                    BUILDING_RIGHT,
                    H - ROOF_Y
                );

                context.fillStyle = '#343b4b';
                context.fillRect(
                    8,
                    ROOF_Y + 9,
                    BUILDING_RIGHT - 16,
                    H - ROOF_Y - 9
                );

                context.fillStyle = '#151a25';
                context.fillRect(
                    0,
                    ROOF_Y - 8,
                    BUILDING_RIGHT + 6,
                    10
                );

                context.fillStyle = '#6a7384';
                context.fillRect(
                    0,
                    ROOF_Y - 11,
                    BUILDING_RIGHT + 8,
                    3
                );

                // rooftop sign
                context.fillStyle = '#15141c';
                context.fillRect(15, 38, 101, 34);

                context.strokeStyle = '#c64c59';
                context.strokeRect(15.5, 38.5, 100, 33);

                context.fillStyle = '#ff6a76';
                context.font = 'bold 12px monospace';
                context.textAlign = 'center';
                context.textBaseline = 'middle';
                context.fillText(
                    'BIRIBIRI',
                    65,
                    51
                );

                context.fillStyle = '#d8d5df';
                context.font = 'bold 7px monospace';
                context.fillText(
                    'TOWER',
                    65,
                    63
                );

                // roof door / rail
                context.fillStyle = '#111720';
                context.fillRect(16, 69, 32, 22);

                context.fillStyle = '#70798b';
                context.fillRect(15, 67, 34, 3);

                context.fillStyle = '#606b7a';
                for(let x = 58; x <= 120; x += 16)
                    context.fillRect(x, 72, 3, 19);

                context.fillRect(57, 72, 66, 3);

                // flag / wind
                context.fillStyle = '#8a929f';
                context.fillRect(89, 12, 2, 28);

                const windDirection =
                    game.wind === 0
                        ? 1
                        : game.wind;

                context.fillStyle =
                    game.wind === 0
                        ? '#8e6d79'
                        : '#ef5965';

                if(windDirection > 0)
                    context.fillRect(91, 14, 18, 8);
                else
                    context.fillRect(72, 14, 18, 8);

                if(game.level >= 6 && game.wind !== 0)
                {
                    context.fillStyle = '#d9e7ff';
                    context.font = 'bold 8px monospace';
                    context.textAlign = 'center';

                    context.fillText(
                        game.wind < 0
                            ? 'VIENTO ←'
                            : 'VIENTO →',
                        162,
                        22
                    );
                }

                // tower windows
                for(let y = 112; y < 302; y += 34)
                {
                    for(let x = 18; x < 110; x += 31)
                    {
                        const lit =
                            ((x + y) % 5) !== 0;

                        context.fillStyle =
                            lit
                                ? '#d5a253'
                                : '#182031';

                        context.fillRect(x, y, 18, 20);

                        if(lit)
                        {
                            context.fillStyle =
                                'rgba(255,224,139,.18)';
                            context.fillRect(
                                x - 2,
                                y - 2,
                                22,
                                24
                            );
                        }

                        context.fillStyle = '#4a4e58';
                        context.fillRect(
                            x + 8,
                            y,
                            2,
                            20
                        );
                    }
                }

                // street
                context.fillStyle = '#20252f';
                context.fillRect(0, STREET_Y, W, H - STREET_Y);

                context.fillStyle = '#323844';
                context.fillRect(0, STREET_Y, W, 5);

                context.fillStyle = '#d0a94d';

                for(let x = 145; x < 520; x += 54)
                    context.fillRect(x, 381, 28, 3);

                // barricades
                for(const x of [ 145, 480 ])
                {
                    context.fillStyle = '#d8b65a';
                    context.fillRect(x, 326, 38, 4);

                    context.fillStyle = '#d75848';
                    context.fillRect(x + 4, 323, 7, 10);
                    context.fillRect(x + 26, 323, 7, 10);
                }

                drawAmbulance(context, time);

                // safety markings
                context.fillStyle = '#ccaa51';
                context.fillRect(170, 330, 8, 3);
                context.fillRect(493, 330, 8, 3);

                // miss indicators integrated into road sign
                context.fillStyle = '#11161e';
                context.fillRect(391, 349, 116, 25);
                context.strokeStyle = '#596170';
                context.strokeRect(391.5, 349.5, 115, 24);

                context.fillStyle = '#bfc8d6';
                context.font = 'bold 7px monospace';
                context.textAlign = 'left';
                context.fillText(
                    'FALLOS',
                    400,
                    364
                );

                for(let i = 0; i < MAX_MISSES; i++)
                {
                    context.fillStyle =
                        i < game.misses
                            ? '#ec5b5c'
                            : '#4a925e';

                    context.fillRect(
                        452 + (i * 15),
                        357,
                        9,
                        9
                    );
                }

                if(game.combo >= 2)
                {
                    context.fillStyle = '#17151c';
                    context.fillRect(194, 349, 111, 25);

                    context.strokeStyle = '#a37c40';
                    context.strokeRect(
                        194.5,
                        349.5,
                        110,
                        24
                    );

                    context.fillStyle = '#ffe07c';
                    context.font = 'bold 10px monospace';
                    context.textAlign = 'center';
                    context.fillText(
                        `RACHA x${ game.combo }`,
                        249,
                        364
                    );
                }

                if(game.dangerFlash > 0)
                {
                    context.fillStyle =
                        `rgba(255,57,57,${
                            Math.min(
                                .24,
                                game.dangerFlash * .34
                            )
                        })`;

                    context.fillRect(0, 0, W, H);
                }

                if(game.levelFlash > 0)
                {
                    context.fillStyle =
                        `rgba(255,214,104,${
                            Math.min(
                                .12,
                                game.levelFlash * .16
                            )
                        })`;

                    context.fillRect(0, 0, W, H);
                }
            };

            const draw = () =>
            {
                const canvas = canvasRef.current;

                if(!canvas)
                    return;

                const context =
                    canvas.getContext('2d');

                if(!context)
                    return;

                const game = gameRef.current;
                const time = performance.now();

                context.setTransform(
                    2,
                    0,
                    0,
                    2,
                    0,
                    0
                );

                context.imageSmoothingEnabled = false;

                drawCity(
                    context,
                    game,
                    time
                );

                for(const person of game.people)
                    drawPerson(context, person);

                drawNet(context, game);

                for(const popup of game.popups)
                {
                    const alpha =
                        clamp(
                            popup.ttl / 0.9,
                            0,
                            1
                        );

                    context.fillStyle =
                        popup.positive
                            ? `rgba(255,226,118,${ alpha })`
                            : `rgba(255,102,102,${ alpha })`;

                    context.font = 'bold 11px monospace';
                    context.textAlign = 'center';
                    context.fillText(
                        popup.text,
                        popup.x,
                        popup.y
                    );
                }

                for(const spark of game.sparks)
                {
                    const alpha =
                        clamp(
                            spark.ttl / 0.75,
                            0,
                            1
                        );

                    context.fillStyle =
                        spark.warm
                            ? `rgba(255,219,91,${ alpha })`
                            : `rgba(255,105,97,${ alpha })`;

                    context.fillRect(
                        Math.round(spark.x),
                        Math.round(spark.y),
                        2,
                        2
                    );
                }

                if(
                    game.feedbackTime > 0 &&
                    game.feedback
                )
                {
                    context.fillStyle = 'rgba(12,15,25,.92)';
                    context.fillRect(205, 395, 230, 19);

                    context.strokeStyle = '#736187';
                    context.strokeRect(205.5, 395.5, 229, 18);

                    context.fillStyle = '#ffe28b';
                    context.font = 'bold 9px monospace';
                    context.textAlign = 'center';
                    context.fillText(
                        game.feedback,
                        W / 2,
                        408
                    );
                }

                // Light CRT line treatment.
                context.fillStyle = 'rgba(255,255,255,.012)';

                for(let y = 0; y < H; y += 4)
                    context.fillRect(0, y, W, 1);
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
                            Math.max(
                                0,
                                (now - last) / 1000
                            )
                        );

                        update(dt);
                    }

                    draw();
                }
                else
                {
                    lastFrameRef.current = now;
                }

                frameId =
                    window.requestAnimationFrame(frame);
            };

            frameId =
                window.requestAnimationFrame(frame);

            return () =>
                window.cancelAnimationFrame(frameId);
        },
        []
    );

    if(!isVisible)
        return null;

    const phaseLabel =
        phase === 'playing'
            ? 'RESCATE'
            : phase === 'paused'
                ? 'PAUSA'
                : phase === 'gameover'
                    ? 'FIN'
                    : 'PREPARADO';

    return (
        <>
            <NitroCardView
                uniqueKey="rooftop-rescue"
                className="nitro-rooftop-rescue"
                theme="primary-slim"
                style={ { width: '760px' } }>
                <NitroCardHeaderView
                    headerText="Rooftop Rescue"
                    onCloseClick={ close } />

                <NitroCardContentView
                    gap={ 0 }
                    className="rooftop-rescue-content">
                    <div
                        className="rooftop-rescue-shell"
                        data-engine={ UI_MARKER }
                        data-patch={ PATCH_MARKER }>
                        <span
                            className="rooftop-cabinet-screw is-top-left"
                            aria-hidden="true" />
                        <span
                            className="rooftop-cabinet-screw is-top-right"
                            aria-hidden="true" />
                        <span
                            className="rooftop-cabinet-screw is-bottom-left"
                            aria-hidden="true" />
                        <span
                            className="rooftop-cabinet-screw is-bottom-right"
                            aria-hidden="true" />

                        <div className="rooftop-rescue-hud">
                            <div className="rooftop-hud-cell is-score">
                                <span className="rooftop-hud-label">
                                    PUNTUACIÓN
                                </span>
                                <strong className="rooftop-score-value">
                                    { fmt(score) }
                                </strong>
                            </div>

                            <div className="rooftop-hud-cell is-round">
                                <span className="rooftop-hud-label">
                                    NIVEL
                                </span>
                                <strong className="rooftop-level-value">
                                    { level
                                        .toString()
                                        .padStart(2, '0') }
                                </strong>
                            </div>

                            <div className="rooftop-hud-cell is-hits">
                                <span className="rooftop-hud-label">
                                    RESCATADOS
                                </span>
                                <strong className="rooftop-rescued-value">
                                    { rescued }
                                </strong>
                            </div>

                            <div className="rooftop-hud-cell is-combo">
                                <span className="rooftop-hud-label">
                                    RACHA
                                </span>
                                <strong className="rooftop-combo-value">
                                    { combo
                                        .toString()
                                        .padStart(2, '0') }
                                </strong>
                            </div>

                            <div
                                className={
                                    `rooftop-hud-cell is-status is-${ phase }`
                                }>
                                <RooftopSirenIcon />
                                <strong>{ phaseLabel }</strong>
                            </div>
                        </div>

                        <div className="rooftop-rescue-stage">
                            <canvas
                                ref={ canvasRef }
                                className="rooftop-rescue-canvas"
                                width={ W * 2 }
                                height={ H * 2 }
                                tabIndex={ 0 }
                                aria-label="Rooftop Rescue" />

                            { phase === 'ready' &&
                                <div className="rooftop-game-overlay">
                                    <div className="rooftop-overlay-panel">
                                        <span className="rooftop-overlay-kicker">
                                            BIRIBIRI EMERGENCY
                                        </span>

                                        <strong className="rooftop-overlay-title">
                                            ROOFTOP RESCUE
                                        </strong>

                                        <span className="rooftop-overlay-copy">
                                            Atrapa a cada persona con la lona
                                            hasta ponerla a salvo.
                                        </span>

                                        <button
                                            type="button"
                                            className="rooftop-primary-button"
                                            disabled={ startPending }
                                            onClick={ requestStart }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'JUGAR' }
                                        </button>

                                        <span className="rooftop-overlay-hint">
                                            ENTER también inicia la partida
                                        </span>

                                        { resultState === 'rejected' &&
                                            <span className="rooftop-result-message is-error">
                                                { resultMessage }
                                            </span> }
                                    </div>
                                </div> }

                            { phase === 'paused' &&
                                <div className="rooftop-game-overlay is-pause">
                                    <div className="rooftop-overlay-panel is-compact">
                                        <span className="rooftop-overlay-kicker">
                                            RESCATE DETENIDO
                                        </span>

                                        <strong className="rooftop-overlay-title">
                                            PAUSA
                                        </strong>

                                        <button
                                            type="button"
                                            className="rooftop-primary-button"
                                            onClick={ togglePause }>
                                            CONTINUAR
                                        </button>

                                        <span className="rooftop-overlay-hint">
                                            P o ESC para continuar
                                        </span>
                                    </div>
                                </div> }

                            { phase === 'gameover' &&
                                <div className="rooftop-game-overlay is-gameover">
                                    <div className="rooftop-overlay-panel">
                                        <span className="rooftop-overlay-kicker">
                                            OPERACIÓN CERRADA
                                        </span>

                                        <strong className="rooftop-overlay-title">
                                            FIN DEL RESCATE
                                        </strong>

                                        <div className="rooftop-gameover-results">
                                            <span>
                                                PUNTUACIÓN
                                                <b>{ fmt(score) }</b>
                                            </span>

                                            <span>
                                                NIVEL
                                                <b>{ level }</b>
                                            </span>

                                            <span>
                                                RESCATADOS
                                                <b>{ rescued }</b>
                                            </span>
                                        </div>

                                        { newServerRecord &&
                                            <div className="rooftop-new-record">
                                                ★ NUEVO RÉCORD PERSONAL ★
                                            </div> }

                                        { resultState !== 'idle' &&
                                            <span
                                                className={
                                                    `rooftop-result-message${
                                                        resultState === 'rejected'
                                                            ? ' is-error'
                                                            : ' is-success'
                                                    }`
                                                }>
                                                { resultMessage }
                                            </span> }

                                        <button
                                            type="button"
                                            className="rooftop-primary-button"
                                            disabled={ startPending }
                                            onClick={ requestStart }>
                                            { startPending
                                                ? 'PREPARANDO...'
                                                : 'JUGAR DE NUEVO' }
                                        </button>
                                    </div>
                                </div> }
                        </div>

                        <div className="rooftop-rescue-console">
                            <div className="rooftop-controls-panel">
                                <div className="rooftop-control-group">
                                    <span className="rooftop-keycap">
                                        ←
                                    </span>

                                    <span className="rooftop-keycap">
                                        →
                                    </span>

                                    <span className="rooftop-control-action">
                                        MOVER LONA
                                    </span>
                                </div>

                                <span className="rooftop-console-divider" />

                                <div className="rooftop-control-group">
                                    <span className="rooftop-keycap">
                                        P
                                    </span>

                                    <span className="rooftop-control-action">
                                        PAUSA
                                    </span>
                                </div>
                            </div>

                            <div className="rooftop-console-actions">
                                <button
                                    type="button"
                                    className={
                                        `rooftop-sound-button${
                                            soundEnabled
                                                ? ' is-on'
                                                : ''
                                        }`
                                    }
                                    onClick={ toggleSound }
                                    aria-pressed={ soundEnabled }>
                                    <span
                                        className="rooftop-sound-icon"
                                        aria-hidden="true">
                                        ♪
                                    </span>

                                    <span>
                                        SONIDO
                                        <b>
                                            { soundEnabled
                                                ? 'ON'
                                                : 'OFF' }
                                        </b>
                                    </span>
                                </button>

                                <button
                                    type="button"
                                    className="rooftop-restart-button"
                                    disabled={ startPending }
                                    onClick={ requestStart }>
                                    <span className="rooftop-restart-shine" />
                                    <span>REINICIAR</span>
                                </button>
                            </div>
                        </div>

                        <div className="rooftop-arcade-summary-bar">
                            <div className="rooftop-arcade-summary-brand">
                                <span>RANKING GLOBAL</span>
                                <strong>ROOFTOP RESCUE</strong>
                            </div>

                            <div className="rooftop-arcade-summary-stats">
                                <span>
                                    TU RÉCORD
                                    <b>{ fmt(serverBest) }</b>
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
                                className="rooftop-records-button"
                                onClick={ openRecords }>
                                <span
                                    className="rooftop-records-star"
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
                gameName="Rooftop Rescue"
                levelLabel="NIVEL"
                leaderboard={ leaderboard }
                personalBest={ serverBest }
                personalRank={ personalRank }
                totalPlayers={ totalPlayers }
                onClose={ closeRecords } />
        </>
    );
};

export default RooftopRescueView;
