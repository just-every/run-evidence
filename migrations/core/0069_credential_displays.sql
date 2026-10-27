-- Installation-local, short-lived secret handoff. Never included in custody exports.
CREATE TABLE credential_displays (
 id TEXT PRIMARY KEY,
 session_id TEXT NOT NULL,
 operator_id TEXT NOT NULL,
 destination TEXT NOT NULL,
 ciphertext TEXT NOT NULL,
 iv TEXT NOT NULL,
 expires_at TEXT NOT NULL
);
CREATE INDEX credential_displays_expiry ON credential_displays(expires_at);
