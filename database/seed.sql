-- ============================================================================
-- EV CHARGING STATION SLOT BOOKING SYSTEM - SEED DATA
-- Comprehensive initial dataset for testing, demos, and evaluation
-- ============================================================================

-- 1. SEED USERS
INSERT INTO users (user_id, name, email, phone, role, wallet_balance) VALUES
(1, 'Rahul Sharma', 'rahul.sharma@example.com', '+91 98765 43210', 'driver', 1500.00),
(2, 'Priya Patel', 'priya.patel@example.com', '+91 98234 56789', 'driver', 850.50),
(3, 'Vikram Mehta', 'vikram.mehta@example.com', '+91 99112 23344', 'driver', 2100.00),
(4, 'Ananya Iyer', 'ananya.iyer@example.com', '+91 97456 78901', 'driver', 620.00),
(5, 'Suresh Reddy', 'suresh.reddy@chargenet.com', '+91 98888 12345', 'operator', 5000.00),
(6, 'Admin Officer', 'admin@evcharge.org', '+91 90000 00001', 'admin', 10000.00);

-- 2. SEED VEHICLES
INSERT INTO vehicles (vehicle_id, user_id, license_plate, make_model, battery_capacity_kwh, connector_type, current_charge_pct) VALUES
(1, 1, 'KA-01-MJ-2024', 'Tata Nexon EV Max', 40.5, 'CCS2', 28),
(2, 1, 'KA-05-EV-9999', 'Ather 450X Gen 3', 3.7, 'Type 2 AC', 45),
(3, 2, 'MH-02-EE-4501', 'MG ZS EV Excite', 50.3, 'CCS2', 18),
(4, 3, 'DL-3C-EV-7788', 'Hyundai Ioniq 5', 72.6, 'CCS2', 35),
(5, 4, 'TS-09-EV-3312', 'Mahindra XUV400', 39.4, 'CCS2', 22);

-- 3. SEED STATIONS
INSERT INTO stations (station_id, name, address, city, landmark, latitude, longitude, operator_name, rating, amenities, status) VALUES
(1, 'Zeon HyperHub - Indiranagar', '100ft Road, HAL 2nd Stage, Indiranagar', 'Bengaluru', 'Near Metro Station', 12.9716, 77.6412, 'Zeon Charging', 4.9, 'Cafe, High-Speed WiFi, Lounge, Washroom', 'Active'),
(2, 'Tata Power EZ Charge - Whitefield', 'ITPL Main Road, Pattandur Agrahara', 'Bengaluru', 'Opposite ITPL Tech Park', 12.9866, 77.7381, 'Tata Power EV', 4.7, 'Restroom, Coffee Vending, Food Court nearby', 'Active'),
(3, 'Jio-bp pulse Station - Bandra Kurla', 'G Block, Bandra Kurla Complex (BKC)', 'Mumbai', 'Near Bharat Diamond Bourse', 19.0657, 72.8687, 'Jio-bp pulse', 4.8, 'Convenience Store, Air Filling, Cafe, WiFi', 'Active'),
(4, 'Statiq Supercharge - Connaught Place', 'Radial Road 3, Inner Circle, Connaught Place', 'Delhi', 'Near Palika Bazaar Entry 4', 28.6315, 77.2167, 'Statiq Energy', 4.6, '24/7 Security, Restroom, Shopping Arcade', 'Active'),
(5, 'ChargeZone Hub - Hitec City', 'Cyber Towers Junction, Madhapur', 'Hyderabad', 'Next to Shilparamam Craft Village', 17.4504, 78.3808, 'ChargeZone', 4.8, 'Food Kiosk, Restroom, High-Speed WiFi', 'Active'),
(6, 'Kazam Rapid Bay - Koregaon Park', 'North Main Road, Koregaon Park', 'Pune', 'Near Osho Garden', 18.5362, 73.8940, 'Kazam EV', 4.5, 'Open Air Cafe, Restroom, Shaded Parking', 'Active');

-- 4. SEED CHARGERS
INSERT INTO chargers (charger_id, station_id, charger_name, charger_type, power_output_kw, connector_type, rate_per_kwh, status) VALUES
-- Station 1: Indiranagar
(1, 1, 'HyperVolt DC-150', 'DC Ultra-Fast', 150.0, 'CCS2', 20.00, 'Operational'),
(2, 1, 'DualPort DC-60', 'DC Fast', 60.0, 'CCS2', 17.50, 'Operational'),
(3, 1, 'EcoCharge AC-22', 'Level 2 AC', 22.0, 'Type 2 AC', 12.00, 'Operational'),

-- Station 2: Whitefield
(4, 2, 'EZ Rapid 60A', 'DC Fast', 60.0, 'CCS2', 18.00, 'Operational'),
(5, 2, 'EZ AC Twin-22', 'Level 2 AC', 22.0, 'Type 2 AC', 11.50, 'Operational'),

-- Station 3: BKC Mumbai
(6, 3, 'Pulse Ultra 120', 'DC Ultra-Fast', 120.0, 'CCS2', 21.00, 'Operational'),
(7, 3, 'Pulse Express 50', 'DC Fast', 50.0, 'CHAdeMO', 17.00, 'Operational'),
(8, 3, 'Pulse AC 11', 'Level 2 AC', 11.0, 'Type 2 AC', 13.00, 'Operational'),

