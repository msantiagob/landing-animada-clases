process.env.NODE_ENV = 'test';

// Sin SMTP configurado, emailHelpers no intenta conectarse a ningún servidor.
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

// El panel arranca SIN configurar, sin importar qué haya en el shell de quien corre los tests:
// ninguna credencial real (de un .env o del entorno de Netlify) se cuela en la suite. Los tests
// que necesitan un administrador lo configuran con `configureAdminEnv()` (tests/helpers.ts).
delete process.env.ADMIN_EMAIL;
delete process.env.ADMIN_PASSWORD_HASH;
delete process.env.SESSION_SECRET;
