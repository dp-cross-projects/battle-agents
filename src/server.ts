import express from 'express';
import path from 'path';
import http from 'http';
import { Server } from 'socket.io';
import { prisma } from './db.js';
import { hashPassword, verifyPassword, generateToken, verifyToken } from './utils/auth.js';
import { dbAgentToBattleAgent } from './utils/mappers.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { CharacterCreator } from './core/CharacterCreator.js';
import { CombatEngine } from './core/CombatEngine.js';
import { CONFIG } from './config.js';
import { BattleAgent, MapScenario } from './types/index.js';

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Initialize LLM provider
let provider: any = null;
try {
  if (CONFIG.PROVIDER === 'ollama') {
    provider = new OllamaProvider(CONFIG.OLLAMA_ENDPOINT, CONFIG.OLLAMA_MODEL);
    console.log(`[API] OllamaProvider configurado en ${CONFIG.OLLAMA_ENDPOINT} con modelo ${CONFIG.OLLAMA_MODEL}`);
  } else {
    provider = new GeminiProvider(CONFIG.GEMINI_API_KEY, CONFIG.GEMINI_MODEL);
    console.log(`[API] GeminiProvider configurado con modelo ${CONFIG.GEMINI_MODEL}`);
  }
} catch (error: any) {
  console.error('[API Error] Falló la configuración del proveedor de IA:', error.message);
}

const creator = provider ? new CharacterCreator(provider) : null;
const engine = provider ? new CombatEngine(provider) : null;

// Middleware to authenticate REST requests
const authenticateToken = (req: any, res: any, next: any) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Falta token de autenticación.' });
  }
  const verified = verifyToken(token);
  if (!verified) {
    return res.status(403).json({ error: 'Token inválido o expirado.' });
  }
  req.userId = verified.userId;
  next();
};

// ==========================================
// REST API: AUTHENTICATION
// ==========================================

app.post('/api/auth/register', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nombre de usuario y contraseña requeridos.' });
  }
  try {
    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      return res.status(400).json({ error: 'El nombre de usuario ya está registrado.' });
    }
    const hashedPassword = hashPassword(password);
    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
      },
    });
    const token = generateToken({ userId: user.id });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error en el servidor.' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Nombre de usuario y contraseña requeridos.' });
  }
  try {
    const user = await prisma.user.findUnique({ where: { username } });
    if (!user || !verifyPassword(password, user.password)) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }
    const token = generateToken({ userId: user.id });
    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Error en el servidor.' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req: any, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, username: true },
    });
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado.' });
    }
    res.json(user);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al recuperar perfil.' });
  }
});

// ==========================================
// REST API: CHARACTERS (AGENTS)
// ==========================================

app.get('/api/character/list', authenticateToken, async (req: any, res) => {
  try {
    const dbAgents = await prisma.agent.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    const agents = dbAgents.map(dbAgentToBattleAgent);
    res.json(agents);
  } catch (error: any) {
    res.status(500).json({ error: 'Error al obtener los agentes.' });
  }
});

app.post('/api/character/create', authenticateToken, async (req: any, res) => {
  if (!creator) {
    return res.status(500).json({ error: 'El creador de personajes no está configurado.' });
  }
  try {
    const { prompt, name, gender } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Falta el prompt de descripción del agente.' });
    }
    if (gender && gender !== 'hombre' && gender !== 'mujer') {
      return res.status(400).json({ error: 'El género debe ser "hombre" o "mujer".' });
    }

    console.log(`[API] Generando agente para usuario ${req.userId} bajo concepto: "${prompt}"`);
    const agent = await creator.createCharacter(prompt, name || undefined, gender || undefined);

    // Save in DB
    const dbAgent = await prisma.agent.create({
      data: {
        name: agent.name,
        gender: agent.gender,
        archetype: agent.archetype,
        strength: agent.stats.strength,
        agility: agent.stats.agility,
        perception: agent.stats.perception,
        resilience: agent.stats.resilience,
        intelligence: agent.stats.intelligence,
        maxHp: agent.maxHp,
        confidence: agent.confidence,
        uniqueAbilityName: agent.uniqueAbility.name,
        uniqueAbilityDesc: agent.uniqueAbility.description,
        personalityDescription: agent.personalityDescription,
        userId: req.userId,
      },
    });

    res.json(dbAgentToBattleAgent(dbAgent));
  } catch (error: any) {
    console.error('[API Error] Falló la creación de personaje:', error);
    res.status(500).json({ error: error.message || 'Error al generar el agente.' });
  }
});