-- Station 4: CP Delhi
(9, 4, 'Statiq Flash 60', 'DC Fast', 60.0, 'CCS2', 18.50, 'Operational'),
(10, 4, 'Statiq AC-22', 'Level 2 AC', 22.0, 'Type 2 AC', 12.50, 'Operational'),

-- Station 5: Hitec City
(11, 5, 'ChargeZone Dual DC', 'DC Ultra-Fast', 120.0, 'CCS2', 19.50, 'Operational'),
(12, 5, 'ChargeZone AC Fast', 'Level 2 AC', 22.0, 'Type 2 AC', 12.00, 'Operational'),

-- Station 6: Pune
(13, 6, 'Kazam Rapid 50', 'DC Fast', 50.0, 'CCS2', 16.50, 'Operational');

-- 5. SEED SLOTS
INSERT INTO slots (slot_id, charger_id, slot_number, status) VALUES
-- Charger 1 (Indiranagar 150kW)
(1, 1, 'Bay 1A (Ultra DC)', 'Available'),
(2, 1, 'Bay 1B (Ultra DC)', 'Available'),

-- Charger 2 (Indiranagar 60kW)
(3, 2, 'Bay 2A (Fast DC)', 'Available'),
(4, 2, 'Bay 2B (Fast DC)', 'Booked'),

-- Charger 3 (Indiranagar AC 22kW)
(5, 3, 'Bay 3A (AC Slow)', 'Available'),
(6, 3, 'Bay 3B (AC Slow)', 'Available'),

-- Charger 4 (Whitefield 60kW)
(7, 4, 'Bay W1 (Fast DC)', 'Available'),
(8, 4, 'Bay W2 (Fast DC)', 'Available'),

-- Charger 5 (Whitefield AC 22kW)
(9, 5, 'Bay W3 (AC)', 'Available'),

-- Charger 6 & 7 & 8 (BKC Mumbai)
(10, 6, 'Bay M1 (Ultra DC)', 'Available'),
(11, 6, 'Bay M2 (Ultra DC)', 'Available'),
(12, 7, 'Bay M3 (CHAdeMO)', 'Available'),
(13, 8, 'Bay M4 (AC)', 'Available'),

-- Delhi
(14, 9, 'Bay D1 (Fast DC)', 'Available'),
(15, 9, 'Bay D2 (Fast DC)', 'Available'),
(16, 10, 'Bay D3 (AC)', 'Available'),

-- Hyderabad
(17, 11, 'Bay H1 (Ultra DC)', 'Available'),
(18, 11, 'Bay H2 (Ultra DC)', 'Available'),
(19, 12, 'Bay H3 (AC)', 'Available'),

-- Pune
(20, 13, 'Bay P1 (Fast DC)', 'Available'),
(21, 13, 'Bay P2 (Fast DC)', 'Available');

-- 6. SEED PAST & CURRENT BOOKINGS
INSERT INTO bookings (booking_id, user_id, slot_id, vehicle_id, start_time, end_time, energy_needed_kwh, total_estimated_amount, status) VALUES
(1, 2, 4, 3, '2026-10-03 16:00:00', '2026-10-03 17:30:00', 35.0, 612.50, 'Confirmed'),
(2, 1, 1, 1, '2026-10-02 10:00:00', '2026-10-02 11:15:00', 28.5, 570.00, 'Completed'),
(3, 3, 10, 4, '2026-10-02 14:00:00', '2026-10-02 15:30:00', 45.0, 945.00, 'Completed'),
(4, 4, 14, 5, '2026-10-01 09:30:00', '2026-10-01 10:45:00', 25.0, 462.50, 'Completed');

-- 7. SEED PAYMENTS
INSERT INTO payments (payment_id, booking_id, amount, payment_method, payment_status) VALUES
(1, 1, 612.50, 'Wallet', 'Completed'),
(2, 2, 570.00, 'UPI', 'Completed'),
(3, 3, 945.00, 'Credit Card', 'Completed'),
(4, 4, 462.50, 'Wallet', 'Completed');

-- 8. SEED REVIEWS
INSERT INTO reviews (review_id, station_id, user_id, rating, comment) VALUES
(1, 1, 1, 5, 'Super fast 150kW charger! Charged my Nexon from 20% to 80% in just 35 minutes while enjoying coffee at the cafe.'),
(2, 1, 2, 5, 'Clean premise, active security, slots were clearly marked and hassle-free reservation.'),
(3, 2, 3, 4, 'Good charging speed, parking spaces are spacious, nearby food court is convenient.'),
(4, 3, 4, 5, 'Best EV station in BKC Mumbai. Jio-bp staff assisted with connecting the CCS2 gun.');

-- 9. INITIAL AUDIT LOGS
INSERT INTO audit_logs (action_type, entity_name, entity_id, details) VALUES
('INITIALIZE', 'database', 0, 'Database initialized with 6 stations, 13 chargers, and 21 slots.'),
('SYSTEM', 'schema', 0, 'Relational constraints, Foreign Keys, Triggers and Views deployed successfully.');
