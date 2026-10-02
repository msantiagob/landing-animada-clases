import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { findVoseo as findBaseVoseo } from './voseo';

/**
 * Voz del sitio: español de Colombia, tuteo.
 *
 * El copy original estaba escrito con voseo rioplatense ("querés", "mirá",
 * "contanos"). Ningún build lo detecta y es lo primero que nota un lector
 * colombiano, así que se comprueba archivo por archivo: cada página, componente,
 * artículo y archivo de datos con texto visible tiene que pasar este filtro.
 *
 * El detector es una red de seguridad, no un analizador morfológico. Parte de
 * `./voseo` (el mismo que usan los tests del blog) y le suma lo que ese no cubre:
 * los imperativos y las formas con clítico de una lista amplia de verbos, y los
 * reflexivos ("animate", "sumate").
 *
 * Las formas en -ir ("escribí", "salí") coinciden con la primera persona del
 * pretérito ("escribí este artículo"). Si el texto es un pretérito legítimo,
 * se reescribe: en el copy comercial casi nunca hace falta.
 */

const ROOT = resolve(__dirname, '..');

/** Raíces (sin -ar / -er / -ir) de los verbos que aparecen en un sitio comercial y técnico. */
const AR = `
  agend anot aplic apag aprovech arm arranc asegur atend aument autoriz automatiz averigu avis ayud bloque busc calcul
  cambi cancel carg cerr chequ clasific cobr compar complet comprob compr comunic concentr configur confi confirm conect
  consult contact cont control copi cuid dej desactiv desconfi descarg document ejecut empez enfoc entr envi escuch esper
  evit explor fren gan gast gener gestion guard habilit habl ignor implement ingres inici instal integr intent invit llam
  llev lleg manej migr mir mostr notific optimiz organiz pag pas pens plane prepar prest prob program public quit recarg
  recomend registr revis sac segment separ sum tom trabaj trat us valid verific visit
`;
const ER = 'aprend conoc corr entend hac le manten pon resolv respond ten vend ofrec escog mov';
const IR = 'abr asum compart defin descubr dec eleg escrib med ped recib sal segu sub ven viv';

const words = (text: string): string[] => text.split(/\s+/).filter(Boolean);

/** Terminaciones del imperativo de vos y vocal temática con la que se pegan los clíticos. */
const IMPERATIVOS: Array<{ stems: string[]; accented: string; vowel: string }> = [
  { stems: words(AR), accented: 'á', vowel: 'a' },
  { stems: words(ER), accented: 'é', vowel: 'e' },
  { stems: words(IR), accented: 'í', vowel: 'i' },
];

/**
 * El tuteo acentúa el imperativo con clítico ("cuéntanos", "escríbenos"); el
 * voseo no ("contanos", "escribinos"). Por eso estas formas nunca son tuteo.
 * Quedan afuera "le" y "les" a propósito: casi no aparecen y aumentan el ruido.
 */
const CLITICOS = ['nos', 'me', 'lo', 'la', 'los', 'las'];

/** Reflexivos con "te": generarlos para todos los verbos chocaría con "create", "migrate", "tomate". */
const REFLEXIVOS = words(`
  animate ocupate quedate sumate registrate inscribite anotate enterate informate fijate acordate olvidate imaginate
  preparate apuntate cuidate relajate despreocupate comunicate pasate mudate ponete unite dedicate avisate andate
  mandame mandanos mandalo
`);

const EXTRA_FORMS: Set<string> = new Set([
  ...IMPERATIVOS.flatMap(({ stems, accented, vowel }) =>
    stems.flatMap((stem) => [`${stem}${accented}`, ...CLITICOS.map((clitico) => `${stem}${vowel}${clitico}`)])
  ),
  ...REFLEXIVOS,
  ...words('andá vení decí salí ocupá'),
]);

/**
 * Palabras que sirven de nombre de clase o de método en el código. "animate" es el
 * imperativo reflexivo de vos ("Animate a probar") y también la utilidad
 * `animate-fade` de Tailwind o `element.animate()`. Solo cuenta como voseo
 * cuando está suelta, en texto.
 */
const AMBIGUAS_EN_CODIGO = new Set(['animate']);

const TOKEN = /[\p{L}]+(?:-[\p{L}]+)*/gu;

