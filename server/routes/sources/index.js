export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    const sources = await fastify.jules.listSources();
    return sources;
  });
}
