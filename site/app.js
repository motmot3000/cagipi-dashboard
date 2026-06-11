/* =========================================================
   {CagiPi} Dashboard — app.js
   Vanilla JS, no external dependencies, defer-loaded.
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   0. Sécurité — échappement HTML systématique
   --------------------------------------------------------- */
function esc(s) {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Valide un lien : accepte https://, http:// ou /  Rejette tout le reste
 * (javascript:, data:, vbscript:…)
 */
function safeLink(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }
  return null;
}

/* ---------------------------------------------------------
   1. Horloge & fraîcheur
   --------------------------------------------------------- */
let _generatedAt = null;   // ISO string stocké pour recalcul

function pad2(n) {
  return String(n).padStart(2, '0');
}

function tickClock() {
  const now = new Date();

  // Horloge HH:MM:SS
  const clockEl = document.getElementById('clock');
  if (clockEl) {
    clockEl.textContent =
      pad2(now.getHours()) + ':' +
      pad2(now.getMinutes()) + ':' +
      pad2(now.getSeconds());
  }

  // Date FR longue : "mercredi 10 juin 2026"
  const dateEl = document.getElementById('date');
  if (dateEl) {
    dateEl.textContent = now.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  // Freshness badge
  if (_generatedAt) {
    updateFreshness(_generatedAt);
  }
}

function updateFreshness(generatedAt) {
  _generatedAt = generatedAt;
  const badge = document.getElementById('freshness');
  if (!badge) return;

  const genTime = new Date(generatedAt);
  if (isNaN(genTime.getTime())) {
    badge.textContent = 'données indisponibles';
    badge.className = 'badge stale';
    return;
  }

  const diffMs = Date.now() - genTime.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;

  let label;
  if (diffMin < 1) {
    label = 'à l\'instant';
  } else if (diffH === 0) {
    label = 'il y a ' + diffMin + ' min';
  } else if (remMin === 0) {
    label = 'il y a ' + diffH + ' h';
  } else {
    label = 'il y a ' + diffH + ' h ' + remMin + ' min';
  }

  badge.textContent = label;
  // fresh ≤ 2 h, stale > 2 h
  badge.className = 'badge ' + (diffMin <= 120 ? 'fresh' : 'stale');
}

/* ---------------------------------------------------------
   2. Helpers DOM
   --------------------------------------------------------- */
/**
 * Affiche ou masque le paragraphe .empty d'une section.
 * @param {string} sectionId  id de la <section>
 * @param {boolean} isEmpty
 */
function toggleEmpty(sectionId, isEmpty) {
  const section = document.getElementById(sectionId);
  if (!section) return;
  const empty = section.querySelector('.empty');
  if (!empty) return;
  if (isEmpty) {
    empty.classList.remove('hidden');
  } else {
    empty.classList.add('hidden');
  }
}

/* ---------------------------------------------------------
   3. Todos (stockage serveur : GET/PUT /todos)
   --------------------------------------------------------- */
let _todos = [];

function renderTodos() {
  const ul = document.getElementById('todo-list');
  if (!ul) return;

  toggleEmpty('todo', _todos.length === 0);
  ul.innerHTML = '';

  for (const todo of _todos) {
    const li = document.createElement('li');
    if (todo.done) li.classList.add('done');

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.checked = todo.done;
    checkbox.addEventListener('change', () => {
      todo.done = checkbox.checked;
      saveTodos();
    });
    li.appendChild(checkbox);

    const textEl = document.createElement('span');
    textEl.className = 'todo-text';
    textEl.textContent = todo.text;
    li.appendChild(textEl);

    const delBtn = document.createElement('button');
    delBtn.className = 'todo-del';
    delBtn.type = 'button';
    delBtn.textContent = '✕';
    delBtn.setAttribute('aria-label', 'Supprimer');
    delBtn.addEventListener('click', () => {
      _todos = _todos.filter((t) => t !== todo);
      saveTodos();
    });
    li.appendChild(delBtn);

    ul.appendChild(li);
  }
}

async function loadTodos() {
  try {
    const res = await fetch('/todos', { cache: 'no-store' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const todos = await res.json();
    if (Array.isArray(todos)) {
      _todos = todos;
      renderTodos();
    }
  } catch (err) {
    console.error('[CagiPi] Erreur chargement todos :', err);
  }
}

async function saveTodos() {
  renderTodos();  // optimistic : l'UI reflète l'état local immédiatement
  try {
    const res = await fetch('/todos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(_todos),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    _todos = await res.json();  // version assainie par le serveur
    renderTodos();
  } catch (err) {
    console.error('[CagiPi] Erreur sauvegarde todos :', err);
  }
}

function initTodoForm() {
  const form = document.getElementById('todo-form');
  const input = document.getElementById('todo-input');
  if (!form || !input) return;
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    _todos.push({
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      text: text,
      done: false,
    });
    input.value = '';
    saveTodos();
  });
}

/* ---------------------------------------------------------
   4. Rendu mails (perso + pro, même fonction)
   --------------------------------------------------------- */
function renderMail(list, listId) {
  const ul = document.getElementById(listId);
  if (!ul) return;

  // Déterminer la section parente pour toggleEmpty
  // listId = "mail-perso-list" → sectionId = "mail-perso"
  const sectionId = listId.replace('-list', '');

  if (!Array.isArray(list) || list.length === 0) {
    toggleEmpty(sectionId, true);
    ul.innerHTML = '';
    return;
  }

  toggleEmpty(sectionId, false);
  ul.innerHTML = '';  // réinitialise avant rechargement

  for (const item of list) {
    const li = document.createElement('li');
    if (item.important === true) {
      li.classList.add('important');
    }

    // From
    const fromEl = document.createElement('span');
    fromEl.className = 'mail-from';
    fromEl.textContent = item.from || '';
    li.appendChild(fromEl);

    // Subject (lien si link valide, sinon span)
    const validLink = safeLink(item.link);
    const subjectEl = validLink
      ? document.createElement('a')
      : document.createElement('span');
    subjectEl.className = 'mail-subject';
    subjectEl.textContent = item.subject || '';
    if (validLink) {
      subjectEl.href = validLink;
      subjectEl.target = '_blank';
      subjectEl.rel = 'noopener noreferrer';
    }
    li.appendChild(subjectEl);

    // Snippet
    if (item.snippet) {
      const snippetEl = document.createElement('span');
      snippetEl.className = 'mail-snippet';
      snippetEl.textContent = item.snippet;
      li.appendChild(snippetEl);
    }

    // When
    if (item.when) {
      const whenEl = document.createElement('span');
      whenEl.className = 'mail-when';
      whenEl.textContent = item.when;
      li.appendChild(whenEl);
    }

    ul.appendChild(li);
  }
}

/* ---------------------------------------------------------
   5. Rendu agenda
   --------------------------------------------------------- */
/**
 * Formate l'heure d'un ISO string en "HH:MM"
 */
function fmtTime(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

/**
 * Formate une date courte FR pour les événements hors aujourd'hui : "mer 10"
 */
function fmtShortDate(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

/**
 * Vérifie si deux dates sont le même jour calendaire (local)
 */
function isSameDay(d1, d2) {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

function renderAgenda(events) {
  const ul = document.getElementById('agenda-list');
  if (!ul) return;

  if (!Array.isArray(events) || events.length === 0) {
    toggleEmpty('agenda', true);
    ul.innerHTML = '';
    return;
  }

  toggleEmpty('agenda', false);
  ul.innerHTML = '';

  const today = new Date();

  for (const ev of events) {
    const li = document.createElement('li');

    // Titre
    const titleEl = document.createElement('span');
    titleEl.className = 'event-title';
    titleEl.textContent = ev.title || '';
    li.appendChild(titleEl);

    // Heure
    const startD = ev.start ? new Date(ev.start) : null;
    const endD   = ev.end   ? new Date(ev.end)   : null;

    let timeStr = '';
    if (startD && !isNaN(startD.getTime())) {
      const startFmt = fmtTime(ev.start);
      const endFmt   = (endD && !isNaN(endD.getTime())) ? fmtTime(ev.end) : '';

      // Si ce n'est pas aujourd'hui, préfixer la date courte
      const datePrefix = !isSameDay(startD, today)
        ? fmtShortDate(ev.start) + ' '
        : '';

      timeStr = datePrefix + startFmt;
      if (endFmt && endFmt !== startFmt) {
        timeStr += '–' + endFmt;
      }
    }

    if (timeStr) {
      const timeEl = document.createElement('span');
      timeEl.className = 'event-time';
      timeEl.textContent = timeStr;
      li.appendChild(timeEl);
    }

    // Location
    if (ev.location && ev.location.trim() !== '') {
      const locEl = document.createElement('span');
      locEl.className = 'event-location';
      locEl.textContent = ev.location;
      li.appendChild(locEl);
    }

    ul.appendChild(li);
  }
}

/* ---------------------------------------------------------
   6. Rendu Trilium notes
   --------------------------------------------------------- */
/**
 * Date relative courte en français.
 * "il y a X min", "il y a X h", "hier", "il y a X j"
 */
function relativeDate(isoStr) {
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';

  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  const diffH   = Math.floor(diffMin / 60);
  const diffD   = Math.floor(diffH / 24);

  if (diffMin < 1)  return 'à l\'instant';
  if (diffMin < 60) return 'il y a ' + diffMin + ' min';
  if (diffH < 24)   return 'il y a ' + diffH + ' h';
  if (diffD === 1)  return 'hier';
  return 'il y a ' + diffD + ' j';
}

function renderTrilium(notes) {
  const ul = document.getElementById('trilium-list');
  if (!ul) return;

  if (!Array.isArray(notes) || notes.length === 0) {
    toggleEmpty('trilium', true);
    ul.innerHTML = '';
    return;
  }

  toggleEmpty('trilium', false);
  ul.innerHTML = '';

  for (const note of notes) {
    const li = document.createElement('li');

    // Titre — lien si link valide
    const validLink = safeLink(note.link);
    const titleEl = validLink
      ? document.createElement('a')
      : document.createElement('span');
    titleEl.className = 'note-title';
    titleEl.textContent = note.title || '';
    if (validLink) {
      titleEl.href = validLink;
    }
    li.appendChild(titleEl);

    // Date relative
    if (note.modified) {
      const dateEl = document.createElement('span');
      dateEl.className = 'note-date';
      dateEl.textContent = relativeDate(note.modified);
      li.appendChild(dateEl);
    }

    ul.appendChild(li);
  }
}

/* ---------------------------------------------------------
   7. Rendu digest (markdown minimal → HTML sécurisé)
   --------------------------------------------------------- */
/**
 * Convertit un markdown minimal en HTML.
 * Sécurité : on échappe le texte BRUT avant de poser les balises générées.
 *
 * Ordre de traitement :
 *   1. Découper en lignes
 *   2. Pour chaque ligne : détecter ## / - / sinon texte libre
 *   3. Traiter l'inline (**gras**) sur le texte déjà échappé
 *   4. Regrouper lignes vides en séparateurs de paragraphes
 */
function renderDigest(md) {
  const container = document.getElementById('digest-content');
  if (!container) return;

  const emptyP = container.querySelector('.empty');

  if (!md || md.trim() === '') {
    if (emptyP) emptyP.classList.remove('hidden');
    // Supprimer tout sauf .empty
    Array.from(container.childNodes).forEach(n => {
      if (!n.classList || !n.classList.contains('empty')) {
        container.removeChild(n);
      }
    });
    return;
  }

  if (emptyP) emptyP.classList.add('hidden');

  // Construire un fragment HTML
  const lines = md.split('\n');

  // On accumule les blocs
  // Chaque bloc = { type: 'h3'|'ul'|'p', content: string|string[] }
  const blocks = [];
  let ulItems = null;       // accumulateur de liste en cours
  let pLines  = [];         // lignes de paragraphe en cours

  function flushParagraph() {
    if (pLines.length > 0) {
      blocks.push({ type: 'p', content: pLines.join(' ') });
      pLines = [];
    }
  }
  function flushUl() {
    if (ulItems && ulItems.length > 0) {
      blocks.push({ type: 'ul', items: ulItems });
      ulItems = null;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine;

    // Ligne vide → flush paragraphe en cours
    if (line.trim() === '') {
      flushParagraph();
      flushUl();
      continue;
    }

    // Titre ## X
    if (line.startsWith('## ')) {
      flushParagraph();
      flushUl();
      blocks.push({ type: 'h3', content: line.slice(3) });
      continue;
    }

    // Item de liste - X
    if (line.match(/^[-*] /)) {
      flushParagraph();
      if (!ulItems) ulItems = [];
      ulItems.push(line.slice(2));
      continue;
    }

    // Texte libre : si une liste était en cours, on la ferme
    flushUl();
    pLines.push(line);
  }
  // Flush final
  flushParagraph();
  flushUl();

  /**
   * Traitement inline : **gras**
   * Appliqué sur un texte DÉJÀ ÉCHAPPÉ via esc().
   * On remplace `**texte**` par `<strong>texte</strong>`.
   * Comme le texte est déjà échappé, pas de risque d'injection.
   */
  function inlineMarkup(escapedText) {
    // Remplacer **…** par <strong>…</strong>
    return escapedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  }

  // Construire le DOM à partir des blocs
  // On vide le container (sauf .empty déjà géré)
  // Reconstruire proprement
  container.innerHTML = '';

  // Remettre .empty (caché) pour respecter la structure HTML initiale
  const newEmpty = document.createElement('p');
  newEmpty.className = 'empty hidden';
  newEmpty.textContent = 'Pas encore de digest.';
  container.appendChild(newEmpty);

  for (const block of blocks) {
    if (block.type === 'h3') {
      const el = document.createElement('h3');
      el.innerHTML = inlineMarkup(esc(block.content));
      container.appendChild(el);
    } else if (block.type === 'p') {
      const el = document.createElement('p');
      el.innerHTML = inlineMarkup(esc(block.content));
      container.appendChild(el);
    } else if (block.type === 'ul') {
      const ul = document.createElement('ul');
      for (const item of block.items) {
        const li = document.createElement('li');
        li.innerHTML = inlineMarkup(esc(item));
        ul.appendChild(li);
      }
      container.appendChild(ul);
    }
  }
}

/* ---------------------------------------------------------
   7b. LEDs statut outils
   tools = {greenlight: bool, trilium: bool, nas: bool, kuma: bool}
   absent/null → LED neutre (statut inconnu)
   --------------------------------------------------------- */
function renderTools(tools) {
  document.querySelectorAll('.led[data-tool]').forEach(function (led) {
    const state = tools ? tools[led.dataset.tool] : null;
    led.classList.toggle('on', state === true);
    led.classList.toggle('off', state === false);
  });
}

/* ---------------------------------------------------------
   8. Gestion des erreurs globales d'affichage
   --------------------------------------------------------- */
function showGlobalError(msg) {
  const badge = document.getElementById('freshness');
  if (badge) {
    badge.textContent = msg || 'données indisponibles';
    badge.className = 'badge stale';
  }
}

/* ---------------------------------------------------------
   9. Chargement des données
   --------------------------------------------------------- */
async function loadData() {
  let data = null;

  try {
    // Tente data.json (production)
    let res = await fetch('data.json', { cache: 'no-store' });

    if (!res.ok) {
      // Fallback data.sample.json (dev, 404 data.json)
      res = await fetch('data.sample.json', { cache: 'no-store' });
    }

    if (!res.ok) {
      throw new Error('Impossible de charger les données (' + res.status + ')');
    }

    data = await res.json();
  } catch (err) {
    console.error('[CagiPi] Erreur chargement données :', err);
    showGlobalError('données indisponibles');
    return;
  }

  // Rendu des sections
  // status === 'partial' est géré implicitement :
  // si une section est absente/vide, les toggleEmpty afficheront .empty
  renderMail(data.mail_perso || [], 'mail-perso-list');
  renderMail(data.mail_pro   || [], 'mail-pro-list');
  renderAgenda(data.agenda   || []);
  renderTrilium(data.trilium || []);
  renderDigest(data.digest_md || '');
  renderTools(data.tools || null);

  // Freshness
  if (data.generated_at) {
    updateFreshness(data.generated_at);
  }
}

/* ---------------------------------------------------------
   10. Initialisation
   --------------------------------------------------------- */
(function init() {
  // Démarrer l'horloge immédiatement, puis toutes les secondes
  tickClock();
  setInterval(tickClock, 1000);

  // Premier chargement des données
  loadData();

  // Todos : formulaire + chargement + resynchro 60 s (autres appareils)
  initTodoForm();
  loadTodos();
  setInterval(loadTodos, 60000);

  // Rafraîchissement automatique toutes les 60 s
  setInterval(loadData, 60000);
})();
