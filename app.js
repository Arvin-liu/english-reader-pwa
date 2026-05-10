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
const closeSettingsBottom = document.getElementById('closeSettingsBottom');
const clearText = document.getElementById('clearText');
const focusPaste = document.getElementById('focusPaste');
const clearCacheAndReload = document.getElementById('clearCacheAndReload');
const voiceSelect = document.getElementById('voiceSelect');
const voiceName = document.getElementById('voiceName');
const reloadVoices = document.getElementById('reloadVoices');
const previewVoice = document.getElementById('previewVoice');
const ttsMode = document.getElementById('ttsMode');
const ttsProxyUrl = document.getElementById('ttsProxyUrl');
const saveTtsProxy = document.getElementById('saveTtsProxy');
const testTtsProxy = document.getElementById('testTtsProxy');
const externalTtsStatus = document.getElementById('externalTtsStatus');
const audioCacheCount = document.getElementById('audioCacheCount');
const clearAudioCache = document.getElementById('clearAudioCache');
const dictStatus = document.getElementById('dictStatus');
const dictDialog = document.getElementById('dictDialog');
const dictWord = document.getElementById('dictWord');
const dictPhonetic = document.getElementById('dictPhonetic');
const dictMeaning = document.getElementById('dictMeaning');
const youdaoLink = document.getElementById('youdaoLink');
const closeDialog = document.getElementById('closeDialog');

const VOICE_PREVIEW_TEXT = 'This is a voice preview.';
const EXTERNAL_TEST_TEXT = 'This is a British English voice preview.';
const AUDIO_CACHE_NAME = 'tts-audio-v1';

let voices = [];
let dictionary = {};
let readingUnits = [];
let progressIndex = Number(localStorage.getItem('reader_index') || 0);
let clickTimer = null;
let longPressTimer = null;
let longPressHandled = false;
let externalTtsState = '未配置';

const state = {
  rate: Number(localStorage.getItem('reader_rate') || 1),
  fontSize: Number(localStorage.getItem('reader_font') || 22),
  theme: localStorage.getItem('reader_theme') || 'dark',
  voiceName: localStorage.getItem('reader_voice') || '',
  ttsMode: localStorage.getItem('reader_tts_mode') || 'external',
  ttsProxyUrl: localStorage.getItem('reader_tts_proxy_url') || '',
};

function hashText(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return (hash >>> 0).toString(16);
}

function applySettings() {
  document.body.classList.toggle('light', state.theme === 'light');
  document.body.classList.toggle('dark', state.theme !== 'light');
  document.documentElement.style.setProperty('--sentence-font', `${state.fontSize}px`);
  rateInput.value = String(state.rate);
  rateValue.textContent = `${state.rate.toFixed(1)}x`;
  fontInput.value = String(state.fontSize);
  fontValue.textContent = `${state.fontSize}px`;
  themeToggle.textContent = state.theme === 'light' ? '切换深色' : '切换浅色';
  ttsMode.value = state.ttsMode;
  ttsProxyUrl.value = state.ttsProxyUrl;
}

function isEnglishVoice(voice) { return /^en/i.test(voice.lang || ''); }
function scoreVoice(voice) {
  let score = 0;
  if (voice.localService === false) score += 50;
  if (/^en-GB/i.test(voice.lang || '')) score += 40;
  if (/siri|google|microsoft|natural|neural/i.test(voice.name || '')) score += 25;
  if (/^en-US/i.test(voice.lang || '')) score += 15;
  if (/^en/i.test(voice.lang || '')) score += 10;
  return score;
}
function sortVoices(list) {
  return [...list].sort((a, b) => scoreVoice(b) - scoreVoice(a) || `${a.name}${a.lang}`.localeCompare(`${b.name}${b.lang}`));
}
function pickVoice() {
  return voices.find(v => v.name === state.voiceName)
    || voices.find(v => /^en-GB/i.test(v.lang || ''))
    || voices[0]
    || speechSynthesis.getVoices()[0]
    || null;
}
function updateVoiceName() {
  const voice = pickVoice();
  voiceName.textContent = voice ? `${voice.name} (${voice.lang || 'unknown'})` : '浏览器默认语音';
  if (voice) voiceSelect.value = voice.name;
}
function populateVoiceSelect() {
  voiceSelect.innerHTML = '';
  voices.forEach((voice) => {
    const option = document.createElement('option');
    option.value = voice.name;
    const serviceTag = typeof voice.localService === 'boolean' ? (voice.localService ? 'local' : 'remote') : 'unknown';
    option.textContent = `${voice.name} (${voice.lang || 'unknown'}) · ${serviceTag}`;
    voiceSelect.appendChild(option);
  });
}
function loadVoices() {
  voices = sortVoices(speechSynthesis.getVoices().filter(isEnglishVoice));
  populateVoiceSelect();
  updateVoiceName();
}

