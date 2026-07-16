# Battle Agents - Fase 2 (Multijugador, Base de Datos y WebSockets)

Battle Agents es un videojuego de rol y estrategia táctica en tiempo real potenciado por Inteligencia Artificial. En esta **Fase 2**, el juego transiciona de un simulador local a un completo ecosistema online multijugador 1v1 en tiempo real. 

El sistema permite registrar operadores, crear y listar agentes de batalla persistentes guardados en base de datos PostgreSQL, unirse a colas de matchmaking automático, chatear con el oponente y acumular Confianza tras cada combate.

---

## Características Implementadas (Fase 2)

1. **Autenticación de Operadores (Sesiones Seguras):** Registro e inicio de sesión seguro con cifrado de contraseñas nativo (`pbkdf2Sync`) y generación de tokens de acceso (`HMAC-SHA256`).
2. **Base de Datos Relacional Persistente (Prisma ORM & PostgreSQL):**
   - **Fichas Persistentes:** Creación de agentes de batalla en base de datos. Se almacena su nombre, género, arquetipo, estadísticas y su nivel de **Confianza** acumulativo.
   - **Histórico de Combates:** Registro detallado de cada partida terminada, incluyendo número de rondas, mapas, participantes y la bitácora física de resolución.
3. **Conexiones en Tiempo Real (Socket.io):**
   - **Lobby Neural:** Conexión websocket autenticada por token de sesión.
   - **Matchmaking 1v1:** Cola en memoria que empareja operadores disponibles, inicia una sala websocket privada y selecciona un escenario aleatorio.
   - **Resolución Simultánea:** En PvP, el servidor espera las acciones de ambos operadores antes de ejecutar el turno matemático y la narración del LLM.
   - **Chat del Operador:** Enlace de chat directo en tiempo real dentro de la arena de combate PvP.
4. **Modo Práctica (vs CPU):** Se mantiene el modo original contra la CPU para que los operadores puedan entrenar a sus agentes de forma individual (los resultados de CPU también actualizan la confianza y guardan historial).
5. **Ejecución Modernizada con TSX:** Reemplazo de `ts-node` por `tsx` para garantizar total compatibilidad con TypeScript 7 y Node.js 22.

---

## Estructura del Código

```
├── prisma/
│   └── schema.prisma        # Modelos de base de datos (User, Agent, Combat)
├── src/                     # Backend (TypeScript)
│   ├── core/
│   │   ├── CharacterCreator.ts  # Creador de agentes por IA
│   │   ├── CombatEngine.ts      # Resolución matemática y narrativa
│   │   └── SafetyFilter.ts      # Filtro de palabras (+18)
│   ├── providers/
│   │   ├── LLMProvider.ts       # Proveedor de IA común
│   │   ├── GeminiProvider.ts    # Google Gemini Cloud
│   │   └── OllamaProvider.ts    # Ollama Local
│   ├── utils/
│   │   ├── auth.ts              # Hashing, verificación y firma de tokens
│   │   └── mappers.ts           # Mapeo de DB Agent a BattleAgent
│   ├── db.ts                # Inicialización de PrismaClient
│   ├── config.ts            # Variables de entorno
│   ├── server.ts            # Servidor Express + Socket.io y lógica PvP
│   └── index.ts             # CLI original
├── client/                  # Frontend (Vite + React + TS)
│   ├── src/
│   │   ├── App.tsx          # Pantallas de Auth, Lobby, Matchmaking y Arena PvP
│   │   ├── index.css        # Estilos visuales Cyberpunk/Sci-Fi
│   │   └── main.tsx         # Punto de entrada de React
│   └── vite.config.ts       # Configuración de Vite con proxys REST y WebSockets
```

---

## Instalación y Configuración

1. **Instalar Dependencias:**
   ```bash
   npm install
   ```

2. **Configurar Variables de Entorno (`.env`):**
   Crea un archivo `.env` en la raíz del proyecto basándote en `.env.example`:
   ```env
   # Proveedor de IA: 'gemini' o 'ollama'
   LLM_PROVIDER=ollama
   OLLAMA_ENDPOINT=http://localhost:11434
   OLLAMA_MODEL=gemma4:e4b

   # URL de conexión a la Base de Datos PostgreSQL
   DATABASE_URL="postgresql://usuario:contraseña@servidor-externo:5432/battleagents?schema=public"

   # Clave secreta para firmar sesiones
   JWT_SECRET="clave-secreta-cyberpunk"
   ```

3. **Desplegar Base de Datos (Prisma):**
   Ejecuta las migraciones o empuja la estructura de base de datos a tu instancia PostgreSQL:
   ```bash
   npx prisma db push
   ```

---

## Ejecución en Desarrollo

Para levantar el entorno completo de desarrollo:

1. **Iniciar el Servidor Backend:**
   ```bash
   npm run dev:server
   ```
   *El servidor levantará en `http://localhost:3000` con REST API y WebSockets Socket.io.*

2. **Iniciar el Servidor Frontend (Vite):**
   ```bash
   npm run dev:client
   ```
   *La SPA levantará en `http://localhost:5173`. Las llamadas a `/api` y `/socket.io` se redirigen mediante proxy al puerto 3000.*

---

## Compilación para Producción

1. **Compilar Cliente y Servidor:**
   ```bash
   npm run build
   ```
   *Este comando compilará el cliente React en `client/dist` y el servidor TypeScript en `dist/`.*

2. **Iniciar en Producción:**
   ```bash
   npm start
   ```

---

## Cómo Probar el Flujo PvP 1v1

1. Inicia el servidor y el cliente.
2. Abre dos ventanas o pestañas en `http://localhost:5173`.
3. Regístrate e inicia sesión con dos operadores diferentes (ej: `OperadorA` y `OperadorB`).
4. En cada panel de control, crea tu propio agente de batalla ingresando una descripción (ej: *"Un paladín de acero pesado"*).
5. Selecciona el agente creado y haz clic en **BUSCAR PARTIDA ONLINE** en ambas ventanas.
6. El matchmaking las emparejará y se cargará la arena en el mismo escenario.
7. Comunícate con tu rival usando la pestaña de **CHAT DE OPERADORES**.
8. Escribe órdenes narrativas para tus agentes en cada ventana y presiona **TRANSMITIR ORDEN**. Una vez que ambos hayan transmitido, se calculará el resultado de la ronda y se mostrará la narración épica en tiempo real.
