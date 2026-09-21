// Tailwind CSS editorial configuration
tailwind = window.tailwind || {};
tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                serif: ['Fraunces', 'serif'],
                sans: ['"Plus Jakarta Sans"', 'sans-serif'],
                mono: ['"JetBrains Mono"', 'monospace'],
            },
            colors: {
                accent: {
                    DEFAULT: '#C85A32',
                    hover: '#B34E2A',
                    muted: 'rgba(200, 90, 50, 0.15)',
                },
                canvas: '#0C0C0C',
                card: '#141414',
                paper: '#FDFBF7',
            }
        }
    }
};

let audioPlayer = null;
let isAudioPlaying = false;

function toggleReadAloud() {
    if (isAudioPlaying) {
        stopAudio();
        return;
    }

    playAudio();
}

function playAudio() {
    if (!audioPlayer) {
        audioPlayer = new Audio('audio/intro.mp3');
        audioPlayer.addEventListener('ended', () => {
            isAudioPlaying = false;
            updateTtsButton(false);
        });
        audioPlayer.addEventListener('error', () => {
            console.warn('Audiobestand kon niet worden afgespeeld, fallback naar spraaksynthese.');
            playSpeechSynthesisFallback();
        });
    }

    audioPlayer.currentTime = 0;
    audioPlayer.play().then(() => {
        isAudioPlaying = true;
        updateTtsButton(true);
    }).catch(err => {
        console.warn('Direct audio afspelen geblokkeerd of mislukt, fallback:', err);
        playSpeechSynthesisFallback();
    });
}

function stopAudio() {
    if (audioPlayer) {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel();
    }
    isAudioPlaying = false;
    updateTtsButton(false);
}

function playSpeechSynthesisFallback() {
    if (!('speechSynthesis' in window)) {
        alert('Jouw browser ondersteunt helaas geen gesproken spraak.');
        isAudioPlaying = false;
        updateTtsButton(false);
        return;
    }

    window.speechSynthesis.cancel();
    const textToRead = "Welkom bij Wimpie en de Domino's! Je bent mooi zoals je bent. Kom gezellig muziek maken, zingen, drummen of gitaar spelen bij onze muziekgroep in Amsterdam. Op maandag hebben we de Band en schrijven we eigen liedjes. Op dinsdag hebben we muziekbeleving en ontspanning. Wil je meedoen of kennismaken? Bel ons op 06 28 14 38 15!";

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'nl-NL';
    utterance.rate = 0.9;
    utterance.pitch = 1.02;

    utterance.onend = function () {
        isAudioPlaying = false;
        updateTtsButton(false);
    };

    utterance.onerror = function () {
        isAudioPlaying = false;
        updateTtsButton(false);
    };

    window.speechSynthesis.speak(utterance);
    isAudioPlaying = true;
    updateTtsButton(true);
}

function updateTtsButton(speaking) {
    const icon = document.getElementById('tts-icon');
    const text = document.getElementById('tts-text');
    const btn = document.getElementById('tts-btn');
    if (!icon || !text || !btn) return;

    if (speaking) {
        icon.innerHTML = '<i data-lucide="square" class="w-4 h-4 text-white"></i>';
        text.textContent = 'Stop met voorlezen';
        btn.classList.add('bg-accent', 'text-white');
        btn.classList.remove('bg-white/10', 'text-neutral-200');
    } else {
        icon.innerHTML = '<i data-lucide="volume-2" class="w-4 h-4 text-accent"></i>';
        text.textContent = 'Lees voor';
        btn.classList.remove('bg-accent', 'text-white');
        btn.classList.add('bg-white/10', 'text-neutral-200');
    }

    if (typeof lucide !== 'undefined') {
        lucide.createIcons();
    }
}

function initBookingForm() {
    const form = document.getElementById('boekingsformulier');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const submitBtn = document.getElementById('submit-btn');
        const statusDiv = document.getElementById('form-status');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Verzenden...';
        }

        const formData = new FormData(form);
        const action = form.getAttribute('action') || window.location.pathname || '/boeken';
        fetch(action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData).toString()
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Netwerkrespons was niet ok');
                }
                if (statusDiv) {
                    statusDiv.className = 'p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-sm';
                    statusDiv.textContent = 'Bedankt voor uw aanvraag! We hebben uw bericht ontvangen en nemen snel contact met u op.';
                    statusDiv.classList.remove('hidden');
                }
                form.reset();
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Aanvraag Verzonden';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            })
            .catch(function (error) {
                console.error('Formulier fout:', error);
                if (statusDiv) {
                    statusDiv.className = 'p-4 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-sm';
                    statusDiv.textContent = 'Er ging iets mis bij het verzenden. Bel ons gerust op 06-28143815 of mail naar wimpieweg@gmail.com.';
                    statusDiv.classList.remove('hidden');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Probeer Opnieuw';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            });
    });
}

function initContactForm() {
    const form = document.getElementById('contactformulier');
    if (!form) return;

    form.addEventListener('submit', function (e) {
        e.preventDefault();
        const submitBtn = document.getElementById('contact-submit-btn');
        const statusDiv = document.getElementById('contact-status');

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = 'Verzenden...';
        }

        const formData = new FormData(form);
        const action = form.getAttribute('action') || window.location.pathname || '/contact';
        fetch(action, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(formData).toString()
        })
            .then(function (response) {
                if (!response.ok) {
                    throw new Error('Netwerkrespons was niet ok');
                }
                if (statusDiv) {
                    statusDiv.className = 'p-4 rounded-xl bg-emerald-950/60 border border-emerald-500/30 text-emerald-300 text-sm';
                    statusDiv.textContent = 'Bedankt voor uw bericht! We hebben uw aanvraag ontvangen en nemen snel contact met u op.';
                    statusDiv.classList.remove('hidden');
                }
                form.reset();
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i data-lucide="check" class="w-4 h-4"></i> Bericht Verzonden';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            })
            .catch(function (error) {
                console.error('Contactformulier fout:', error);
                if (statusDiv) {
                    statusDiv.className = 'p-4 rounded-xl bg-rose-950/60 border border-rose-500/30 text-rose-300 text-sm';
                    statusDiv.textContent = 'Er ging iets mis bij het verzenden. Bel ons gerust op 06-28143815 of mail naar wimpieweg@gmail.com.';
                    statusDiv.classList.remove('hidden');
                }
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = '<i data-lucide="send" class="w-4 h-4"></i> Probeer Opnieuw';
                    if (typeof lucide !== 'undefined') lucide.createIcons();
                }
            });
    });
}

function initApp() {
    initBookingForm();
    initContactForm();

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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
} else {
    initApp();
}
