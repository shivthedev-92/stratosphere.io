# Bug Fix Log

## 2026-05-09 - Delete task JSON parse error

| Issue | RCA | Fixes done |
| --- | --- | --- |
| Deleting a task worked on the backend, but web/mobile showed `Unexpected end of JSON input` / `Failed to execute 'json' on 'Response'`. | FastAPI returns `204 No Content` for `DELETE /goals/{goal_id}`. The shared web and mobile API helpers always called `.json()` for successful responses, so they tried to parse an empty response body. | Updated `frontend/src/lib/api.ts` and `mobile/src/api.ts` to return `undefined` for HTTP `204` and to safely parse only non-empty response bodies. Verified with `npm run build` in `frontend` and `npx tsc --noEmit` in `mobile`. |

## 2026-05-09 - Long profile name pushed dashboard actions off screen

| Issue | RCA | Fixes done |
| --- | --- | --- |
| A longer profile name such as `Sivarajan Kakamaniyan` pushed the notification and profile buttons outside the mobile dashboard layout, which blocked access to profile editing. | The dashboard greeting shared the header row with fixed action buttons but did not constrain the text column. Long names could claim more horizontal space than available. | Split the mobile dashboard header into a flexible text column and fixed actions column. The greeting now wraps within two lines, the email stays on one constrained line, and the notification/profile buttons remain visible. |
