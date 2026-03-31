-- =============================================================
-- NduthiRide — Triggers & Functions
-- Run this AFTER neon_setup.sql in the Neon SQL Editor.
-- =============================================================


-- ─────────────────────────────────────────────────────────────
-- 1. AUTO-UPDATE updated_at
--    Applied to every table that has an updated_at column.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_riders_updated_at
  BEFORE UPDATE ON riders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_rides_updated_at
  BEFORE UPDATE ON rides
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_parcels_updated_at
  BEFORE UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_payments_updated_at
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_support_tickets_updated_at
  BEFORE UPDATE ON support_tickets
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();


-- ─────────────────────────────────────────────────────────────
-- 2. AUTO-SET completed_at / delivered_at
--    Set the timestamp the moment a ride/parcel reaches its
--    terminal status so application code doesn't have to.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_ride_completed_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' THEN
    NEW.completed_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ride_completed_at
  BEFORE UPDATE ON rides
  FOR EACH ROW EXECUTE FUNCTION set_ride_completed_at();

CREATE OR REPLACE FUNCTION set_parcel_delivered_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'DELIVERED' AND OLD.status <> 'DELIVERED' THEN
    NEW.delivered_at = now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parcel_delivered_at
  BEFORE UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION set_parcel_delivered_at();


-- ─────────────────────────────────────────────────────────────
-- 3. RIDER STATS — auto-update on ride/parcel completion
--    Commission rate is read from the settings table
--    (key = 'commission_rate', value = '0.20' by default).
--    Updates: commission_amount, rider_earnings on the trip,
--             total_rides + total_earnings on the rider row.
-- ─────────────────────────────────────────────────────────────

-- Seed the default commission rate so the function always finds it.
INSERT INTO settings ("id", "key", "value", "updatedAt")
VALUES (gen_random_uuid(), 'commission_rate', '0.20', now())
ON CONFLICT ("key") DO NOTHING;

CREATE OR REPLACE FUNCTION update_rider_stats_on_ride()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_commission_rate FLOAT;
  v_fare            FLOAT;
  v_commission      FLOAT;
  v_earnings        FLOAT;
BEGIN
  -- Only act when transitioning INTO COMPLETED
  IF NEW.status = 'COMPLETED' AND OLD.status <> 'COMPLETED' AND NEW.rider_id IS NOT NULL THEN

    -- Read commission rate from settings (fall back to 20 %)
    SELECT COALESCE(value::FLOAT, 0.20)
      INTO v_commission_rate
      FROM settings WHERE key = 'commission_rate';

    v_fare       := COALESCE(NEW.final_fare, NEW.estimated_fare);
    v_commission := ROUND((v_fare * v_commission_rate)::NUMERIC, 2);
    v_earnings   := ROUND((v_fare - v_commission)::NUMERIC, 2);

    -- Write breakdown back onto the ride row
    NEW.commission_amount := v_commission;
    NEW.rider_earnings    := v_earnings;

    -- Increment rider aggregate stats
    UPDATE riders
       SET total_rides    = total_rides + 1,
           total_earnings = total_earnings + v_earnings
     WHERE id = NEW.rider_id;

  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ride_complete_stats
  BEFORE UPDATE ON rides
  FOR EACH ROW EXECUTE FUNCTION update_rider_stats_on_ride();

CREATE OR REPLACE FUNCTION update_rider_stats_on_parcel()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_commission_rate FLOAT;
  v_fee             FLOAT;
  v_commission      FLOAT;
  v_earnings        FLOAT;
BEGIN
  IF NEW.status = 'DELIVERED' AND OLD.status <> 'DELIVERED' AND NEW.rider_id IS NOT NULL THEN

    SELECT COALESCE(value::FLOAT, 0.20)
      INTO v_commission_rate
      FROM settings WHERE key = 'commission_rate';

    v_fee        := NEW.delivery_fee;
    v_commission := ROUND((v_fee * v_commission_rate)::NUMERIC, 2);
    v_earnings   := ROUND((v_fee - v_commission)::NUMERIC, 2);

    NEW.commission_amount := v_commission;
    NEW.rider_earnings    := v_earnings;

    UPDATE riders
       SET total_rides    = total_rides + 1,
           total_earnings = total_earnings + v_earnings
     WHERE id = NEW.rider_id;

  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parcel_complete_stats
  BEFORE UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION update_rider_stats_on_parcel();


