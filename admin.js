/**
 * admin.js - Hoofdcontroller voor het Wimpie & de Domino's Beheerders Dashboard
 */

window.adminApp = (function () {
    const PIN_STORAGE_KEY = 'wimpie_admin_pin';
    let currentPin = '';
    let isSaving = false;

    function refreshIcons() {
        if (typeof lucide !== 'undefined') {
            lucide.createIcons();
        } else {
            const interval = setInterval(() => {
                if (typeof lucide !== 'undefined') {
                    clearInterval(interval);
                    lucide.createIcons();
                }
            }, 100);
            setTimeout(() => clearInterval(interval), 10000);
        }
    }

    function showToast(message, type = 'success') {
        const toast = document.getElementById('admin-toast');
        const textEl = document.getElementById('admin-toast-text');
        const iconEl = document.getElementById('admin-toast-icon');
        if (!toast || !textEl) return;

        textEl.textContent = message;
        if (type === 'error') {
            toast.className = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-red-950/90 text-red-200 shadow-[0_0_0_1px_rgba(248,113,113,0.3)] backdrop-blur-md transition-all duration-300 opacity-100 translate-y-0';
            if (iconEl) iconEl.innerHTML = '<i data-lucide="alert-circle" class="w-4 h-4 text-red-400"></i>';
        } else {
            toast.className = 'fixed bottom-6 right-6 z-50 flex items-center gap-3 px-5 py-3 rounded-2xl bg-neutral-900/90 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.15)] backdrop-blur-md transition-all duration-300 opacity-100 translate-y-0';
            if (iconEl) iconEl.innerHTML = '<i data-lucide="check" class="w-4 h-4 text-[#C85A32]"></i>';
        }
        refreshIcons();

        setTimeout(() => {
            toast.classList.remove('opacity-100', 'translate-y-0');
            toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
        }, 4000);
    }

    function switchTab(tabName) {
        const btnReleases = document.getElementById('tab-btn-releases');
        const btnPodcasts = document.getElementById('tab-btn-podcasts');
        const secReleases = document.getElementById('tab-releases');
        const secPodcasts = document.getElementById('tab-podcasts');

        if (!btnReleases || !btnPodcasts || !secReleases || !secPodcasts) return;

        if (tabName === 'podcasts') {
            btnPodcasts.className = 'h-9 px-4 rounded-full bg-[#C85A32] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition';
            btnReleases.className = 'h-9 px-4 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition';
            secPodcasts.classList.remove('hidden');
            secReleases.classList.add('hidden');
        } else {
            btnReleases.className = 'h-9 px-4 rounded-full bg-[#C85A32] text-white text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-[0_0_0_1px_rgba(200,90,50,0.5)] transition';
            btnPodcasts.className = 'h-9 px-4 rounded-full bg-white/5 hover:bg-white/10 text-neutral-300 text-xs font-mono uppercase tracking-wider flex items-center gap-2 shadow-[0_0_0_1px_rgba(255,255,255,0.08)] transition';
            secReleases.classList.remove('hidden');
            secPodcasts.classList.add('hidden');
        }
        refreshIcons();
    }

    async function apiRequest(endpoint, options = {}) {
        const headers = options.headers || {};
        headers['Content-Type'] = 'application/json';
        if (currentPin) {
            headers['x-admin-pin'] = currentPin;
        }
        return await fetch(endpoint, {
            ...options,
            headers
        });
    }

    async function loadData() {
        try {
            const res = await apiRequest('/api/admin-api?action=get');
            if (res.status === 401) {
                showAuthModal();
                return;
            }
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || 'Fout bij ophalen data.');
            }
            const data = await res.json();
            if (window.adminReleases) window.adminReleases.init(data.releases);
            if (window.adminPodcasts) window.adminPodcasts.init(data.podcasts);
            hideAuthModal();
        } catch (err) {
            showToast(err.message, 'error');
        }
    }

    async function saveData(target, data) {
        if (isSaving) return false;
        isSaving = true;
        const statusBadge = document.getElementById('global-sync-status');
        if (statusBadge) statusBadge.textContent = 'Opslaan...';

        try {
            const res = await apiRequest('/api/admin-api', {
                method: 'POST',
                body: JSON.stringify({
                    action: 'save',
                    target,
                    data
                })
            });

            const result = await res.json();
            if (!res.ok) {
                throw new Error(result.error || 'Opslaan mislukt.');
            }

            if (result.mode === 'github') {
                showToast('Succesvol gepubliceerd via GitHub! Netlify bouwt de site...', 'success');
            } else {
                showToast(result.message || 'Succesvol opgeslagen.', 'success');
            }

            if (statusBadge) statusBadge.textContent = 'Opgeslagen';
            return true;
        } catch (err) {
            showToast(err.message, 'error');
            if (statusBadge) statusBadge.textContent = 'Fout bij opslaan';
            return false;
        } finally {
            isSaving = false;
        }
    }

    function showAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) {
            modal.classList.remove('hidden');
            const input = document.getElementById('auth-pin-input');
            if (input) setTimeout(() => input.focus(), 100);
        }
    }

    function hideAuthModal() {
        const modal = document.getElementById('auth-modal');
        if (modal) modal.classList.add('hidden');
    }

    async function handleAuthSubmit(e) {
        e.preventDefault();
        const pinInput = document.getElementById('auth-pin-input');
        const errEl = document.getElementById('auth-error-msg');
        const pin = pinInput?.value.trim() || '';

        if (!pin) {
            if (errEl) errEl.textContent = 'Voer een pincode in.';
            return;
        }

        try {
            const res = await fetch('/api/admin-api', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'verify', pin })
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || 'Onjuiste pincode.');
            }

            currentPin = pin;
            sessionStorage.setItem(PIN_STORAGE_KEY, pin);
            if (errEl) errEl.textContent = '';
            hideAuthModal();
            loadData();
            showToast('Ingelogd op Beheerders Dashboard', 'success');
        } catch (err) {
            if (errEl) errEl.textContent = err.message;
        }
    }

    function logout() {
        sessionStorage.removeItem(PIN_STORAGE_KEY);
        currentPin = '';
        showAuthModal();
    }

    function exportBackup() {
        const relData = window.adminReleases ? window.adminReleases.getData() : {};
        const podData = window.adminPodcasts ? window.adminPodcasts.getData() : {};
        const backup = {
            exportedAt: new Date().toISOString(),
            releases: relData,
            podcasts: podData
        };

        const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `wimpie-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('JSON backup gedownload', 'success');
    }

    function init() {
        refreshIcons();

        const authForm = document.getElementById('auth-form');
        if (authForm) authForm.addEventListener('submit', handleAuthSubmit);

        const logoutBtn = document.getElementById('admin-logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', logout);

        const tabReleases = document.getElementById('tab-btn-releases');
        if (tabReleases) tabReleases.addEventListener('click', () => switchTab('releases'));

        const tabPodcasts = document.getElementById('tab-btn-podcasts');
        if (tabPodcasts) tabPodcasts.addEventListener('click', () => switchTab('podcasts'));

        const exportBtn = document.getElementById('admin-export-btn');
        if (exportBtn) exportBtn.addEventListener('click', exportBackup);

        const savedPin = sessionStorage.getItem(PIN_STORAGE_KEY);
        if (savedPin) {
            currentPin = savedPin;
            loadData();
        } else {
            showAuthModal();
        }
    }

    return {
        init,
        refreshIcons,
        saveData,
        showToast,
        switchTab
    };
})();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.adminApp.init);
} else {
    window.adminApp.init();
}
