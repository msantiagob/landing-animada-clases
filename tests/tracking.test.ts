import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUSINESS } from '~/data/business';
import {
  LEAD_EVENT,
  WHATSAPP_EVENT,
  WHATSAPP_LINK_SELECTOR,
  gtmHeadSnippet,
  gtmNoscriptUrl,
  initWhatsAppTracking,
  isValidGtmId,
  pushDataLayer,
  trackLead,
  trackWhatsAppClick,
  whatsappLocationFromClick,
} from '~/utils/tracking';

/**
 * El entorno de tests es Node: no hay `window`. Cada caso lo simula con
 * `vi.stubGlobal` y se limpia después, para que ningún test dependa de otro.
 */
type FakeWindow = {
  dataLayer?: unknown;
  location?: { pathname: string };
  __sonmydWhatsAppTracking?: boolean;
};

const stubWindow = (win: FakeWindow = {}) => {
  vi.stubGlobal('window', win);
  return win;
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isValidGtmId', () => {
  it.each(['GTM-KNZPFWXB', 'GTM-ABCD', 'GTM-A1B2C3', 'GTM-ABCDEFGHIJ', 'GTM-1234'])('acepta %s', (id) => {
    expect(isValidGtmId(id)).toBe(true);
  });

  it.each([
    ['vacío', ''],
    ['sin prefijo', 'KNZPFWXB'],
    ['prefijo en minúsculas', 'gtm-KNZPFWXB'],
    ['sufijo en minúsculas', 'GTM-knzpfwxb'],
    ['demasiado corto', 'GTM-ABC'],
    ['demasiado largo', 'GTM-ABCDEFGHIJK'],
    ['con espacios alrededor', ' GTM-KNZPFWXB '],
    ['con guion bajo', 'GTM-KNZP_WXB'],
    ['un ID de GA4', 'G-ABCDEFGHIJ'],
    ['un ID de Google Ads', 'AW-123456789'],
    ['con salto de línea al final', 'GTM-KNZPFWXB\n'],
  ])('rechaza un ID %s', (_caso, id) => {
    expect(isValidGtmId(id)).toBe(false);
  });

  // El ID se interpola dentro de un <script> inline: tiene que ser imposible
  // colar código por ahí.
  it.each([
    ["cierre de cadena y código: GTM-ABCD');alert(1);//", "GTM-ABCD');alert(1);//"],
    ['cierre de script', 'GTM-ABCD</script><script>alert(1)</script>'],
    ['comillas', 'GTM-AB"CD'],
  ])('rechaza un intento de inyección: %s', (_caso, id) => {
    expect(isValidGtmId(id)).toBe(false);
  });

  it.each([undefined, null, 123, {}, [], true])('rechaza un valor que no es texto: %j', (value) => {
    expect(isValidGtmId(value)).toBe(false);
  });

  it('el contenedor configurado en BUSINESS es válido', () => {
    expect(BUSINESS.gtmId).toBe('GTM-KNZPFWXB');
    expect(isValidGtmId(BUSINESS.gtmId)).toBe(true);
  });
});

