(() => {
  "use strict";

  const canvas = document.getElementById("screen");
  const ctx = canvas.getContext("2d", { alpha: false });
  const W = canvas.width, H = canvas.height;
  const hud = {
    papers: document.getElementById("papers"),
    stamina: document.getElementById("stamina"),
    message: document.getElementById("message"),
    menu: document.getElementById("menu"),
    pause: document.getElementById("pause"),
    win: document.getElementById("win"),
    winText: document.getElementById("winText")
  };

  const MAP = [
    "####################",
    "#........#.........#",
    "#........#.........#",
    "#..P.....#....P....#",
    "#........#.........#",
    "#........#.........#",
    "###.############.###",
    "#..................#",
    "#....P.............#",
    "#................P.#",
    "#..................#",
    "#.P................#",
    "#..................#",
    "#.........###......#",
    "#.........#........#",
    "#.........#..P.....#",
    "#.........#........#",
    "#..P......#.....P..#",
    "#..................#",
    "####################"
  ];

  const keys = Object.create(null);
  const FOV = Math.PI / 3;
  const HALF_FOV = FOV / 2;
  const MAX_DEPTH = 22;
  const TILE = 1;
  const player = { x: 2.5, y: 2.5, a: 0, stamina: 1 };
  const monster = { x: 16.5, y: 4.5, a: 0, active: false, cooldown: 0 };
  let papers = [];
  let collected = 0;
  let started = false;
  let paused = false;
  let ended = false;
  let flashlight = true;
  let messageTimer = 0;
  let time = 0;
  let last = performance.now();

  // Additional papers are placed at fixed locations to make a full 10-page loop.
  const extraPapers = [
    [3.5, 8.5], [15.5, 8.5], [8.5, 14.5], [14.5, 18.5], [3.5, 16.5]
  ];

  function isWall(x, y) {
    const gx = Math.floor(x), gy = Math.floor(y);
    if (gy < 0 || gy >= MAP.length || gx < 0 || gx >= MAP[0].length) return true;
    return MAP[gy][gx] === "#";
  }

  function canStand(x, y, r = .18) {
    return !isWall(x-r,y-r) && !isWall(x+r,y-r) &&
           !isWall(x-r,y+r) && !isWall(x+r,y+r);
  }

  function resetGame() {
    player.x = 2.5; player.y = 2.5; player.a = 0; player.stamina = 1;
    monster.x = 16.5; monster.y = 4.5; monster.a = 0; monster.active = false;
    monster.cooldown = 0;
    flashlight = true;
    collected = 0;
    time = 0;
    ended = false;
    papers = [];
    for (let y = 0; y < MAP.length; y++) {
      for (let x = 0; x < MAP[y].length; x++) {
        if (MAP[y][x] === "P") papers.push({x:x+.5,y:y+.5,collected:false});
      }
    }
    for (const [x,y] of extraPapers) papers.push({x,y,collected:false});
    updateHUD();
    hidePanel(hud.win);
    hidePanel(hud.pause);
    setMessage("Find all 10 papers.");
  }

  function showPanel(el) { el.classList.remove("hidden"); }
  function hidePanel(el) { el.classList.add("hidden"); }

  function setMessage(text, seconds = 2) {
    hud.message.textContent = text;
    messageTimer = seconds;
  }

  function updateHUD() {
    hud.papers.textContent = String(collected);
    hud.stamina.style.width = `${Math.max(0, player.stamina) * 100}%`;
  }

  function castRay(angle) {
    // Digital differential analysis raycaster.
    let x = player.x, y = player.y;
    const step = .035;
    const dx = Math.cos(angle) * step;
    const dy = Math.sin(angle) * step;
    let dist = 0;
    while (dist < MAX_DEPTH) {
      x += dx; y += dy; dist += step;
      if (isWall(x, y)) return { dist, x, y };
    }
    return { dist: MAX_DEPTH, x, y };
  }

  function wallShade(dist, sideBias = 0) {
    let light = flashlight ? 1 : .62;
    const beam = flashlight ? 1.0 : .78;
    light *= Math.max(.12, 1 - dist / (MAX_DEPTH * .9)) * beam;
    light *= .82 + sideBias * .18;
    const c = Math.floor(125 * light);
    return `rgb(${c},${c},${c})`;
  }

  function render() {
    // Ceiling and floor.
    const grad = ctx.createLinearGradient(0,0,0,H);
    grad.addColorStop(0, flashlight ? "#111" : "#080808");
    grad.addColorStop(.52, "#151515");
    grad.addColorStop(1, "#090909");
    ctx.fillStyle = grad;
    ctx.fillRect(0,0,W,H);

    const rays = 480;
    const strip = W / rays;
    const depth = new Float32Array(rays);

    for (let i = 0; i < rays; i++) {
      const t = i / rays;
      const angle = player.a - HALF_FOV + t * FOV;
      const r = castRay(angle);
      const corrected = r.dist * Math.cos(angle - player.a);
      depth[i] = corrected;

      const wallH = Math.min(H * 1.7, H / Math.max(.001, corrected));
      const top = (H - wallH) * .5;
      const edge = Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle)) ? .86 : .68;
      ctx.fillStyle = wallShade(corrected, edge);
      ctx.fillRect(i*strip, top, strip+1, wallH);
    }

    drawPapers(depth);
    drawMonster(depth);
    drawVignette();
  }

  function projectObject(x, y) {
    const dx = x - player.x, dy = y - player.y;
    const dist = Math.hypot(dx,dy);
    let rel = Math.atan2(dy,dx) - player.a;
    while (rel > Math.PI) rel -= Math.PI*2;
    while (rel < -Math.PI) rel += Math.PI*2;
    if (Math.abs(rel) > HALF_FOV + .18) return null;
    const sx = (0.5 + rel / FOV) * W;
    const size = Math.min(H, H / Math.max(.25, dist) * .22);
    return {sx, size, dist, rel};
  }

  function visible(x,y,dist) {
    const r = castRay(Math.atan2(y-player.y,x-player.x));
    return r.dist + .12 >= dist;
  }

  function drawPapers(depth) {
    for (const p of papers) {
      if (p.collected) continue;
      const q = projectObject(p.x,p.y);
      if (!q || !visible(p.x,p.y,q.dist)) continue;

      const row = Math.min(depth.length-1, Math.max(0, Math.floor(q.sx/W*depth.length)));
      if (q.dist > depth[row] + .15) continue;

      const s = q.size;
      ctx.save();
      ctx.translate(q.sx, H/2);
      ctx.rotate(Math.sin(time*2 + p.x)*.04);
      ctx.fillStyle = "#d8d2b8";
      ctx.fillRect(-s*.33,-s*.48,s*.66,s*.92);
      ctx.strokeStyle = "#34302a";
      ctx.lineWidth = Math.max(1, s*.018);
      ctx.strokeRect(-s*.33,-s*.48,s*.66,s*.92);
      ctx.fillStyle = "#777";
      for (let i=0;i<4;i++) ctx.fillRect(-s*.24,-s*.22+i*s*.11,s*.48,s*.02);
      ctx.restore();
    }
  }

  function drawMonster(depth) {
    if (!monster.active) return;
    const q = projectObject(monster.x,monster.y);
    if (!q || !visible(monster.x,monster.y,q.dist)) return;

    const row = Math.min(depth.length-1, Math.max(0, Math.floor(q.sx/W*depth.length)));
    if (q.dist > depth[row] + .1) return;

    const s = q.size * 2.4;
    ctx.save();
    ctx.translate(q.sx,H/2);
    ctx.fillStyle = "#141414";
    ctx.beginPath();
    ctx.ellipse(0,0,s*.18,s*.55,0,0,Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0,-s*.42,s*.22,0,Math.PI*2);
    ctx.fill();
    ctx.fillStyle = "#e6e6e6";
    ctx.fillRect(-s*.10,-s*.44,s*.055,s*.035);
    ctx.fillRect(s*.045,-s*.44,s*.055,s*.035);
    ctx.restore();
  }

  function drawVignette() {
    const g = ctx.createRadialGradient(W/2,H/2,Math.min(W,H)*.2,W/2,H/2,Math.max(W,H)*.65);
    g.addColorStop(0,"rgba(0,0,0,0)");
    g.addColorStop(1, flashlight ? "rgba(0,0,0,.52)" : "rgba(0,0,0,.72)");
    ctx.fillStyle = g;
    ctx.fillRect(0,0,W,H);
  }

  function tryCollect() {
    let nearest = null, best = .75;
    for (const p of papers) {
      if (p.collected) continue;
      const d = Math.hypot(p.x-player.x,p.y-player.y);
      if (d < best) { best=d; nearest=p; }
    }
    if (nearest) {
      nearest.collected = true;
      collected++;
      setMessage(`Paper collected. ${10-collected} remaining.`);
      if (collected >= 10) {
        ended = true;
        document.exitPointerLock?.();
        hud.winText.textContent = `Time: ${time.toFixed(1)} seconds`;
        showPanel(hud.win);
      } else if (collected >= 3) {
        monster.active = true;
      }
      updateHUD();
    }
  }

  function move(dt) {
    if (!started || paused || ended) return;

    let mx = 0, my = 0;
    if (keys.KeyW) my += 1;
    if (keys.KeyS) my -= 1;
    if (keys.KeyA) mx -= 1;
    if (keys.KeyD) mx += 1;

    const moving = mx !== 0 || my !== 0;
    const sprinting = moving && (keys.ShiftLeft || keys.ShiftRight) && player.stamina > .03;
    const speed = sprinting ? 3.1 : 2.0;

    if (sprinting) player.stamina = Math.max(0, player.stamina - dt * .38);
    else player.stamina = Math.min(1, player.stamina + dt * .22);

    if (moving) {
      const len = Math.hypot(mx,my);
      mx /= len; my /= len;
      const ca = Math.cos(player.a), sa = Math.sin(player.a);
      const vx = (mx*ca - my*sa) * speed * dt;
      const vy = (mx*sa + my*ca) * speed * dt;
      if (canStand(player.x+vx,player.y)) player.x += vx;
      if (canStand(player.x,player.y+vy)) player.y += vy;
    }

    if (monster.active) updateMonster(dt);
    updateHUD();
  }

  function updateMonster(dt) {
    const dx = player.x-monster.x, dy = player.y-monster.y;
    const dist = Math.hypot(dx,dy);

    if (dist < .65) {
      setMessage("Something is right behind you.");
      // A game-over state is intentionally mild and non-graphic.
      paused = true;
      document.exitPointerLock?.();
      hud.pause.querySelector("h2").textContent = "YOU WERE CAUGHT";
      showPanel(hud.pause);
      return;
    }

    const ang = Math.atan2(dy,dx);
    monster.a = ang;
    const speed = 0.52 + Math.min(.75, collected * .045);
    const vx = Math.cos(ang)*speed*dt;
    const vy = Math.sin(ang)*speed*dt;
    if (canStand(monster.x+vx,monster.y,.2)) monster.x += vx;
    if (canStand(monster.x,monster.y+vy,.2)) monster.y += vy;
  }

  function tick(now) {
    const dt = Math.min(.05, (now-last)/1000);
    last = now;
    if (started && !paused && !ended) {
      time += dt;
      if (messageTimer > 0) {
        messageTimer -= dt;
        if (messageTimer <= 0) hud.message.textContent = "";
      }
    }
    move(dt);
    render();
    requestAnimationFrame(tick);
  }

  window.addEventListener("keydown", e => {
    keys[e.code] = true;
    if (e.code === "KeyF" && !e.repeat && started && !ended) {
      flashlight = !flashlight;
      setMessage(flashlight ? "Flashlight on." : "Flashlight off.");
    }
    if (e.code === "KeyE" && !e.repeat && started && !ended) tryCollect();
    if (e.code === "Escape" && started && !ended && document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  });

  window.addEventListener("keyup", e => { keys[e.code] = false; });

  canvas.addEventListener("click", () => {
    if (started && !ended && !paused) canvas.requestPointerLock?.();
  });

  document.addEventListener("mousemove", e => {
    if (!started || paused || ended || document.pointerLockElement !== canvas) return;
    player.a += e.movementX * 0.0027;
  });

  document.addEventListener("pointerlockchange", () => {
    if (started && !ended && document.pointerLockElement !== canvas) {
      paused = true;
      showPanel(hud.pause);
    } else if (started && !ended && document.pointerLockElement === canvas) {
      paused = false;
      hidePanel(hud.pause);
    }
  });

  document.getElementById("start").addEventListener("click", () => {
    resetGame();
    started = true;
    paused = false;
    hidePanel(hud.menu);
    canvas.requestPointerLock?.();
  });

  document.getElementById("resume").addEventListener("click", () => {
    if (ended) {
      resetGame();
      started = true;
      paused = false;
    } else {
      paused = false;
    }
    hidePanel(hud.pause);
    canvas.requestPointerLock?.();
  });

  document.getElementById("restart").addEventListener("click", () => {
    resetGame();
    started = true;
    paused = false;
    hidePanel(hud.pause);
    canvas.requestPointerLock?.();
  });

  document.getElementById("again").addEventListener("click", () => {
    resetGame();
    started = true;
    paused = false;
    hidePanel(hud.win);
    canvas.requestPointerLock?.();
  });

  resetGame();
  requestAnimationFrame(tick);
})();
