# Battle Agents - Fase 4 (Audio/Voz Bidireccional, Mapas, Equipamiento y WebSockets)

Battle Agents es un videojuego de rol y estrategia táctica en tiempo real potenciado por Inteligencia Artificial. En esta **Fase 4**, el juego da un salto inmersivo incorporando control por voz en tiempo real y síntesis de voz personalizada para dotar de voz física a los diálogos y reacciones de tus agentes según su personalidad.

---

## Características Implementadas (Fase 4)

1. **Autenticación de Operadores (Sesiones Seguras):** Registro e inicio de sesión seguro con cifrado de contraseñas nativo (`pbkdf2Sync`) y firma de tokens de sesión HMAC-SHA256.
2. **Base de Datos Relacional Persistente (Prisma ORM & PostgreSQL):** Guardado de fichas de agentes (Fuerza, Agilidad, Percepción, Resiliencia, Inteligencia y Confianza acumulativa) e historial completo de combates finalizados.
3. **5 Escenarios con Influencia Táctica:** Los mapas (Coliseo, Pantano, Fábrica, Desierto, Gravedad Cero) aplican modificadores numéricos y tags de entorno que las fichas autónomas comprenden y aprovechan en la pelea.
4. **Catálogo de 20 Boosters:** Equipamiento clasificado en Armas (activas de ataque con usos), Armaduras (pasivas que mitigan daño con golpes limitados) y Herramientas (dispositivos de un solo uso por ronda para sanación o aturdimiento).
5. **Fase de Draft (Preparación):** Una vez emparejados, los operadores ven el mapa y disponen de 60 segundos para seleccionar hasta 3 boosters óptimos para anular penalizaciones de entorno o potenciar sus habilidades.
6. **Conexiones en Tiempo Real (Socket.io):** Matchmaking online 1v1, chat de combate integrado y envío simultáneo de turnos de combate.
7. **Modo Práctica (vs CPU):** Combates de entrenamiento contra la CPU, donde el contrincante inteligente escoge y utiliza boosters automáticamente para simular un reto realista.
8. **Enlace Neural (Speech-to-Text Directo):** Interacción por voz nativa (Web Speech API) con temporizador visual no numérico de 10 segundos y transmisión oculta e instantánea al servidor.
9. **Voces Dinámicas (Text-to-Speech de Agentes):** Síntesis de voz nativa del propio agente del jugador, adaptando el tono y velocidad a su género y arquetipo de personalidad (paladín, cobarde sarcástico, ansioso, etc.).

---

## Estructura del Código

```
├── prisma/
│   └── schema.prisma        # Modelos de base de datos (User, Agent, Combat)
├── src/                     # Backend (TypeScript)
│   ├── core/
│   │   ├── Boosters.ts          # Catálogo de 20 boosters de equipamiento
│   │   ├── CharacterCreator.ts  # Creador de agentes por IA
│   │   ├── CombatEngine.ts      # Resolución matemática y narrativa con mapas y boosters
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
6. El matchmaking las emparejará y abrirá la pantalla de **DRAFT DE BOOSTERS**, revelando el escenario seleccionado aleatoriamente (con sus correspondientes modificadores numéricos y tags).
7. Selecciona hasta 3 boosters estratégicos (armas, armaduras y herramientas) que tengan sinergia con tu agente o con el entorno, y presiona **Confirmar Equipamiento**.
8. Una vez que ambos operadores hayan confirmado, la interfaz transicionará a la **Arena de Combate**, mostrando los boosters equipados debajo de las tarjetas de HP.
9. Durante cada turno de combate:
   - Puedes hacer clic en cualquiera de tus boosters de tipo arma o herramienta para seleccionarlo como "booster activo" de la ronda (se marcará con un borde de neón cian).
   - Escribe tu orden narrativa en el cuadro de texto y presiona **TRANSMITIR ORDEN**.
   - Tras el envío simultáneo, el motor de combate resolverá la ronda aplicando durabilidad y modificadores, y la IA narrará el combate en tiempo real.

