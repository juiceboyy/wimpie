/**
 * Wimpie & de Domino's - QR Kaart Landing Page Companion Script
 * Handles native web share, clipboard fallback, and Netlify AJAX newsletter form submission.
 */

function initKaart() {
  // Initialize Lucide icons if available (with polling guard)
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    lucide.createIcons();
  } else {
    const iconInterval = setInterval(() => {
      if (typeof lucide !== 'undefined' && lucide.createIcons) {
        clearInterval(iconInterval);
        lucide.createIcons();
      }
    }, 100);
    setTimeout(() => clearInterval(iconInterval), 10000);
  }

  // Toast notification element
  const toast = document.getElementById('toast-feedback');
  let toastTimer = null;

  function showToast(message = 'Link gekopieerd naar klembord') {
    if (!toast) return;

    const toastText = document.getElementById('toast-message-text');
    if (toastText) {
      toastText.textContent = message;
    }

    if (toastTimer) {
      clearTimeout(toastTimer);
    }

    toast.classList.remove('opacity-0', 'translate-y-2', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    toastTimer = setTimeout(() => {
      toast.classList.remove('opacity-100', 'translate-y-0');
      toast.classList.add('opacity-0', 'translate-y-2', 'pointer-events-none');
    }, 2800);
  }

  // Native share & clipboard fallback
  const shareBtn = document.getElementById('share-btn');
  if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
      const shareData = {
        title: "Wimpie & de Domino's - Fotokaart",
        text: "Wimpie & de Domino's | Muziek voor en door iedereen",
        url: window.location.href,
      };

      if (navigator.share && navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
        } catch (err) {
          if (err.name !== 'AbortError') {
            copyToClipboard();
          }
        }
      } else {
        copyToClipboard();
      }
    });
  }

  function copyToClipboard() {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(window.location.href)
        .then(() => {
          showToast('Link gekopieerd naar klembord');
        })
        .catch(() => {
          fallbackCopyText(window.location.href);
        });
    } else {
      fallbackCopyText(window.location.href);
    }
  }

  function fallbackCopyText(text) {
    const tempInput = document.createElement('input');
    tempInput.value = text;
    tempInput.setAttribute('readonly', '');
    tempInput.style.position = 'absolute';
    tempInput.style.left = '-9999px';
    document.body.appendChild(tempInput);
    tempInput.select();
    try {
      document.execCommand('copy');
      showToast('Link gekopieerd naar klembord');
    } catch {
      showToast('Kopiëren niet gelukt');
    }
    document.body.removeChild(tempInput);
  }

  // Newsletter Form AJAX Handling (Netlify Forms compatible)
  const form = document.getElementById('newsletter-form');
  const statusDiv = document.getElementById('newsletter-status');
  const submitBtn = document.getElementById('newsletter-submit-btn');

  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.classList.add('opacity-75', 'cursor-not-allowed');
        submitBtn.innerHTML = `
          <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          Bezig met aanmelden...
        `;
      }

      if (statusDiv) {
        statusDiv.className = 'hidden p-3 rounded-xl text-xs font-medium';
        statusDiv.textContent = '';
      }

      const formData = new FormData(form);
      const urlSearchParams = new URLSearchParams(formData);

      try {
        const response = await fetch('/kaart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: urlSearchParams.toString(),
        });

        if (response.ok) {
          form.reset();
          if (statusDiv) {
            statusDiv.className = 'p-3 rounded-xl text-xs font-medium bg-emerald-500/15 text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.3)] block';
            statusDiv.textContent = 'Bedankt! Je bent succesvol aangemeld voor onze nieuwsbrief.';
          }
          if (submitBtn) {
            submitBtn.innerHTML = `
              <i data-lucide="check" class="w-3.5 h-3.5 inline-block mr-1"></i>
              Aangemeld!
            `;
            if (typeof lucide !== 'undefined' && lucide.createIcons) {
              lucide.createIcons();
            }
          }
          showToast('Aanmelding ontvangen!');
        } else {
          throw new Error('Verzenden mislukt');
        }
      } catch (err) {
        if (statusDiv) {
          statusDiv.className = 'p-3 rounded-xl text-xs font-medium bg-red-500/15 text-red-300 shadow-[0_0_0_1px_rgba(239,68,68,0.3)] block';
          statusDiv.textContent = 'Er ging iets mis bij het aanmelden. Probeer het later opnieuw of mail ons direct.';
        }
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.classList.remove('opacity-75', 'cursor-not-allowed');
          submitBtn.innerHTML = `
            <i data-lucide="send" class="w-3.5 h-3.5 inline-block mr-1"></i>
            Opnieuw proberen
          `;
          if (typeof lucide !== 'undefined' && lucide.createIcons) {
            lucide.createIcons();
          }
        }
      }
    });
  }
}

// DOMContentLoaded state guard according to user global guidelines
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initKaart);
} else {
  initKaart();
}
