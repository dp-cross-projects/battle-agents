# Guía de Desarrollo y Especificación Técnica: Battle Agents (Fase 1)

Este documento sirve como la guía definitiva de desarrollo para la **Fase 1** del videojuego "Battle Agents". Recopila todas las mecánicas, fórmulas matemáticas, integraciones de IA, reglas de moderación y sistemas de tolerancia a fallos que se acordaron durante la fase de diseño.

---

## 1. Arquitectura del Sistema (Fase 1)

Para la Fase 1, el juego será una aplicación de consola interactiva (`CLI`) construida en **Node.js con TypeScript**. Toda la lógica está modularizada para facilitar la migración a un servidor de WebSockets en la Fase 2.

```
src/
├── core/
│   ├── CombatEngine.ts      # Matemáticas de combate y resolución de turnos
│   ├── CharacterCreator.ts  # Generador de personajes basado en prompts de IA
│   └── SafetyFilter.ts      # Moderador de acciones (+18)
├── providers/
│   ├── LLMProvider.ts       # Interfaz común de IA
│   ├── GeminiProvider.ts    # Implementación para Google Gemini API
│   └── OllamaProvider.ts    # Implementación para Ollama (modelos locales)
├── types/
│   └── index.ts             # Definición de interfaces y tipos
├── index.ts                 # Bucle principal de juego (CLI)
└── config.ts                # Configuraciones (API keys, endpoints, selección de LLM)
```

---

## 2. Abstracción del Cliente de IA (LLM)

El sistema soporta indistintamente el uso de modelos locales a través de **Ollama** y modelos en la nube mediante **Google Gemini**, utilizando una interfaz común `LLMProvider`.

```typescript
export interface LLMProvider {
  /**
   * Genera texto plano a partir de un prompt e instrucción de sistema.
   */
  generateText(prompt: string, systemInstruction?: string): Promise<string>;

  /**
   * Genera datos estructurados en formato JSON garantizando que cumplan el esquema provisto.
   */
  generateStructuredJSON<T>(prompt: string, schema: any, systemInstruction?: string): Promise<T>;
}
```

* **OllamaProvider:** Apunta a `http://localhost:11434/api/generate` (o `/api/chat`). Estructura el JSON inyectando instrucciones de formato muy estrictas y saneando la salida mediante expresiones regulares si el modelo local no soporta JSON Mode nativo.
* **GeminiProvider:** Usa la biblioteca `@google/generative-ai`. Aprovecha el parámetro `responseMimeType: "application/json"` y `responseSchema` de Gemini para garantizar que la respuesta cumpla exactamente con el tipo TypeScript esperado.

---

## 3. Creación Balancada de Fichas (Battle Agents)

El jugador crea su agente escribiendo un único prompt de descripción narrativa. 

### Reglas de la Ficha
* **HP Base:** Todo personaje inicia con exactamente **100 HP max / 100 HP actuales**.
* **Confianza Inicial:** Inicia en **50** (en una escala de 0 a 100).
* **Distribución de Atributos:** La IA de creación lee el prompt y reparte **exactamente 100 puntos** entre los siguientes 5 atributos base. Ningún atributo puede tener menos de **5 puntos** ni más de **50 puntos**.

### Atributos Base
1. **Fuerza (Strength):** Modifica el daño físico cuerpo a cuerpo.
2. **Agilidad (Agility):** Afecta la probabilidad de esquiva y la iniciativa.
3. **Percepción (Perception):** Afecta la precisión con ataques de rango (distancia).
4. **Resiliencia (Resilience):** Reduce directamente el daño recibido en combate.
5. **Inteligencia (Intelligence):** Utilizado para hackeo, uso de gadgets y efectividad de habilidades tácticas.

### Ejemplo de JSON de Ficha Generada
```json
{
  "name": "Kaelen Vex",
  "archetype": "cobarde_sarcastico",
  "stats": {
    "strength": 10,
    "agility": 35,
    "perception": 25,
    "resilience": 10,
    "intelligence": 20
  },
  "maxHp": 100,
  "currentHp": 100,
  "confidence": 50,
  "uniqueAbility": {
    "name": "Cortina de Humo",
    "description": "Una vez por combate, si su HP cae por debajo de 30, Kaelen lanza una granada de humo que anula el daño del siguiente ataque de rango."
  }
}
```

---

## 4. Moderación de Contenido (+18)

Antes de pasar cualquier acción al filtro de la ficha o al narrador, se procesa a través del `SafetyFilter`.

### Reglas de Moderación
Se banean acciones que involucren:
* Violencia física explícita no competitiva (ej: torturas, mutilaciones descriptivas explícitas).
* Agresiones o insinuaciones de índole sexual.
* Insultos y discursos de odio explícitos.
* Intentos de ganar de forma automática rompiendo las reglas del juego (ej: *"Esquivo todo y gano de un golpe"*).

### Consecuencia Mecánica
* Si se detecta una infracción, la acción del turno es **bloqueada** y se reemplaza por una acción fallida.
* El personaje reacciona con decepción o enfado hacia su "operador".
* **Penalización de Confianza:** Se restan automáticamente **-15 puntos** de confianza al agente por intentar forzarlo a realizar actos contrarios a su ética o lógica.

---

## 5. Escenarios de Combate (Variabilidad)

La Fase 1 incluye 3 escenarios con modificadores fijos que alteran las capacidades físicas de los agentes durante la resolución matemática del combate:

