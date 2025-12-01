import crypto from 'node:crypto';

const AUTH_SESSIONS = new Map();

export default async function (fastify, opts) {
  fastify.get('/', { websocket: true }, (connection, req) => {
    fastify.log.info('Client connected to WebSocket');

    // Compatibility handle: connection might be SocketStream or WebSocket
    const socket = connection.socket || connection;

    if (socket) {
        // Default to unauthenticated
        socket.authenticated = false;
        socket.on('message', message => {
            try {
                const data = JSON.parse(message);

                if (data.type === 'auth') {
                    const { username, password } = data;
                    const validUser = process.env.JULES_AUTH_USER || 'admin';
                    const validPass = process.env.JULES_AUTH_PASS || 'password';

                    if (username === validUser && password === validPass) {
                        const sessionToken = crypto.randomUUID();
                        AUTH_SESSIONS.set(sessionToken, true);
                        socket.authenticated = true;
                        socket.send(JSON.stringify({ type: 'authSuccess', sessionToken }));
                    } else {
                         socket.send(JSON.stringify({ type: 'authError', message: 'Invalid credentials' }));
                    }

                } else if (data.type === 'reconnect') {
                    const { token } = data;
                    if (AUTH_SESSIONS.has(token)) {
                        socket.authenticated = true;
                        socket.send(JSON.stringify({ type: 'authSuccess', sessionToken: token }));
                    } else {
                        socket.send(JSON.stringify({ type: 'authRequired' }));
                    }
                } else {
                    if (!socket.authenticated) {
                        socket.send(JSON.stringify({ type: 'authRequired' }));
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
