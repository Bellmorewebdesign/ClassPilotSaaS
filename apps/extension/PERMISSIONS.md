# Why ClassPilot asks for each permission

ClassPilot requests the minimum set that makes a Classroom sync possible.
It never asks for your Google password, and it never uses the Google
Classroom API or OAuth — it reads only pages you are already signed in to
and already allowed to see.

| Permission | Why it is needed |
|---|---|
| `storage` | Stores your ClassPilot API URL and API token in `chrome.storage.local`, and the last sync summary shown in the popup. This is profile-local and is **not** synced to your Google account. |
| `tabs` | Opens and navigates the single inactive helper tab the sync uses, and checks whether your current tab is on Classroom so the popup can say "Classroom detected". |
| `https://classroom.google.com/*` (host) | Lets the content script read the Classroom pages you are already viewing. This is the only site ClassPilot reads. |
| `http://*/*`, `https://*/*` (**optional**) | Requested *only* when you save a custom API URL, so the extension can POST your synced data to your own ClassPilot API. Not granted at install time. Declining still works in the normal case, because the API allows `chrome-extension://` origins via CORS. |

## Deliberately NOT requested

- **Google Drive / Docs / Sheets / Slides.** V1 records an attachment's name,
  link and type. It never opens the file. Deep attachment reading is a later
  milestone and will ask separately.
- **`<all_urls>` at install time.** Broad host access is optional and
  requested lazily for your API origin only.
- **`identity` / OAuth scopes.** ClassPilot does not authenticate to Google at
  all. It relies entirely on the session already in your browser.
- **`cookies`.** ClassPilot never reads your Google cookies. The helper tab
  carries your existing session the same way a normal tab would.
- **`webRequest`.** No network interception.

## What leaves your browser

Only the normalized Classroom data you see in the ClassPilot dashboard —
class names, assignment titles, instructions, due dates, points, status,
grades, and attachment names/links/types — sent to the API URL **you**
configure, with the token **you** paste in.

Diagnostic reports (Settings → Capture diagnostics) contain page *structure*
only: tag names, ARIA roles, counts and text lengths. Never your schoolwork.
