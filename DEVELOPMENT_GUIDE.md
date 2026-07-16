# Guía de Desarrollo y Especificación Técnica: Battle Agents (Fase 3)

Este documento es la especificación técnica y guía de desarrollo de la **Fase 3** del videojuego "Battle Agents". Recopila la arquitectura multijugador y el motor de combate con soporte para 5 mapas dinámicos, el sistema de 20 boosters con límites de uso (usos/golpes), la fase de draft interactiva en tiempo real y la arena de combate PvP.

---

## 1. Arquitectura del Sistema (Fase 3)

En la Fase 3, el sistema expande el motor de combate en memoria y añade endpoints y eventos de WebSocket para el equipamiento pre-combate (Draft Phase):

- **REST API (Express):** Maneja la gestión tradicional, inicio de sesión, listado de mapas, personajes, y la consulta de boosters disponibles (`GET /api/boosters`).
- **WebSockets (Socket.io):** Controla el matchmaking PvP 1v1, el envío simultáneo de borradores en la fase de draft, y el uso activo de boosters en cada ronda de la pelea en tiempo real.
- **Motor de Combate (CombatEngine):** Calcula las iniciativas, absorciones de daño de armaduras, consumo de cargas de armas y herramientas, e impactos ambientales sobre los atributos modificados.

```
├── prisma/
│   └── schema.prisma        # Modelos relacionales de base de datos
├── src/                     # Backend TypeScript
│   ├── core/                # Lógica del motor, catálogo de Boosters y filtros
│   │   ├── Boosters.ts      # [NUEVO] Base de datos de 20 boosters
│   │   ├── CombatEngine.ts  # Motor con 5 mapas y resolución de boosters
│   ├── providers/           # Proveedores de LLM (Ollama & Gemini)
│   ├── types/               # Tipos de TypeScript compartidos
│   ├── utils/               # Utilidades de autenticación y mapeadores
│   ├── server.ts            # Servidor HTTP, WebSocket y sesiones de combate CPU/PvP
│   └── db.ts                # Cliente prisma compartido
├── client/                  # Frontend Vite + React (TypeScript)
│   ├── src/
│   │   ├── App.tsx          # Pantallas de Auth, Lobby, Mapas, Draft y Arena
│   │   ├── index.css        # Tokens CSS Cyberpunk y Glassmorphism
│   └── vite.config.ts       # Configuración de Vite y proxy
```


---

## 2. Configuración de Base de Datos y Prisma

### Modelos de Datos (`prisma/schema.prisma`)

1. **User:** Almacena perfiles de operadores. Vincula relaciones `1:N` a agentes creados por el usuario y relaciones de combates en los que ha participado (como retador, oponente o ganador).
2. **Agent:** Contiene las estadísticas del personaje (Fuerza, Agilidad, Percepción, Resiliencia, Inteligencia). Almacena de forma persistente la **Confianza** base, la cual aumenta o disminuye al concluir un combate.
3. **Combat:** Guarda el histórico completo de cada combate. Incluye campos para el nombre del mapa, número de rondas, relaciones a los dos usuarios participantes, agentes involucrados, ganador y la bitácora matemática (`mathLog`) en formato de texto.

### Actualización del Cliente Prisma
Para regenerar los tipos estáticos de Prisma tras realizar modificaciones al archivo `schema.prisma`:
```bash
npx prisma generate
```

Para aplicar cambios directamente sobre tu base de datos PostgreSQL de desarrollo externa:
```bash
npx prisma db push
```

---

## 3. Autenticación y Criptografía Segura (`src/utils/auth.ts`)

Para evitar problemas de compilación binaria de librerías nativas (`bcrypt`) en entornos Windows, implementamos un sistema criptográfico autónomo basado en el módulo nativo de Node.js `crypto`:

- **Haseado de Contraseñas:** Usamos `crypto.pbkdf2Sync` con un salt aleatorio de 16 bytes e iteraciones controladas, almacenando el resultado en formato `salt:hash`.
- **Generación de Tokens de Sesión (JWT Alternativo):** Los tokens se estructuran como `userId.expiry.signature`. La firma se genera utilizando HMAC-SHA256 alimentado por una variable de entorno `JWT_SECRET`. Esto permite validar la identidad y expiración del operador en milisegundos sin dependencias externas.

---

## 4. Servidor de WebSockets y Matchmaking

Socket.io está integrado sobre el servidor HTTP de Express en `src/server.ts`. 

