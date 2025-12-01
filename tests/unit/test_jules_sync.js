import Fastify from 'fastify';
import fp from 'fastify-plugin';
import julesPlugin from '../../server/plugins/jules.js';
import assert from 'assert';

// Mock DB
const mockDb = {
    store: new Map(),
    async get(key) {
        if (!this.store.has(key)) throw new Error('Not found ' + key);
        return this.store.get(key);
    },
    async put(key, value) {
        this.store.set(key, value);
    },
    async *keys() {
        for (const key of this.store.keys()) {
            yield key;
        }
    },
    async *iterator() {
        for (const entry of this.store.entries()) {
            yield entry;
        }
    }
};

const dbPlugin = fp(async (fastify) => {
    fastify.decorate('db', mockDb);
    // Mock wsBroadcast
    fastify.decorate('wsBroadcast', (msg) => {
        // console.log('wsBroadcast mocked:', msg);
    });
});

// Mock Fetch
const originalFetch = globalThis.fetch;
let fetchCalls = [];
globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    if (url === 'https://jules.googleapis.com/v1alpha/sessions') {
        return {
            ok: true,
            json: async () => ({
                sessions: [
                    { id: 'session-123', name: 'sessions/session-123', state: 'ACTIVE' }
                ]
            })
        };
    }
    if (url.includes('/activities')) {
         return {
            ok: true,
            json: async () => ({ activities: [] })
        };
    }
     if (url.includes('jules.googleapis.com')) {
         // Generic session fetch
         // Extract ID from url if needed, for now just return what matches session-123
        return {
            ok: true,
            json: async () => ({ id: 'session-123', name: 'sessions/session-123', state: 'ACTIVE' })
        };
    }
    return { ok: false, statusText: 'Not Mocked ' + url };
};

async function test() {
    // Set ENV to disable mock mode
    process.env.JULES_API_KEY = 'test-key';
    process.env.MOCK_MODE = 'false';

    const fastify = Fastify({ logger: false });
    fastify.register(dbPlugin);
    fastify.register(julesPlugin);

    try {
        console.log('Starting Fastify...');
        await fastify.ready();

        console.log('Fastify ready. Waiting for sync...');
        // Wait a bit for async sync to happen inside ready callback
        await new Promise(resolve => setTimeout(resolve, 500));

        // Verify fetch was called
        const sessionListCall = fetchCalls.find(c => c.url === 'https://jules.googleapis.com/v1alpha/sessions');
        if (!sessionListCall) {
            throw new Error('Should have called list sessions API: https://jules.googleapis.com/v1alpha/sessions');
        }

        // Verify DB has the session
        try {
            const session = await mockDb.get('session:session-123');
            assert.strictEqual(session.id, 'session-123');
            console.log('Session found in DB!');
        } catch(e) {
            throw new Error('Session not found in DB: ' + e.message);
        }

        console.log('Test Passed!');
        process.exit(0);
    } catch (err) {
        console.error('Test Failed:', err);
        process.exit(1);
    } finally {
        globalThis.fetch = originalFetch;
    }
}

test();
