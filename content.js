(() => {
  // Visual-only cloned icon overlay. The site's original icon node and styles are never edited.
  const OVERLAY_CLASS = 'cds-visual-die-overlay';
  let chosenColor = '#4169e1';
  let blacklistEnabled = false;
  let blacklistSource = '#800080';
  let blacklistReplacement = '#ffa500';
  const DEFAULT_ALLOWED_COLORS = { blue: '#0000ff', gold: '#ffd700', purple: '#800080', green: '#008000', orange: '#ff8c00', red: '#ff0000' };
  let enabledColors = Object.keys(DEFAULT_ALLOWED_COLORS);
  let keybinds = { red: '1', green: '2', orange: '3', blue: '4', gold: '5', purple: '6' };
  let observer, discoverRaf = 0, boxObserver = null, observedBox = null;
  let settingsReady = false;
  let boxAvailable = false;
  const records = new Map(); // original icon -> { overlay, wrapper, oldPosition, changedPosition }

  // No viewport, visibility, or occlusion checks are used. DOM presence alone
  // determines whether a box, wrapper, and original icon are eligible.
  function numericZIndex(el) {
    if (!el || el.nodeType !== Node.ELEMENT_NODE) return null;
    const value = getComputedStyle(el).zIndex;
    if (value === 'auto') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function decodeCssContent(value) {
    if (!value || value === 'none' || value === 'normal') return '';
    // Computed CSS content is usually a quoted CSS string. Decode common CSS escapes
    // so private-use icon-font glyphs render as the same character without copying the
    // site's selector classes onto the overlay.
    let text = String(value).trim();
    if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
      text = text.slice(1, -1);
    }
    return text
      .replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex) => {
        const cp = parseInt(hex, 16);
        try { return String.fromCodePoint(cp); } catch { return ''; }
      })
      .replace(/\\([\\"'])/g, '$1');
  }

  function removeRecord(icon, record) {
    record.overlay.remove();
    if (record.changedPosition && record.wrapper.isConnected && record.wrapper.style.position === 'relative') {
      record.wrapper.style.position = record.oldPosition;
    }
    records.delete(icon);
  }

  function removeAllOverlays() {
    for (const [icon, record] of [...records]) removeRecord(icon, record);
  }

  function findDiceIcons(box) {
    if (!box) return [];
    const wrappers = [...box.querySelectorAll('.dice-wrapper')].filter(wrapper => {
      if (wrapper.closest('#tabletop') || wrapper.closest(`.${OVERLAY_CLASS}`)) return false;
      return wrapper.isConnected;
    });
    const icons = [];
    for (const wrapper of wrappers) {
      // Select from DOM structure only; do not measure screen position or visibility.
      const candidate = [...wrapper.querySelectorAll('i')].find(node =>
        !node.closest(`.${OVERLAY_CLASS}`) && node.isConnected
      );
      if (candidate) icons.push(candidate);
    }
    return icons;
  }

  function normalizeColor(value) {
    if (!value) return '';
    const text = String(value).trim().toLowerCase();
    const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hex) {
      const raw = hex[1];
      return '#' + (raw.length === 3 ? raw.split('').map(ch => ch + ch).join('') : raw);
    }
    const rgb = text.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
    if (rgb) return '#' + rgb.slice(1, 4).map(n => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, '0')).join('');
    return text;
  }

  function sourceColorFor(icon) {
    const pseudo = getComputedStyle(icon, '::before');
    const source = pseudo.color && pseudo.color !== 'rgba(0, 0, 0, 0)' ? pseudo.color : getComputedStyle(icon).color;
    return normalizeColor(source);
  }

  function blacklistMatches(icon) {
    return blacklistEnabled && sourceColorFor(icon) === normalizeColor(blacklistSource);
  }

  function isAllowedSourceColor(icon) {
    const source = sourceColorFor(icon);
    return enabledColors.some(name => DEFAULT_ALLOWED_COLORS[name] && normalizeColor(DEFAULT_ALLOWED_COLORS[name]) === source);
  }

  function shouldOverlay(icon) {
    // Explicit blacklist rules take precedence; otherwise only selected Allowed Colors
    // receive an overlay. Every other die is left completely untouched.
    return blacklistMatches(icon) || isAllowedSourceColor(icon);
  }

  function displayColorFor(icon) {
    if (blacklistMatches(icon)) return blacklistReplacement;
    return chosenColor;
  }

  function makeOverlay(icon, wrapper, box) {
    const oldPosition = wrapper.style.position;
    const changedPosition = getComputedStyle(wrapper).position === 'static';
    if (changedPosition) wrapper.style.position = 'relative';

    // Use the earlier, wrapper-centered approach: it matched the site's centered
    // dice glyph better than anchoring a replacement to the <i>'s text box.
    const overlay = document.createElement('span');
    overlay.className = OVERLAY_CLASS;
    overlay.setAttribute('aria-hidden', 'true');
    Object.assign(overlay.style, {
      position: 'absolute', inset: '0', width: '100%', height: '100%',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      pointerEvents: 'none', opacity: '1', mixBlendMode: 'normal', overflow: 'visible',
      margin: '0', padding: '0', border: '0',
      // Keep the overlay at exactly one z-index step above the dice box.
      zIndex: String((numericZIndex(box) ?? 0) + 1),
      boxSizing: 'border-box'
    });

    // Rebuild only the visible glyph, without copying the site's df-* classes.
    // Those classes can match site scripts/styles and make the page behave oddly.
    // The private-use glyph and its font come from the original icon's ::before.
    const pseudo = getComputedStyle(icon, '::before');
    const glyph = decodeCssContent(pseudo.content);
    const clone = document.createElement('span');
    clone.className = 'cds-visual-die-glyph';
    clone.setAttribute('aria-hidden', 'true');
    clone.textContent = glyph;
    Object.assign(clone.style, {
      display: 'inline-block', position: 'static', margin: '0', padding: '0',
      border: '0', width: 'auto', height: 'auto', transform: 'none',
      fontFamily: pseudo.fontFamily, fontSize: pseudo.fontSize,
      fontWeight: pseudo.fontWeight, fontStyle: pseudo.fontStyle,
      lineHeight: pseudo.lineHeight, letterSpacing: pseudo.letterSpacing,
      verticalAlign: 'middle', color: displayColorFor(icon),
      pointerEvents: 'none', opacity: '1', mixBlendMode: 'normal'
    });
    clone.style.setProperty('color', displayColorFor(icon), 'important');
    overlay.appendChild(clone);
    wrapper.appendChild(overlay);
    return { overlay, clone, wrapper, oldPosition, changedPosition };
  }

  function sync() {
    if (!document.documentElement) return;
    const box = document.querySelector('#dice-roll-box');
    // The box only needs to exist in the DOM; screen position and occlusion are ignored.
    if (!box) {
      boxAvailable = false;
      removeAllOverlays();
      return;
    }
    boxAvailable = true;
    if (!settingsReady) return;

    const eligibleIcons = findDiceIcons(box).filter(shouldOverlay);
    const alive = new Set(eligibleIcons);
    for (const [icon, record] of records) {
      if (!icon.isConnected || !alive.has(icon) || !record.wrapper.isConnected) removeRecord(icon, record);
    }

    for (const icon of alive) {
      const wrapper = icon.closest('.dice-wrapper');
      if (!wrapper || wrapper.closest('#tabletop')) continue;
      let record = records.get(icon);
      if (!record || record.wrapper !== wrapper) {
        if (record) removeRecord(icon, record);
        record = makeOverlay(icon, wrapper, box);
        records.set(icon, record);
      }
      record.clone.style.setProperty('color', displayColorFor(icon), 'important');
    }
  }

  function observeCurrentBox() {
    const box = document.querySelector('#dice-roll-box');
    if (box === observedBox) return;
    if (boxObserver) boxObserver.disconnect();
    observedBox = box;
    // DOM presence, not viewport intersection, controls readiness. This lets
    // dice get overlays while their box is off-screen and before scrolling to it.
    boxAvailable = !!box;
    if (box) scheduleSync();
  }

  function scheduleSync() {
    if (discoverRaf) return;
    discoverRaf = requestAnimationFrame(() => {
      discoverRaf = 0;
      observeCurrentBox();
      sync();
    });
  }

  function apply(color) {
    if (typeof color !== 'string' || !/^#[0-9a-f]{6}$/i.test(color)) return { ok: false, error: 'Invalid color.' };
    chosenColor = color;
    for (const [icon, record] of records) record.clone.style.setProperty('color', displayColorFor(icon), 'important');
    if (boxAvailable) sync();
    return { ok: true, count: boxAvailable ? findDiceIcons(document.querySelector('#dice-roll-box')).length : 0 };
  }

  function reset() {
    removeAllOverlays();
    return { ok: true };
  }

  chrome.runtime.onMessage.addListener((message, sender, reply) => {
    if (!message || typeof message.type !== 'string') return;
    if (message.type === 'APPLY_COLOR') {
      const result = apply(message.color);
      if (result.ok) chrome.storage.local.set({ selectedHex: message.color });
      reply(result);
      return;
    }
    if (message.type === 'SET_ENABLED_COLORS') {
      enabledColors = Array.isArray(message.colors) ? message.colors.filter(name => Object.prototype.hasOwnProperty.call(DEFAULT_ALLOWED_COLORS, name)) : [];
      chrome.storage.local.set({ enabledColors });
      if (boxAvailable) sync();
      reply({ ok: true, count: boxAvailable ? findDiceIcons(document.querySelector('#dice-roll-box')).filter(shouldOverlay).length : 0 });
      return;
    }
    if (message.type === 'SET_COLOR_BLACKLIST') {
      const source = message.source, replacement = message.replacement;
      if (typeof source !== 'string' || !/^#[0-9a-f]{6}$/i.test(source) ||
          typeof replacement !== 'string' || !/^#[0-9a-f]{6}$/i.test(replacement)) {
        reply({ ok: false, error: 'Choose valid source and replacement colors.' });
        return;
      }
      blacklistSource = source;
      blacklistReplacement = replacement;
      blacklistEnabled = message.enabled !== false;
      chrome.storage.local.set({ blacklistSource, blacklistReplacement, blacklistEnabled });
      if (boxAvailable) sync();
      reply({ ok: true, count: boxAvailable ? findDiceIcons(document.querySelector('#dice-roll-box')).length : 0 });
      return;
    }
    if (message.type === 'RESET_COLORS') {
      if (Array.isArray(message.colors)) enabledColors = message.colors.filter(name => Object.prototype.hasOwnProperty.call(DEFAULT_ALLOWED_COLORS, name));
      chrome.storage.local.set({ enabledColors });
      reset();
      if (boxAvailable) sync();
      reply({ ok: true });
    }
  });

  observer = new MutationObserver(scheduleSync);
  if (document.documentElement) observer.observe(document.documentElement, { childList: true, subtree: true });
  chrome.storage.local.get(['selectedHex', 'effectiveSelectedHex', 'enabledColors', 'pendingEnabledColors', 'blacklistSource', 'blacklistReplacement', 'blacklistEnabled', 'keybinds'], settings => {
    if (typeof settings.effectiveSelectedHex === 'string' && /^#[0-9a-f]{6}$/i.test(settings.effectiveSelectedHex)) chosenColor = settings.effectiveSelectedHex;
    else if (typeof settings.selectedHex === 'string' && /^#[0-9a-f]{6}$/i.test(settings.selectedHex)) chosenColor = settings.selectedHex;
    if (typeof settings.blacklistSource === 'string' && /^#[0-9a-f]{6}$/i.test(settings.blacklistSource)) blacklistSource = settings.blacklistSource;
    if (typeof settings.blacklistReplacement === 'string' && /^#[0-9a-f]{6}$/i.test(settings.blacklistReplacement)) blacklistReplacement = settings.blacklistReplacement;
    const startupColors = Array.isArray(settings.pendingEnabledColors) ? settings.pendingEnabledColors : settings.enabledColors;
    if (Array.isArray(startupColors)) enabledColors = startupColors.filter(name => Object.prototype.hasOwnProperty.call(DEFAULT_ALLOWED_COLORS, name));
    // Pending Allowed Colors only become active when this content script starts
    // (page load/refresh), never from a popup storage change while the page is open.
    if (Array.isArray(settings.pendingEnabledColors)) {
      chrome.storage.local.set({ enabledColors });
      chrome.storage.local.remove('pendingEnabledColors');
    }
    blacklistEnabled = settings.blacklistEnabled === true;
    if (settings.keybinds && typeof settings.keybinds === 'object' && !Array.isArray(settings.keybinds)) keybinds = settings.keybinds;
    settingsReady = true;
    scheduleSync();
  });
  scheduleSync();

  function editableTarget(target) {
    return !!(target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)));
  }
  function normalizedKey(key) {
    if (typeof key !== 'string' || key.length !== 1) return '';
    return key.toLowerCase();
  }
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.repeat || event.altKey || event.ctrlKey || event.metaKey || editableTarget(event.target)) return;
    const pressed = normalizedKey(event.key);
    if (!pressed) return;
    const colorName = Object.keys(keybinds).find(name =>
      Object.prototype.hasOwnProperty.call(DEFAULT_ALLOWED_COLORS, name) && normalizedKey(String(keybinds[name] || '')) === pressed
    );
    if (!colorName) return;
    chrome.storage.local.get(['pendingEnabledColors'], settings => {
      const pending = Array.isArray(settings.pendingEnabledColors) ? settings.pendingEnabledColors : enabledColors;
      const next = pending.includes(colorName)
        ? pending.filter(name => name !== colorName)
        : [...pending, colorName];
      chrome.storage.local.set({ pendingEnabledColors: next });
    });
  });

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== 'local') return;
    if (changes.keybinds && changes.keybinds.newValue && typeof changes.keybinds.newValue === 'object') keybinds = changes.keybinds.newValue;
    if (changes.effectiveSelectedHex && typeof changes.effectiveSelectedHex.newValue === 'string' && /^#[0-9a-f]{6}$/i.test(changes.effectiveSelectedHex.newValue)) { chosenColor = changes.effectiveSelectedHex.newValue; if (boxAvailable) sync(); }
    if (changes.enabledColors && Array.isArray(changes.enabledColors.newValue)) {
      enabledColors = changes.enabledColors.newValue.filter(name => Object.prototype.hasOwnProperty.call(DEFAULT_ALLOWED_COLORS, name));
      if (boxAvailable) sync();
    }
  });
})();
