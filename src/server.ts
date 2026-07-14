import express from 'express';
import path from 'path';
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
let provider;
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

// Session State in memory
interface CombatSession {
  playerAgent: BattleAgent;
  cpuAgent: BattleAgent;
  map: MapScenario;
  round: number;
}

let activeSession: CombatSession | null = null;

// API REST Routes
app.get('/api/maps', (req, res) => {
  res.json(CombatEngine.MAPS);
});

app.post('/api/character/create', async (req, res) => {
  if (!creator) {
    return res.status(500).json({ error: 'El creador de personajes no está configurado por falta de proveedor de IA.' });
  }
  try {
    const { prompt, name, gender } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'Falta el prompt de descripción del agente.' });
    }
    if (gender && gender !== 'hombre' && gender !== 'mujer') {
      return res.status(400).json({ error: 'El género debe ser "hombre" o "mujer".' });
    }
    console.log(`[API] Generando agente bajo concepto: "${prompt}" (Nombre: ${name || 'Aleatorio'}, Género: ${gender || 'Aleatorio'})`);
    const agent = await creator.createCharacter(prompt, name || undefined, gender || undefined);
    res.json(agent);
  } catch (error: any) {
    console.error('[API Error] Falló la creación de personaje:', error);
    res.status(500).json({ error: error.message || 'Error al generar el agente.' });
  }
});

app.post('/api/combat/start', (req, res) => {
  const { playerAgent, cpuAgent, mapName } = req.body;
  if (!playerAgent || !cpuAgent || !mapName) {
    return res.status(400).json({ error: 'Faltan parámetros (playerAgent, cpuAgent, mapName) para iniciar.' });
  }

  const map = CombatEngine.MAPS.find(m => m.name === mapName);
  if (!map) {
    return res.status(400).json({ error: 'El mapa seleccionado no es válido.' });
  }

  activeSession = {
    playerAgent: JSON.parse(JSON.stringify(playerAgent)),
    cpuAgent: JSON.parse(JSON.stringify(cpuAgent)),
    map,
    round: 1
  };

  console.log(`[API] Combate iniciado: ${playerAgent.name} vs ${cpuAgent.name} en ${mapName}`);
  res.json({ success: true, message: 'Combate iniciado correctamente.' });
});

app.post('/api/combat/round', async (req, res) => {
  if (!activeSession || !engine) {
    return res.status(400).json({ error: 'No hay combate activo o el motor no está configurado.' });
  }

  const { actionPrompt } = req.body;
  if (!actionPrompt) {
    return res.status(400).json({ error: 'Falta el prompt de acción del jugador.' });
  }

  try {
    const session = activeSession;
    console.log(`[API] Procesando Turno ${session.round} para ${session.playerAgent.name}`);

    // 1. Generate CPU action raw prompt
    const cpuPrompt = await engine.generateCPUPrompt(session.cpuAgent, session.playerAgent);

    // 2. Check for low-confidence panic rolls (15% chance if confidence < 30)
    const playerPanic = session.playerAgent.confidence < 30 && Math.random() < 0.15;
    const cpuPanic = session.cpuAgent.confidence < 30 && Math.random() < 0.15;

    // 3. Filter actions (safety check and LLM sheet adjustments)
    const actionA = await engine.filterAgentAction(session.playerAgent, actionPrompt, session.map, playerPanic);
    const actionB = await engine.filterAgentAction(session.cpuAgent, cpuPrompt, session.map, cpuPanic);

    // 4. Resolve mathematics of the round
    const roundResult = engine.resolveCombatTurn(session.playerAgent, actionA, session.cpuAgent, actionB, session.map);

    // 5. Generate narrative description via LLM
    const narrative = await engine.generateNarrative(session.playerAgent, session.cpuAgent, roundResult, session.map);
    roundResult.narrative = narrative;

    // Check game termination conditions
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

    res.json({
      roundResult,
      playerAgent: session.playerAgent,
      cpuAgent: session.cpuAgent,
      finished,
      winner
    });
  } catch (error: any) {
    console.error('[API Error] Falló la resolución del turno:', error);
    res.status(500).json({ error: error.message || 'Error al resolver la ronda de combate.' });
  }
});

// Serve compiled static frontend
const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }
  next();
});

// Start Server
app.listen(PORT, () => {
  console.log(`[API] Servidor Express corriendo en http://localhost:${PORT}`);
});
