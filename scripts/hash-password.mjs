#!/usr/bin/env node
/**
 * Genera el hash de la contraseña del administrador para ADMIN_PASSWORD_HASH.
 *
 *   npm run hash-password
 *
 * Pide la contraseña sin mostrarla (dos veces) e imprime SOLO el hash por la
 * salida estándar; las instrucciones van por la salida de errores. Pega ese
 * hash en Netlify: Site configuration > Environment variables.
 *
 * La contraseña no se escribe en ningún archivo, no se guarda y no se acepta
 * como argumento (quedaría en el historial del shell). También se puede enviar
 * por la entrada estándar, para usarlo desde un gestor de contraseñas:
 *
 *   pbpaste | node scripts/hash-password.mjs
 *
 * Mismo formato y mismos costos que src/lib/password.ts. Se duplican acá para
 * que el script corra con Node a secas, sin compilar TypeScript;
 * tests/scripts.hash-password.test.ts comprueba que los hashes que produce los
 * acepte `verifyPassword` del sitio.
 */
import { randomBytes, scrypt } from 'node:crypto';

const PARAMS = { N: 32768, r: 8, p: 3 };
const KEY_LENGTH = 32;
const SALT_LENGTH = 16;
const MIN_LENGTH = 12;

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

const hash = (password) =>
  new Promise((resolve, reject) => {
    const salt = randomBytes(SALT_LENGTH);
    const maxmem = 256 * PARAMS.r * (PARAMS.N + PARAMS.p + 8);

    scrypt(password, salt, KEY_LENGTH, { ...PARAMS, maxmem }, (error, key) => {
      if (error) return reject(error);

      resolve(
        ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join(':')
      );
    });
  });

/** Lee una línea del teclado sin repetir lo que se escribe. */
const promptHidden = (label) =>
  new Promise((resolve, reject) => {
    const input = process.stdin;
    let value = '';

    const finish = (callback) => {
      input.setRawMode(false);
      input.pause();
      input.off('data', onData);
      process.stderr.write('\n');
      callback();
    };

    function onData(chunk) {
      for (const char of chunk) {
        if (char === '\r' || char === '\n' || char === '\u0004') return finish(() => resolve(value));
        if (char === '\u0003') return finish(() => reject(new Error('Cancelado.')));
        if (char === '\u007f' || char === '\b') value = value.slice(0, -1);
        else value += char;
      }
    }

    process.stderr.write(label);
    input.setEncoding('utf8');
    input.setRawMode(true);
    input.resume();
    input.on('data', onData);
  });

/** Contraseña enviada por la entrada estándar: se quita solo el salto de línea final. */
const readPiped = async () => {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;

  return data.replace(/\r?\n$/, '');
};

const readPassword = async () => {
  if (!process.stdin.isTTY) return readPiped();

  const password = await promptHidden('Contraseña: ');
  const repeated = await promptHidden('Repite la contraseña: ');

  if (password !== repeated) fail('Las contraseñas no coinciden.');

  return password;
};

const password = await readPassword().catch((error) => fail(error.message));

if (password.length < MIN_LENGTH) fail(`La contraseña debe tener al menos ${MIN_LENGTH} caracteres.`);

console.log(await hash(password));

console.error(
  '\nListo. Pega esa línea como valor de ADMIN_PASSWORD_HASH en Netlify (Site configuration > Environment variables).\n' +
    'Para cambiar la contraseña, genera un hash nuevo y reemplaza el valor.'
);
