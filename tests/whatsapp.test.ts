import { describe, expect, it } from 'vitest';
import { BUSINESS } from '~/data/business';
import {
  WHATSAPP_BASE_URL,
  WHATSAPP_DEFAULT_TEXT,
  WHATSAPP_URL_PREFIX,
  whatsappAccessibleName,
  whatsappUrl,
} from '~/utils/whatsapp';

const NUMBER_URL = 'https://wa.me/573106041144';

describe('whatsappUrl', () => {
  it('usa el número del negocio (wa.me: indicativo + número, solo dígitos)', () => {
    expect(BUSINESS.whatsappNumber).toBe('573106041144');
    expect(WHATSAPP_BASE_URL).toBe(NUMBER_URL);
    expect(WHATSAPP_BASE_URL.startsWith(WHATSAPP_URL_PREFIX)).toBe(true);
  });

  it('sin mensaje abre el chat vacío', () => {
    expect(whatsappUrl()).toBe(NUMBER_URL);
  });

  // Un `?text=` vacío prellenaría un mensaje en blanco en el chat.
  it.each([
    ['cadena vacía', ''],
    ['solo espacios', '   '],
    ['saltos de línea y tabulaciones', '\n\t \r\n'],
    ['undefined', undefined],
  ])('trata %s como sin mensaje', (_caso, message) => {
    expect(whatsappUrl(message)).toBe(NUMBER_URL);
  });

  it('prellena el mensaje codificado', () => {
    expect(whatsappUrl('Hola, quiero información')).toBe(`${NUMBER_URL}?text=Hola%2C%20quiero%20informaci%C3%B3n`);
  });

  it('codifica los acentos, la eñe y los signos de apertura', () => {
    const url = whatsappUrl('¿Cuánto cuesta una página web en Medellín? ¡Gracias, señor!');

    expect(url).toContain('%C2%BF'); // ¿
    expect(url).toContain('%C3%A1'); // á
    expect(url).toContain('%C3%B1'); // ñ
    expect(url).toContain('%C2%A1'); // ¡
    expect(url).not.toMatch(/[¿¡áéíóúñ ]/);
  });

  it('codifica "&", "?", "#", "=" y "%": no deben romper ni cortar el parámetro', () => {
    const message = 'Python & JavaScript? #1 100% = ok';
    const url = whatsappUrl(message);

    expect(url.split('?text=')[1]).not.toMatch(/[&?#= ]/);

    // Lo que importa: al decodificar llega EXACTAMENTE lo que se escribió.
    expect(new URL(url).searchParams.get('text')).toBe(message);
  });

  it('el "&" no abre un parámetro nuevo', () => {
    const { searchParams } = new URL(whatsappUrl('Clases de IA & Python'));

    expect([...searchParams.keys()]).toEqual(['text']);
    expect(searchParams.get('text')).toBe('Clases de IA & Python');
  });

  it('conserva los saltos de línea y los emojis', () => {
    const message = 'Hola 👋\nQuiero cotizar';

    expect(new URL(whatsappUrl(message)).searchParams.get('text')).toBe(message);
  });

  it('recorta los espacios alrededor del mensaje', () => {
    expect(whatsappUrl('   Hola   ')).toBe(`${NUMBER_URL}?text=Hola`);
  });

  it('no altera los espacios internos', () => {
    expect(new URL(whatsappUrl('a  b')).searchParams.get('text')).toBe('a  b');
  });

  it('genera una URL válida y de origen wa.me', () => {
    const url = new URL(whatsappUrl('Hola'));

    expect(url.origin).toBe('https://wa.me');
    expect(url.pathname).toBe('/573106041144');
  });

  it.each([
    'Hola, quiero información sobre las clases de inteligencia artificial.',
    'Hola, vengo de sonmyd.co y quiero más información.',
  ])('los mensajes del sitio sobreviven al viaje de ida y vuelta: %s', (message) => {
    expect(new URL(whatsappUrl(message)).searchParams.get('text')).toBe(message);
  });
});

describe('whatsappAccessibleName', () => {
  it('conserva el texto cuando ya nombra WhatsApp', () => {
    expect(whatsappAccessibleName('Escríbenos por WhatsApp')).toBe('Escríbenos por WhatsApp');
    expect(whatsappAccessibleName('Cotizar por whatsapp')).toBe('Cotizar por whatsapp');
  });

  it('agrega WhatsApp cuando el texto visible no lo menciona, sin perder el texto original', () => {
    const name = whatsappAccessibleName('Cotizar ahora');

    expect(name).toBe('Cotizar ahora por WhatsApp');
    expect(name.startsWith('Cotizar ahora')).toBe(true);
  });

  it('recorta espacios alrededor del texto', () => {
    expect(whatsappAccessibleName('  Hablar con un asesor  ')).toBe('Hablar con un asesor por WhatsApp');
  });

  it('cae al texto por defecto si el texto visible está vacío', () => {
    expect(whatsappAccessibleName('')).toBe(WHATSAPP_DEFAULT_TEXT);
    expect(whatsappAccessibleName('   ')).toBe(WHATSAPP_DEFAULT_TEXT);
  });

  it('el texto por defecto ya menciona WhatsApp', () => {
    expect(WHATSAPP_DEFAULT_TEXT).toBe('Escríbenos por WhatsApp');
    expect(whatsappAccessibleName(WHATSAPP_DEFAULT_TEXT)).toBe(WHATSAPP_DEFAULT_TEXT);
  });
});
