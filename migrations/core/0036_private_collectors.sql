-- CONNECT-001: receiving credential stays installation-local and is omitted
-- from domain archives, as provider secrets and execution grants are.
ALTER TABLE connections ADD COLUMN collector_token_hash TEXT;
