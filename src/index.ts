import readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { CONFIG } from './config.js';
import { LLMProvider } from './providers/LLMProvider.js';
import { GeminiProvider } from './providers/GeminiProvider.js';
import { OllamaProvider } from './providers/OllamaProvider.js';
import { CharacterCreator } from './core/CharacterCreator.js';
import { CombatEngine } from './core/CombatEngine.js';
import { BattleAgent, MapScenario } from './types/index.js';

async function main() {
  const rl = readline.createInterface({ input, output });
  console.clear();
  console.log('==================================================');
  console.log('           BATTLE AGENTS - FASE 1 (CLI)           ');
  console.log('==================================================\n');

  // 1. Initialize LLM Provider
  let provider: LLMProvider;
  console.log(`Configurando proveedor de IA: [${CONFIG.PROVIDER.toUpperCase()}]...`);

  if (CONFIG.PROVIDER === 'ollama') {
    provider = new OllamaProvider(CONFIG.OLLAMA_ENDPOINT, CONFIG.OLLAMA_MODEL);
    console.log(`Conectado a Ollama local (${CONFIG.OLLAMA_ENDPOINT}) usando modelo: ${CONFIG.OLLAMA_MODEL}\n`);
  } else {
    if (!CONFIG.GEMINI_API_KEY || CONFIG.GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY') {
      console.error('\n[Error] Clave API de Gemini no configurada.');
      console.error('Por favor, edita el archivo .env e ingresa una clave válida en GEMINI_API_KEY o cambia LLM_PROVIDER a "ollama".');
      rl.close();
      return;
    }
    provider = new GeminiProvider(CONFIG.GEMINI_API_KEY, CONFIG.GEMINI_MODEL);
    console.log(`Conectado a Google Gemini Cloud usando modelo: ${CONFIG.GEMINI_MODEL}\n`);
  }

  const creator = new CharacterCreator(provider);
  const engine = new CombatEngine(provider);

  // 2. Character Creation
  console.log('--- CREACIÓN DE TU BATTLE AGENT ---');
  const customNameInput = await rl.question('Nombre de tu agente (presiona Enter para generar uno aleatorio): ');
  const customName = customNameInput.trim() || undefined;

  let gender: 'hombre' | 'mujer' | undefined = undefined;
  while (true) {
    const genderInput = await rl.question('Género de tu agente (hombre/mujer o presiona Enter para aleatorio): ');
    const trimmed = genderInput.trim().toLowerCase();
    if (trimmed === '') {
      break;
    }
    if (trimmed === 'hombre' || trimmed === 'mujer') {
      gender = trimmed as 'hombre' | 'mujer';
      break;
    }
    console.log('Por favor ingresa "hombre" o "mujer" (o presiona Enter para aleatorio).');
  }

  console.log('\nDescribe la personalidad, historia y estilo de tu personaje.');
  console.log('Ejemplo: "Un sigiloso ciborg cazarrecompensas que usa armas de plasma y odia el contacto físico."');
  
  const description = await rl.question('\nConcepto de tu agente: ');
  console.log('\n[IA] Generando agente balanceado (100 puntos de atributos)...');

  let playerAgent: BattleAgent;
  try {
    playerAgent = await creator.createCharacter(description, customName, gender);
    printAgentSheet(playerAgent);
  } catch (error: any) {
    console.error('\n[Error] No se pudo generar el agente del jugador.');
    console.error(error.message);
    rl.close();
    return;
  }

  // 3. Enemy Generation
  console.log('\n[IA] Generando oponente automático (CPU)...');
  const enemyConcepts = [
    'Un bruto gladiador acorazado con un martillo gigante que rechaza la tecnología.',
    'Una sádica asesina cibernética armada con garras de nanobots y propulsores rápidos.',
    'Un androide médico defectuoso que usa químicos venenosos y tiene pánico a ser destruido.'
  ];
  const randomConcept = enemyConcepts[Math.floor(Math.random() * enemyConcepts.length)];

  let cpuAgent: BattleAgent;
  try {
    cpuAgent = await creator.createCharacter(randomConcept);
    console.log('\n--- AGENTE DEL OPONENTE (CPU) ---');
    printAgentSheet(cpuAgent);
  } catch (error: any) {
    console.error('\n[Error] No se pudo generar el agente de la CPU.');
    console.error(error.message);
    rl.close();
    return;
  }

  // 4. Map Selection
  console.log('\n--- SELECCIÓN DE ESCENARIO ---');
  CombatEngine.MAPS.forEach((map, index) => {
    console.log(`${index + 1}. ${map.name}`);
    console.log(`   Efectos: ${map.impactDescription}`);
    console.log(`   Tags: [${map.tags.join(', ')}]`);
  });

  let mapSelection = 0;
  while (mapSelection < 1 || mapSelection > CombatEngine.MAPS.length) {
    const inputSel = await rl.question(`\nSelecciona un escenario (1-${CombatEngine.MAPS.length}): `);
    mapSelection = parseInt(inputSel, 10);
  }
  const selectedMap = CombatEngine.MAPS[mapSelection - 1];
  console.log(`\nEscenario elegido: ${selectedMap.name}\n`);

  console.log('==================================================');
  console.log('             ¡QUE COMIENCE LA BATALLA!            ');
  console.log('==================================================\n');

  let round = 1;

  // 5. Combat Loop
  while (playerAgent.currentHp > 0 && cpuAgent.currentHp > 0) {
    console.log(`\n--- RONDA ${round} ---`);
    console.log(`${playerAgent.name} (Tú) | HP: ${playerAgent.currentHp}/100 | Confianza: ${playerAgent.confidence}/100`);
    console.log(`${cpuAgent.name} (CPU) | HP: ${cpuAgent.currentHp}/100 | Confianza: ${cpuAgent.confidence}/100`);
    
    // Read player action
    const playerPrompt = await rl.question(`\n¿Qué orden le das a ${playerAgent.name}? `);

    console.log('\n[IA] Procesando intenciones de los agentes...');

    // Generate CPU Raw Action
    const cpuPrompt = await engine.generateCPUPrompt(cpuAgent, playerAgent);

    // Roll low-confidence panic (15% chance if confidence < 30)
    const playerPanic = playerAgent.confidence < 30 && Math.random() < 0.15;
    const cpuPanic = cpuAgent.confidence < 30 && Math.random() < 0.15;

    if (playerPanic) {
      console.log(`⚠️  ${playerAgent.name} duda de tus órdenes por su baja confianza y entra en pánico.`);
    }
    if (cpuPanic) {
      console.log(`⚠️  ${cpuAgent.name} tiembla de pánico ante la situación.`);
    }

    // Filter actions through LLM (safety & character filter)
    const actionA = await engine.filterAgentAction(playerAgent, playerPrompt, selectedMap, playerPanic);
    const actionB = await engine.filterAgentAction(cpuAgent, cpuPrompt, selectedMap, cpuPanic);

    // Display adaptation & dialogs
    console.log(`\n💬 ${playerAgent.name} reacciona: "${actionA.verbal_reaction}"`);
    console.log(`   └ Acción adaptada: ${actionA.adapted_prompt}`);
    console.log(`💬 ${cpuAgent.name} reacciona: "${actionB.verbal_reaction}"`);
    console.log(`   └ Acción adaptada: ${actionB.adapted_prompt}`);

    // Resolve mathematics
    const roundResult = engine.resolveCombatTurn(playerAgent, actionA, cpuAgent, actionB, selectedMap);

    // Generate epic narrative
    console.log('\n[IA] Narrando resultado de la ronda...');
    const narration = await engine.generateNarrative(playerAgent, cpuAgent, roundResult, selectedMap);
    
    console.log('\n==================================================');
    console.log(narration);
    console.log('==================================================');

    // Show detailed math logs for visibility
    console.log('\n[Registro Matemático del Turno]');
    roundResult.mathLog.forEach(log => console.log(`  • ${log}`));

    round++;
  }

  // 6. Game Over
  console.log('\n==================================================');
  if (playerAgent.currentHp <= 0 && cpuAgent.currentHp <= 0) {
    console.log('💀 ¡DOBLE K.O.! Ambos contendientes cayeron en el fragor de la batalla.');
  } else if (playerAgent.currentHp > 0) {
    console.log(`🎉 ¡VICTORIA! ${playerAgent.name} ha derrotado a ${cpuAgent.name}.`);
  } else {
    console.log(`💀 DERROTA. ${cpuAgent.name} ha vencido a ${playerAgent.name}.`);
  }
  console.log('==================================================\n');

  rl.close();
}

function printAgentSheet(agent: BattleAgent) {
  console.log('==================================================');
  console.log(` Nombre:      ${agent.name}`);
  console.log(` Género:      ${agent.gender}`);
  console.log(` Arquetipo:  ${agent.archetype}`);
  console.log(` Personalidad: ${agent.personalityDescription}`);
  console.log('---------------- Atributos Base ------------------');
  console.log(` [Fuerza]     ${agent.stats.strength}`);
  console.log(` [Agilidad]   ${agent.stats.agility}`);
  console.log(` [Percepción] ${agent.stats.perception}`);
  console.log(` [Resiliencia]${agent.stats.resilience}`);
  console.log(` [Intel.]     ${agent.stats.intelligence}`);
  console.log('--------------------------------------------------');
  console.log(` Habilidad:   ${agent.uniqueAbility.name}`);
  console.log(`              ${agent.uniqueAbility.description}`);
  console.log('==================================================');
}

main().catch(err => {
  console.error('Ocurrió un error crítico durante la ejecución:', err);
});