// ==========================================
// REST API: OFFLINE COMBAT (VS CPU)
// ==========================================

interface CPUCombatSession {
  userId: string;
  dbPlayerAgentId: string;
  playerAgent: BattleAgent;
  cpuAgent: BattleAgent;
  map: MapScenario;
  round: number;
  mathLogs: string[];
  narratives: string[];
}

let activeCPUSessions: Record<string, CPUCombatSession> = {};

app.get('/api/maps', (req, res) => {
  res.json(CombatEngine.MAPS);
});

app.post('/api/combat/start', authenticateToken, async (req: any, res) => {
  const { playerAgentId, mapName } = req.body;
  if (!playerAgentId || !mapName) {
    return res.status(400).json({ error: 'Faltan parámetros para iniciar el combate.' });
  }

  try {
    const dbAgent = await prisma.agent.findFirst({
      where: { id: playerAgentId, userId: req.userId },
    });
    if (!dbAgent) {
      return res.status(404).json({ error: 'El agente seleccionado no existe o no te pertenece.' });
    }

    const playerAgent = dbAgentToBattleAgent(dbAgent);
    const map = CombatEngine.MAPS.find(m => m.name === mapName);
    if (!map) {
      return res.status(400).json({ error: 'El mapa seleccionado no es válido.' });
    }

    // Auto-generate enemy CPU character
    if (!creator) {
      return res.status(500).json({ error: 'El generador de personajes no está disponible.' });
    }
    const cpuPrompts = [
      'Un robot pesado defensivo con escudos de chatarra.',
      'Un francotirador cibernético con visión térmica.',
      'Un androide médico dañado que usa toxinas de ácido.'
    ];
    const cpuPrompt = cpuPrompts[Math.floor(Math.random() * cpuPrompts.length)];
    const cpuAgent = await creator.createCharacter(cpuPrompt);

    activeCPUSessions[req.userId] = {
      userId: req.userId,
      dbPlayerAgentId: playerAgentId,
      playerAgent,
      cpuAgent,
      map,
      round: 1,
      mathLogs: [],
      narratives: [`Combate iniciado en el escenario: ${map.name}. ${map.impactDescription}`]
    };

    console.log(`[API CPU] Combate iniciado para usuario ${req.userId}: ${playerAgent.name} vs CPU ${cpuAgent.name} en ${mapName}`);
    res.json({ success: true, playerAgent, cpuAgent, map });
  } catch (error: any) {
    console.error('[API Error] Falló el inicio de combate CPU:', error);
    res.status(500).json({ error: error.message || 'Error al iniciar combate.' });
  }
});

