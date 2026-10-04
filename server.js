// ============================================================================
// EV CHARGING STATION SLOT BOOKING SYSTEM - EXPRESS BACKEND
// Connects Web Interface directly to SQLite DBMS
// ============================================================================
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { 
    initDb, 
    queryAll, 
    queryGet, 
    queryRun, 
    getSchemaMetadata, 
    getQueryLogs, 
    DB_PATH 
} = require('./database/db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Load pre-crafted academic queries
const QUERIES_PATH = path.join(__dirname, 'database', 'queries.json');
let academicQueries = [];
try {
    academicQueries = JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf8'));
} catch (e) {
    console.error('Failed reading queries.json:', e.message);
}

// Current logged in driver (Default demo user: Rahul Sharma)
const CURRENT_USER_ID = 1;

// ============================================================================
// 1. DASHBOARD & SYSTEM STATS (Relational Aggregations)
// ============================================================================
app.get('/api/stats', (req, res) => {
    try {
        const stationStats = queryGet(`
            SELECT 
                COUNT(DISTINCT s.station_id) AS total_stations,
                COUNT(DISTINCT c.charger_id) AS total_chargers,
                COUNT(DISTINCT sl.slot_id) AS total_slots,
                SUM(CASE WHEN sl.status = 'Available' THEN 1 ELSE 0 END) AS available_slots
            FROM stations s
            LEFT JOIN chargers c ON s.station_id = c.station_id
            LEFT JOIN slots sl ON c.charger_id = sl.charger_id;
        `);

        const bookingStats = queryGet(`
            SELECT 
                COUNT(*) AS total_bookings,
                COALESCE(SUM(CASE WHEN status = 'Completed' THEN energy_needed_kwh ELSE 0 END), 0) AS total_kwh_delivered,
                COALESCE(SUM(CASE WHEN status = 'Completed' THEN total_estimated_amount ELSE 0 END), 0) AS total_revenue
            FROM bookings;
        `);

        const user = queryGet(`
            SELECT user_id, name, email, phone, role, wallet_balance 
            FROM users 
            WHERE user_id = ?;
        `, [CURRENT_USER_ID]);

        res.json({
            success: true,
            stats: {
                totalStations: stationStats.total_stations || 0,
                totalChargers: stationStats.total_chargers || 0,
                totalSlots: stationStats.total_slots || 0,
                availableSlots: stationStats.available_slots || 0,
                totalBookings: bookingStats.total_bookings || 0,
                totalKwhDelivered: Math.round(bookingStats.total_kwh_delivered * 10) / 10,
                totalRevenue: Math.round(bookingStats.total_revenue * 100) / 100
            },
            currentUser: user
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/wallet/topup', (req, res) => {
    try {
        const { amount } = req.body;
        const topupAmt = parseFloat(amount);
        if (isNaN(topupAmt) || topupAmt <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid top-up amount.' });
        }

        queryRun(`
            UPDATE users 
            SET wallet_balance = wallet_balance + ? 
            WHERE user_id = ?;
        `, [topupAmt, CURRENT_USER_ID]);

        const updatedUser = queryGet(`SELECT wallet_balance FROM users WHERE user_id = ?;`, [CURRENT_USER_ID]);

        res.json({
            success: true,
            message: `Recharged ₹${topupAmt.toFixed(2)} to your driver wallet!`,
            wallet_balance: updatedUser.wallet_balance
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// 2. STATIONS & CHARGERS (Selection, Projection, Joins, Group By)
// ============================================================================
app.get('/api/stations', (req, res) => {
    try {
        const { city, chargerType, search } = req.query;
        let sql = `
            SELECT 
                s.station_id,
                s.name,
                s.address,
                s.city,
                s.landmark,
                s.latitude,
                s.longitude,
                s.operator_name,
                s.rating,
                s.amenities,
                s.status,
                COUNT(DISTINCT c.charger_id) AS total_chargers,
                COUNT(DISTINCT sl.slot_id) AS total_slots,
                SUM(CASE WHEN sl.status = 'Available' THEN 1 ELSE 0 END) AS available_slots,
                MIN(c.rate_per_kwh) AS min_rate,
                MAX(c.power_output_kw) AS max_power
            FROM stations s
            LEFT JOIN chargers c ON s.station_id = c.station_id
            LEFT JOIN slots sl ON c.charger_id = sl.charger_id
            WHERE 1=1
        `;
        const params = [];

        if (city && city !== 'All') {
            sql += ` AND s.city = ?`;
            params.push(city);
        }

        if (chargerType && chargerType !== 'All') {
            sql += ` AND c.charger_type LIKE ?`;
            params.push(`%${chargerType}%`);
        }

        if (search) {
            sql += ` AND (s.name LIKE ? OR s.address LIKE ? OR s.operator_name LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`, `%${search}%`);
        }

        sql += ` GROUP BY s.station_id ORDER BY available_slots DESC, s.rating DESC;`;

        const stations = queryAll(sql, params);
        res.json({ success: true, stations });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/stations/:id', (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const station = queryGet(`SELECT * FROM stations WHERE station_id = ?;`, [stationId]);
        if (!station) {
            return res.status(404).json({ success: false, error: 'Station not found' });
        }

        const chargers = queryAll(`
            SELECT * FROM chargers 
            WHERE station_id = ? 
            ORDER BY power_output_kw DESC;
        `, [stationId]);

        for (const charger of chargers) {
            charger.slots = queryAll(`
                SELECT * FROM slots 
                WHERE charger_id = ? 
                ORDER BY slot_id ASC;
            `, [charger.charger_id]);
        }

        const reviews = queryAll(`
            SELECT r.*, u.name AS user_name 
            FROM reviews r
            JOIN users u ON r.user_id = u.user_id
            WHERE r.station_id = ?
            ORDER BY r.created_at DESC;
        `, [stationId]);

        res.json({
            success: true,
            station,
            chargers,
            reviews
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// 3. VEHICLES & USER PROFILE
// ============================================================================
app.get('/api/vehicles', (req, res) => {
    try {
        const vehicles = queryAll(`
            SELECT * FROM vehicles 
            WHERE user_id = ? 
            ORDER BY vehicle_id ASC;
        `, [CURRENT_USER_ID]);
        res.json({ success: true, vehicles });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/wallet/topup', (req, res) => {
    try {
        const { amount } = req.body;
        const amt = parseFloat(amount);
        if (!amt || amt <= 0) {
            return res.status(400).json({ success: false, error: 'Invalid top-up amount' });
        }
        queryRun('UPDATE users SET wallet_balance = wallet_balance + ? WHERE user_id = ?;', [amt, CURRENT_USER_ID]);
        const user = queryGet('SELECT * FROM users WHERE user_id = ?;', [CURRENT_USER_ID]);
        res.json({
            success: true,
            balance: user.wallet_balance,
            message: `Successfully added ₹${amt.toFixed(2)} to your driver wallet.`
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// 4. BOOKINGS (Transactions, Constraints, Overlap Checking, Triggers)
// ============================================================================
app.get('/api/bookings', (req, res) => {
    try {
        const bookings = queryAll(`
            SELECT 
                b.booking_id,
                b.user_id,
                b.slot_id,
                b.vehicle_id,
                b.start_time,
                b.end_time,
                b.energy_needed_kwh,
                b.total_estimated_amount,
                b.status AS booking_status,
                b.created_at,
                u.name AS user_name,
                v.make_model,
                v.license_plate,
                s.station_id,
                s.name AS station_name,
                s.city,
                s.address,
                c.charger_name,
                c.charger_type,
                c.power_output_kw,
                c.rate_per_kwh,
                sl.slot_number,
                p.payment_id,
                p.payment_method,
                p.payment_status
            FROM bookings b
            JOIN users u ON b.user_id = u.user_id
            JOIN vehicles v ON b.vehicle_id = v.vehicle_id
            JOIN slots sl ON b.slot_id = sl.slot_id
            JOIN chargers c ON sl.charger_id = c.charger_id
            JOIN stations s ON c.station_id = s.station_id
            LEFT JOIN payments p ON b.booking_id = p.booking_id
            ORDER BY b.booking_id DESC;
        `);
        res.json({ success: true, bookings });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/bookings', (req, res) => {
    try {
        const { slot_id, vehicle_id, start_time, end_time, energy_kwh, payment_method } = req.body;

        if (!slot_id || !vehicle_id || !start_time || !end_time || !energy_kwh) {
            return res.status(400).json({ success: false, error: 'All booking fields are required.' });
        }

        // Fetch slot & charger info for rate calculation
        const slotInfo = queryGet(`
            SELECT sl.slot_id, sl.slot_number, sl.status AS slot_status, c.charger_name, c.rate_per_kwh, c.station_id
            FROM slots sl
            JOIN chargers c ON sl.charger_id = c.charger_id
            WHERE sl.slot_id = ?;
        `, [slot_id]);

        if (!slotInfo) {
            return res.status(404).json({ success: false, error: 'Slot not found.' });
        }

        // Check for time slot overlap conflict in relational DB
        const overlap = queryGet(`
            SELECT booking_id, start_time, end_time 
            FROM bookings
            WHERE slot_id = ? 
              AND status IN ('Confirmed', 'In-Progress')
              AND NOT (end_time <= ? OR start_time >= ?);
        `, [slot_id, start_time, end_time]);

        if (overlap) {
            return res.status(409).json({ 
                success: false, 
                error: `Slot is already booked from ${overlap.start_time} to ${overlap.end_time}. Please select a different time or bay.` 
            });
        }

        const totalAmount = Math.round(energy_kwh * slotInfo.rate_per_kwh * 100) / 100;

        // Check user wallet balance if paying with Wallet
        const user = queryGet(`SELECT wallet_balance FROM users WHERE user_id = ?;`, [CURRENT_USER_ID]);
        if (payment_method === 'Wallet' && user.wallet_balance < totalAmount) {
            return res.status(400).json({ 
                success: false, 
                error: `Insufficient wallet balance (₹${user.wallet_balance.toFixed(2)}). Total required: ₹${totalAmount.toFixed(2)}. Please recharge or choose another payment method.` 
            });
        }

        // Execute Booking Insertion (Database Triggers will fire automatically!)
        const result = queryRun(`
            INSERT INTO bookings (
                user_id, slot_id, vehicle_id, start_time, end_time, energy_needed_kwh, total_estimated_amount, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Confirmed');
        `, [CURRENT_USER_ID, slot_id, vehicle_id, start_time, end_time, energy_kwh, totalAmount]);

        const bookingId = Number(result.lastInsertRowid);

        // Record payment in payments relation
        queryRun(`
            INSERT INTO payments (booking_id, amount, payment_method, payment_status)
            VALUES (?, ?, ?, 'Completed');
        `, [bookingId, totalAmount, payment_method || 'Wallet']);

        res.json({
            success: true,
            bookingId,
            message: `Booking #${bookingId} confirmed successfully! Slot ${slotInfo.slot_number} reserved.`,
            totalAmount,
            appliedTriggers: [
                'trg_audit_booking_insert: Audit log entry automatically generated',
                'trg_slot_booked: Slot status updated to Booked',
                'trg_deduct_wallet: Deducted ₹' + totalAmount + ' from wallet'
            ]
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/bookings/:id/cancel', (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const booking = queryGet(`SELECT * FROM bookings WHERE booking_id = ?;`, [bookingId]);
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found.' });
        }
        if (booking.status !== 'Confirmed') {
            return res.status(400).json({ success: false, error: `Cannot cancel booking with status: ${booking.status}` });
        }

        // Update status to Cancelled (Fires trg_slot_freed and trg_refund_wallet!)
        queryRun(`UPDATE bookings SET status = 'Cancelled' WHERE booking_id = ?;`, [bookingId]);

        res.json({
            success: true,
            message: `Booking #${bookingId} cancelled. Slot freed and refund processed to wallet.`,
            appliedTriggers: [
                'trg_slot_freed: Slot status reset to Available',
                'trg_refund_wallet: Wallet credited with ₹' + booking.total_estimated_amount
            ]
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/api/bookings/:id/complete', (req, res) => {
    try {
        const bookingId = parseInt(req.params.id);
        const booking = queryGet(`SELECT * FROM bookings WHERE booking_id = ?;`, [bookingId]);
        if (!booking) {
            return res.status(404).json({ success: false, error: 'Booking not found.' });
        }

        // Mark Completed (Fires trg_slot_freed)
        queryRun(`UPDATE bookings SET status = 'Completed' WHERE booking_id = ?;`, [bookingId]);

        res.json({
            success: true,
            message: `Charging session #${bookingId} marked as completed. Bay is now available for next driver.`,
            appliedTriggers: ['trg_slot_freed: Slot released back to Available']
        });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ============================================================================
// 5. INTERACTIVE DBMS LAB & LIVE SQL CONSOLE
// ============================================================================
app.get('/api/db/queries', (req, res) => {
    res.json({ success: true, queries: academicQueries });
});

app.post('/api/db/execute', (req, res) => {
    const { sql } = req.body;
    if (!sql || !sql.trim()) {
        return res.status(400).json({ success: false, error: 'SQL query string cannot be empty.' });
    }

    const trimmed = sql.trim();
    const isSelect = /^(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(trimmed);
    const start = performance.now();

    try {
        let results = null;
        let columns = [];
        let rows = [];
        let affectedRows = 0;
        let explainPlan = null;

        if (isSelect) {
            rows = queryAll(trimmed);
            if (rows.length > 0) {
                columns = Object.keys(rows[0]);
            }

            // Also attempt to get execution plan for SELECT statements
            if (/^SELECT\b/i.test(trimmed)) {
                try {
                    explainPlan = queryAll(`EXPLAIN QUERY PLAN ${trimmed}`);
                } catch (e) {
                    explainPlan = null;
                }
            }
        } else {
            const runRes = queryRun(trimmed);
            affectedRows = runRes.changes || 0;
        }

        const durationMs = Math.round((performance.now() - start) * 100) / 100;

        res.json({
            success: true,
            isSelect,
            columns,
            rows,
            rowCount: rows.length,
            affectedRows,
            durationMs,
            explainPlan,
            executedAt: new Date().toLocaleTimeString()
        });
    } catch (err) {
        const durationMs = Math.round((performance.now() - start) * 100) / 100;
        res.status(400).json({
            success: false,
            error: err.message,
            durationMs
        });
    }
});

app.get('/api/db/schema', (req, res) => {
    try {
        const metadata = getSchemaMetadata();
        res.json({ success: true, schema: metadata });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.get('/api/db/logs', (req, res) => {
    res.json({ success: true, logs: getQueryLogs() });
});

app.post('/api/db/reset', (req, res) => {
    try {
        initDb(true);
        res.json({ success: true, message: 'Database reset to initial pristine state with fresh seed records.' });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// Initialize database on startup
initDb();

app.listen(PORT, '0.0.0.0', () => {
    console.log(`[EV-DBMS SERVER] Running at http://0.0.0.0:${PORT}`);
});
