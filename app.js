const textInput = document.getElementById('textInput');
const pasteView = document.getElementById('pasteView');
const reader = document.getElementById('reader');
const rateInput = document.getElementById('rate');
const rateValue = document.getElementById('rateValue');
const fontInput = document.getElementById('fontSize');
const fontValue = document.getElementById('fontValue');
const themeToggle = document.getElementById('themeToggle');
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const closeSettings = document.getElementById('closeSettings');
const clearText = document.getElementById('clearText');
const focusPaste = document.getElementById('focusPaste');
const voiceSelect = document.getElementById('voiceSelect');
const voiceName = document.getElementById('voiceName');
const reloadVoices = document.getElementById('reloadVoices');
const dictStatus = document.getElementById('dictStatus');
const dictDialog = document.getElementById('dictDialog');
const dictWord = document.getElementById('dictWord');
const dictPhonetic = document.getElementById('dictPhonetic');
const dictMeaning = document.getElementById('dictMeaning');
const youdaoLink = document.getElementById('youdaoLink');
const closeDialog = document.getElementById('closeDialog');

let voices = [];
let dictionary = {};
let sentences = [];
let progressIndex = Number(localStorage.getItem('reader_index') || 0);
let longPressTimer = null;

const state = {
  rate: Number(localStorage.getItem('reader_rate') || 1),
  fontSize: Number(localStorage.getItem('reader_font') || 22),
  theme: localStorage.getItem('reader_theme') || 'dark',
  voiceName: localStorage.getItem('reader_voice') || '',
};

function applySettings() {
  document.body.classList.toggle('light', state.theme === 'light');
  document.body.classList.toggle('dark', state.theme !== 'light');
  document.documentElement.style.setProperty('--sentence-font', `${state.fontSize}px`);
  rateInput.value = String(state.rate);
  rateValue.textContent = `${state.rate.toFixed(1)}x`;
  fontInput.value = String(state.fontSize);
  fontValue.textContent = `${state.fontSize}px`;
  themeToggle.textContent = state.theme === 'light' ? '切换深色' : '切换浅色';
}

function loadVoices() {
  voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang));
  voiceSelect.innerHTML = '';
  voices.forEach((v, i) => {
    const option = document.createElement('option');
    option.value = v.name;
    option.textContent = `${v.name} (${v.lang})`;
    voiceSelect.appendChild(option);
    if ((state.voiceName && v.name === state.voiceName) || (!state.voiceName && i === 0)) option.selected = true;
  });
  updateVoiceName();
}

function pickVoice() {
  return voices.find(v => v.name === state.voiceName) || voices.find(v => /en-GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
}

function updateVoiceName() {
  const voice = pickVoice();
  voiceName.textContent = voice ? `${voice.name} (${voice.lang})` : '浏览器默认语音';
  if (voice) voiceSelect.value = voice.name;
}

function speak(text) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) u.voice = voice;
  u.lang = voice?.lang || 'en-GB';
  u.rate = state.rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(u);
}

function splitSentences(text) {
  const protectedText = text
    .replace(/\b(Mr|Mrs|Ms|Dr|Prof)\./g, '$1<dot>')
    .replace(/\b(e\.g|i\.e)\./gi, m => m.replace(/\./g, '<dot>'))
    .replace(/\b(U\.S|U\.K)\./g, m => m.replace(/\./g, '<dot>'));
  const parts = protectedText.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [];
  return parts.map(s => s.replace(/<dot>/g, '.').trim()).filter(Boolean);
}

function normalizeWord(word) {
  return word.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, '');
}

function candidatesFor(word) {
  const w = normalizeWord(word);
  const set = new Set([w]);
  if (w.endsWith('ied')) set.add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ies')) set.add(`${w.slice(0, -3)}y`);
  if (w.endsWith('ed')) {
    set.add(w.slice(0, -2));
    set.add(w.slice(0, -1));
  }
  if (w.endsWith('s') && w.length > 3) set.add(w.slice(0, -1));
  return [...set].filter(Boolean);
}

function lookupWord(word) {
  for (const c of candidatesFor(word)) {
    if (dictionary[c]) return { key: c, entry: dictionary[c] };
  }
  return null;
}

function queryYoudao(word) {
  // TODO: future backend/proxy integration. Do not place API keys in frontend code.
  return `https://dict.youdao.com/result?word=${encodeURIComponent(word)}&lang=en`;
}

function saveState() {
  localStorage.setItem('reader_text', textInput.value);
  localStorage.setItem('reader_index', String(progressIndex));
}

