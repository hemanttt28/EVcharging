# VoltReserve - EV (Electric Vehicle) Charging Station Slot Booking System

VoltReserve is a modern, full-stack Electric Vehicle Charging Station & Parking Bay Slot Booking platform engineered with an Express backend connected to a relational SQLite database.

It provides real-world EV charging slot reservation with instant conflict detection, wallet billing, station search, and automatic database triggers.

---

## 🚀 Key DBMS Features & Capabilities

### 1. Relational Database Architecture
- **Relations (Tables)**: 9 core relations (`users`, `vehicles`, `stations`, `chargers`, `slots`, `bookings`, `payments`, `reviews`, `audit_logs`).
- **Keys**:
  - Primary Keys (`INTEGER PRIMARY KEY AUTOINCREMENT`) for all entities.
  - Foreign Keys with integrity constraints (`ON DELETE CASCADE`, `ON DELETE RESTRICT`).
  - Unique Keys (e.g. `(charger_id, slot_number)` to prevent duplicate bay numbering).
  - Check Constraints (`CHECK (wallet_balance >= 0)`, `CHECK (rating BETWEEN 1 AND 5)`).

### 2. Transaction Management & Overlap Conflict Prevention
- Real-time detection of reservation collisions when drivers select a slot and time window:
  ```sql
  SELECT booking_id FROM bookings
  WHERE slot_id = :slot_id 
    AND status IN ('Confirmed', 'In-Progress')
    AND NOT (end_time <= :start_time OR start_time >= :end_time);
  ```

### 3. Active Database Triggers (Event-Condition-Action)
1. `trg_audit_booking_insert`: Automatically logs all new reservations into `audit_logs`.
2. `trg_slot_booked`: Updates `slots.status = 'Booked'` whenever a booking is inserted.
3. `trg_slot_freed`: Automatically resets slot back to `'Available'` when a booking is cancelled or marked completed.
4. `trg_deduct_wallet`: Automatically deducts booking tariff from `users.wallet_balance`.
5. `trg_refund_wallet`: Credits refund back to `users.wallet_balance` upon booking cancellation.

### 4. Relational Views (Virtual Tables)
- `vw_station_overview`: Multi-table aggregate calculating total chargers, total slots, available slots, and minimum tariff.
- `vw_active_bookings`: 6-table join across `bookings`, `users`, `vehicles`, `slots`, `chargers`, and `stations`.
- `vw_station_performance`: Real-time analytics on revenue and kWh delivered per station.

---

## 🛠 Tech Stack

- **Backend**: Node.js, Express.js, native `node:sqlite` (Node 22 synchronous relational engine with WAL mode).
- **Frontend**: HTML5, Modern CSS3 (Glassmorphism, dark cyber-electric aesthetic, responsive grid), Vanilla JavaScript ES6+.
- **Database**: SQLite 3 with Foreign Keys and WAL Journaling enabled.

---

## 💻 How to Run Locally

### Prerequisites
- Node.js (version 22.x or later)

### Installation & Launch
```bash
# 1. Install dependencies
npm install

# 2. Start the server
npm start
```

### Accessing the Web Application
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 📁 Project Structure

```
dbms/
├── database/
│   ├── db.js             # node:sqlite connection, WAL setup, query logger & schema introspection
│   ├── schema.sql        # DDL: Tables, Foreign Keys, Triggers, Views, Indexes
│   ├── seed.sql          # Seed data: Realistic stations, chargers, slots, vehicles & users
│   └── queries.json      # Academic DBMS SQL catalog
├── public/
│   ├── index.html        # Clean EV Charging UI (Station Explorer & My Bookings)
│   ├── css/
│   │   └── style.css     # Premium dark theme, glassmorphism, micro-animations
│   └── js/
│       ├── app.js        # Core controller, telemetry, reset DB
│       └── booking.js    # Station explorer, interactive slot picker, reservation flow
├── package.json
└── server.js             # Express REST API & static server
```
