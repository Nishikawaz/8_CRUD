'use strict';

const config = require('./config');
const createApp = require('./app');

const server = createApp().listen(config.port, config.host, () => {
  console.log(`Learn It, Love It en http://${config.host}:${config.port} [${config.env}]`);
});

/** Apagado ordenado: deja de aceptar conexiones y espera las que estan en vuelo. */
function shutdown(signal) {
  console.log(`${signal}: cerrando...`);
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = server;
