# Missing Features List

Based on the analysis of `features.md` and the provided codebase, the following features have been identified and their implementation status is tracked below.

## 1. List Sources
**Status: Implemented**
**Description:** The user currently has to manually type the source string (e.g., `sources/github/user/repo`). The API supports listing connected sources.
**Implementation:**
- Backend: Added `listSources` method to `jules.js` plugin and exposed `GET /sources` endpoint.
- Frontend: Fetches sources on load and provides a dropdown selection in the Create Session form.

## 2. Adaptive Polling
**Status: Implemented**
**Description:** The current backend polls all sessions every 5 seconds regardless of their state or activity. This is inefficient and can hit rate limits.
**Implementation:**
- Backend: Implemented per-session polling intervals using `pollingState` map.
- Starts at 5s for active sessions.
- Decays interval (1.5x) if no updates are received, up to a max of 60s.
- Resets interval to 5s on user interaction (create, message, approve, refresh).

## 3. Manual Refresh
**Status: Implemented**
**Description:** Users should be able to trigger an immediate update for a session.
**Implementation:**
- Backend: Added `POST /sessions/:id/refresh` endpoint that forces a fetch from the upstream API and resets polling interval.
- Frontend: Added a "Refresh" button in the Session Details view.

## 4. Source Selection UI
**Status: Implemented**
**Description:** Improve the "Create Session" UI to use the sources list.
**Implementation:** Replaced text input with a `<select>` element populated by the `GET /sources` API.

## 5. Persistent History
**Status: Existing Feature**
**Description:** Store session history in a local database.
**Implementation:** Uses LevelDB.

## 6. Secure Credential Management
**Status: Existing Feature**
**Description:** Store API keys securely.
**Implementation:** Uses environment variables (`JULES_API_KEY`).
