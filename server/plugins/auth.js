import fp from 'fastify-plugin';
import crypto from 'node:crypto';

export default fp(async (fastify, opts) => {
  const AUTH_SESSIONS = new Map();

  const auth = {
      validate(username, password) {
          const validUser = process.env.JULES_AUTH_USER || 'admin';
          const validPass = process.env.JULES_AUTH_PASS || 'password';
          return username === validUser && password === validPass;
      },
      createSession() {
          const token = crypto.randomUUID();
          AUTH_SESSIONS.set(token, true);
          return token;
      },
      verify(token) {
          return AUTH_SESSIONS.has(token);
      },
      remove(token) {
          AUTH_SESSIONS.delete(token);
      }
  };

  fastify.decorate('auth', auth);

  fastify.addHook('onRequest', async (req, reply) => {
    // Only protect API routes
    if (req.url.startsWith('/sessions') || req.url.startsWith('/sources')) {
        // Skip auth for OPTIONS (CORS preflight)
        if (req.method === 'OPTIONS') return;

        const authHeader = req.headers.authorization;
        let token = null;

        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }

        if (!token || !auth.verify(token)) {
            reply.code(401).send({ error: 'Unauthorized' });
            return reply;
        }
    }
  });
});
