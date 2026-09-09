'use strict';

(() => {
  const {
    C,
    clampTarget
  } = window.AirHockeyCore;

  const canvas =
    document.getElementById('game');

  const ctx =
    canvas.getContext(
      '2d',
      { alpha: false }
    );

  const sideEl =
    document.getElementById('side');

  const statusEl =
    document.getElementById('status');

  const leftScoreEl =
    document.getElementById('leftScore');

  const rightScoreEl =
    document.getElementById('rightScore');

  const pingEl =
    document.getElementById('ping');

  const tickEl =
    document.getElementById('tick');

  const resetBtn =
    document.getElementById('resetBtn');

  const debugBtn =
    document.getElementById('debugBtn');

  const openSecondBtn =
    document.getElementById('openSecondBtn');

  const state = {
    socket: null,
    connected: false,
    side: 'spectator',
    debug: false,

    snapshot: null,
    previousSnapshot: null,
    lastSnapshotAt:
      performance.now(),

    own: null,

    pendingInput: null,
    inputTimer: null,
    lastInputSentAt: 0,

    ping: 0,
    lastPingAt: 0
  };

  function connect() {
    const protocol =
      location.protocol === 'https:'
        ? 'wss:'
        : 'ws:';

    const ws =
      new WebSocket(
        `${protocol}//${location.host}/`
      );

    state.socket = ws;

    ws.addEventListener(
      'open',
      () => {
        state.connected = true;
        statusEl.textContent =
          'Conectado';
      }
    );

    ws.addEventListener(
      'close',
      () => {
        state.connected = false;
        statusEl.textContent =
          'Desconectado · reconectando...';

        window.setTimeout(
          connect,
          600
        );
      }
    );

    ws.addEventListener(
      'message',
      event => {
        let message;

        try {
          message =
            JSON.parse(
              event.data
            );
        } catch {
          return;
        }

        handleMessage(message);
      }
    );
  }

  function handleMessage(message) {
    if (
      !message ||
      typeof message !== 'object'
    ) return;

    if (message.type === 'welcome') {
      state.side =
        message.side;

      state.snapshot =
        message.snapshot;

      state.previousSnapshot =
        message.snapshot;

      initializeOwnFromSnapshot();

      renderSide();
      return;
    }

    if (message.type === 'state') {
      state.previousSnapshot =
        state.snapshot;

      state.snapshot =
        message.snapshot;

      state.lastSnapshotAt =
        performance.now();

      leftScoreEl.textContent =
        String(
          state.snapshot.leftScore
        );

      rightScoreEl.textContent =
        String(
          state.snapshot.rightScore
        );

      tickEl.textContent =
        String(
          state.snapshot.tick
        );

      updateStatus();
      return;
    }

    if (message.type === 'roster') {
      updateStatus(
        message.connectedPlayers
      );

      return;
    }

    if (message.type === 'pong') {
      state.ping =
        Math.max(
          0,
          performance.now() -
          Number(message.clientNow)
        );

      pingEl.textContent =
        `${state.ping.toFixed(1)} ms`;
    }
  }

  function renderSide() {
    if (state.side === 'left') {
      sideEl.textContent =
        'AZUL · IZQUIERDA';

      sideEl.className =
        'pill blue';
      return;
    }

    if (state.side === 'right') {
      sideEl.textContent =
        'ROJO · DERECHA';

      sideEl.className =
        'pill red';
      return;
    }

    sideEl.textContent =
      'ESPECTADOR';

    sideEl.className =
      'pill';
  }

  function updateStatus(
    connectedPlayers = null
  ) {
    const snapshot =
      state.snapshot;

    if (!snapshot) return;

    if (snapshot.winner) {
      statusEl.textContent =
        snapshot.winner === state.side
          ? 'HAS GANADO'
          : (
            state.side === 'spectator'
              ? `Ganador: ${snapshot.winner}`
              : 'HAS PERDIDO'
          );

      return;
    }

    if (!snapshot.playing) {
      statusEl.textContent =
        connectedPlayers === 2
          ? 'Preparando partida...'
          : 'Esperando al segundo jugador...';

      return;
    }

    statusEl.textContent =
      'Jugando';
  }

  function initializeOwnFromSnapshot() {
    if (!state.snapshot) return;

    if (
      state.side !== 'left' &&
      state.side !== 'right'
    ) {
      state.own = null;
      return;
    }

    const source =
      state.snapshot[state.side];

    state.own = {
      x: source.x,
      y: source.y
    };
  }

  function canvasPoint(event) {
    const rect =
      canvas.getBoundingClientRect();

    return {
      x:
        (
          (event.clientX - rect.left) /
          rect.width
        ) * C.W,

      y:
        (
          (event.clientY - rect.top) /
          rect.height
        ) * C.H
    };
  }

  function send(object) {
    const ws =
      state.socket;

    if (
      !ws ||
      ws.readyState !== WebSocket.OPEN
    ) return;

    ws.send(
      JSON.stringify(object)
    );
  }

  function flushInput() {
    state.inputTimer = null;

    const pending =
      state.pendingInput;

    if (!pending) return;

    state.pendingInput = null;
    state.lastInputSentAt =
      performance.now();

    send({
      type: 'input',
      x: pending.x,
      y: pending.y
    });
  }

  function queueInput(point) {
    state.pendingInput = point;

    if (
      state.inputTimer !== null
    ) return;

    const now =
      performance.now();

    const elapsed =
      now - state.lastInputSentAt;

    /*
     * 120 inputs/s con trailing edge.
     * El último target jamás se pierde.
     */
    if (elapsed >= 8) {
      flushInput();
      return;
    }

    state.inputTimer =
      window.setTimeout(
        flushInput,
        Math.max(
          0,
          8 - elapsed
        )
      );
  }

  canvas.addEventListener(
    'pointermove',
    event => {
      if (
        state.side !== 'left' &&
        state.side !== 'right'
      ) return;

      if (
        event.pointerType !== 'mouse' &&
        event.buttons === 0
      ) return;

      event.preventDefault();

      const point =
        clampTarget(
          state.side,
          canvasPoint(event)
        );

      /*
       * Sensación local 1:1.
       * Nada de reconciliar/snaps.
       */
      state.own = point;

      queueInput(point);
    },
    { passive: false }
  );

  canvas.addEventListener(
    'pointerenter',
    event => {
      if (
        state.side !== 'left' &&
        state.side !== 'right'
      ) return;

      const point =
        clampTarget(
          state.side,
          canvasPoint(event)
        );

      state.own = point;
      queueInput(point);
    }
  );

  canvas.addEventListener(
    'contextmenu',
    event =>
      event.preventDefault()
  );

  resetBtn.addEventListener(
    'click',
    () =>
      send({
        type: 'reset'
      })
  );

  debugBtn.addEventListener(
    'click',
    () => {
      state.debug =
        !state.debug;

      debugBtn.textContent =
        `Debug: ${
          state.debug
            ? 'ON'
            : 'OFF'
        }`;
    }
  );

  openSecondBtn.addEventListener(
    'click',
    () => {
      window.open(
        location.href,
        '_blank'
      );
    }
  );

  function drawTable() {
    ctx.fillStyle =
      '#12394a';

    ctx.fillRect(
      0,
      0,
      C.W,
      C.H
    );

    const leftGrad =
      ctx.createLinearGradient(
        0,
        0,
        C.CENTER_X,
        0
      );

    leftGrad.addColorStop(
      0,
      'rgba(35,137,216,.22)'
    );

    leftGrad.addColorStop(
      1,
      'rgba(35,137,216,.04)'
    );

    ctx.fillStyle = leftGrad;

    ctx.fillRect(
      0,
      0,
      C.CENTER_X,
      C.H
    );

    const rightGrad =
      ctx.createLinearGradient(
        C.CENTER_X,
        0,
        C.W,
        0
      );

    rightGrad.addColorStop(
      0,
      'rgba(216,68,82,.04)'
    );

    rightGrad.addColorStop(
      1,
      'rgba(216,68,82,.22)'
    );

    ctx.fillStyle = rightGrad;

    ctx.fillRect(
      C.CENTER_X,
      0,
      C.CENTER_X,
      C.H
    );

    ctx.strokeStyle =
      '#dbe8f2';

    ctx.lineWidth = 10;
    ctx.lineJoin = 'round';

    ctx.strokeRect(
      5,
      5,
      C.W - 10,
      C.H - 10
    );

    ctx.beginPath();
    ctx.moveTo(
      0,
      C.GOAL_TOP
    );
    ctx.lineTo(
      30,
      C.GOAL_TOP
    );
    ctx.lineTo(
      30,
      C.GOAL_BOTTOM
    );
    ctx.lineTo(
      0,
      C.GOAL_BOTTOM
    );
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(
      C.W,
      C.GOAL_TOP
    );
    ctx.lineTo(
      C.W - 30,
      C.GOAL_TOP
    );
    ctx.lineTo(
      C.W - 30,
      C.GOAL_BOTTOM
    );
    ctx.lineTo(
      C.W,
      C.GOAL_BOTTOM
    );
    ctx.stroke();

    ctx.strokeStyle =
      'rgba(219,232,242,.75)';

    ctx.lineWidth = 4;
    ctx.setLineDash([14, 14]);

    ctx.beginPath();
    ctx.moveTo(
      C.CENTER_X,
      10
    );
    ctx.lineTo(
      C.CENTER_X,
      C.H - 10
    );
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.arc(
      C.CENTER_X,
      C.H / 2,
      78,
      0,
      Math.PI * 2
    );
    ctx.stroke();

    ctx.fillStyle =
      '#dbe8f2';

    ctx.beginPath();
    ctx.arc(
      C.CENTER_X,
      C.H / 2,
      7,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }

  function drawMallet(
    mallet,
    fill,
    label
  ) {
    ctx.save();

    ctx.shadowColor =
      'rgba(0,0,0,.35)';

    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle =
      '#f2f7fb';

    ctx.beginPath();

    ctx.arc(
      mallet.x,
      mallet.y,
      C.MALLET_R + 5,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.shadowColor =
      'transparent';

    ctx.fillStyle = fill;

    ctx.beginPath();

    ctx.arc(
      mallet.x,
      mallet.y,
      C.MALLET_R,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.fillStyle =
      'rgba(255,255,255,.22)';

    ctx.beginPath();

    ctx.arc(
      mallet.x - 10,
      mallet.y - 11,
      12,
      0,
      Math.PI * 2
    );

    ctx.fill();

    if (state.debug) {
      ctx.strokeStyle =
        '#ffe878';

      ctx.lineWidth = 2;

      ctx.beginPath();

      ctx.arc(
        mallet.x,
        mallet.y,
        C.SOLID_R,
        0,
        Math.PI * 2
      );

      ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = '12px monospace';

      ctx.fillText(
        label,
        mallet.x + 48,
        mallet.y - 45
      );
    }

    ctx.restore();
  }

  function drawPuck(puck) {
    ctx.save();

    ctx.shadowColor =
      'rgba(0,0,0,.55)';

    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 4;

    ctx.fillStyle =
      '#05080b';

    ctx.beginPath();

    ctx.arc(
      puck.x,
      puck.y,
      C.PUCK_R,
      0,
      Math.PI * 2
    );

    ctx.fill();

    ctx.shadowColor =
      'transparent';

    ctx.strokeStyle =
      '#60717d';

    ctx.lineWidth = 3;
    ctx.stroke();

    if (state.debug) {
      ctx.strokeStyle =
        '#fff27a';

      ctx.lineWidth = 1;
      ctx.beginPath();

      ctx.moveTo(
        puck.x,
        puck.y
      );

      ctx.lineTo(
        puck.x +
        (puck.vx * 0.06),

        puck.y +
        (puck.vy * 0.06)
      );

      ctx.stroke();
    }

    ctx.restore();
  }

  function visualState() {
    const snapshot =
      state.snapshot;

    if (!snapshot) {
      return null;
    }

    const left = {
      x: snapshot.left.x,
      y: snapshot.left.y
    };

    const right = {
      x: snapshot.right.x,
      y: snapshot.right.y
    };

    /*
     * Solo el mazo propio usa la posición inmediata del ratón.
     * Puck y rival son servidor.
     */
    if (
      state.side === 'left' &&
      state.own
    ) {
      left.x = state.own.x;
      left.y = state.own.y;
    }

    if (
      state.side === 'right' &&
      state.own
    ) {
      right.x = state.own.x;
      right.y = state.own.y;
    }

    return {
      left,
      right,
      puck: snapshot.puck
    };
  }

  function drawHud() {
    if (!state.debug) return;

    const snapshot =
      state.snapshot;

    if (!snapshot) return;

    ctx.save();

    ctx.fillStyle =
      'rgba(0,0,0,.68)';

    ctx.fillRect(
      12,
      12,
      310,
      105
    );

    ctx.fillStyle =
      '#d8f2ff';

    ctx.font =
      '13px monospace';

    ctx.fillText(
      `server fixed: 240 Hz`,
      22,
      34
    );

    ctx.fillText(
      `server tick: ${snapshot.tick}`,
      22,
      54
    );

    ctx.fillText(
      `contacts: ${snapshot.contacts}`,
      22,
      74
    );

    ctx.fillText(
      `ping: ${state.ping.toFixed(1)} ms`,
      22,
      94
    );

    ctx.fillText(
      `puck v: ${Math.round(
        Math.hypot(
          snapshot.puck.vx,
          snapshot.puck.vy
        )
      )}`,
      160,
      94
    );

    ctx.restore();
  }

  function render() {
    drawTable();

    const visual =
      visualState();

    if (visual) {
      drawMallet(
        visual.left,
        '#2789d8',
        'LEFT'
      );

      drawMallet(
        visual.right,
        '#d84452',
        'RIGHT'
      );

      drawPuck(
        visual.puck
      );
    }

    drawHud();

    const now =
      performance.now();

    if (
      state.connected &&
      now - state.lastPingAt >
      1000
    ) {
      state.lastPingAt = now;

      send({
        type: 'ping',
        clientNow: now
      });
    }

    requestAnimationFrame(render);
  }

  connect();
  requestAnimationFrame(render);
})();
