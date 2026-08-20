// Tailwind CSS configuration
tailwind = window.tailwind || {};
tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                heading: ['Fredoka', 'sans-serif'],
                sans: ['Nunito', 'sans-serif'],
            },
            colors: {
                brand: {
                    yellow: '#FEF08A',
                    sun: '#FBBF24',
                    orange: '#FB923C',
                    coral: '#F87171',
                    blue: '#38BDF8',
                    darkblue: '#0284C7',
                    green: '#4ADE80',
                    purple: '#C084FC',
                }
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
        alert('Helaas ondersteunt jouw browser geen voorleesfunctie.');
        isAudioPlaying = false;
        updateTtsButton(false);
        return;
    }

    window.speechSynthesis.cancel();
    const textToRead = "Welkom bij Wimpie en de Domino's! Je bent mooi zoals je bent! Houd jij ook zo van muziek? Kom gezellig zingen, drummen of gitaar spelen bij onze muziekgroep in Amsterdam! Op maandag hebben we de Band en schrijven we eigen liedjes. Op dinsdag hebben we muziekbeleving en ontspanning. Wil je meedoen? Bel ons op 06 28 14 38 15!";

    const utterance = new SpeechSynthesisUtterance(textToRead);
    utterance.lang = 'nl-NL';
    utterance.rate = 0.9;
    utterance.pitch = 1.05;

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
        icon.textContent = '⏹️';
        text.textContent = 'Stop met voorlezen';
        btn.classList.add('bg-rose-100', 'border-rose-300', 'text-rose-900');
    } else {
        icon.textContent = '🔊';
        text.textContent = 'Lees de tekst voor';
        btn.classList.remove('bg-rose-100', 'border-rose-300', 'text-rose-900');
    }
}

function initApp() {
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
