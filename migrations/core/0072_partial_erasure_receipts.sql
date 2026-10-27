-- A partial entity receipt is terminal, while its incomplete stores stay explicit.
CREATE TRIGGER privacy_partial_retained BEFORE UPDATE ON privacy_requests WHEN OLD.state='partial' BEGIN SELECT RAISE(ABORT,'retained_partial_erasure'); END;