-- ─────────────────────────────────────────────────────────────
-- 4. RIDER RATING — recalculate average after every rating
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION recalculate_rider_rating()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_rider_id TEXT;
BEGIN
  v_rider_id := COALESCE(NEW.rider_id, OLD.rider_id);

  UPDATE riders
     SET rating_average = (
           SELECT ROUND(AVG(score)::NUMERIC, 2)
             FROM ratings
            WHERE rider_id = v_rider_id
         )
   WHERE id = v_rider_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rating_insert
  AFTER INSERT ON ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_rider_rating();

CREATE TRIGGER trg_rating_update
  AFTER UPDATE ON ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_rider_rating();

CREATE TRIGGER trg_rating_delete
  AFTER DELETE ON ratings
  FOR EACH ROW EXECUTE FUNCTION recalculate_rider_rating();


-- ─────────────────────────────────────────────────────────────
-- 5. CONVERSATION LIFECYCLE
--    Auto-create a conversation when a rider accepts a trip.
--    Auto-close it when the trip ends (completed or cancelled).
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION manage_ride_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Open conversation when rider accepts
  IF NEW.status = 'ACCEPTED' AND OLD.status <> 'ACCEPTED' THEN
    INSERT INTO conversations ("id", "ride_id", "status", "created_at")
    VALUES (gen_random_uuid(), NEW.id, 'ACTIVE', now())
    ON CONFLICT ("ride_id") DO NOTHING;
  END IF;

  -- Close conversation when ride ends
  IF NEW.status IN ('COMPLETED', 'CANCELLED') AND OLD.status NOT IN ('COMPLETED', 'CANCELLED') THEN
    UPDATE conversations
       SET status    = 'CLOSED',
           closed_at = now()
     WHERE ride_id = NEW.id
       AND status  = 'ACTIVE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_ride_conversation
  AFTER UPDATE ON rides
  FOR EACH ROW EXECUTE FUNCTION manage_ride_conversation();

CREATE OR REPLACE FUNCTION manage_parcel_conversation()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'ACCEPTED' AND OLD.status <> 'ACCEPTED' THEN
    INSERT INTO conversations ("id", "parcel_id", "status", "created_at")
    VALUES (gen_random_uuid(), NEW.id, 'ACTIVE', now())
    ON CONFLICT ("parcel_id") DO NOTHING;
  END IF;

  IF NEW.status IN ('DELIVERED', 'CANCELLED') AND OLD.status NOT IN ('DELIVERED', 'CANCELLED') THEN
    UPDATE conversations
       SET status    = 'CLOSED',
           closed_at = now()
     WHERE parcel_id = NEW.id
       AND status    = 'ACTIVE';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_parcel_conversation
  AFTER UPDATE ON parcels
  FOR EACH ROW EXECUTE FUNCTION manage_parcel_conversation();


-- ─────────────────────────────────────────────────────────────
-- 6. PAYMENT STATUS SYNC
--    When an M-Pesa receipt is recorded on a payment, flip it
--    to COMPLETED automatically.
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_payment_on_receipt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.mpesa_receipt_number IS NOT NULL
     AND OLD.mpesa_receipt_number IS NULL
     AND NEW.status <> 'COMPLETED'
  THEN
    NEW.status       := 'COMPLETED';
    NEW.completed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_payment_receipt
  BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION sync_payment_on_receipt();


-- ─────────────────────────────────────────────────────────────
-- 7. HELPER FUNCTIONS
-- ─────────────────────────────────────────────────────────────

-- 7a. Haversine distance (km) between two lat/lng points
CREATE OR REPLACE FUNCTION haversine_km(
  lat1 FLOAT, lng1 FLOAT,
  lat2 FLOAT, lng2 FLOAT
)
RETURNS FLOAT LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  r      FLOAT := 6371;
  dlat   FLOAT := radians(lat2 - lat1);
  dlng   FLOAT := radians(lng2 - lng1);
  a      FLOAT;
BEGIN
  a := sin(dlat/2)^2
     + cos(radians(lat1)) * cos(radians(lat2)) * sin(dlng/2)^2;
  RETURN r * 2 * asin(sqrt(a));
END;
$$;

