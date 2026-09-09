'use strict';

(() => {
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  const leftScoreEl = document.getElementById('leftScore');
  const rightScoreEl = document.getElementById('rightScore');
  const statusEl = document.getElementById('status');
  const resetBtn = document.getElementById('resetBtn');
  const debugBtn = document.getElementById('debugBtn');

  const sliders = {
    transfer: document.getElementById('transfer'),
    restitution: document.getElementById('restitution'),
    drag: document.getElementById('drag'),
    ai: document.getElementById('ai')
  };

  const outputs = {
    transfer: document.getElementById('transferOut'),
    restitution: document.getElementById('restitutionOut'),
    drag: document.getElementById('dragOut'),
    ai: document.getElementById('aiOut')
  };

  const W = 1000;
  const H = 600;
  const CENTER_X = W / 2;

  const MALLET_R = 38;
  const PUCK_R = 18;
  const SOLID_R = MALLET_R + PUCK_R;

  const GOAL_HALF = 104;
  const GOAL_TOP = (H / 2) - GOAL_HALF;
  const GOAL_BOTTOM = (H / 2) + GOAL_HALF;

  const FIXED_DT = 1 / 240;
  const MAX_FRAME = 0.05;
  const MAX_MICRO_STEP = 4.0;
  const MAX_MICRO_STEPS = 160;

  const WALL_RESTITUTION = 0.90;
  const MAX_PUCK_SPEED = 2350;
  const MAX_MALLET_IMPACT_SPEED = 1850;
  const MAX_AI_IMPACT_SPEED = 1450;

  const state = {
    playing: true,
    roundPause: 0,
    leftScore: 0,
    rightScore: 0,
    debug: false,
    lastTime: performance.now() / 1000,
    accumulator: 0,

    pointerInside: false,
    pointer: { x: 175, y: H / 2 },

    player: {
      x: 175, y: H / 2,
      prevX: 175, prevY: H / 2,
      vx: 0, vy: 0
    },

    ai: {
      x: W - 175, y: H / 2,
      prevX: W - 175, prevY: H / 2,
      targetX: W - 175, targetY: H / 2,
      vx: 0, vy: 0
    },

    puck: {
      x: W / 2,
      y: H / 2,
      vx: 0,
      vy: 0
    },

    contacts: 0
  };

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function length(x, y) {
    return Math.hypot(x, y);
  }

  function clampVector(x, y, maxLen) {
    const len = Math.hypot(x, y);
    if (len <= maxLen || len < 1e-9) return { x, y };
    const s = maxLen / len;
    return { x: x * s, y: y * s };
  }

  function settings() {
    return {
      transfer: Number(sliders.transfer.value),
      restitution: Number(sliders.restitution.value),
      drag: Number(sliders.drag.value),
      ai: Number(sliders.ai.value)
    };
  }

  function updateOutputs() {
    for (const key of Object.keys(sliders)) {
      outputs[key].value = Number(sliders[key].value).toFixed(2);
    }
  }

  function resetRound(direction = 0) {
    state.puck.x = W / 2;
    state.puck.y = H / 2;

    const speed = direction === 0 ? 0 : 260;
    state.puck.vx = direction * speed;
    state.puck.vy = 0;

    state.player.x = 175;
    state.player.y = H / 2;
    state.player.prevX = state.player.x;
    state.player.prevY = state.player.y;

    state.pointer.x = state.player.x;
    state.pointer.y = state.player.y;

    state.ai.x = W - 175;
    state.ai.y = H / 2;
    state.ai.prevX = state.ai.x;
    state.ai.prevY = state.ai.y;

    state.roundPause = 0.55;
  }

  function resetGame() {
    state.leftScore = 0;
    state.rightScore = 0;
    leftScoreEl.textContent = '0';
    rightScoreEl.textContent = '0';
    state.contacts = 0;
    resetRound(0);
    statusEl.textContent = 'Mueve el ratón sobre la mesa';
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * W,
      y: ((event.clientY - rect.top) / rect.height) * H
    };
  }

  function clampPlayerTarget(p) {
    return {
      x: clamp(p.x, MALLET_R, CENTER_X - MALLET_R - 5),
      y: clamp(p.y, MALLET_R, H - MALLET_R)
    };
  }

  function clampAiTarget(p) {
    return {
      x: clamp(p.x, CENTER_X + MALLET_R + 5, W - MALLET_R),
      y: clamp(p.y, MALLET_R, H - MALLET_R)
    };
  }

  canvas.addEventListener('pointerenter', event => {
    if (event.pointerType !== 'mouse') return;
    state.pointerInside = true;
    state.pointer = clampPlayerTarget(canvasPoint(event));
    statusEl.textContent = 'Jugando';
  });

  canvas.addEventListener('pointerleave', event => {
    if (event.pointerType !== 'mouse') return;
    state.pointerInside = false;
  });

  canvas.addEventListener('pointermove', event => {
    if (event.pointerType !== 'mouse' && event.buttons === 0) return;
    event.preventDefault();

    state.pointerInside = true;
    state.pointer = clampPlayerTarget(canvasPoint(event));
  }, { passive: false });

  canvas.addEventListener('contextmenu', event => event.preventDefault());

  resetBtn.addEventListener('click', resetGame);

  debugBtn.addEventListener('click', () => {
    state.debug = !state.debug;
    debugBtn.textContent = `Debug: ${state.debug ? 'ON' : 'OFF'}`;
  });

  for (const input of Object.values(sliders)) {
    input.addEventListener('input', updateOutputs);
  }

  function goalForPuck(x, y) {
    const inGoalMouth = y > GOAL_TOP + PUCK_R && y < GOAL_BOTTOM - PUCK_R;

    if (x < -PUCK_R && inGoalMouth) return -1;
    if (x > W + PUCK_R && inGoalMouth) return 1;
    return 0;
  }

  function resolveWalls(puck) {
    const inGoalMouth =
      puck.y > GOAL_TOP + PUCK_R &&
      puck.y < GOAL_BOTTOM - PUCK_R;

    if (puck.y < PUCK_R) {
      puck.y = PUCK_R;
      if (puck.vy < 0) puck.vy = -puck.vy * WALL_RESTITUTION;
    }

    if (puck.y > H - PUCK_R) {
      puck.y = H - PUCK_R;
      if (puck.vy > 0) puck.vy = -puck.vy * WALL_RESTITUTION;
    }

    if (!inGoalMouth) {
      if (puck.x < PUCK_R) {
        puck.x = PUCK_R;
        if (puck.vx < 0) puck.vx = -puck.vx * WALL_RESTITUTION;
      }

      if (puck.x > W - PUCK_R) {
        puck.x = W - PUCK_R;
        if (puck.vx > 0) puck.vx = -puck.vx * WALL_RESTITUTION;
      }
    }

    // Goal-post circles prevent corner clipping.
    const posts = [
      { x: 0, y: GOAL_TOP },
      { x: 0, y: GOAL_BOTTOM },
      { x: W, y: GOAL_TOP },
      { x: W, y: GOAL_BOTTOM }
    ];

    for (const post of posts) {
      const dx = puck.x - post.x;
      const dy = puck.y - post.y;
      const rr = PUCK_R + 10;
      const d2 = dx * dx + dy * dy;

      if (d2 >= rr * rr) continue;

      const d = Math.sqrt(Math.max(d2, 1e-9));
      const nx = dx / d;
      const ny = dy / d;

      puck.x = post.x + nx * rr;
      puck.y = post.y + ny * rr;

      const vn = puck.vx * nx + puck.vy * ny;
      if (vn < 0) {
        puck.vx -= (1 + WALL_RESTITUTION) * vn * nx;
        puck.vy -= (1 + WALL_RESTITUTION) * vn * ny;
      }
    }
  }

  function resolveSolidMallet(puck, malletX, malletY, malletVX, malletVY, transferCap) {
    const dx = puck.x - malletX;
    const dy = puck.y - malletY;
    const d2 = dx * dx + dy * dy;

    if (d2 >= SOLID_R * SOLID_R) return false;

    let nx;
    let ny;
    let d = Math.sqrt(Math.max(d2, 1e-12));

    if (d < 1e-5) {
      const rvx = puck.vx - malletVX;
      const rvy = puck.vy - malletVY;
      const rl = Math.hypot(rvx, rvy);

      if (rl > 1e-5) {
        nx = rvx / rl;
        ny = rvy / rl;
      } else {
        nx = malletX < CENTER_X ? 1 : -1;
        ny = 0;
      }
      d = 0;
    } else {
      nx = dx / d;
      ny = dy / d;
    }

    // Hard positional constraint: puck center is never allowed inside mallet + puck radius.
    puck.x = malletX + nx * (SOLID_R + 0.15);
    puck.y = malletY + ny * (SOLID_R + 0.15);

    const cfg = settings();

    const clampedMallet = clampVector(
      malletVX,
      malletVY,
      transferCap
    );

    const effectiveMX = clampedMallet.x * cfg.transfer;
    const effectiveMY = clampedMallet.y * cfg.transfer;

    const puckNormal = puck.vx * nx + puck.vy * ny;
    const malletNormal = effectiveMX * nx + effectiveMY * ny;
    const relNormal = puckNormal - malletNormal;

    // Only approaching motion creates an impulse.
    if (relNormal < 0) {
      const targetNormal =
        malletNormal +
        cfg.restitution * (malletNormal - puckNormal);

      const delta = targetNormal - puckNormal;

      puck.vx += delta * nx;
      puck.vy += delta * ny;
    }

    state.contacts += 1;
    return true;
  }

  function updateAiTarget(dt) {
    const cfg = settings();
    const puck = state.puck;

    // Defend around x=790 and attack only when puck is on CPU side.
    let targetX = W - 175;
    let targetY = H / 2;

    if (puck.x > CENTER_X - 30) {
      const aggression = cfg.ai;
      targetX = clamp(
        puck.x + 55,
        CENTER_X + MALLET_R + 5,
        W - MALLET_R
      );

      targetY = clamp(
        puck.y + (puck.vy * 0.055),
        MALLET_R,
        H - MALLET_R
      );

      // Do not sit directly on top of puck while it is moving toward player.
      if (puck.vx < -100) {
        targetX = W - 205;
      }

      // Difficulty scales how far CPU commits.
      targetX =
        (W - 175) * (1 - aggression) +
        targetX * aggression;
    }

    state.ai.targetX = targetX;
    state.ai.targetY = targetY;

    const dx = state.ai.targetX - state.ai.x;
    const dy = state.ai.targetY - state.ai.y;
    const dist = Math.hypot(dx, dy);

    const maxSpeed = 720 + (cfg.ai * 620);
    const maxTravel = maxSpeed * dt;

    if (dist <= maxTravel || dist < 1e-6) {
      state.ai.x = state.ai.targetX;
      state.ai.y = state.ai.targetY;
    } else {
      state.ai.x += (dx / dist) * maxTravel;
      state.ai.y += (dy / dist) * maxTravel;
    }

    const clamped = clampAiTarget(state.ai);
    state.ai.x = clamped.x;
    state.ai.y = clamped.y;
  }

  function simulate(dt) {
    if (state.roundPause > 0) {
      state.roundPause = Math.max(0, state.roundPause - dt);
      return;
    }

    // Player target is the mouse position. No acceleration / easing / network state.
    const playerStartX = state.player.x;
    const playerStartY = state.player.y;
    const playerEnd = state.pointerInside
      ? clampPlayerTarget(state.pointer)
      : { x: state.player.x, y: state.player.y };

    const aiStartX = state.ai.x;
    const aiStartY = state.ai.y;

    updateAiTarget(dt);

    const aiEndX = state.ai.x;
    const aiEndY = state.ai.y;

    const playerDX = playerEnd.x - playerStartX;
    const playerDY = playerEnd.y - playerStartY;
    const aiDX = aiEndX - aiStartX;
    const aiDY = aiEndY - aiStartY;

    let playerVX = playerDX / dt;
    let playerVY = playerDY / dt;
    let aiVX = aiDX / dt;
    let aiVY = aiDY / dt;

    const playerImpact = clampVector(
      playerVX,
      playerVY,
      MAX_MALLET_IMPACT_SPEED
    );
    playerVX = playerImpact.x;
    playerVY = playerImpact.y;

    const aiImpact = clampVector(
      aiVX,
      aiVY,
      MAX_AI_IMPACT_SPEED
    );
    aiVX = aiImpact.x;
    aiVY = aiImpact.y;

    const puckTravel = Math.hypot(state.puck.vx, state.puck.vy) * dt;
    const playerTravel = Math.hypot(playerDX, playerDY);
    const aiTravel = Math.hypot(aiDX, aiDY);

    const maxTravel = Math.max(puckTravel, playerTravel, aiTravel);
    let microSteps = Math.ceil(maxTravel / MAX_MICRO_STEP);
    microSteps = clamp(microSteps, 1, MAX_MICRO_STEPS);

    const microDt = dt / microSteps;

    for (let i = 1; i <= microSteps; i++) {
      const t = i / microSteps;

      const px = playerStartX + playerDX * t;
      const py = playerStartY + playerDY * t;
      const ax = aiStartX + aiDX * t;
      const ay = aiStartY + aiDY * t;

      state.puck.x += state.puck.vx * microDt;
      state.puck.y += state.puck.vy * microDt;

      resolveSolidMallet(
        state.puck,
        px,
        py,
        playerVX,
        playerVY,
        MAX_MALLET_IMPACT_SPEED
      );

      resolveSolidMallet(
        state.puck,
        ax,
        ay,
        aiVX,
        aiVY,
        MAX_AI_IMPACT_SPEED
      );

      resolveWalls(state.puck);

      const goal = goalForPuck(state.puck.x, state.puck.y);
      if (goal !== 0) {
        if (goal < 0) {
          state.rightScore += 1;
          rightScoreEl.textContent = String(state.rightScore);
          statusEl.textContent = 'Punto CPU';
          resetRound(1);
        } else {
          state.leftScore += 1;
          leftScoreEl.textContent = String(state.leftScore);
          statusEl.textContent = 'Punto para ti';
          resetRound(-1);
        }
        return;
      }

      const cfg = settings();
      const damping = Math.exp(-cfg.drag * microDt);
      state.puck.vx *= damping;
      state.puck.vy *= damping;

      const puckSpeed = Math.hypot(state.puck.vx, state.puck.vy);
      if (puckSpeed > MAX_PUCK_SPEED) {
        const s = MAX_PUCK_SPEED / puckSpeed;
        state.puck.vx *= s;
        state.puck.vy *= s;
      }
    }

    state.player.prevX = state.player.x;
    state.player.prevY = state.player.y;
    state.player.x = playerEnd.x;
    state.player.y = playerEnd.y;
    state.player.vx = playerVX;
    state.player.vy = playerVY;

    state.ai.prevX = aiStartX;
    state.ai.prevY = aiStartY;
    state.ai.vx = aiVX;
    state.ai.vy = aiVY;
  }

  function drawTable() {
    ctx.fillStyle = '#12394a';
    ctx.fillRect(0, 0, W, H);

    const gradL = ctx.createLinearGradient(0, 0, CENTER_X, 0);
    gradL.addColorStop(0, 'rgba(35,137,216,.22)');
    gradL.addColorStop(1, 'rgba(35,137,216,.04)');
    ctx.fillStyle = gradL;
    ctx.fillRect(0, 0, CENTER_X, H);

    const gradR = ctx.createLinearGradient(CENTER_X, 0, W, 0);
    gradR.addColorStop(0, 'rgba(216,68,82,.04)');
    gradR.addColorStop(1, 'rgba(216,68,82,.22)');
    ctx.fillStyle = gradR;
    ctx.fillRect(CENTER_X, 0, CENTER_X, H);

    ctx.strokeStyle = '#dbe8f2';
    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';
    ctx.strokeRect(5, 5, W - 10, H - 10);

    // Goal mouths.
    ctx.strokeStyle = '#dbe8f2';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, GOAL_TOP);
    ctx.lineTo(30, GOAL_TOP);
    ctx.lineTo(30, GOAL_BOTTOM);
    ctx.lineTo(0, GOAL_BOTTOM);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(W, GOAL_TOP);
    ctx.lineTo(W - 30, GOAL_TOP);
    ctx.lineTo(W - 30, GOAL_BOTTOM);
    ctx.lineTo(W, GOAL_BOTTOM);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(219,232,242,.75)';
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 14]);
    ctx.beginPath();
    ctx.moveTo(CENTER_X, 10);
    ctx.lineTo(CENTER_X, H - 10);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(CENTER_X, H / 2, 78, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#dbe8f2';
    ctx.beginPath();
    ctx.arc(CENTER_X, H / 2, 7, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawMallet(m, fill, label) {
    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,.35)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = '#f2f7fb';
    ctx.beginPath();
    ctx.arc(m.x, m.y, MALLET_R + 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(m.x, m.y, MALLET_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = 'rgba(255,255,255,.22)';
    ctx.beginPath();
    ctx.arc(m.x - 10, m.y - 11, 12, 0, Math.PI * 2);
    ctx.fill();

    if (state.debug) {
      ctx.strokeStyle = '#ffe878';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(m.x, m.y, SOLID_R, 0, Math.PI * 2);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText(label, m.x + 48, m.y - 45);
    }

    ctx.restore();
  }

  function drawPuck() {
    const p = state.puck;
    ctx.save();

    ctx.shadowColor = 'rgba(0,0,0,.55)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle = '#05080b';
    ctx.beginPath();
    ctx.arc(p.x, p.y, PUCK_R, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = '#60717d';
    ctx.lineWidth = 3;
    ctx.stroke();

    if (state.debug) {
      ctx.strokeStyle = '#fff27a';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + p.vx * 0.06, p.y + p.vy * 0.06);
      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';
      ctx.fillText(
        `v=${Math.round(Math.hypot(p.vx, p.vy))}`,
        p.x + 24,
        p.y - 24
      );
    }

    ctx.restore();
  }

  function drawDebugHud() {
    if (!state.debug) return;

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.65)';
    ctx.fillRect(12, 12, 270, 86);

    ctx.fillStyle = '#d8f2ff';
    ctx.font = '13px monospace';
    ctx.fillText(`fixed dt: ${(FIXED_DT * 1000).toFixed(2)} ms`, 22, 34);
    ctx.fillText(`contacts: ${state.contacts}`, 22, 54);
    ctx.fillText(
      `player v: ${Math.round(Math.hypot(state.player.vx, state.player.vy))}`,
      22,
      74
    );
    ctx.fillText(
      `puck: ${state.puck.x.toFixed(1)}, ${state.puck.y.toFixed(1)}`,
      22,
      94
    );
    ctx.restore();
  }

  function render() {
    drawTable();
    drawMallet(state.player, '#2789d8', 'PLAYER');
    drawMallet(state.ai, '#d84452', 'CPU');
    drawPuck();
    drawDebugHud();
  }

  function frame(nowMs) {
    const now = nowMs / 1000;
    let frameDt = now - state.lastTime;
    state.lastTime = now;

    frameDt = Math.min(MAX_FRAME, Math.max(0, frameDt));
    state.accumulator += frameDt;

    while (state.accumulator >= FIXED_DT) {
      simulate(FIXED_DT);
      state.accumulator -= FIXED_DT;
    }

    render();
    requestAnimationFrame(frame);
  }

  updateOutputs();
  resetGame();
  requestAnimationFrame(frame);
})();
