const $ = (id) => document.getElementById(id);

const S = {
  rows: 4,
  cols: 4,
  pits: [],
  wumpus: [],
  gold: [],
  ar: 0,
  ac: 0,
  alive: true,
  won: false,
  hasGold: false,
  visited: new Set(),
  provenSafe: new Set(),
  suspectPit: new Set(),
  suspectWmp: new Set(),
  kb: [],
  stats: {
    infer: 0,
    safeProven: 0,
  },
};

const ADJ = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

const key = (r, c) => r + "|" + c;
const unkey = (s) => s.split("|").map(Number);
const valid = (r, c) => r >= 0 && r < S.rows && c >= 0 && c < S.cols;
const nearby = (r, c) =>
  ADJ.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => valid(a, b));

function buildWorld(R, C) {
  S.rows = R;
  S.cols = C;
  const mk = (v) => Array.from({ length: R }, () => Array(C).fill(v));
  S.pits = mk(false);
  S.wumpus = mk(false);
  S.gold = mk(false);
  const pool = [];
  for (let r = 0; r < R; r++) {
    for (let c = 0; c < C; c++) {
      if (!(r === 0 && c === 0)) pool.push([r, c]);
    }
  }
  shuffle(pool);
  const np = Math.max(1, 0 | (pool.length * 0.18));
  for (let i = 0; i < np; i++) S.pits[pool[i][0]][pool[i][1]] = true;
  S.wumpus[pool[np][0]][pool[np][1]] = true;
  S.gold[pool[np + 1][0]][pool[np + 1][1]] = true;
}