### Flujo de Matchmaking 1v1
1. Un socket cliente envía el evento `join_queue` con el `agentId` de su personaje seleccionado.
2. El servidor valida la identidad del operador mediante el token en el handshake y verifica que el agente le pertenezca.
3. El jugador es registrado en la cola de espera en memoria: `matchmakingQueue`.
4. El servidor ejecuta un chequeo de emparejamiento (`checkAndMatchPlayers`). Si hay al menos dos jugadores:
   - Se retiran de la cola.
   - Se crea un identificador único de combate (`combatId`).
   - Se escoge un escenario aleatorio de `CombatEngine.MAPS`.
   - Ambos sockets se unen a una sala común (`room-{combatId}`).
   - Se emite el evento `match_found` con toda la información necesaria del rival y el mapa.

### Flujo de Combate PvP por Turnos
Para evitar que un jugador obtenga ventaja respondiendo antes, el servidor implementa un búfer de acción simultánea:
1. El jugador envía su orden narrativa mediante el evento `submit_action`.
2. El servidor registra la acción del jugador en su sesión PvP correspondiente y emite un estado de preparación `player_ready_status` a la sala para actualizar la interfaz.
3. Cuando **ambos** jugadores han transmitido sus acciones, el servidor ejecuta la resolución:
   - Chequea el pánico (15% de probabilidad si la confianza es < 30).
   - Filtra y adapta las órdenes a través del LLM (`filterAgentAction`).
   - Resuelve el combate matemáticamente (`resolveCombatTurn`) calculando iniciativas, aciertos, evasión y daños.
   - Genera el relato de la ronda a través del LLM narrador (`generateNarrative`).
   - Emite el resultado `round_result` con las actualizaciones vitales a ambos clientes.
4. Si el HP de algún agente llega a `0`, se guardan los cambios emocionales (Confianza) de los personajes en la base de datos, se escribe el combate en la tabla de históricos, se destruye la sesión en memoria y se envía el resultado final.

---

## 5. Prevención de Stale Closures en el Cliente React

Debido a que el listener de Socket.io se registra al montar la conexión dentro de un efecto único, las funciones internas del evento tendían a capturar estados obsoletos (`stale closures`) de variables de React como `user` o `activeTab`.

Para resolver esto:
1. Pasamos el `currentUserId` directamente como parámetro a la función de conexión `connectSocket(token, currentUserId)` al recuperar el perfil.
2. Usamos **React Refs** (`isPlayer1Ref`, `activeTabRef`) para almacenar referencias mutables de lectura inmediata, asegurando que los oyentes del socket siempre lean los estados actualizados en cada disparo de evento sin re-declarar listeners.
3. Mapeamos la interfaz dinámicamente según el rol:
   - Indicador del Operador Local (Tú): `isPlayer1 ? p1Ready : p2Ready`.
   - Indicador del Operador Rival (Rival): `isPlayer1 ? p2Ready : p1Ready`.

---

## 6. Fase de Draft y Selección de Boosters (Fase 3)

La Fase 3 añade una capa estratégica de preparación donde el mapa de combate es revelado antes de elegir el equipamiento:

### Catálogo de Boosters
- Ubicación: `src/core/Boosters.ts`.
- Tipos de Boosters:
  - **Weapon**: Incrementan Fuerza/Percepción/Inteligencia. Consumen 1 de durabilidad al atacar en una ronda en la que se selecciona el arma activa.
  - **Armor Parts (Head, Torso, Arms, Legs)**: Bonificaciones pasivas continuas y reducción de daño plano. Pierden 1 durabilidad cuando el agente recibe daño.
  - **Tool**: Acciones activables antes de la iniciativa para sanar vida o alterar estados del rival.
- Las estadísticas persistentes no se alteran; todo el inventario de combate y el estado de durabilidades se gestionan **en memoria** dentro del servidor y se sincronizan ronda a ronda.

### Flujo de Sockets en el Draft
1. Tras el emparejamiento, el servidor transiciona la sesión a `draftPhase = true` y envía el evento `match_found`.
2. El cliente abre la pantalla `draft`, donde selecciona hasta 3 boosters (máximo).
3. Al presionar **Confirmar Equipamiento**, el cliente envía el evento `submit_draft` con la lista de IDs seleccionados.
4. El servidor registra la confirmación de ese jugador y emite `player_draft_status` a la sala para actualizar los indicadores.
5. Cuando ambos jugadores han confirmado, el servidor clona las instancias de los boosters, los asigna al jugador respectivo, desactiva `draftPhase` y emite `draft_completed` con los boosters resultantes.
6. El cliente React recibe `draft_completed`, desactiva el bloqueo de combate (`isFighting = false`) y carga la pantalla `arena`.