app.post('/api/combat/round', authenticateToken, async (req: any, res) => {
  const session = activeCPUSessions[req.userId];
  if (!session || !engine) {
    return res.status(400).json({ error: 'No hay combate CPU activo o el motor no está configurado.' });
  }

  const { actionPrompt } = req.body;
  if (!actionPrompt) {
    return res.status(400).json({ error: 'Falta la acción del jugador.' });
  }

  try {
    const cpuPrompt = await engine.generateCPUPrompt(session.cpuAgent, session.playerAgent);

    const playerPanic = session.playerAgent.confidence < 30 && Math.random() < 0.15;
    const cpuPanic = session.cpuAgent.confidence < 30 && Math.random() < 0.15;

    const actionA = await engine.filterAgentAction(session.playerAgent, actionPrompt, session.map, playerPanic);
    const actionB = await engine.filterAgentAction(session.cpuAgent, cpuPrompt, session.map, cpuPanic);

    const roundResult = engine.resolveCombatTurn(session.playerAgent, actionA, session.cpuAgent, actionB, session.map);
    const narrative = await engine.generateNarrative(session.playerAgent, session.cpuAgent, roundResult, session.map);
    roundResult.narrative = narrative;

    session.mathLogs.push(...roundResult.mathLog, '---');
    session.narratives.push(narrative);

    let finished = false;
    let winner = '';

    if (session.playerAgent.currentHp <= 0 && session.cpuAgent.currentHp <= 0) {
      finished = true;
      winner = 'empate';
    } else if (session.playerAgent.currentHp <= 0) {
      finished = true;
      winner = 'cpu';
    } else if (session.cpuAgent.currentHp <= 0) {
      finished = true;
      winner = 'player';
    }

    session.round++;

    if (finished) {
      // 1. Update persistent agent confidence in DB
      const pConf = Math.max(0, Math.min(100, Math.round(Number(session.playerAgent.confidence))));
      await prisma.agent.update({
        where: { id: session.dbPlayerAgentId },
        data: { confidence: isNaN(pConf) ? 50 : pConf },
      });

      // 2. Save combat in history
      // (CPU is treated as dummy user or we can match player2Id to a mock/null ID)
      // Since schema enforces User relationship, we will relate player2 to player1 itself or create a system user.
      // Alternatively, we can let player2Id = player1Id for CPU combat, representing solo practice.
      await prisma.combat.create({
        data: {
          mapName: session.map.name,
          roundsCount: session.round - 1,
          mathLog: session.mathLogs.join('\n'),
          player1Id: session.userId,
          agent1Id: session.dbPlayerAgentId,
          player2Id: session.userId, // Practice mode uses same user as player2
          agent2Id: session.dbPlayerAgentId, // dummy reference
          winnerId: winner === 'player' ? session.userId : null,
        },
      });

      // Clean session
      delete activeCPUSessions[req.userId];
    }

    res.json({
      roundResult,
      playerAgent: session.playerAgent,
      cpuAgent: session.cpuAgent,
      finished,
      winner
    });
  } catch (error: any) {
    console.error('[API Error] Falló la ronda CPU:', error);
    res.status(500).json({ error: error.message || 'Error en la resolución del turno.' });
  }
});

// ==========================================
// SERVE STATIC CLIENT
// ==========================================

const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }
  next();
});

// Create HTTP server
const server = http.createServer(app);

// ==========================================
// WEBSOCKETS & MATCHMAKING 1v1 (SOCKET.IO)
// ==========================================

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

interface QueuedPlayer {
  userId: string;
  socketId: string;
  agentId: string;
}

interface PvPCombatSession {
  id: string;
  map: MapScenario;
  round: number;
  p1: {
    userId: string;
    socketId: string;
    dbAgentId: string;
    agent: BattleAgent;
    action: string | null;
  };
  p2: {
    userId: string;
    socketId: string;
    dbAgentId: string;
    agent: BattleAgent;
    action: string | null;
  };
  mathLogs: string[];
  narratives: string[];
}

let matchmakingQueue: QueuedPlayer[] = [];
let activePvPCombats = new Map<string, PvPCombatSession>();

// Authentication middleware for Sockets
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) {
    return next(new Error('Autenticación requerida'));
  }
  const verified = verifyToken(token);
  if (!verified) {
    return next(new Error('Token inválido o expirado'));
  }
  (socket as any).userId = verified.userId;
  next();
});

