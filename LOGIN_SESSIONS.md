# Login sessions

Login sessions expire after 30 minutes without user interaction and at most 8 hours after sign-in. The browser displays a warning during the last two minutes. "Stay signed in" renews inactivity only; it cannot extend the 8-hour limit.

The server stores sessions in the MongoDB `loginsessions` collection. Each JWT identifies one session. Authentication checks the stored idle and absolute deadlines on every protected request; MongoDB TTL cleanup is only housekeeping. Logout deletes the current session. Other logins remain independent.

- `GET /api/auth/session` returns server-relative deadline information without renewal.
- `POST /api/auth/session/activity` renews a still-active session.
- Only trusted pointer, keyboard, touch, or wheel interactions trigger activity requests, throttled to once per minute. Periodic API calls and quiz autosaves do not renew sessions.
- Expiry redirects to sign-in. Quiz answers saved on the server remain available. A per-user, per-quiz snapshot in the same tab preserves newer unsaved answers for the same quiz attempt.
- Session errors caused by database outages return 503, without discarding the browser login.
- Browser tabs sharing a token share its idle deadline and observe logout through storage events.

## Deployment

Deploy frontend and backend together. Existing JWTs do not have a session identifier, so everyone must sign in again once after deployment. No new environment variables are required. MongoDB must permit creating and writing the login-session collection, as it does for the existing application collections.

## Validation

Run `node --test tests/login-session.test.js`. Tests use mocked database operations and a simulated browser; they do not contact production.

After deployment, verify login, logout across two tabs, the inactivity warning, and returning to an unfinished quiz after reauthentication.