function speakWithBrowser(text) {
  if (!text) return;
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = pickVoice();
  if (voice) utterance.voice = voice;
  utterance.lang = voice?.lang || 'en-GB';
  utterance.rate = state.rate;
  speechSynthesis.cancel();
  speechSynthesis.speak(utterance);
}

async function getAudioCacheKey(text, type) {
  return `tts-audio-v1/${type}/${hashText(text)}`;
}

async function getCachedAudioBlob(text, type) {
  const cache = await caches.open(AUDIO_CACHE_NAME);
  const key = await getAudioCacheKey(text, type);
  const response = await cache.match(new Request(key));
  return response ? response.blob() : null;
}

async function saveAudioBlob(text, type, blob) {
  const cache = await caches.open(AUDIO_CACHE_NAME);
  const key = await getAudioCacheKey(text, type);
  await cache.put(new Request(key), new Response(blob, { headers: { 'Content-Type': 'audio/mpeg' } }));
}

async function playAudioBlob(blob) {
  speechSynthesis.cancel();
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  await audio.play();
  audio.onended = () => URL.revokeObjectURL(url);
}

async function updateAudioCacheCount() {
  try {
    const cache = await caches.open(AUDIO_CACHE_NAME);
    const keys = await cache.keys();
    audioCacheCount.textContent = String(keys.length);
  } catch {
    audioCacheCount.textContent = '0';
  }
}

function renderExternalStatus() {
  externalTtsStatus.textContent = externalTtsState;
}

async function speakWithBestVoice(text, { type = 'sentence' } = {}) {
  if (!text) return;
  const canUseExternal = state.ttsMode === 'external' && state.ttsProxyUrl;
  if (!canUseExternal) {
    externalTtsState = state.ttsProxyUrl ? '失败' : '未配置';
    renderExternalStatus();
    speakWithBrowser(text);
    return;
  }

  try {
    const cachedBlob = await getCachedAudioBlob(text, type);
    if (cachedBlob) {
      externalTtsState = '可用';
      renderExternalStatus();
      await playAudioBlob(cachedBlob);
      return;
    }

    const response = await fetch(state.ttsProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, voice: 'british', type }),
    });

    if (!response.ok) throw new Error(`TTS proxy failed: ${response.status}`);
    const contentType = response.headers.get('content-type') || '';
    if (!/audio\/(mpeg|mp3)/i.test(contentType)) throw new Error(`Unexpected content type: ${contentType}`);
    const blob = await response.blob();
    await saveAudioBlob(text, type, blob);
    await updateAudioCacheCount();
    externalTtsState = '可用';
    renderExternalStatus();
    await playAudioBlob(blob);
  } catch (err) {
    console.warn('external TTS failed, fallback to browser TTS', err);
    externalTtsState = '失败';
    renderExternalStatus();
    speakWithBrowser(text);
  }
}

