import React, { useState, useEffect, useRef } from 'react';
import { animate, stagger } from 'animejs';
import { BattleAgent, MapScenario, CombatRoundResult } from '../../src/types/index';

// Pre-defined maps details mapping for icons/illustrations
const MAP_THEMES: Record<string, { icon: string; clr: string }> = {
  'Coliseo de Acero': { icon: '🛡️', clr: 'var(--clr-cyan)' },
  'Pantano Neblinoso': { icon: '☣️', clr: 'var(--clr-green)' },
  'Fábrica Abandonada': { icon: '⚙️', clr: 'var(--clr-purple)' }
};

const ARCHETYPE_LABELS: Record<string, string> = {
  'cobarde_sarcastico': 'Cobarde Sarcástico',
  'paladin_orgulloso': 'Paladín Orgulloso',
  'ansioso_inseguro': 'Ansioso Inseguro',
  'guerrero_pragmatico': 'Guerrero Pragmático'
};

export default function App() {
  const [screen, setScreen] = useState<'creation' | 'map_selection' | 'arena' | 'result'>('creation');
  const [playerAgent, setPlayerAgent] = useState<BattleAgent | null>(null);
  const [cpuAgent, setCpuAgent] = useState<BattleAgent | null>(null);
  const [maps, setMaps] = useState<MapScenario[]>([]);
  const [selectedMap, setSelectedMap] = useState<MapScenario | null>(null);

  // Combat States
  const [round, setRound] = useState(1);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isFighting, setIsFighting] = useState(false);
  const [playerActionPrompt, setPlayerActionPrompt] = useState('');
  const [narrativeHistory, setNarrativeHistory] = useState<string[]>(['El escenario está listo. Los agentes se posicionan a distancia.']);
  const [mathLogs, setMathLogs] = useState<string[]>([]);
  const [showMathLog, setShowMathLog] = useState(false);

  // Animations States
  const [shakePlayer, setShakePlayer] = useState(false);
  const [shakeCpu, setShakeCpu] = useState(false);
  const [flashPlayer, setFlashPlayer] = useState(false);
  const [flashCpu, setFlashCpu] = useState(false);
  
  // Last speech bubble dialogs
  const [playerBubble, setPlayerBubble] = useState<string>('Esperando órdenes, operador.');
  const [cpuBubble, setCpuBubble] = useState<string>('Analizando hostilidades...');

  const [winner, setWinner] = useState<'player' | 'cpu' | 'empate' | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Refs for tracking previous HP to trigger damage animations
  const prevPlayerHpRef = useRef<number>(100);
  const prevCpuHpRef = useRef<number>(100);

  // Fetch maps list on start
  useEffect(() => {
    fetch('/api/maps')
      .then(res => res.json())
      .then(data => setMaps(data))
      .catch(() => {
        // Fallback static maps in case API has issues
        setMaps([
          { name: 'Coliseo de Acero', statsModifiers: {}, tags: ['cerrado', 'plano', 'iluminado'], impactDescription: 'Combate neutral y equilibrado sin alteración de atributos.' },
          { name: 'Pantano Neblinoso', statsModifiers: { agility: -10, perception: -10, resilience: 5 }, tags: ['humedad', 'niebla_densa', 'fango'], impactDescription: 'Dificulta la agilidad y la visión. El fango espeso incrementa la resistencia.' },
          { name: 'Fábrica Abandonada', statsModifiers: { intelligence: 10, strength: 5, perception: -5 }, tags: ['maquinaria', 'cobertura', 'sombras'], impactDescription: 'Mejora las tácticas tecnológicas e incrementa la fuerza con objetos de metal.' }
        ]);
      });
  }, []);

  // Animating character stats bars when playerAgent is created
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

  // Track player HP changes to trigger shake & flash animations
  useEffect(() => {
    if (!playerAgent) return;
    const prev = prevPlayerHpRef.current;
    const curr = playerAgent.currentHp;
    if (curr < prev) {
      setShakePlayer(true);
      setFlashPlayer(true);
      
      // Screen shake using Anime.js
      animate('.player-card-container', {
        translateX: [
          { to: -12, duration: 50 },
          { to: 12, duration: 50 },
          { to: -8, duration: 50 },
          { to: 8, duration: 50 },
          { to: 0, duration: 50 }
        ],
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

  // Track CPU HP changes to trigger shake & flash animations
  useEffect(() => {
    if (!cpuAgent) return;
    const prev = prevCpuHpRef.current;
    const curr = cpuAgent.currentHp;
    if (curr < prev) {
      setShakeCpu(true);
      setFlashCpu(true);

      // Screen shake using Anime.js
      animate('.cpu-card-container', {
        translateX: [
          { to: -12, duration: 50 },
          { to: 12, duration: 50 },
          { to: -8, duration: 50 },
          { to: 8, duration: 50 },
          { to: 0, duration: 50 }
        ],
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

  // Form handlers
  const handleCreateCharacter = async (promptText: string) => {
    if (!promptText.trim()) return;
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/character/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: promptText })
      });
      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setPlayerAgent(data);
      setPlayerBubble(`Yo soy ${data.name}. Listo para entrar en combate, operador.`);
      prevPlayerHpRef.current = 100;
      setScreen('map_selection');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleStartCombat = async (map: MapScenario) => {
    if (!playerAgent) return;
    setSelectedMap(map);
    setIsGenerating(true);
    setErrorMsg(null);

    // Auto-generate enemy CPU character
    const cpuPrompts = [
      'Un robot pesado defensivo con escudos de chatarra.',
      'Un francotirador cibernético con visión térmica.',
      'Un androide médico dañado que usa toxinas de ácido.'
    ];
    const cpuPrompt = cpuPrompts[Math.floor(Math.random() * cpuPrompts.length)];

    try {
      const resCpu = await fetch('/api/character/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: cpuPrompt })
      });
      const cpuData = await resCpu.json();
      if (cpuData.error) throw new Error(cpuData.error);
      setCpuAgent(cpuData);
      setCpuBubble(`Objetivo fijado: ${playerAgent.name}. Iniciando combate.`);
      prevCpuHpRef.current = 100;

      // Start session on server
      const resStart = await fetch('/api/combat/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerAgent,
          cpuAgent: cpuData,
          mapName: map.name
        })
      });
      const startData = await resStart.json();
      if (startData.error) throw new Error(startData.error);

      setRound(1);
      setNarrativeHistory([`Combate iniciado en el escenario: ${map.name}. ${map.impactDescription}`]);
      setMathLogs([]);
      setScreen('arena');
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar el combate.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleExecuteRound = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerActionPrompt.trim() || isFighting || !playerAgent || !cpuAgent) return;
    setIsFighting(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/combat/round', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actionPrompt: playerActionPrompt })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      const roundRes = data.roundResult as CombatRoundResult;
      
      // Update dialogue bubbles
      const playerActionData = roundRes.actions[playerAgent.id];
      const cpuActionData = roundRes.actions[cpuAgent.id];
      
      setPlayerBubble(playerActionData.adaptedAction.verbal_reaction);
      setCpuBubble(cpuActionData.adaptedAction.verbal_reaction);

      // Update agents state
      setPlayerAgent(data.playerAgent);
      setCpuAgent(data.cpuAgent);

      // Add to narratives
      setNarrativeHistory(prev => [...prev, roundRes.narrative]);
      setMathLogs(prev => [...prev, ...roundRes.mathLog, '---']);

      // Anime.js timeline for typing / text fade-in
      animate('.console-terminal-text', {
        opacity: [0.3, 1],
        translateY: [10, 0],
        ease: 'out-quad',
        duration: 500
      });

      // Clear input
      setPlayerActionPrompt('');

      if (data.finished) {
        setWinner(data.winner);
        setTimeout(() => {
          setScreen('result');
        }, 2200);
      } else {
        setRound(r => r + 1);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error de conexión.');
    } finally {
      setIsFighting(false);
    }
  };

  const handleResetGame = () => {
    setPlayerAgent(null);
    setCpuAgent(null);
    setSelectedMap(null);
    setWinner(null);
    setRound(1);
    setNarrativeHistory([]);
    setMathLogs([]);
    setErrorMsg(null);
    setScreen('creation');
  };

  return (
    <div className="relative min-h-screen p-4 md:p-8 flex flex-col items-center justify-start z-10">
      <div className="digital-grid"></div>
      <div className="scanlines"></div>

      {/* Header */}
      <header className="w-full max-w-6xl mb-8 text-center flex flex-col items-center">
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-wider font-mono glow-text-cyan mb-2">
          BATTLE AGENTS
        </h1>
        <p className="text-xs md:text-sm font-mono text-slate-500 tracking-widest uppercase">
          Arena de Combate Táctico Potenciada por IA (Fase 1.b)
        </p>
      </header>

      {errorMsg && (
        <div className="w-full max-w-2xl bg-red-950/70 border border-red-800 text-red-200 p-4 rounded-xl mb-6 text-sm font-mono glass-panel flex flex-col gap-1 shadow-lg">
          <span className="font-bold uppercase tracking-wider text-red-500">⚠️ Error de Red/IA:</span>
          <span>{errorMsg}</span>
        </div>
      )}

      {/* -------------------- 1. SCREEN: CREATION -------------------- */}
      {screen === 'creation' && (
        <div className="w-full max-w-2xl glass-panel p-6 md:p-8 flex flex-col gap-6 relative">
          <div className="flex flex-col gap-2">
            <h2 className="text-2xl font-semibold font-mono text-white glow-text-purple">
              1. CREAR AGENTE
            </h2>
            <p className="text-slate-400 text-sm">
              Describe al agente que quieres controlar. La IA interpretará tu concepto y distribuirá exactamente 100 puntos en sus estadísticas base de forma competitiva.
            </p>
          </div>

          <CharacterCreatorForm onSubmit={handleCreateCharacter} isLoading={isGenerating} />

          {isGenerating && (
            <div className="flex flex-col items-center justify-center p-8 gap-4">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-purple-500"></div>
              <p className="text-sm font-mono text-purple-400 animate-pulse">
                Sincronizando conciencia... Creando estadísticas balanceadas...
              </p>
            </div>
          )}
        </div>
      )}

      {/* -------------------- 2. SCREEN: MAP SELECTION -------------------- */}
      {screen === 'map_selection' && playerAgent && (
        <div className="w-full max-w-5xl flex flex-col lg:flex-row gap-8">
          {/* Player stats preview */}
          <div className="w-full lg:w-1/3 glass-panel p-6 flex flex-col gap-4">
            <div className="border-b border-slate-800 pb-3">
              <span className="text-xs font-mono text-purple-500 uppercase tracking-wider">Agente Creado</span>
              <h3 className="text-xl font-bold text-white">{playerAgent.name}</h3>
              <span className="text-xs bg-purple-950/70 border border-purple-800/80 px-2 py-0.5 rounded text-purple-300 inline-block mt-1 font-mono">
                {ARCHETYPE_LABELS[playerAgent.archetype] || playerAgent.archetype}
              </span>
            </div>
            
            <p className="text-slate-400 text-xs italic">{playerAgent.personalityDescription}</p>

            <div className="flex flex-col gap-3 my-2">
              <h4 className="text-xs font-bold font-mono text-slate-300 uppercase tracking-widest">Estadísticas Base</h4>
              {Object.entries(playerAgent.stats).map(([stat, val]) => (
                <div key={stat} className="flex flex-col gap-1 text-xs">
                  <div className="flex justify-between font-mono text-slate-400">
                    <span className="capitalize">{stat}</span>
                    <span>{val}/50</span>
                  </div>
                  <div className="w-full bg-slate-950 h-2 rounded overflow-hidden">
                    <div 
                      className="stat-bar-fill h-full bg-gradient-to-r from-purple-500 to-cyan-400"
                      data-value={val * 2} // map to 0-100% since max is 50
                      style={{ width: '0%' }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>

            <div className="bg-slate-950/50 border border-slate-800/50 p-3 rounded-lg flex flex-col gap-1">
              <span className="text-xs font-bold font-mono text-cyan-400">⚡ Habilidad Única</span>
              <span className="text-xs font-semibold text-slate-200">{playerAgent.uniqueAbility.name}</span>
              <p className="text-slate-400 text-[11px] leading-relaxed">{playerAgent.uniqueAbility.description}</p>
            </div>
          </div>

          {/* Maps selector */}
          <div className="w-full lg:w-2/3 glass-panel p-6 md:p-8 flex flex-col gap-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-2xl font-semibold font-mono text-white glow-text-cyan">
                2. SELECCIONAR ESCENARIO
              </h2>
              <p className="text-slate-400 text-sm">
                El mapa alterará dinámicamente tus atributos y el entorno durante el combate.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {maps.map((map) => {
                const theme = MAP_THEMES[map.name] || { icon: '🗺️', clr: 'var(--clr-cyan)' };
                return (
                  <button 
                    key={map.name}
                    disabled={isGenerating}
                    onClick={() => handleStartCombat(map)}
                    className="flex flex-col items-center justify-start text-center p-4 rounded-xl border border-slate-800 bg-slate-950/50 hover:bg-slate-900/50 hover:border-cyan-500/50 transition-all duration-300 cursor-pointer disabled:opacity-50 group"
                  >
                    <span className="text-4xl mb-3 group-hover:scale-110 transition-transform">{theme.icon}</span>
                    <h3 className="font-bold text-sm text-white mb-2 font-mono" style={{ color: theme.clr }}>{map.name}</h3>
                    <p className="text-slate-400 text-[11px] leading-relaxed mb-3 flex-grow">{map.impactDescription}</p>
                    
                    <div className="w-full flex flex-wrap gap-1 justify-center mt-auto">
                      {map.tags.map(t => (
                        <span key={t} className="text-[9px] font-mono bg-slate-900 border border-slate-800 text-slate-500 px-1 py-0.5 rounded">
                          {t}
                        </span>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>

            {isGenerating && (
              <div className="flex flex-col items-center justify-center p-4 gap-2">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-cyan-500"></div>
                <p className="text-xs font-mono text-cyan-400 animate-pulse">
                  Generando oponente de la CPU...
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* -------------------- 3. SCREEN: ARENA -------------------- */}
      {screen === 'arena' && playerAgent && cpuAgent && selectedMap && (
        <div className="w-full max-w-6xl flex flex-col gap-6">
          
          {/* Arena Top info */}
          <div className="glass-panel p-4 flex flex-col md:flex-row justify-between items-center gap-4 text-center md:text-left">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{MAP_THEMES[selectedMap.name]?.icon || '🗺️'}</span>
              <div>
                <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest">Escenario Activo</span>
                <h3 className="font-bold text-white font-mono text-sm uppercase">{selectedMap.name}</h3>
              </div>
            </div>
            
            <div className="flex gap-4 text-xs font-mono text-slate-500">
              {Object.entries(selectedMap.statsModifiers).map(([stat, val]) => (
                <span key={stat} className={val < 0 ? 'text-red-400' : 'text-green-400'}>
                  {stat.toUpperCase()}: {val > 0 ? `+${val}` : val}
                </span>
              ))}
            </div>

            <div className="bg-cyan-950/70 border border-cyan-800 px-4 py-2 rounded-lg font-mono text-sm text-cyan-400 font-bold">
              RONDA {round}
            </div>
          </div>

          {/* Cards combat grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* Player Agent Card */}
            <div className={`player-card-container glass-panel p-6 flex flex-col gap-4 relative overflow-hidden transition-all duration-200 ${flashPlayer ? 'damage-flash' : ''}`}>
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest">Tu Agente</span>
                  <h3 className="text-2xl font-bold text-white">{playerAgent.name}</h3>
                  <span className="text-[10px] bg-purple-950/80 border border-purple-800 px-1.5 py-0.5 rounded text-purple-300 font-mono mt-1 inline-block">
                    {ARCHETYPE_LABELS[playerAgent.archetype] || playerAgent.archetype}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-white">{playerAgent.currentHp}/100 HP</span>
                </div>
              </div>

              {/* Speech bubble */}
              <div className="speech-bubble mb-2">
                "{playerBubble}"
              </div>

              {/* HP bar */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>PUNTOS DE VIDA</span>
                  <span>{playerAgent.currentHp}%</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-green-500 transition-all duration-500"
                    style={{ width: `${playerAgent.currentHp}%` }}
                  ></div>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>ESTADO DE CONFIANZA</span>
                  <span>{playerAgent.confidence}/100</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-700 to-purple-500 transition-all duration-500"
                    style={{ width: `${playerAgent.confidence}%` }}
                  ></div>
                </div>
              </div>

              {/* Ability & Stats list */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-xs">
                  <span className="font-mono text-cyan-400 font-bold block mb-1">⚡ HABILIDAD ÚNICA</span>
                  <span className="font-bold text-slate-200 block mb-0.5">{playerAgent.uniqueAbility.name}</span>
                  <p className="text-slate-400 text-[10px] leading-relaxed">{playerAgent.uniqueAbility.description}</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-xs flex flex-col gap-1.5 font-mono">
                  <span className="text-purple-400 font-bold block text-[10px] tracking-wider mb-0.5">ATRIBUTOS</span>
                  {Object.entries(playerAgent.stats).map(([stat, val]) => (
                    <div key={stat} className="flex justify-between text-[11px] text-slate-400">
                      <span className="capitalize">{stat}:</span>
                      <span className="text-white font-bold">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CPU Agent Card */}
            <div className={`cpu-card-container glass-panel p-6 flex flex-col gap-4 relative overflow-hidden transition-all duration-200 ${flashCpu ? 'damage-flash' : ''}`}>
              <div className="flex justify-between items-start border-b border-slate-800 pb-3">
                <div>
                  <span className="text-[10px] font-mono text-red-400 uppercase tracking-widest">Oponente (CPU)</span>
                  <h3 className="text-2xl font-bold text-white">{cpuAgent.name}</h3>
                  <span className="text-[10px] bg-red-950/80 border border-red-900 px-1.5 py-0.5 rounded text-red-300 font-mono mt-1 inline-block">
                    {ARCHETYPE_LABELS[cpuAgent.archetype] || cpuAgent.archetype}
                  </span>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-mono font-bold text-white">{cpuAgent.currentHp}/100 HP</span>
                </div>
              </div>

              {/* Speech bubble */}
              <div className="speech-bubble speech-bubble-cpu mb-2 self-end">
                "{cpuBubble}"
              </div>

              {/* HP bar */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>PUNTOS DE VIDA</span>
                  <span>{cpuAgent.currentHp}%</span>
                </div>
                <div className="w-full bg-slate-950 h-3 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-red-600 via-orange-500 to-green-500 transition-all duration-500"
                    style={{ width: `${cpuAgent.currentHp}%` }}
                  ></div>
                </div>
              </div>

              {/* Confidence bar */}
              <div className="flex flex-col gap-1">
                <div className="flex justify-between text-xs font-mono text-slate-400">
                  <span>ESTADO DE CONFIANZA</span>
                  <span>{cpuAgent.confidence}/100</span>
                </div>
                <div className="w-full bg-slate-950 h-2.5 rounded-full overflow-hidden border border-slate-800">
                  <div 
                    className="h-full bg-gradient-to-r from-indigo-700 to-purple-500 transition-all duration-500"
                    style={{ width: `${cpuAgent.confidence}%` }}
                  ></div>
                </div>
              </div>

              {/* Ability & Stats list */}
              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-xs">
                  <span className="font-mono text-cyan-400 font-bold block mb-1">⚡ HABILIDAD ÚNICA</span>
                  <span className="font-bold text-slate-200 block mb-0.5">{cpuAgent.uniqueAbility.name}</span>
                  <p className="text-slate-400 text-[10px] leading-relaxed">{cpuAgent.uniqueAbility.description}</p>
                </div>
                <div className="bg-slate-950/40 border border-slate-800/80 p-3 rounded-lg text-xs flex flex-col gap-1.5 font-mono">
                  <span className="text-red-400 font-bold block text-[10px] tracking-wider mb-0.5">ATRIBUTOS</span>
                  {Object.entries(cpuAgent.stats).map(([stat, val]) => (
                    <div key={stat} className="flex justify-between text-[11px] text-slate-400">
                      <span className="capitalize">{stat}:</span>
                      <span className="text-white font-bold">{val}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* Console / Narrator and Action form */}
          <div className="w-full glass-panel p-6 flex flex-col gap-4">
            <h4 className="text-xs font-mono font-bold text-slate-400 uppercase tracking-widest">
              Bitácora del Turno Actual
            </h4>

            {/* Narrator Display */}
            <div className="bg-black/80 border border-slate-800 p-4 rounded-xl font-mono text-sm leading-relaxed text-slate-300 min-h-[100px] flex items-center justify-start relative overflow-hidden">
              <div className="console-terminal-text">
                <span className="text-cyan-400 mr-2">&gt;</span>
                {narrativeHistory[narrativeHistory.length - 1]}
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleExecuteRound} className="flex flex-col md:flex-row gap-3 items-center">
              <input 
                type="text"
                disabled={isFighting}
                value={playerActionPrompt}
                onChange={(e) => setPlayerActionPrompt(e.target.value)}
                placeholder="Escribe la orden táctica para tu agente (ej: 'Busco refugio tras las cajas y disparo mi bláster')..."
                className="flex-grow w-full bg-slate-950/80 border border-slate-850 hover:border-slate-700 focus:border-cyan-500 text-white rounded-lg px-4 py-3 outline-none text-sm font-mono placeholder:text-slate-600 transition"
              />
              <button 
                type="submit"
                disabled={isFighting || !playerActionPrompt.trim()}
                className="w-full md:w-auto btn-neon btn-neon-cyan flex justify-center items-center gap-2 disabled:opacity-50 disabled:pointer-events-none"
              >
                {isFighting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-black border-t-transparent"></div>
                    <span>Procesando...</span>
                  </>
                ) : (
                  <span>Transmitir Orden</span>
                )}
              </button>
            </form>

            {/* Show Math log toggler */}
            <div className="mt-2 border-t border-slate-850 pt-4">
              <button 
                type="button" 
                onClick={() => setShowMathLog(!showMathLog)}
                className="text-[11px] font-mono text-slate-500 hover:text-slate-300 flex items-center gap-1 cursor-pointer"
              >
                {showMathLog ? '▼ Ocultar Registro Físico' : '► Mostrar Registro Físico (Dados y Fórmulas)'}
              </button>

              {showMathLog && (
                <div className="bg-slate-950/80 border border-slate-900 rounded-lg p-3 mt-2 font-mono text-[10px] text-slate-400 max-h-[160px] overflow-y-auto leading-relaxed flex flex-col gap-1">
                  {mathLogs.length === 0 ? (
                    <span className="italic text-slate-600">No hay registros de combate aún.</span>
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
      )}

      {/* -------------------- 4. SCREEN: RESULT -------------------- */}
      {screen === 'result' && playerAgent && cpuAgent && (
        <div className="w-full max-w-lg glass-panel p-8 text-center flex flex-col items-center gap-6">
          <span className="text-6xl">
            {winner === 'player' ? '🏆' : winner === 'cpu' ? '💀' : '🤝'}
          </span>

          <div className="flex flex-col gap-1">
            <h2 className="text-3xl font-extrabold font-mono uppercase tracking-widest text-white">
              {winner === 'player' ? '¡VICTORIA!' : winner === 'cpu' ? '¡DERROTA!' : '¡EMPATE!'}
            </h2>
            <p className="text-slate-400 text-sm font-mono mt-1">
              El combate ha concluido tras {round - 1} rondas.
            </p>
          </div>

          <div className="w-full bg-slate-950/50 border border-slate-850 p-4 rounded-xl flex flex-col gap-3 font-mono text-xs text-left">
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Tu Agente:</span>
              <span className="text-white font-bold">{playerAgent.name} ({playerAgent.currentHp} HP)</span>
            </div>
            <div className="flex justify-between border-b border-slate-900 pb-2">
              <span className="text-slate-500">Oponente CPU:</span>
              <span className="text-white font-bold">{cpuAgent.name} ({cpuAgent.currentHp} HP)</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Escenario:</span>
              <span className="text-cyan-400 font-bold">{selectedMap?.name}</span>
            </div>
          </div>

          <button 
            onClick={handleResetGame}
            className="w-full btn-neon btn-neon-purple mt-4"
          >
            Jugar de Nuevo
          </button>
        </div>
      )}
    </div>
  );
}

// Sub-component: Form for character creation
interface CharacterCreatorFormProps {
  onSubmit: (prompt: string) => void;
  isLoading: boolean;
}

function CharacterCreatorForm({ onSubmit, isLoading }: CharacterCreatorFormProps) {
  const [promptVal, setPromptVal] = useState('');
  
  const examples = [
    'Un ciborg silencioso experto en infiltración y dagas.',
    'Un paladín de acero pesado que defiende con su escudo gigante.',
    'Un hacker errático y miedoso con drones de soporte táctico.',
    'Una cazarrecompensas letal con blásters de rango y reflejos rápidos.'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptVal.trim() || isLoading) return;
    onSubmit(promptVal);
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <textarea 
        disabled={isLoading}
        value={promptVal}
        onChange={(e) => setPromptVal(e.target.value)}
        rows={3}
        placeholder="Ej: Un androide de combate pesado con armadura reforzada, lento pero con una fuerza destructiva formidable..."
        className="w-full bg-slate-950/80 border border-slate-800 hover:border-slate-700 focus:border-purple-500 text-white rounded-xl p-4 outline-none text-sm font-mono placeholder:text-slate-700 transition"
      />

      <div className="flex flex-col gap-2">
        <span className="text-slate-600 text-[10px] font-mono font-bold uppercase tracking-widest">
          Ideas / Conceptos de ejemplo:
        </span>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button 
              key={ex}
              type="button"
              disabled={isLoading}
              onClick={() => setPromptVal(ex)}
              className="text-[10px] font-mono bg-slate-950 hover:bg-slate-900 border border-slate-900 hover:border-slate-800 text-slate-500 hover:text-slate-300 px-2 py-1 rounded-md transition cursor-pointer"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <button 
        type="submit"
        disabled={isLoading || !promptVal.trim()}
        className="w-full btn-neon btn-neon-purple mt-2 disabled:opacity-50 disabled:pointer-events-none"
      >
        Construir Ficha
      </button>
    </form>
  );
}
