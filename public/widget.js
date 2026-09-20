/*
 * Amy — GDS trainer chatbot widget engine
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
    maxAttachments: 10,
    maxFileSizeMB: 8,
    storageKey: 'ai_widget',
    position: 'bottom-right', // 'bottom-right' | 'bottom-left'
    welcomeMessage: "👋 Hi! I'm your AI assistant. Ask me anything!",
    systemPrompt: 'You are a helpful, concise assistant. If you do not know something, say so honestly.',
    modelReadyReply: null // optional override for the canned "model" turn that primes the system prompt
  }, userConfig);

  const MAX_CHARS = config.maxChars;
  const MAX_DAILY = config.maxDailyMessages;
  const MAX_ATTACHMENTS = config.maxAttachments;
  const MAX_FILE_SIZE = config.maxFileSizeMB * 1024 * 1024;
  const LIMIT_KEY = config.storageKey + '_limit';
  const SESSION_KEY = config.storageKey + '_session';
  const POS_KEY = config.storageKey + '_pos';
  const SYSTEM = config.systemPrompt;
  const CHAT_ENDPOINT = config.apiEndpoint;
  const isLeft = config.position === 'bottom-left';

  // File extensions we treat as "purely text" -> decoded straight into the
  // chat message instead of being sent as an attachment. Anything else
  // (images, pdf, doc/docx, xls/xlsx, ppt/pptx, unknown binaries) is kept as
  // a real attachment, since it may contain images/tables/layout that plain
  // text can't represent.
  const TEXT_EXTENSIONS = ['txt','md','markdown','csv','tsv','json','log','yml','yaml',
    'js','jsx','ts','tsx','py','java','c','cc','cpp','h','hpp','cs','go','rb','php',
    'css','scss','html','htm','xml','sh','bash','ini','conf','cfg','sql','yaml'];

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
    try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(h)); }
    catch {
      // Likely quota exceeded (large attachments) — drop oldest turns and retry once.
      try {
        const trimmed = h.slice(-10);
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(trimmed));
      } catch {}
    }
  }

  function loadPos() {
    try { const r = localStorage.getItem(POS_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
  }
  function savePos(left, top) {
    try { localStorage.setItem(POS_KEY, JSON.stringify({ left, top })); } catch {}
  }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function renderMarkdown(text) {
    let s = escapeHtml(text);
    s = s.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/\[([^\]]+)\]\(((?:https?:|mailto:|tel:|)[^)]*)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    s = s.replace(/\n/g, '<br>');
    return s;
  }

  function isImagePath(v) {
    if (typeof v !== 'string') return false;
    if (v.startsWith('data:image')) return true;
    const looksLikePathOrUrl = /^https?:\/\//i.test(v) || v.startsWith('/') || v.startsWith('./');
    const hasImageExt = /\.(png|jpe?g|svg|webp|gif)(\?.*)?$/i.test(v.split('?')[0]);
    return looksLikePathOrUrl && hasImageExt;
  }
  function renderIconInto(el, value, altText) {
    el.innerHTML = '';
    if (isImagePath(value)) {
      const img = document.createElement('img');
      img.src = value;
      img.alt = altText || '';
      img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:inherit;display:block;';
      el.appendChild(img);
    } else {
      el.textContent = value;
    }
  }

  function fileExt(name) {
    const parts = String(name).split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }
  function readAsDataURL(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
  }
  function readAsText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(r.error);
      r.readAsText(file);
    });
  }
  function iconForKind(kind) {
    if (kind === 'pdf') return '📄';
    if (kind === 'other') return '📎';
    return '🖼️';
  }

  const style = document.createElement('style');
  style.textContent = `
    #ar-fab{position:fixed;bottom:24px;${isLeft ? 'left' : 'right'}:24px;z-index:9998;width:54px;height:54px;border-radius:50%;background:var(--accent,${config.accentColor});color:#fff;border:none;cursor:grab;font-size:22px;box-shadow:0 4px 20px rgba(0,0,0,.2);display:flex;align-items:center;justify-content:center;transition:box-shadow .2s;touch-action:none;overflow:hidden;padding:0}
    #ar-fab:active{cursor:grabbing}
    #ar-fab.dragging{transition:none;box-shadow:0 8px 30px rgba(0,0,0,.35)}
    #ar-panel{position:fixed;z-index:9999;width:340px;max-width:calc(100vw - 32px);background:var(--surface,#fff);border:1px solid var(--border,rgba(0,0,0,.09));border-radius:18px;box-shadow:0 8px 40px rgba(0,0,0,.15);display:flex;flex-direction:column;overflow:hidden;transform:translateY(16px) scale(.97);opacity:0;pointer-events:none;transition:transform .25s cubic-bezier(.4,0,.2,1),opacity .25s cubic-bezier(.4,0,.2,1);font-family:${config.fontFamily};max-height:min(560px,calc(100vh - 32px))}
    #ar-panel.open{transform:translateY(0) scale(1);opacity:1;pointer-events:all}
    #ar-header{display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;border-bottom:1px solid var(--border,rgba(0,0,0,.09));background:var(--surface,#fff)}
    #ar-header .ar-title-wrap{display:flex;align-items:center;gap:10px}
    #ar-header .ar-avatar{width:34px;height:34px;border-radius:50%;background:var(--accent,${config.accentColor});color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden}
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
    .ar-msg-atts{display:flex;flex-wrap:wrap;gap:6px;margin-top:6px}
    .ar-msg-atts img{width:64px;height:64px;object-fit:cover;border-radius:8px;display:block}
    .ar-msg-atts .ar-att-file{display:flex;align-items:center;gap:4px;background:rgba(0,0,0,.12);border-radius:8px;padding:4px 8px;font-size:11px;max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .ar-typing{display:flex;gap:4px;align-items:center;padding:10px 14px}
    .ar-typing span{width:7px;height:7px;border-radius:50%;background:var(--muted,#888);display:inline-block;animation:ar-bounce .9s infinite}
    .ar-typing span:nth-child(2){animation-delay:.15s}
    .ar-typing span:nth-child(3){animation-delay:.3s}
    @keyframes ar-bounce{0%,60%,100%{transform:translateY(0)}30%{transform:translateY(-5px)}}
    #ar-footer{border-top:1px solid var(--border,rgba(0,0,0,.09));padding:10px 12px 12px;background:var(--surface,#fff)}
    #ar-limit-bar{font-size:10.5px;color:var(--muted,#706f6a);margin-bottom:7px;text-align:right}
    #ar-limit-bar span{font-weight:600;color:var(--text,#111)}
    #ar-attachments{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
    .ar-att-chip{position:relative;display:flex;align-items:center;gap:5px;background:var(--bg,#f7f6f2);border:1px solid var(--border,rgba(0,0,0,.09));border-radius:9px;padding:4px 6px 4px 4px;font-size:10.5px;color:var(--text,#111);max-width:150px}
    .ar-att-chip .ar-att-thumb{width:26px;height:26px;border-radius:6px;object-fit:cover;flex-shrink:0;background:var(--surface2,#edecea);display:flex;align-items:center;justify-content:center;font-size:14px}
    .ar-att-chip .ar-att-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:70px}
    .ar-att-chip .ar-att-btn{background:none;border:none;cursor:pointer;color:var(--muted,#706f6a);font-size:11px;padding:2px;line-height:1;border-radius:5px}
    .ar-att-chip .ar-att-btn:hover{background:var(--surface2,#edecea)}
    #ar-input-row{display:flex;gap:6px;align-items:flex-end}
    #ar-input{flex:1;border:1px solid var(--border,rgba(0,0,0,.09));border-radius:12px;padding:9px 12px;font-size:13px;font-family:inherit;background:var(--bg,#f7f6f2);color:var(--text,#111);resize:none;outline:none;max-height:90px;transition:border-color .2s;line-height:1.45}
    #ar-input:focus{border-color:var(--accent,${config.accentColor})}
    #ar-input::placeholder{color:var(--muted,#706f6a)}
    #ar-input:disabled,#ar-send:disabled,#ar-attach-btn:disabled,#ar-mic-btn:disabled{opacity:.4;cursor:not-allowed}
    .ar-icon-btn{background:var(--surface2,#edecea);color:var(--text,#111);border:none;border-radius:10px;width:34px;height:34px;flex-shrink:0;cursor:pointer;font-size:15px;display:flex;align-items:center;justify-content:center;transition:opacity .2s,transform .15s,background .15s}
    .ar-icon-btn:hover:not(:disabled){opacity:.85}
    .ar-icon-btn:active:not(:disabled){transform:scale(.93)}
    #ar-mic-btn.recording{background:#ef4444;color:#fff;animation:ar-mic-pulse 1.1s infinite}
    @keyframes ar-mic-pulse{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.5)}50%{box-shadow:0 0 0 6px rgba(239,68,68,0)}}
    #ar-send{background:var(--accent,${config.accentColor});color:#fff;border:none;border-radius:10px;width:36px;height:36px;flex-shrink:0;cursor:pointer;font-size:16px;display:flex;align-items:center;justify-content:center;transition:opacity .2s,transform .15s}
    #ar-send:hover:not(:disabled){opacity:.88}
    #ar-send:active:not(:disabled){transform:scale(.93)}
    #ar-char-count{font-size:10px;color:var(--muted,#706f6a);text-align:right;margin-top:4px}
    #ar-char-count.warn{color:#ef4444}
    #ar-exhausted-msg{font-size:12px;color:var(--muted,#706f6a);text-align:center;padding:6px 0 2px}
    #ar-inline-notice{font-size:11px;color:#b45309;background:#fef3c7;border-radius:8px;padding:5px 8px;margin-bottom:7px}
    #ar-crop-overlay{position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.55);display:none;align-items:center;justify-content:center;padding:20px}
    #ar-crop-overlay.open{display:flex}
    #ar-crop-box{background:#fff;border-radius:14px;padding:14px;max-width:min(92vw,420px);display:flex;flex-direction:column;gap:10px;font-family:${config.fontFamily}}
    #ar-crop-header{font-size:13px;font-weight:700;color:#111}
    #ar-crop-hint{font-size:11px;color:#706f6a;margin-top:-6px}
    #ar-crop-canvas-wrap{display:flex;align-items:center;justify-content:center;background:#111;border-radius:8px;overflow:hidden;touch-action:none}
    #ar-crop-canvas{display:block;max-width:100%;cursor:crosshair}
    #ar-crop-actions{display:flex;justify-content:flex-end;gap:8px}
    #ar-crop-actions button{border:none;border-radius:9px;padding:8px 14px;font-size:12.5px;cursor:pointer;font-weight:600}
    #ar-crop-cancel{background:#edecea;color:#111}
    #ar-crop-apply{background:var(--accent,${config.accentColor});color:#fff}
    @media(max-width:420px){#ar-panel{width:calc(100vw - 24px)}}
  `;
  document.head.appendChild(style);

  const fab = document.createElement('button');
  fab.id = 'ar-fab';
  fab.setAttribute('aria-label', config.botName);
  renderIconInto(fab, config.fabIcon, config.botName);

  const panel = document.createElement('div');
  panel.id = 'ar-panel';
  panel.innerHTML = `
    <div id="ar-header">
      <div class="ar-title-wrap">
        <div class="ar-avatar"></div>
        <div><div class="ar-name">${escapeHtml(config.botName)}</div><div class="ar-sub">${escapeHtml(config.subtitle)}</div></div>
      </div>
      <button id="ar-close">✕</button>
    </div>
    <div id="ar-messages"></div>
    <div id="ar-footer">
      <div id="ar-limit-bar">Messages today: <span id="ar-used">0</span> / ${MAX_DAILY}</div>
      <div id="ar-attachments"></div>
      <div id="ar-input-row">
        <button id="ar-attach-btn" class="ar-icon-btn" type="button" title="Attach files">📎</button>
        <textarea id="ar-input" rows="1" placeholder="Ask me anything…" maxlength="${MAX_CHARS}"></textarea>
        <button id="ar-mic-btn" class="ar-icon-btn" type="button" title="Voice input">🎤</button>
        <button id="ar-send">➤</button>
      </div>
      <div id="ar-char-count">0 / ${MAX_CHARS}</div>
    </div>`;

  const cropOverlay = document.createElement('div');
  cropOverlay.id = 'ar-crop-overlay';
  cropOverlay.innerHTML = `
    <div id="ar-crop-box">
      <div id="ar-crop-header">Crop image</div>
      <div id="ar-crop-hint">Drag on the image to select the area to keep.</div>
      <div id="ar-crop-canvas-wrap"><canvas id="ar-crop-canvas"></canvas></div>
      <div id="ar-crop-actions">
        <button id="ar-crop-cancel" type="button">Cancel</button>
        <button id="ar-crop-apply" type="button">Apply crop</button>
      </div>
    </div>`;

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.style.display = 'none';
  fileInput.accept = 'image/*,.pdf,.txt,.md,.csv,.json,.log,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.yml,.yaml,.js,.ts,.py,.html,.css';

  document.body.appendChild(fab);
  document.body.appendChild(panel);
  document.body.appendChild(cropOverlay);
  document.body.appendChild(fileInput);

  renderIconInto(panel.querySelector('.ar-avatar'), config.avatar, config.botName);

  const messagesEl   = panel.querySelector('#ar-messages');
  const inputEl      = panel.querySelector('#ar-input');
  const sendEl       = panel.querySelector('#ar-send');
  const attachBtn    = panel.querySelector('#ar-attach-btn');
  const micBtn       = panel.querySelector('#ar-mic-btn');
  const attsEl       = panel.querySelector('#ar-attachments');
  const charCount    = panel.querySelector('#ar-char-count');
  const usedEl       = panel.querySelector('#ar-used');
  const footerEl     = panel.querySelector('#ar-footer');

  const cropCanvas   = cropOverlay.querySelector('#ar-crop-canvas');
  const cropCtx      = cropCanvas.getContext('2d');
  const cropApplyBtn = cropOverlay.querySelector('#ar-crop-apply');
  const cropCancelBtn= cropOverlay.querySelector('#ar-crop-cancel');

  let history     = loadHistory();
  let isOpen      = false;
  let isTyping    = false;
  let attachments = []; // staged attachments for the next outgoing message

  // ---------------------------------------------------------------------
  // Draggable FAB (position persists across reloads) + panel that always
  // opens fully within the viewport regardless of where the FAB sits.
  // ---------------------------------------------------------------------
  (function initFabPosition() {
    const saved = loadPos();
    if (saved) {
      fab.style.left = saved.left; fab.style.top = saved.top;
      fab.style.right = 'auto'; fab.style.bottom = 'auto';
    }
  })();

  let drag = null;
  fab.addEventListener('pointerdown', (e) => {
    const rect = fab.getBoundingClientRect();
    drag = { startX: e.clientX, startY: e.clientY, origLeft: rect.left, origTop: rect.top, moved: false };
    try { fab.setPointerCapture(e.pointerId); } catch {}
  });
  fab.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX, dy = e.clientY - drag.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      if (!drag.moved) fab.classList.add('dragging');
      drag.moved = true;
    }
    if (drag.moved) {
      const maxLeft = window.innerWidth - fab.offsetWidth - 4;
      const maxTop = window.innerHeight - fab.offsetHeight - 4;
      const newLeft = Math.min(Math.max(4, drag.origLeft + dx), maxLeft);
      const newTop = Math.min(Math.max(4, drag.origTop + dy), maxTop);
      fab.style.left = newLeft + 'px';
      fab.style.top = newTop + 'px';
      fab.style.right = 'auto';
      fab.style.bottom = 'auto';
      if (isOpen) positionPanel();
    }
  });
  function endDrag(e) {
    if (!drag) return;
    fab.classList.remove('dragging');
    if (drag.moved) {
      savePos(fab.style.left, fab.style.top);
    } else {
      isOpen ? closePanel() : openPanel();
    }
    drag = null;
  }
  fab.addEventListener('pointerup', endDrag);
  fab.addEventListener('pointercancel', endDrag);

  function positionPanel() {
    const fabRect = fab.getBoundingClientRect();
    const margin = 12;
    panel.style.visibility = 'hidden';
    panel.classList.add('open');
    const panelWidth = panel.offsetWidth || 340;
    const panelHeight = panel.offsetHeight || 480;
    panel.classList.remove('open');
    panel.style.visibility = '';

    let left = fabRect.left;
    let top = fabRect.top - panelHeight - 10; // prefer opening above the FAB
    if (top < margin) top = fabRect.bottom + 10; // not enough room above -> below
    if (top + panelHeight > window.innerHeight - margin) top = window.innerHeight - panelHeight - margin;
    if (top < margin) top = margin;

    if (left + panelWidth > window.innerWidth - margin) left = window.innerWidth - panelWidth - margin;
    if (left < margin) left = margin;

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
  }
  window.addEventListener('resize', () => { if (isOpen) positionPanel(); });

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  function updateLimitUI() {
    const used = MAX_DAILY - getRemaining();
    usedEl.textContent = used;
    if (getRemaining() <= 0) {
      inputEl.disabled = true;
      sendEl.disabled  = true;
      attachBtn.disabled = true;
      if (!panel.querySelector('#ar-exhausted-msg')) {
        const ex = document.createElement('div');
        ex.id = 'ar-exhausted-msg';
        ex.textContent = 'Daily limit reached. Come back tomorrow!';
        footerEl.appendChild(ex);
      }
    }
  }

  function attachmentsHtml(atts) {
    if (!atts || !atts.length) return '';
    const chips = atts.map(a => {
      if (a.kind === 'image' && a.thumb) {
        return `<img src="${a.thumb}" alt="${escapeHtml(a.name)}">`;
      }
      return `<span class="ar-att-file">${iconForKind(a.kind)} ${escapeHtml(a.name)}</span>`;
    }).join('');
    return `<div class="ar-msg-atts">${chips}</div>`;
  }

  function addMessage(role, text, atts) {
    const div = document.createElement('div');
    div.className = 'ar-msg ' + role;
    div.innerHTML = renderMarkdown(text || '') + attachmentsHtml(atts);
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
      history.forEach(m => {
        const role = m.role === 'model' ? 'bot' : 'user';
        const text = m.display ? m.display.text : (m.parts.find(p => p.text) || {}).text || '';
        const atts = m.display ? m.display.attachments : null;
        addMessage(role, text, atts);
      });
    }
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  function showInlineNotice(msg) {
    let n = panel.querySelector('#ar-inline-notice');
    if (!n) {
      n = document.createElement('div');
      n.id = 'ar-inline-notice';
      footerEl.insertBefore(n, attsEl);
    }
    n.textContent = msg;
    clearTimeout(showInlineNotice._t);
    showInlineNotice._t = setTimeout(() => n.remove(), 4000);
  }

  // ---------------------------------------------------------------------
  // Attachments: staging, preview chips, and image cropping
  // ---------------------------------------------------------------------
  function renderAttachments() {
    attsEl.innerHTML = '';
    attachments.forEach(a => {
      const chip = document.createElement('div');
      chip.className = 'ar-att-chip';
      const thumb = a.kind === 'image'
        ? `<img class="ar-att-thumb" src="${a.thumb}" alt="">`
        : `<span class="ar-att-thumb">${iconForKind(a.kind)}</span>`;
      chip.innerHTML = `
        ${thumb}
        <span class="ar-att-name" title="${escapeHtml(a.name)}">${escapeHtml(a.name)}</span>
        ${a.kind === 'image' ? '<button class="ar-att-btn ar-att-crop" title="Crop">✂️</button>' : ''}
        <button class="ar-att-btn ar-att-remove" title="Remove">✕</button>
      `;
      chip.querySelector('.ar-att-remove').addEventListener('click', () => {
        attachments = attachments.filter(x => x.id !== a.id);
        renderAttachments();
      });
      const cropBtn = chip.querySelector('.ar-att-crop');
      if (cropBtn) cropBtn.addEventListener('click', () => openCropModal(a));
      attsEl.appendChild(chip);
    });
  }

  async function handleFiles(fileList) {
    const room = MAX_ATTACHMENTS - attachments.length;
    const incoming = Array.from(fileList);
    if (incoming.length > room) {
      showInlineNotice(`You can attach up to ${MAX_ATTACHMENTS} files at a time — only the first ${Math.max(room,0)} were added.`);
    }
    const files = incoming.slice(0, Math.max(room, 0));

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        showInlineNotice(`"${file.name}" is too large (max ${config.maxFileSizeMB}MB).`);
        continue;
      }
      const ext = fileExt(file.name);
      const isPureText = (file.type && file.type.startsWith('text/')) || TEXT_EXTENSIONS.includes(ext);

      if (isPureText) {
        try {
          const text = await readAsText(file);
          const sep = inputEl.value.trim() ? '\n\n' : '';
          inputEl.value += `${sep}--- ${file.name} ---\n${text.trim()}`;
          inputEl.dispatchEvent(new Event('input'));
        } catch {
          showInlineNotice(`Could not read "${file.name}" as text.`);
        }
        continue; // pure text files are folded into the message, not attached
      }

      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf' || ext === 'pdf';
      let dataUrl;
      try { dataUrl = await readAsDataURL(file); }
      catch { showInlineNotice(`Could not read "${file.name}".`); continue; }
      const base64 = dataUrl.split(',')[1];

      attachments.push({
        id: 'att_' + Math.random().toString(36).slice(2),
        name: file.name,
        mimeType: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'),
        dataUrl,
        base64,
        thumb: isImage ? dataUrl : null,
        sendable: isImage || isPdf, // only types Gemini can read inline
        kind: isImage ? 'image' : (isPdf ? 'pdf' : 'other')
      });
    }
    fileInput.value = '';
    renderAttachments();
  }

  attachBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', (e) => handleFiles(e.target.files));

  // --- Crop modal: drag a rectangle on the canvas, then apply ---
  let cropTarget = null, cropImg = null, cropSel = null, cropDragging = false, cropScale = 1;

  function openCropModal(attachment) {
    cropTarget = attachment;
    cropImg = new Image();
    cropImg.onload = () => {
      const maxDim = 320;
      cropScale = Math.min(1, maxDim / Math.max(cropImg.width, cropImg.height));
      cropCanvas.width = Math.round(cropImg.width * cropScale);
      cropCanvas.height = Math.round(cropImg.height * cropScale);
      cropSel = null;
      drawCrop();
      cropOverlay.classList.add('open');
    };
    cropImg.src = attachment.dataUrl;
  }
  function drawCrop() {
    cropCtx.clearRect(0, 0, cropCanvas.width, cropCanvas.height);
    cropCtx.drawImage(cropImg, 0, 0, cropCanvas.width, cropCanvas.height);
    if (cropSel) {
      cropCtx.strokeStyle = '#e8b567';
      cropCtx.lineWidth = 2;
      cropCtx.setLineDash([5, 4]);
      cropCtx.strokeRect(cropSel.x, cropSel.y, cropSel.w, cropSel.h);
      cropCtx.setLineDash([]);
      cropCtx.fillStyle = 'rgba(0,0,0,.35)';
      cropCtx.fillRect(0, 0, cropCanvas.width, cropSel.y);
      cropCtx.fillRect(0, cropSel.y + cropSel.h, cropCanvas.width, cropCanvas.height - cropSel.y - cropSel.h);
      cropCtx.fillRect(0, cropSel.y, cropSel.x, cropSel.h);
      cropCtx.fillRect(cropSel.x + cropSel.w, cropSel.y, cropCanvas.width - cropSel.x - cropSel.w, cropSel.h);
    }
  }
  function cropPointerPos(e) {
    const r = cropCanvas.getBoundingClientRect();
    return { x: Math.min(Math.max(0, e.clientX - r.left), cropCanvas.width), y: Math.min(Math.max(0, e.clientY - r.top), cropCanvas.height) };
  }
  cropCanvas.addEventListener('pointerdown', (e) => {
    const p = cropPointerPos(e);
    cropDragging = true;
    cropSel = { x: p.x, y: p.y, w: 0, h: 0, startX: p.x, startY: p.y };
    try { cropCanvas.setPointerCapture(e.pointerId); } catch {}
  });
  cropCanvas.addEventListener('pointermove', (e) => {
    if (!cropDragging || !cropSel) return;
    const p = cropPointerPos(e);
    cropSel.x = Math.min(cropSel.startX, p.x);
    cropSel.y = Math.min(cropSel.startY, p.y);
    cropSel.w = Math.abs(p.x - cropSel.startX);
    cropSel.h = Math.abs(p.y - cropSel.startY);
    drawCrop();
  });
  ['pointerup', 'pointercancel'].forEach(ev => cropCanvas.addEventListener(ev, () => { cropDragging = false; }));

  cropCancelBtn.addEventListener('click', () => { cropOverlay.classList.remove('open'); cropTarget = null; });
  cropApplyBtn.addEventListener('click', () => {
    if (!cropTarget) return;
    if (!cropSel || cropSel.w < 8 || cropSel.h < 8) { cropOverlay.classList.remove('open'); return; }
    const sx = cropSel.x / cropScale, sy = cropSel.y / cropScale;
    const sw = cropSel.w / cropScale, sh = cropSel.h / cropScale;
    const off = document.createElement('canvas');
    off.width = Math.round(sw); off.height = Math.round(sh);
    off.getContext('2d').drawImage(cropImg, sx, sy, sw, sh, 0, 0, off.width, off.height);
    const newDataUrl = off.toDataURL(cropTarget.mimeType.includes('png') ? 'image/png' : 'image/jpeg', 0.9);
    cropTarget.dataUrl = newDataUrl;
    cropTarget.thumb = newDataUrl;
    cropTarget.base64 = newDataUrl.split(',')[1];
    renderAttachments();
    cropOverlay.classList.remove('open');
    cropTarget = null;
  });

  // ---------------------------------------------------------------------
  // Voice input (Web Speech API) — hidden automatically if unsupported.
  // ---------------------------------------------------------------------
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null, isRecording = false, textBeforeRecording = '';
  if (SpeechRec) {
    recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = (navigator.language || 'en-US');
    recognition.onresult = (e) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) transcript += e.results[i][0].transcript;
      inputEl.value = (textBeforeRecording ? textBeforeRecording + ' ' : '') + transcript;
      inputEl.dispatchEvent(new Event('input'));
    };
    recognition.onerror = () => { isRecording = false; micBtn.classList.remove('recording'); };
    recognition.onend = () => { isRecording = false; micBtn.classList.remove('recording'); };
  } else {
    micBtn.style.display = 'none';
  }
  micBtn.addEventListener('click', () => {
    if (!recognition) return;
    if (isRecording) {
      recognition.stop();
    } else {
      textBeforeRecording = inputEl.value.trim();
      try { recognition.start(); isRecording = true; micBtn.classList.add('recording'); } catch {}
    }
  });

  // ---------------------------------------------------------------------
  // Sending messages
  // ---------------------------------------------------------------------
  function pruneOldAttachments(hist) {
    // Keep inlineData only on the most recent turn to control payload/storage
    // size; older attachment turns are replaced with a short text placeholder
    // (the visual "display" record below still shows the original thumbnail).
    return hist.map((m, i) => {
      const isRecent = i >= hist.length - 2;
      if (isRecent || !m.parts) return m;
      const hasInline = m.parts.some(p => p.inlineData);
      if (!hasInline) return m;
      const textPart = m.parts.find(p => p.text);
      return Object.assign({}, m, {
        parts: [{ text: (textPart ? textPart.text + ' ' : '') + '[earlier attachment omitted from context]' }]
      });
    });
  }

  async function sendToModel(userParts, historyForContext) {
    const contents = [
      { role: 'user',  parts: [{ text: SYSTEM }] },
      { role: 'model', parts: [{ text: config.modelReadyReply || `Got it! I am ${config.botName}, ready to help.` }] },
      ...historyForContext.map(h => ({ role: h.role, parts: h.parts })),
      { role: 'user',  parts: userParts }
    ];

    const res = await fetch(CHAT_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 400, temperature: 0.7 } })
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody?.error || 'HTTP ' + res.status);
    }
    const data = await res.json();
    if (!data.candidates?.length) throw new Error('no_candidates');
    return data.candidates[0].content.parts[0].text;
  }

  function buildOutgoingParts(text) {
    const otherNames = attachments.filter(a => a.kind === 'other').map(a => a.name);
    let sendText = text;
    if (otherNames.length) {
      sendText += (sendText ? '\n\n' : '') + `[Attached file(s) I can't directly read: ${otherNames.join(', ')}]`;
    }
    const parts = [];
    if (sendText) parts.push({ text: sendText });
    attachments.forEach(a => {
      if (a.sendable) parts.push({ inlineData: { mimeType: a.mimeType, data: a.base64 } });
    });
    return parts;
  }

  async function handleSend() {
    const text = inputEl.value.trim();
    if ((!text && attachments.length === 0) || isTyping || getRemaining() <= 0 || text.length > MAX_CHARS) return;

    const outgoingAttachments = attachments;
    const displayAtts = outgoingAttachments.map(a => ({ name: a.name, kind: a.kind, thumb: a.kind === 'image' ? a.thumb : null }));
    const userParts = buildOutgoingParts(text);

    inputEl.value = '';
    charCount.textContent = '0 / ' + MAX_CHARS;
    charCount.classList.remove('warn');
    inputEl.style.height = 'auto';
    attachments = [];
    renderAttachments();
    isTyping = true;
    sendEl.disabled = true;

    addMessage('user', text, displayAtts);
    const typingEl = showTyping();
    incrementLimit();
    updateLimitUI();

    try {
      const reply = await sendToModel(userParts, history);
      history.push({ role: 'user', parts: userParts, display: { text, attachments: displayAtts } });
      history.push({ role: 'model', parts: [{ text: reply }], display: { text: reply, attachments: [] } });
      if (history.length > 40) history = history.slice(-40);
      history = pruneOldAttachments(history);
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
    isOpen = true;
    positionPanel();
    panel.classList.add('open');
    renderHistory(); updateLimitUI(); renderAttachments();
    setTimeout(() => inputEl.focus(), 250);
  }
  function closePanel() { isOpen = false; panel.classList.remove('open'); }

  panel.querySelector('#ar-close').addEventListener('click', closePanel);
  document.addEventListener('click', e => {
    if (isOpen && !panel.contains(e.target) && e.target !== fab && !fab.contains(e.target) && !cropOverlay.contains(e.target)) closePanel();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) closePanel(); });

  updateLimitUI();
})();
