// El secreto tiene que existir antes de que cualquier módulo lo lea.
process.env.JWT_SECRET = 'test-secret-de-al-menos-32-caracteres-para-jwt';
process.env.NODE_ENV = 'test';

// Sin SMTP configurado, emailHelpers no intenta conectarse a ningún servidor.
delete process.env.SMTP_HOST;
delete process.env.SMTP_USER;
delete process.env.SMTP_PASS;

// Baja el costo de bcrypt: los tests hacen decenas de hashes y a 10 rondas
// tardan segundos, lo que provocaba timeouts intermitentes.
process.env.BCRYPT_ROUNDS = '4';