describe('gtmHeadSnippet', () => {
  const snippet = gtmHeadSnippet('GTM-KNZPFWXB');

  it('carga gtm.js desde googletagmanager.com con el ID del contenedor', () => {
    expect(snippet).toContain('https://www.googletagmanager.com/gtm.js?id=');
    expect(snippet).toContain("'dataLayer','GTM-KNZPFWXB')");
  });

  it('declara el ID una sola vez', () => {
    expect(snippet.match(/GTM-KNZPFWXB/g)).toHaveLength(1);
  });

  it('no incluye las etiquetas <script>: las pone el componente', () => {
    expect(snippet).not.toMatch(/<\/?script/i);
  });

  it.each(['', 'GTM-', "GTM-ABCD');alert(1);//", '<script>'])(
    'se niega a generar código con el ID inválido %j',
    (id) => {
      expect(() => gtmHeadSnippet(id)).toThrow(/Invalid Google Tag Manager id/);
    }
  );

  // Se ejecuta el fragmento contra un navegador simulado: comprueba el
  // comportamiento real (arranque del dataLayer y carga asíncrona), no solo texto.
  it('al ejecutarse arranca el dataLayer e inserta el script asíncrono de GTM', () => {
    const insertBefore = vi.fn();
    const firstScript = { parentNode: { insertBefore } };
    const created: Array<{ async?: boolean; src?: string }> = [];
    const fakeDocument = {
      getElementsByTagName: vi.fn(() => [firstScript]),
      createElement: vi.fn(() => {
        const element = {};
        created.push(element);
        return element;
      }),
    };
    const fakeWindow: { dataLayer?: Array<Record<string, unknown>> } = {};

    new Function('window', 'document', snippet)(fakeWindow, fakeDocument);

    expect(fakeWindow.dataLayer).toHaveLength(1);
    expect(fakeWindow.dataLayer?.[0]).toMatchObject({ event: 'gtm.js' });
    expect(typeof fakeWindow.dataLayer?.[0]['gtm.start']).toBe('number');

    expect(fakeDocument.createElement).toHaveBeenCalledWith('script');
    expect(created[0]).toMatchObject({ async: true, src: 'https://www.googletagmanager.com/gtm.js?id=GTM-KNZPFWXB' });
    expect(insertBefore).toHaveBeenCalledWith(created[0], firstScript);
  });

  it('al ejecutarse respeta lo que ya estaba en el dataLayer', () => {
    const existing = { event: 'previo' };
    const fakeWindow = { dataLayer: [existing] as Array<Record<string, unknown>> };
    const fakeDocument = {
      getElementsByTagName: () => [{ parentNode: { insertBefore: vi.fn() } }],
      createElement: () => ({}),
    };

    new Function('window', 'document', snippet)(fakeWindow, fakeDocument);

    expect(fakeWindow.dataLayer).toHaveLength(2);
    expect(fakeWindow.dataLayer[0]).toBe(existing);
    expect(fakeWindow.dataLayer[1]).toMatchObject({ event: 'gtm.js' });
  });
});

describe('gtmNoscriptUrl', () => {
  it('apunta al iframe oficial de GTM con el ID del contenedor', () => {
    expect(gtmNoscriptUrl('GTM-KNZPFWXB')).toBe('https://www.googletagmanager.com/ns.html?id=GTM-KNZPFWXB');
  });

  it('se niega a generar la URL con un ID inválido', () => {
    expect(() => gtmNoscriptUrl('GTM-x"><script>')).toThrow(/Invalid Google Tag Manager id/);
  });
});

describe('pushDataLayer', () => {
  it('en el servidor (sin window) no hace nada y no lanza', () => {
    expect(typeof window).toBe('undefined');
    expect(() => pushDataLayer('page_view', { a: 1 })).not.toThrow();
    expect((globalThis as Record<string, unknown>).dataLayer).toBeUndefined();
  });

  it('crea window.dataLayer si GTM todavía no cargó y empuja el evento', () => {
    const win = stubWindow();

    pushDataLayer('generate_lead', { interest: 'clases-de-ia' });

    expect(win.dataLayer).toEqual([{ event: 'generate_lead', interest: 'clases-de-ia' }]);
  });

  it('agrega al dataLayer existente sin pisar lo que GTM ya encoló', () => {
    const previous = { event: 'gtm.js' };
    const win = stubWindow({ dataLayer: [previous] });

    pushDataLayer('whatsapp_click');

    expect(win.dataLayer).toEqual([previous, { event: 'whatsapp_click' }]);
    expect((win.dataLayer as unknown[])[0]).toBe(previous);
  });

  it('sin parámetros empuja solo el evento', () => {
    const win = stubWindow();

    pushDataLayer('scroll_depth');

    expect(win.dataLayer).toEqual([{ event: 'scroll_depth' }]);
  });

  it('un parámetro llamado "event" no puede pisar el nombre del evento', () => {
    const win = stubWindow();

    pushDataLayer('generate_lead', { event: 'otro', interest: 'x' });

    expect(win.dataLayer).toEqual([{ event: 'generate_lead', interest: 'x' }]);
  });

  it('respeta un push personalizado (GTM reemplaza dataLayer.push al cargar)', () => {
    const received: unknown[] = [];
    stubWindow({ dataLayer: Object.assign([], { push: (item: unknown) => received.push(item) }) });

    pushDataLayer('whatsapp_click', { link_location: 'float' });

    expect(received).toEqual([{ event: 'whatsapp_click', link_location: 'float' }]);
  });

  it('reemplaza un dataLayer corrupto (que no es un arreglo)', () => {
    const win = stubWindow({ dataLayer: { push: 'no soy una función' } });

    pushDataLayer('generate_lead');

    expect(win.dataLayer).toEqual([{ event: 'generate_lead' }]);
  });

  // Medir nunca debe romper el formulario: si el push falla, el lead ya se guardó.
  it('no lanza aunque el push falle', () => {
    stubWindow({
      dataLayer: Object.assign([], {
        push: () => {
          throw new Error('bloqueado por un script de terceros');
        },
      }),
    });

    expect(() => pushDataLayer('generate_lead')).not.toThrow();
  });

  it('no lanza con un dataLayer congelado', () => {
    stubWindow({ dataLayer: Object.freeze([]) });

    expect(() => pushDataLayer('generate_lead')).not.toThrow();
  });
});

