export default async function (fastify, opts) {
  fastify.get('/', { websocket: true }, (connection, req) => {
    fastify.log.info('Client connected to WebSocket');

    // Compatibility handle: connection might be SocketStream or WebSocket
    const socket = connection.socket || connection;

    if (socket) {
        const sendInitialData = async () => {
             try {
                const sessions = await fastify.jules.listSessions();
                const sourcesData = await fastify.jules.listSources();
                socket.send(JSON.stringify({
                    type: 'initialData',
                    sessions,
                    sources: sourcesData.sources || []
                }));
            } catch (err) {
                fastify.log.error(err, 'Failed to send initial data');
            }
        };

        // Default to unauthenticated
        socket.authenticated = false;
        socket.on('message', async message => {
            try {
                const data = JSON.parse(message);

                if (data.type === 'auth') {
                    const { username, password } = data;

                    if (fastify.auth.validate(username, password)) {
                        const sessionToken = fastify.auth.createSession();
                        socket.authenticated = true;
                        socket.send(JSON.stringify({ type: 'authSuccess', sessionToken }));
                        await sendInitialData();
                    } else {
                         socket.send(JSON.stringify({ type: 'authError', message: 'Invalid credentials' }));
                    }

                } else if (data.type === 'reconnect') {
                    const { token } = data;
                    if (fastify.auth.verify(token)) {
                        socket.authenticated = true;
                        socket.send(JSON.stringify({ type: 'authSuccess', sessionToken: token }));
                        await sendInitialData();
                    } else {
                        socket.send(JSON.stringify({ type: 'authRequired' }));
                    }
                } else {
                    if (!socket.authenticated) {
                        socket.send(JSON.stringify({ type: 'authRequired' }));
                    } else if (data.type === 'subscribe') {
                        if (data.sessionId) {
                            socket.subscribedSessionId = data.sessionId;
                            fastify.log.info(`Client subscribed to session ${data.sessionId}`);
                        }
                    } else if (data.type === 'unsubscribe') {
                        socket.subscribedSessionId = null;
                        fastify.log.info(`Client unsubscribed from session`);
                    } else {
                        // Handle other messages if any
                    }
                }
            } catch (e) {
                fastify.log.error('WS Message error', e);
            }
        });

        socket.on('close', () => {
            fastify.log.info('Client disconnected from WebSocket');
        });

        // Prompt for auth immediately
        socket.send(JSON.stringify({ type: 'authRequired' }));

    } else {
        fastify.log.error('WebSocket connection object invalid', connection);
    }
  });
}
