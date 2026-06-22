CREATE TRIGGER reservations_customer_telegram_required_insert
BEFORE INSERT ON reservations
WHEN NEW.customer_telegram IS NULL OR length(trim(NEW.customer_telegram)) = 0
BEGIN
  SELECT RAISE(ABORT, 'Reservation contact handle is required.');
END;

CREATE TRIGGER reservations_customer_telegram_required_update
BEFORE UPDATE OF customer_telegram ON reservations
WHEN NEW.customer_telegram IS NULL OR length(trim(NEW.customer_telegram)) = 0
BEGIN
  SELECT RAISE(ABORT, 'Reservation contact handle is required.');
END;
