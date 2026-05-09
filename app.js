const textInput = document.getElementById('textInput');
const startBtn = document.getElementById('startBtn');
const reader = document.getElementById('reader');
const rateInput = document.getElementById('rate');
const rateValue = document.getElementById('rateValue');
const fontInput = document.getElementById('fontSize');
const fontValue = document.getElementById('fontValue');
const themeToggle = document.getElementById('themeToggle');
const dictDialog = document.getElementById('dictDialog');
const dictWord = document.getElementById('dictWord');
const dictMeaning = document.getElementById('dictMeaning');
const dictExample = document.getElementById('dictExample');
const closeDialog = document.getElementById('closeDialog');

let voices = [];
let dictionary = {};
let progressIndex = 0;

const state = {
  rate: Number(localStorage.getItem('reader_rate') || 1),
  fontSize: Number(localStorage.getItem('reader_font') || 20),
  dark: localStorage.getItem('reader_dark') === '1',
};

function loadVoices() {
  voices = speechSynthesis.getVoices();
}
loadVoices();
speechSynthesis.onvoiceschanged = loadVoices;

function pickVoice() {
  return voices.find(v => /en-GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
}

function speak(text) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.rate = state.rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function splitSentences(text) {
  return text.replace(/\s+/g, ' ').trim().match(/[^.!?]+[.!?]?/g) || [];
}

function saveProgress() {
  localStorage.setItem('reader_text', textInput.value);
  localStorage.setItem('reader_index', String(progressIndex));
}

function render(sentences) {
  reader.innerHTML = '';
  sentences.forEach((sentence, index) => {
    const div = document.createElement('div');
    div.className = 'sentence';
    if (index === progressIndex) div.classList.add('active');
    div.dataset.index = String(index);

    const frag = document.createDocumentFragment();
    sentence.split(/(\b[A-Za-z']+\b)/).forEach(part => {
      if (/^[A-Za-z']+$/.test(part)) {
        const span = document.createElement('span');
        span.textContent = part;
        span.className = 'word';
        span.dataset.word = part.toLowerCase();
        frag.appendChild(span);
      } else {
        frag.appendChild(document.createTextNode(part));
      }
    });
    div.appendChild(frag);

    div.addEventListener('click', (e) => {
      const word = e.target.closest('.word');
      if (word) {
        speak(word.dataset.word);
      } else {
        speak(sentence.trim());
        progressIndex = index;
        markActive(index);
        saveProgress();
      }
    });

    let longPressTimer = null;
    div.addEventListener('dblclick', e => {
      const word = e.target.closest('.word');
      if (word) showDictionary(word.dataset.word);
    });
    div.addEventListener('pointerdown', e => {
      const word = e.target.closest('.word');
      if (!word) return;
      longPressTimer = setTimeout(() => showDictionary(word.dataset.word), 500);
    });
    div.addEventListener('pointerup', () => clearTimeout(longPressTimer));
    div.addEventListener('pointerleave', () => clearTimeout(longPressTimer));

    reader.appendChild(div);
  });
}

function markActive(index) {
  [...reader.children].forEach(el => el.classList.remove('active'));
  const active = reader.querySelector(`[data-index="${index}"]`);
  if (active) active.classList.add('active');
}

function showDictionary(word) {
  const entry = dictionary[word];
  dictWord.textContent = word;
  if (entry) {
    dictMeaning.textContent = `语义流动：${entry.semantic_flow}`;
    dictExample.textContent = `结构例句：${entry.structure_example}`;
  } else {
    dictMeaning.textContent = '本地词典暂未收录';
    dictExample.textContent = '';
  }
  dictDialog.showModal();
}

startBtn.addEventListener('click', () => {
  const text = textInput.value.trim();
  if (!text) return;
  progressIndex = 0;
  const sentences = splitSentences(text);
  render(sentences);
  saveProgress();
});

rateInput.value = String(state.rate);
rateValue.textContent = `${state.rate.toFixed(1)}x`;
rateInput.addEventListener('input', () => {
  state.rate = Number(rateInput.value);
  rateValue.textContent = `${state.rate.toFixed(1)}x`;
  localStorage.setItem('reader_rate', String(state.rate));
});

fontInput.value = String(state.fontSize);
fontValue.textContent = `${state.fontSize}px`;
document.documentElement.style.setProperty('--sentence-font', `${state.fontSize}px`);
fontInput.addEventListener('input', () => {
  state.fontSize = Number(fontInput.value);
  fontValue.textContent = `${state.fontSize}px`;
  document.documentElement.style.setProperty('--sentence-font', `${state.fontSize}px`);
  localStorage.setItem('reader_font', String(state.fontSize));
});

if (state.dark) document.body.classList.add('dark');
themeToggle.addEventListener('click', () => {
  document.body.classList.toggle('dark');
  localStorage.setItem('reader_dark', document.body.classList.contains('dark') ? '1' : '0');
});

closeDialog.addEventListener('click', () => dictDialog.close());

(async function init() {
  const res = await fetch('dictionary.json');
  dictionary = await res.json();

  textInput.value = localStorage.getItem('reader_text') || '';
  progressIndex = Number(localStorage.getItem('reader_index') || 0);
  const sentences = splitSentences(textInput.value);
  render(sentences);
  markActive(progressIndex);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js');
  }
})();
