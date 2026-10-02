import { describe, expect, it } from 'vitest';
import {
  EMAIL_PATTERN,
  FIELD_LIMITS,
  LEAD_FIELDS,
  MESSAGE_MIN_LENGTH,
  PHONE_PATTERN,
  clip,
  findInvalidFields,
  findTooLongField,
  tooLongMessage,
  validators,
  type LeadField,
  type LimitedField,
} from '~/lib/lead-validation';
import { findVoseo } from './voseo';

/**
 * Validación del formulario en el navegador. Es UX, no seguridad: la barrera
 * real está en la API. Estos tests cubren que el usuario reciba el mensaje
 * correcto en el campo correcto, que es lo que define si termina de completar
 * el formulario o lo abandona.
 */

describe('validador de nombre', () => {
  it('rechaza vacío', () => {
    expect(validators.name('')).toBe('Escribe tu nombre.');
  });

  it('rechaza una sola letra', () => {
    expect(validators.name('A')).toMatch(/demasiado corto/);
  });

  it('acepta un nombre de dos letras', () => {
    expect(validators.name('Ana')).toBeNull();
  });

  it('acepta exactamente dos caracteres, que es el mínimo', () => {
    expect(validators.name('Al')).toBeNull();
  });

  it('acepta nombres con acentos y apellidos compuestos', () => {
    expect(validators.name('María José Peña Gutiérrez')).toBeNull();
  });
});

describe('validador de email', () => {
  it('rechaza vacío', () => {
    expect(validators.email('')).toMatch(/Necesitamos un email/);
  });

  it.each([
    ['sin arroba', 'anaejemplo.com'],
    ['sin dominio', 'ana@'],
    ['sin extensión', 'ana@ejemplo'],
    ['sin usuario', '@ejemplo.com'],
    ['con espacio', 'ana perez@ejemplo.com'],
  ])('rechaza un email %s', (_caso, value) => {
    expect(validators.email(value)).toBe('Revisa el email: parece incompleto.');
  });

  it.each([
    ['simple', 'ana@ejemplo.com'],
    ['con subdominio', 'ana@mail.ejemplo.com'],
    ['con punto en el usuario', 'ana.perez@ejemplo.com'],
    ['con signo más', 'ana+leads@ejemplo.com'],
  ])('acepta un email %s', (_caso, value) => {
    expect(validators.email(value)).toBeNull();
  });
});

describe('validador de teléfono', () => {
  // Es el único campo opcional del formulario: vacío tiene que pasar.
  it('acepta vacío porque el campo es opcional', () => {
    expect(validators.phone('')).toBeNull();
  });

  it.each([
    ['internacional con espacios', '+57 300 000 0000'],
    ['con paréntesis', '+54 (11) 4000-0000'],
    ['solo dígitos', '3000000000'],
    ['con guiones', '300-000-0000'],
  ])('acepta un teléfono %s', (_caso, value) => {
    expect(validators.phone(value)).toBeNull();
  });

  it.each([
    ['demasiado corto', '12345'],
    ['con letras', '300 ABC 0000'],
    ['que empieza con paréntesis', '(11) 4000-0000'],
  ])('rechaza un teléfono %s', (_caso, value) => {
    expect(validators.phone(value)).toBe('Revisa el teléfono: solo números, espacios y +.');
  });

  it('el mínimo son 7 signos: con 6 rechaza y con 7 acepta', () => {
    expect(validators.phone('+12345')).not.toBeNull();
    expect(validators.phone('+123456')).toBeNull();
  });
});

describe('validador de mensaje', () => {
  it('rechaza vacío', () => {
    expect(validators.message('')).toBe('Cuéntanos brevemente qué necesitas.');
  });

  it('rechaza un mensaje de menos de 10 caracteres', () => {
    expect(validators.message('hola')).toMatch(/más de detalle/);
  });

  it('rechaza exactamente 9 caracteres: el mínimo es MESSAGE_MIN_LENGTH', () => {
    expect(MESSAGE_MIN_LENGTH).toBe(10);
    expect(validators.message('123456789')).toBe('Un poco más de detalle nos ayuda a responderte mejor.');
  });

  it('acepta exactamente 10 caracteres', () => {
    expect(validators.message('1234567890')).toBeNull();
  });

  it('acepta un mensaje real', () => {
    expect(validators.message('Recibimos 200 mensajes por WhatsApp al día y no damos abasto.')).toBeNull();
  });
});

