import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it, vi } from 'vitest';
import {
  HEADER_ID,
  HEADER_ROW_SELECTOR,
  MENU_GAP,
  MENU_TOP_PROPERTY,
  TOGGLE_SELECTOR,
  initMenuOffset,
  menuTop,
  syncMenuOffset,
} from '~/utils/menu';

/**
 * Posición del menú móvil abierto.
 *
 * Con la barra de anuncio visible la cabecera no está pegada al borde superior y
 * el panel del menú (`position: fixed; top: 70px`) quedaba encima del logo y del
 * botón de cerrar. El `top` se mide al abrir y viaja en `--aw-menu-top`.
 *
 * El entorno de tests es Node: no hay DOM. Cada caso pasa un doble mínimo.
 */

const ROOT = resolve(__dirname, '..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

/** Cabecera simulada cuya fila del logo termina en `rowBottom`; `null` = la fila no existe. */
const fakeHeader = (rowBottom: number | null) => {
  const setProperty = vi.fn();
  const getBoundingClientRect = vi.fn(() => ({ bottom: rowBottom ?? 0 }));
  const querySelector = vi.fn((selector: string) =>
    rowBottom !== null && selector === HEADER_ROW_SELECTOR ? { getBoundingClientRect } : null
  );

  return { header: { style: { setProperty }, querySelector }, setProperty, querySelector, getBoundingClientRect };
};

/** `document` simulado: guarda el listener para poder disparar clics a mano. */
const fakeDocument = (header: ReturnType<typeof fakeHeader>['header'] | null) => {
  const listeners: Array<{ type: string; listener: (event: { target: unknown }) => void; capture: boolean }> = [];
  const getElementById = vi.fn((id: string) => (id === HEADER_ID ? header : null));
  const addEventListener = vi.fn((type: 'click', listener: (event: { target: unknown }) => void, capture: boolean) => {
    listeners.push({ type, listener, capture });
  });

  return {
    doc: { addEventListener, getElementById },
    addEventListener,
    getElementById,
    click: (target: unknown) => listeners.forEach(({ listener }) => listener({ target })),
    listeners,
  };
};

/** Un clic cuyo objetivo está (o no) dentro del botón del menú, como lo resuelve `closest`. */
const clickTarget = (insideToggle: boolean) => ({
  closest: vi.fn((selector: string) => (insideToggle && selector === TOGGLE_SELECTOR ? {} : null)),
});

describe('menuTop', () => {
  // Cabecera pegada arriba: py-3 (12 px) + botón del menú h-12 (48 px) = fila que termina en 60 px.
  it('con la cabecera arriba del todo da los 70 px que tenía el menú: 60 + el hueco', () => {
    expect(MENU_GAP).toBe(10);
    expect(menuTop(60)).toBe(70);
  });

  // Barra de anuncio visible: text-sm (20 px) + py-2.5 (20 px) + borde (1 px) empujan la cabecera 41 px.
  it('con la barra de anuncio visible baja el menú lo mismo que se bajó la cabecera', () => {
    expect(menuTop(60 + 41)).toBe(70 + 41);
  });

  it('redondea la medida fraccionaria al píxel', () => {
    expect(menuTop(100.4)).toBe(110);
    expect(menuTop(100.5)).toBe(111);
  });

  it('admite otro hueco', () => {
    expect(menuTop(60, 0)).toBe(60);
    expect(menuTop(60, 24)).toBe(84);
  });

  it('nunca da un valor negativo, aunque la fila quede fuera de la ventana', () => {
    expect(menuTop(-80)).toBe(0);
    expect(menuTop(-10)).toBe(0);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['-Infinity', Number.NEGATIVE_INFINITY],
  ])('devuelve null si la medida es %s, para no escribir "NaNpx" en el estilo', (_caso, value) => {
    expect(menuTop(value)).toBeNull();
  });
});

describe('syncMenuOffset', () => {
  it('guarda --aw-menu-top en la cabecera: fila arriba del todo → 70px', () => {
    const { header, setProperty } = fakeHeader(60);

    expect(syncMenuOffset(header)).toBe(true);
    expect(setProperty).toHaveBeenCalledTimes(1);
    expect(setProperty).toHaveBeenCalledWith(MENU_TOP_PROPERTY, '70px');
  });

  it('con la barra de anuncio visible la fila termina más abajo y el menú también', () => {
    const { header, setProperty } = fakeHeader(101);

    syncMenuOffset(header);

    expect(setProperty).toHaveBeenCalledWith('--aw-menu-top', '111px');
  });

  it('busca la fila por su atributo data-aw-header-row y la mide en ese momento', () => {
    const { header, querySelector, getBoundingClientRect } = fakeHeader(60);

    syncMenuOffset(header);

    expect(querySelector).toHaveBeenCalledWith('[data-aw-header-row]');
    expect(getBoundingClientRect).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['null', null],
    ['undefined', undefined],
  ])('si no hay cabecera (%s) no hace nada y devuelve false', (_caso, header) => {
    expect(syncMenuOffset(header)).toBe(false);
  });

  it('si la cabecera no tiene la fila marcada no escribe nada', () => {
    const { header, setProperty } = fakeHeader(null);

    expect(syncMenuOffset(header)).toBe(false);
    expect(setProperty).not.toHaveBeenCalled();
  });

  it('si la medida no es un número no escribe nada', () => {
    const { header, setProperty } = fakeHeader(Number.NaN);

    expect(syncMenuOffset(header)).toBe(false);
    expect(setProperty).not.toHaveBeenCalled();
  });
});

describe('initMenuOffset', () => {
  it('registra UN listener de clic en document, en fase de captura, y devuelve true', () => {
    const { doc, addEventListener, listeners } = fakeDocument(fakeHeader(60).header);

    expect(initMenuOffset(doc, {})).toBe(true);
    expect(addEventListener).toHaveBeenCalledTimes(1);
    // Captura: la medida tiene que estar escrita antes de que BasicScripts abra el menú.
    expect(listeners).toEqual([{ type: 'click', listener: expect.any(Function), capture: true }]);
  });

  it('es idempotente: la marca en window evita un segundo listener', () => {
    const win = {};
    const first = fakeDocument(fakeHeader(60).header);
    const second = fakeDocument(fakeHeader(60).header);

    expect(initMenuOffset(first.doc, win)).toBe(true);
    expect(initMenuOffset(second.doc, win)).toBe(false);
    expect(second.addEventListener).not.toHaveBeenCalled();
  });

  it('no registra nada si no hay window o no hay document (SSR)', () => {
    const { doc, addEventListener } = fakeDocument(null);

    expect(initMenuOffset(doc, null)).toBe(false);
    expect(addEventListener).not.toHaveBeenCalled();
    expect(initMenuOffset(undefined, {})).toBe(false);
  });

  it('al tocar el botón del menú mide la cabecera y escribe --aw-menu-top', () => {
    const { header, setProperty } = fakeHeader(101);
    const { doc, click, getElementById } = fakeDocument(header);
    initMenuOffset(doc, {});

    click(clickTarget(true));

    expect(getElementById).toHaveBeenCalledWith('header');
    expect(setProperty).toHaveBeenCalledWith('--aw-menu-top', '111px');
  });

  it('también cuenta el toque en un elemento DENTRO del botón (el icono o su texto)', () => {
    const target = clickTarget(true);
    const { header, setProperty } = fakeHeader(60);
    const { doc, click } = fakeDocument(header);
    initMenuOffset(doc, {});

    click(target);

    expect(target.closest).toHaveBeenCalledWith('[data-aw-toggle-menu]');
    expect(setProperty).toHaveBeenCalledWith('--aw-menu-top', '70px');
  });

  it('un clic fuera del botón no mide nada', () => {
    const { header, setProperty } = fakeHeader(60);
    const { doc, click, getElementById } = fakeDocument(header);
    initMenuOffset(doc, {});

    click(clickTarget(false));

    expect(getElementById).not.toHaveBeenCalled();
    expect(setProperty).not.toHaveBeenCalled();
  });

  it.each([
    ['null', null],
    ['un objetivo sin closest (un nodo de texto)', {}],
    ['un closest que no es función', { closest: 'no soy una función' }],
  ])('ignora un clic con %s, sin lanzar', (_caso, target) => {
    const { header, setProperty } = fakeHeader(60);
    const { doc, click } = fakeDocument(header);
    initMenuOffset(doc, {});

    expect(() => click(target)).not.toThrow();
    expect(setProperty).not.toHaveBeenCalled();
  });

  it('si la página no tiene cabecera, el clic en el botón no lanza', () => {
    const { doc, click } = fakeDocument(null);
    initMenuOffset(doc, {});

    expect(() => click(clickTarget(true))).not.toThrow();
  });

  it('cada apertura vuelve a medir: la cabecera cambia de lugar al hacer scroll', () => {
    const { header, setProperty, getBoundingClientRect } = fakeHeader(101);
    const { doc, click } = fakeDocument(header);
    initMenuOffset(doc, {});

    click(clickTarget(true));
    getBoundingClientRect.mockReturnValue({ bottom: 60 }); // la barra de anuncio ya salió de la pantalla
    click(clickTarget(true));

    expect(setProperty).toHaveBeenNthCalledWith(1, '--aw-menu-top', '111px');
    expect(setProperty).toHaveBeenNthCalledWith(2, '--aw-menu-top', '70px');
  });
});

describe('cableado: el atributo, el script y el CSS dicen lo mismo', () => {
  const header = read('src/components/widgets/Header.astro');
  const css = read('src/assets/styles/tailwind.css');
  const toggle = read('src/components/common/ToggleMenu.astro');

  it('los selectores y la variable son los que el código declara', () => {
    expect(HEADER_ROW_SELECTOR).toBe('[data-aw-header-row]');
    expect(TOGGLE_SELECTOR).toBe('[data-aw-toggle-menu]');
    expect(MENU_TOP_PROPERTY).toBe('--aw-menu-top');
    expect(HEADER_ID).toBe('header');
  });

  it('la primera fila de la cabecera (logo + botón del menú) lleva data-aw-header-row, una sola vez', () => {
    // Sin los comentarios JSX, que mencionan el atributo para explicarlo.
    const markup = header.replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
    const attribute = markup.indexOf('data-aw-header-row');

    expect(markup.match(/data-aw-header-row/g)).toHaveLength(1);

    // La fila es el <div> que contiene el logo y el botón del menú, y termina antes del <nav>.
    const row = markup.slice(markup.lastIndexOf('<div', attribute), markup.indexOf('<nav', attribute));
    expect(row).toContain('<Logo />');
    expect(row).toContain('<ToggleMenu />');
  });

  it('el script de la cabecera registra el listener con initMenuOffset() de ~/utils/menu', () => {
    const script = header.slice(header.lastIndexOf('<script>'));

    expect(script).toMatch(/import \{ initMenuOffset \} from '~\/utils\/menu';/);
    expect(script).toMatch(/\n\s+initMenuOffset\(\);/);
  });

  it('el panel del menú abierto usa la variable, con 70px de respaldo si el script no corre', () => {
    const rule = css.match(/#header\.expanded nav \{[^}]*\}/)?.[0] ?? '';

    expect(rule).toContain(`top: var(${MENU_TOP_PROPERTY}, 70px);`);
    expect(rule).not.toMatch(/top:\s*70px/);
    expect(rule).toMatch(/position:\s*fixed/);
  });

  // Si cambia la altura de la fila, el respaldo de 70px y el hueco dejan de coincidir con el diseño.
  it('el respaldo de 70px es lo que mide la fila con la cabecera arriba: relleno + botón + hueco', () => {
    const padding = Number(header.match(/relative text-default py-(\d+)/)?.[1]) * 4; // py-3 → 12 px
    const button = Number(toggle.match(/(?<![:\w-])h-(\d+) w-\d+/)?.[1]) * 4; // h-12 → 48 px
    const fallback = Number(css.match(/var\(--aw-menu-top, (\d+)px\)/)?.[1]);

    expect(padding).toBe(12);
    expect(button).toBe(48);
    expect(padding + button + MENU_GAP).toBe(fallback);
  });

  it('el menú abierto sigue ocupando la pantalla entre la fila del logo y la barra inferior', () => {
    const rule = css.match(/#header\.expanded nav \{[^}]*\}/)?.[0] ?? '';

    expect(rule).toMatch(/bottom:\s*70px\s*!important/);
    expect(rule).toMatch(/left:\s*0/);
    expect(rule).toMatch(/right:\s*0/);
  });
});
