-- ============================================================================
-- EV CHARGING STATION SLOT BOOKING SYSTEM - RELATIONAL DATABASE SCHEMA
-- DBMS Project Specification: DDL, Keys, Constraints, Views, Triggers, Indexes
-- ============================================================================

-- 1. USERS RELATION
-- Entity: Users of the platform (Drivers, Station Operators, Admins)
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    role TEXT CHECK(role IN ('driver', 'operator', 'admin')) DEFAULT 'driver',
    wallet_balance REAL DEFAULT 1000.00 CHECK(wallet_balance >= 0),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. VEHICLES RELATION
-- Entity: Electric Vehicles registered by drivers (1-to-Many: User -> Vehicles)
CREATE TABLE IF NOT EXISTS vehicles (
    vehicle_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    license_plate TEXT UNIQUE NOT NULL,
    make_model TEXT NOT NULL,
    battery_capacity_kwh REAL NOT NULL CHECK(battery_capacity_kwh > 0),
    connector_type TEXT NOT NULL CHECK(connector_type IN ('CCS2', 'Type 2 AC', 'CHAdeMO', 'GB/T')),
    current_charge_pct INTEGER DEFAULT 25 CHECK(current_charge_pct BETWEEN 0 AND 100),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 3. STATIONS RELATION
-- Entity: Physical EV Charging Station locations
CREATE TABLE IF NOT EXISTS stations (
    station_id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    landmark TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    operator_name TEXT NOT NULL,
    rating REAL DEFAULT 4.8 CHECK(rating BETWEEN 1.0 AND 5.0),
    amenities TEXT DEFAULT 'Cafe, WiFi, Restroom, Lounge',
    status TEXT CHECK(status IN ('Active', 'Maintenance', 'Offline')) DEFAULT 'Active',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 4. CHARGERS RELATION
-- Entity: Individual charging hardware pillars installed at a station
CREATE TABLE IF NOT EXISTS chargers (
    charger_id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    charger_name TEXT NOT NULL,
    charger_type TEXT NOT NULL CHECK(charger_type IN ('DC Ultra-Fast', 'DC Fast', 'Level 2 AC')),
    power_output_kw REAL NOT NULL CHECK(power_output_kw > 0),
    connector_type TEXT NOT NULL CHECK(connector_type IN ('CCS2', 'Type 2 AC', 'CHAdeMO', 'GB/T')),
    rate_per_kwh REAL NOT NULL CHECK(rate_per_kwh > 0),
    status TEXT CHECK(status IN ('Operational', 'Maintenance', 'Faulty')) DEFAULT 'Operational',
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE
);

-- 5. SLOTS RELATION
-- Entity: Dedicated parking bay & time-reservable charging slots for a charger
CREATE TABLE IF NOT EXISTS slots (
    slot_id INTEGER PRIMARY KEY AUTOINCREMENT,
    charger_id INTEGER NOT NULL,
    slot_number TEXT NOT NULL,
    status TEXT CHECK(status IN ('Available', 'Booked', 'Occupied', 'Maintenance')) DEFAULT 'Available',
    FOREIGN KEY (charger_id) REFERENCES chargers(charger_id) ON DELETE CASCADE,
    UNIQUE(charger_id, slot_number)
);

-- 6. BOOKINGS RELATION
-- Entity: Slot reservations made by users
CREATE TABLE IF NOT EXISTS bookings (
    booking_id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    slot_id INTEGER NOT NULL,
    vehicle_id INTEGER NOT NULL,
    start_time DATETIME NOT NULL,
    end_time DATETIME NOT NULL,
    energy_needed_kwh REAL NOT NULL CHECK(energy_needed_kwh > 0),
    total_estimated_amount REAL NOT NULL CHECK(total_estimated_amount >= 0),
    status TEXT CHECK(status IN ('Confirmed', 'In-Progress', 'Completed', 'Cancelled')) DEFAULT 'Confirmed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE RESTRICT,
    FOREIGN KEY (slot_id) REFERENCES slots(slot_id) ON DELETE RESTRICT,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(vehicle_id) ON DELETE RESTRICT
);

-- 7. PAYMENTS RELATION
-- Entity: Financial transactions linked to bookings
CREATE TABLE IF NOT EXISTS payments (
    payment_id INTEGER PRIMARY KEY AUTOINCREMENT,
    booking_id INTEGER UNIQUE NOT NULL,
    amount REAL NOT NULL CHECK(amount >= 0),
    payment_method TEXT CHECK(payment_method IN ('Wallet', 'UPI', 'Credit Card', 'Net Banking')) DEFAULT 'Wallet',
    payment_status TEXT CHECK(payment_status IN ('Completed', 'Pending', 'Failed', 'Refunded')) DEFAULT 'Completed',
    transaction_time DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (booking_id) REFERENCES bookings(booking_id) ON DELETE CASCADE
);

-- 8. REVIEWS RELATION
-- Entity: User feedback and ratings for charging stations
CREATE TABLE IF NOT EXISTS reviews (
    review_id INTEGER PRIMARY KEY AUTOINCREMENT,
    station_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    rating INTEGER CHECK(rating BETWEEN 1 AND 5) NOT NULL,
    comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (station_id) REFERENCES stations(station_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

-- 9. AUDIT_LOGS RELATION
-- Entity: Automatic tracking of critical database actions via Triggers
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id INTEGER PRIMARY KEY AUTOINCREMENT,
    action_type TEXT NOT NULL,
    entity_name TEXT NOT NULL,
    entity_id INTEGER,
    details TEXT,
    performed_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- INDEXES FOR QUERY OPTIMIZATION
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_stations_city ON stations(city);
CREATE INDEX IF NOT EXISTS idx_chargers_station ON chargers(station_id);
CREATE INDEX IF NOT EXISTS idx_slots_charger ON slots(charger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_slot ON bookings(slot_id);
CREATE INDEX IF NOT EXISTS idx_bookings_time ON bookings(start_time, end_time);

-- ============================================================================
-- DATABASE TRIGGERS
-- ============================================================================

-- Trigger 1: Log new booking creation into audit_logs automatically
CREATE TRIGGER IF NOT EXISTS trg_audit_booking_insert
AFTER INSERT ON bookings
BEGIN
    INSERT INTO audit_logs (action_type, entity_name, entity_id, details)
    VALUES (
        'INSERT',
        'bookings',
        NEW.booking_id,
        'Booking created for User ID ' || NEW.user_id || ' at Slot ' || NEW.slot_id || ' for ' || NEW.energy_needed_kwh || ' kWh'
    );
END;

-- Trigger 2: Mark slot as 'Booked' when a booking is confirmed
CREATE TRIGGER IF NOT EXISTS trg_slot_booked
AFTER INSERT ON bookings
WHEN NEW.status = 'Confirmed'
BEGIN
    UPDATE slots SET status = 'Booked' WHERE slot_id = NEW.slot_id;
END;

-- Trigger 3: Free slot back to 'Available' when booking is Cancelled or Completed
CREATE TRIGGER IF NOT EXISTS trg_slot_freed
AFTER UPDATE OF status ON bookings
WHEN NEW.status IN ('Completed', 'Cancelled')
BEGIN
    UPDATE slots SET status = 'Available' WHERE slot_id = NEW.slot_id;
    INSERT INTO audit_logs (action_type, entity_name, entity_id, details)
    VALUES (
        'UPDATE',
        'bookings',
        NEW.booking_id,
        'Booking status changed to ' || NEW.status || '. Slot ' || NEW.slot_id || ' freed.'
    );
END;

-- Trigger 4: Deduct wallet balance upon booking confirmation
CREATE TRIGGER IF NOT EXISTS trg_deduct_wallet
AFTER INSERT ON bookings
WHEN NEW.status = 'Confirmed'
BEGIN
    UPDATE users 
    SET wallet_balance = wallet_balance - NEW.total_estimated_amount 
    WHERE user_id = NEW.user_id;
END;

-- Trigger 5: Refund wallet balance if booking is cancelled
CREATE TRIGGER IF NOT EXISTS trg_refund_wallet
AFTER UPDATE OF status ON bookings
WHEN OLD.status = 'Confirmed' AND NEW.status = 'Cancelled'
BEGIN
    UPDATE users 
    SET wallet_balance = wallet_balance + OLD.total_estimated_amount 
    WHERE user_id = OLD.user_id;

    UPDATE payments 
    SET payment_status = 'Refunded' 
    WHERE booking_id = NEW.booking_id;
END;

-- ============================================================================
-- RELATIONAL VIEWS (Virtual Tables)
-- ============================================================================

-- View 1: Station Overview with aggregated charger & slot metrics
CREATE VIEW IF NOT EXISTS vw_station_overview AS
SELECT 
    s.station_id,
    s.name AS station_name,
    s.city,
    s.address,
    s.rating,
    s.status AS station_status,
    COUNT(DISTINCT c.charger_id) AS total_chargers,
    COUNT(DISTINCT sl.slot_id) AS total_slots,
    SUM(CASE WHEN sl.status = 'Available' THEN 1 ELSE 0 END) AS available_slots,
    MIN(c.rate_per_kwh) AS min_rate,
    MAX(c.power_output_kw) AS max_power_kw
FROM stations s
LEFT JOIN chargers c ON s.station_id = c.station_id
LEFT JOIN slots sl ON c.charger_id = sl.charger_id
GROUP BY s.station_id;

-- View 2: Detailed active bookings report
CREATE VIEW IF NOT EXISTS vw_active_bookings AS
SELECT 
    b.booking_id,
    u.name AS user_name,
    u.phone AS user_phone,
    v.make_model AS vehicle_model,
    v.license_plate,
    s.name AS station_name,
    s.city,
    c.charger_name,
    c.charger_type,
    sl.slot_number,
    b.start_time,
    b.end_time,
    b.energy_needed_kwh,
    b.total_estimated_amount,
    b.status AS booking_status,
    p.payment_status,
    p.payment_method
FROM bookings b
JOIN users u ON b.user_id = u.user_id
JOIN vehicles v ON b.vehicle_id = v.vehicle_id
JOIN slots sl ON b.slot_id = sl.slot_id
JOIN chargers c ON sl.charger_id = c.charger_id
JOIN stations s ON c.station_id = s.station_id
LEFT JOIN payments p ON b.booking_id = p.booking_id;

-- View 3: Station Revenue and Performance Analytics
CREATE VIEW IF NOT EXISTS vw_station_performance AS
SELECT 
    s.station_id,
    s.name AS station_name,
    s.city,
    COUNT(b.booking_id) AS total_bookings,
    COALESCE(SUM(CASE WHEN b.status = 'Completed' THEN b.total_estimated_amount ELSE 0 END), 0) AS total_revenue,
    COALESCE(SUM(CASE WHEN b.status = 'Completed' THEN b.energy_needed_kwh ELSE 0 END), 0) AS total_kwh_delivered,
    ROUND(AVG(r.rating), 2) AS avg_user_rating
FROM stations s
LEFT JOIN chargers c ON s.station_id = c.station_id
LEFT JOIN slots sl ON c.charger_id = sl.charger_id
LEFT JOIN bookings b ON sl.slot_id = b.slot_id
LEFT JOIN reviews r ON s.station_id = r.station_id
GROUP BY s.station_id;