describe('findInvalidFields', () => {
  const valido = {
    name: 'Ana Pérez',
    email: 'ana@ejemplo.com',
    phone: '+57 300 000 0000',
    message: 'Quiero automatizar la atención por WhatsApp.',
  };

  it('no devuelve nada cuando todo es válido', () => {
    expect(findInvalidFields(valido)).toEqual([]);
  });

  it('ignora el teléfono ausente', () => {
    expect(findInvalidFields({ ...valido, phone: undefined })).toEqual([]);
  });

  it('recorta espacios antes de validar', () => {
    expect(findInvalidFields({ ...valido, name: '   ' })).toEqual(['name']);
  });

  it('un mensaje de solo espacios cuenta como vacío', () => {
    expect(findInvalidFields({ ...valido, message: '          ' })).toEqual(['message']);
  });

  it('un teléfono de solo espacios cuenta como ausente, no como inválido', () => {
    expect(findInvalidFields({ ...valido, phone: '     ' })).toEqual([]);
  });

  it('devuelve los campos en el orden del formulario, no en el de aparición del error', () => {
    // Importa porque el formulario mueve el foco al PRIMER inválido: si el
    // orden no fuera estable, el foco saltaría a un campo de más abajo.
    const invalidos = findInvalidFields({ name: '', email: 'roto', phone: 'abc', message: '' });

    expect(invalidos).toEqual(['name', 'email', 'phone', 'message']);
  });

  it('detecta un único campo inválido entre válidos', () => {
    expect(findInvalidFields({ ...valido, email: 'sin-arroba' })).toEqual(['email']);
  });
});

describe('contrato de campos', () => {
  it('expone exactamente los campos que el formulario valida', () => {
    expect(LEAD_FIELDS).toEqual(['name', 'email', 'phone', 'message']);
  });

  it('tiene un validador por cada campo declarado', () => {
    LEAD_FIELDS.forEach((field) => expect(typeof validators[field]).toBe('function'));
  });

  it('los patrones exportados coinciden con los que usan los validadores', () => {
    expect(EMAIL_PATTERN.test('ana@ejemplo.com')).toBe(true);
    expect(PHONE_PATTERN.test('+57 300 000 0000')).toBe(true);
  });
});

/**
 * Estos mensajes se pintan tal cual debajo del campo: son lo primero que lee un
 * visitante colombiano cuando se equivoca. Se recorren TODOS los caminos de
 * error de cada validador, no solo los que otros tests casualmente tocan.
 */
describe('voz de los mensajes: español de Colombia con "tú"', () => {
  const ENTRADAS_INVALIDAS: Record<LeadField, string[]> = {
    name: ['', 'A'],
    email: ['', 'sin-arroba', 'ana@', '@ejemplo.com'],
    phone: ['12345', 'abc', '300 ABC 0000'],
    message: ['', 'hola'],
  };

  const mensajes = LEAD_FIELDS.flatMap((field) =>
    ENTRADAS_INVALIDAS[field].map((value) => ({ field, value, message: validators[field](value) }))
  );

  // Si alguien agrega una entrada que en realidad es válida, el test de voseo de
  // abajo recibiría `null` y fallaría con un error confuso; esto lo explica.
  it('cada entrada de la lista es de verdad inválida', () => {
    mensajes.forEach(({ field, value, message }) =>
      expect(message, `${field} con ${JSON.stringify(value)} debería ser inválido`).not.toBeNull()
    );
  });

  it.each(mensajes)('el mensaje de $field con "$value" no usa voseo', ({ message }) => {
    expect(findVoseo(message as string)).toEqual([]);
  });
});

/**
 * Topes de longitud. Son los mismos que aplica el servidor (tests/api.contact.test.ts y
 * tests/api.appointments.test.ts) y que llevan los formularios como `maxlength`
 * (tests/field-limits.test.ts): una sola lista, `FIELD_LIMITS`.
 */
