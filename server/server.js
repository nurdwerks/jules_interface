import Fastify from 'fastify';
import AutoLoad from 'fastify-autoload';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const fastify = Fastify({
  logger: true
});

// Register plugins
fastify.register(AutoLoad, {
  dir: join(__dirname, 'plugins'),
});

// Register routes
fastify.register(AutoLoad, {
  dir: join(__dirname, 'routes'),
});

const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
