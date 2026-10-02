import { describe, expect, it } from 'vitest';
import {
  EMAIL_PATTERN,
  LEAD_FIELDS,
  MESSAGE_MIN_LENGTH,
  PHONE_PATTERN,
  findInvalidFields,
  validators,
  type LeadField,
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
