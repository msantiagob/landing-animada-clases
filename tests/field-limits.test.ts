import { describe, expect, it } from 'vitest';
import { FIELD_LIMITS, type LimitedField } from '~/lib/lead-validation';
import { astroSource, read, withoutComments } from './source';

/**
 * Los topes de longitud (`FIELD_LIMITS`) son una sola lista que usan tres lados: los
 * validadores del navegador (tests/lead-validation.test.ts), los endpoints, que son los
 * que mandan (tests/api.contact.test.ts y tests/api.appointments.test.ts), y los
 * formularios, que llevan el tope como `maxlength` para que nadie escriba de más sin
 * enterarse. Acá se comprueba el último lado y que los endpoints no tengan topes propios.
 *
 * Los .astro no se pueden importar desde Vitest, así que se lee el código fuente.
 */

const LEAD_FORM = 'src/components/ui/LeadForm.astro';
const BOOKING = 'src/components/widgets/AppointmentBooking.astro';

/** Las etiquetas de apertura de los campos de texto: `<input>` de texto, correo o teléfono, y `<textarea>`. */
const textFields = (markup: string): string[] =>
  [...markup.matchAll(/<(?:input|textarea)\b[^>]*>/gs)]
    .map(([tag]) => tag)
    .filter((tag) => !/\btype="(?:checkbox|radio|hidden|submit|button)"/.test(tag));

const nameOf = (tag: string): string | undefined => tag.match(/\bname="([^"]+)"/)?.[1];

/** El honeypot lo completa un bot, nunca una persona: el servidor lo descarta sin guardar nada. */
const isHoneypot = (tag: string) => nameOf(tag) === 'website';

describe.each([
  ['LeadForm', LEAD_FORM, ['name', 'email', 'phone', 'message'] satisfies LimitedField[], '/api/contact'],
  [
    'AppointmentBooking',
    BOOKING,
    ['name', 'email', 'phone', 'company', 'message'] satisfies LimitedField[],
    '/api/appointments',
  ],
])('%s: los topes de longitud como maxlength', (_nombre, file, campos) => {
  const { source, frontmatter, markup } = astroSource(file);
  const tags = textFields(markup);

  it('encuentra los campos de texto del formulario', () => {
    expect(tags.length).toBeGreaterThanOrEqual(campos.length);
  });

  it('toma los topes de FIELD_LIMITS, la misma lista que usa el servidor', () => {
    expect(frontmatter).toMatch(/import \{ FIELD_LIMITS \} from '~\/lib\/lead-validation';/);
    expect(source).not.toMatch(/maxlength="\d+"/);
  });

  it.each(campos)('el campo %s lleva maxlength={FIELD_LIMITS.<campo>}', (campo) => {
    const tag = tags.find((candidate) => nameOf(candidate) === campo);

    expect(tag, `no se encontró el campo ${campo}`).toBeDefined();
    expect(tag).toContain(`maxlength={FIELD_LIMITS.${campo}}`);
  });

  it('ningún campo de texto queda sin tope (salvo el honeypot)', () => {
    const sinTope = tags.filter((tag) => !isHoneypot(tag) && !/\bmaxlength=/.test(tag)).map(nameOf);

    expect(sinTope).toEqual([]);
  });
});

describe('los endpoints no tienen topes propios', () => {
  it.each(['src/pages/api/contact.ts', 'src/pages/api/appointments.ts'])(
    '%s toma los topes de lead-validation.ts',
    (file) => {
      const code = withoutComments(read(file));

      expect(code).toMatch(/from '\.\.\/\.\.\/lib\/lead-validation'/);
      expect(code).toMatch(/findTooLongField\(/);
      expect(code).toMatch(/tooLongMessage\(/);
      // Un número suelto como tope (`.length > 5000`) sería una segunda lista que se desfasa.
      expect(code).not.toMatch(/\.length\s*>\s*\d+/);
      expect(code).not.toMatch(/MAX_[A-Z_]*LENGTH/);
    }
  );

  it('el endpoint de contacto recorta la página de origen con el tope de FIELD_LIMITS', () => {
    expect(read('src/pages/api/contact.ts')).toMatch(/clip\([^;]*FIELD_LIMITS\.sourcePage\)/s);
  });
});

describe('FIELD_LIMITS', () => {
  it('todos los topes son enteros positivos', () => {
    Object.entries(FIELD_LIMITS).forEach(([campo, max]) => {
      expect(Number.isInteger(max), campo).toBe(true);
      expect(max, campo).toBeGreaterThan(0);
    });
  });

  // El mensaje del lead tiene un mínimo de 10 caracteres (lead-validation.ts): un tope menor no dejaría escribir ninguno válido.
  it('el tope del mensaje cabe por encima del mínimo del formulario', () => {
    expect(FIELD_LIMITS.message).toBeGreaterThan(10);
  });
});