-- 7b. Find available riders within radius_km of a point,
--     ordered by proximity.
--     Usage: SELECT * FROM get_nearby_riders(-1.286389, 36.817223, 5);
CREATE OR REPLACE FUNCTION get_nearby_riders(
  user_lat   FLOAT,
  user_lng   FLOAT,
  radius_km  FLOAT DEFAULT 5
)
RETURNS TABLE (
  rider_id       TEXT,
  account_id     TEXT,
  full_name      TEXT,
  phone          TEXT,
  avatar_url     TEXT,
  bike_model     TEXT,
  rating_average FLOAT,
  total_rides    INT,
  current_lat    FLOAT,
  current_lng    FLOAT,
  distance_km    FLOAT
) LANGUAGE sql STABLE AS $$
  SELECT
    r.id,
    a.id,
    a.full_name,
    a.phone,
    a.avatar_url,
    r.bike_model,
    r.rating_average,
    r.total_rides,
    r.current_lat,
    r.current_lng,
    ROUND(haversine_km(user_lat, user_lng, r.current_lat, r.current_lng)::NUMERIC, 2)
  FROM riders r
  JOIN accounts a ON a.id = r.account_id
  WHERE r.is_available = true
    AND r.is_verified  = true
    AND a.is_active    = true
    AND r.current_lat  IS NOT NULL
    AND r.current_lng  IS NOT NULL
    AND haversine_km(user_lat, user_lng, r.current_lat, r.current_lng) <= radius_km
  ORDER BY distance_km ASC;
$$;

-- 7c. Rider earnings summary for a date range.
--     Usage: SELECT * FROM rider_earnings_summary('rider_id_here', '2026-01-01', '2026-03-31');
CREATE OR REPLACE FUNCTION rider_earnings_summary(
  p_rider_id TEXT,
  p_from     TIMESTAMPTZ DEFAULT date_trunc('month', now()),
  p_to       TIMESTAMPTZ DEFAULT now()
)
RETURNS TABLE (
  period_start    TIMESTAMPTZ,
  period_end      TIMESTAMPTZ,
  completed_rides BIGINT,
  gross_earnings  NUMERIC,
  commission_paid NUMERIC,
  net_earnings    NUMERIC
) LANGUAGE sql STABLE AS $$
  SELECT
    p_from,
    p_to,
    COUNT(*)                                     AS completed_rides,
    ROUND(SUM(COALESCE(final_fare, estimated_fare))::NUMERIC, 2) AS gross_earnings,
    ROUND(SUM(COALESCE(commission_amount, 0))::NUMERIC, 2)       AS commission_paid,
    ROUND(SUM(COALESCE(rider_earnings, 0))::NUMERIC, 2)          AS net_earnings
  FROM rides
  WHERE rider_id   = p_rider_id
    AND status     = 'COMPLETED'
    AND completed_at BETWEEN p_from AND p_to

  UNION ALL

  SELECT
    p_from,
    p_to,
    COUNT(*),
    ROUND(SUM(delivery_fee)::NUMERIC, 2),
    ROUND(SUM(COALESCE(commission_amount, 0))::NUMERIC, 2),
    ROUND(SUM(COALESCE(rider_earnings, 0))::NUMERIC, 2)
  FROM parcels
  WHERE rider_id   = p_rider_id
    AND status     = 'DELIVERED'
    AND delivered_at BETWEEN p_from AND p_to;
$$;

-- 7d. User ride history with payment status in one query.
--     Usage: SELECT * FROM user_trip_history('account_id_here');
CREATE OR REPLACE FUNCTION user_trip_history(
  p_account_id TEXT,
  p_limit      INT DEFAULT 20,
  p_offset     INT DEFAULT 0
)
RETURNS TABLE (
  trip_id        TEXT,
  trip_type      TEXT,
  status         TEXT,
  pickup_address TEXT,
  dropoff_address TEXT,
  fare           FLOAT,
  payment_status TEXT,
  rider_name     TEXT,
  created_at     TIMESTAMPTZ
) LANGUAGE sql STABLE AS $$
  SELECT
    ri.id,
    'RIDE'::TEXT,
    ri.status::TEXT,
    ri.pickup_address,
    ri.dropoff_address,
    COALESCE(ri.final_fare, ri.estimated_fare),
    p.status::TEXT,
    a.full_name,
    ri.created_at
  FROM rides ri
  LEFT JOIN payments p  ON p.ride_id   = ri.id
  LEFT JOIN riders  rd  ON rd.id       = ri.rider_id
  LEFT JOIN accounts a  ON a.id        = rd.account_id
  WHERE ri.user_id = p_account_id

  UNION ALL

  SELECT
    pa.id,
    'PARCEL'::TEXT,
    pa.status::TEXT,
    pa.pickup_address,
    pa.dropoff_address,
    pa.delivery_fee,
    pm.status::TEXT,
    a.full_name,
    pa.created_at
  FROM parcels pa
  LEFT JOIN payments pm ON pm.parcel_id = pa.id
  LEFT JOIN riders  rd  ON rd.id        = pa.rider_id
  LEFT JOIN accounts a  ON a.id         = rd.account_id
  WHERE pa.user_id = p_account_id

  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
