const $ = id => document.getElementById(id);
const DEFAULTS = { enabled: true, sensitivity: 40, titles: [] };
let cfg = DEFAULTS;

function save() { chrome.storage.sync.set(cfg); render(); }

function render() {
  $('enabled').checked = cfg.enabled;
  $('sens').value = String(cfg.sensitivity);
  const ul = $('list');
  ul.textContent = '';
  cfg.titles.forEach((t, i) => {
    const li = document.createElement('li');
    const span = document.createElement('span');
    span.textContent = t.name;
    if (t.keywords.length) {
      const s = document.createElement('small');
      s.textContent = t.keywords.join(', ');
      span.appendChild(s);
    }
    const x = document.createElement('button');
    x.textContent = '✕';
    x.onclick = () => { cfg.titles.splice(i, 1); save(); };
    li.append(span, x);
    ul.appendChild(li);
  });
}

$('add').onclick = () => {
  const name = $('name').value.trim();
  if (!name) return;
  const keywords = $('kw').value.split(',').map(s => s.trim()).filter(Boolean);
  cfg.titles.push({ name, keywords });
  $('name').value = ''; $('kw').value = '';
  save();
};
$('enabled').onchange = e => { cfg.enabled = e.target.checked; save(); };
$('sens').onchange = e => { cfg.sensitivity = Number(e.target.value); save(); };

chrome.storage.sync.get(DEFAULTS, c => { cfg = c; render(); });

chrome.tabs.query({ active: true, currentWindow: true }, ([tab]) => {
  if (!tab) return;
  chrome.tabs.sendMessage(tab.id, { type: 'getState' }, res => {
    if (chrome.runtime.lastError || !res) { $('meter').textContent = 'No reading for this page.'; return; }
    $('meter').textContent =
      `${res.level} (${res.danger}/100) · ${res.flagged} blurred of ${res.scanned} related items` +
      (res.titles.length ? ' · ' + res.titles.join(', ') : '');
  });
});
