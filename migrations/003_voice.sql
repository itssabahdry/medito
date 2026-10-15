CREATE TABLE call_peers (
  appointment_id uuid NOT NULL REFERENCES appointments(id), user_id uuid NOT NULL REFERENCES users(id),
  client_id uuid NOT NULL, last_seen timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(appointment_id,user_id)
);
CREATE TABLE call_signals (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  appointment_id uuid NOT NULL REFERENCES appointments(id), sender_id uuid NOT NULL REFERENCES users(id),
  recipient_client uuid NOT NULL, sender_client uuid NOT NULL, payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX call_signal_inbox ON call_signals(appointment_id,recipient_client,id);