| Escenario | Modificadores de Stats | Tags Ambientales | Comportamiento Táctico |
| :--- | :--- | :--- | :--- |
| **Coliseo de Acero** | Ninguno | `[cerrado, plano, iluminado]` | Combate neutral, sin ventajas ni penalizaciones. |
| **Pantano Neblinoso** | Agilidad `-10`, Percepción `-10`, Resiliencia `+5` | `[humedad, niebla_densa, fango]` | Dificulta la evasión y la puntería. El lodo denso absorbe golpes (+Resiliencia). |
| **Fábrica Abandonada** | Inteligencia `+10`, Fuerza `+5`, Percepción `-5` | `[maquinaria, cobertura, sombras]` | Potencia tácticas tecnológicas/hackeo. Chatarra utilizable como arma (+Fuerza). |

---

## 6. Motor de Combate Matemático y Fórmulas

Las acciones de combate se resuelven de forma matemática pura en el servidor (o script del motor) para evitar sesgos narrativos de la IA.

### Fórmulas del Turno
1. **Iniciativa (Quién actúa primero):**
   $$\text{Iniciativa} = (\text{Agility}_{\text{Modificada}} ) + \text{Random}(1 \text{ a } 20)$$
2. **Precisión vs Evasión (¿Impacta el ataque?):**
   * Para ataque de rango:
     $$\text{Probabilidad de Acierto} = 50\% + (\text{Perception}_{\text{Atacante}} \times 2) - (\text{Agility}_{\text{Defensor}} \times 2)$$
   * Para ataque cuerpo a cuerpo:
     $$\text{Probabilidad de Acierto} = 60\% + (\text{Strength}_{\text{Atacante}} \times 2) - (\text{Agility}_{\text{Defensor}} \times 2)$$
   * Se genera un número aleatorio entre 1 y 100. Si es menor o igual a la probabilidad de acierto, el golpe impacta.
3. **Cálculo de Daño:**
   $$\text{Daño Base} = \text{Stat Ofensivo Principal (Strength o Perception)} \times \text{Multiplicador de Acción (1.0 a 1.5)}$$
   $$\text{Daño Final} = \text{Daño Base} - (\text{Resilience}_{\text{Defensor}} \times 0.5)$$
   *(El daño final mínimo siempre será 1).*

### Impacto de la Confianza en las Acciones
* **Confianza Alta (> 70):** El agente tiene un `+5` de bonus en todas las tiradas de dados por su audacia y seguridad.
* **Confianza Baja (< 30):** El agente tiene un `15%` de probabilidad en cada turno de entrar en pánico o desacato. Si esto ocurre, ignora las órdenes agresivas del jugador y ejecuta una acción de repliegue o defensa instintiva (`dodge` / `defend`), además de aplicar un `-5` en todas sus tiradas debido a la inseguridad.

---

## 7. Tolerancia a Fallos y Continuidad (Fallbacks)

Para garantizar la estabilidad del combate, el motor cuenta con salvaguardas que capturan cualquier error del LLM (timeout, respuesta corrupta, desconexión de red) y aplican valores deterministas:

### Fallback del Filtro de la Ficha
Si el LLM no logra retornar el JSON estructurado de la acción adaptada:
1. El motor escanea el texto del prompt del jugador buscando términos clave como: *"esquivar", "escapar", "cubrirse", "defender"*.
2. Si los encuentra, asigna mecánicamente la acción: **`defend` (Defensa Básica)**.
3. De lo contrario, asigna: **`melee_attack` / `ranged_attack` (Ataque Estándar)** según el stat más alto del personaje.
4. Mensaje del personaje: *"El personaje se enfoca en el combate de forma instintiva."*

### Fallback del Narrador Central
Si la IA encargada de describir literariamente el turno falla o se agota el tiempo de espera:
1. El motor recupera el log matemático puro del turno resuelto (ej. *Kaelen atacó, infligió 12 daño a CPU, CPU tiene 88 HP*).
2. Genera un texto plano descriptivo usando una plantilla parametrizada:
   > **[Motor de Continuidad]** *Kaelen Vex ejecuta su acción y se enfrenta a su oponente. Tras evaluar los atributos y el entorno (Pantano Neblinoso), se determina que Kaelen Vex tiene éxito e inflige 12 de daño. HP de CPU: 88.*

---

## 8. Flujo del Turno Completo (Algoritmo)

```
Para cada turno de combate:
1. Leer prompt del Jugador Humano.
2. Generar acción de la CPU (IA).
3. Pasar prompt del humano por el SafetyFilter.
   -> Si falla seguridad: Clic de penalización de confianza (-15), acción = "Infracción", saltar al paso 5.
4. Enviar prompts de ambos agentes a sus respectivos Filtros de Ficha (IA).
   -> Si el Filtro falla: Aplicar Fallback de Ficha.
5. Calcular Matemáticas de Combate:
   -> Calcular modificadores del mapa.
   -> Determinar orden de iniciativa.
   -> Resolver impacto de ataques y daño final.
   -> Actualizar HP de los personajes y niveles de confianza.
6. Enviar resultados matemáticos a la IA del Narrador.
   -> Si la IA del Narrador falla: Generar texto plano usando el Fallback del Narrador.
7. Mostrar la narración resultante en la pantalla/consola.
8. Comprobar condiciones de victoria (HP <= 0).
```
