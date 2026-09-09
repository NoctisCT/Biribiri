'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const {
  C,
  AirHockeyPhysics
} = require('./physics.js');

const HOST = '127.0.0.1';
const PORT = 8766;

const ROOT = __dirname;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8'
};

const physics = new AirHockeyPhysics();

let nextClientId = 1;
let sequence = 0;

const clients = new Map();

const slots = {
  left: null,
  right: null
};

function availableSide() {
  if (slots.left === null) return 'left';
  if (slots.right === null) return 'right';
  return 'spectator';
}

function connectedPlayers() {
  return Number(slots.left !== null) +
    Number(slots.right !== null);
}

function updatePlaying() {
  const shouldPlay =
    connectedPlayers() === 2 &&
    !physics.state.winner;

  physics.setPlaying(shouldPlay);
}

function safeFile(urlPath) {
  let rel = decodeURIComponent(
    (urlPath || '/')
      .split('?')[0]
  );

  if (rel === '/') rel = '/index.html';

  const resolved =
    path.resolve(
      ROOT,
      '.' + rel
    );

  if (!resolved.startsWith(ROOT)) {
    return null;
  }

  return resolved;
}

const server = http.createServer(
  (req, res) => {
    const file = safeFile(req.url);

    if (!file) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    fs.stat(file, (err, stat) => {
      if (
        err ||
        !stat.isFile()
      ) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext =
        path.extname(file)
          .toLowerCase();

      res.writeHead(
        200,
        {
          'Content-Type':
            MIME[ext] ||
            'application/octet-stream',
          'Cache-Control': 'no-store'
        }
      );

      fs.createReadStream(file)
        .pipe(res);
    });
  }
);

function acceptKey(key) {
  return crypto
    .createHash('sha1')
    .update(
      key +
      '258EAFA5-E914-47DA-95CA-C5AB0DC85B11'
    )
    .digest('base64');
}

function encodeFrame(text) {
  const payload =
    Buffer.from(text, 'utf8');

  let header;

  if (payload.length < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = payload.length;
  } else if (payload.length < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(
      payload.length,
      2
    );
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(
      BigInt(payload.length),
      2
    );
  }

  return Buffer.concat([
    header,
    payload
  ]);
}

function encodeControlFrame(
  opcode,
  payload = Buffer.alloc(0)
) {
  const length = Math.min(
    payload.length,
    125
  );

  const header = Buffer.from([
    0x80 | opcode,
    length
  ]);

  return Buffer.concat([
    header,
    payload.subarray(0, length)
  ]);
}

function send(client, object) {
  if (
    !client ||
    client.socket.destroyed
  ) return;

  try {
    client.socket.write(
      encodeFrame(
        JSON.stringify(object)
      )
    );
  } catch {
    disconnectClient(client);
  }
}

function broadcast(object) {
  const text =
    encodeFrame(
      JSON.stringify(object)
    );

  for (
    const client of clients.values()
  ) {
    if (client.socket.destroyed) {
      continue;
    }

    try {
      client.socket.write(text);
    } catch {
      disconnectClient(client);
    }
  }
}

function broadcastState() {
  sequence += 1;

  broadcast({
    type: 'state',
    seq: sequence,
    serverNow:
      Number(process.hrtime.bigint()) /
      1e6,

    connectedPlayers:
      connectedPlayers(),

    snapshot:
      physics.snapshot()
  });
}

function broadcastRoster() {
  broadcast({
    type: 'roster',
    connectedPlayers:
      connectedPlayers(),

    leftConnected:
      slots.left !== null,

    rightConnected:
      slots.right !== null
  });
}

function removeSlot(client) {
  if (
    client.side === 'left' &&
    slots.left === client.id
  ) {
    slots.left = null;
  }

  if (
    client.side === 'right' &&
    slots.right === client.id
  ) {
    slots.right = null;
  }
}

function disconnectClient(client) {
  if (!client || client.closed) {
    return;
  }

  client.closed = true;

  removeSlot(client);
  clients.delete(client.id);

  updatePlaying();
  broadcastRoster();

  console.log(
    `[disconnect] #${client.id} ${client.side}`
  );
}

