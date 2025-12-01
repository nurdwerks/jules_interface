import fp from 'fastify-plugin';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default fp(async (fastify, opts) => {
  fastify.register(fastifyStatic, {
    root: join(__dirname, '../../client'),
    prefix: '/',
  });
});
