const CHARACTERS = {
  stefan: { name: "Stefan", goods: ["🔋", "💾"], catcher: "drone", vessel: "battery" },
  adam: { name: "Adam", goods: ["🎫", "🗺️", "🛂"], catcher: "backpack", vessel: "suitcase" },
  aleksa: { name: "Aleksa", goods: ["🌭"], catcher: "dachshund", vessel: "bowl" },
};

const TRAPS = ["🐛", "JIRA", "CONFLICT"];
const BONUS = "☕";

// Fill % at which each of the 4 images appears; 100% wins.
const STAGE_AT = [0, 25, 50, 75];
const LIVES = 5;
const FILL_PER_CATCH = 4;
const TRAP_PENALTY = 8;

const W = 600;
const H = 400;
const CATCHER_W = 110;
const CATCHER_Y = H - 55;

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const screens = {
  choose: document.getElementById("choose"),
  play: document.getElementById("play"),
  end: document.getElementById("end"),
};
const stageImg = document.getElementById("stage");

let state = null;
const keys = { left: false, right: false };

function imagePath(key, n) {
  return `img/${key}-${n}.jpg`;
}

function placeholder(name, n) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="533" viewBox="0 0 300 533">
    <rect width="300" height="533" fill="#fff"/>
    <circle cx="150" cy="120" r="45" fill="#d6d6d6"/>
    <rect x="95" y="175" width="110" height="190" rx="40" fill="#d6d6d6"/>
    <rect x="105" y="345" width="38" height="160" rx="16" fill="#d6d6d6"/>
    <rect x="157" y="345" width="38" height="160" rx="16" fill="#d6d6d6"/>
    <text x="150" y="50" font-family="Georgia" font-size="32" font-weight="bold" text-anchor="middle" fill="#0d4d24">${name}</text>
    <text x="150" y="525" font-family="Georgia" font-size="22" text-anchor="middle" fill="#888">stage ${n}/4</text>
  </svg>`;
  return "data:image/svg+xml," + encodeURIComponent(svg);
}

function showImage(el, key, n) {
  el.onerror = () => {
    el.onerror = null;
    el.src = placeholder(CHARACTERS[key].name, n);
  };
  el.src = imagePath(key, n);
}

function show(name) {
  for (const [key, el] of Object.entries(screens)) el.classList.toggle("hidden", key !== name);
}

function buildCards() {
  const cards = document.getElementById("cards");
  for (const key of Object.keys(CHARACTERS)) {
    const btn = document.createElement("button");
    btn.className = "card";
    btn.type = "button";
    const img = document.createElement("img");
    img.alt = CHARACTERS[key].name;
    showImage(img, key, 1);
    const label = document.createElement("span");
    label.textContent = CHARACTERS[key].name;
    btn.append(img, label);
    btn.addEventListener("click", () => start(key));
    cards.append(btn);
    // Warm the cache so stage swaps don't flash.
    for (let n = 2; n <= 4; n++) new Image().src = imagePath(key, n);
  }
}

function start(key) {
  state = {
    key,
    char: CHARACTERS[key],
    fill: 0,
    lives: LIVES,
    score: 0,
    stage: 1,
    items: [],
    popups: [],
    catcherX: W / 2,
    facing: 1,
    spawnIn: 0.5,
    flash: 0,
    last: performance.now(),
    over: false,
  };
  showImage(stageImg, key, 1);
  show("play");
  requestAnimationFrame(tick);
}

function finish(won) {
  state.over = true;
  if (won) Sound.win();
  else Sound.lose();
  const { key, char, score } = state;
  document.getElementById("end-title").textContent = won ? "DEPLOYED TO PRODUCTION 🚀" : "BUILD FAILED";
  document.getElementById("end-text").textContent = won
    ? `${char.name} is fully shipped. Score: ${score}`
    : `${LIVES} items dropped. Rollback! Score: ${score}`;
  showImage(document.getElementById("end-img"), key, won ? 4 : state.stage);
  show("end");
}

function spawn() {
  const roll = Math.random();
  const kind = roll < 0.7 ? "good" : roll < 0.92 ? "trap" : "bonus";
  const pool = kind === "good" ? state.char.goods : kind === "trap" ? TRAPS : [BONUS];
  state.items.push({
    kind,
    glyph: pool[Math.floor(Math.random() * pool.length)],
    x: 30 + Math.random() * (W - 60),
    y: -20,
    speed: 110 + state.fill * 2 + Math.random() * 60,
    wobble: Math.random() * Math.PI * 2,
  });
}

function setFill(value) {
  state.fill = Math.max(0, Math.min(100, value));
  const stage = STAGE_AT.filter((at) => state.fill >= at).length;
  if (stage > state.stage) {
    state.stage = stage;
    showImage(stageImg, state.key, stage);
    Sound.levelUp();
    state.popups.push({ text: "LEVEL UP!", x: W / 2, y: H / 2, t: 1.2, color: "#fff" });
  }
  if (state.fill >= 100) finish(true);
}

function catchItem(item) {
  if (item.kind === "good") {
    Sound.good();
    state.score += 10;
    setFill(state.fill + FILL_PER_CATCH);
  } else if (item.kind === "trap") {
    state.score = Math.max(0, state.score - 15);
    Sound.bad();
    state.flash = 0.4;
    state.fill = Math.max(0, state.fill - TRAP_PENALTY);
    state.popups.push({ text: `-${TRAP_PENALTY}% bug in prod`, x: item.x, y: CATCHER_Y - 20, t: 1, color: "#ffdddd" });
  } else {
    Sound.bonus();
    state.score += 25;
    state.lives = Math.min(LIVES, state.lives + 1);
    state.popups.push({ text: "+1 life", x: item.x, y: CATCHER_Y - 20, t: 1, color: "#fff4c2" });
  }
}

function update(dt) {
  if (keys.left) moveCatcher(state.catcherX - 420 * dt);
  if (keys.right) moveCatcher(state.catcherX + 420 * dt);

  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    spawn();
    state.spawnIn = Math.max(0.35, 1.1 - state.fill / 140) * (0.7 + Math.random() * 0.6);
  }

  const left = state.catcherX - CATCHER_W / 2;
  const right = state.catcherX + CATCHER_W / 2;
  for (const item of state.items) {
    item.y += item.speed * dt;
    item.wobble += dt * 3;
    if (!item.done && item.y >= CATCHER_Y && item.y <= CATCHER_Y + 25 && item.x >= left && item.x <= right) {
      item.done = true;
      catchItem(item);
      if (state.over) return;
    } else if (!item.done && item.y > H + 20) {
      item.done = true;
      if (item.kind === "good") {
        Sound.miss();
        state.lives -= 1;
        if (state.lives <= 0) return finish(false);
      }
    }
  }
  state.items = state.items.filter((i) => !i.done);

  for (const p of state.popups) {
    p.t -= dt;
    p.y -= 30 * dt;
  }
  state.popups = state.popups.filter((p) => p.t > 0);
  state.flash = Math.max(0, state.flash - dt);
}

function drawBackground() {
  const g = ctx.createRadialGradient(W * 0.4, H * 0.45, 20, W * 0.5, H * 0.5, W * 0.7);
  g.addColorStop(0, "#b7d94a");
  g.addColorStop(0.45, "#2f8a35");
  g.addColorStop(1, "#0d4d24");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const fade = ctx.createLinearGradient(0, H * 0.6, 0, H);
  fade.addColorStop(0, "rgba(255,255,255,0)");
  fade.addColorStop(1, "rgba(255,255,255,0.95)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, W, H);

  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.fillStyle = "#06331a";
  ctx.font = "italic bold 64px Georgia";
  ctx.textAlign = "center";
  ctx.fillText("git push --force", W / 2, H / 2 + 20);
  ctx.restore();
}

function vesselPath(kind) {
  const p = new Path2D();
  if (kind === "bowl") {
    p.moveTo(14, 70);
    p.lineTo(106, 70);
    p.lineTo(94, 110);
    p.lineTo(26, 110);
    p.closePath();
  } else if (kind === "battery") {
    p.rect(30, 22, 50, 92);
  } else {
    p.roundRect(16, 40, 88, 72, 8);
  }
  return p;
}

function drawVessel() {
  const kind = state.char.vessel;
  const shape = vesselPath(kind);
  const top = kind === "bowl" ? 70 : kind === "battery" ? 22 : 40;
  const bottom = kind === "bowl" ? 110 : kind === "battery" ? 114 : 112;
  const level = bottom - (bottom - top) * (state.fill / 100);

  ctx.save();
  ctx.translate(10, 4);

  if (kind === "battery") {
    ctx.fillStyle = "#ddd";
    ctx.fillRect(45, 14, 20, 9);
  } else if (kind === "suitcase") {
    ctx.strokeStyle = "#5a3412";
    ctx.lineWidth = 5;
    ctx.strokeRect(46, 28, 28, 14);
  }

  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill(shape);
  ctx.save();
  ctx.clip(shape);
  const fillColor = { bowl: "#b5562b", battery: state.fill < 20 ? "#e53935" : "#7ed957", suitcase: "#c98b3c" }[kind];
  ctx.fillStyle = fillColor;
  ctx.fillRect(0, level, 120, bottom - level + 2);
  ctx.restore();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#f4ecd2";
  ctx.stroke(shape);

  ctx.fillStyle = "#fff";
  ctx.font = "bold 16px Georgia";
  ctx.textAlign = "center";
  ctx.fillText(`${Math.round(state.fill)}%`, 60, 132);
  ctx.restore();
}

let dachshundSprite = null;

// Flood-fill the white background from the edges so the eye highlights stay white.
function cutOutBackground(img) {
  const off = document.createElement("canvas");
  off.width = img.naturalWidth;
  off.height = img.naturalHeight;
  const octx = off.getContext("2d");
  octx.drawImage(img, 0, 0);
  const { width: w, height: h } = off;
  const data = octx.getImageData(0, 0, w, h);
  const px = data.data;
  const isBg = (i) => px[i + 3] < 20 || (px[i] > 225 && px[i + 1] > 225 && px[i + 2] > 225);
  const seen = new Uint8Array(w * h);
  const stack = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop();
    if (seen[p] || !isBg(p * 4)) continue;
    seen[p] = 1;
    px[p * 4 + 3] = 0;
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
  let minX = w, minY = h, maxX = 0, maxY = 0;
  for (let p = 0; p < w * h; p++) {
    if (px[p * 4 + 3] === 0) continue;
    const x = p % w, y = (p / w) | 0;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  octx.putImageData(data, 0, 0);
  const trimmed = document.createElement("canvas");
  trimmed.width = maxX - minX + 1;
  trimmed.height = maxY - minY + 1;
  trimmed.getContext("2d").drawImage(off, -minX, -minY);
  return trimmed;
}

const dachshundImg = new Image();
dachshundImg.onload = () => {
  try {
    dachshundSprite = cutOutBackground(dachshundImg);
  } catch {
    // file:// taints the canvas; draw the raw image instead.
    dachshundSprite = dachshundImg;
  }
};
dachshundImg.src = "img/dachshund.png";

function drawDachshund(x, y, facing) {
  if (!dachshundSprite) return;
  const h = 70;
  const w = (dachshundSprite.width / dachshundSprite.height) * h;
  ctx.save();
  ctx.translate(x, y + 38);
  // The artwork faces right; mirror it when moving left.
  ctx.scale(facing, 1);
  ctx.drawImage(dachshundSprite, -w / 2, -h, w, h);
  ctx.restore();
}

function drawDrone(x, y, t) {
  ctx.save();
  ctx.translate(x, y + 6);
  ctx.strokeStyle = "#333";
  ctx.lineWidth = 5;
  for (const [dx, dy] of [[-42, -12], [42, -12], [-42, 12], [42, 12]]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(dx, dy);
    ctx.stroke();
    ctx.fillStyle = "rgba(220,220,220,0.75)";
    ctx.beginPath();
    ctx.ellipse(dx, dy - 4, 20, 4 + Math.abs(Math.sin(t * 40)) * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = "#222";
  ctx.beginPath();
  ctx.roundRect(-22, -11, 44, 22, 6);
  ctx.fill();
  ctx.fillStyle = "#e53935";
  ctx.beginPath();
  ctx.arc(14, 0, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCatcher(t) {
  const { catcher } = state.char;
  if (catcher === "dachshund") drawDachshund(state.catcherX, CATCHER_Y, state.facing);
  else if (catcher === "drone") drawDrone(state.catcherX, CATCHER_Y, t);
  else {
    ctx.font = "64px serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("🎒", state.catcherX, CATCHER_Y + 8);
  }
}

function drawItem(item) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(Math.sin(item.wobble) * 0.25);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (item.glyph === "JIRA" || item.glyph === "CONFLICT") {
    ctx.font = "bold 13px Arial";
    const w = ctx.measureText(item.glyph).width + 14;
    ctx.fillStyle = item.glyph === "JIRA" ? "#0052cc" : "#c8102e";
    ctx.beginPath();
    ctx.roundRect(-w / 2, -12, w, 24, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(item.glyph, 0, 1);
  } else {
    ctx.font = "34px serif";
    ctx.fillText(item.glyph, 0, 0);
  }
  ctx.restore();
}

function drawHud() {
  ctx.fillStyle = "#c8102e";
  ctx.font = "italic bold 26px Georgia";
  ctx.textAlign = "right";
  ctx.textBaseline = "top";
  ctx.fillText(String(state.score), W - 16, 12);

  ctx.font = "20px serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "bottom";
  ctx.globalAlpha = 1;
  for (let i = 0; i < LIVES; i++) {
    ctx.globalAlpha = i < state.lives ? 1 : 0.2;
    ctx.fillText(state.char.goods[0], 12 + i * 26, H - 10);
  }
  ctx.globalAlpha = 1;
}

function drawPopups() {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const p of state.popups) {
    ctx.globalAlpha = Math.min(1, p.t);
    ctx.font = "bold 22px Georgia";
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#06331a";
    ctx.strokeText(p.text, p.x, p.y);
    ctx.fillStyle = p.color;
    ctx.fillText(p.text, p.x, p.y);
  }
  ctx.globalAlpha = 1;
}

function draw(t) {
  drawBackground();
  drawVessel();
  for (const item of state.items) drawItem(item);
  drawCatcher(t);
  drawHud();
  drawPopups();
  if (state.flash > 0) {
    ctx.fillStyle = `rgba(200,16,46,${state.flash * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function tick(now) {
  if (!state || state.over) return;
  const dt = Math.min(0.05, (now - state.last) / 1000);
  state.last = now;
  update(dt);
  if (state.over) return;
  draw(now / 1000);
  requestAnimationFrame(tick);
}

function moveCatcher(x) {
  const next = Math.max(CATCHER_W / 2, Math.min(W - CATCHER_W / 2, x));
  if (next !== state.catcherX) state.facing = next > state.catcherX ? 1 : -1;
  state.catcherX = next;
}

function pointerToCanvas(e) {
  if (!state || state.over) return;
  const rect = canvas.getBoundingClientRect();
  moveCatcher(((e.clientX - rect.left) / rect.width) * W);
}

canvas.addEventListener("pointermove", pointerToCanvas);
canvas.addEventListener("pointerdown", pointerToCanvas);

function quit() {
  if (state) state.over = true;
  show("choose");
}

addEventListener("keydown", (e) => {
  if (e.key === "Escape") quit();
  if (e.key === "ArrowLeft") keys.left = true;
  if (e.key === "ArrowRight") keys.right = true;
});
addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") keys.left = false;
  if (e.key === "ArrowRight") keys.right = false;
});

document.getElementById("again").addEventListener("click", () => show("choose"));

const muteBtn = document.getElementById("mute");
function renderMute() {
  muteBtn.textContent = Sound.muted ? "🔇" : "🔊";
}
function toggleMute() {
  Sound.toggleMute();
  renderMute();
}
muteBtn.addEventListener("click", toggleMute);
document.getElementById("quit").addEventListener("click", quit);
addEventListener("keydown", (e) => {
  if (e.key === "m" || e.key === "M") toggleMute();
});
renderMute();

buildCards();

const startOverlay = document.getElementById("start-overlay");
startOverlay.addEventListener("click", () => startOverlay.classList.add("hidden"));
Sound.tryAutoplay().then((playing) => {
  if (!playing) startOverlay.classList.remove("hidden");
});