function decodeFrames(
  client,
  incoming
) {
  client.buffer =
    Buffer.concat([
      client.buffer,
      incoming
    ]);

  while (
    client.buffer.length >= 2
  ) {
    const first = client.buffer[0];
    const second = client.buffer[1];

    const fin =
      (first & 0x80) !== 0;

    const opcode =
      first & 0x0f;

    const masked =
      (second & 0x80) !== 0;

    let length =
      second & 0x7f;

    let offset = 2;

    if (length === 126) {
      if (client.buffer.length < 4) {
        return;
      }

      length =
        client.buffer.readUInt16BE(2);

      offset = 4;
    } else if (length === 127) {
      if (client.buffer.length < 10) {
        return;
      }

      const long =
        client.buffer.readBigUInt64BE(2);

      if (
        long >
        BigInt(Number.MAX_SAFE_INTEGER)
      ) {
        client.socket.destroy();
        return;
      }

      length = Number(long);
      offset = 10;
    }

    if (!masked) {
      client.socket.destroy();
      return;
    }

    const needed =
      offset +
      4 +
      length;

    if (
      client.buffer.length <
      needed
    ) {
      return;
    }

    const mask =
      client.buffer.subarray(
        offset,
        offset + 4
      );

    const payloadStart =
      offset + 4;

    const payload =
      Buffer.from(
        client.buffer.subarray(
          payloadStart,
          payloadStart + length
        )
      );

    for (
      let i = 0;
      i < payload.length;
      i++
    ) {
      payload[i] ^=
        mask[i % 4];
    }

    client.buffer =
      client.buffer.subarray(needed);

    if (!fin) {
      client.socket.destroy();
      return;
    }

    if (opcode === 0x8) {
      try {
        client.socket.write(
          encodeControlFrame(
            0x8,
            payload
          )
        );
      } catch {}

      client.socket.end();
      disconnectClient(client);
      return;
    }

    if (opcode === 0x9) {
      try {
        client.socket.write(
          encodeControlFrame(
            0xA,
            payload
          )
        );
      } catch {}

      continue;
    }

    if (opcode !== 0x1) {
      continue;
    }

    let message;

    try {
      message =
        JSON.parse(
          payload.toString('utf8')
        );
    } catch {
      continue;
    }

    handleMessage(
      client,
      message
    );
  }
}

function handleMessage(
  client,
  message
) {
  if (
    !message ||
    typeof message !== 'object'
  ) return;

  if (
    message.type === 'input' &&
    (
      client.side === 'left' ||
      client.side === 'right'
    )
  ) {
    physics.setInput(
      client.side,
      Number(message.x),
      Number(message.y)
    );

    return;
  }

  if (message.type === 'ping') {
    send(
      client,
      {
        type: 'pong',
        clientNow:
          Number(message.clientNow) || 0,
        serverNow:
          Number(process.hrtime.bigint()) /
          1e6
      }
    );

    return;
  }

  if (
    message.type === 'reset' &&
    (
      client.side === 'left' ||
      client.side === 'right'
    )
  ) {
    physics.resetMatch();
    updatePlaying();
    broadcastState();
  }
}

server.on(
  'upgrade',
  (req, socket) => {
    const key =
      req.headers[
        'sec-websocket-key'
      ];

    const upgrade =
      String(
        req.headers.upgrade || ''
      ).toLowerCase();

    if (
      !key ||
      upgrade !== 'websocket'
    ) {
      socket.destroy();
      return;
    }

    const response = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey(key)}`,
      '',
      ''
    ].join('\r\n');

    socket.write(response);

    const id =
      nextClientId++;

    const side =
      availableSide();

    const client = {
      id,
      side,
      socket,
      buffer:
        Buffer.alloc(0),
      closed: false
    };

    clients.set(
      id,
      client
    );

    if (side === 'left') {
      slots.left = id;
    } else if (side === 'right') {
      slots.right = id;
    }

    socket.setNoDelay(true);

    socket.on(
      'data',
      chunk =>
        decodeFrames(
          client,
          chunk
        )
    );

    socket.on(
      'close',
      () =>
        disconnectClient(client)
    );

    socket.on(
      'error',
      () =>
        disconnectClient(client)
    );

    send(
      client,
      {
        type: 'welcome',
        id,
        side,
        constants: C,
        snapshot:
          physics.snapshot()
      }
    );

    updatePlaying();
    broadcastRoster();
    broadcastState();

    console.log(
      `[connect] #${id} ${side}`
    );
  }
);

/*
 * Server authoritative simulation.
 * Accumulator real-time -> fixed 240 Hz.
 */
let previousNs =
  process.hrtime.bigint();

let accumulator = 0;

const FIXED =
  C.FIXED_DT;

setInterval(() => {
  const nowNs =
    process.hrtime.bigint();

  let frame =
    Number(
      nowNs - previousNs
    ) / 1e9;

  previousNs = nowNs;

  frame =
    Math.min(
      0.05,
      Math.max(
        0,
        frame
      )
    );

  accumulator += frame;

  while (
    accumulator >= FIXED
  ) {
    physics.step(FIXED);
    accumulator -= FIXED;
  }
}, 1);

/*
 * 120 snapshots/s en local.
 * El objetivo ahora es evaluar sensación de juego,
 * no optimizar ancho de banda.
 */
setInterval(
  broadcastState,
  1000 / 120
);

server.listen(
  PORT,
  HOST,
  () => {
    console.log('');
    console.log(
      '========================================'
    );
    console.log(
      ' AIR HOCKEY STANDALONE V2 MULTIPLAYER'
    );
    console.log(
      '========================================'
    );
    console.log('');
    console.log(
      `Juego: http://${HOST}:${PORT}/`
    );
    console.log(
      'Abre DOS pestañas/navegadores.'
    );
    console.log(
      'Primer jugador = azul / izquierda.'
    );
    console.log(
      'Segundo jugador = rojo / derecha.'
    );
    console.log('');
    console.log(
      'Física: servidor Node a 240 Hz.'
    );
    console.log(
      'Snapshots: 120 Hz.'
    );
    console.log(
      'Sin Habbo / Nitro / Arcturus.'
    );
    console.log('');
  }
);
