# Lógica del juego — Precio Justo Pokémon

Documento de referencia de cómo funciona el juego por dentro, para pensar el apartado gráfico sin romper la mecánica.

## Objetivo
Adivinar el precio de mercado (Cardmarket) de una carta Pokémon mostrada al azar. Gana quien acumule más puntos tras varias rondas.

## Fuente de datos
- API pública y gratuita: `https://api.pokemontcg.io/v2/cards` (sin clave, sin coste).
- Por cada carta interesan: `name`, `set.name`, `rarity`, `images.large` / `images.small`, y el precio en `cardmarket.prices.trendPrice` (si no existe, se usa `cardmarket.prices.averageSellPrice`).
- No toda carta tiene precio de Cardmarket (promos, cartas muy nuevas...), así que se descartan las que no lo tienen.

## Carga de cartas (rendimiento)
Pedir 1 carta por ronda con página aleatoria era lento (paginación profunda). Un filtro de precio en el servidor (`q=cardmarket.prices...`) también daba error 500 y se quitó. Solución actual:
1. Al abrir la app (pantalla de configuración) y cada vez que la cola de cartas baja de `REFILL_THRESHOLD` (5), se pide en segundo plano un **lote de 50 cartas** (`BATCH_SIZE`) de una página aleatoria, sin filtro de servidor. (Se probó con lotes de 250 pero provocaban 500 con más frecuencia — 50 es un punto intermedio razonable.)
2. Ese lote se filtra en el cliente (solo cartas con precio) y se mezcla (`shuffle`) en una cola local (`state.cardQueue`).
3. Cada ronda simplemente saca la siguiente carta de la cola (`shift()`) — normalmente ya está en memoria, sin esperar red.
4. Mientras se muestra una carta, se precargan (`new Image()`) las imágenes de las 2 siguientes de la cola, para que al pasar de ronda ya estén en caché del navegador.
5. Con 5-15 rondas por partida, casi siempre bastan 1-2 lotes para toda la partida.

**Reintentos:** la API de pokemontcg.io no tiene SLA y falla de forma intermitente (500, timeout). `fetchJSON` reintenta cada petición hasta 3 veces con backoff exponencial (400ms, 800ms) y aborta si tarda más de 8s. Si aun así el lote falla, `loadCard` cae a `fetchSingleCard` (pide 1 sola carta, petición más pequeña y con más probabilidad de responder) antes de mostrar el error final. Si el error persiste siempre y no de forma intermitente, es que la API está caída de verdad, no un bug del juego.

**Percepción de la espera:** mientras se carga (haya o no reintentos de por medio), en vez de un simple "Cargando...":
- `#card-skeleton` muestra un bloque gris pulsante con el tamaño de una carta (`style.css`, animación `skeleton-pulse`), en vez de un hueco vacío o un icono de imagen rota.
- `#card-meta` rota entre `LOADING_MESSAGES` cada 3s ("Buscando una carta al azar...", "Consultando el precio en Cardmarket...", "Casi lista...") para transmitir que el proceso avanza, no que se ha colgado.
- La imagen no se muestra hasta que termina de descargarse (`waitForImage`, con `img.onload`/`onerror`), así no hay parpadeo de imagen a medio cargar.

Si algún día se quiere garantizar variedad entre partidas distintas, el lote se pide de una página aleatoria dentro del total de cartas, así que cambia entre partidas.

## Flujo de pantallas
Tres `<section>` en `index.html`, se muestran/ocultan con `hidden` (nunca coexisten dos visibles):

1. **`#screen-setup`** — configuración: número de jugadores (1-4), nombre de cada uno, número de rondas (5/10/15). Botón "Empezar partida".
2. **`#screen-round`** — la ronda en curso:
   - `#card-image` + `#card-meta`: imagen y datos de la carta (nombre, set, rareza). Precio oculto.
   - `#guess-form`: un input numérico por jugador activo, para su estimación en euros.
   - Botón "Revelar precio" → calcula y muestra `#reveal-area` (precio real + puntos de cada jugador) y cambia a botón "Siguiente carta".
3. **`#screen-final`** — ranking ordenado por puntuación total, botón "Jugar de nuevo" (vuelve a `#screen-setup` sin perder nada del histórico de la página).

Aparte, `#error-box` (fuera de las secciones) se muestra si falla la carga de una carta, con botón "Reintentar".

## Estado del juego (`state` en `game.js`)
```
state = {
  players: [{ name, score }],   // uno por jugador
  totalRounds,                  // 5 / 10 / 15
  currentRound,                 // ronda actual (1-indexed)
  totalCardCount,               // total de cartas en la API (se cachea una vez)
  currentCard,                  // objeto carta de la API mostrado ahora mismo
  currentPrice,                 // precio real de la carta actual (número)
  cardQueue,                    // cola local de { card, price } ya descargados
}
```
No hay backend ni persistencia entre partidas: todo vive en memoria de la pestaña. Al recargar la página se pierde el progreso.

## Modos de juego
No hay un "modo solo" separado en el código: 1 jugador es simplemente `players.length === 1`. La mecánica de puntuación es la misma para 1 o para 4 — en solitario, el objetivo pasa a ser superar tu propia puntuación de partidas anteriores (no hay comparación entre jugadores).

Es **hotseat**: todos los jugadores están delante de la misma pantalla y meten su estimación en el mismo formulario antes de revelar. No hay turnos ocultos ni pantallas separadas por jugador.

## Puntuación
Por ronda, cada jugador recibe puntos según lo cerca que quede su estimación del precio real, independientemente de los demás jugadores:

```
error% = |estimación - precio_real| / precio_real * 100
puntos = max(0, round(100 - error%))
```

- Acertar exacto → 100 puntos.
- Error del 50% → 50 puntos.
- Error ≥100% → 0 puntos.

Es una puntuación absoluta (no relativa a los rivales), así que funciona igual con 1 o con 4 jugadores. En pantalla se resalta (`.winner`) a quien más puntos saca esa ronda, pero no le quita puntos a nadie. Al final se suman los puntos de todas las rondas y se ordena el ranking.

## Piezas visuales actuales (para rediseñar)
Todo el HTML se genera o ya existe en `index.html`; `game.js` solo rellena texto/atributos, no crea estructura nueva salvo:
- `#player-names`: un `<label>+<input>` por jugador (dinámico según el selector de jugadores).
- `#guess-form`: un `.guess-row` (label + input numérico) por jugador, cada ronda.
- `#reveal-area`: línea de precio real + una `.result-row` por jugador (con clase `.winner` si es el ganador de la ronda).
- `#final-ranking`: una `.result-row` por jugador, ordenadas por puntuación.

Los estilos están en `style.css`, con variables de color al principio (`--rojo`, `--amarillo`, `--azul`) fáciles de sustituir por una paleta nueva.
