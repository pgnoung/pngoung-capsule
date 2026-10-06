# Optional environment configuration

Normal learners can use the launcher without setting anything. No API key is required. This application does **not** load `.env` files, so no `.env.example` is needed. Set an environment variable for the current process only when an advanced workflow requires it.

| Variable | Default / use |
| --- | --- |
| `PNGOUNG_CAPSULE_HOME` | User home `.pngoung-capsule`; local setup and practice data |
| `PNGOUNG_CAPSULE_USER_HOME` | OS user home; base for `.agents` and `.claude` skill folders; mainly isolated tests |
| `PNGOUNG_CAPSULE_PORT` | `4386`; loopback only, tries the next ports if occupied |
| `PNGOUNG_CAPSULE_DIR` | User home `pngoung-capsule`; bootstrap installation destination must be new |
| `PNGOUNG_CAPSULE_ARCHIVE_URL` | Official repository archive; override only for an archive you trust because it contains executable installer code |
| `PNGOUNG_CAPSULE_NO_START` | Set `1` for bootstrap setup without launching the server |
| `PNGOUNG_CAPSULE_FORCE_PORTABLE_NODE` | Installer test option on macOS/Linux/Windows; use a private Node runtime even when a system Node is present |

The transfer folder and project paths are explicit CLI arguments. They are not chosen or uploaded automatically. Use absolute paths for project, task JSON, outbox and input capsule arguments; the launchers run from the app directory.
