import crypto from 'node:crypto';

const NONCE_CACHE = new Map();
const AUTH_SESSIONS = new Map();
const API_KEY = process.env.JULES_API_KEY || 'default-secret-key';

// Cleanup cache every minute
setInterval(() => {
    const now = Date.now();
    for (const [nonce, expiry] of NONCE_CACHE.entries()) {
        if (now > expiry) NONCE_CACHE.delete(nonce);
    }
}, 60000);

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
                    const { nonce, timestamp, signature } = data;
                    const now = Date.now();

                    if (Math.abs(now - timestamp) > 30000) {
                         socket.send(JSON.stringify({ type: 'authError', message: 'Timestamp out of range' }));
                         return;
                    }

                    if (NONCE_CACHE.has(nonce)) {
                         socket.send(JSON.stringify({ type: 'authError', message: 'Nonce reused' }));
                         return;
                    }
                    NONCE_CACHE.set(nonce, now + 120000); // 2 minutes

                    const payload = `${nonce}:${timestamp}`;
                    const hmac = crypto.createHmac('sha256', API_KEY);
                    hmac.update(payload);
                    const expectedSignature = hmac.digest('hex');

                    if (signature === expectedSignature) {
                        const sessionToken = crypto.randomUUID();
                        AUTH_SESSIONS.set(sessionToken, true);
                        socket.authenticated = true;
                        socket.send(JSON.stringify({ type: 'authSuccess', sessionToken }));
                    } else {
                         socket.send(JSON.stringify({ type: 'authError', message: 'Invalid signature' }));
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