describe('topes de longitud', () => {
  const DOMINIO = '@ejemplo.com';

  /** Un texto de exactamente `length` caracteres que es válido para el campo. */
  const deLongitud = (field: LimitedField, length: number): string =>
    field === 'email' ? 'a'.repeat(length - DOMINIO.length) + DOMINIO : (field === 'phone' ? '3' : 'a').repeat(length);

  it('fijan el máximo de cada campo', () => {
    expect(FIELD_LIMITS).toEqual({
      name: 100,
      email: 254,
      phone: 30,
      company: 100,
      message: 5000,
      serviceType: 100,
      sourcePage: 2048,
    });
  });

  it('el del email es el de RFC 5321: una dirección no pasa de 254 caracteres', () => {
    expect(FIELD_LIMITS.email).toBe(254);
  });

  describe.each([
    ['name', 100],
    ['email', 254],
    ['phone', 30],
    ['message', 5000],
  ] as const)('el validador de %s (máximo %i)', (field, max) => {
    it('acepta un valor de exactamente el máximo', () => {
      const value = deLongitud(field, max);

      expect(value).toHaveLength(max);
      expect(validators[field](value)).toBeNull();
    });

    it('rechaza uno de un carácter más, con el aviso de "demasiado largo"', () => {
      const value = deLongitud(field, max + 1);

      expect(value).toHaveLength(max + 1);
      expect(validators[field](value)).toBe(tooLongMessage(field));
    });

    it('findInvalidFields lo marca como inválido', () => {
      const valido = {
        name: 'Ana Pérez',
        email: 'ana@ejemplo.com',
        phone: '+57 300 000 0000',
        message: 'Quiero automatizar la atención por WhatsApp.',
      };

      expect(findInvalidFields({ ...valido, [field]: deLongitud(field, max) })).toEqual([]);
      expect(findInvalidFields({ ...valido, [field]: deLongitud(field, max + 1) })).toEqual([field]);
    });
  });

  describe('el aviso', () => {
    it.each([
      ['name', 'El nombre es demasiado largo. Usa máximo 100 caracteres.'],
      ['email', 'El email es demasiado largo. Usa máximo 254 caracteres.'],
      ['phone', 'El teléfono es demasiado largo. Usa máximo 30 caracteres.'],
      ['company', 'El nombre de la empresa es demasiado largo. Usa máximo 100 caracteres.'],
      ['message', 'El mensaje es demasiado largo. Usa máximo 5000 caracteres.'],
      ['serviceType', 'El tipo de servicio es demasiado largo. Usa máximo 100 caracteres.'],
    ] as const)('de %s dice qué pasó y cuál es el máximo', (field, expected) => {
      expect(tooLongMessage(field)).toBe(expected);
    });

    it.each(['name', 'email', 'phone', 'company', 'message', 'serviceType'] as const)(
      'de %s le habla de "tú", sin voseo',
      (field) => {
        expect(findVoseo(tooLongMessage(field))).toEqual([]);
        expect(tooLongMessage(field)).toMatch(/\bUsa\b/);
      }
    );
  });

  describe('findTooLongField', () => {
    it('devuelve null cuando todo está en el tope o por debajo, o ausente', () => {
      expect(
        findTooLongField({
          name: 'a'.repeat(100),
          email: deLongitud('email', 254),
          phone: null,
          company: undefined,
          message: 'a'.repeat(5000),
        })
      ).toBeNull();
      expect(findTooLongField({})).toBeNull();
    });

    it('devuelve el campo que pasa su tope', () => {
      expect(findTooLongField({ company: 'a'.repeat(101) })).toBe('company');
      expect(findTooLongField({ serviceType: 'a'.repeat(101) })).toBe('serviceType');
    });

    it('con varios pasados, devuelve el primero en el orden del formulario: nombre, email, teléfono, empresa, mensaje', () => {
      expect(findTooLongField({ message: 'a'.repeat(5001), name: 'a'.repeat(101) })).toBe('name');
      expect(findTooLongField({ message: 'a'.repeat(5001), phone: '3'.repeat(31), company: 'a'.repeat(101) })).toBe(
        'phone'
      );
    });

    it('mide el texto tal como llega: recortar espacios es cosa de quien lo llama', () => {
      expect(findTooLongField({ name: `  ${'a'.repeat(100)}  ` })).toBe('name');
    });
  });

  describe('clip', () => {
    it('deja igual lo que cabe, incluido lo que mide exactamente el máximo', () => {
      expect(clip('/contact', 2048)).toBe('/contact');
      expect(clip('a'.repeat(2048), 2048)).toBe('a'.repeat(2048));
      expect(clip('', 10)).toBe('');
    });

    it('recorta lo que pasa', () => {
      expect(clip('a'.repeat(2049), 2048)).toBe('a'.repeat(2048));
      expect(clip('abcdef', 3)).toBe('abc');
    });

    it('devuelve null cuando no hay valor', () => {
      expect(clip(null, 10)).toBeNull();
      expect(clip(undefined, 10)).toBeNull();
    });
  });

  // El email se valida con una expresión regular que, ante un texto largo que no encaja, tarda un
  // tiempo cuadrático (50.000 caracteres son unos 7 segundos de CPU). El tope va antes: el texto
  // largo se rechaza sin llegar a la expresión.
  it('rechaza un email enorme al instante, sin probar la expresión regular', () => {
    const adversario = `a@${'.'.repeat(50_000)} b`;
    const inicio = performance.now();

    const aviso = validators.email(adversario);

    expect(aviso).toBe(tooLongMessage('email'));
    expect(performance.now() - inicio).toBeLessThan(500);
  });
});
