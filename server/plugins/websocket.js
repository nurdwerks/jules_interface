import fp from 'fastify-plugin';
import websocket from '@fastify/websocket';

export default fp(async (fastify, opts) => {
  await fastify.register(websocket);

  // Create a broadcast function to send data to all connected clients
  fastify.decorate('wsBroadcast', (message) => {
      fastify.websocketServer.clients.forEach((client) => {
          if (client.readyState === 1 && client.authenticated) { // OPEN and Authenticated
              client.send(JSON.stringify(message));
          }
      });
  });
});
