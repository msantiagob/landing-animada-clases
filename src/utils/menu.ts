/**
 * Posición del menú móvil abierto.
 *
 * Al abrirse, el panel del menú es `position: fixed` y tiene que arrancar justo
 * debajo de la fila del logo. Con un `top` fijo (`70px`) eso solo es cierto
 * cuando la cabecera está pegada al borde superior. Mientras la barra de
 * anuncio es visible (la página arriba del todo) la cabecera empieza más abajo,
 * y el primer grupo del menú quedaba encima del logo y del botón de cerrar.
 *
 * Por eso, al tocar el botón del menú se mide dónde termina la fila del logo y se
 * publica en `--aw-menu-top` sobre la cabecera; `tailwind.css` la usa como `top`
 * del panel (con `70px` de respaldo si el script no corre). La medida se toma
 * con el menú aún cerrado: es la posición real de la cabecera en ese momento,
 * con o sin barra de anuncio, y el scroll queda bloqueado mientras está abierto.
 *
 * Todo vive aquí y no en un script inline para poder probarlo sin un navegador:
 * el DOM y la ventana se reciben por parámetro.
 */

/** Variable CSS que lee `#header.expanded nav` en tailwind.css. */
export const MENU_TOP_PROPERTY = '--aw-menu-top';

/** Hueco entre el borde inferior de la fila del logo y el panel. Es el que ya tenía `top: 70px`. */
export const MENU_GAP = 10;

export const TOGGLE_SELECTOR = '[data-aw-toggle-menu]';
export const HEADER_ROW_SELECTOR = '[data-aw-header-row]';
export const HEADER_ID = 'header';

/**
 * `top` del panel, en píxeles, a partir del borde inferior de la fila del logo
 * (coordenadas de la ventana). Devuelve `null` si la medida no es un número
 * finito, para no escribir `NaNpx` en el estilo.
 */
export const menuTop = (rowBottom: number, gap: number = MENU_GAP): number | null =>
  Number.isFinite(rowBottom) ? Math.max(0, Math.round(rowBottom + gap)) : null;

interface RowLike {
  getBoundingClientRect: () => { bottom: number };
}

interface HeaderLike {
  style: { setProperty: (name: string, value: string) => void };
  querySelector: (selector: string) => RowLike | null;
}

/**
 * Mide la fila del logo de la cabecera y guarda `--aw-menu-top` en ella.
 * Devuelve `true` solo si escribió la variable.
 */
export const syncMenuOffset = (header: HeaderLike | null | undefined): boolean => {
  const row = header?.querySelector(HEADER_ROW_SELECTOR);
  if (!header || !row) return false;

  const top = menuTop(row.getBoundingClientRect().bottom);
  if (top === null) return false;

  header.style.setProperty(MENU_TOP_PROPERTY, `${top}px`);
  return true;
};

interface TrackingWindow {
  __sonmydMenuOffset?: boolean;
}

const getWindow = (): TrackingWindow | null =>
  typeof window === 'undefined' ? null : (window as unknown as TrackingWindow);

type MenuDocument = {
  addEventListener: (type: 'click', listener: (event: { target: unknown }) => void, capture: boolean) => void;
  getElementById: (id: string) => HeaderLike | null;
};

interface ClickableLike {
  closest?: (selector: string) => unknown;
}

/**
 * UN solo listener delegado en `document` para el botón del menú. Delegar evita
 * volver a enlazar tras cada navegación del ClientRouter (el `<header>` se
 * reemplaza, `document` no), y va en fase de captura para que la medida ya esté
 * escrita cuando el manejador de BasicScripts abra el menú. La marca en `window`
 * evita duplicarlo si este código se ejecutara dos veces.
 *
 * Devuelve `true` solo cuando registró el listener.
 */
export const initMenuOffset = (target?: MenuDocument, win: TrackingWindow | null = getWindow()): boolean => {
  const root = target ?? (typeof document === 'undefined' ? undefined : (document as unknown as MenuDocument));

  if (!win || !root || win.__sonmydMenuOffset) return false;
  win.__sonmydMenuOffset = true;

  root.addEventListener(
    'click',
    (event) => {
      const clicked = event.target as ClickableLike | null;
      if (typeof clicked?.closest !== 'function' || !clicked.closest(TOGGLE_SELECTOR)) return;

      syncMenuOffset(root.getElementById(HEADER_ID));
    },
    true
  );

  return true;
};