const shuffle = (a) => {
  for (let i = a.length - 1; i > 0; i--) {
    const j = 0 | (Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function boot() {
  haltRunner();
  S.rows = clamp(parseInt($("inp-r").value) || 4, 3, 8);
  S.cols = clamp(parseInt($("inp-c").value) || 4, 3, 8);
  buildWorld(S.rows, S.cols);
  Object.assign(S, { ar: 0, ac: 0, alive: true, won: false, hasGold: false });
  S.visited = new Set();
  S.provenSafe = new Set();
  S.suspectPit = new Set();
  S.suspectWmp = new Set();
  S.kb = [];
  S.stats = { infer: 0, safeProven: 0 };
  $("ilog").innerHTML = "";
  pushLog("System boot", "l-move");
  pushLog("Grid " + S.rows + "×" + S.cols, "l-infer");
  land(0, 0);
  draw();
  setBar("Agent online", "s-run");
}

function land(r, c) {
  const k = key(r, c);
  if (S.visited.has(k)) return;
  S.visited.add(k);
  S.ar = r;
  S.ac = c;
  if (S.pits[r][c] || S.wumpus[r][c]) {
    S.alive = false;
    const m = S.pits[r][c] ? "Fell into pit" : "Wumpus ate you";
    pushLog(m + " @(" + (r + 1) + "," + (c + 1) + ")", "l-dead");
    setBar(m, "s-dead");
    haltRunner();
    draw();
    return;
  }
  if (S.gold[r][c] && !S.hasGold) {
    S.hasGold = true;
    S.won = true;
    pushLog("Gold retrieved!", "l-safe");
    setBar("Mission complete — Gold found", "s-win");
    haltRunner();
  }
  const p = sense(r, c);
  encode(r, c, p);
  deduce();
  renderPercepts(r, c, p);
}

function sense(r, c) {
  let b = false,
    s = false,
    g = false;
  for (const [nr, nc] of nearby(r, c)) {
    if (S.pits[nr][nc]) b = true;
    if (S.wumpus[nr][nc]) s = true;
  }
  if (S.gold[r][c]) g = true;
  return { breeze: b, stench: s, glitter: g };
}

function encode(r, c, { breeze, stench }) {
  const adj = nearby(r, c);
  if (!breeze) {
    adj.forEach(([nr, nc]) => insertClause(["~P:" + nr + ":" + nc]));
  } else if (adj.length) {
    insertClause(adj.map(([nr, nc]) => "P:" + nr + ":" + nc));
  }
  if (!stench) {
    adj.forEach(([nr, nc]) => insertClause(["~W:" + nr + ":" + nc]));
  } else if (adj.length) {
    insertClause(adj.map(([nr, nc]) => "W:" + nr + ":" + nc));
  }
  refreshKB();
}

function insertClause(lits) {
  const ns = new Set(lits);
  for (const cl of S.kb) if (sub(cl, ns)) return;
  for (let i = S.kb.length - 1; i >= 0; i--) {
    if (sub(ns, S.kb[i])) S.kb.splice(i, 1);
  }
  S.kb.push(ns);
}

const sub = (a, b) => {
  for (const x of a) if (!b.has(x)) return false;
  return true;
};

const flip = (l) => (l.startsWith("~") ? l.slice(1) : "~" + l);
const ser = (cl) => [...cl].sort().join(",");

function ask(literal) {
  S.stats.infer++;
  const working = [
    ...S.kb.map((cl) => new Set(cl)),
    new Set([flip(literal)]),
  ];
  return saturate(working);
}

function saturate(clauses) {
  const seen = new Set(clauses.map(ser));
  const queue = [...clauses];
  for (let g = 0; g < 3000 && queue.length; g++) {
    const ci = queue.shift();
    for (const cj of clauses) {
      for (const res of resolve2(ci, cj)) {
        if (res.size === 0) return true;
        const s = ser(res);
        if (!seen.has(s)) {
          seen.add(s);
          queue.push(res);
          clauses.push(res);
        }
      }
    }
  }
  return false;
}

function resolve2(c1, c2) {
  const out = [];
  for (const l of c1) {
    const neg = flip(l);
    if (c2.has(neg)) {
      const r = new Set([...c1, ...c2]);
      r.delete(l);
      r.delete(neg);
      if (!isTaut(r)) out.push(r);
    }
  }
  return out;
}

const isTaut = (cl) => {
  for (const l of cl) if (cl.has(flip(l))) return true;
  return false;
};

function deduce() {
  for (let r = 0; r < S.rows; r++) {
    for (let c = 0; c < S.cols; c++) {
      const k = key(r, c);
      if (S.visited.has(k)) continue;
      const sp = ask("~P:" + r + ":" + c),
        sw = ask("~W:" + r + ":" + c);
      if (sp && sw) {
        if (!S.provenSafe.has(k)) {
          S.provenSafe.add(k);
          S.stats.safeProven++;
          pushLog("Safe proven (" + (r + 1) + "," + (c + 1) + ")", "l-safe");
        }
        S.suspectPit.delete(k);
        S.suspectWmp.delete(k);
      } else {
        if (ask("P:" + r + ":" + c)) S.suspectPit.add(k);
        if (ask("W:" + r + ":" + c)) S.suspectWmp.add(k);
      }
    }
  }
  refreshMetrics();
}

function tick() {
  if (!S.alive || S.won) return;
  const { ar, ac } = S;
  const adjUnvis = nearby(ar, ac).filter(
    ([nr, nc]) => !S.visited.has(key(nr, nc))
  );
  for (const [nr, nc] of adjUnvis) {
    if (S.provenSafe.has(key(nr, nc))) {
      pushLog("Move \u2192 (" + (nr + 1) + "," + (nc + 1) + ") [safe]", "l-move");
      S.ar = nr;
      S.ac = nc;
      land(nr, nc);
      draw();
      return;
    }
  }
  const target = pickTarget();
  if (target) {
    const path = bfs(ar, ac, target[0], target[1]);
    if (path && path.length) {
      const [nr, nc] = path[0];
      pushLog("Nav \u2192 (" + (nr + 1) + "," + (nc + 1) + ")", "l-move");
      S.ar = nr;
      S.ac = nc;
      land(nr, nc);
      draw();
      return;
    }
  }
  const brave = adjUnvis.filter(([nr, nc]) => {
    const k = key(nr, nc);
    return !S.suspectPit.has(k) && !S.suspectWmp.has(k);
  });
  if (brave.length) {
    const [nr, nc] = brave[0 | (Math.random() * brave.length)];
    pushLog("Brave \u2192 (" + (nr + 1) + "," + (nc + 1) + ") [unknown]", "l-dead");
    S.ar = nr;
    S.ac = nc;
    land(nr, nc);
    draw();
    return;
  }
  pushLog("No safe move \u2014 stuck", "l-dead");
  haltRunner();
  draw();
}

function pickTarget() {
  for (const k of S.provenSafe) {
    if (!S.visited.has(k)) return unkey(k);
  }
  return null;
}

function bfs(sr, sc, tr, tc) {
  const q = [[sr, sc, []]],
    seen = new Set([key(sr, sc)]);
  while (q.length) {
    const [r, c, p] = q.shift();
    for (const [nr, nc] of nearby(r, c)) {
      const nk = key(nr, nc);
      if (seen.has(nk)) continue;
      seen.add(nk);
      const np = [...p, [nr, nc]];
      if (nr === tr && nc === tc) return np;
      if (S.visited.has(nk) || S.provenSafe.has(nk)) q.push([nr, nc, np]);
    }
  }
  return null;
}

let runner = null,
  spd = 420,
  running = false;

function toggleRun() {
  if (running) {
    haltRunner();
    return;
  }
  if (!S.alive || S.won) {
    boot();
    return;
  }
  running = true;
  $("run-btn").innerHTML = '<i class="bi bi-stop-fill"></i> Stop';
  runner = setInterval(() => {
    if (!S.alive || S.won) {
      haltRunner();
      return;
    }
    tick();
  }, spd);
}

function haltRunner() {
  if (runner) {
    clearInterval(runner);
    runner = null;
  }
  running = false;
  $("run-btn").innerHTML = '<i class="bi bi-play-fill"></i> Auto Run';
}

function setSpd(ms, btn) {
  spd = ms;
  document
    .querySelectorAll(".speed-tab")
    .forEach((t) => t.classList.remove("on"));
  btn.classList.add("on");
  if (running) {
    haltRunner();
    toggleRun();
  }
}

function draw() {
  const wrap = $("world");
  wrap.style.gridTemplateColumns = "repeat(" + S.cols + ",var(--cell-w))";
  wrap.style.gridTemplateRows = "repeat(" + S.rows + ",var(--cell-h))";
  wrap.innerHTML = "";
  const reveal = !S.alive || S.won;
  for (let r = S.rows - 1; r >= 0; r--) {
    for (let c = 0; c < S.cols; c++) {
      const el = document.createElement("div");
      el.className = "cell";
      const k = key(r, c),
        isMe = S.ar === r && S.ac === c;
      const vis = S.visited.has(k),
        safe = S.provenSafe.has(k);
      const bP = S.suspectPit.has(k),
        bW = S.suspectWmp.has(k);
      if (reveal && S.pits[r][c]) el.classList.add("c-pit");
      else if (reveal && S.wumpus[r][c]) el.classList.add("c-wmp");
      else if (vis) el.classList.add("c-vis");
      else if (safe) el.classList.add("c-safe");
      else el.classList.add("c-unk");
      if (isMe) el.classList.add("c-agent");
      const coord = document.createElement("div");
      coord.className = "c-coord";
      coord.textContent = r + 1 + "," + (c + 1);
      el.appendChild(coord);
      const icon = document.createElement("i");
      icon.className = "c-icon";
      if (isMe) {
        icon.className += S.alive ? " bi bi-robot" : " bi bi-skull";
      } else if (reveal && S.pits[r][c]) {
        icon.className += " bi bi-patch-minus-fill";
      } else if (reveal && S.wumpus[r][c]) {
        icon.className += " bi bi-bug-fill";
      } else if (vis && S.gold[r][c] && S.won) {
        icon.className += " bi bi-gem";
      }
      el.appendChild(icon);
      if (!vis && !isMe) {
        const inf = document.createElement("div");
        inf.className = "c-inf";
        if (bP || bW) {
          inf.textContent = "\u2715";
          inf.classList.add("c-inf-bad");
        } else if (safe) {
          inf.textContent = "OK";
          inf.classList.add("c-inf-safe");
        }
        el.appendChild(inf);
      }
      if (vis && !isMe) {
        const p = sense(r, c);
        if (p.breeze || p.stench || p.glitter) {
          const pi = document.createElement("div");
          pi.className = "c-perc";
          if (p.breeze)
            pi.innerHTML += '<i class="bi bi-wind" style="color:var(--cyan)"></i>';
          if (p.stench)
            pi.innerHTML +=
              '<i class="bi bi-cloud-haze2" style="color:#fb923c"></i>';
          if (p.glitter)
            pi.innerHTML += '<i class="bi bi-stars" style="color:var(--amber)"></i>';
          el.appendChild(pi);
        }
      }
      wrap.appendChild(el);
    }
  }
}

function renderPercepts(r, c, p) {
  const b = $("percepts");
  b.innerHTML = "";
  let any = false;
  if (p.stench) {
    b.innerHTML +=
      '<span class="tag tag-stench"><i class="bi bi-cloud-haze2"></i> Stench</span>';
    any = true;
  }
  if (p.breeze) {
    b.innerHTML +=
      '<span class="tag tag-breeze"><i class="bi bi-wind"></i> Breeze</span>';
    any = true;
  }
  if (p.glitter) {
    b.innerHTML +=
      '<span class="tag tag-glitter"><i class="bi bi-stars"></i> Glitter</span>';
    any = true;
  }
  if (!any) b.innerHTML = '<span class="tag tag-none">None</span>';
}

function refreshMetrics() {
  $("m0").textContent = S.stats.infer;
  $("m1").textContent = S.visited.size;
  $("m2").textContent = S.stats.safeProven;
  $("m3").textContent = S.kb.length;
}

function refreshKB() {
  const el = $("kb-view");
  if (!S.kb.length) {
    el.textContent = "\u2014";
    return;
  }
  el.innerHTML = S.kb
    .slice(-60)
    .map((cl) =>
      [...cl]
        .map((l) => {
          const neg = l.startsWith("~");
          const parts = (neg ? l.slice(1) : l).split(":");
          return (
            (neg ? "\xac" : "") +
            parts[0] +
            "(" +
            (+parts[1] + 1) +
            "," +
            (+parts[2] + 1) +
            ")"
          );
        })
        .join("\u2228")
    )
    .join("<br>");
  el.scrollTop = el.scrollHeight;
}

function setBar(msg, cls) {
  const el = $("sbar");
  el.className = "statusbar " + cls;
  el.textContent = msg;
}

function pushLog(msg, cls) {
  const el = $("ilog"),
    d = document.createElement("div");
  if (cls) d.className = cls;
  d.textContent = "\u203a " + msg;
  el.appendChild(d);
  el.scrollTop = el.scrollHeight;
  while (el.children.length > 200) el.removeChild(el.firstChild);
}

boot();

function openModal() {
  document.getElementById("legend-modal").classList.add("show");
}

function closeModal() {
  document.getElementById("legend-modal").classList.remove("show");
}

function switchPanel(name, btn) {
  document.querySelectorAll(".panel").forEach((p) => p.classList.remove("show"));
  document
    .querySelectorAll(".nav-tab")
    .forEach((t) => t.classList.remove("on"));
  document.getElementById("panel-" + name).classList.add("show");
  btn.classList.add("on");
}
