CREATE TABLE IF NOT EXISTS collection_control (
 id integer PRIMARY KEY CHECK(id=1), paused boolean NOT NULL DEFAULT true,
 chain_enabled boolean NOT NULL DEFAULT false, rpc_blocked_until timestamptz,
 changed_by text, updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO collection_control(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS rpc_usage (
 day text NOT NULL, method text NOT NULL, attempts integer NOT NULL DEFAULT 0,
 PRIMARY KEY(day,method)
);
