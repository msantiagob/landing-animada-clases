import { describe, expect, it } from 'vitest';
import { INTERESTS, interestLabel, isValidInterest, normalizeInterest } from '~/lib/interests';

/**
 * El catálogo de intereses es el vocabulario compartido entre el formulario,
 * la API y el panel. Si se desincroniza, los leads caen en una categoría que
 * el panel no sabe mostrar.
 */

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

  it('cubre cada landing con página propia', () => {
    const values = INTERESTS.map((interest) => interest.value);

    [
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
    ].forEach((expected) => expect(values).toContain(expected));
  });

  it('ofrece una salida para quien no sabe qué necesita', () => {
    expect(INTERESTS.map((interest) => interest.value)).toContain('otro');
  });
});

describe('isValidInterest', () => {
  it('acepta un valor del catálogo', () => {
    expect(isValidInterest('ciberseguridad')).toBe(true);
  });

  it.each([
    ['desconocido', 'criptomonedas'],
    ['vacío', ''],
    ['con mayúsculas', 'Ciberseguridad'],
    ['con espacios', ' ciberseguridad '],
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
  });
});

describe('interestLabel', () => {
  it('traduce el valor a la etiqueta que ve el admin', () => {
    expect(interestLabel('whatsapp-business-api')).toBe('WhatsApp Business API (Meta)');
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
    ['desconocido', 'inexistente'],
  ])('muestra "Sin especificar" cuando el valor es %s', (_caso, value) => {
    expect(interestLabel(value)).toBe('Sin especificar');
  });
});
