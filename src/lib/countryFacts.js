/**
 * Datos curiosos de los 48 países del Mundial 2026.
 * Datos generales y estables (capital, idioma, comida típica, una curiosidad).
 * Clave = nombre del equipo en español (como en fixtures.json).
 *
 * NOTA: son datos curiosos ligeros, escritos a mano. La población es aproximada
 * (en millones). Pensados para entretener, no como enciclopedia.
 */
export const COUNTRY_FACTS = {
  'Alemania': { capital: 'Berlín', pop: 84, lang: 'Alemán', food: 'Bratwurst', fact: 'Tetracampeón del mundo (1954, 74, 90, 2014).' },
  'Algeria': { capital: 'Argel', pop: 45, lang: 'Árabe', food: 'Cuscús', fact: 'El país más grande de África por superficie.' },
  'Arabia': { capital: 'Riad', pop: 36, lang: 'Árabe', food: 'Kabsa', fact: 'Venció a Argentina en Qatar 2022, una de las grandes sorpresas.' },
  'Argentina': { capital: 'Buenos Aires', pop: 46, lang: 'Español', food: 'Asado', fact: 'Campeón vigente del mundo (Qatar 2022).' },
  'Australia': { capital: 'Canberra', pop: 26, lang: 'Inglés', food: 'Meat pie', fact: 'Compite en Asia (AFC) pese a estar en Oceanía.' },
  'Austria': { capital: 'Viena', pop: 9, lang: 'Alemán', food: 'Schnitzel', fact: 'Viena es elegida a menudo la ciudad más habitable del mundo.' },
  'Bosnia': { capital: 'Sarajevo', pop: 3, lang: 'Bosnio', food: 'Ćevapi', fact: 'Sarajevo fue sede de los Juegos Olímpicos de invierno 1984.' },
  'Brasil': { capital: 'Brasilia', pop: 216, lang: 'Portugués', food: 'Feijoada', fact: 'Único país que ha jugado todas las Copas del Mundo. Pentacampeón.' },
  'Bélgica': { capital: 'Bruselas', pop: 12, lang: 'Neerlandés/Francés', food: 'Papas fritas', fact: 'Las papas "francesas" en realidad son belgas.' },
  'Cabo Verde': { capital: 'Praia', pop: 0.6, lang: 'Portugués', food: 'Cachupa', fact: 'Debuta en un Mundial; archipiélago en el Atlántico.' },
  'Canadá': { capital: 'Ottawa', pop: 40, lang: 'Inglés/Francés', food: 'Poutine', fact: 'Coanfitrión del Mundial 2026.' },
  'Catar': { capital: 'Doha', pop: 3, lang: 'Árabe', food: 'Machboos', fact: 'Organizó el Mundial 2022.' },
  'Colombia': { capital: 'Bogotá', pop: 52, lang: 'Español', food: 'Bandeja paisa', fact: 'Segundo país más biodiverso del planeta.' },
  'Congo': { capital: 'Kinshasa', pop: 102, lang: 'Francés', food: 'Fufu', fact: 'Kinshasa es la ciudad francófona más grande del mundo.' },
  'Corea del Sur': { capital: 'Seúl', pop: 52, lang: 'Coreano', food: 'Kimchi', fact: 'Semifinalista en el Mundial que organizó en 2002.' },
  'Costa de Marfil': { capital: 'Yamusukro', pop: 28, lang: 'Francés', food: 'Attiéké', fact: 'Mayor productor mundial de cacao.' },
  'Croacia': { capital: 'Zagreb', pop: 4, lang: 'Croata', food: 'Peka', fact: 'Subcampeón del mundo en 2018 con apenas 4 millones de habitantes.' },
  'Curazao': { capital: 'Willemstad', pop: 0.15, lang: 'Papiamento', food: 'Keshi yena', fact: 'Una de las naciones más pequeñas en clasificar a un Mundial.' },
  'Ecuador': { capital: 'Quito', pop: 18, lang: 'Español', food: 'Encebollado', fact: 'Quito es la capital más cercana al ecuador terrestre.' },
  'Egipto': { capital: 'El Cairo', pop: 110, lang: 'Árabe', food: 'Koshari', fact: 'Hogar de las únicas maravillas antiguas que siguen en pie.' },
  'Escocia': { capital: 'Edimburgo', pop: 5, lang: 'Inglés', food: 'Haggis', fact: 'Inventó el golf y el whisky escocés.' },
  'España': { capital: 'Madrid', pop: 48, lang: 'Español', food: 'Paella', fact: 'Campeón del mundo 2010 y de la Eurocopa 2024.' },
  'Estados Unidos': { capital: 'Washington D.C.', pop: 335, lang: 'Inglés', food: 'Hamburguesa', fact: 'Coanfitrión del Mundial 2026.' },
  'Francia': { capital: 'París', pop: 68, lang: 'Francés', food: 'Baguette', fact: 'Bicampeón del mundo (1998, 2018). #3 del ranking FIFA.' },
  'Ghana': { capital: 'Acra', pop: 34, lang: 'Inglés', food: 'Jollof rice', fact: 'Primer país africano en independizarse al sur del Sahara.' },
  'Haití': { capital: 'Puerto Príncipe', pop: 12, lang: 'Francés/Créole', food: 'Griot', fact: 'Primera república negra independiente del mundo (1804).' },
  'Holanda': { capital: 'Ámsterdam', pop: 18, lang: 'Neerlandés', food: 'Stroopwafel', fact: 'Hay más bicicletas que personas.' },
  'Inglaterra': { capital: 'Londres', pop: 56, lang: 'Inglés', food: 'Fish and chips', fact: 'Cuna del fútbol moderno; campeón en 1966.' },
  'Iraq': { capital: 'Bagdad', pop: 43, lang: 'Árabe', food: 'Masgouf', fact: 'Mesopotamia, la "cuna de la civilización".' },
  'Irán': { capital: 'Teherán', pop: 88, lang: 'Persa', food: 'Chelo kabab', fact: 'Una de las civilizaciones continuas más antiguas del mundo.' },
  'Japón': { capital: 'Tokio', pop: 124, lang: 'Japonés', food: 'Sushi', fact: 'Tokio es la metrópolis más poblada del planeta.' },
  'Jordan': { capital: 'Amán', pop: 11, lang: 'Árabe', food: 'Mansaf', fact: 'Hogar de Petra, una de las 7 maravillas modernas. Debuta en un Mundial.' },
  'Marruecos': { capital: 'Rabat', pop: 37, lang: 'Árabe', food: 'Tajine', fact: 'Primer país africano en llegar a semifinales (2022).' },
  'México': { capital: 'Ciudad de México', pop: 128, lang: 'Español', food: 'Tacos', fact: 'Coanfitrión; primer país en albergar 3 Mundiales.' },
  'Noruega': { capital: 'Oslo', pop: 5, lang: 'Noruego', food: 'Salmón', fact: 'Tierra del sol de medianoche y los fiordos.' },
  'Nueva Zelanda': { capital: 'Wellington', pop: 5, lang: 'Inglés/Maorí', food: 'Hangi', fact: 'Hay más ovejas que personas (unas 5 por habitante).' },
  'Panamá': { capital: 'Ciudad de Panamá', pop: 4, lang: 'Español', food: 'Sancocho', fact: 'Su canal une los océanos Atlántico y Pacífico.' },
  'Paraguay': { capital: 'Asunción', pop: 7, lang: 'Español/Guaraní', food: 'Sopa paraguaya', fact: 'El guaraní es idioma oficial junto al español.' },
  'Portugal': { capital: 'Lisboa', pop: 10, lang: 'Portugués', food: 'Bacalao', fact: 'Lisboa es más antigua que Roma.' },
  'República Checa': { capital: 'Praga', pop: 11, lang: 'Checo', food: 'Goulash', fact: 'Tiene el mayor consumo de cerveza per cápita del mundo.' },
  'Senegal': { capital: 'Dakar', pop: 18, lang: 'Francés', food: 'Thieboudienne', fact: 'El punto más occidental del África continental.' },
  'Sudáfrica': { capital: 'Pretoria', pop: 60, lang: '11 oficiales', food: 'Braai', fact: 'Tiene 3 capitales y 11 idiomas oficiales. Organizó el Mundial 2010.' },
  'Suecia': { capital: 'Estocolmo', pop: 10, lang: 'Sueco', food: 'Albóndigas', fact: 'Cuna de IKEA, Spotify y el Premio Nobel.' },
  'Suiza': { capital: 'Berna', pop: 9, lang: 'Alemán/Francés/Italiano', food: 'Fondue', fact: 'Tiene 4 idiomas oficiales y la sede de la FIFA.' },
  'Turquía': { capital: 'Ankara', pop: 85, lang: 'Turco', food: 'Kebab', fact: 'Estambul es la única ciudad en dos continentes.' },
  'Túnez': { capital: 'Túnez', pop: 12, lang: 'Árabe', food: 'Brik', fact: 'Donde se rodaron escenas de Star Wars (Tatooine).' },
  'Uruguay': { capital: 'Montevideo', pop: 3, lang: 'Español', food: 'Asado', fact: 'Ganó el primer Mundial de la historia (1930).' },
  'Uzbekistán': { capital: 'Taskent', pop: 36, lang: 'Uzbeko', food: 'Plov', fact: 'Uno de solo dos países "doblemente sin litoral" del mundo. Debuta.' },
}

export function countryFacts(team) {
  return COUNTRY_FACTS[team] || null
}
