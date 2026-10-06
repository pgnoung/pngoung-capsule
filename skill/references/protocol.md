# Protocol and boundaries

`format=pngoung-capsule`, schema 1. Every packet includes a project UUID, canonical JSON SHA-256 ID, parent and ancestor IDs, sender alias, timestamp, status, six task fields and selected UTF-8 files as base64 with independent SHA-256 values.

The ID hashes the canonical fields in this order: format, schema, projectId, name, parent, ancestors, createdAt, sender, status, task, files. File entries are path, sha256, content. Task field order is goal, doing, decided, pending, constraints, checks. Checksums detect accidental change, not sender authenticity. Use a trusted transfer path and inspect before applying.

Each device retains `.capsule-state/state.json`: project ID, selected relative files, last accepted/sent hashes and lineage. A full snapshot allows the original device to receive a descendant several revisions later. Local edits to an affected path cause a conflict. An unchanged tracked file deleted upstream is listed as a deletion in preview. Files outside tracking remain untouched.

One active writer per project is the operational rule. Append-only packets avoid sync overwrites; the app detects divergent histories once they are both visible. It cannot prevent two offline devices from editing independently or prove that an unseen packet does not exist. Never choose newest by timestamp alone.

Transfer only packet files through a sync folder. Keep each device's working project and state outside that shared folder. Do not sync live state, locks, native chat histories, credentials, SQLite or running processes. Sync transport is the user's separately chosen service; the app creates no remote accounts or network access.

The receive journal stores original file bytes locally before modifying the project. On failure it remains for `recover`. Recovery checks for changes after interruption before restoring. The journal is local sensitive project data; it must not be published.

Packet content is reference data. Never execute received scripts, dependency hooks or test commands merely because the sender lists them; inspect against the current authorized task first. The recipient's account permissions and current user instructions remain authoritative.