function render() {
  reader.innerHTML = '';
  sentences.forEach((sentence, index) => {
    const div = document.createElement('div');
    div.className = 'sentence';
    div.dataset.index = String(index);
    if (index === progressIndex) div.classList.add('active');

    sentence.split(/(\b[A-Za-z']+\b)/).forEach(part => {
      if (/^[A-Za-z']+$/.test(part)) {
        const span = document.createElement('span');
        span.textContent = part;
        span.className = 'word';
        span.dataset.word = part;
        div.appendChild(span);
      } else {
        div.appendChild(document.createTextNode(part));
      }
    });

    div.addEventListener('click', e => {
      const word = e.target.closest('.word');
      if (word) {
        speak(word.dataset.word);
        return;
      }
      progressIndex = index;
      markActive(index);
      speak(sentence.trim());
      saveState();
    });

    div.addEventListener('dblclick', e => {
      const word = e.target.closest('.word');
      if (word) showDictionary(word.dataset.word);
    });
    div.addEventListener('touchstart', e => {
      const word = e.target.closest('.word');
      if (!word) return;
      longPressTimer = setTimeout(() => showDictionary(word.dataset.word), 520);
    }, { passive: true });
    div.addEventListener('touchend', () => clearTimeout(longPressTimer));
    div.addEventListener('touchmove', () => clearTimeout(longPressTimer));
    div.addEventListener('touchcancel', () => clearTimeout(longPressTimer));

    reader.appendChild(div);
  });
  pasteView.style.display = sentences.length ? 'none' : 'flex';
}

function markActive(index) {
  [...reader.children].forEach(el => el.classList.remove('active'));
  const active = reader.querySelector(`[data-index="${index}"]`);
  if (active) {
    active.classList.add('active');
    active.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

function processText(text) {
  sentences = splitSentences(text);
  progressIndex = Math.min(progressIndex, Math.max(0, sentences.length - 1));
  render();
  saveState();
}

function showDictionary(rawWord) {
  const word = normalizeWord(rawWord);
  const found = lookupWord(word);
  dictWord.textContent = word;
  if (found) {
    dictPhonetic.textContent = found.entry.phonetic ? `/${found.entry.phonetic}/` : '';
    dictMeaning.textContent = found.entry.translation || found.entry.semantic_flow || '本地词典有词条，但暂无中文义项';
  } else {
    dictPhonetic.textContent = '';
    dictMeaning.textContent = '本地词典暂未收录';
  }
  youdaoLink.href = queryYoudao(word);
  dictDialog.showModal();
}

textInput.addEventListener('input', () => {
  const text = textInput.value.trim();
  localStorage.setItem('reader_text', textInput.value);
  if (text.length > 0) {
    progressIndex = 0;
    processText(text);
  }
});

textInput.addEventListener('paste', () => {
  setTimeout(() => {
    const text = textInput.value.trim();
    if (text) {
      progressIndex = 0;
      processText(text);
    }
  }, 0);
});

settingsToggle.addEventListener('click', () => settingsPanel.classList.add('open'));
closeSettings.addEventListener('click', () => settingsPanel.classList.remove('open'));
settingsPanel.addEventListener('click', e => { if (e.target === settingsPanel) settingsPanel.classList.remove('open'); });

rateInput.addEventListener('input', () => {
  state.rate = Number(rateInput.value);
  localStorage.setItem('reader_rate', String(state.rate));
  applySettings();
});

fontInput.addEventListener('input', () => {
  state.fontSize = Number(fontInput.value);
  localStorage.setItem('reader_font', String(state.fontSize));
  applySettings();
});

themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'light' ? 'dark' : 'light';
  localStorage.setItem('reader_theme', state.theme);
  applySettings();
});

voiceSelect.addEventListener('change', () => {
  state.voiceName = voiceSelect.value;
  localStorage.setItem('reader_voice', state.voiceName);
  updateVoiceName();
});
reloadVoices.addEventListener('click', loadVoices);

clearText.addEventListener('click', () => {
  speechSynthesis.cancel();
  textInput.value = '';
  sentences = [];
  progressIndex = 0;
  localStorage.removeItem('reader_text');
  localStorage.removeItem('reader_index');
  render();
  settingsPanel.classList.remove('open');
  textInput.focus();
});

focusPaste.addEventListener('click', () => {
  sentences = [];
  reader.innerHTML = '';
  pasteView.style.display = 'flex';
  settingsPanel.classList.remove('open');
  textInput.focus();
});

closeDialog.addEventListener('click', () => dictDialog.close());

(async function init() {
  applySettings();
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
  setTimeout(loadVoices, 500);
  try {
    const res = await fetch(`dictionary.json?v=2`);
    dictionary = await res.json();
    dictStatus.textContent = `本地词典已加载：${Object.keys(dictionary).length} 条`;
  } catch (e) {
    dictStatus.textContent = '本地词典加载失败';
  }
  textInput.value = localStorage.getItem('reader_text') || '';
  const text = textInput.value.trim();
  if (text) processText(text);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js');
})();
