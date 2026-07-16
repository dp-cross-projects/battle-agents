import React, { useState, useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { io, Socket } from 'socket.io-client';
import { BattleAgent, MapScenario, CombatRoundResult } from '../../src/types/index';

// Pre-defined maps details mapping for icons/illustrations
const MAP_THEMES: Record<string, { icon: string; clr: string }> = {
  'Coliseo de Acero': { icon: '🛡️', clr: 'var(--clr-cyan)' },
  'Pantano Neblinoso': { icon: '☣️', clr: 'var(--clr-green)' },
  'Fábrica Abandonada': { icon: '⚙️', clr: 'var(--clr-purple)' },
  'Desierto Calcinante': { icon: '🏜️', clr: 'var(--clr-yellow)' },
  'Laboratorio de Gravedad Cero': { icon: '🛰️', clr: 'var(--clr-cyan)' }
};


const ARCHETYPE_LABELS: Record<string, string> = {
  'cobarde_sarcastico': 'Cobarde Sarcástico',
  'paladin_orgulloso': 'Paladín Orgulloso',
  'ansioso_inseguro': 'Ansioso Inseguro',
  'guerrero_pragmatico': 'Guerrero Pragmático'
};

interface ChatMsg {
  senderName: string;
  text: string;
  timestamp: number;
}

export default function App() {
  // Auth state
  const [token, setToken] = useState<string | null>(localStorage.getItem('ba_token'));
  const [user, setUser] = useState<{ id: string; username: string } | null>(null);
  const [usernameInput, setUsernameInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Screen flow: 'auth' | 'lobby' | 'map_selection' | 'draft' | 'matchmaking' | 'arena' | 'result'
  const [screen, setScreen] = useState<'auth' | 'lobby' | 'map_selection' | 'draft' | 'matchmaking' | 'arena' | 'result'>('auth');
  const [agents, setAgents] = useState<BattleAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<BattleAgent | null>(null);
  const [showCreator, setShowCreator] = useState(false);

  // Boosters State
  const [boosters, setBoosters] = useState<Booster[]>([]);
  const [selectedBoosters, setSelectedBoosters] = useState<string[]>([]);
  const [playerBoosters, setPlayerBoosters] = useState<Booster[]>([]);
  const [cpuBoosters, setCpuBoosters] = useState<Booster[]>([]);
  const [activeBoosterId, setActiveBoosterId] = useState<string | null>(null);
  const [opponentDraftConfirmed, setOpponentDraftConfirmed] = useState(false);
  const [draftTimer, setDraftTimer] = useState(60);

  // Game/Combat config
  const [combatMode, setCombatMode] = useState<'cpu' | 'pvp' | null>(null);
  const [pvpCombatId, setPvpCombatId] = useState<string | null>(null);
  const [maps, setMaps] = useState<MapScenario[]>([]);
  const [selectedMap, setSelectedMap] = useState<MapScenario | null>(null);


  // Combat States
  const [playerAgent, setPlayerAgent] = useState<BattleAgent | null>(null);
  const [cpuAgent, setCpuAgent] = useState<BattleAgent | null>(null); // Re-used for PvP opponent too
  const [round, setRound] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFighting, setIsFighting] = useState(false);
  const [playerActionPrompt, setPlayerActionPrompt] = useState('');
  const [narrativeHistory, setNarrativeHistory] = useState<string[]>([]);
  const [mathLogs, setMathLogs] = useState<string[]>([]);
  const [showMathLog, setShowMathLog] = useState(false);

  // Animation States
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeCpu, setShakeCpu] = useState(false);
  const [flashPlayer, setFlashPlayer] = useState(false);
  const [flashCpu, setFlashCpu] = useState(false);

  // Dialogue bubbles
  const [playerBubble, setPlayerBubble] = useState<string>('Esperando órdenes...');
  const [cpuBubble, setCpuBubble] = useState<string>('Analizando hostilidades...');

  // PvP state details
  const [p1Ready, setP1Ready] = useState(false);
  const [p2Ready, setP2Ready] = useState(false);
  const [chatLogs, setChatLogs] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [activeTab, setActiveTab] = useState<'log' | 'chat'>('log');
  const [unreadChat, setUnreadChat] = useState(false);

  // Stale closure fixes
  const [isPlayer1, setIsPlayer1] = useState(false);
  const isPlayer1Ref = useRef(false);
  const activeTabRef = useRef<'log' | 'chat'>('log');

  // Socket
  const [socket, setSocket] = useState<Socket | null>(null);

  const [winner, setWinner] = useState<'player' | 'cpu' | 'empate' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const prevPlayerHpRef = useRef<number>(100);
  const prevCpuHpRef = useRef<number>(100);

  // Fetch maps and boosters
  useEffect(() => {
    fetch('/api/maps')
      .then(res => res.json())
      .then(data => setMaps(data))
      .catch(() => {
        setMaps([
          { name: 'Coliseo de Acero', statsModifiers: {}, tags: ['cerrado', 'plano', 'iluminado'], impactDescription: 'Combate neutral y equilibrado sin alteración de atributos.' },
          { name: 'Pantano Neblinoso', statsModifiers: { agility: -10, perception: -10, resilience: 5 }, tags: ['humedad', 'niebla_densa', 'fango'], impactDescription: 'Dificulta la agilidad y la visión. El fango espeso incrementa la resistencia.' },
          { name: 'Fábrica Abandonada', statsModifiers: { intelligence: 10, strength: 5, perception: -5 }, tags: ['maquinaria', 'cobertura', 'sombras'], impactDescription: 'Mejora las tácticas tecnológicas e incrementa la fuerza con objetos de metal.' }
        ]);
      });

    fetch('/api/boosters')
      .then(res => res.json())
      .then(data => setBoosters(data))
      .catch(() => {});
  }, []);


  // Sync token / Fetch user info / Connect Socket
  useEffect(() => {
    if (token) {
      localStorage.setItem('ba_token', token);
      fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => {
          if (!res.ok) throw new Error('Sesión expirada');
          return res.json();
        })
        .then(userData => {
          setUser(userData);
          setScreen('lobby');
          fetchAgents(token);
          connectSocket(token, userData.id);
        })
        .catch(() => {
          handleLogout();
        });
    } else {
      setScreen('auth');
    }
  }, [token]);

  const fetchAgents = async (authToken: string) => {
    try {
      const res = await fetch('/api/character/list', {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      const data = await res.json();
      if (!data.error) {
        setAgents(data);
      }
    } catch (err) {
      console.error('Error al cargar agentes:', err);
    }
  };

  const connectSocket = (authToken: string, currentUserId: string) => {
    if (socket) socket.close();

    const s = io({
      auth: { token: authToken }
    });

    s.on('queue_status', ({ status }) => {
      if (status === 'waiting') {
        setScreen('matchmaking');
      } else {
        setScreen('lobby');
      }
    });

    s.on('match_found', ({ combatId, map, p1, p2 }) => {
      setCombatMode('pvp');
      setPvpCombatId(combatId);
      setSelectedMap(map);
      setRound(1);
      setMathLogs([]);
      setChatLogs([]);
      setNarrativeHistory([`Combate PvP iniciado en el escenario: ${map.name}. ${map.impactDescription}`]);

      const isP1 = p1.userId === currentUserId;
      isPlayer1Ref.current = isP1;
      setIsPlayer1(isP1);

      const me = isP1 ? p1 : p2;
      const opp = isP1 ? p2 : p1;

      setPlayerAgent(me.agent);
      setCpuAgent(opp.agent);

      prevPlayerHpRef.current = me.agent.maxHp;
      prevCpuHpRef.current = opp.agent.maxHp;

      setPlayerBubble(`Yo soy ${me.agent.name}. Señal de combate PvP establecida.`);
      setCpuBubble(`Oponente detectado: ${opp.agent.name}. Listo para combatir.`);

      setSelectedBoosters([]);
      setOpponentDraftConfirmed(false);
      setScreen('draft');
      setIsFighting(false);
    });

    s.on('player_draft_status', ({ p1Ready: r1, p2Ready: r2 }) => {
      const isP1 = isPlayer1Ref.current;
      const oppReady = isP1 ? r2 : r1;
      setOpponentDraftConfirmed(oppReady);
    });

    s.on('draft_completed', ({ p1Boosters, p2Boosters }) => {
      const isP1 = isPlayer1Ref.current;
      setPlayerBoosters(isP1 ? p1Boosters : p2Boosters);
      setCpuBoosters(isP1 ? p2Boosters : p1Boosters);
      setIsFighting(false);
      setScreen('arena');
    });

    s.on('player_ready_status', ({ p1Ready: r1, p2Ready: r2 }) => {
      setP1Ready(r1);
      setP2Ready(r2);
    });

    s.on('chat_message', ({ senderName, text, timestamp }) => {
      setChatLogs(prev => [...prev, { senderName, text, timestamp }]);
      if (activeTabRef.current !== 'chat') {
        setUnreadChat(true);
      }
    });

    s.on('round_result', ({ roundResult, p1Agent, p2Agent, finished, winnerKey, winnerId, p1Boosters, p2Boosters }) => {
      setIsFighting(false);

      const isP1 = isPlayer1Ref.current;
      const meAgent = isP1 ? p1Agent : p2Agent;
      const oppAgent = isP1 ? p2Agent : p1Agent;

      setPlayerAgent(meAgent);
      setCpuAgent(oppAgent);

      setPlayerBoosters(isP1 ? p1Boosters : p2Boosters);
      setCpuBoosters(isP1 ? p2Boosters : p1Boosters);

      setPlayerBubble(roundResult.actions[meAgent.id].adaptedAction.verbal_reaction);
      setCpuBubble(roundResult.actions[oppAgent.id].adaptedAction.verbal_reaction);

      setNarrativeHistory(prev => [...prev, roundResult.narrative]);
      setMathLogs(prev => [...prev, ...roundResult.mathLog, '---']);

      setP1Ready(false);
      setP2Ready(false);

      animate('.console-terminal-text', {
        opacity: [0.3, 1],
        translateY: [10, 0],
        ease: 'out-quad',
        duration: 500
      });

      if (finished) {
        setWinner(winnerKey === 'empate' ? 'empate' : (winnerId === currentUserId ? 'player' : 'cpu'));
        setTimeout(() => {
          setScreen('result');
          if (token) fetchAgents(token); // reload agents (confidence changes)
        }, 2200);
      } else {
        setRound(r => r + 1);
      }
    });


    s.on('opponent_disconnected', () => {
      setErrorMsg('Tu oponente se desconectó. Combate cancelado.');
      setScreen('lobby');
      setCombatMode(null);
      setPvpCombatId(null);
    });

    s.on('error_msg', (msg) => {
      setErrorMsg(msg);
    });

    setSocket(s);
  };

  // Draft Timer countdown for PvP
  useEffect(() => {
    if (screen !== 'draft' || combatMode !== 'pvp') return;
    setDraftTimer(60);
    const interval = setInterval(() => {
      setDraftTimer(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // Auto submit draft
          if (socket && pvpCombatId) {
            socket.emit('submit_draft', { combatId: pvpCombatId, draftedBoosterIds: selectedBoosters });
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [screen, combatMode, socket, pvpCombatId, selectedBoosters]);

  // Animations effects
  useEffect(() => {
    if (playerAgent && screen === 'map_selection') {
      animate('.stat-bar-fill', {
        width: (el: HTMLElement) => el.getAttribute('data-value') + '%',
        ease: 'out-elastic(1, .6)',
        duration: 1400,
        delay: stagger(120)
      });
    }
  }, [playerAgent, screen]);

  useEffect(() => {
    if (!playerAgent) return;
    const prev = prevPlayerHpRef.current;
    const curr = playerAgent.currentHp;
    if (curr < prev) {
      setShakePlayer(true);
      setFlashPlayer(true);
      animate('.player-card-container', {
        translateX: [{ to: -12, duration: 50 }, { to: 12, duration: 50 }, { to: -8, duration: 50 }, { to: 8, duration: 50 }, { to: 0, duration: 50 }],
        ease: 'linear'
      });
      const timer = setTimeout(() => {
        setShakePlayer(false);
        setFlashPlayer(false);
      }, 400);
      prevPlayerHpRef.current = curr;
      return () => clearTimeout(timer);
    }
    prevPlayerHpRef.current = curr;
  }, [playerAgent?.currentHp]);

  useEffect(() => {
    if (!cpuAgent) return;
    const prev = prevCpuHpRef.current;
    const curr = cpuAgent.currentHp;
    if (curr < prev) {
      setShakeCpu(true);
      setFlashCpu(true);
      animate('.cpu-card-container', {
        translateX: [{ to: -12, duration: 50 }, { to: 12, duration: 50 }, { to: -8, duration: 50 }, { to: 8, duration: 50 }, { to: 0, duration: 50 }],
        ease: 'linear'
      });
      const timer = setTimeout(() => {
        setShakeCpu(false);
        setFlashCpu(false);
      }, 400);
      prevCpuHpRef.current = curr;
      return () => clearTimeout(timer);
    }
    prevCpuHpRef.current = curr;
  }, [cpuAgent?.currentHp]);

  // Auth actions
  const handleAuth = async (action: 'login' | 'register') => {
    if (!usernameInput || !passwordInput) return;
    setIsAuthLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/auth/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: usernameInput, password: passwordInput })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setToken(data.token);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ba_token');
    setToken(null);
    setUser(null);
    setAgents([]);
    setSelectedAgent(null);
    if (socket) socket.close();
    setSocket(null);
    setScreen('auth');
  };

  // Character Creation Action
  const handleCreateCharacter = async (promptText: string, customName?: string, gender?: 'hombre' | 'mujer' | '') => {
    if (!promptText.trim() || !token) return;
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/character/create', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          prompt: promptText,
          name: customName || undefined,
          gender: gender || undefined
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      await fetchAgents(token);
      setSelectedAgent(data);
      setShowCreator(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al generar el agente.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Matchmaking / PvP queue triggers
  const startMatchmaking = () => {
    if (!selectedAgent || !socket) return;
    socket.emit('join_queue', { agentId: selectedAgent.id });
    setErrorMsg(null);
  };

  const cancelMatchmaking = () => {
    if (socket) {
      socket.emit('leave_queue');
    }
  };

  // CPU Game triggers
  const selectMapForCPU = (map: MapScenario) => {
    setSelectedMap(map);
    setCombatMode('cpu');
    setSelectedBoosters([]);
    setScreen('draft');
  };

  const startCPUCombatWithBoosters = async () => {
    if (!selectedAgent || !token || !selectedMap) return;
    setIsGenerating(true);
    setErrorMsg(null);

    try {
      const resStart = await fetch('/api/combat/start', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          playerAgentId: selectedAgent.id,
          mapName: selectedMap.name,
          draftedBoosterIds: selectedBoosters
        })
      });
      const startData = await resStart.json();
      if (startData.error) throw new Error(startData.error);

      setPlayerAgent(startData.playerAgent);
      setCpuAgent(startData.cpuAgent);
      setPlayerBoosters(startData.playerBoosters || []);
      setCpuBoosters(startData.cpuBoosters || []);
      
      prevPlayerHpRef.current = startData.playerAgent.maxHp;
      prevCpuHpRef.current = startData.cpuAgent.maxHp;

      setRound(1);
      setNarrativeHistory([`Combate CPU iniciado en escenario: ${selectedMap.name}. ${selectedMap.impactDescription}`]);
      setMathLogs([]);
      setPlayerBubble(`Inicializando combate contra unidad CPU. Listo.`);
      setCpuBubble(`Objetivo fijado: ${startData.playerAgent.name}.`);
      setScreen('arena');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar combate contra la CPU.');
      setCombatMode(null);
    } finally {
      setIsGenerating(false);
    }
  };

  // Submit round action
  const handleExecuteRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerActionPrompt.trim() || isFighting || !playerAgent) return;

    if (combatMode === 'cpu') {
      setIsFighting(true);
      setErrorMsg(null);
      try {
        const res = await fetch('/api/combat/round', {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ 
            actionPrompt: playerActionPrompt,
            activeBoosterId: activeBoosterId
          })
        });
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        const roundRes = data.roundResult as CombatRoundResult;
        
        setPlayerBubble(roundRes.actions[playerAgent.id].adaptedAction.verbal_reaction);
        setCpuBubble(roundRes.actions[cpuAgent!.id].adaptedAction.verbal_reaction);

        setPlayerAgent(data.playerAgent);
        setCpuAgent(data.cpuAgent);
        setPlayerBoosters(data.playerBoosters || []);
        setCpuBoosters(data.cpuBoosters || []);

        setNarrativeHistory(prev => [...prev, roundRes.narrative]);
        setMathLogs(prev => [...prev, ...roundRes.mathLog, '---']);

        animate('.console-terminal-text', {
          opacity: [0.3, 1],
          translateY: [10, 0],
          ease: 'out-quad',
          duration: 500
        });

        setPlayerActionPrompt('');
        setActiveBoosterId(null);

        if (data.finished) {
          setWinner(data.winner);
          setTimeout(() => {
            setScreen('result');
            if (token) fetchAgents(token); // reload stats
          }, 2200);
        } else {
          setRound(r => r + 1);
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'Error de red.');
      } finally {
        setIsFighting(false);
      }
    } else if (combatMode === 'pvp' && socket && pvpCombatId) {
      setIsFighting(true);
      socket.emit('submit_action', {
        combatId: pvpCombatId,
        actionPrompt: playerActionPrompt,
        activeBoosterId: activeBoosterId
      });
      setPlayerActionPrompt('');
      setActiveBoosterId(null);
    }
  };


  // Chat message submit
  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket || !pvpCombatId) return;
    socket.emit('send_chat', { combatId: pvpCombatId, text: chatInput });
    setChatInput('');
  };

  const handleResetGame = () => {
    setPlayerAgent(null);
    setCpuAgent(null);
    setSelectedMap(null);
    setWinner(null);
    setRound(1);
    setNarrativeHistory([]);
    setMathLogs([]);
    setChatLogs([]);
    setErrorMsg(null);
    setCombatMode(null);
    setPvpCombatId(null);
    setSelectedBoosters([]);
    setPlayerBoosters([]);
    setCpuBoosters([]);
    setActiveBoosterId(null);
    setOpponentDraftConfirmed(false);
    setScreen('lobby');
  };

  const handleTabChange = (tab: 'log' | 'chat') => {
    setActiveTab(tab);
    activeTabRef.current = tab;
    if (tab === 'chat') {
      setUnreadChat(false);
    }
  };

  return (
    <div className={`relative min-h-screen p-4 md:p-8 flex flex-col items-center ${screen === 'auth' || screen === 'result' ? 'justify-center' : 'justify-start'} z-10`}>
      <div className="digital-grid"></div>
      <div className="scanlines"></div>

      {/* Header */}
      <header className="w-full max-w-6xl mb-6 text-center flex flex-col items-center">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-wider font-mono glow-text-cyan mb-2">
          BATTLE AGENTS
        </h1>
        {user && (
          <div className="flex items-center gap-4 text-xs font-mono text-slate-400">
            <span>OPERADOR: <strong className="text-purple-400">{user.username.toUpperCase()}</strong></span>
            <span>|</span>
            <button onClick={handleLogout} className="text-red-400 hover:text-red-300 underline cursor-pointer">
              DESCONECTAR
            </button>
          </div>
        )}
      </header>

      {errorMsg && (
        <div className="w-full max-w-2xl bg-red-950/70 border border-red-800 text-red-200 p-4 rounded-xl mb-6 text-sm font-mono glass-panel flex flex-col gap-1 shadow-lg relative z-20">
          <div className="flex justify-between items-center">
            <span className="font-bold uppercase tracking-wider text-red-500">⚠️ Mensaje del Sistema:</span>
            <button onClick={() => setErrorMsg(null)} className="text-xs text-red-400 hover:text-white cursor-pointer">Cerrar</button>
          </div>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* -------------------- 1. SCREEN: AUTH -------------------- */}
      {screen === 'auth' && (
        <div className="w-full max-w-md glass-panel p-8 flex flex-col gap-6 relative items-center text-center">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-bold font-mono text-white glow-text-purple">OPERATOR LOG IN</h2>
            <p className="text-slate-400 text-xs font-mono">Autentique su firma digital para acceder a la red de agentes.</p>
          </div>

          <div className="flex flex-col gap-4 w-full text-left font-mono">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase text-slate-500 font-bold">Firma Operador</label>
              <input
                type="text"
                disabled={isAuthLoading}
                value={usernameInput}
                onChange={(e) => setUsernameInput(e.target.value)}
                placeholder="Nombre de Operador..."
                className="w-full bg-slate-950/85 border border-slate-800 hover:border-slate-700 focus:border-purple-500 text-white rounded-lg px-4 py-2.5 outline-none text-sm transition"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase text-slate-500 font-bold">Código de Acceso</label>
              <input
                type="password"
                disabled={isAuthLoading}
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="Contraseña..."
                className="w-full bg-slate-950/85 border border-slate-800 hover:border-slate-700 focus:border-purple-500 text-white rounded-lg px-4 py-2.5 outline-none text-sm transition"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 w-full mt-2 font-mono">
            <button
              onClick={() => handleAuth('login')}
              disabled={isAuthLoading || !usernameInput || !passwordInput}
              className="btn-neon btn-neon-cyan text-xs"
            >
              {isAuthLoading ? 'Cargando...' : 'INICIAR SESIÓN'}
            </button>
            <button
              onClick={() => handleAuth('register')}
              disabled={isAuthLoading || !usernameInput || !passwordInput}
              className="btn-neon btn-neon-purple text-xs"
            >
              REGISTRARSE
            </button>
          </div>
        </div>
      )}

      {/* -------------------- 2. SCREEN: LOBBY -------------------- */}
      {screen === 'lobby' && (
        <div className="w-full max-w-5xl flex flex-col gap-6">
          
          {showCreator ? (
            // Character Creator mode
            <div className="w-full max-w-3xl glass-panel p-8 mx-auto flex flex-col gap-6 relative items-center justify-center text-center">
              <div className="flex justify-between items-center w-full border-b border-slate-800 pb-3 mb-2">
                <h2 className="text-2xl font-bold font-mono text-white glow-text-purple">CREAR AGENTE</h2>
                <button 
                  onClick={() => setShowCreator(false)} 
                  className="text-xs font-mono text-slate-500 hover:text-slate-200 cursor-pointer"
                >
                  [ CANCELAR ]
                </button>
              </div>
              <p className="text-slate-400 text-xs max-w-xl -mt-2">
                Describe al agente que quieres programar. Sus estadísticas se asignarán y balancearán automáticamente.
              </p>
              <CharacterCreatorForm onSubmit={handleCreateCharacter} isLoading={isGenerating} />
              {isGenerating && (
                <div className="flex flex-col items-center justify-center p-4 gap-2">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-purple-500"></div>
                  <p className="text-xs font-mono text-purple-400 animate-pulse">Sincronizando conciencia neuronal...</p>
                </div>
              )}
            </div>
          ) : (
            // Agent list & details
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              
              {/* Left Column: List of Agents (4 cols) */}
              <div className="lg:col-span-5 glass-panel p-6 flex flex-col gap-4">
                <div className="flex justify-between items-center border-b border-slate-800 pb-3">
                  <h3 className="font-mono text-sm text-cyan-400 font-bold tracking-wider">TUS AGENTES DE BATALLA</h3>
                  <button 
                    onClick={() => setShowCreator(true)}
                    className="text-[11px] font-mono bg-purple-950/40 border border-purple-800 text-purple-300 hover:bg-purple-900/40 px-2.5 py-1.5 rounded transition cursor-pointer"
                  >
                    + NUEVO AGENTE
                  </button>
                </div>

                <div className="flex flex-col gap-2.5 max-h-[480px] overflow-y-auto pr-1">
                  {agents.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 font-mono text-xs italic">
                      No tienes agentes registrados. Crea uno nuevo para comenzar.
                    </div>
                  ) : (
                    agents.map((ag) => (
                      <button
                        key={ag.id}
                        onClick={() => setSelectedAgent(ag)}
                        className={`w-full flex justify-between items-center p-3.5 rounded-xl border transition-all text-left cursor-pointer ${
                          selectedAgent?.id === ag.id
                            ? 'bg-purple-950/20 border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.15)]'
                            : 'bg-slate-950/40 border-slate-900 hover:border-slate-800 hover:bg-slate-900/20'
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <strong className="text-sm text-white font-mono">{ag.name}</strong>
                          <span className="text-[10px] text-slate-500 capitalize">{ARCHETYPE_LABELS[ag.archetype]}</span>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[9px] font-mono text-slate-500">CONFIANZA</span>
                          <span className="text-xs font-mono font-bold text-cyan-400">{ag.confidence}/100</span>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>

              {/* Right Column: Selected Agent Details & Action Lobby (7 cols) */}
              <div className="lg:col-span-7 flex flex-col gap-6">
                {selectedAgent ? (
                  <div className="glass-panel p-6 flex flex-col gap-5">
                    
                    {/* Basic details */}
                    <div className="border-b border-slate-800/80 pb-3 flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-mono text-purple-500 uppercase tracking-wider block font-bold">Ficha de Agente</span>
                        <h3 className="text-2xl font-bold text-white mt-1">{selectedAgent.name}</h3>
                        <div className="flex gap-2 mt-1.5">
                          <span className="text-[10px] bg-purple-950/70 border border-purple-800/80 px-2 py-0.5 rounded text-purple-300 font-mono">
                            {ARCHETYPE_LABELS[selectedAgent.archetype] || selectedAgent.archetype}
                          </span>
                          <span className="text-[10px] bg-cyan-950/70 border border-cyan-800/80 px-2 py-0.5 rounded text-cyan-300 font-mono capitalize">
                            {selectedAgent.gender === 'hombre' ? 'Hombre ♂' : 'Mujer ♀'}
                          </span>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end">
                        <span className="text-[10px] font-mono text-slate-500">CONFIANZA PERSISTENTE</span>
                        <span className="text-xl font-mono font-bold text-cyan-400">{selectedAgent.confidence}/100</span>
                        <div className="w-20 bg-slate-950 h-1.5 rounded-full overflow-hidden mt-1.5 border border-slate-800 p-0.5">
                          <div className="h-full bg-gradient-to-r from-indigo-700 to-cyan-500 rounded-full" style={{ width: `${selectedAgent.confidence}%` }}></div>
                        </div>
                      </div>
                    </div>

                    <p className="text-slate-400 text-xs italic leading-relaxed">{selectedAgent.personalityDescription}</p>

                    {/* Stats */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3.5 my-2">
                      {Object.entries(selectedAgent.stats).map(([stat, val]) => (
                        <div key={stat} className="bg-slate-950/60 border border-slate-900 p-2.5 rounded-lg text-center font-mono flex flex-col gap-1">
                          <span className="text-[9px] text-slate-500 capitalize">{stat}</span>
                          <strong className="text-sm text-white">{val}</strong>
                        </div>
                      ))}
                    </div>

                    {/* Unique Ability */}
                    <div className="bg-slate-950/50 border border-slate-900 p-4 rounded-xl flex flex-col gap-1 text-xs">
                      <span className="font-mono text-cyan-400 font-bold block tracking-wider text-[10px]">⚡ HABILIDAD ÚNICA</span>
                      <strong className="text-slate-200 text-sm font-semibold">{selectedAgent.uniqueAbility.name}</strong>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-0.5">{selectedAgent.uniqueAbility.description}</p>
                    </div>

                    {/* Action Triggers */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 border-t border-slate-800/80">
                      <button
                        onClick={() => setScreen('map_selection')}
                        className="btn-neon btn-neon-cyan text-xs py-3"
                      >
                        ENTRENAMIENTO (CPU)
                      </button>
                      <button
                        onClick={startMatchmaking}
                        className="btn-neon btn-neon-purple text-xs py-3"
                      >
                        BUSCAR PARTIDA ONLINE
                      </button>
                    </div>

                  </div>
                ) : (
                  <div className="glass-panel p-16 text-center text-slate-500 font-mono text-xs italic flex flex-col items-center justify-center gap-2">
                    <span>📡 Seleccione un agente de la lista para ver su enlace neural o cree uno nuevo.</span>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>
      )}

      {/* -------------------- 3. SCREEN: MAP SELECTION (CPU ONLY) -------------------- */}
      {screen === 'map_selection' && selectedAgent && (
        <div className="w-full max-w-4xl glass-panel p-8 flex flex-col gap-6">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h2 className="text-2xl font-bold font-mono text-white glow-text-cyan">SELECCIONAR ESCENARIO</h2>
              <p className="text-slate-400 text-xs">El mapa modificará los atributos de combate.</p>
            </div>
            <button onClick={() => setScreen('lobby')} className="text-xs font-mono text-slate-500 hover:text-slate-200 cursor-pointer">
              [ VOLVER ]
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {maps.map((map) => {
              const theme = MAP_THEMES[map.name] || { icon: '🗺️', clr: 'var(--clr-cyan)' };
              return (
                <button 
                  key={map.name}
                  disabled={isGenerating}
                  onClick={() => selectMapForCPU(map)}
                  className="flex flex-col items-center justify-start text-center p-5 rounded-xl border border-slate-850 bg-slate-950/40 hover:bg-slate-900/30 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer disabled:opacity-50 group"
                >
                  <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">{theme.icon}</span>
                  <h3 className="font-bold text-sm text-white mb-2 font-mono" style={{ color: theme.clr }}>{map.name}</h3>
                  <p className="text-slate-400 text-[11px] leading-relaxed mb-3 flex-grow">{map.impactDescription}</p>
                </button>
              );
            })}
          </div>

          {isGenerating && (
            <div className="flex flex-col items-center justify-center p-4 gap-2">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
              <p className="text-xs font-mono text-cyan-400 animate-pulse">Generando oponente holográfico...</p>
            </div>
          )}
        </div>
      )}

      {/* -------------------- 3.b. SCREEN: DRAFT (CPU & PvP) -------------------- */}
      {screen === 'draft' && selectedMap && selectedAgent && (
        <div className="w-full max-w-5xl glass-panel p-6 flex flex-col gap-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800">
            <div>
              <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block font-bold">Fase de Preparación y Draft</span>
              <h2 className="text-2xl font-bold font-mono text-white glow-text-purple">SELECCIÓN DE BOOSTERS</h2>
              <p className="text-slate-400 text-xs mt-1">Selecciona hasta 3 boosters estratégicos que beneficien a tu agente según el entorno.</p>
            </div>
            <div className="flex items-center gap-4 self-stretch md:self-auto justify-between md:justify-end">
              {combatMode === 'pvp' && (
                <div className="bg-purple-950/40 border border-purple-800 px-4 py-2 rounded-lg font-mono text-xs text-purple-400 font-bold flex items-center gap-2">
                  <span>⏱️ DRAFT TIMER:</span>
                  <span className="text-white text-sm">{draftTimer}s</span>
                </div>
              )}
              {combatMode === 'cpu' && (
                <button
                  onClick={() => {
                    setScreen('map_selection');
                    setCombatMode(null);
                  }}
                  className="text-xs font-mono text-slate-500 hover:text-slate-200 cursor-pointer"
                >
                  [ CAMBIAR MAPA ]
                </button>
              )}
            </div>
          </div>

          {/* Map Info Bar */}
          <div className="bg-slate-950/60 border border-slate-900 p-4 rounded-xl flex items-center gap-4">
            <span className="text-4xl">{MAP_THEMES[selectedMap.name]?.icon || '🗺️'}</span>
            <div className="flex-grow">
              <strong className="text-sm text-cyan-400 font-mono block">ESCENARIO DETECTADO: {selectedMap.name.toUpperCase()}</strong>
              <p className="text-slate-400 text-xs mt-0.5">{selectedMap.impactDescription}</p>
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {selectedMap.tags.map(t => (
                  <span key={t} className="text-[9px] bg-slate-900 border border-slate-800 px-2 py-0.5 rounded text-slate-400 font-mono">
                    #{t}
                  </span>
                ))}
                {Object.entries(selectedMap.statsModifiers).map(([stat, val]) => (
                  <span key={stat} className={`text-[9px] border px-2 py-0.5 rounded font-mono ${val > 0 ? 'bg-green-950/30 border-green-800 text-green-400' : 'bg-red-950/30 border-red-900 text-red-400'}`}>
                    {stat.toUpperCase()}: {val > 0 ? `+${val}` : val}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Slots & Confirm Button */}
          <div className="flex flex-col md:flex-row justify-between items-center bg-slate-950/40 border border-slate-900 p-4 rounded-xl gap-4">
            <div className="flex flex-col gap-1 w-full md:w-auto">
              <span className="text-[10px] font-mono text-slate-500 font-bold uppercase">Tus Ranuras de Equipamiento (Max 3):</span>
              <div className="flex gap-2 mt-1">
                {[0, 1, 2].map((slotIdx) => {
                  const boosterId = selectedBoosters[slotIdx];
                  const bDetails = boosters.find(b => b.id === boosterId);
                  return (
                    <div 
                      key={slotIdx} 
                      className={`flex-grow md:flex-grow-0 md:w-44 h-11 border rounded-lg flex items-center justify-center p-2 text-center text-xs font-mono transition-all duration-300 ${
                        bDetails 
                          ? 'bg-purple-950/20 border-purple-500/50 text-purple-300' 
                          : 'bg-black/40 border-slate-900 text-slate-650 border-dashed'
                      }`}
                    >
                      {bDetails ? bDetails.name : `[ Ranura Vacía ]`}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="w-full md:w-auto flex flex-col md:items-end gap-1.5">
              {combatMode === 'pvp' && (
                <div className="text-[10px] font-mono text-slate-500">
                  Estado Oponente: {opponentDraftConfirmed ? <span className="text-green-400 font-bold">● LISTO</span> : <span className="text-yellow-500 animate-pulse">PLANIFICANDO...</span>}
                </div>
              )}
              {combatMode === 'cpu' ? (
                <button
                  onClick={startCPUCombatWithBoosters}
                  disabled={isGenerating}
                  className="btn-neon btn-neon-cyan text-xs py-3.5 px-8 w-full md:w-auto font-bold uppercase tracking-wider"
                >
                  {isGenerating ? 'Inicializando Conexión...' : 'Comenzar Entrenamiento'}
                </button>
              ) : (
                <button
                  onClick={() => {
                    if (socket && pvpCombatId) {
                      socket.emit('submit_draft', { combatId: pvpCombatId, draftedBoosterIds: selectedBoosters });
                      setIsFighting(true); // lock locally
                    }
                  }}
                  disabled={isFighting}
                  className="btn-neon btn-neon-purple text-xs py-3.5 px-8 w-full md:w-auto font-bold uppercase tracking-wider"
                >
                  {isFighting ? 'Esperando al Operador Rival...' : 'Confirmar Equipamiento'}
                </button>
              )}
            </div>
          </div>

          {/* Boosters Grid */}
          <div className="flex flex-col gap-5 max-h-[460px] overflow-y-auto pr-1">
            {/* Category: Weapons */}
            <div>
              <h4 className="font-mono text-xs text-slate-400 font-bold border-b border-slate-900 pb-1.5 mb-3 tracking-widest uppercase">
                ⚔️ ARMAS (Activas - Consumen cargas al atacar)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {boosters.filter(b => b.type === 'weapon').map((b) => {
                  const isSelected = selectedBoosters.includes(b.id);
                  const isLimit = selectedBoosters.length >= 3 && !isSelected;
                  return (
                    <button
                      key={b.id}
                      disabled={isFighting}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedBoosters(prev => prev.filter(id => id !== b.id));
                        } else if (!isLimit) {
                          setSelectedBoosters(prev => [...prev, b.id]);
                        }
                      }}
                      className={`flex flex-col text-left p-4.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                        isSelected 
                          ? 'bg-purple-950/20 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.1)]' 
                          : isLimit 
                            ? 'bg-slate-950/20 border-slate-950 opacity-40 cursor-not-allowed'
                            : 'bg-slate-950/40 border-slate-900 hover:border-slate-850 hover:bg-slate-900/10'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <strong className="text-sm text-white font-mono">{b.name}</strong>
                        <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-500 px-2 py-0.5 rounded font-mono">
                          {b.durability} USOS
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-2.5 flex-grow">{b.description}</p>
                      {b.statsModifiers && (
                        <div className="flex gap-1.5 mt-3 flex-wrap">
                          {Object.entries(b.statsModifiers).map(([stat, val]) => (
                            <span key={stat} className="text-[9px] font-mono text-purple-400 bg-purple-950/30 border border-purple-900/60 px-1.5 py-0.2 rounded font-bold uppercase font-bold">
                              {stat}: {val > 0 ? `+${val}` : val}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category: Armors */}
            <div className="mt-2">
              <h4 className="font-mono text-xs text-slate-400 font-bold border-b border-slate-900 pb-1.5 mb-3 tracking-widest uppercase">
                🛡️ PARTES DE ARMADURA (Pasivas - Absorben daño al recibir golpes)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {boosters.filter(b => ['head', 'torso', 'arms', 'legs'].includes(b.type)).map((b) => {
                  const isSelected = selectedBoosters.includes(b.id);
                  const isLimit = selectedBoosters.length >= 3 && !isSelected;
                  const typeLabels: Record<string, string> = { head: 'Cabeza', torso: 'Torso', arms: 'Brazos', legs: 'Piernas' };
                  return (
                    <button
                      key={b.id}
                      disabled={isFighting}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedBoosters(prev => prev.filter(id => id !== b.id));
                        } else if (!isLimit) {
                          setSelectedBoosters(prev => [...prev, b.id]);
                        }
                      }}
                      className={`flex flex-col text-left p-4.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                        isSelected 
                          ? 'bg-purple-950/20 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.15)]' 
                          : isLimit 
                            ? 'bg-slate-950/20 border-slate-950 opacity-40 cursor-not-allowed'
                            : 'bg-slate-950/40 border-slate-900 hover:border-slate-850 hover:bg-slate-900/10'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <div className="flex items-center gap-2">
                          <strong className="text-sm text-white font-mono">{b.name}</strong>
                          <span className="text-[8px] bg-slate-900 text-purple-400 border border-purple-950 px-1.5 py-0.2 rounded font-mono uppercase font-bold">
                            {typeLabels[b.type]}
                          </span>
                        </div>
                        <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-500 px-2 py-0.5 rounded font-mono">
                          {b.durability} GOLPES
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-2.5 flex-grow">{b.description}</p>
                      {b.statsModifiers && (
                        <div className="flex gap-1.5 mt-3 flex-wrap">
                          {Object.entries(b.statsModifiers).map(([stat, val]) => (
                            <span key={stat} className="text-[9px] font-mono text-purple-400 bg-purple-950/30 border border-purple-900/60 px-1.5 py-0.2 rounded font-bold uppercase font-bold">
                              {stat}: {val > 0 ? `+${val}` : val}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category: Tools */}
            <div className="mt-2">
              <h4 className="font-mono text-xs text-slate-400 font-bold border-b border-slate-900 pb-1.5 mb-3 tracking-widest uppercase">
                🔧 HERRAMIENTAS (Activas - Decides cuándo activarlas en tu turno)
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {boosters.filter(b => b.type === 'tool').map((b) => {
                  const isSelected = selectedBoosters.includes(b.id);
                  const isLimit = selectedBoosters.length >= 3 && !isSelected;
                  return (
                    <button
                      key={b.id}
                      disabled={isFighting}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedBoosters(prev => prev.filter(id => id !== b.id));
                        } else if (!isLimit) {
                          setSelectedBoosters(prev => [...prev, b.id]);
                        }
                      }}
                      className={`flex flex-col text-left p-4.5 rounded-xl border transition-all duration-300 cursor-pointer ${
                        isSelected 
                          ? 'bg-purple-950/20 border-purple-500 shadow-[0_0_12px_rgba(168,85,247,0.15)]' 
                          : isLimit 
                            ? 'bg-slate-950/20 border-slate-950 opacity-40 cursor-not-allowed'
                            : 'bg-slate-950/40 border-slate-900 hover:border-slate-850 hover:bg-slate-900/10'
                      }`}
                    >
                      <div className="flex justify-between items-start w-full">
                        <strong className="text-sm text-white font-mono">{b.name}</strong>
                        <span className="text-[9px] bg-slate-900 border border-slate-800 text-slate-500 px-2 py-0.5 rounded font-mono">
                          {b.durability} USOS
                        </span>
                      </div>
                      <p className="text-slate-400 text-[11px] leading-relaxed mt-2.5 flex-grow">{b.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* -------------------- 4. SCREEN: MATCHMAKING -------------------- */}
      {screen === 'matchmaking' && selectedAgent && (
        <div className="w-full max-w-md glass-panel p-10 text-center flex flex-col items-center gap-6">
          <div className="relative w-24 h-24 flex items-center justify-center">
            {/* Pulsing search effect */}
            <div className="absolute inset-0 rounded-full border border-purple-500/30 animate-ping"></div>
            <div className="absolute inset-2 rounded-full border border-purple-500/50 animate-pulse"></div>
            <span className="text-4xl">📡</span>
          </div>

          <div className="flex flex-col gap-1.5">
            <h2 className="text-xl font-bold font-mono text-white glow-text-purple">BUSCANDO FIRMA NEURAL</h2>
            <p className="text-xs font-mono text-slate-500">Emparejando en la red global 1v1. Espere un momento...</p>
          </div>

          <div className="bg-slate-950/60 border border-slate-900 p-3 rounded-lg w-full font-mono text-xs text-left flex justify-between">
            <span className="text-slate-500">Agente Encolado:</span>
            <span className="text-purple-400 font-bold">{selectedAgent.name}</span>
          </div>

          <button 
            onClick={cancelMatchmaking}
            className="w-full btn-neon btn-neon-purple text-xs"
          >
            CANCELAR BÚSQUEDA
          </button>
        </div>
      )}

      {/* -------------------- 5. SCREEN: ARENA -------------------- */}
      {screen === 'arena' && playerAgent && cpuAgent && selectedMap && (
        <div className="w-full max-w-6xl flex flex-col gap-6">
          
          {/* Header Panel */}
          <div className="glass-panel p-6 flex flex-col gap-5 border border-slate-800">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-4 border-b border-slate-800/60">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{MAP_THEMES[selectedMap.name]?.icon || '🗺️'}</span>
                <div>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest block font-bold">
                    Escenario de Combate {combatMode === 'pvp' ? 'Online' : 'CPU'}
                  </span>
                  <h3 className="font-bold text-white font-mono text-sm uppercase">{selectedMap.name}</h3>
                  <p className="text-slate-400 text-xs leading-relaxed mt-0.5">{selectedMap.impactDescription}</p>
                </div>
              </div>
              <div className="bg-cyan-950/70 border border-cyan-800 px-4 py-2 rounded-lg font-mono text-sm text-cyan-400 font-bold self-stretch md:self-auto flex items-center justify-center">
                RONDA {round}
              </div>
            </div>

            {/* HP Status Head-to-Head */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Player HP */}
              <div className={`player-card-container flex flex-col gap-2 p-4 rounded-xl bg-slate-950/40 border border-slate-900 transition-all duration-200 ${flashPlayer ? 'damage-flash' : ''}`}>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-purple-400 font-bold">{playerAgent.name} (Tú)</span>
                  <span className="text-white font-bold">{playerAgent.currentHp}/100 HP</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-900 p-0.5">
                  <div className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-green-500 rounded-full transition-all duration-500" style={{ width: `${playerAgent.currentHp}%` }}></div>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>CONFIANZA EN PELEA: {playerAgent.confidence}/100</span>
                  {combatMode === 'pvp' && (
                    <span className={(isPlayer1 ? p1Ready : p2Ready) ? 'text-green-400' : 'text-slate-500'}>
                      {(isPlayer1 ? p1Ready : p2Ready) ? '● LISTO' : '○ PLANIFICANDO...'}
                    </span>
                  )}
                </div>

                {playerBoosters && playerBoosters.length > 0 && (
                  <div className="border-t border-slate-900/60 pt-3 mt-2 flex flex-col gap-2">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">Boosters Equipados:</span>
                    <div className="flex gap-2">
                      {playerBoosters.map((b) => {
                        const isBroken = b.currentDurability <= 0;
                        const isActiveSelected = activeBoosterId === b.id;
                        const canActivate = !isBroken && (b.type === 'weapon' || b.type === 'tool');
                        return (
                          <button
                            key={b.id}
                            type="button"
                            disabled={isFighting || !canActivate}
                            onClick={() => {
                              if (isActiveSelected) {
                                setActiveBoosterId(null);
                              } else {
                                setActiveBoosterId(b.id);
                              }
                            }}
                            className={`flex-1 p-2 rounded-lg border text-left font-mono text-[10px] flex flex-col justify-between transition-all duration-200 cursor-pointer ${
                              isBroken
                                ? 'bg-black/60 border-slate-950 text-slate-700'
                                : isActiveSelected
                                  ? 'bg-cyan-950/30 border-cyan-500 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                                  : canActivate
                                    ? 'bg-slate-950 border-slate-900 hover:border-slate-800 text-slate-300 hover:scale-[1.02]'
                                    : 'bg-slate-950 border-slate-900 text-slate-400 opacity-80 cursor-default' // passives (armor)
                            }`}
                          >
                            <div className="flex justify-between w-full font-bold">
                              <span className={isBroken ? 'line-through text-slate-650' : ''}>{b.name}</span>
                              <span>{isBroken ? '❌' : b.type === 'weapon' ? '⚔️' : b.type === 'tool' ? '🔧' : '🛡️'}</span>
                            </div>
                            <div className="flex justify-between w-full text-[8px] text-slate-500 mt-1">
                              <span>{b.type === 'weapon' || b.type === 'tool' ? 'Usos:' : 'Golpes:'}</span>
                              <span className={isBroken ? 'text-red-500' : 'text-slate-300'}>
                                {b.currentDurability}/{b.durability}
                              </span>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Opponent HP */}
              <div className={`cpu-card-container flex flex-col gap-2 p-4 rounded-xl bg-slate-950/40 border border-slate-900 transition-all duration-200 ${flashCpu ? 'damage-flash' : ''}`}>
                <div className="flex justify-between items-center text-xs font-mono">
                  <span className="text-red-400 font-bold">{cpuAgent.name} ({combatMode === 'pvp' ? 'Rival' : 'CPU'})</span>
                  <span className="text-white font-bold">{cpuAgent.currentHp}/100 HP</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-900 p-0.5">
                  <div className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-green-500 rounded-full transition-all duration-500" style={{ width: `${cpuAgent.currentHp}%` }}></div>
                </div>
                <div className="flex justify-between text-[9px] font-mono text-slate-500">
                  <span>CONFIANZA EN PELEA: {cpuAgent.confidence}/100</span>
                  {combatMode === 'pvp' && (
                    <span className={(isPlayer1 ? p2Ready : p1Ready) ? 'text-green-400' : 'text-slate-500'}>
                      {(isPlayer1 ? p2Ready : p1Ready) ? '● LISTO' : '○ PLANIFICANDO...'}
                    </span>
                  )}
                </div>

                {cpuBoosters && cpuBoosters.length > 0 && (
                  <div className="border-t border-slate-900/60 pt-3 mt-2 flex flex-col gap-2">
                    <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest font-bold">Boosters Rivales:</span>
                    <div className="flex gap-2">
                      {cpuBoosters.map((b) => {
                        const isBroken = b.currentDurability <= 0;
                        return (
                          <div
                            key={b.id}
                            className={`flex-1 p-2 rounded-lg border text-left font-mono text-[10px] flex flex-col justify-between ${
                              isBroken
                                ? 'bg-black/60 border-slate-950 text-slate-700'
                                : 'bg-slate-950 border-slate-900 text-slate-400 opacity-90'
                            }`}
                          >
                            <div className="flex justify-between w-full font-bold">
                              <span className={isBroken ? 'line-through text-slate-650' : ''}>{b.name}</span>
                              <span>{isBroken ? '❌' : b.type === 'weapon' ? '⚔️' : b.type === 'tool' ? '🔧' : '🛡️'}</span>
                            </div>
                            <div className="flex justify-between w-full text-[8px] text-slate-650 mt-1">
                              <span>{b.type === 'weapon' || b.type === 'tool' ? 'Usos:' : 'Golpes:'}</span>
                              <span className={isBroken ? 'text-red-500/60' : 'text-slate-450'}>
                                {b.currentDurability}/{b.durability}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Cards & Tabbed terminal Console */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            
            {/* Left side: Dialogue bubbles */}
            <div className="lg:col-span-5 flex flex-col gap-4">
              <div className="glass-panel p-5 flex flex-col gap-3">
                <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest block font-bold border-b border-slate-900 pb-2">ENLACE NEURAL ACTIVO</span>
                
                <div className="flex flex-col gap-4 my-2">
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[9px] font-mono text-purple-400 font-bold">{playerAgent.name} (Tú):</span>
                    <div className="speech-bubble text-xs">"{playerBubble}"</div>
                  </div>
                  <div className="flex flex-col gap-1.5 items-end">
                    <span className="text-[9px] font-mono text-red-400 font-bold self-end">{cpuAgent.name} ({combatMode === 'pvp' ? 'Rival' : 'CPU'}):</span>
                    <div className="speech-bubble speech-bubble-cpu text-xs self-end">"{cpuBubble}"</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right side: Console Terminal with Logs & Chat tabs */}
            <div className="lg:col-span-7 flex flex-col gap-4">
              
              <div className="glass-panel p-5 flex flex-col gap-4 border border-slate-800">
                
                {/* Tabs */}
                <div className="flex border-b border-slate-850 font-mono text-xs">
                  <button
                    onClick={() => handleTabChange('log')}
                    className={`pb-2.5 px-4 font-bold border-b-2 cursor-pointer transition-colors ${
                      activeTab === 'log' 
                        ? 'border-cyan-500 text-cyan-400' 
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    [ BITÁCORA DE COMBATE ]
                  </button>
                  <button
                    onClick={() => handleTabChange('chat')}
                    className={`pb-2.5 px-4 font-bold border-b-2 cursor-pointer transition-colors relative ${
                      activeTab === 'chat' 
                        ? 'border-cyan-500 text-cyan-400' 
                        : 'border-transparent text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    [ CHAT DE OPERADORES ]
                    {unreadChat && (
                      <span className="absolute top-1 right-2 w-2 h-2 bg-purple-500 rounded-full animate-pulse"></span>
                    )}
                  </button>
                </div>

                {/* Tab content 1: Combat log */}
                {activeTab === 'log' && (
                  <div 
                    className="bg-black/85 border border-slate-900 p-4 rounded-xl font-mono text-xs md:text-sm leading-relaxed text-slate-300 overflow-y-auto flex flex-col gap-4 max-h-[300px] min-h-[220px] scrollbar-thin"
                    ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                  >
                    {narrativeHistory.map((narrative, idx) => (
                      <div key={idx} className="border-b border-slate-900 pb-3 last:border-none last:pb-0">
                        <div className="text-[9px] text-cyan-500 mb-1 font-bold tracking-wider">
                          {idx === 0 ? 'LOG INICIAL' : `RONDA ${idx}`}
                        </div>
                        <div className="flex items-start">
                          <span className="text-cyan-400 mr-2">&gt;</span>
                          <span className="console-terminal-text">{narrative}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tab content 2: PvP Chat */}
                {activeTab === 'chat' && (
                  <div className="flex flex-col gap-3">
                    <div 
                      className="bg-black/85 border border-slate-900 p-4 rounded-xl font-mono text-xs md:text-sm leading-relaxed text-slate-300 overflow-y-auto flex flex-col gap-3 max-h-[240px] min-h-[170px] scrollbar-thin"
                      ref={(el) => { if (el) el.scrollTop = el.scrollHeight; }}
                    >
                      {combatMode === 'cpu' ? (
                        <div className="text-center py-8 text-slate-500 italic text-xs">
                          El chat de operadores no está disponible en entrenamiento CPU.
                        </div>
                      ) : chatLogs.length === 0 ? (
                        <div className="text-center py-8 text-slate-600 italic text-xs">
                          Enlace de chat establecido. Comience a transmitir.
                        </div>
                      ) : (
                        chatLogs.map((msg, idx) => (
                          <div key={idx} className="flex flex-col">
                            <span className="text-[9px] text-purple-400 font-bold">{msg.senderName}:</span>
                            <span className="pl-1 text-slate-200 mt-0.5">{msg.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                    {combatMode === 'pvp' && (
                      <form onSubmit={handleSendChat} className="flex gap-2 font-mono">
                        <input
                          type="text"
                          value={chatInput}
                          onChange={(e) => setChatInput(e.target.value)}
                          placeholder="Escriba un mensaje al otro operador..."
                          className="flex-grow bg-slate-950 border border-slate-900 text-white rounded-lg px-3 py-2 outline-none text-xs focus:border-cyan-500"
                        />
                        <button type="submit" className="btn-neon btn-neon-cyan px-4 py-2 text-xs">ENVIAR</button>
                      </form>
                    )}
                  </div>
                )}

                {/* Turn action form */}
                <form onSubmit={handleExecuteRound} className="flex flex-col gap-3 mt-1 font-mono">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    TRANSMITIR ACCIÓN DE COMBATE:
                  </label>
                  <textarea 
                    disabled={isFighting}
                    value={playerActionPrompt}
                    onChange={(e) => setPlayerActionPrompt(e.target.value)}
                    rows={2}
                    placeholder="Ej: 'Aprovecha el entorno para flanquear y atacar...' o 'Esquiva los proyectiles cubriéndote'..."
                    className="w-full bg-slate-950/80 border border-slate-900 hover:border-slate-800 focus:border-cyan-500 text-white rounded-lg p-3 outline-none text-xs placeholder:text-slate-700 transition resize-none"
                  />
                  
                  <div className="flex justify-between items-center mt-1">
                    <div>
                      {combatMode === 'pvp' && isFighting && (
                        <span className="text-[10px] text-purple-400 animate-pulse font-bold">
                          ACCIÓN ENVIADA. ESPERANDO AL OPERADOR RIVAL...
                        </span>
                      )}
                    </div>
                    <button 
                      type="submit"
                      disabled={isFighting || !playerActionPrompt.trim()}
                      className="btn-neon btn-neon-cyan px-6 py-2.5 text-xs w-full sm:w-auto"
                    >
                      {isFighting && combatMode === 'cpu' ? 'RESOLVIENDO...' : 'TRANSMITIR ORDEN'}
                    </button>
                  </div>
                </form>

                {/* Show Math log toggler */}
                <div className="mt-1 border-t border-slate-850 pt-2.5">
                  <button 
                    type="button" 
                    onClick={() => setShowMathLog(!showMathLog)}
                    className="text-[10px] font-mono text-slate-500 hover:text-slate-350 flex items-center gap-1 cursor-pointer"
                  >
                    {showMathLog ? '▼ OCULTAR REGISTRO MATEMÁTICO' : '► MOSTRAR REGISTRO MATEMÁTICO'}
                  </button>
                  {showMathLog && (
                    <div className="bg-slate-950/80 border border-slate-900 rounded-lg p-3 mt-2 font-mono text-[10px] text-slate-400 max-h-[140px] overflow-y-auto leading-relaxed flex flex-col gap-1">
                      {mathLogs.length === 0 ? (
                        <span className="italic text-slate-500">No hay registros aún.</span>
                      ) : (
                        mathLogs.map((log, idx) => (
                          <span key={idx} className={log.startsWith('Daño:') ? 'text-orange-400' : log.startsWith('⚠️') ? 'text-yellow-400' : ''}>
                            {log}
                          </span>
                        ))
                      )}
                    </div>
                  )}
                </div>

              </div>

            </div>

          </div>

        </div>
      )}

      {/* -------------------- 6. SCREEN: RESULT -------------------- */}
      {screen === 'result' && playerAgent && cpuAgent && (
        <div className="w-full max-w-md glass-panel p-8 text-center flex flex-col items-center gap-6">
          <span className="text-5xl">
            {winner === 'player' ? '🏆' : winner === 'cpu' ? '💀' : '🤝'}
          </span>

          <div className="flex flex-col gap-1 font-mono">
            <h2 className="text-2xl font-extrabold uppercase tracking-widest text-white glow-text-cyan">
              {winner === 'player' ? '¡VICTORIA!' : winner === 'cpu' ? '¡DERROTA!' : '¡EMPATE!'}
            </h2>
            <p className="text-slate-500 text-[10px] mt-1">
              Combate terminado tras {round - 1} rondas.
            </p>
          </div>

          <div className="w-full bg-slate-950/60 border border-slate-900 p-4.5 rounded-xl flex flex-col gap-3 font-mono text-xs text-left">
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Tu Agente:</span>
              <span className="text-white font-bold">{playerAgent.name}</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Confianza final:</span>
              <span className="text-cyan-400 font-bold">{playerAgent.confidence}/100</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Oponente:</span>
              <span className="text-white font-bold">{cpuAgent.name} ({combatMode === 'pvp' ? 'Online' : 'CPU'})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Escenario:</span>
              <span className="text-purple-400 font-bold">{selectedMap?.name}</span>
            </div>
          </div>

          <button 
            onClick={handleResetGame}
            className="w-full btn-neon btn-neon-purple mt-4"
          >
            VOLVER AL LOBBY
          </button>
        </div>
      )}
    </div>
  );
}

// Sub-component: Form for character creation
interface CharacterCreatorFormProps {
  onSubmit: (prompt: string, name: string, gender: 'hombre' | 'mujer' | '') => void;
  isLoading: boolean;
}

function CharacterCreatorForm({ onSubmit, isLoading }: CharacterCreatorFormProps) {
  const [promptVal, setPromptVal] = useState('');
  const [nameVal, setNameVal] = useState('');
  const [genderVal, setGenderVal] = useState<'hombre' | 'mujer' | ''>('');
  
  const examples = [
    'Un ciborg silencioso experto en infiltración y dagas.',
    'Un paladín de acero pesado que defiende con su escudo gigante.',
    'Un hacker errático y miedoso con drones de soporte táctico.',
    'Una cazarrecompensas letal con blásters de rango y reflejos rápidos.'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptVal.trim() || isLoading) return;
    onSubmit(promptVal, nameVal, genderVal);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5 w-full">
      {/* Name and Gender Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full text-left">
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Nombre del Agente
          </label>
          <input
            type="text"
            disabled={isLoading}
            value={nameVal}
            onChange={(e) => setNameVal(e.target.value)}
            placeholder="Ej: Alpha-9 (Vacío para aleatorio)"
            className="w-full bg-slate-950/85 border border-slate-900 hover:border-slate-800 focus:border-purple-500 text-white rounded-xl px-4 py-3 outline-none text-sm font-mono placeholder:text-slate-800 transition"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
            Género del Agente
          </label>
          <div className="grid grid-cols-3 gap-2 h-[46px]">
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setGenderVal('hombre')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border font-mono text-xs cursor-pointer transition-all duration-200 ${
                genderVal === 'hombre'
                  ? 'bg-purple-950/40 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                  : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>👨</span> Hombre
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setGenderVal('mujer')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border font-mono text-xs cursor-pointer transition-all duration-200 ${
                genderVal === 'mujer'
                  ? 'bg-purple-950/40 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                  : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>👩</span> Mujer
            </button>
            <button
              type="button"
              disabled={isLoading}
              onClick={() => setGenderVal('')}
              className={`flex items-center justify-center gap-1.5 rounded-xl border font-mono text-xs cursor-pointer transition-all duration-200 ${
                genderVal === ''
                  ? 'bg-purple-950/40 border-purple-500 text-purple-300 shadow-[0_0_15px_rgba(168,85,247,0.2)]'
                  : 'bg-slate-950/60 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200'
              }`}
            >
              <span>🎲</span> Aleatorio
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2 text-left">
        <label className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
          Descripción / Concepto del Agente
        </label>
        <textarea 
          disabled={isLoading}
          value={promptVal}
          onChange={(e) => setPromptVal(e.target.value)}
          rows={4}
          placeholder="Ej: Un ciborg silencioso experto en infiltración..."
          className="w-full bg-slate-950/85 border border-slate-900 hover:border-slate-800 focus:border-purple-500 text-white rounded-xl p-4 outline-none text-sm font-mono placeholder:text-slate-800 transition resize-none"
        />
      </div>

      <div className="flex flex-col gap-2 items-center w-full">
        <span className="text-slate-500 text-[9px] font-mono font-bold uppercase tracking-widest text-center">
          Conceptos rápidos sugeridos:
        </span>
        <div className="flex flex-col gap-1.5 w-full max-w-lg">
          {examples.map((ex) => (
            <button 
              key={ex}
              type="button"
              disabled={isLoading}
              onClick={() => setPromptVal(ex)}
              className="text-[11px] font-mono bg-slate-950/40 hover:bg-slate-900/40 border border-slate-900 hover:border-slate-850 text-slate-400 hover:text-slate-200 py-2 rounded-lg transition cursor-pointer text-center w-full"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <button 
        type="submit"
        disabled={isLoading || !promptVal.trim()}
        className="w-full max-w-md self-center btn-neon btn-neon-purple mt-2 disabled:opacity-50 disabled:pointer-events-none py-3 text-xs font-mono cursor-pointer"
      >
        Construir Agente
      </button>
    </form>
  );
}
