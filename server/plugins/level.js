import fp from 'fastify-plugin';
import { Level } from 'level';

export default fp(async (fastify, opts) => {
  // Use a local folder 'db' for storage
  const db = new Level('./db', { valueEncoding: 'json' });

  // Wait for the database to open
  await db.open();

  fastify.decorate('db', db);

  fastify.addHook('onClose', async (instance) => {
    await db.close();
  });
});
