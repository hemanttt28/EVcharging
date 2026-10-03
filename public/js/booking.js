// ============================================================================
// VOLTRESERVE - BOOKING & STATION MODULE (booking.js)
// Station Explorer, Bay Selection, Dynamic Pricing & Relational Conflict Checking
// ============================================================================

const BookingModule = {
    selectedStation: null,
    selectedCharger: null,
    selectedSlot: null,
    vehicles: [],
    stations: [],
    bookings: [],

    init() {
        this.setupFilters();
        this.setupModalEvents();
        this.fetchStations();
        this.fetchVehicles();
        this.fetchBookings();
    },

    // 1. FILTERING & SEARCH
    setupFilters() {
        const searchInput = document.getElementById('station-search-input');
        const typeSelect = document.getElementById('filter-charger-type');
        const cityChips = document.querySelectorAll('.city-chip');

        if (searchInput) {
            let debounceTimer;
            searchInput.addEventListener('input', () => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => this.fetchStations(), 300);
            });
        }

        if (typeSelect) {
            typeSelect.addEventListener('change', () => this.fetchStations());
        }

        cityChips.forEach(chip => {
            chip.addEventListener('click', () => {
                cityChips.forEach(c => c.classList.remove('active'));
                chip.classList.add('active');
                this.fetchStations();
            });
        });

        const refreshBookingsBtn = document.getElementById('btn-refresh-bookings');
        if (refreshBookingsBtn) {
            refreshBookingsBtn.addEventListener('click', () => this.fetchBookings());
        }

        // View Mode Switcher: Grid vs Metro Radar Map
        const btnGrid = document.getElementById('btn-view-grid');
        const btnMap = document.getElementById('btn-view-map');
        const radarPanel = document.getElementById('metro-radar-map-panel');

        if (btnGrid && btnMap && radarPanel) {
            btnGrid.addEventListener('click', () => {
                btnGrid.classList.add('active');
                btnMap.classList.remove('active');
                radarPanel.classList.add('hidden');
            });

            btnMap.addEventListener('click', () => {
                btnMap.classList.add('active');
                btnGrid.classList.remove('active');
                radarPanel.classList.remove('hidden');
                radarPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            });
        }
    },

    // Filter by clicking on the interactive radar map pin
    filterByMapCity(city) {
        const cityChips = document.querySelectorAll('.city-chip');
        cityChips.forEach(chip => {
            if (chip.getAttribute('data-city') === city) {
                chip.classList.add('active');
            } else {
                chip.classList.remove('active');
            }
        });

        this.fetchStations();

        if (window.App) {
            window.App.showToast(`Filtered stations in ${city} charging corridor`, 'info');
        }
    },

    // 2. FETCH STATIONS FROM BACKEND
    async fetchStations() {
        const grid = document.getElementById('stations-grid');
        const countBadge = document.getElementById('stations-count-badge');
        const searchVal = document.getElementById('station-search-input')?.value.trim() || '';
        const typeVal = document.getElementById('filter-charger-type')?.value || 'All';
        const activeCityChip = document.querySelector('.city-chip.active');
        const cityVal = activeCityChip ? activeCityChip.getAttribute('data-city') : 'All';

        const params = new URLSearchParams();
        if (cityVal !== 'All') params.append('city', cityVal);
        if (typeVal !== 'All') params.append('chargerType', typeVal);
        if (searchVal) params.append('search', searchVal);

        try {
            const res = await fetch(`/api/stations?${params.toString()}`);
            const data = await res.json();

            if (data.success) {
                this.stations = data.stations;
                if (countBadge) countBadge.textContent = `Found ${data.stations.length} Stations`;
                this.renderStations(data.stations);
            }
        } catch (err) {
            if (grid) {
                grid.innerHTML = `<div class="loading-spinner-wrapper"><p style="color:#ef4444;">Failed connecting to backend database: ${err.message}</p></div>`;
            }
        }
    },

    renderStations(stations) {
        const grid = document.getElementById('stations-grid');
        if (!grid) return;

        if (stations.length === 0) {
            grid.innerHTML = `
                <div class="empty-results-hint" style="grid-column: 1 / -1;">
                    <p>No EV charging stations match your active search filters.</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = stations.map(s => {
            const amenitiesList = (s.amenities || 'WiFi, Restroom')
                .split(',')
                .map(a => `<span class="amenity-tag">${a.trim()}</span>`)
                .join('');

            return `
                <div class="station-card">
                    <div class="station-terminal-bar">
                        <div class="terminal-bar-left">
                            <span class="station-hub-pill">HUB #${String(s.station_id).padStart(2, '0')}</span>
                            <span class="station-city-badge">${escapeHtml(s.city)}</span>
                        </div>
                        <div class="terminal-bar-right">
                            <span class="station-speed-badge">⚡ ${s.max_power || 60} kW DC</span>
                            <span class="station-connector-tag">CCS2 / Type-2</span>
                        </div>
                    </div>

                    <div class="station-card-body">
                        <div>
                            <div class="card-top">
                                <span class="station-operator">${escapeHtml(s.operator_name)}</span>
                                <div class="card-rating">
                                    <span>★</span>
                                    <span>${s.rating.toFixed(1)}</span>
                                </div>
                            </div>

                            <h3 class="card-title">${escapeHtml(s.name)}</h3>
                            <p class="card-address">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path>
                                    <circle cx="12" cy="10" r="3"></circle>
                                </svg>
                                <span>${escapeHtml(s.address)}, ${escapeHtml(s.city)}</span>
                            </p>
                        </div>

                        <div class="station-metrics-strip">
                            <div class="metric-cell">
                                <span class="metric-val ${s.available_slots > 0 ? 'green' : ''}">${s.available_slots} / ${s.total_slots}</span>
                                <span class="metric-label">Slots Free</span>
                            </div>
                            <div class="metric-cell">
                                <span class="metric-val">${s.max_power || 60} kW</span>
                                <span class="metric-label">Peak Power</span>
                            </div>
                            <div class="metric-cell">
                                <span class="metric-val">₹${s.min_rate ? s.min_rate.toFixed(0) : '18'}</span>
                                <span class="metric-label">Per kWh</span>
                            </div>
                        </div>

                        <div class="amenities-tags">
                            ${amenitiesList}
                        </div>

                        <div class="card-footer">
                            <div class="tariff-text">
                                Tariff: <strong>₹${s.min_rate ? s.min_rate.toFixed(2) : '18.00'}</strong> / kWh
                            </div>
                            <button class="btn btn-primary btn-sm" onclick="BookingModule.openBookingModal(${s.station_id})">
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5">
                                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
                                </svg>
                                <span>Book Bay</span>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    },

    // 3. FETCH USER REGISTERED VEHICLES
    async fetchVehicles() {
        try {
            const res = await fetch('/api/vehicles');
            const data = await res.json();
            if (data.success) {
                this.vehicles = data.vehicles;
            }
        } catch (e) {
            console.error('Failed fetching vehicles:', e);
        }
    },

    // 4. BOOKING MODAL LOGIC
    setupModalEvents() {
        const closeBtn = document.getElementById('btn-close-booking-modal');
        const cancelBtn = document.getElementById('btn-cancel-modal');
        const confirmBtn = document.getElementById('btn-confirm-booking');
        const energySlider = document.getElementById('booking-energy-slider');
        const durationSelect = document.getElementById('booking-duration-select');

        if (closeBtn) closeBtn.addEventListener('click', () => this.closeBookingModal());
        if (cancelBtn) cancelBtn.addEventListener('click', () => this.closeBookingModal());
        if (confirmBtn) confirmBtn.addEventListener('click', () => this.submitBooking());

        // Ticket Modal Close Handlers
        const closeTicketBtn = document.getElementById('btn-close-ticket-modal');
        const closeTicketBtn2 = document.getElementById('btn-close-ticket-btn');
        if (closeTicketBtn) closeTicketBtn.addEventListener('click', () => this.closeTicketModal());
        if (closeTicketBtn2) closeTicketBtn2.addEventListener('click', () => this.closeTicketModal());

        if (energySlider) {
            energySlider.addEventListener('input', (e) => {
                document.getElementById('energy-val-display').textContent = `${e.target.value} kWh`;
                this.updateCostCalculation();
            });
        }
    },

    async openBookingModal(stationId) {
        const modal = document.getElementById('booking-modal');
        if (!modal) return;

        try {
            const res = await fetch(`/api/stations/${stationId}`);
            const data = await res.json();
            if (!data.success) {
                App.showToast(data.error || 'Failed to load station', 'error');
                return;
            }

            this.selectedStation = data.station;
            this.selectedChargers = data.chargers;
            this.selectedSlot = null;

            // Populate Station Header
            document.getElementById('modal-station-name').textContent = data.station.name;
            document.getElementById('modal-station-location').textContent = `${data.station.address}, ${data.station.city}`;

            // Populate Vehicles Dropdown
            const vehicleSelect = document.getElementById('booking-vehicle-select');
            if (vehicleSelect) {
                vehicleSelect.innerHTML = this.vehicles.map(v => 
                    `<option value="${v.vehicle_id}">${escapeHtml(v.make_model)} (${escapeHtml(v.license_plate)}) - ${v.battery_capacity_kwh}kWh [${v.connector_type}]</option>`
                ).join('');
            }

            // Set default date & time (rounded to next 15 mins)
            const now = new Date();
            now.setMinutes(Math.ceil(now.getMinutes() / 15) * 15);
            const localIso = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            document.getElementById('booking-start-time').value = localIso;

            // Render Chargers and Slots
            this.renderModalSlots(data.chargers);

            modal.classList.remove('hidden');
            this.updateCostCalculation();
        } catch (err) {
            App.showToast('Failed to open booking window: ' + err.message, 'error');
        }
    },

    renderModalSlots(chargers) {
        const container = document.getElementById('modal-chargers-container');
        if (!container) return;

        let firstAvailableSlot = null;

        container.innerHTML = chargers.map(c => {
            const slotsHtml = c.slots.map(sl => {
                const isAvail = sl.status === 'Available';
                if (isAvail && !firstAvailableSlot) {
                    firstAvailableSlot = { slot: sl, charger: c };
                }

                return `
                    <div class="bay-pill ${!isAvail ? 'disabled' : ''}" 
                         id="bay-slot-${sl.slot_id}"
                         data-slot-id="${sl.slot_id}" 
                         data-charger-id="${c.charger_id}"
                         onclick="${isAvail ? `BookingModule.selectSlot(${sl.slot_id}, ${c.charger_id})` : ''}">
                        <span class="bay-num">${escapeHtml(sl.slot_number)}</span>
                        <span class="bay-status-txt ${sl.status.toLowerCase()}">${sl.status}</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="charger-group-box">
                    <div class="charger-group-title">
                        <span>⚡ ${escapeHtml(c.charger_name)} (${c.charger_type})</span>
                        <span>${c.power_output_kw} kW • ₹${c.rate_per_kwh.toFixed(2)}/kWh</span>
                    </div>
                    <div class="bays-grid">
                        ${slotsHtml}
                    </div>
                </div>
            `;
        }).join('');

        // Pre-select first available slot if present
        if (firstAvailableSlot) {
            this.selectSlot(firstAvailableSlot.slot.slot_id, firstAvailableSlot.charger.charger_id);
        }
    },

    selectSlot(slotId, chargerId) {
        document.querySelectorAll('.bay-pill').forEach(p => p.classList.remove('selected'));
        const pill = document.getElementById(`bay-slot-${slotId}`);
        if (pill) pill.classList.add('selected');

        const charger = this.selectedChargers.find(c => c.charger_id === chargerId);
        const slot = charger?.slots.find(s => s.slot_id === slotId);

        this.selectedCharger = charger;
        this.selectedSlot = slot;

        this.updateCostCalculation();
    },

    updateCostCalculation() {
        const rateDisplay = document.getElementById('modal-rate-display');
        const energyDisplay = document.getElementById('modal-energy-display');
        const totalDisplay = document.getElementById('modal-total-display');
        const energySlider = document.getElementById('booking-energy-slider');

        const rate = this.selectedCharger ? this.selectedCharger.rate_per_kwh : 18.00;
        const energy = parseFloat(energySlider?.value || 30);
        const total = (rate * energy).toFixed(2);

        if (rateDisplay) rateDisplay.textContent = `₹${rate.toFixed(2)} / kWh`;
        if (energyDisplay) energyDisplay.textContent = `${energy.toFixed(1)} kWh`;
        if (totalDisplay) totalDisplay.textContent = `₹${total}`;
    },

    closeBookingModal() {
        const modal = document.getElementById('booking-modal');
        if (modal) modal.classList.add('hidden');
    },

    async submitBooking() {
        if (!this.selectedSlot) {
            App.showToast('Please select an available parking bay slot.', 'error');
            return;
        }

        const vehicleId = parseInt(document.getElementById('booking-vehicle-select').value);
        const startTimeInput = document.getElementById('booking-start-time').value;
        const durationMins = parseInt(document.getElementById('booking-duration-select').value);
        const energyKwh = parseFloat(document.getElementById('booking-energy-slider').value);
        const paymentMethod = document.querySelector('input[name="payment-method"]:checked')?.value || 'Wallet';

        if (!startTimeInput) {
            App.showToast('Please choose a valid start time.', 'error');
            return;
        }

        const startDate = new Date(startTimeInput);
        const endDate = new Date(startDate.getTime() + durationMins * 60000);

        const formatDt = (d) => {
            const pad = (n) => String(n).padStart(2, '0');
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
        };

        const payload = {
            slot_id: this.selectedSlot.slot_id,
            vehicle_id: vehicleId,
            start_time: formatDt(startDate),
            end_time: formatDt(endDate),
            energy_kwh: energyKwh,
            payment_method: paymentMethod
        };

        const confirmBtn = document.getElementById('btn-confirm-booking');
        try {
            confirmBtn.disabled = true;
            confirmBtn.textContent = 'Processing Transaction...';

            const res = await fetch('/api/bookings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, 'success');
                this.closeBookingModal();
                App.fetchStats();
                this.fetchStations();
                this.fetchBookings();
                
                // Show applied triggers toast notification
                if (data.appliedTriggers && data.appliedTriggers.length > 0) {
                    setTimeout(() => {
                        App.showToast(`Active DBMS Triggers Fired: ${data.appliedTriggers.join(' | ')}`, 'info');
                    }, 800);
                }
            } else {
                App.showToast(data.error || 'Booking reservation failed', 'error');
            }
        } catch (err) {
            App.showToast('Network error during reservation: ' + err.message, 'error');
        } finally {
            confirmBtn.disabled = false;
            confirmBtn.innerHTML = `
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Confirm &amp; Reserve Bay</span>
            `;
        }
    },

    // 5. FETCH & RENDER USER BOOKINGS (Tab 2)
    async fetchBookings() {
        const container = document.getElementById('bookings-list-container');
        try {
            const res = await fetch('/api/bookings');
            const data = await res.json();
            if (data.success) {
                this.bookings = data.bookings;
                this.renderBookings(data.bookings);
            }
        } catch (e) {
            console.error('Failed fetching bookings:', e);
        }
    },

    renderBookings(bookings) {
        const container = document.getElementById('bookings-list-container');
        if (!container) return;

        if (bookings.length === 0) {
            container.innerHTML = `
                <div class="empty-results-hint">
                    <p>You have no charging slot reservations yet. Go to Station Explorer to reserve a bay.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = bookings.map(b => {
            const isConfirmed = b.booking_status === 'Confirmed';
            const isInProgress = b.booking_status === 'In-Progress';
            const isCompleted = b.booking_status === 'Completed';
            const isCancelled = b.booking_status === 'Cancelled';

            let statusBadgeClass = 'badge-info';
            if (isConfirmed) statusBadgeClass = 'badge-warning';
            if (isInProgress) statusBadgeClass = 'badge-info';
            if (isCompleted) statusBadgeClass = 'badge-success';
            if (isCancelled) statusBadgeClass = 'badge-danger';

            return `
                <div class="booking-card ${isInProgress ? 'in-progress' : ''}">
                    <div class="booking-main-info">
                        <span class="booking-id-tag">RESERVATION #${b.booking_id} • ${escapeHtml(b.slot_number)}</span>
                        <h4 class="booking-station-name">${escapeHtml(b.station_name)}</h4>
                        <p class="booking-vehicle-details">
                            🚗 ${escapeHtml(b.make_model)} (${escapeHtml(b.license_plate)}) • ${escapeHtml(b.charger_name)} (${b.power_output_kw}kW)
                        </p>
                        ${isInProgress ? `
                            <div class="charging-indicator">
                                <span style="font-size:0.75rem;color:var(--primary);font-weight:700;">⚡ Dispensing Power...</span>
                                <div class="charging-bar-track">
                                    <div class="charging-bar-fill"></div>
                                </div>
                            </div>
                        ` : ''}
                    </div>

                    <div class="booking-time-info">
                        <div class="time-row">
                            <span>📅 Start:</span>
                            <strong>${b.start_time}</strong>
                        </div>
                        <div class="time-row">
                            <span>🏁 End:</span>
                            <strong>${b.end_time}</strong>
                        </div>
                        <div class="time-row" style="color:#94a3b8;font-size:0.75rem;">
                            <span>Payment:</span>
                            <span>${b.payment_method || 'Wallet'} (${b.payment_status || 'Paid'})</span>
                        </div>
                    </div>

                    <div class="booking-financials">
                        <span class="booking-amount">₹${b.total_estimated_amount.toFixed(2)}</span>
                        <span class="booking-energy">⚡ ${b.energy_needed_kwh.toFixed(1)} kWh requested</span>
                        <span class="badge ${statusBadgeClass}" style="margin-top:4px;align-self:flex-start;">${b.booking_status}</span>
                    </div>

                    <div class="booking-actions">
                        <button class="btn btn-secondary btn-sm" onclick="BookingModule.openTicketModal(${b.booking_id})" title="View dispenser QR pass">
                            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="3" y="3" width="18" height="18" rx="2"/>
                                <path d="M7 7h3v3H7z M14 7h3v3h-3z M7 14h3v3H7z"/>
                            </svg>
                            <span>Bay Pass</span>
                        </button>
                        ${isConfirmed ? `
                            <button class="btn btn-danger btn-sm" onclick="BookingModule.cancelBooking(${b.booking_id})">
                                Cancel &amp; Refund
                            </button>
                            <button class="btn btn-accent btn-sm" onclick="BookingModule.completeBooking(${b.booking_id})">
                                Mark In-Progress
                            </button>
                        ` : ''}
                        ${isInProgress ? `
                            <button class="btn btn-primary btn-sm" onclick="BookingModule.completeBooking(${b.booking_id})">
                                Complete Session
                            </button>
                        ` : ''}
                        ${isCompleted ? `
                            <span style="font-size:0.75rem;color:var(--primary);font-weight:700;">✓ Session Completed</span>
                        ` : ''}
                        ${isCancelled ? `
                            <span style="font-size:0.75rem;color:#ef4444;">Refund Credited</span>
                        ` : ''}
                    </div>
                </div>
            `;
        }).join('');
    },

    openTicketModal(bookingId) {
        const b = this.bookings.find(item => item.booking_id === bookingId);
        if (!b) return;

        const modal = document.getElementById('ticket-modal');
        const resId = document.getElementById('ticket-reservation-id');
        const statusBadge = document.getElementById('ticket-status-badge');
        const stationName = document.getElementById('ticket-station-name');
        const bayName = document.getElementById('ticket-bay-name');
        const plate = document.getElementById('ticket-vehicle-plate');
        const timeWindow = document.getElementById('ticket-time-window');

        if (resId) resId.textContent = `RESERVATION #${b.booking_id}`;
        if (statusBadge) {
            statusBadge.textContent = b.booking_status;
            let badgeCls = 'badge-info';
            if (b.booking_status === 'Confirmed') badgeCls = 'badge-warning';
            if (b.booking_status === 'Completed') badgeCls = 'badge-success';
            if (b.booking_status === 'Cancelled') badgeCls = 'badge-danger';
            statusBadge.className = `badge ${badgeCls}`;
        }
        if (stationName) stationName.textContent = b.station_name;
        if (bayName) bayName.textContent = `Bay ${b.slot_number} • ${b.power_output_kw} kW (${b.charger_name})`;
        if (plate) plate.textContent = `${b.license_plate} (${b.make_model})`;
        if (timeWindow) timeWindow.textContent = `${b.start_time}`;

        if (modal) modal.classList.remove('hidden');
    },

    closeTicketModal() {
        const modal = document.getElementById('ticket-modal');
        if (modal) modal.classList.add('hidden');
    },

    async cancelBooking(bookingId) {
        if (!confirm(`Cancel Reservation #${bookingId}? Slot will be freed and amount will be refunded via DBMS Trigger.`)) {
            return;
        }

        try {
            const res = await fetch(`/api/bookings/${bookingId}/cancel`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, 'success');
                App.fetchStats();
                this.fetchBookings();
                this.fetchStations();
            } else {
                App.showToast(data.error, 'error');
            }
        } catch (e) {
            App.showToast('Network error cancelling booking', 'error');
        }
    },

    async completeBooking(bookingId) {
        try {
            const res = await fetch(`/api/bookings/${bookingId}/complete`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                App.showToast(data.message, 'success');
                App.fetchStats();
                this.fetchBookings();
                this.fetchStations();
            } else {
                App.showToast(data.error, 'error');
            }
        } catch (e) {
            App.showToast('Network error completing booking', 'error');
        }
    }
};

window.BookingModule = BookingModule;
document.addEventListener('DOMContentLoaded', () => {
    BookingModule.init();
});
