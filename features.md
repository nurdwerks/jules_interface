# Features and Improvement Proposals

## Current Features
- **Session Management**: List and create coding sessions via a GUI.
- **Activity Feed**: View the history of interactions (messages, plans, errors) for a specific session.
- **Interaction**: Send messages to the agent and approve generated plans.
- **Mock Mode**: Simulate API responses for testing without a live backend.
- **Direct API Access**: Connects directly to `https://jules.googleapis.com` using a provided API Key.

## Proposed Methods for Status Tracking
To keep track of running sessions and receive updates efficiently while respecting rate limits:

### 1. Polling with Exponential Backoff
Instead of constant polling, implement an adaptive polling mechanism.
- **Start**: Poll every 5 seconds when a session is active.
- **Decay**: If no updates are found, increase the interval (e.g., 5s -> 10s -> 20s -> max 60s).
- **Reset**: Reset interval to 5s when the user performs an action (e.g., sends a message) or when a new activity is detected.
- **Benefit**: Reduces API calls significantly when the session is idle, preventing rate limit exhaustion while keeping the UI relatively fresh.

### 2. Manual Refresh Controls
- Add a dedicated "Refresh" button to the session details view.
- Prevents automatic background calls entirely if the user prefers strict control over API usage.
- **Benefit**: Zero wasted API calls; user feels in control.

### 3. Conditional Polling (Focus-based)
- Only poll when the window/tab is in focus.
- Stop polling when the user switches tabs to save quota.

## Backend Server Improvements
If a dedicated backend server were implemented to mediate between the frontend and the Jules API:

### 1. Secure Credential Management
- **Current Issue**: API Key is stored in the browser/localStorage (insecure for production).
- **Improvement**: Store API keys as environment variables on the backend. The frontend calls the backend, which proxies requests to Google.

### 2. Webhooks / Push Notifications
- If the Jules API supports webhooks (or if we can build a poller service), the backend could receive real-time events.
- The backend can then push updates to the frontend via **WebSockets** or **Server-Sent Events (SSE)**.
- **Benefit**: Eliminates the need for frontend polling entirely, ensuring real-time updates with minimal latency and API overhead.

### 3. Response Caching
- Cache `GET /sessions` and `GET /activities` responses in a fast store (like Redis) with a short TTL.
- Serve repeated requests from cache to reduce latency and downstream API costs.

### 4. Persistent History
- Store session history in a local database (PostgreSQL/MongoDB).
- Allows reviewing past sessions even if the upstream API archives or deletes them.
- Enables advanced filtering and search capabilities not supported by the raw API.
