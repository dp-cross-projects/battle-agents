# Guía de Desarrollo y Especificación Técnica: Battle Agents (Fase 2)

Este documento es la especificación técnica y guía de desarrollo de la **Fase 2** del videojuego "Battle Agents". Recopila la arquitectura multijugador basada en Express y Socket.io, el esquema de datos en Prisma ORM para PostgreSQL, la integración de IA en tiempo real, el flujo de matchmaking PvP 1v1 y los componentes del frontend React.

---

## 1. Arquitectura del Sistema (Fase 2)

En la Fase 2, el sistema adopta una arquitectura de cliente-servidor con conexiones duales (REST API para gestión y WebSockets para juego activo):

- **REST API (Express):** Maneja tareas asíncronas tradicionales como inicio de sesión, registro de operadores, creación e historial de personajes.
- **WebSockets (Socket.io):** Maneja estados de alta frecuencia y baja latencia, como la cola de emparejamiento (matchmaking), la confirmación de acciones listas, y el chat de combate 1v1.
- **Base de Datos (Prisma + PostgreSQL):** Persistencia relacional de credenciales, estadísticas de agentes y bitácora física de combates finalizados.

```
├── prisma/
│   └── schema.prisma        # Modelos relacionales de base de datos
├── src/                     # Backend TypeScript
│   ├── core/                # Lógica del motor, creador de personajes y filtros
│   ├── providers/           # Proveedores de LLM (Ollama & Gemini)
│   ├── types/               # Tipos de TypeScript compartidos
│   ├── utils/               # Utilidades de autenticación y mapeadores
│   ├── server.ts            # Punto de entrada HTTP y WebSocket
│   └── db.ts                # Cliente prisma compartido
├── client/                  # Frontend Vite + React (TypeScript)
│   ├── src/
│   │   ├── App.tsx          # Pantalla principal y flujos de juego
│   │   ├── index.css        # Tokens CSS Cyberpunk y Glassmorphism
│   │   └── main.tsx         # Punto de entrada de React
│   └── vite.config.ts       # Configuración de Vite y WebSockets Proxy
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
