# Roadmap de Desarrollo: Battle Agents

Este documento presenta la hoja de ruta detallada para el desarrollo incremental de **Battle Agents**, desde su concepción inicial como simulador de texto hasta convertirse en un juego de rol multijugador con gráficos premium e integración de voz.

```mermaid
graph TD
    F1[Fase 1: Motor Base & Simulación CLI] --> F2[Fase 2: WebSockets & Base de Datos 1v1]
    F2 --> F3[Fase 3: Mapas Estructurados & Equipamiento]
    F3 --> F4[Fase 4: Combate Grupal & Voz Bidireccional]
    F4 --> F5[F5: Interfaz Web Premium & Visuales]
    F5 --> F6[F6: Creadores & Eventos Dinámicos]
```

---

## Fase 1: Motor Core y Simulación de Texto (Local/CLI)
* **Objetivo:** Validar las matemáticas de combate, la generación balanceada y la interacción con IAs sin dependencias de red o interfaces complejas.
* **Componentes clave:**
  * **Creación de Fichas (100 puntos):** Entrada de un prompt descriptivo que la IA traduce a una distribución balanceada de 100 puntos de stats base y HP inicial de 100.
  * **Abstracción de LLM:** Interfaz unificada compatible con **Ollama** (modelos locales para desarrollo económico) y **Google Gemini** (producción).
  * **Moderación (+18):** Filtro de seguridad que banea contenido sensible, penalizando la confianza del agente.
  * **Mecanismos de Continuidad (Fallbacks):** Respuestas y simulaciones predefinidas en caso de caídas de red o JSONs inválidos del LLM.
  * **Simulador CLI:** Interfaz interactiva de consola para disputar combates contra una CPU controlada por IA.

## Fase 2: Servidor API, Base de Datos y WebSockets (1v1)
* **Objetivo:** Transformar la simulación local en un juego multijugador en tiempo real.
* **Componentes clave:**
  * **Servidor Backend:** API en Node.js (TypeScript) usando Fastify o Express.
  * **Conexión en Tiempo Real:** Integración de **Socket.io** para la sincronización del chat de combate y el envío simultáneo de turnos.
  * **Base de Datos Persistente:** Configuración de **PostgreSQL** (con Prisma ORM) para almacenar perfiles de usuario, el histórico de combates y las fichas de los personajes (acumulando el stat de Confianza).
  * **Matchmaking Básico:** Cola de espera para emparejar a dos jugadores activos en una sala de combate privada 1v1.

## Fase 3: Mapas Estructurados, Equipamiento y Draft
* **Objetivo:** Profundizar en la estrategia pre-combate y la influencia táctica del entorno.
* **Componentes clave:**
  * **Sistema de Mapas Avanzado:** Base de datos con múltiples escenarios con tags de entorno dinámicos (ej: *terreno_resbaladizo*, *conductores_electricos*).
  * **Sistema de Inventario:** Armas (cuerpo a cuerpo y rango) y armaduras con propiedades lógicas (ej: *Botas de Fango* que anulan penalizaciones de mapas de pantano).
  * **Fase de Draft (Preparación):** Revelado del mapa de combate y un temporizador de 1 minuto para que los jugadores seleccionen su equipamiento en base a los stats modificados y ventajas tácticas del escenario.

## Fase 4: Combate Grupal (2v2, 5v5) y Audio/Voz Bidireccional
* **Objetivo:** Escalar el juego a batallas tácticas de equipos e introducir una forma de comunicación más natural e inmersiva.
* **Componentes clave:**
  * **Lógica por Equipos:** Gestión de iniciativas compartidas, curación a aliados, aggro y ataques coordinados entre múltiples agentes de combate.
  * **Integración de Voz (STT/TTS):**
    * Los usuarios pueden hablar por micrófono (STT) y el motor interpreta la voz como prompts de combate.
    * Los agentes de IA responden con voz sintetizada (TTS) en tiempo real, reflejando su personalidad mediante tono y diálogos hablados.
    * Posibilidad de integrar modelos multimodales (ej: Gemini Multimodal Live API) para interacción directa por audio.

## Fase 5: Interfaz Web Premium (Visual & Animada)
* **Objetivo:** Sustituir la consola de texto por una interfaz gráfica espectacular de nivel comercial.
* **Componentes clave:**
  * **Frontend Moderno:** SPA con React, Vite o Next.js.
  * **Aesthethics:** Diseño premium con temática cyberpunk/futurista oscura, uso de gradientes brillantes, glassmorphism y fuentes tipográficas personalizadas de Google Fonts.
  * **Componentes Interactivos:**
    * Visualizador de estadísticas dinámico.
    * Log de combate animado con efectos al recibir daño o esquivar.
    * Ilustraciones de cartas de agentes generadas previamente por IA.
  * **Accesibilidad y SEO:** Optimización de carga, responsive layout y etiquetas de accesibilidad completas.

## Fase 6: Creador de Contenido y Eventos del Máster
* **Objetivo:** Dar longevidad al juego permitiendo a la comunidad expandirlo y añadiendo factores dinámicos impredecibles.
* **Componentes clave:**
  * **Editor Web de Cartas y Mapas:** Panel visual para que los usuarios creen y compartan sus propios escenarios, armas y agentes respetando las reglas de balance.
  * **Eventos del Máster de IA:** Eventos aleatorios a mitad de combate (cambios climáticos, caídas de suministros, interferencias electromagnéticas) decididos dinámicamente por la IA Máster para romper la monotonía del juego.
