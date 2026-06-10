#!/usr/bin/env node
const express  = require('express');
const http     = require('http');
const { Server } = require('socket.io');
const path     = require('path');
const crypto   = require('crypto');
const fs       = require('fs');

const app    = express();
const server = http.createServer(app);
const io     = new Server(server, { maxHttpBufferSize: 8e6, cors: { origin: '*' } });
const PORT   = process.env.PORT || 5500;
const DATA   = path.join(__dirname, 'data.json');

// ── Persistence ───────────────────────────────────────────────────────────────
let db = { users: {}, rooms: {} };
try { db = JSON.parse(fs.readFileSync(DATA, 'utf8')); } catch {}
function save() { try { fs.writeFileSync(DATA, JSON.stringify(db)); } catch {} }

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function genCode(map) {
  let c;
  do { c = Array.from({ length: 6 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join(''); }
  while (map[c]);
  return c;
}

// ── REST ──────────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Register or recover account
app.post('/api/register', (req, res) => {
  const { name, code } = req.body;
  if (code && db.users[code]) return res.json(db.users[code]);
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const u = {
    name:   name.trim(),
    code:   genCode(db.users),
    avatar: name.trim()[0].toUpperCase(),
    createdAt: Date.now(),
  };
  db.users[u.code] = u;
  save();
  res.json(u);
});

// Look up a user or room by code (for the add UI)
app.get('/api/lookup/:code', (req, res) => {
  const c = req.params.code.toUpperCase();
  if (db.users[c])  return res.json({ type: 'user',  ...db.users[c] });
  if (db.rooms[c])  return res.json({ type: 'room',  ...db.rooms[c], memberCount: db.rooms[c].members.length });
  res.status(404).json({ error: 'Not found' });
});

// ── Socket.io ─────────────────────────────────────────────────────────────────
const online = {}; // userCode → socketId

io.on('connection', (sock) => {
  let me   = null;     // current user object
  const myRooms = new Set();

  // ── Auth ─────────────────────────────────────────────────────────────────────
  sock.on('auth', ({ code }) => {
    const user = db.users[code];
    if (!user) return sock.emit('error', 'Unknown code — please re-register');
    me = user;
    online[code] = sock.id;

    // Rejoin all persisted rooms
    for (const [rc, room] of Object.entries(db.rooms)) {
      if (room.members.includes(code)) {
        sock.join(rc);
        myRooms.add(rc);
      }
    }

    const myRoomList = [...myRooms].map(rc => {
      const r = db.rooms[rc];
      const memberDetails = r.members.map(c => db.users[c]).filter(Boolean);
      return { ...r, messages: r.messages.slice(-60), memberDetails };
    });

    sock.emit('authed', { user, rooms: myRoomList });

    // Broadcast online status
    for (const rc of myRooms) sock.to(rc).emit('presence', { code, online: true });
  });

  // ── Join / create room ───────────────────────────────────────────────────────
  sock.on('join', ({ code: target, roomName, create }) => {
    if (!me) return;
    target = (target || '').trim().toUpperCase();

    const emitJoined = (room) => {
      sock.join(room.code);
      myRooms.add(room.code);
      const memberDetails = room.members.map(c => db.users[c]).filter(Boolean);
      sock.emit('room-joined', { ...room, messages: room.messages.slice(-60), memberDetails });
    };

    // DM: target is another user's code
    if (target && db.users[target] && target !== me.code) {
      const dmCode = [me.code, target].sort().join('_');
      if (!db.rooms[dmCode]) {
        db.rooms[dmCode] = { code: dmCode, type: 'dm', members: [me.code, target], messages: [] };
        save();
      }
      const room = db.rooms[dmCode];
      if (!room.members.includes(me.code)) { room.members.push(me.code); save(); }
      emitJoined(room);
      // Notify the other user if they're online
      const otherSock = online[target];
      if (otherSock) {
        const memberDetails = room.members.map(c => db.users[c]).filter(Boolean);
        io.to(otherSock).emit('room-joined', { ...room, messages: room.messages.slice(-60), memberDetails });
        io.to(otherSock).sockets?.get?.(otherSock)?.join(dmCode);
      }
      return;
    }

    // Join existing group room
    if (target && db.rooms[target]) {
      const room = db.rooms[target];
      if (!room.members.includes(me.code)) { room.members.push(me.code); save(); }
      emitJoined(room);
      const sys = sysMsg(room.code, `${me.name} joined the room`);
      room.messages.push(sys);
      save();
      sock.to(room.code).emit('sys', { roomCode: room.code, msg: sys });
      return;
    }

    // Create new group room
    if (create) {
      const rc = genCode(db.rooms);
      const room = { code: rc, type: 'group', name: (roomName || 'New Room').trim(), members: [me.code], messages: [] };
      db.rooms[rc] = room;
      save();
      emitJoined(room);
      return;
    }

    sock.emit('join-error', target ? `"${target}" not found — check the code` : 'Enter a code or create a room');
  });

  // ── Messages ─────────────────────────────────────────────────────────────────
  sock.on('msg', ({ roomCode, text }) => {
    if (!me || !text?.trim()) return;
    const room = db.rooms[roomCode];
    if (!room?.members.includes(me.code)) return;
    const m = { id: crypto.randomUUID(), type: 'text', from: me.code, name: me.name, avatar: me.avatar, text: text.trim(), at: Date.now() };
    pushMsg(room, m);
    io.to(roomCode).emit('msg', { roomCode, msg: m });
  });

  sock.on('voice', ({ roomCode, audio, mimeType, duration }) => {
    if (!me || !audio) return;
    const room = db.rooms[roomCode];
    if (!room?.members.includes(me.code)) return;
    const m = { id: crypto.randomUUID(), type: 'voice', from: me.code, name: me.name, avatar: me.avatar, audio, mimeType: mimeType || 'audio/webm', duration: duration || 0, at: Date.now() };
    pushMsg(room, m);
    io.to(roomCode).emit('msg', { roomCode, msg: m });
  });

  sock.on('typing', ({ roomCode, on }) => {
    if (!me) return;
    sock.to(roomCode).emit('typing', { code: me.code, name: me.name, on });
  });

  sock.on('ptt-start', ({ roomCode }) => {
    if (!me) return;
    sock.to(roomCode).emit('ptt-start', { code: me.code, name: me.name, roomCode });
  });

  sock.on('ptt-end', ({ roomCode }) => {
    if (!me) return;
    sock.to(roomCode).emit('ptt-end', { code: me.code, roomCode });
  });

  sock.on('disconnect', () => {
    if (!me) return;
    delete online[me.code];
    for (const rc of myRooms) sock.to(rc).emit('presence', { code: me.code, online: false });
  });
});

function pushMsg(room, m) {
  room.messages.push(m);
  if (room.messages.length > 400) room.messages = room.messages.slice(-400);
  save();
}

function sysMsg(roomCode, text) {
  return { id: crypto.randomUUID(), type: 'sys', text, at: Date.now() };
}

server.listen(PORT, () => console.log(`\n🌊 MCF WAVE running → http://localhost:${PORT}\n`));
