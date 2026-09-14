# Precio Justo Pokémon

Adivina el precio de mercado de Cardmarket de una carta Pokémon al azar. 1 a 4 jugadores en el mismo dispositivo (hotseat), por rondas.

Jugar: https://jbljuanbe-spec.github.io/ITEX-GAME/pokemon-precio-justo/

## Cómo funciona
- Cada ronda pide una carta aleatoria con precio a la API pública de [pokemontcg.io](https://pokemontcg.io), que incluye los precios de Cardmarket (`cardmarket.prices`).
- Cada jugador introduce su estimación en euros.
- Al revelar, se compara con el precio real (`trendPrice`, o `averageSellPrice` si no hay trend) y se reparten puntos según el error: 100 pts si aciertas exacto, 0 pts si el error es ≥100%.
- Tras el número de rondas elegido, gana quien más puntos acumule.

## Estructura
`index.html`, `style.css`, `game.js`. Estático, sin dependencias ni backend — las peticiones a la API las hace el navegador del jugador directamente.

## Rendimiento y fiabilidad
Pedir una carta por ronda (con `page` aleatorio y `pageSize=1`) era lento. Ahora se piden lotes de 50 cartas sin filtro de servidor, se filtran en el cliente las que tienen precio de Cardmarket, y se guardan en una cola local; la mayoría de partidas (5-15 rondas) se juegan enteras con 1-2 lotes.

La API de pokemontcg.io no tiene SLA y da error 500 o timeout de vez en cuando, sobre todo sin API key. Por eso cada petición reintenta con backoff (hasta 3 intentos) y, si el lote sigue fallando, cae a pedir una carta suelta antes de rendirse. Si el error 500 persiste siempre (no de forma intermitente), es la API la que está caída — revisar `LOGICA.md` y la consola del navegador para el detalle exacto (status/cuerpo de la respuesta).

## Notas
- La API de pokemontcg.io no requiere clave para uso puntual (límite ~30 peticiones/min). Si se juega mucho, se puede añadir una API key gratuita como cabecera `X-Api-Key`.
