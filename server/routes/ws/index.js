export default async function (fastify, opts) {
  fastify.get('/', { websocket: true }, (connection, req) => {
    fastify.log.info('Client connected to WebSocket');

    if (connection && connection.socket) {
        connection.socket.on('message', message => {
            // Handle incoming messages if needed
        });

        connection.socket.on('close', () => {
            fastify.log.info('Client disconnected from WebSocket');
        });
    } else {
        fastify.log.error('WebSocket connection object invalid', connection);
    }
  });
}
