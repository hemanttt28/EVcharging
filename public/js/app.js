// ============================================================================
// VOLTRESERVE - CORE APPLICATION SCRIPT (app.js)
// State management, navigation tabs, network telemetry, reset handler
// ============================================================================

const App = {
    state: {
        currentUser: null,
        stats: null,
        activeTab: 'tab-explore'
    },

    init() {
        this.setupNavigation();
        this.setupResetButton();
        this.setupWalletModal();
        this.fetchStats();
    },

    // Navigation Tabs Handler
    setupNavigation() {
        const tabBtns = document.querySelectorAll('.tab-btn');
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const targetTabId = btn.getAttribute('data-tab');
                
                // Toggle active buttons
                tabBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Toggle active panes
                document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                const targetPane = document.getElementById(targetTabId);
                if (targetPane) {
                    targetPane.classList.add('active');
                }

                App.state.activeTab = targetTabId;

                // Trigger specific tab refresh
                if (targetTabId === 'tab-bookings' && window.BookingModule) {
                    window.BookingModule.fetchBookings();
                } else if (targetTabId === 'tab-explore' && window.BookingModule) {
                    window.BookingModule.fetchStations();
                }
            });
        });
    },

    // Telemetry and User Stats
    async fetchStats() {
        try {
            const res = await fetch('/api/stats');
            const data = await res.json();
            if (data.success) {
                App.state.stats = data.stats;
                App.state.currentUser = data.currentUser;
                App.renderStats();
            }
        } catch (err) {
            console.error('Failed fetching stats:', err);
        }
    },

    renderStats() {
        const { stats, currentUser } = App.state;
        if (!stats) return;

        const statStations = document.getElementById('stat-stations');
        const statSlots = document.getElementById('stat-slots');
        const statEnergy = document.getElementById('stat-energy');
        const userName = document.getElementById('user-name-display');
        const userWallet = document.getElementById('user-wallet-balance');
        const modalWallet = document.getElementById('modal-wallet-balance');

        if (statStations) statStations.textContent = stats.totalStations;
        if (statSlots) statSlots.textContent = `${stats.availableSlots}/${stats.totalSlots}`;
        if (statEnergy) statEnergy.textContent = stats.totalKwhDelivered.toFixed(1);

        if (currentUser) {
            if (userName) userName.textContent = currentUser.name;
            const balStr = `₹${currentUser.wallet_balance.toFixed(2)}`;
            if (userWallet) userWallet.textContent = balStr;
            if (modalWallet) modalWallet.textContent = balStr;
            const topupCurrent = document.getElementById('topup-current-balance');
            if (topupCurrent) topupCurrent.textContent = balStr;
        }
    },

    // Wallet Top-Up Modal Handling
    setupWalletModal() {
        const openBtn = document.getElementById('btn-open-wallet-modal');
        const closeBtn = document.getElementById('btn-close-wallet-modal');
        const cancelBtn = document.getElementById('btn-cancel-wallet-modal');
        const submitBtn = document.getElementById('btn-submit-wallet-topup');
        const modal = document.getElementById('wallet-modal');
        const presetBtns = document.querySelectorAll('.preset-btn');
        let selectedAmount = 1000;

        if (openBtn) {
            openBtn.addEventListener('click', () => {
                if (modal) modal.classList.remove('hidden');
                if (App.state.currentUser) {
                    const topupCurrent = document.getElementById('topup-current-balance');
                    if (topupCurrent) topupCurrent.textContent = `₹${App.state.currentUser.wallet_balance.toFixed(2)}`;
                }
            });
        }

        const closeModal = () => {
            if (modal) modal.classList.add('hidden');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (cancelBtn) cancelBtn.addEventListener('click', closeModal);

        presetBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                presetBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedAmount = parseInt(btn.getAttribute('data-amt'), 10) || 1000;
                if (submitBtn) {
                    submitBtn.textContent = `Confirm Top-Up (₹${selectedAmount.toLocaleString('en-IN')})`;
                }
            });
        });

        if (submitBtn) {
            submitBtn.addEventListener('click', async () => {
                try {
                    submitBtn.disabled = true;
                    submitBtn.textContent = 'Processing Recharge...';

                    const res = await fetch('/api/wallet/topup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ amount: selectedAmount })
                    });
                    const data = await res.json();
                    if (data.success) {
                        App.showToast(data.message, 'success');
                        closeModal();
                        await App.fetchStats();
                    } else {
                        App.showToast(data.error || 'Recharge failed', 'error');
                    }
                } catch (e) {
                    App.showToast('Network error during recharge', 'error');
                } finally {
                    submitBtn.disabled = false;
                    submitBtn.textContent = `Confirm Top-Up (₹${selectedAmount.toLocaleString('en-IN')})`;
                }
            });
        }
    },

    // Reset Database Handler
    setupResetButton() {
        const resetBtn = document.getElementById('btn-quick-reset');
        if (!resetBtn) return;

        resetBtn.addEventListener('click', async () => {
            if (!confirm('Reset the database to initial pristine state with seed stations and chargers?')) {
                return;
            }

            try {
                resetBtn.disabled = true;
                resetBtn.textContent = 'Resetting...';

                const res = await fetch('/api/db/reset', { method: 'POST' });
                const data = await res.json();

                if (data.success) {
                    App.showToast('Database reset successfully with fresh seed data.', 'success');
                    App.fetchStats();
                    if (window.BookingModule) {
                        window.BookingModule.fetchStations();
                        window.BookingModule.fetchBookings();
                    }
                } else {
                    App.showToast('Reset failed: ' + data.error, 'error');
                }
            } catch (err) {
                App.showToast('Network error during reset', 'error');
            } finally {
                resetBtn.disabled = false;
                resetBtn.innerHTML = `
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
                    </svg>
                    <span>Reset DB</span>
                `;
            }
        });
    },

    // Toast Notifications
    showToast(message, type = 'info') {
        const container = document.getElementById('toast-container');
        if (!container) return;

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
            <span>${escapeHtml(message)}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateY(10px)';
            setTimeout(() => toast.remove(), 250);
        }, 4000);
    }
};

function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

document.addEventListener('DOMContentLoaded', () => {
    App.init();

    // Global modal dismiss on backdrop click or Escape key
    window.addEventListener('click', (e) => {
        if (e.target.classList.contains('modal-backdrop')) {
            e.target.classList.add('hidden');
        }
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal-backdrop').forEach(modal => {
                modal.classList.add('hidden');
            });
        }
    });
});
