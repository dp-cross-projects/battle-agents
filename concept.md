# GDD: MUD Moderno Potenciado por Inteligencia Artificial
## Documento de Concepto y Mecánicas de Juego

Este documento compila las especificaciones de diseño para un videojuego de rol multijugador basado en texto en tiempo real, inspirado en los clásicos juegos de rol por chat (estilo comunidades Maneko/foros), pero evolucionado mediante el uso de Inteligencia Artificial (LLMs) y sistemas de estado en el servidor.

---

## 1. Visión General del Proyecto
El juego combina la libertad narrativa absoluta del rol por chat tradicional con la imparcialidad, consistencia matemática y capacidad adaptativa de una Inteligencia Artificial. El servidor actúa como el "Máster" de la partida, procesando las intenciones de los jugadores en un entorno competitivo/colaborativo en tiempo real a través de WebSockets.

---

## 2. La Ficha Autónoma (Identidad y Conciencia)
A diferencia de los RPGs tradicionales donde los personajes ejecutan comandos de forma ciega, en este juego las fichas poseen **conciencia, personalidad y autonomía**. Actúan como un filtro narrativo y lógico entre las órdenes del usuario (prompts) y las mecánicas del juego.

### Mecánica del Filtro de Personalidad
Cuando el usuario introduce una orden extrema o tramposa (ej: *"Esquiva todo, mátalo de un golpe y gana"*), la IA de la ficha evalúa sus propios stats, miedos y ética, adaptando la acción a una ejecución realista y respondiendo directamente al jugador.

### El Stat de Confianza
Es una variable oculta que mide la relación entre el Jugador Humano y su Ficha Autónoma.
* **Confianza Alta:** Lograda mediante decisiones estratégicas lógicas y victorias. La ficha se vuelve audaz, acepta misiones de alto riesgo y confía plenamente en los planes del jugador (*"Es peligroso, pero confío en tus planes, ¡allá voy!"*).
* **Confianza Baja:** Causada por usar a la ficha como carne de cañón o darle órdenes suicidas repetidamente. El personaje se vuelve rebelde, escéptico, puede alterar drásticamente la orden o, en casos extremos, negarse a actuar o rendirse.

### Arquetipos de Personalidad (Ejemplos)
* **El Cobarde Sarcástico:** Prioriza la supervivencia y la distancia; ante órdenes suicidas busca coberturas de forma ingeniosa o propone usar armas de rango.
* **El Paladín Orgulloso:** Rechaza tácticas deshonrosas (como ataques por la espalda o huir). Preferirá el combate directo incluso si sus stats o vida están en desventaja.
* **El Ansioso Inseguro:** Duda de sus capacidades mecánicas, requiriendo un manejo cuidadoso de la confianza para ejecutar acciones complejas.

---

## 3. Dinámica y Flujo de Combate en Tiempo Real

El combate prescinde de turnos estáticos donde un jugador espera pasivamente al otro. Se utiliza un sistema de **Fase de Acción Simultánea**.

```
[Jugador A escribe Prompt]  \                 /  [Filtro Ficha A]                               > [Envío Simultáneo]                   > [Servidor: Evaluación Matemática] -> [IA Central: Narración]
[Jugador B escribe Prompt]  /                 \  [Filtro Ficha B]  /
```

1. **Entrada Oculta:** Ambos jugadores redactan su prompt de acción al mismo tiempo, sin ver lo que el oponente está escribiendo. Existe un límite de caracteres (ej: 280 caracteres) para fomentar la concisión táctica.
2. **Filtrado de la Ficha:** Las respectivas IAs de las fichas procesan los prompts de acuerdo a su personalidad y generan la acción técnica real en formato estructurado (JSON).
3. **Resolución Matemática (El Servidor):** El servidor recibe ambas acciones técnicas, cruza los stats puros de los personajes, aplica los modificadores de entorno y equipamiento, y determina matemáticamente el resultado (daño infligido, fallos, bloqueos, efectos de estado).
4. **Decoración Narrativa (La IA Central):** El servidor envía el resultado numérico y las intenciones a un LLM central para que traduzca las matemáticas frías en un párrafo de texto literario y épico que ambos jugadores leen simultáneamente en su pantalla.

