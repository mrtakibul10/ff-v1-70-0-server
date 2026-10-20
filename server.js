const express = require("express");
const http = require("http");
const crypto = require("crypto");
const WebSocket = require("ws");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "32kb" }));

const users = new Map();
const sessions = new Map();
const onlinePlayers = new Map();

const outfits = [
  { id: "outfit_001", name: "Default Outfit", owned: true },
  { id: "outfit_002", name: "Demo Outfit", owned: false }
];

function createToken() {
  return crypto.randomBytes(32).toString("hex");
}

function getUser(req) {
  const header = req.headers.authorization || "";

  if (!header.startsWith("Bearer ")) {
    return null;
  }

  const token = header.slice(7);
  const uid = sessions.get(token);

  return uid ? users.get(uid) || null : null;
}

function auth(req, res, next) {
  const user = getUser(req);

  if (!user) {
    return res.status(401).json({
      success: false,
      message: "Authentication required"
    });
  }

  req.user = user;
  next();
}

// Health Check
app.get("/health", (req, res) => {
  res.json({
    success: true,
    status: "online",
    server: "FF Demo Server",
    timestamp: new Date().toISOString()
  });
});

// Server information
app.get("/api", (req, res) => {
  res.json({
    success: true,
    endpoints: [
      "POST /api/guest",
      "GET /api/profile",
      "GET /api/outfits",
      "POST /api/outfits/equip",
      "GET /api/friends/online",
      "GET /api/events"
    ]
  });
});

// Demo account
app.post("/api/guest", (req, res) => {
  const uid = crypto.randomUUID();

  const user = {
    uid,
    nickname:
      typeof req.body.nickname === "string"
        ? req.body.nickname.slice(0, 24)
        : "Guest",
    level: 1,
    exp: 0,
    gold: 0,
    diamonds: 0,
    equippedOutfit: "outfit_001"
  };

  const token = createToken();

  users.set(uid, user);
  sessions.set(token, uid);

  res.status(201).json({
    success: true,
    token,
    profile: user,
    note: "Demo account only"
  });
});

// Profile
app.get("/api/profile", auth, (req, res) => {
  res.json({
    success: true,
    profile: req.user
  });
});

// Outfit list
app.get("/api/outfits", auth, (req, res) => {
  res.json({
    success: true,
    outfits
  });
});

// Equip an owned demo outfit
app.post("/api/outfits/equip", auth, (req, res) => {
  const { outfitId } = req.body || {};
  const outfit = outfits.find(item => item.id === outfitId);

  if (!outfit || !outfit.owned) {
    return res.status(400).json({
      success: false,
      message: "Outfit unavailable in this demo"
    });
  }

  req.user.equippedOutfit = outfit.id;

  res.json({
    success: true,
    profile: req.user
  });
});

// Online friends / players demo
app.get("/api/friends/online", auth, (req, res) => {
  res.json({
    success: true,
    players: [...onlinePlayers.values()]
  });
});

// Demo events
app.get("/api/events", (req, res) => {
  res.json({
    success: true,
    events: [
      {
        id: "demo_event_01",
        title: "Welcome Event",
        status: "demo",
        reward: "Demo reward"
      }
    ]
  });
});

// WebSocket: demo real-time presence
wss.on("connection", (socket, request) => {
  const url = new URL(
    request.url,
    `http://${request.headers.host || "localhost"}`
  );

  const token = url.searchParams.get("token");
  const uid = token ? sessions.get(token) : null;
  const user = uid ? users.get(uid) : null;

  if (!user) {
    socket.close(1008, "Valid demo token required");
    return;
  }

  onlinePlayers.set(uid, {
    uid: user.uid,
    nickname: user.nickname,
    connectedAt: new Date().toISOString()
  });

  socket.send(JSON.stringify({
    type: "connected",
    message: "Demo real-time connection established"
  }));

  socket.on("close", () => {
    onlinePlayers.delete(uid);
  });

  socket.on("message", raw => {
    let message;

    try {
      message = JSON.parse(raw.toString());
    } catch {
      socket.send(JSON.stringify({
        type: "error",
        message: "Invalid JSON"
      }));
      return;
    }

    if (message.type === "ping") {
      socket.send(JSON.stringify({
        type: "pong",
        timestamp: Date.now()
      }));
    }
  });
});

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Endpoint not found"
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Demo server running on port ${PORT}`);
});