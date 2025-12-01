export default async function (fastify, opts) {
  fastify.get('/', async (req, reply) => {
    const sessions = await fastify.jules.listSessions();
    return { sessions };
  });

  fastify.post('/', async (req, reply) => {
    const session = await fastify.jules.createSession(req.body);
    return session;
  });

  fastify.get('/:id', async (req, reply) => {
    const { id } = req.params;
    const session = await fastify.jules.getSession(id);
    if (!session) return reply.code(404).send({ error: "Not found" });
    return session;
  });

  fastify.get('/:id/activities', async (req, reply) => {
    const { id } = req.params;
    const activities = await fastify.jules.getActivities(id);
    return { activities };
  });

  // Action routes
  fastify.post('/:id/sendMessage', async (req, reply) => {
     const { id } = req.params;
     const { prompt } = req.body;
     return await fastify.jules.sendMessage(id, prompt);
  });

  fastify.post('/:id/approvePlan', async (req, reply) => {
     const { id } = req.params;
     return await fastify.jules.approvePlan(id);
  });

  fastify.post('/:id/refresh', async (req, reply) => {
     const { id } = req.params;
     return await fastify.jules.refreshSession(id);
  });
}
