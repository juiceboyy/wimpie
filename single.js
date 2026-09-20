/**
 * single.js - Interactieve logica voor de single landingspagina van Wimpie & de Domino's
 */

function setupLucideIcons() {
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

function setupShareButton() {
    const shareBtn = document.getElementById('share-btn');
    const toast = document.getElementById('toast-feedback');
    if (!shareBtn) return;

    shareBtn.addEventListener('click', async () => {
        const shareData = {
            title: "Wimpie & de Domino's - Het Leven gaat niet altijd over Rozen",
            text: "Luister naar de nieuwe single 'Het Leven gaat niet altijd over Rozen' van Wimpie & de Domino's!",
            url: window.location.href
        };

        if (navigator.share && /mobile|android|iphone|ipad/i.test(navigator.userAgent)) {
            try {
                await navigator.share(shareData);
                return;
            } catch (err) {
                if (err.name !== 'AbortError') {
                    copyToClipboardFallback(window.location.href, toast);
                }
            }
        } else {
            copyToClipboardFallback(window.location.href, toast);
        }
    });
}

function copyToClipboardFallback(url, toast) {
    if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(url).then(() => {
            showToast(toast);
        }).catch(() => {
            legacyCopy(url, toast);
        });
    } else {
        legacyCopy(url, toast);
    }
}

function legacyCopy(text, toast) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        document.execCommand('copy');
        showToast(toast);
    } catch (e) {
        console.error('Kopiëren mislukt', e);
    }
    document.body.removeChild(textArea);
}

function showToast(toast) {
    if (!toast) return;
    toast.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    setTimeout(() => {
        toast.classList.remove('opacity-100', 'translate-y-0');
        toast.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
    }, 3000);
}

function initSinglePage() {
    setupLucideIcons();
    setupShareButton();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSinglePage);
} else {
    initSinglePage();
}
