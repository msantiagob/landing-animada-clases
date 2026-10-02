import { describe, expect, it } from 'vitest';
import { LANDINGS, SILOS } from '~/data/landings';
import type { SiloId } from '~/data/landings';
import {
  INTERESTS,
  OTHER_INTEREST,
  groupInterestsBySilo,
  interestLabel,
  isValidInterest,
  normalizeInterest,
} from '~/lib/interests';

/**
 * El catálogo de intereses es el vocabulario compartido entre el formulario,
 * la API y el panel, y se deriva del registro de landings. Si se desincroniza,
 * los leads caen en una categoría que el panel no sabe mostrar.
 */

/** Intereses que existían antes del registro. Hay leads guardados con estos valores. */
const LEGACY_VALUES = [
  'clases-de-ia',
  'clases-de-python',
  'asistente-de-whatsapp',
  'whatsapp-business-api',
  'llamadas-de-marketing',
  'gestor-de-llamadas',
  'automatizaciones',
  'desarrollo-de-software',
  'servidores-y-vps',
  'ciberseguridad',
  'otro',
];

describe('catálogo de intereses', () => {
  it('no tiene valores repetidos', () => {
    const values = INTERESTS.map((interest) => interest.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it('no tiene etiquetas repetidas', () => {
    const labels = INTERESTS.map((interest) => interest.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('usa valores en kebab-case, que es lo que va a la base y a la URL', () => {
    INTERESTS.forEach((interest) => expect(interest.value).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/));
  });

  it('no tiene etiquetas vacías', () => {
    INTERESTS.forEach((interest) => expect(interest.label.trim()).not.toBe(''));
  });

  it('ofrece una salida para quien no sabe qué necesita, siempre al final', () => {
    expect(INTERESTS.at(-1)).toEqual({ value: 'otro', label: 'Otro' });
    expect(INTERESTS.filter((interest) => interest.value === 'otro')).toHaveLength(1);
  });
});

describe('derivación desde el registro de landings', () => {
  it('tiene una opción por landing más "otro": ni una más ni una menos', () => {
    expect(INTERESTS).toHaveLength(LANDINGS.length + 1);
  });

  it('respeta el orden del registro', () => {
    expect(INTERESTS.slice(0, -1).map((interest) => interest.value)).toEqual(LANDINGS.map((landing) => landing.slug));
  });

  it.each(LANDINGS.map((landing) => [landing.slug, landing.name]))(
    'la landing %s se ofrece como interés con la etiqueta "%s"',
    (slug, name) => {
      expect(INTERESTS).toContainEqual({ value: slug, label: name });
    }
  );

  it('toda opción distinta de "otro" corresponde a una landing', () => {
    const slugs = new Set(LANDINGS.map((landing) => landing.slug));

    INTERESTS.filter((interest) => interest.value !== 'otro').forEach((interest) =>
      expect(slugs.has(interest.value), `${interest.value} no está en el registro`).toBe(true)
    );
  });

  it('ninguna landing usa "otro" como slug, que está reservado', () => {
    expect(LANDINGS.map((landing) => landing.slug)).not.toContain('otro');
  });
});

describe('compatibilidad con leads ya guardados', () => {
  // Los leads viejos se guardaron con estos valores. Si alguno deja de ser
  // válido, el panel mostraría "Sin especificar" para un lead que sí eligió algo.
  it.each(LEGACY_VALUES)('el valor histórico "%s" sigue siendo válido', (value) => {
    expect(isValidInterest(value)).toBe(true);
    expect(interestLabel(value)).not.toBe('Sin especificar');
  });
});

describe('isValidInterest', () => {
  it('acepta un valor del catálogo', () => {
    expect(isValidInterest('ciberseguridad')).toBe(true);
  });

  it.each(LANDINGS.map((landing) => landing.slug))('acepta la landing %s', (slug) => {
    expect(isValidInterest(slug)).toBe(true);
  });

  it('acepta "otro"', () => {
    expect(isValidInterest('otro')).toBe(true);
  });

  it.each([
    ['desconocido', 'criptomonedas'],
    ['vacío', ''],
    ['con mayúsculas', 'Ciberseguridad'],
    ['con espacios', ' ciberseguridad '],
    ['con barra inicial', '/ciberseguridad'],
    ['un hub, que no es un interés', 'servicios'],
  ])('rechaza un valor %s', (_caso, value) => {
    expect(isValidInterest(value)).toBe(false);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['número', 42],
    ['objeto', { value: 'ciberseguridad' }],
    ['array', ['ciberseguridad']],
  ])('rechaza un tipo no string: %s', (_caso, value) => {
    expect(isValidInterest(value)).toBe(false);
  });
});

describe('normalizeInterest', () => {
  it('devuelve el valor cuando es válido', () => {
    expect(normalizeInterest('automatizaciones')).toBe('automatizaciones');
  });

  it('acepta las landings nuevas del registro', () => {
    expect(normalizeInterest('curso-de-n8n')).toBe('curso-de-n8n');
    expect(normalizeInterest('posicionamiento-seo')).toBe('posicionamiento-seo');
  });

  // Decisión deliberada: un interés desconocido NO invalida el lead. Un
  // contacto real vale más que una taxonomía prolija.
  it('devuelve null ante un valor desconocido en vez de fallar', () => {
    expect(normalizeInterest('lo-que-sea')).toBeNull();
  });

  it('devuelve null ante ausencia de valor', () => {
    expect(normalizeInterest(undefined)).toBeNull();
    expect(normalizeInterest(null)).toBeNull();
  });

  it('no deja pasar inyecciones de texto libre', () => {
    expect(normalizeInterest('<script>alert(1)</script>')).toBeNull();
    expect(normalizeInterest("'; DROP TABLE contact_forms; --")).toBeNull();
  });

  it('no deja pasar propiedades heredadas de los objetos, como "constructor"', () => {
    expect(normalizeInterest('constructor')).toBeNull();
    expect(normalizeInterest('__proto__')).toBeNull();
    expect(normalizeInterest('toString')).toBeNull();
  });
});

describe('interestLabel', () => {
  it('traduce el valor a la etiqueta que ve el admin', () => {
    expect(interestLabel('whatsapp-business-api')).toBe('WhatsApp Business API');
  });

  it.each(LANDINGS.map((landing) => [landing.slug, landing.name]))('traduce %s a "%s"', (slug, name) => {
    expect(interestLabel(slug)).toBe(name);
  });

  it('traduce "otro" a su etiqueta', () => {
    expect(interestLabel('otro')).toBe('Otro');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['desconocido', 'inexistente'],
    ['vacío', ''],
  ])('muestra "Sin especificar" cuando el valor es %s', (_caso, value) => {
    expect(interestLabel(value)).toBe('Sin especificar');
  });
});

/**
 * El desplegable del formulario tiene una opción por landing: agrupadas por silo
 * (`<optgroup>`) se encuentran sin leer las veinte seguidas. El agrupamiento es una
 * función pura sobre el registro, así que se prueba sin renderizar el .astro.
 */
describe('groupInterestsBySilo', () => {
  const SILO_IDS = Object.keys(SILOS) as SiloId[];
  const { groups, other } = groupInterestsBySilo();
  const flat = groups.flatMap((group) => group.options);

  describe('con el registro real', () => {
    it('hay un grupo por silo, en el orden de SILOS', () => {
      expect(groups.map((group) => group.silo)).toEqual(SILO_IDS);
    });

    it('el rótulo de cada grupo es el nombre del silo', () => {
      expect(groups.map((group) => group.label)).toEqual(SILO_IDS.map((silo) => SILOS[silo].name));
      expect(groups.map((group) => group.label)).toEqual([
        'Cursos',
        'Desarrollo',
        'IA y automatización',
        'Cloud y seguridad',
        'Marketing',
      ]);
    });

    it('cada landing aparece UNA sola vez, en el grupo de su silo y con su etiqueta', () => {
      LANDINGS.forEach(({ slug, name, silo }) => {
        const holders = groups.filter((group) => group.options.some((option) => option.value === slug));

        expect(
          holders.map((group) => group.silo),
          slug
        ).toEqual([silo]);
        expect(holders[0].options).toContainEqual({ value: slug, label: name });
      });
    });

    it('dentro de cada grupo respeta el orden del registro', () => {
      groups.forEach((group) => {
        const expected = LANDINGS.filter((landing) => landing.silo === group.silo).map((landing) => landing.slug);

        expect(group.options.map((option) => option.value)).toEqual(expected);
      });
    });

    it('no pierde ni inventa opciones: los grupos más "Otro" son exactamente el catálogo', () => {
      const values = [...flat, other].map((option) => option.value);

      expect(values).toHaveLength(INTERESTS.length);
      expect(new Set(values)).toEqual(new Set(INTERESTS.map((interest) => interest.value)));
      expect(flat).toHaveLength(LANDINGS.length);
    });

    it('"Otro" no pertenece a ningún grupo: va suelto, después de todos', () => {
      expect(other).toEqual(OTHER_INTEREST);
      expect(other).toEqual({ value: 'otro', label: 'Otro' });
      expect(flat.map((option) => option.value)).not.toContain('otro');
    });

    it('no deja grupos vacíos ni rótulos repetidos', () => {
      groups.forEach((group) => expect(group.options.length, group.label).toBeGreaterThan(0));
      expect(new Set(groups.map((group) => group.label)).size).toBe(groups.length);
    });

    it('ningún grupo es tan largo como la lista plana: ese es el punto de agruparlos', () => {
      const biggest = Math.max(...groups.map((group) => group.options.length));

      expect(biggest).toBeLessThan(INTERESTS.length / 2);
    });

    // La opción preseleccionada se marca comparando `option.value === interest`: para que
    // una landing preseleccione SU opción, su slug tiene que estar exactamente una vez.
    it.each(LANDINGS.map((landing) => landing.slug))(
      'el interés "%s" tiene una única opción que seleccionar',
      (slug) => {
        expect([...flat, other].filter((option) => option.value === slug)).toHaveLength(1);
      }
    );

    it('un interés desconocido no coincide con ninguna opción: queda el marcador "Elige una opción"', () => {
      expect([...flat, other].filter((option) => option.value === 'criptomonedas')).toEqual([]);
    });

    it('devuelve datos nuevos cada vez: modificar uno no contamina al siguiente', () => {
      const first = groupInterestsBySilo();
      first.groups.pop();

      expect(groupInterestsBySilo().groups).toHaveLength(SILO_IDS.length);
    });
  });

  describe('con datos propios', () => {
    const silos = { a: { name: 'Silo A' }, b: { name: 'Silo B' }, c: { name: 'Silo C' } };
    const landing = (slug: string, silo: string) => ({ slug, name: `Nombre ${slug}`, silo: silo as SiloId });

    it('omite los silos sin landings en vez de pintar un optgroup vacío', () => {
      const result = groupInterestsBySilo([landing('uno', 'a'), landing('dos', 'c')], silos);

      expect(result.groups.map((group) => group.silo)).toEqual(['a', 'c']);
    });

    it('ordena los grupos por el orden de los silos, no por el de las landings', () => {
      const result = groupInterestsBySilo([landing('uno', 'c'), landing('dos', 'a')], silos);

      expect(result.groups.map((group) => group.label)).toEqual(['Silo A', 'Silo C']);
    });

    it('mantiene el orden de las landings dentro del grupo', () => {
      const result = groupInterestsBySilo([landing('z', 'a'), landing('m', 'b'), landing('b', 'a')], silos);

      expect(result.groups[0].options.map((option) => option.value)).toEqual(['z', 'b']);
      expect(result.groups[0].options[0]).toEqual({ value: 'z', label: 'Nombre z' });
    });

    it('sin landings devuelve cero grupos y conserva "Otro"', () => {
      expect(groupInterestsBySilo([], silos)).toEqual({ groups: [], other: OTHER_INTEREST });
    });

    it('lanza si una landing apunta a un silo que no existe, nombrando la landing y el silo', () => {
      expect(() => groupInterestsBySilo([landing('huerfana', 'zzz')], silos)).toThrow(
        'Unknown silo "zzz" (used by "huerfana")'
      );
    });

    it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
      'no confunde el silo heredado "%s" con uno del registro',
      (inherited) => {
        expect(() => groupInterestsBySilo([landing('x', inherited)], silos)).toThrow('Unknown silo');
      }
    );

    it('no modifica los datos que recibe', () => {
      const landings = Object.freeze([Object.freeze(landing('uno', 'a')), Object.freeze(landing('dos', 'b'))]);
      const frozenSilos = Object.freeze({ a: Object.freeze({ name: 'Silo A' }), b: Object.freeze({ name: 'Silo B' }) });

      expect(() => groupInterestsBySilo(landings, frozenSilos)).not.toThrow();
    });
  });
});
