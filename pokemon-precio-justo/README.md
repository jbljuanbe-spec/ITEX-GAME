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

## Notas
- La API de pokemontcg.io no requiere clave para uso puntual (límite ~30 peticiones/min). Si se juega mucho, se puede añadir una API key gratuita como cabecera `X-Api-Key`.
- No probado en vivo contra la API durante el desarrollo (la red de la sesión de Claude bloqueaba ese dominio); si algo falla al abrir el juego, revisar la consola del navegador — puede que haya cambiado el formato de respuesta o el parámetro de búsqueda `q=`.
