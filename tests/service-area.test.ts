import { describe, expect, it } from 'vitest';
import { BUSINESS } from '~/data/business';
import type { LandingKind } from '~/data/landings';
import { SERVICE_AREA_TITLE, formatList, nearbyMunicipalities, serviceAreaCopy } from '~/utils/service-area';

const KINDS: LandingKind[] = ['curso', 'servicio'];

/** Cualquier palabra que insinúe un local físico: no hay una sede pública. */
const PHYSICAL_PREMISES =
  /oficina|sede\b|sedes\b|local comercial|direcci[oó]n|dónde queda|vis[ií]tanos|calle|carrera|\bcra\b|edificio|barrio/i;

/** El sitio habla de "tú" (español de Colombia): nada de voseo. */
const VOSEO = /\b(querés|podés|tenés|contanos|escribinos|agendá|mirá|hacé|vos|vivís|necesitás)\b/i;

describe('SERVICE_AREA_TITLE', () => {
  it('es el H2 pedido para el bloque de SEO local', () => {
    expect(SERVICE_AREA_TITLE).toBe('En Medellín y en toda Colombia');
  });
});

describe('formatList', () => {
  it.each([
    [[], ''],
    [['Bello'], 'Bello'],
    [['Bello', 'Sabaneta'], 'Bello y Sabaneta'],
    [['Envigado', 'Sabaneta', 'Bello'], 'Envigado, Sabaneta y Bello'],
  ])('une %j como "%s"', (items, expected) => {
    expect(formatList(items)).toBe(expected);
  });

  // La conjunción "y" se vuelve "e" ante una palabra que empieza por el sonido "i".
  it('usa "e" ante un nombre que empieza por "i"', () => {
    expect(formatList(['Bello', 'Itagüí'])).toBe('Bello e Itagüí');
  });
});

describe('nearbyMunicipalities', () => {
  it('lista los municipios atendidos de BUSINESS sin repetir Medellín', () => {
    expect(nearbyMunicipalities()).toEqual(BUSINESS.areaServed.filter((name) => name !== 'Medellín'));
    expect(nearbyMunicipalities()).not.toContain('Medellín');
  });

  it('incluye cada municipio cercano declarado', () => {
    ['Envigado', 'Sabaneta', 'Itagüí', 'Bello', 'La Estrella', 'Rionegro'].forEach((municipality) =>
      expect(nearbyMunicipalities()).toContain(municipality)
    );
  });
});

describe.each(KINDS)('serviceAreaCopy(%s)', (kind) => {
  const copy = serviceAreaCopy(kind);
  const text = copy.paragraphs.join(' ');

  it('usa el título "En Medellín y en toda Colombia"', () => {
    expect(copy.title).toBe('En Medellín y en toda Colombia');
  });

  it('dice que estamos en Medellín', () => {
    expect(text).toContain('Estamos en Medellín');
  });

  it('nombra cada municipio atendido en persona', () => {
    BUSINESS.areaServed.forEach((municipality) => expect(text).toContain(municipality));
  });

  it('dice que también se trabaja con toda Colombia', () => {
    expect(copy.paragraphs[1]).toContain('toda Colombia');
  });

  it('no afirma una oficina, sede ni dirección física', () => {
    expect(text).not.toMatch(PHYSICAL_PREMISES);
    expect(copy.whatsappMessage).not.toMatch(PHYSICAL_PREMISES);
  });

  it('no habla de "área metropolitana": Rionegro no pertenece a ella', () => {
    expect(text).not.toMatch(/metropolitan/i);
  });

  it('está en español de Colombia con "tú", sin voseo', () => {
    expect(text).not.toMatch(VOSEO);
    expect(copy.whatsappMessage).not.toMatch(VOSEO);
  });

  it('no inventa cifras, plazos ni garantías', () => {
    expect(text).not.toMatch(/\d/);
    expect(text).not.toMatch(/garant|gratis|mejor|líder|años de experiencia|24 horas/i);
  });

  it('trae un mensaje prellenado para el botón de WhatsApp', () => {
    expect(copy.whatsappMessage.trim()).not.toBe('');
    expect(copy.whatsappMessage).toMatch(/^Hola/);
  });
});

describe('serviceAreaCopy: diferencias por tipo de página', () => {
  it('los cursos hablan de clases y estudiantes', () => {
    const text = serviceAreaCopy('curso').paragraphs.join(' ');

    expect(text).toMatch(/clases/i);
    expect(text).toMatch(/online/i);
  });

  it('los servicios hablan de empresas y de trabajo remoto', () => {
    const text = serviceAreaCopy('servicio').paragraphs.join(' ');

    expect(text).toMatch(/empresas/i);
    expect(text).toMatch(/remota/i);
  });

  it('cada tipo tiene su propio texto', () => {
    expect(serviceAreaCopy('curso').paragraphs).not.toEqual(serviceAreaCopy('servicio').paragraphs);
  });
});
