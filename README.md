# Colorado FLL GA — Multi-user Website

A self-hosted version of the existing Colorado FLL GA Tool with shared cloud-backed data, accounts, and event-specific scripts. The existing console, XLSX importer, red/blue tables, break alerts, mission gallery, script editor, and presentation mode are retained.

## Run locally

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
GA_SECURE_COOKIES=0 uvicorn server:app --reload
```

Visit http://localhost:8000. The first person to register becomes administrator. Subsequent users must be created by an administrator through **Manage accounts**. Use passwords of at least 12 characters.

## Deploy to a real website

1. Use a VPS or hosting provider that supports Docker and persistent volumes. Run `docker compose up -d --build`.
2. Put an HTTPS reverse proxy (Caddy, nginx, or managed ingress) in front of `127.0.0.1:8000`. Point your domain DNS to the server.
3. Keep `GA_SECURE_COOKIES=1` for HTTPS. Do not expose the app over plain HTTP.
4. Back up the `ga_data` volume (SQLite DB). Protect it as it contains user emails, password hashes, schedules and scripts.
5. Sign in as the first administrator and create accounts for other announcers. Editors can change shared data; viewers can read only.

**Not yet deployed:** The ZIP contains deployable code, not a live domain or hosted service.

## Shared workspace behavior

All accounts currently share **one organization-wide workspace**. Each event has its own scripts and script edits, while schedules and team directory are shared. Changes are saved to SQLite. A revision check prevents a second announcer from silently overwriting a newer save. If a conflict occurs, export a backup before reloading. This is not real-time collaborative editing; other users should select **Reload shared data** to see updates.

## Import existing browser data

In your **old** HTML version, open **Data & Integration → Export full backup**. In the new website, sign in and use **Restore backup** to load the exported JSON. Do this only once, because restore replaces the shared workspace. The first account's previous browser storage is **not** imported automatically.

## Limitations and production considerations

- XLSX reading is performed client-side using the existing offline reader.
- PDF script import still uses an external PDF.js library; PDF uploads may require internet access, and complex tables may need review.
- Script edits are per event, but this version does not provide separate organizations/tenants or event-level user permissions.
- Uploads are parsed in the browser and stored as extracted text in the workspace JSON, not as a cloud file library.
- The application has basic session security and password hashing; before broad public deployment add rate limiting, email/password recovery, monitoring, a tested backup/restore plan, and HTTPS. Consider managed authentication for larger deployments.
- This is a functional starter implementation, not a security-audited production service. Test all tournament workflows before event day.


## Dylan's Joke Corner and future editing

The last navigation tab is **Dylan's Joke Corner**. Every signed-in announcer can read the jokes. Only users with the `admin` role can add, edit, or delete jokes; the server checks this permission for every write. Joke content is stored in the same persistent SQLite database as accounts and the workspace.

There is **no hidden backdoor or hard-coded master password**. The first registered account is an administrator. Use **Manage accounts** to create additional administrator accounts; keep admin credentials secure. Administrators can also edit event data and scripts through the existing editor. Changes to application source code still require redeployment. Back up the persistent database before upgrades.