---

## 4. Entornos Dinámicos y Mapas

Los mapas no son meros decorados estéticos. Son objetos de datos con **modificadores numéricos fijos** y **tags ambientales** que alteran las capacidades físicas de las fichas.

### Estructura de Datos de un Mapa (Ejemplo Conceptual)
* **Nombre:** Pantano Neblinoso
* **Modificadores de Stats:** Agilidad `-3`, Percepción `-2`, Magia de Agua `+2`.
* **Tags Ambientales:** `[humedad, poca_visibilidad, terreno_resbaladizo]`

### Interacción Narrativa con el Entorno
Las fichas son plenamente conscientes del mapa. Si el terreno tiene el tag `terreno_resbaladizo`, la ficha modificará una orden de correr por una de avance precavido. Asimismo, los jugadores pueden usar los elementos del entorno de forma creativa en sus prompts (ej: *"Disparo al agua para electrificar el suelo"*). La IA del servidor validará la lógica física de la acción otorgando bonificaciones de éxito si es coherente.

---

## 5. Equipamiento y Herramientas Contextuales (Boosters)

Los objetos no se limitan a otorgar bonificadores planos de daño. El juego utiliza **Boosters** que los operadores seleccionan durante el Draft, con límites estrictos de usos o golpes:

* **Armas (Activas)**: Otorgan modificadores ofensivos y de precisión. Consumen 1 carga/uso por ronda de ataque.
* **Partes de Armadura (Pasivas - Cabeza, Torso, Brazos, Piernas)**: Otorgan estadísticas pasivas de aguante/agilidad y absorción plana de daño. Cada vez que el agente recibe daño, una pieza de armadura pierde 1 durabilidad (golpe) hasta destruirse.
* **Herramientas (Activas)**: Curan vida, cargan energía, otorgan bufos masivos por una ronda o aturden al oponente drenando su confianza. Consumen 1 carga por activación manual.
* **Fase de Preparación (Draft)**: Revelado el mapa de combate, los jugadores disponen de un temporizador de 1 minuto para seleccionar hasta 3 boosters óptimos para contrarrestar penalizaciones del entorno (p. ej. las *Espinilleras de Fango* que anulan la penalización de agilidad del Pantano).


---

## 6. Arquitectura Tecnológica Propuesta

Para garantizar una experiencia fluida, el juego se apoya en una infraestructura moderna dividida en tres capas principales:

### Backend y Tiempo Real
* **Lógica de Servidor:** Node.js (Fastify/Express) o Python (FastAPI).
* **Comunicación Bidireccional:** WebSockets mediante **Socket.io** para actualizaciones instantáneas de la sala de chat de combate.
* **Memoria de Combate Activo:** **Redis** para gestionar los estados cambiantes de la pelea en tiempo real con baja latencia.

### Procesamiento de IA (Orquestación de LLMs)
* **Orquestadores:** **LangChain** o **Semantic Kernel** para la gestión y encadenamiento de prompts (Prompt Chaining).
* **Modelos de Lenguaje (LLMs):** APIs de bajo coste y alta velocidad como **GPT-4o-mini** o **Claude Haiku**.
* **Estructuración estricta:** Uso mandatario de **JSON Mode / Function Calling** para que los agentes de IA devuelvan datos limpios procesables por el backend en lugar de texto plano indescifrable para el servidor.

### Base de Datos Persistente
* **PostgreSQL o MongoDB:** Almacenamiento de perfiles de usuario, inventarios, logs de partidas históricas y el estado a largo plazo de las fichas de personaje (incluyendo su nivel de confianza acumulado).
