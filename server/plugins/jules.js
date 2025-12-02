import fp from 'fastify-plugin';

export default fp(async (fastify, opts) => {
  const apiKey = process.env.JULES_API_KEY;
  const isMock = !apiKey || process.env.MOCK_MODE === 'true';

  fastify.log.info(`Jules Service initializing. Mock Mode: ${isMock}`);

  const fetchAll = async (urlStr, apiKey, key) => {
      let items = [];
      let pageToken = null;
      do {
          const u = new URL(urlStr);
          if (pageToken) {
              u.searchParams.set('pageToken', pageToken);
          }
          const response = await fetch(u.toString(), {
              headers: { 'X-Goog-Api-Key': apiKey }
          });

          if (!response.ok) {
               const err = await response.json().catch(() => ({}));
               throw new Error(err.error?.message || response.statusText);
          }

          const data = await response.json();
          const batch = data[key] || [];
          items = items.concat(batch);
          pageToken = data.nextPageToken;
      } while (pageToken);

      return { [key]: items };
  };

  const updateSingleSession = async (sessionOrId) => {
      let session = sessionOrId;
      if (typeof sessionOrId === 'string') {
          // It's an ID, fetch from DB first to get name
           try {
              session = await fastify.db.get(`session:${sessionOrId}`);
           } catch (e) {
               // Not found, can't update if we don't know the name/url structure usually
               // But if we assume name = sessions/{id} or we can't do anything
               return null;
           }
      }

      if (!session) return null;

      try {
           // Fetch Session (to get latest state/activities URL)
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
           try {
               const data = await fetchAll(`https://jules.googleapis.com/v1alpha/${newSessionData.name}/activities`, apiKey, 'activities');
               const newActivities = data.activities || [];
               await fastify.db.put(`activities:${newSessionData.id}`, newActivities);
               fastify.wsBroadcast({ type: 'activitiesUpdate', sessionId: newSessionData.id, activities: newActivities });
           } catch (e) {
               fastify.log.warn(`Failed to refresh activities for ${newSessionData.id}: ${e.message}`);
           }
           return newSessionData;
      } catch (e) {
          fastify.log.error(`updateSingleSession failed for ${session.id}: ${e.message}`);
          return null;
      }
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
            return await fetchAll('https://jules.googleapis.com/v1alpha/sources', apiKey, 'sources');
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

            // Initial fetch of activities (likely empty, but good practice)
            updateSingleSession(data);
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
            // Trigger immediate update
            updateSingleSession(session);
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
            // Trigger immediate update
            updateSingleSession(session);
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
             return updateSingleSession(sessionId);
        }
    }
  };

  fastify.decorate('jules', jules);

  // Polling
  if (!isMock) {
      const syncSessions = async () => {
          try {
              fastify.log.info("Syncing sessions from Jules API...");
              const data = await fetchAll('https://jules.googleapis.com/v1alpha/sessions', apiKey, 'sessions');
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
             // 1. Fetch List of Sessions
            const data = await fetchAll('https://jules.googleapis.com/v1alpha/sessions', apiKey, 'sessions');
            const upstreamSessions = data.sessions || [];

            for (const upstreamSession of upstreamSessions) {
                if (!upstreamSession.id) continue;

                const localKey = `session:${upstreamSession.id}`;
                let localSession = null;
                try {
                    localSession = await fastify.db.get(localKey);
                } catch (e) {
                    // Not found locally
                }

                // 2. Check for differences
                // If localSession doesn't exist, it's a new session.
                const sessionChanged = !localSession || JSON.stringify(localSession) !== JSON.stringify(upstreamSession);

                if (sessionChanged) {
                    // Update Session in DB
                    await fastify.db.put(localKey, upstreamSession);
                    fastify.wsBroadcast({ type: 'sessionUpdate', session: upstreamSession });
                    fastify.log.info(`Session ${upstreamSession.id} updated/detected.`);

                    // 3. Fetch Activities for this session immediately
                    // The "announcement" (change in session list) triggers the pull for new data.
                     try {
                        const actData = await fetchAll(`https://jules.googleapis.com/v1alpha/${upstreamSession.name}/activities`, apiKey, 'activities');
                        const newActivities = actData.activities || [];
                        const curActivities = await fastify.db.get(`activities:${upstreamSession.id}`).catch(() => []);

                        if (JSON.stringify(newActivities) !== JSON.stringify(curActivities)) {
                            await fastify.db.put(`activities:${upstreamSession.id}`, newActivities);
                            fastify.wsBroadcast({ type: 'activitiesUpdate', sessionId: upstreamSession.id, activities: newActivities });
                            fastify.log.info(`Activities for session ${upstreamSession.id} updated.`);
                        }
                    } catch(e) {
                         fastify.log.error(`Polling activities ${upstreamSession.id} failed: ${e.message}`);
                    }
                }
            }
          } catch(err) {
              fastify.log.error(err, "Polling cycle error");
          }
          // Regular Interval: 5 seconds
          setTimeout(runPoll, 5000);
      };

      fastify.ready(async () => {
          await syncSessions();
          runPoll();
      });
  }
});
