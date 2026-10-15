CREATE TABLE slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), therapist_id uuid NOT NULL REFERENCES profiles(user_id),
  starts_at timestamptz NOT NULL, ends_at timestamptz NOT NULL,
  mode text NOT NULL CHECK(mode IN ('in_person','voice')),
  CHECK(ends_at>starts_at AND ends_at<=starts_at+interval '3 hours'),
  EXCLUDE USING gist (therapist_id WITH =, tstzrange(starts_at,ends_at,'[)') WITH &&)
);
CREATE INDEX slots_upcoming ON slots(therapist_id,starts_at);
CREATE TABLE appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), slot_id uuid NOT NULL REFERENCES slots(id),
  patient_id uuid NOT NULL REFERENCES users(id), fee integer NOT NULL CHECK(fee>=0),
  status text NOT NULL DEFAULT 'booked' CHECK(status IN ('booked','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX one_booking_per_slot ON appointments(slot_id) WHERE status!='cancelled';
CREATE INDEX patient_appointments ON appointments(patient_id,created_at);
CREATE TABLE reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id),
  rating integer NOT NULL CHECK(rating BETWEEN 1 AND 5), comment varchar(1500) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
