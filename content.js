(() => {
  const DEFAULTS = { enabled: true, sensitivity: 40, titles: [] };

  // Words that turn a plain mention into a likely spoiler.
  const STRONG = ['dies','died','dead','death','killed','kills','murdered','survives','betrays',
    'betrayed','traitor','twist','reveal','revealed','turns out','is actually','secretly','finale',
    'ending','leak','leaked','leaks','post-credits','final boss','cliffhanger','resurrected',
    'villain is','is the killer'];
  const WEAK = ['episode','season','chapter','scene','theory','predicts','recap','explained',
    'cameo','returns','boss','cast'];

  // Elements we inspect. Sites change markup often, so expect to tweak these.
  const SELECTORS = [
    'article[data-testid="tweet"]',                       // X / Twitter
    'shreddit-comment [slot="comment"]', 'shreddit-post [slot="title"]', 'a[slot="title"]', // new Reddit
    '[data-testid="comment"]', '.Comment', '.entry .usertext-body', '.thing .title a.title', // other Reddit
    'h1', 'h2', 'h3', 'h4', '[role="article"]'            // headlines elsewhere
  ].join(',');

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const listRe = words => new RegExp('\\b(?:' + words.map(esc).join('|') + ')\\b', 'gi');
  const STRONG_RE = listRe(STRONG);
  const WEAK_RE = listRe(WEAK);

  let cfg = DEFAULTS;
  let matchers = [];
  let seen = new WeakSet();
  const blocks = new Map(); // element -> {score, title, terms}
  let allRevealed = false;
  let host, shadow;

  function buildMatchers() {
    matchers = cfg.titles
      .map(t => ({
        name: t.name,
        re: new RegExp('\\b(?:' + [t.name, ...(t.keywords || [])].filter(Boolean).map(esc).join('|') + ')\\b', 'i')
      }));
  }

  // 0 = unrelated to your list. Otherwise higher = spoilier.
  function scoreText(text) {
    text = text.slice(0, 2000);
    const m = matchers.find(m => m.re.test(text));
    if (!m) return null;
    const strong = new Set([...text.matchAll(STRONG_RE)].map(x => x[0].toLowerCase()));
    const weak = new Set([...text.matchAll(WEAK_RE)].map(x => x[0].toLowerCase()));
    let score = 20;                                   // mentions something you're watching
    score += Math.min(strong.size, 3) * 25;           // plot-leak language
    score += Math.min(weak.size, 3) * 8;              // generic episode-talk
    if (/spoiler/i.test(text)) score += 20;           // author flagged it themselves
    return { score: Math.min(100, score), title: m.name, terms: [...strong] };
  }

  function reveal(e) {
    e.preventDefault();
    e.stopPropagation();
    e.currentTarget.classList.remove('ss-blur');
    e.currentTarget.classList.add('ss-revealed');
    e.currentTarget.removeEventListener('click', reveal, true);
  }
  function blur(el) {
    el.classList.add('ss-blur');
    el.classList.remove('ss-revealed');
    el.title = 'Possible spoiler — click to reveal';
    el.addEventListener('click', reveal, true);
  }

  function scan() {
    if (!cfg.enabled || !matchers.length) return;
    for (const el of document.querySelectorAll(SELECTORS)) {
      if (seen.has(el) || el.closest('#ss-host')) continue;
      const text = el.innerText || '';
      if (text.length < 15) continue;                 // not rendered yet; try again later
      seen.add(el);
      const r = scoreText(text);
      if (!r) continue;
      blocks.set(el, r);
      if (!allRevealed && r.score >= cfg.sensitivity && !el.closest('.ss-blur')) blur(el);
    }
    updateMeter();
  }

  function clearAll() {
    for (const el of blocks.keys()) {
      el.classList.remove('ss-blur', 'ss-revealed');
      el.removeEventListener('click', reveal, true);
    }
    blocks.clear();
    seen = new WeakSet();
    allRevealed = false;
  }

  // ---- Danger meter ----
  function danger() {
    let raw = 0;
    for (const [el, r] of blocks) {
      if (!el.isConnected) { blocks.delete(el); continue; }
      raw += r.score;
    }
    const t = matchers.length ? scoreText(document.title) : null;
    if (t) raw += t.score;
    return Math.round(100 * (1 - Math.exp(-raw / 150))); // diminishing returns, caps below 100
  }
  function level(d) {
    return d >= 70 ? ['Meltdown', '#c0392b'] : d >= 40 ? ['Danger', '#e67e22']
         : d >= 15 ? ['Caution', '#d4ac0d'] : ['Safe', '#27ae60'];
  }
  function ensureMeter() {
    if (host) return;
    host = document.createElement('div');
    host.id = 'ss-host';
    shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `
      <style>
        button{all:initial;position:fixed;right:16px;bottom:16px;z-index:2147483647;
          font:600 12px system-ui,sans-serif;color:#fff;background:#222;padding:7px 12px;
          border-radius:999px;cursor:pointer;display:flex;gap:8px;align-items:center;
          box-shadow:0 2px 8px rgba(0,0,0,.35)}
        .dot{width:10px;height:10px;border-radius:50%}
        .bar{width:46px;height:6px;background:#555;border-radius:3px;overflow:hidden}
        .fill{height:100%}
      </style>
      <button id="m" title="Click to reveal / re-hide flagged items">
        <span class="dot" id="dot"></span><span id="txt"></span>
        <span class="bar"><span class="fill" id="fill"></span></span>
      </button>`;
    document.documentElement.appendChild(host);
    shadow.getElementById('m').addEventListener('click', toggleAll);
  }
  function toggleAll() {
    allRevealed = !allRevealed;
    for (const [el, r] of blocks) {
      if (allRevealed) { el.classList.remove('ss-blur'); el.classList.add('ss-revealed'); }
      else if (r.score >= cfg.sensitivity) blur(el);
    }
  }
  function updateMeter() {
    const d = danger();
    const [label, color] = level(d);
    ensureMeter();
    shadow.getElementById('txt').textContent = `${label} ${d}`;
    shadow.getElementById('dot').style.background = color;
    const fill = shadow.getElementById('fill');
    fill.style.width = d + '%';
    fill.style.background = color;
    try { chrome.runtime.sendMessage({ type: 'score', danger: d }); } catch (_) {}
  }

  // ---- Wiring ----
  chrome.runtime.onMessage.addListener((msg, _s, send) => {
    if (msg.type !== 'getState') return;
    const d = danger();
    const flagged = [...blocks.values()].filter(r => r.score >= cfg.sensitivity);
    send({ danger: d, level: level(d)[0], flagged: flagged.length, scanned: blocks.size,
           titles: [...new Set(flagged.map(r => r.title))] });
  });

  let timer;
  new MutationObserver(() => { clearTimeout(timer); timer = setTimeout(scan, 400); })
    .observe(document.documentElement, { childList: true, subtree: true });

  function init() {
    chrome.storage.sync.get(DEFAULTS, c => {
      cfg = c;
      buildMatchers();
      clearAll();
      if (host) { host.remove(); host = null; }
      if (cfg.enabled && matchers.length) scan();
    });
  }
  chrome.storage.onChanged.addListener(init);
  init();
})();