io.on('connection', (socket) => {
  const userId = (socket as any).userId;
  console.log(`[Socket] Conectado usuario: ${userId} (Socket ID: ${socket.id})`);

  socket.on('join_queue', async ({ agentId }) => {
    try {
      if (!agentId) {
        return socket.emit('error_msg', 'ID del agente no provisto.');
      }

      // Check if agent exists and belongs to user
      const dbAgent = await prisma.agent.findFirst({
        where: { id: agentId, userId },
      });
      if (!dbAgent) {
        return socket.emit('error_msg', 'El agente no existe o no te pertenece.');
      }

      // Avoid duplicates in queue
      matchmakingQueue = matchmakingQueue.filter(p => p.userId !== userId);
      matchmakingQueue.push({ userId, socketId: socket.id, agentId });

      socket.emit('queue_status', { status: 'waiting' });
      console.log(`[Matchmaking] Usuario ${userId} en cola con agente ${dbAgent.name}. Cola: ${matchmakingQueue.length}`);

      // Attempt matching
      checkAndMatchPlayers();
    } catch (err: any) {
      socket.emit('error_msg', 'Error al unirse a la cola.');
    }
  });

  socket.on('leave_queue', () => {
    matchmakingQueue = matchmakingQueue.filter(p => p.userId !== userId);
    socket.emit('queue_status', { status: 'idle' });
    console.log(`[Matchmaking] Usuario ${userId} abandonó la cola.`);
  });

  socket.on('submit_action', async ({ combatId, actionPrompt }) => {
    const combat = activePvPCombats.get(combatId);
    if (!combat) {
      return socket.emit('error_msg', 'El combate no existe o ya ha terminado.');
    }

    if (!actionPrompt || !actionPrompt.trim()) {
      return socket.emit('error_msg', 'La acción no puede estar vacía.');
    }

    const isP1 = combat.p1.userId === userId;
    const isP2 = combat.p2.userId === userId;

    if (!isP1 && !isP2) {
      return socket.emit('error_msg', 'No participas en este combate.');
    }

    if (isP1) {
      combat.p1.action = actionPrompt;
    } else {
      combat.p2.action = actionPrompt;
    }

    // Inform other player that action was submitted (for UI "ready" indicator)
    const roomName = `room-${combatId}`;
    io.to(roomName).emit('player_ready_status', {
      p1Ready: combat.p1.action !== null,
      p2Ready: combat.p2.action !== null,
    });

    console.log(`[PvP] Acción recibida de ${isP1 ? 'P1' : 'P2'} en combate ${combatId}`);

    // If both actions submitted, resolve round
    if (combat.p1.action && combat.p2.action) {
      await resolvePvPRound(combat);
    }
  });

  socket.on('send_chat', ({ combatId, text }) => {
    const combat = activePvPCombats.get(combatId);
    if (!combat) return;

    const isP1 = combat.p1.userId === userId;
    const senderName = isP1 ? combat.p1.agent.name : combat.p2.agent.name;

    const roomName = `room-${combatId}`;
    io.to(roomName).emit('chat_message', {
      senderName,
      text,
      timestamp: Date.now(),
    });
  });

  socket.on('disconnect', () => {
    console.log(`[Socket] Desconectado usuario: ${userId}`);
    matchmakingQueue = matchmakingQueue.filter(p => p.socketId !== socket.id);

    // Check if user was in an active PvP combat
    for (const [combatId, combat] of activePvPCombats.entries()) {
      if (combat.p1.socketId === socket.id || combat.p2.socketId === socket.id) {
        const roomName = `room-${combatId}`;
        io.to(roomName).emit('opponent_disconnected', { userId });
        activePvPCombats.delete(combatId);
        console.log(`[PvP] Combate cancelado ${combatId} por desconexión.`);
        break;
      }
    }
  });
});

async function checkAndMatchPlayers() {
  if (matchmakingQueue.length < 2) return;

  const player1Info = matchmakingQueue.shift()!;
  const player2Info = matchmakingQueue.shift()!;

  const p1Socket = io.sockets.sockets.get(player1Info.socketId);
  const p2Socket = io.sockets.sockets.get(player2Info.socketId);

  if (!p1Socket || !p2Socket) {
    // Put back the valid one
    if (p1Socket) matchmakingQueue.unshift(player1Info);
    if (p2Socket) matchmakingQueue.unshift(player2Info);
    return;
  }

  try {
    const dbAgent1 = await prisma.agent.findUnique({ where: { id: player1Info.agentId } });
    const dbAgent2 = await prisma.agent.findUnique({ where: { id: player2Info.agentId } });

    if (!dbAgent1 || !dbAgent2) {
      if (p1Socket) p1Socket.emit('error_msg', 'Error al recuperar ficha del agente.');
      if (p2Socket) p2Socket.emit('error_msg', 'Error al recuperar ficha del agente.');
      return;
    }

    const agent1 = dbAgentToBattleAgent(dbAgent1);
    const agent2 = dbAgentToBattleAgent(dbAgent2);

    const combatId = Math.random().toString(36).substring(2, 15);
    const map = CombatEngine.MAPS[Math.floor(Math.random() * CombatEngine.MAPS.length)];

    const session: PvPCombatSession = {
      id: combatId,
      map,
      round: 1,
      p1: {
        userId: player1Info.userId,
        socketId: player1Info.socketId,
        dbAgentId: player1Info.agentId,
        agent: agent1,
        action: null,
      },
      p2: {
        userId: player2Info.userId,
        socketId: player2Info.socketId,
        dbAgentId: player2Info.agentId,
        agent: agent2,
        action: null,
      },
      mathLogs: [],
      narratives: [`Combate iniciado en el escenario: ${map.name}. ${map.impactDescription}`],
    };

    activePvPCombats.set(combatId, session);

    // Join room
    p1Socket.join(`room-${combatId}`);
    p2Socket.join(`room-${combatId}`);

    // Emit match_found
    io.to(`room-${combatId}`).emit('match_found', {
      combatId,
      map,
      p1: { userId: session.p1.userId, agent: agent1 },
      p2: { userId: session.p2.userId, agent: agent2 },
    });

    console.log(`[Matchmaking] PvP Match Creado: ${agent1.name} vs ${agent2.name} en ${map.name}`);
  } catch (error) {
    console.error('[Matchmaking Error] Falló el emparejamiento:', error);
  }
}