const esTextoSuelto = (line: string, start: number, end: number): boolean => {
  const before = line[start - 1] ?? ' ';
  const after = line[end] ?? ' ';

  return !/[.:_$@/#]/.test(before) && !/[(:=_$@/]/.test(after);
};

const findExtraVoseo = (line: string): string[] => {
  const found: string[] = [];

  for (const match of line.matchAll(TOKEN)) {
    const word = match[0].toLowerCase();
    if (!EXTRA_FORMS.has(word)) continue;
    if (AMBIGUAS_EN_CODIGO.has(word) && !esTextoSuelto(line, match.index, match.index + match[0].length)) continue;

    found.push(word);
  }

  return found;
};

/** Voseo de un texto, con la línea en que aparece: "L12: necesitás". */
const findVoseo = (source: string): string[] =>
  source
    .normalize('NFC')
    .split('\n')
    .flatMap((line, index) =>
      [...new Set([...findBaseVoseo(line), ...findExtraVoseo(line)])].map((word) => `L${index + 1}: ${word}`)
    );

const list = (dir: string, pattern: RegExp): string[] =>
  readdirSync(resolve(ROOT, dir), { recursive: true, encoding: 'utf8' })
    .filter((file) => pattern.test(file))
    .map((file) => `${dir}/${file}`)
    .sort();

const read = (file: string) => readFileSync(resolve(ROOT, file), 'utf8');

/** Todo lo que se muestra en el sitio. */
const CONTENIDO = [
  ...list('src/pages', /\.astro$/),
  ...list('src/components', /\.astro$/),
  ...list('src/layouts', /\.astro$/),
  ...list('src/data/post', /\.mdx?$/),
  'src/data/landings.ts',
  'src/navigation.ts',
];

/**
 * Texto que llega al navegador desde fuera de las páginas: mensajes de validación
 * y de correo, endpoints, metadatos del sitio, JSON-LD, títulos del blog y el alt
 * de las imágenes.
 */
const TEXTOS_AUXILIARES = [
  'src/config.yaml',
  'src/pages/llms.txt.ts',
  'src/pages/rss.xml.ts',
  ...list('src/pages/api', /\.ts$/),
  ...list('src/data/seo-images', /\.ts$/),
  ...list('src/lib', /\.ts$/),
  ...list('src/utils', /\.ts$/),
];

describe('el detector de voseo', () => {
  // Los que pidió el equipo de contenido, más los que más se repetían en el copy original.
  const VOSEO = [
    'querés',
    'podés',
    'tenés',
    'sabés',
    'hacés',
    'necesitás',
    'arrancás',
    'terminás',
    'contanos',
    'escribinos',
    'agendá',
    'mirá',
    'elegí',
    'dejanos',
    'reservá',
    'completá',
    'consultá',
    'empezá',
    'probá',
    'sumate',
    'animate',
    'vos',
  ];

  it.each(VOSEO)('detecta "%s"', (word) => {
    expect(findVoseo(`Hola, ${word} ahora mismo.`)).toEqual([`L1: ${word}`]);
  });

  it.each(VOSEO)('detecta "%s" en mayúscula inicial y en versalitas', (word) => {
    const capital = word[0].toUpperCase() + word.slice(1);

    expect(findVoseo(`${capital} ahora.`)).toHaveLength(1);
    expect(findVoseo(`${word.toUpperCase()} AHORA.`)).toHaveLength(1);
  });

  it.each(VOSEO)('detecta "%s" pegado a signos de puntuación y a Markdown', (word) => {
    expect(findVoseo(`**${word}**`)).toHaveLength(1);
    expect(findVoseo(`¡${word}!`)).toHaveLength(1);
    expect(findVoseo(`("${word}")`)).toHaveLength(1);
  });

  // `\b` de JavaScript no reconoce las vocales acentuadas como letra: con una regex
  // "\bagendá\b" la palabra no se detectaría nunca seguida de un espacio.
  it('detecta una palabra que termina en vocal acentuada seguida de espacio, coma o punto', () => {
    expect(findVoseo('agendá una cita')).toEqual(['L1: agendá']);
    expect(findVoseo('Elegí, probá. Mirá')).toEqual(['L1: elegí', 'L1: probá', 'L1: mirá']);
  });

  it('indica la línea de cada hallazgo', () => {
    expect(findVoseo('Todo bien.\nPero contanos qué necesitás.\n\nY mirá.')).toEqual([
      'L2: contanos',
      'L2: necesitás',
      'L4: mirá',
    ]);
  });

  it('no repite una palabra dentro de la misma línea', () => {
    expect(findVoseo('mirá, mirá y mirá')).toEqual(['L1: mirá']);
  });

  it('detecta formas con clítico y reflexivos de verbos que no están en la lista base', () => {
    ['hacelo', 'usalo', 'probalo', 'llamanos', 'avisanos', 'ocupate', 'quedate', 'registrate', 'decime'].forEach(
      (word) => expect(findVoseo(`Ahora ${word}.`), word).toHaveLength(1)
    );
  });

  it('detecta el presente de vos de cualquier verbo, no solo de los listados', () => {
    ['trabajás', 'vendés', 'construís', 'preferís', 'ahorrás', 'migrás'].forEach((word) =>
      expect(findVoseo(`Si ${word} así.`), word).toHaveLength(1)
    );
  });

  it('detecta imperativos de vos que aparecían en el copy original', () => {
    ['intentá', 'desconfiá', 'sacá', 'respondé', 'recargá', 'llamá', 'escribí', 'salí', 'revisá', 'usá'].forEach(
      (word) => expect(findVoseo(`Ahora ${word}.`), word).toHaveLength(1)
    );
  });

  it.each([
    ['necesitas', 'necesitás'],
    ['quieres', 'querés'],
    ['puedes', 'podés'],
    ['tienes', 'tenés'],
    ['sabes', 'sabés'],
    ['haces', 'hacés'],
    ['agenda', 'agendá'],
    ['mira', 'mirá'],
    ['elige', 'elegí'],
    ['reserva', 'reservá'],
    ['consulta', 'consultá'],
    ['empieza', 'empezá'],
    ['prueba', 'probá'],
    ['cuéntanos', 'contanos'],
    ['escríbenos', 'escribinos'],
    ['déjanos', 'dejanos'],
    ['anímate', 'animate'],
    ['súmate', 'sumate'],
    ['hazlo', 'hacelo'],
    ['quédate', 'quedate'],
  ])('acepta el tuteo "%s" (el voseo es "%s")', (tuteo) => {
    expect(findVoseo(`Hola, ${tuteo} ahora.`)).toEqual([]);
  });

  // Palabras que terminan igual que el voseo y son perfectamente válidas en tuteo.
  it.each([
    'más',
    'además',
    'estás',
    'después',
    'interés',
    'través',
    'país',
    'inglés',
    'podrás',
    'tendrás',
    'verás',
    'aprenderás',
    'recibirás',
    'harás',
    'está',
    'será',
    'habrá',
    'acá',
    'allá',
    'aquí',
    'así',
    'probé',
    'voz',
    'vosotros',
    'revés',
  ])('no confunde "%s" con voseo', (word) => {
    expect(findVoseo(`Esto es ${word} en tuteo.`)).toEqual([]);
  });

  describe('"animate", que también es nombre de clase y de método', () => {
    it('no se marca dentro de una clase de Tailwind', () => {
      expect(findVoseo('class="motion-safe:md:intersect:animate-fade"')).toEqual([]);
      expect(findVoseo('class="animate-spin animate-pulse"')).toEqual([]);
    });

    it('no se marca como método, selector ni clave de un objeto', () => {
      expect(findVoseo('element.animate({ opacity: 1 });')).toEqual([]);
      expect(findVoseo('.animate { opacity: 1 }')).toEqual([]);
      expect(findVoseo('animate: fadeIn')).toEqual([]);
    });

    it('se marca cuando es texto suelto', () => {
      expect(findVoseo('Animate a probar la primera clase.')).toEqual(['L1: animate']);
      expect(findVoseo('<p>Animate</p>')).toEqual(['L1: animate']);
    });
  });

  it('normaliza las vocales acentuadas descompuestas (a + U+0301) antes de buscar', () => {
    expect(findVoseo('agendá una cita')).toEqual(['L1: agendá']);
  });

  it('un texto vacío o sin voseo no devuelve nada', () => {
    expect(findVoseo('')).toEqual([]);
    expect(findVoseo('Agenda una llamada gratuita de 30 minutos y recibe un plan concreto.')).toEqual([]);
  });

  it('las formas generadas no incluyen palabras que existen en tuteo', () => {
    ['mandala', 'tomate', 'create', 'migrate', 'activate', 'validate'].forEach((word) =>
      expect(EXTRA_FORMS.has(word), word).toBe(false)
    );
  });
});

describe('el filtro revisa todo el contenido', () => {
  it('encuentra las páginas, los componentes y los artículos', () => {
    expect(CONTENIDO.filter((file) => file.startsWith('src/pages/')).length).toBeGreaterThan(10);
    expect(CONTENIDO.filter((file) => file.startsWith('src/components/')).length).toBeGreaterThan(20);
    expect(CONTENIDO.filter((file) => file.startsWith('src/data/post/')).length).toBeGreaterThan(5);
  });

  it('incluye los archivos con texto visible que no son .astro', () => {
    expect(CONTENIDO).toContain('src/data/landings.ts');
    expect(CONTENIDO).toContain('src/navigation.ts');
  });

  it('revisa también los widgets que usan todas las landings', () => {
    [
      'src/components/widgets/Footer.astro',
      'src/components/widgets/LeadCapture.astro',
      'src/components/ui/LeadForm.astro',
    ].forEach((file) => expect(CONTENIDO, file).toContain(file));
  });
});

describe('voz del contenido: sin voseo', () => {
  it.each(CONTENIDO)('%s', (file) => {
    expect(findVoseo(read(file)), `${file} usa voseo`).toEqual([]);
  });
});

describe('voz de los textos auxiliares: sin voseo', () => {
  it.each(TEXTOS_AUXILIARES)('%s', (file) => {
    expect(findVoseo(read(file)), `${file} usa voseo`).toEqual([]);
  });
});