describe('trackLead', () => {
  it('empuja generate_lead con el interés y el formulario', () => {
    const win = stubWindow();

    trackLead({ interest: 'clases-de-ia', formId: 'lead' });

    expect(LEAD_EVENT).toBe('generate_lead');
    expect(win.dataLayer).toEqual([{ event: 'generate_lead', interest: 'clases-de-ia', form_id: 'lead' }]);
  });

  it('reporta la reserva de una cita como interest=booking', () => {
    const win = stubWindow();

    trackLead({ interest: 'booking', formId: 'booking' });

    expect(win.dataLayer).toEqual([{ event: 'generate_lead', interest: 'booking', form_id: 'booking' }]);
  });

  it.each([
    ['vacío', ''],
    ['solo espacios', '   '],
    ['null', null],
    ['undefined', undefined],
  ])('un interés %s se reporta como "sin-especificar"', (_caso, interest) => {
    const win = stubWindow();

    trackLead({ interest, formId: 'lead' });

    expect(win.dataLayer).toEqual([{ event: 'generate_lead', interest: 'sin-especificar', form_id: 'lead' }]);
  });

  it('recorta el interés', () => {
    const win = stubWindow();

    trackLead({ interest: '  ciberseguridad ', formId: 'contacto' });

    expect(win.dataLayer).toEqual([{ event: 'generate_lead', interest: 'ciberseguridad', form_id: 'contacto' }]);
  });

  it('en el servidor no hace nada', () => {
    expect(() => trackLead({ interest: 'x', formId: 'lead' })).not.toThrow();
  });
});

describe('trackWhatsAppClick', () => {
  it('empuja whatsapp_click con la ubicación del botón y la ruta de la página', () => {
    const win = stubWindow({ location: { pathname: '/clases-de-python' } });

    trackWhatsAppClick('float');

    expect(WHATSAPP_EVENT).toBe('whatsapp_click');
    expect(win.dataLayer).toEqual([
      { event: 'whatsapp_click', link_location: 'float', page_path: '/clases-de-python' },
    ]);
  });

  it('reporta la ruta vacía si el navegador no expone location', () => {
    const win = stubWindow();

    trackWhatsAppClick('hero');

    expect(win.dataLayer).toEqual([{ event: 'whatsapp_click', link_location: 'hero', page_path: '' }]);
  });
});

describe('whatsappLocationFromClick', () => {
  const link = (dataset: Record<string, string | undefined> = {}) => ({ dataset });
  const clickOn = (closest: ReturnType<typeof vi.fn>) => ({ target: { closest } });

  it('busca el enlace a wa.me más cercano al elemento clicado', () => {
    const closest = vi.fn(() => link({ whatsappLocation: 'hero' }));

    whatsappLocationFromClick(clickOn(closest));

    expect(WHATSAPP_LINK_SELECTOR).toBe('a[href^="https://wa.me/"]');
    expect(closest).toHaveBeenCalledWith('a[href^="https://wa.me/"]');
  });

  it('devuelve la ubicación declarada en data-whatsapp-location', () => {
    expect(whatsappLocationFromClick(clickOn(vi.fn(() => link({ whatsappLocation: 'service-area' }))))).toBe(
      'service-area'
    );
  });

  it.each([
    ['no declara la ubicación', {}],
    ['la declara vacía', { whatsappLocation: '' }],
  ])('devuelve "link" cuando el enlace %s', (_caso, dataset) => {
    expect(whatsappLocationFromClick(clickOn(vi.fn(() => link(dataset))))).toBe('link');
  });

  it('devuelve null cuando el clic no cayó dentro de un enlace a WhatsApp', () => {
    expect(whatsappLocationFromClick(clickOn(vi.fn(() => null)))).toBeNull();
  });

  it.each([
    ['sin destino', { target: null }],
    ['un destino sin closest (document o nodo de texto)', { target: {} }],
    ['un destino con closest que no es función', { target: { closest: 'no' } }],
  ])('devuelve null con %s', (_caso, event) => {
    expect(whatsappLocationFromClick(event)).toBeNull();
  });
});