function previewCurrentVoice() { speakWithBestVoice(VOICE_PREVIEW_TEXT, { type: 'sentence' }); }
// ... keep rest largely same
function splitReadingUnits(line) { const text = line || ''; const strong = new Set(['.', '?', '!', '。', '？', '！']); const weak = new Set([',', '，', ';', '；']); const chunks = []; let buffer = ''; function pushBuffer() { const part = buffer.trim(); if (part) chunks.push(part); buffer = ''; } for (let i = 0; i < text.length; i += 1) { const ch = text[i]; buffer += ch; if (strong.has(ch)) { const prev = text[i - 1] || ''; const next = text[i + 1] || ''; const isNumberingDot = ch === '.' && /\d/.test(prev) && (next === ' ' || next === '\t'); if (!isNumberingDot) pushBuffer(); continue; } if (weak.has(ch)) { const current = buffer.trim(); if (current.length >= 36) pushBuffer(); } } if (buffer.trim()) chunks.push(buffer.trim()); const units = []; chunks.forEach(chunk => { if (chunk.length <= 180) { units.push(chunk); return; } const pieces = chunk.split(/([,，;；])/); let longBuffer = ''; pieces.forEach(piece => { if (!piece) return; const next = longBuffer + piece; if (next.trim().length > 180 && longBuffer.trim()) { units.push(longBuffer.trim()); longBuffer = piece; } else { longBuffer = next; } }); if (longBuffer.trim()) units.push(longBuffer.trim()); }); return units.filter(Boolean); }
function normalizeWord(word) { return word.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g, ''); }
function candidatesFor(word) { const w = normalizeWord(word); const set = new Set([w]); if (w.endsWith('ied')) set.add(`${w.slice(0, -3)}y`); if (w.endsWith('ies')) set.add(`${w.slice(0, -3)}y`); if (w.endsWith('ed')) { set.add(w.slice(0, -2)); set.add(w.slice(0, -1)); } if (w.endsWith('s') && w.length > 3) set.add(w.slice(0, -1)); return [...set].filter(Boolean); }
function lookupWord(word) { for (const c of candidatesFor(word)) if (dictionary[c]) return { key: c, entry: dictionary[c] }; return null; }
function queryYoudao(word) { return `https://dict.youdao.com/result?word=${encodeURIComponent(word)}&lang=en`; }
function saveState() { localStorage.setItem('reader_text', textInput.value); localStorage.setItem('reader_index', String(progressIndex)); }
function render() { reader.innerHTML = ''; const text = textInput.value.replace(/\r\n/g, '\n'); const paragraphs = text.split(/\n{2,}/); let unitIndex = 0; paragraphs.forEach(paragraphText => { const paragraph = document.createElement('p'); paragraph.className = 'reader-paragraph'; const lines = paragraphText.split('\n'); lines.forEach((line, lineIndex) => { if (!line.trim()) return; const units = splitReadingUnits(line); units.forEach(unit => { const unitSpan = document.createElement('span'); unitSpan.className = 'reading-unit'; unitSpan.dataset.index = String(unitIndex); if (unitIndex === progressIndex) unitSpan.classList.add('active'); readingUnits[unitIndex] = unit; const parts = unit.split(/([A-Za-z]+(?:'[A-Za-z]+)?)/g); parts.forEach(part => { if (/^[A-Za-z]+(?:'[A-Za-z]+)?$/.test(part)) { const word = document.createElement('span'); word.textContent = part; word.className = 'word english-text'; word.dataset.word = part; unitSpan.appendChild(word); } else { unitSpan.appendChild(document.createTextNode(part)); } }); paragraph.appendChild(unitSpan); paragraph.appendChild(document.createTextNode(' ')); unitIndex += 1; }); if (lineIndex < lines.length - 1) paragraph.appendChild(document.createElement('br')); }); reader.appendChild(paragraph); }); pasteView.style.display = readingUnits.length ? 'none' : 'flex'; }
function markActive(index) { [...reader.querySelectorAll('.reading-unit.active')].forEach(el => el.classList.remove('active')); const active = reader.querySelector(`[data-index="${index}"]`); if (active) { active.classList.add('active'); active.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); } }
function speakReadingUnit(unit) { if (!unit) return; progressIndex = Number(unit.dataset.index); markActive(progressIndex); speakWithBestVoice(readingUnits[progressIndex], { type: 'sentence' }); saveState(); }
function processText() { readingUnits = []; render(); progressIndex = Math.min(progressIndex, Math.max(0, readingUnits.length - 1)); markActive(progressIndex); saveState(); }
reader.addEventListener('click', e => { if (longPressHandled) { longPressHandled = false; return; } if (clickTimer) clearTimeout(clickTimer); const targetUnit = e.target.closest('.reading-unit'); if (!targetUnit) return; clickTimer = setTimeout(() => { speakReadingUnit(targetUnit); }, 220); });
reader.addEventListener('dblclick', e => { const word = e.target.closest('.word'); if (!word) return; e.preventDefault(); e.stopPropagation(); if (clickTimer) clearTimeout(clickTimer); speakWithBestVoice(word.dataset.word, { type: 'word' }); showDictionary(word.dataset.word); });
reader.addEventListener('pointerdown', e => { const word = e.target.closest('.word'); if (!word) return; longPressHandled = false; longPressTimer = setTimeout(() => { longPressHandled = true; speakWithBestVoice(word.dataset.word, { type: 'word' }); showDictionary(word.dataset.word); }, 500); });
reader.addEventListener('pointerup', () => { if (longPressTimer) clearTimeout(longPressTimer); });
reader.addEventListener('pointercancel', () => { if (longPressTimer) clearTimeout(longPressTimer); });
reader.addEventListener('pointerleave', () => { if (longPressTimer) clearTimeout(longPressTimer); });
function showDictionary(rawWord) { const word = normalizeWord(rawWord); const found = lookupWord(word); dictWord.textContent = word; if (found) { dictPhonetic.textContent = found.entry.phonetic ? `/${found.entry.phonetic}/` : ''; dictMeaning.textContent = found.entry.translation || found.entry.semantic_flow || '本地词典有词条，但暂无中文义项'; } else { dictPhonetic.textContent = ''; dictMeaning.textContent = '本地词典暂未收录'; } youdaoLink.href = queryYoudao(word); dictDialog.showModal(); }
textInput.addEventListener('input', () => { const text = textInput.value.trim(); localStorage.setItem('reader_text', textInput.value); if (text.length > 0) { progressIndex = 0; processText(); } });
textInput.addEventListener('paste', () => { setTimeout(() => { const text = textInput.value.trim(); if (text) { progressIndex = 0; processText(); } }, 0); });
settingsToggle.addEventListener('click', () => settingsPanel.classList.add('open'));
closeSettings.addEventListener('click', () => settingsPanel.classList.remove('open'));
if (closeSettingsBottom) closeSettingsBottom.addEventListener('click', () => settingsPanel.classList.remove('open'));
settingsPanel.addEventListener('click', e => { if (e.target === settingsPanel) settingsPanel.classList.remove('open'); });
rateInput.addEventListener('input', () => { state.rate = Number(rateInput.value); localStorage.setItem('reader_rate', String(state.rate)); applySettings(); });
fontInput.addEventListener('input', () => { state.fontSize = Number(fontInput.value); localStorage.setItem('reader_font', String(state.fontSize)); applySettings(); });
themeToggle.addEventListener('click', () => { state.theme = state.theme === 'light' ? 'dark' : 'light'; localStorage.setItem('reader_theme', state.theme); applySettings(); });
voiceSelect.addEventListener('change', () => { state.voiceName = voiceSelect.value; localStorage.setItem('reader_voice', state.voiceName); updateVoiceName(); previewCurrentVoice(); });
reloadVoices.addEventListener('click', () => { loadVoices(); previewCurrentVoice(); });
previewVoice.addEventListener('click', previewCurrentVoice);
ttsMode.addEventListener('change', () => { state.ttsMode = ttsMode.value; localStorage.setItem('reader_tts_mode', state.ttsMode); });
saveTtsProxy.addEventListener('click', () => { state.ttsProxyUrl = ttsProxyUrl.value.trim(); localStorage.setItem('reader_tts_proxy_url', state.ttsProxyUrl); externalTtsState = state.ttsProxyUrl ? '失败' : '未配置'; renderExternalStatus(); });
testTtsProxy.addEventListener('click', async () => { await speakWithBestVoice(EXTERNAL_TEST_TEXT, { type: 'sentence' }); });
clearAudioCache.addEventListener('click', async () => { await caches.delete(AUDIO_CACHE_NAME); await updateAudioCacheCount(); });
clearCacheAndReload.addEventListener('click', async () => { clearCacheAndReload.textContent = '正在更新...'; clearCacheAndReload.disabled = true; try { if ('caches' in window) { const keys = await caches.keys(); await Promise.all(keys.map(key => caches.delete(key))); } if ('serviceWorker' in navigator) { const regs = await navigator.serviceWorker.getRegistrations(); await Promise.all(regs.map(reg => reg.unregister())); } } catch (err) { console.warn('clear cache failed', err); } finally { const base = location.origin + location.pathname; location.replace(`${base}?force=${Date.now()}`); } });
clearText.addEventListener('click', () => { speechSynthesis.cancel(); textInput.value = ''; readingUnits = []; progressIndex = 0; localStorage.removeItem('reader_text'); localStorage.removeItem('reader_index'); render(); settingsPanel.classList.remove('open'); textInput.focus(); });
focusPaste.addEventListener('click', () => { readingUnits = []; reader.innerHTML = ''; pasteView.style.display = 'flex'; settingsPanel.classList.remove('open'); textInput.focus(); });
closeDialog.addEventListener('click', () => dictDialog.close());
(async function init() { applySettings(); renderExternalStatus(); await updateAudioCacheCount(); loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; setTimeout(loadVoices, 500); setTimeout(loadVoices, 1500); try { const res = await fetch('dictionary.json?v=6'); dictionary = await res.json(); dictStatus.textContent = `本地词典已加载：${Object.keys(dictionary).length} 条`; } catch (e) { dictStatus.textContent = '本地词典加载失败'; } textInput.value = localStorage.getItem('reader_text') || ''; const text = textInput.value.trim(); if (text) processText(); if ('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js'); })();
