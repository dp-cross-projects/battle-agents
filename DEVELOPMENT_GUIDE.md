# Guía de Desarrollo y Especificación Técnica: Battle Agents (Fase 1 y 1.b)

Este documento sirve como la guía definitiva de desarrollo para la **Fase 1** (CLI) y la **Fase 1.b** (Web UI Local en React) del videojuego "Battle Agents". Recopila todas las mecánicas, fórmulas matemáticas, integraciones de IA, arquitectura del servidor Express API y el diseño visual con animaciones interactivas.

---

## 1. Arquitectura del Sistema (Fase 1 & 1.b)

Para la Fase 1.b, el juego pasa a ser una SPA desarrollada en **React (TypeScript) con Vite** que consume una API REST expuesta por un servidor local en **Express**.

```
src/                         # Backend (TypeScript)
│   ├── core/                # Motor de combate, creador y filtros
│   ├── providers/           # Gemini & Ollama Providers
│   ├── types/               # Definición de interfaces y tipos
│   ├── server.ts            # Servidor Express API
│   ├── config.ts            # Configuración de variables de entorno
│   └── index.ts             # CLI original
client/                      # Frontend (Vite + React + TypeScript)
│   ├── src/
│   │   ├── components/      # Componentes de UI (Card, Selector, Arena)
│   │   ├── App.tsx          # Componente principal / Orquestador de pantallas
│   │   ├── main.tsx         # Punto de entrada de React
│   │   └── index.css        # Estilos globales y tokens Cyberpunk
│   ├── vite.config.ts       # Configuración de Vite con proxy hacia API en port 3000
│   ├── tsconfig.json        # Configuración de TS para el cliente
│   └── index.html           # HTML base para Vite
package.json                 # Configuración general y scripts unificados
```

---

## 2. Configuración de Desarrollo y Proxy (`vite.config.ts`)

Durante el desarrollo, levantamos dos servicios en paralelo:
1. **Express Server (Backend):** Corriendo en `http://localhost:3000`. Expone los endpoints REST para la creación de fichas e interacción de combate.
2. **Vite Dev Server (Frontend):** Corriendo en `http://localhost:5173`.

Vite incluye una configuración de proxy en `vite.config.ts` para redirigir las peticiones `/api` de manera transparente:
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true
      }
    }
  }
});
```

---

## 3. API REST del Servidor (`src/server.ts`)

El servidor Express expone las siguientes rutas:
* **`POST /api/character/create`**: Genera un personaje basado en el prompt de entrada del usuario y normaliza los atributos para sumar exactamente 100 y estar entre 5 y 50.
* **`POST /api/combat/start`**: Guarda en memoria de sesión la configuración del combate (Agente Jugador, Agente CPU, Escenario).
* **`POST /api/combat/round`**: Procesa la acción del jugador, genera la acción del enemigo, realiza los chequeos de seguridad, ejecuta las tiradas matemáticas y retorna los resultados de la ronda y narraciones de la IA.

### Middleware de Fallback (SPA)
Para dar soporte a la navegación en el cliente (React Router / SPA), Express sirve el archivo `index.html` ante cualquier petición `GET` que no sea de la API. En Express 5, para evitar errores de parseo de comodines (`*`) causados por `path-to-regexp`, se utiliza un middleware global que captura las rutas de forma independiente del path:
```typescript
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(path.join(clientDistPath, 'index.html'));
  }
  next();
});
```

---

## 4. Animaciones en el Frontend (Anime.js v4)

Utilizamos **anime.js v4.5.0** para dar fluidez y un toque comercial a la interfaz. A diferencia de versiones anteriores, la v4 utiliza importaciones nombradas en lugar de un objeto por defecto y recibe los targets de forma posicional.

### A. Despliegue de Estadísticas (Stat Roll)
Cuando el agente es creado, sus barras de stats se animan desde cero hasta su valor objetivo usando transiciones de escala y opacidad progresivas.
```typescript
import { animate, stagger } from 'animejs';

animate('.stat-bar-fill', {
  width: (el) => el.getAttribute('data-value') + '%',
  ease: 'out-elastic(1, .6)',
  duration: 1200,
  delay: stagger(100)
});
```

### B. Animación de Impacto (Screen Shake & Flash)
Cuando un agente recibe daño matemático durante la resolución del turno, la tarjeta se sacude rápidamente. Las propiedades múltiples usan la clave `to` en lugar de `value`, y se define la velocidad mediante `ease`.
```typescript
import { animate } from 'animejs';

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
```

### C. Transición de HP y Confianza
Las barras de salud y confianza se reducen o amplían de forma elástica usando transiciones de CSS o animando directamente las propiedades de anchura de los contenedores usando `animate()`.

---

## 5. Diseño Estético Cyberpunk Oscuro (CSS & Glassmorphism)

Definimos HSL Tokens en `client/src/index.css` para consistencia cromática:
* Fondos oscuros profundos (`#0d0e12`, `#151821`) con bordes iluminados por gradientes de colores curados (azul neón, violeta y verde holográfico).
* Efecto de desenfoque de fondo (**Glassmorphism**) para tarjetas y contenedores flotantes.
* Tipografía digital moderna (importando *Outfit* o *Inter* de Google Fonts).
* Efectos glow sobre textos y elementos interactivos para emular terminales holográficas.