describe('initWhatsAppTracking', () => {
  type Listener = (event: { target: unknown }) => void;

  const fakeDocument = () => {
    const listeners: Array<{ type: string; listener: Listener }> = [];
    return {
      listeners,
      addEventListener: vi.fn((type: string, listener: Listener) => {
        listeners.push({ type, listener });
      }),
    };
  };

  const clickOnLink = (location?: string) => ({
    target: { closest: () => ({ dataset: location ? { whatsappLocation: location } : {} }) },
  });
  const clickElsewhere = () => ({ target: { closest: () => null } });

  it('registra UN listener de clic en el documento y marca la ventana', () => {
    const win = stubWindow();
    const doc = fakeDocument();

    expect(initWhatsAppTracking(doc)).toBe(true);

    expect(doc.addEventListener).toHaveBeenCalledTimes(1);
    expect(doc.listeners[0].type).toBe('click');
    expect(win.__sonmydWhatsAppTracking).toBe(true);
  });

  it('es idempotente: una segunda llamada no duplica el listener', () => {
    stubWindow();
    const doc = fakeDocument();

    expect(initWhatsAppTracking(doc)).toBe(true);
    expect(initWhatsAppTracking(doc)).toBe(false);
    expect(initWhatsAppTracking(fakeDocument())).toBe(false);

    expect(doc.addEventListener).toHaveBeenCalledTimes(1);
  });

  it('en el servidor (sin window) no registra nada', () => {
    const doc = fakeDocument();

    expect(initWhatsAppTracking(doc)).toBe(false);
    expect(doc.addEventListener).not.toHaveBeenCalled();
  });

  it('sin documento disponible no lanza y devuelve false', () => {
    stubWindow();

    expect(initWhatsAppTracking()).toBe(false);
  });

  it('un clic en un enlace a WhatsApp dispara whatsapp_click con su ubicación y la ruta', () => {
    const win = stubWindow({ location: { pathname: '/servicios' } });
    const doc = fakeDocument();
    initWhatsAppTracking(doc);

    doc.listeners[0].listener(clickOnLink('service-area'));

    expect(win.dataLayer).toEqual([
      { event: 'whatsapp_click', link_location: 'service-area', page_path: '/servicios' },
    ]);
  });

  it('un enlace a WhatsApp escrito a mano (sin data-whatsapp-location) se reporta como "link"', () => {
    const win = stubWindow({ location: { pathname: '/blog/que-es-n8n' } });
    const doc = fakeDocument();
    initWhatsAppTracking(doc);

    doc.listeners[0].listener(clickOnLink());

    expect(win.dataLayer).toEqual([{ event: 'whatsapp_click', link_location: 'link', page_path: '/blog/que-es-n8n' }]);
  });

  it('un clic fuera de un enlace a WhatsApp no dispara nada', () => {
    const win = stubWindow();
    const doc = fakeDocument();
    initWhatsAppTracking(doc);

    doc.listeners[0].listener(clickElsewhere());
    doc.listeners[0].listener({ target: null });

    expect(win.dataLayer).toBeUndefined();
  });

  it('cuenta cada clic una sola vez', () => {
    const win = stubWindow();
    const doc = fakeDocument();
    initWhatsAppTracking(doc);
    initWhatsAppTracking(doc);

    doc.listeners[0].listener(clickOnLink('float'));

    expect(win.dataLayer).toHaveLength(1);
  });
});
