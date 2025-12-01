import fp from 'fastify-plugin';

export default fp(async (fastify, opts) => {
  const apiKey = process.env.JULES_API_KEY;
  const isMock = !apiKey || process.env.MOCK_MODE === 'true';

  fastify.log.info(`Jules Service initializing. Mock Mode: ${isMock}`);

  const pollingState = new Map();
  const resetPolling = (sessionId) => {
      pollingState.set(sessionId, { nextPoll: Date.now(), interval: 5000 });
  };

  const jules = {
    isMock,
    async listSources() {
        if (isMock) {
            return {
                sources: [
                    { name: 'sources/github/nurdwerks/jules_interface', displayName: 'Jules Interface' },
                    { name: 'sources/github/example/repo', displayName: 'Example Repo' }
                ]
            };
        } else {
             const response = await fetch('https://jules.googleapis.com/v1alpha/sources', {
                headers: {
                    'X-Goog-Api-Key': apiKey
                }
            });
            if (!response.ok) {
                 const err = await response.json().catch(() => ({}));
                 throw new Error(err.error?.message || 'API Error');
            }
            return await response.json();
        }
    },

    async listSessions() {
        const sessions = [];
        for await (const [key, value] of fastify.db.iterator()) {
             if (key.startsWith('session:')) {
                 sessions.push(value);
             }
        }
        return sessions;
    },

    async getSession(id) {
         try {
             return await fastify.db.get(`session:${id}`);
         } catch(e) {
             return null;
         }
    },

    async createSession(payload) {
        if (isMock) {
            const timestamp = Date.now();
            const newSession = {
                name: `sessions/mock-session-${timestamp}`,
                id: `mock-session-${timestamp}`,
                prompt: payload.prompt,
                state: "QUEUED",
                createTime: new Date().toISOString()
            };
            await fastify.db.put(`session:${newSession.id}`, newSession);
            await fastify.db.put(`activities:${newSession.id}`, []);

            fastify.wsBroadcast({ type: 'sessionUpdate', session: newSession });
            return newSession;
        } else {
            const response = await fetch('https://jules.googleapis.com/v1alpha/sessions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                 const err = await response.json();
                 throw new Error(err.error?.message || 'API Error');
            }

            const data = await response.json();
            // Store
            await fastify.db.put(`session:${data.id}`, data);
            fastify.wsBroadcast({ type: 'sessionUpdate', session: data });
            resetPolling(data.id);
            return data;
        }
    },

    async getActivities(sessionId) {
        try {
            return await fastify.db.get(`activities:${sessionId}`);
        } catch(e) {
            return [];
        }
    },

    async sendMessage(sessionId, message) {
        if (isMock) {
            // Add user message to activities
            const activities = await this.getActivities(sessionId);
            const session = await this.getSession(sessionId);
            const newActivity = {
                name: `${session.name}/activities/${Date.now()}`,
                userMessaged: { userMessage: message },
                createTime: new Date().toISOString()
            };
            activities.push(newActivity);
            await fastify.db.put(`activities:${sessionId}`, activities);
            fastify.wsBroadcast({ type: 'activitiesUpdate', sessionId, activities });
            return {};
        } else {
             resetPolling(sessionId);
             const session = await this.getSession(sessionId);
             if(!session) throw new Error("Session not found");

             const url = `https://jules.googleapis.com/v1alpha/${session.name}:sendMessage`;
             const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey
                },
                body: JSON.stringify({ prompt: message })
             });
              if (!response.ok) {
                 const err = await response.json();
                 throw new Error(err.error?.message || 'API Error');
            }
            return await response.json().catch(() => ({}));
        }
    },

    async approvePlan(sessionId) {
        if (isMock) {
            const session = await this.getSession(sessionId);
            session.state = "IN_PROGRESS";
            await fastify.db.put(`session:${sessionId}`, session);
             fastify.wsBroadcast({ type: 'sessionUpdate', session: session });
            return {};
        } else {
             resetPolling(sessionId);
             const session = await this.getSession(sessionId);
             if(!session) throw new Error("Session not found");

             const url = `https://jules.googleapis.com/v1alpha/${session.name}:approvePlan`;
             const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Goog-Api-Key': apiKey
                },
                body: JSON.stringify({})
             });
              if (!response.ok) {
                 const err = await response.json();
                 throw new Error(err.error?.message || 'API Error');
            }
            return await response.json().catch(() => ({}));
        }
    },

    async refreshSession(sessionId) {
        if (isMock) {
            const session = await this.getSession(sessionId);
            // Simulate an update in mock mode if needed, for now just broadcast
            fastify.wsBroadcast({ type: 'sessionUpdate', session: session });
            return session;
        } else {
             resetPolling(sessionId);
             const session = await this.getSession(sessionId);
             if(!session) throw new Error("Session not found");

             // Fetch Session
             const respSession = await fetch(`https://jules.googleapis.com/v1alpha/${session.name}`, {
                  headers: { 'X-Goog-Api-Key': apiKey }
             });
             let newSessionData = session;
             if(respSession.ok) {
                 newSessionData = await respSession.json();
                 await fastify.db.put(`session:${newSessionData.id}`, newSessionData);
                 fastify.wsBroadcast({ type: 'sessionUpdate', session: newSessionData });
             }

             // Fetch Activities
             const respActivities = await fetch(`https://jules.googleapis.com/v1alpha/${session.name}/activities`, {
                  headers: { 'X-Goog-Api-Key': apiKey }
             });
             if(respActivities.ok) {
                 const data = await respActivities.json();
                 const newActivities = data.activities || [];
                 await fastify.db.put(`activities:${session.id}`, newActivities);
                 fastify.wsBroadcast({ type: 'activitiesUpdate', sessionId: session.id, activities: newActivities });
             }

             return newSessionData;
        }
    }
  };

  fastify.decorate('jules', jules);

  // Polling
  if (!isMock) {
      const syncSessions = async () => {
          try {
              fastify.log.info("Syncing sessions from Jules API...");
              const response = await fetch('https://jules.googleapis.com/v1alpha/sessions', {
                  headers: {
                      'X-Goog-Api-Key': apiKey
                  }
              });

              if (!response.ok) {
                  const err = await response.json().catch(() => ({}));
                  fastify.log.error(`Failed to sync sessions: ${err.error?.message || response.statusText}`);
                  return;
              }

              const data = await response.json();
              const sessions = data.sessions || [];

              for (const session of sessions) {
                  if (session.id) {
                      await fastify.db.put(`session:${session.id}`, session);
                  }
              }
              fastify.log.info(`Synced ${sessions.length} sessions from Jules API.`);

          } catch (err) {
              fastify.log.error(err, "Error syncing sessions");
          }
      };

      const runPoll = async () => {
          try {
            const now = Date.now();
            const keys = [];
            for await (const key of fastify.db.keys()) {
                if (key.startsWith('session:')) keys.push(key);
            }

            for (const key of keys) {
                const session = await fastify.db.get(key);
                const sessionId = session.id;

                let state = pollingState.get(sessionId);
                if (!state) {
                    state = { nextPoll: now, interval: 5000 };
                    pollingState.set(sessionId, state);
                }

                if (now >= state.nextPoll) {
                    let changed = false;

                    // Fetch Session
                    try {
                        const respSession = await fetch(`https://jules.googleapis.com/v1alpha/${session.name}`, {
                             headers: { 'X-Goog-Api-Key': apiKey }
                        });
                        if(respSession.ok) {
                            const newSessionData = await respSession.json();
                            if (JSON.stringify(session) !== JSON.stringify(newSessionData)) {
                                await fastify.db.put(key, newSessionData);
                                fastify.wsBroadcast({ type: 'sessionUpdate', session: newSessionData });
                                changed = true;
                            }
                        }
                    } catch(e) {
                        fastify.log.error(`Polling session ${session.id} failed: ${e.message}`);
                    }

                    // Fetch Activities
                    try {
                        const respActivities = await fetch(`https://jules.googleapis.com/v1alpha/${session.name}/activities`, {
                             headers: { 'X-Goog-Api-Key': apiKey }
                        });
                        if(respActivities.ok) {
                            const data = await respActivities.json();
                            const newActivities = data.activities || [];
                            const currentActivities = await fastify.db.get(`activities:${session.id}`).catch(() => []);

                            if (JSON.stringify(newActivities) !== JSON.stringify(currentActivities)) {
                                await fastify.db.put(`activities:${session.id}`, newActivities);
                                fastify.wsBroadcast({ type: 'activitiesUpdate', sessionId: session.id, activities: newActivities });
                                changed = true;
                            }
                        }
                    } catch(e) {
                         fastify.log.error(`Polling activities ${session.id} failed: ${e.message}`);
                    }

                    if (changed) {
                        state.interval = 5000;
                    } else {
                        state.interval = Math.min(state.interval * 1.5, 60000);
                    }
                    state.nextPoll = now + state.interval;
                    pollingState.set(sessionId, state);
                }
            }
          } catch(err) {
              fastify.log.error(err, "Polling cycle error");
          }
          setTimeout(runPoll, 1000);
      };
      fastify.ready(async () => {
          await syncSessions();
          runPoll();
      });
  }
});
