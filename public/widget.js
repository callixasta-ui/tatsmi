/*
 * AI Portfolio Chatbot — widget engine
 * --------------------------------------------------
 * You normally don't need to edit this file. Set `window.AI_WIDGET_CONFIG`
 * (see config.js) before this script runs to customize name, avatar,
 * colors, system prompt, and limits.
 */
(function () {
  const userConfig = window.AI_WIDGET_CONFIG || {};

  const config = Object.assign({
    botName: 'AI Assistant',
    subtitle: 'Usually instant',
    avatar: '🤖',
    fabIcon: '💬',
    accentColor: '#1d4ed8',
    fontFamily: "'Inter',-apple-system,sans-serif",
    apiEndpoint: '/api/chat',
    maxChars: 1200,
    maxDailyMessages: 30,
    storageKey: 'ai_widget',
    position: 'bottom-right', // 'bottom-right' | 'bottom-left'
    welcomeMessage: "👋 Hi! I'm your AI assistant. Ask me anything!",
    systemPrompt: 'You are a helpful, concise assistant. If you do not know something, say so honestly.',
    modelReadyReply: null // optional override for the canned "model" turn that primes the system prompt
  }, userConfig);

  const MAX_CHARS = config.maxChars;
  const MAX_DAILY = config.maxDailyMessages;
  const LIMIT_KEY = config.storageKey + '_limit';
  const SESSION_KEY = config.storageKey + '_session';
  const SYSTEM = config.systemPrompt;
  const GEMINI_ENDPOINT = config.apiEndpoint;
  const isLeft = config.position === 'bottom-left';

  function today() { return new Date().toISOString().slice(0, 10); }
  function getLimit() {
    try { const r = localStorage.getItem(LIMIT_KEY); return r ? JSON.parse(r) : { count: 0, date: today() }; }
    catch { return { count: 0, date: today() }; }
  }
  function getRemaining() {
    const l = getLimit(); return l.date !== today() ? MAX_DAILY : Math.max(0, MAX_DAILY - l.count);
  }
  function incrementLimit() {
    const l = getLimit();
    try { localStorage.setItem(LIMIT_KEY, JSON.stringify({ count: l.date === today() ? l.count + 1 : 1, date: today() })); } catch {}
  }

  function loadHistory() {
    try { const r = sessionStorage.getItem(SESSION_KEY); return r ? JSON.parse(r) : []; } catch { return []; }
  }
  function saveHistory(h) {
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(h)); } catch {}
  }

  function escapeHtml(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function renderMarkdown(text) {
    let s = escapeHtml(text);
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\(((?:https?:|mailto:|tel:|)[^)]*)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  const style = document.createElement('style');
  style.textContent = `
    #ar-fab{position:fixed;bottom:24px;${isLeft ? 'left' : 'right'}:24px;z-index:9998;width:54px;height:54px;border-radius:50%;background:var(--accent,${config.accentColor});color:#fff;border:none;cursor:pointer;font-size:22px;box-shadow:0 4px 20px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:transform .2s,box-shadow .2s}
    #ar-fab:hover{transform:scale(1.08);box-shadow:0 6px 24px rgba(0,0,0,.28)}
    #ar-panel{position:fixed;bottom:88px;${isLeft ? 'left' : 'right'}:24px;z-index:9999;width:340px;max-width:calc(100vw - 32px);background:var(--surface,#fff);border:1px solid var(--border,rgba(0,0,0,.09));border-radius:18px;box-shadow:0 8px 40px rgba(0,0,0,.15);display:flex;flex-direction:column;overflow:hidden;transform:translateY(16px) scale(.97);opacity:0;pointer-events:none;transition:transform .25s cubic-bezier(.4,0,.2,1),opacity .25s cubic-bezier(.4,0,.2,1);font-family:${config.fontFamily};max-height:520px}
    #ar-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:all}
    #ar-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid var(--border,rgba(0,0,0,.09));background:var(--surface,#fff)}
    #ar-header .ar-title-wrap{display:flex;align-items:center;gap:10px}
    #ar-header .ar-avatar{width:34px;height:34px;border-radius:50%;background:var(--accent,${config.accentColor});color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    #ar-header .ar-name{font-size:13.5px;font-weight:700;color:var(--text,#111)}
    #ar-header .ar-sub{font-size:11px;color:var(--muted,#706f6a);margin-top:1px}
    #ar-close{background:none;border:none;cursor:pointer;color:var(--muted,#706f6a);font-size:18px;padding:4px;border-radius:8px;line-height:1;transition:background .15s}
    #ar-close:hover{background:var(--surface2,#edecea)}
    #ar-messages{flex:1;overflow-y:auto;padding:14px 14px 8px;display:flex;flex-direction:column;gap:10px;scroll-behavior:smooth}
    .ar-msg{max-width:88%;font-size:13px;line-height:1.55;padding:9px 13px;border-radius:14px;word-break:break-word}
    .ar-msg.bot{background:var(--surface2,#edecea);color:var(--text,#111);align-self:flex-start;border-bottom-left-radius:4px}
    .ar-msg.user{background:var(--accent,${config.accentColor});color:#fff;align-self:flex-end;border-bottom-right-radius:4px}
    .ar-msg.bot a{color:var(--accent,${config.accentColor});text-decoration:underline}
    .ar-msg.user a{color:#fff;text-decoration:underline;opacity:.88}
    .ar-typing{display:flex;gap:4px;align-items:center;padding:10px 14px}
    .ar-typing span{width:7px;height:7px;border-radius:50%;background:var(--muted,#888);display:inline-block;animation:ar-bounce .9s infinite}
    .ar-typing span:nth-child(2){animation-delay:.15s}
    .ar-typing span:nth-child(3){animation-delay:.3s}
    @keyframes ar-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    #ar-footer{border-top:1px solid var(--border,rgba(0,0,0,.09));padding:10px 12px 12px;background:var(--surface,#fff)}
    #ar-limit-bar{font-size:10.5px;color:var(--muted,#706f6a);margin-bottom:7px;text-align:right}
    #ar-limit-bar span{font-weight:600;color:var(--text,#111)}
    #ar-input-row{display:flex;gap:8px;align-items:flex-end}
    #ar-input{flex:1;border:1px solid var(--border,rgba(0,0,0,.09));border-radius:12px;padding:9px 12px;font-size:13px;font-family:inherit;background:var(--bg,#f7f6f2);color:var(--text,#111);resize:none;outline:none;max-height:90px;transition:border-color .2s;line-height:1.45}
    #ar-input:focus{border-color:var(--accent,${config.accentColor})}
    #ar-input::placeholder{color:var(--muted,#706f6a)}
    #ar-input:disabled,#ar-send:disabled{opacity:.4;cursor:not-allowed}
    #ar-send{background:var(--accent,${config.accentColor});color:#fff;border:none;border-radius:10px;width:36px;height:36px;flex-shrink:0;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:opacity .2s,transform .15s}
    #ar-send:hover:not(:disabled){opacity:.88}
    #ar-send:active:not(:disabled){transform:scale(.93)}
    #ar-char-count{font-size:10px;color:var(--muted,#706f6a);text-align:right;margin-top:4px}
    #ar-char-count.warn{color:#ef4444}
    #ar-exhausted-msg{font-size:12px;color:var(--muted,#706f6a);text-align:center;padding:6px 0 2px}
    @media(max-width:420px){#ar-panel{width:calc(100vw - 24px);${isLeft ? 'left' : 'right'}:12px;bottom:80px}#ar-fab{bottom:16px;${isLeft ? 'left' : 'right'}:16px}}
  `;
  document.head.appendChild(style);

  const fab = document.createElement('button');
  fab.id = 'ar-fab';
  fab.setAttribute('aria-label', config.botName);
  fab.textContent = config.fabIcon;

  const panel = document.createElement('div');
  panel.id = 'ar-panel';
  panel.innerHTML = `
    <div id="ar-header">
      <div class="ar-title-wrap">
        <div class="ar-avatar">${config.avatar}</div>
        <div><div class="ar-name">${escapeHtml(config.botName)}</div><div class="ar-sub">${escapeHtml(config.subtitle)}</div></div>
      </div>
      <button id="ar-close">✕</button>
    </div>
    <div id="ar-messages"></div>
    <div id="ar-footer">
      <div id="ar-limit-bar">Messages today: <span id="ar-used">0</span> / ${MAX_DAILY}</div>
      <div id="ar-input-row">
        <textarea id="ar-input" rows="1" placeholder="Ask me anything…" maxlength="${MAX_CHARS}"></textarea>
        <button id="ar-send">➤</button>
      </div>
      <div id="ar-char-count">0 / ${MAX_CHARS}</div>
    </div>`;

  document.body.appendChild(fab);
  document.body.appendChild(panel);

  const messagesEl = panel.querySelector('#ar-messages');
  const inputEl    = panel.querySelector('#ar-input');
  const sendEl     = panel.querySelector('#ar-send');
  const charCount  = panel.querySelector('#ar-char-count');
  const usedEl     = panel.querySelector('#ar-used');

  let history  = loadHistory();
  let isOpen   = false;
  let isTyping = false;

  function updateLimitUI() {
    const used = MAX_DAILY - getRemaining();
    usedEl.textContent = used;
    if (getRemaining() <= 0) {
      inputEl.disabled = true;
      sendEl.disabled  = true;
      if (!panel.querySelector('#ar-exhausted-msg')) {
        const ex = document.createElement('div');
        ex.id = 'ar-exhausted-msg';
        ex.textContent = 'Daily limit reached. Come back tomorrow!';
        panel.querySelector('#ar-footer').appendChild(ex);
      }
    }
  }

  function addMessage(role, text) {
    const div = document.createElement('div');
    div.className = 'ar-msg ' + role;
    div.innerHTML = renderMarkdown(text);
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function showTyping() {
    const div = document.createElement('div');
    div.className = 'ar-msg bot';
    div.innerHTML = '<div class="ar-typing"><span></span><span></span><span></span></div>';
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return div;
  }

  function renderHistory() {
    messagesEl.innerHTML = '';
    if (history.length === 0) {
      addMessage('bot', config.welcomeMessage);
    } else {
      history.forEach(m => addMessage(m.role === 'model' ? 'bot' : 'user', m.parts[0].text));
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function sendToGemini(userText) {
    const contents = [
      { role: 'user',  parts: [{ text: SYSTEM }] },
      { role: 'model', parts: [{ text: config.modelReadyReply || `Got it! I am ${config.botName}, ready to help.` }] },
      ...history,
      { role: 'user',  parts: [{ text: userText }] }
    ];

    const res = await fetch(GEMINI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 400, temperature: 0.7 } })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error || 'HTTP ' + res.status);
    }

    const data = await res.json();

    if (!data.candidates?.length) {
      throw new Error('no_candidates');
    }

    return data.candidates[0].content.parts[0].text;
  }

  async function handleSend() {
    const text = inputEl.value.trim();
    if (!text || isTyping || getRemaining() <= 0 || text.length > MAX_CHARS) return;

    inputEl.value = '';
    charCount.textContent = '0 / ' + MAX_CHARS;
    charCount.classList.remove('warn');
    inputEl.style.height = 'auto';
    isTyping = true;
    sendEl.disabled = true;

    addMessage('user', text);
    const typingEl = showTyping();
    incrementLimit();
    updateLimitUI();

    try {
      const reply = await sendToGemini(text);
      history.push({ role: 'user',  parts: [{ text }] });
      history.push({ role: 'model', parts: [{ text: reply }] });
      if (history.length > 40) history = history.slice(-40);
      saveHistory(history);
      typingEl.remove();
      addMessage('bot', reply);
    } catch (err) {
      typingEl.remove();
      const m = String(err.message);
      const msg = m.includes('429') ? '⏳ Too many requests — wait a moment and try again!'
        : '⚠️ Error: ' + m;
      addMessage('bot', msg);
    }

    isTyping = false;
    if (getRemaining() > 0) sendEl.disabled = false;
    inputEl.focus();
  }

  inputEl.addEventListener('input', function () {
    const len = this.value.length;
    charCount.textContent = len + ' / ' + MAX_CHARS;
    charCount.classList.toggle('warn', len >= MAX_CHARS - 50);
    this.style.height = 'auto';
    this.style.height = Math.min(this.scrollHeight, 90) + 'px';
  });

  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });

  sendEl.addEventListener('click', handleSend);

  function openPanel() {
    isOpen = true; panel.classList.add('open');
    renderHistory(); updateLimitUI();
    setTimeout(() => inputEl.focus(), 250);
  }
  function closePanel() { isOpen = false; panel.classList.remove('open'); }

  fab.addEventListener('click', () => isOpen ? closePanel() : openPanel());
  panel.querySelector('#ar-close').addEventListener('click', closePanel);
  document.addEventListener('click', e => { if (isOpen && !panel.contains(e.target) && e.target !== fab) closePanel(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closePanel(); });

  updateLimitUI();
})();