async function resolvePvPRound(combat: PvPCombatSession) {
  if (!engine) return;

  const roomName = `room-${combat.id}`;

  try {
    const player1Panic = combat.p1.agent.confidence < 30 && Math.random() < 0.15;
    const player2Panic = combat.p2.agent.confidence < 30 && Math.random() < 0.15;

    // Filter both actions
    const actionA = await engine.filterAgentAction(combat.p1.agent, combat.p1.action!, combat.map, player1Panic);
    const actionB = await engine.filterAgentAction(combat.p2.agent, combat.p2.action!, combat.map, player2Panic);

    // Resolve mechanics
    const roundResult = engine.resolveCombatTurn(combat.p1.agent, actionA, combat.p2.agent, actionB, combat.map);

    // Generate narrative
    const narrative = await engine.generateNarrative(combat.p1.agent, combat.p2.agent, roundResult, combat.map);
    roundResult.narrative = narrative;

    combat.mathLogs.push(...roundResult.mathLog, '---');
    combat.narratives.push(narrative);

    // Reset actions
    combat.p1.action = null;
    combat.p2.action = null;

    let finished = false;
    let winnerId: string | null = null;
    let winnerKey: 'p1' | 'p2' | 'empate' = 'empate';

    if (combat.p1.agent.currentHp <= 0 && combat.p2.agent.currentHp <= 0) {
      finished = true;
      winnerKey = 'empate';
    } else if (combat.p1.agent.currentHp <= 0) {
      finished = true;
      winnerId = combat.p2.userId;
      winnerKey = 'p2';
    } else if (combat.p2.agent.currentHp <= 0) {
      finished = true;
      winnerId = combat.p1.userId;
      winnerKey = 'p1';
    }

    combat.round++;

    if (finished) {
      // Save stats to DB
      // 1. Update Persistent agent confidence
      const p1Conf = Math.max(0, Math.min(100, Math.round(Number(combat.p1.agent.confidence))));
      const p2Conf = Math.max(0, Math.min(100, Math.round(Number(combat.p2.agent.confidence))));

      await prisma.agent.update({
        where: { id: combat.p1.dbAgentId },
        data: { confidence: isNaN(p1Conf) ? 50 : p1Conf },
      });
      await prisma.agent.update({
        where: { id: combat.p2.dbAgentId },
        data: { confidence: isNaN(p2Conf) ? 50 : p2Conf },
      });

      // 2. Save combat in DB
      await prisma.combat.create({
        data: {
          mapName: combat.map.name,
          roundsCount: combat.round - 1,
          mathLog: combat.mathLogs.join('\n'),
          player1Id: combat.p1.userId,
          agent1Id: combat.p1.dbAgentId,
          player2Id: combat.p2.userId,
          agent2Id: combat.p2.dbAgentId,
          winnerId,
        },
      });

      // Clean combat session
      activePvPCombats.delete(combat.id);
    }

    // Broadcast result
    io.to(roomName).emit('round_result', {
      roundResult,
      p1Agent: combat.p1.agent,
      p2Agent: combat.p2.agent,
      finished,
      winnerKey,
      winnerId,
    });
  } catch (error: any) {
    console.error('[PvP Error] Falló al resolver turno PvP:', error);
    io.to(roomName).emit('error_msg', 'Ocurrió un error al procesar el turno del combate.');
  }
}

// Start Server
server.listen(PORT, () => {
  console.log(`[API] Servidor Express + Socket.io corriendo en http://localhost:${PORT}`);
});
