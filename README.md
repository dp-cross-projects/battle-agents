# Battle Agents - Fase 1

Battle Agents es un videojuego de rol y estrategia potenciado por Inteligencia Artificial. En esta Fase 1, se presenta un simulador de combate interactivo por consola (CLI) donde creas una ficha de personaje autónoma basada en un prompt narrativo y la enfrentas en combate táctico contra la CPU.

El juego está diseñado con una arquitectura modular en Node.js y TypeScript, lista para escalar a WebSockets multijugador en fases posteriores.

---

## Características de la Fase 1

1. **Creación de Agentes con Prompt Único:** Describe tu personaje e Inteligencia Artificial distribuirá **exactamente 100 puntos** entre sus stats base y fijará su HP inicial en **100 HP**.
2. **Abstracción Polymorphic de LLM:** Configurable para funcionar de forma local con **Ollama** (modelos de código abierto) o en la nube con **Google Gemini**.
3. **Filtro de Ficha y Personalidad:** Las órdenes del jugador son adaptadas realistamente en base al arquetipo del agente, sus estadísticas y su nivel de confianza actual.
4. **Filtro de Moderación (+18):** Bloquea automáticamente intentos de descripciones violentas extremas, gore o sexuales, restando confianza al agente como consecuencia por forzarlo.
5. **Combate con Resolución Matemática:** El motor calcula iniciativas, probabilidades de acierto e impactos utilizando fórmulas matemáticas objetivas, sin sesgos narrativos de la IA.
6. **Mecanismo de Continuidad (Fallbacks):** Si el LLM local o remoto falla, el motor aplica acciones básicas y plantillas de narración para evitar que el combate se congele.
7. **Variabilidad en Escenarios:** Juega en uno de los 3 mapas iniciales (*Coliseo de Acero*, *Pantano Neblinoso* o *Fábrica Abandonada*), alterando dinámicamente los atributos de los luchadores.

---

## Estructura del Código

```
src/
├── core/
│   ├── CharacterCreator.ts  # Crea fichas y normaliza atributos a 100
│   ├── CombatEngine.ts      # Resolución matemática del combate, mapas y narración
│   └── SafetyFilter.ts      # Filtro de palabras +18 y moderación
├── providers/
│   ├── LLMProvider.ts       # Interfaz común de proveedor de IA
│   ├── GeminiProvider.ts    # Conexión con Google Gemini API
│   └── OllamaProvider.ts    # Conexión con Ollama local
├── types/
│   └── index.ts             # Tipos de datos e interfaces de TypeScript
├── config.ts                # Gestión de variables de entorno (.env)
└── index.ts                 # Bucle principal interactivo del juego (CLI)
```

---

## Requisitos Previos

* **Node.js** (versión 18.0 o superior recomendada).
* **npm** (incluido con Node.js).
* (Opcional) **Ollama** corriendo localmente si no deseas utilizar la API de Google Gemini.

---

## Instalación y Configuración

1. **Clonar/Instalar Dependencias:**
   ```bash
   npm install
   ```

2. **Configurar el Entorno:**
   Copia el archivo de plantilla `.env.example` y crea tu propio `.env` en la raíz del proyecto:
   ```bash
   cp .env.example .env
   ```

   Abre el archivo `.env` y configura el proveedor que deseas utilizar:
   * **Para Google Gemini:**
     ```env
     LLM_PROVIDER=gemini
     GEMINI_API_KEY=tu_clave_de_api_aqui
     GEMINI_MODEL=gemini-2.5-flash
     ```
   * **Para Ollama (Local):**
     ```env
     LLM_PROVIDER=ollama
     OLLAMA_ENDPOINT=http://localhost:11434
     OLLAMA_MODEL=llama3:8b  # Asegúrate de haber ejecutado: ollama run llama3:8b
     ```

---

## Cómo Jugar

1. **Compilar el Proyecto:**
   ```bash
   npm run build
   ```

2. **Iniciar la Batalla:**
   ```bash
   npm start
   ```

3. **Instrucciones durante la Partida:**
   * Describe la personalidad e historia del personaje a crear (ej: *"Un mercenario ágil y sarcástico experto en armas de fuego que prefiere no arriesgarse"*).
   * Selecciona uno de los tres escenarios tácticos.
   * En cada ronda, introduce la acción narrativa que deseas que tu agente ejecute (ej: *"Aprovecho la cobertura de las sombras de la fábrica para flanquear e intentar hackear sus sistemas"*).

---

## Documentación Adicional

* Consulta el archivo [ROADMAP.md](file:///c:/server/proyectos/battle-agents/roadmap.md) para ver la planificación a largo plazo de las siguientes fases de desarrollo.
* Consulta el archivo [DEVELOPMENT_GUIDE.md](file:///c:/server/proyectos/battle-agents/DEVELOPMENT_GUIDE.md) para estudiar a fondo las fórmulas matemáticas y el flujo de orquestación de la IA.
