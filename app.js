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
const clearCacheAndReload = document.getElementById('clearCacheAndReload');
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
let readingUnits = [];
let progressIndex = Number(localStorage.getItem('reader_index') || 0);
let clickTimer = null;
let longPressTimer = null;
let longPressHandled = false;

const state = {
  rate: Number(localStorage.getItem('reader_rate') || 1),
  fontSize: Number(localStorage.getItem('reader_font') || 22),
  theme: localStorage.getItem('reader_theme') || 'dark',
  voiceName: localStorage.getItem('reader_voice') || '',
};

function applySettings() { /* unchanged */
  document.body.classList.toggle('light', state.theme === 'light');
  document.body.classList.toggle('dark', state.theme !== 'light');
  document.documentElement.style.setProperty('--sentence-font', `${state.fontSize}px`);
  rateInput.value = String(state.rate);
  rateValue.textContent = `${state.rate.toFixed(1)}x`;
  fontInput.value = String(state.fontSize);
  fontValue.textContent = `${state.fontSize}px`;
  themeToggle.textContent = state.theme === 'light' ? '切换深色' : '切换浅色';
}
function loadVoices() { voices = speechSynthesis.getVoices().filter(v => /^en/i.test(v.lang)); voiceSelect.innerHTML=''; voices.forEach((v,i)=>{const option=document.createElement('option'); option.value=v.name; option.textContent=`${v.name} (${v.lang})`; voiceSelect.appendChild(option); if ((state.voiceName&&v.name===state.voiceName)||(!state.voiceName&&i===0)) option.selected=true;}); updateVoiceName(); }
function pickVoice(){ return voices.find(v=>v.name===state.voiceName)||voices.find(v=>/en-GB/i.test(v.lang))||voices.find(v=>/^en/i.test(v.lang)); }
function updateVoiceName(){ const voice=pickVoice(); voiceName.textContent=voice?`${voice.name} (${voice.lang})`:'浏览器默认语音'; if(voice) voiceSelect.value=voice.name; }
function speak(text){ if(!text) return; const u=new SpeechSynthesisUtterance(text); const voice=pickVoice(); if(voice) u.voice=voice; u.lang=voice?.lang||'en-GB'; u.rate=state.rate; speechSynthesis.cancel(); speechSynthesis.speak(u); }

function splitReadingUnits(line){ const text=line||''; const strong=new Set(['.','?','!','。','？','！']); const weak=new Set([',','，',';','；']); const chunks=[]; let buffer=''; function pushBuffer(){ const part=buffer.trim(); if(part) chunks.push(part); buffer=''; }
for(let i=0;i<text.length;i+=1){ const ch=text[i]; buffer+=ch; if(strong.has(ch)){ const prev=text[i-1]||''; const next=text[i+1]||''; const isNumberingDot=ch==='.'&&/\d/.test(prev)&&(next===' '||next==='\t'); if(!isNumberingDot) pushBuffer(); continue;} if(weak.has(ch)){ const current=buffer.trim(); if(current.length>=36) pushBuffer(); continue; }} if(buffer.trim()) chunks.push(buffer.trim()); const units=[]; chunks.forEach(chunk=>{ if(chunk.length<=180){ units.push(chunk); return;} const pieces=chunk.split(/([,，;；])/); let longBuffer=''; pieces.forEach(piece=>{ if(!piece) return; const next=longBuffer+piece; if(next.trim().length>180&&longBuffer.trim()){ units.push(longBuffer.trim()); longBuffer=piece;} else {longBuffer=next;} }); if(longBuffer.trim()) units.push(longBuffer.trim()); }); return units.filter(Boolean); }
function normalizeWord(word){ return word.toLowerCase().replace(/^[^a-z']+|[^a-z']+$/g,''); }
function candidatesFor(word){ const w=normalizeWord(word); const set=new Set([w]); if(w.endsWith('ied')) set.add(`${w.slice(0,-3)}y`); if(w.endsWith('ies')) set.add(`${w.slice(0,-3)}y`); if(w.endsWith('ed')){ set.add(w.slice(0,-2)); set.add(w.slice(0,-1)); } if(w.endsWith('s')&&w.length>3) set.add(w.slice(0,-1)); return [...set].filter(Boolean); }
function lookupWord(word){ for(const c of candidatesFor(word)){ if(dictionary[c]) return {key:c,entry:dictionary[c]}; } return null; }
function queryYoudao(word){ return `https://dict.youdao.com/result?word=${encodeURIComponent(word)}&lang=en`; }
function saveState(){ localStorage.setItem('reader_text',textInput.value); localStorage.setItem('reader_index',String(progressIndex)); }

function render(){ reader.innerHTML=''; const text=textInput.value.replace(/\r\n/g,'\n'); const paragraphs=text.split(/\n{2,}/); let unitIndex=0; paragraphs.forEach(paragraphText=>{ const paragraph=document.createElement('p'); paragraph.className='reader-paragraph'; const lines=paragraphText.split('\n'); lines.forEach((line,lineIndex)=>{ if(!line.trim()) return; const units=splitReadingUnits(line); units.forEach(unit=>{ const unitSpan=document.createElement('span'); unitSpan.className='reading-unit'; unitSpan.dataset.index=String(unitIndex); if(unitIndex===progressIndex) unitSpan.classList.add('active'); readingUnits[unitIndex]=unit; unit.split(/(\b[A-Za-z']+\b)/).forEach(part=>{ if(/^[A-Za-z']+$/.test(part)){ const word=document.createElement('span'); word.textContent=part; word.className='word'; word.dataset.word=part; unitSpan.appendChild(word);} else { unitSpan.appendChild(document.createTextNode(part)); }}); paragraph.appendChild(unitSpan); paragraph.appendChild(document.createTextNode(' ')); unitIndex+=1; }); if(lineIndex<lines.length-1) paragraph.appendChild(document.createElement('br')); }); reader.appendChild(paragraph); }); pasteView.style.display=readingUnits.length?'none':'flex'; }

function markActive(index){ [...reader.querySelectorAll('.reading-unit.active')].forEach(el=>el.classList.remove('active')); const active=reader.querySelector(`[data-index="${index}"]`); if(active){ active.classList.add('active'); active.scrollIntoView({block:'nearest',behavior:'smooth'}); } }
function speakReadingUnit(unit){ if(!unit) return; progressIndex=Number(unit.dataset.index); markActive(progressIndex); speak(readingUnits[progressIndex]); saveState(); }

function processText(){ readingUnits=[]; render(); progressIndex=Math.min(progressIndex,Math.max(0,readingUnits.length-1)); markActive(progressIndex); saveState(); }

reader.addEventListener('click', e => {
  if (longPressHandled) {
    longPressHandled = false;
    return;
  }
  if (clickTimer) clearTimeout(clickTimer);
  const targetUnit = e.target.closest('.reading-unit');
  if (!targetUnit) return;
  clickTimer = setTimeout(() => {
    speakReadingUnit(targetUnit);
  }, 220);
});

reader.addEventListener('dblclick', e => {
  const word = e.target.closest('.word');
  if (!word) return;
  e.preventDefault();
  e.stopPropagation();
  if (clickTimer) clearTimeout(clickTimer);
  speak(word.dataset.word);
  showDictionary(word.dataset.word);
});

reader.addEventListener('pointerdown', e => {
  const word = e.target.closest('.word');
  if (!word) return;
  longPressHandled = false;
  longPressTimer = setTimeout(() => {
    longPressHandled = true;
    speak(word.dataset.word);
    showDictionary(word.dataset.word);
  }, 500);
});

reader.addEventListener('pointerup', () => { if (longPressTimer) clearTimeout(longPressTimer); });
reader.addEventListener('pointercancel', () => { if (longPressTimer) clearTimeout(longPressTimer); });
reader.addEventListener('pointerleave', () => { if (longPressTimer) clearTimeout(longPressTimer); });

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

textInput.addEventListener('input', () => { const text=textInput.value.trim(); localStorage.setItem('reader_text',textInput.value); if(text.length>0){ progressIndex=0; processText(); }});
textInput.addEventListener('paste', () => { setTimeout(()=>{ const text=textInput.value.trim(); if(text){ progressIndex=0; processText(); }},0); });
settingsToggle.addEventListener('click',()=>settingsPanel.classList.add('open')); closeSettings.addEventListener('click',()=>settingsPanel.classList.remove('open')); settingsPanel.addEventListener('click',e=>{ if(e.target===settingsPanel) settingsPanel.classList.remove('open');});
rateInput.addEventListener('input',()=>{ state.rate=Number(rateInput.value); localStorage.setItem('reader_rate',String(state.rate)); applySettings(); });
fontInput.addEventListener('input',()=>{ state.fontSize=Number(fontInput.value); localStorage.setItem('reader_font',String(state.fontSize)); applySettings(); });
themeToggle.addEventListener('click',()=>{ state.theme=state.theme==='light'?'dark':'light'; localStorage.setItem('reader_theme',state.theme); applySettings(); });
voiceSelect.addEventListener('change',()=>{ state.voiceName=voiceSelect.value; localStorage.setItem('reader_voice',state.voiceName); updateVoiceName(); });
reloadVoices.addEventListener('click',loadVoices);

clearCacheAndReload.addEventListener('click', async () => {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(reg => reg.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch (err) {
    console.warn('clear cache failed, fallback to reload', err);
  }
  location.reload();
});

clearText.addEventListener('click',()=>{ speechSynthesis.cancel(); textInput.value=''; readingUnits=[]; progressIndex=0; localStorage.removeItem('reader_text'); localStorage.removeItem('reader_index'); render(); settingsPanel.classList.remove('open'); textInput.focus(); });
focusPaste.addEventListener('click',()=>{ readingUnits=[]; reader.innerHTML=''; pasteView.style.display='flex'; settingsPanel.classList.remove('open'); textInput.focus(); });
closeDialog.addEventListener('click',()=>dictDialog.close());

(async function init(){ applySettings(); loadVoices(); speechSynthesis.onvoiceschanged=loadVoices; setTimeout(loadVoices,500); try{ const res=await fetch(`dictionary.json?v=3`); dictionary=await res.json(); dictStatus.textContent=`本地词典已加载：${Object.keys(dictionary).length} 条`; }catch(e){ dictStatus.textContent='本地词典加载失败'; }
textInput.value=localStorage.getItem('reader_text')||''; const text=textInput.value.trim(); if(text) processText(); if('serviceWorker' in navigator) navigator.serviceWorker.register('service-worker.js'); })();
