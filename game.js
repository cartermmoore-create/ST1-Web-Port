import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

const view = document.getElementById("view");
const paperCountEl = document.getElementById("paperCount");
const levelLabel = document.getElementById("levelLabel");
const promptEl = document.getElementById("prompt");
const staminaEl = document.querySelector("#stamina div");
const menu = document.getElementById("menu");
const pause = document.getElementById("pause");
const win = document.getElementById("win");
const levelSelect = document.getElementById("levelSelect");

const DATA = await fetch("./data/levels.json").then(r => r.json());

for (const key of Object.keys(DATA)) {
  const n = key.replace("level","");
  const opt = document.createElement("option");
  opt.value = key; opt.textContent = `Level ${n}`;
  levelSelect.appendChild(opt);
}

const renderer = new THREE.WebGLRenderer({canvas:view, antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.8));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0d120d);
scene.fog = new THREE.FogExp2(0x0d120d, 0.0032);

const camera = new THREE.PerspectiveCamera(75, innerWidth/innerHeight, 0.05, 2500);
camera.rotation.order = "YXZ";

const ambient = new THREE.HemisphereLight(0x889988, 0x222016, 1.25);
scene.add(ambient);

const moon = new THREE.DirectionalLight(0xcbd6cc, 1.3);
moon.position.set(500, 500, 100);
moon.castShadow = true;
scene.add(moon);

const player = {
  pos:new THREE.Vector3(),
  yaw:0,
  pitch:0,
  stamina:1,
  flashlight:true,
  height:2.0,
};

const keys = new Set();
let running = false, pausedGame = false, won = false;
let last = performance.now();
let currentKey = "level0";
let level = null;
let world = null;
let papers = [];
let enemy = null;
const colliders = [];

function makeTree(scale=1){
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(.8,1.1,11,8),
    new THREE.MeshStandardMaterial({color:0x3b2a1c, roughness:1})
  );
  trunk.position.y=5.5;
  g.add(trunk);
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(5.5,14,8),
    new THREE.MeshStandardMaterial({color:0x1b3a20, roughness:1})
  );
  foliage.position.y=13;
  g.add(foliage);
  g.scale.setScalar(Math.max(.7,Math.min(3.0,scale*18)));
  return g;
}

function makeHouse(scale=1){
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CylinderGeometry(7,10,10,10),
    new THREE.MeshStandardMaterial({color:0x736b58,roughness:1})
  );
  body.position.y=5;
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(11,10,10),
    new THREE.MeshStandardMaterial({color:0x4d4032,roughness:1})
  );
  roof.position.y=15;
  g.add(body,roof);
  g.scale.setScalar(Math.max(.6,Math.min(10,scale*1.15)));
  return g;
}

function makePaper(){
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({color:0xd8d0b5,emissive:0x332f25,side:THREE.DoubleSide});
  const sheet = new THREE.Mesh(new THREE.PlaneGeometry(1.3,1.7),mat);
  sheet.rotation.x=-Math.PI/2;
  g.add(sheet);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(.85,.035,6,24),
    new THREE.MeshBasicMaterial({color:0xbbb39a})
  );
  ring.rotation.x=-Math.PI/2;
  g.add(ring);
  return g;
}

function makeEnemy(){
  const g = new THREE.Group();
  const body = new THREE.Mesh(
    new THREE.CapsuleGeometry(.75,2.6,6,12),
    new THREE.MeshStandardMaterial({color:0x272a28,roughness:1})
  );
  body.position.y=1.6;
  const head = new THREE.Mesh(
    new THREE.SphereGeometry(.9,16,12),
    new THREE.MeshStandardMaterial({color:0x313532,roughness:1})
  );
  head.position.y=3.3;
  const eyeMat=new THREE.MeshBasicMaterial({color:0xe9ebe2});
  for (const x of [-.28,.28]) {
    const eye=new THREE.Mesh(new THREE.SphereGeometry(.12,8,8),eyeMat);
    eye.position.set(x,3.38,.83);
    g.add(eye);
  }
  g.add(body,head);
  return g;
}

function clearWorld(){
  if(world) scene.remove(world);
  world = new THREE.Group();
  scene.add(world);
  colliders.length = 0;
  papers = [];
  enemy = null;
}

function addTerrain(){
  const geo = new THREE.PlaneGeometry(1500,1500,64,64);
  const pos = geo.attributes.position;
  for(let i=0;i<pos.count;i++){
    const x=pos.getX(i), z=pos.getY(i);
    const h = 1.7*Math.sin(x*.012)*Math.cos(z*.011) + 0.9*Math.sin(z*.027);
    pos.setZ(i,h);
  }
  geo.computeVertexNormals();
  const mesh=new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({color:0x3e4d35,roughness:1,metalness:0})
  );
  mesh.rotation.x=-Math.PI/2;
  mesh.receiveShadow=true;
  world.add(mesh);
}

function loadLevel(key){
  currentKey=key;
  level=DATA[key];
  clearWorld();
  addTerrain();

  const sx = level.spawns?.[0]?.x ?? 500;
  const sy = level.spawns?.[0]?.y ?? 2;
  const sz = level.spawns?.[0]?.z ?? 130;

  player.pos.set(sx, sy+player.height, sz);
  player.yaw = 0;
  player.pitch = 0;
  player.stamina=1;

  for(const t of level.trees){
    const tree=makeTree(t.s);
    tree.position.set(t.x,t.y,t.z);
    world.add(tree);
    colliders.push({x:t.x,z:t.z,r:7});
  }

  for(const h of level.houses){
    const house=makeHouse(h.s);
    house.position.set(h.x,h.y,h.z);
    world.add(house);
    colliders.push({x:h.x,z:h.z,r:13*Math.min(3,h.s)});
  }

  for(const p of level.papers){
    const paper=makePaper();
    paper.position.set(p.x,p.y+1.1,p.z);
    world.add(paper);
    papers.push({mesh:paper,x:p.x,y:p.y,z:p.z,collected:false});
  }

  const enemyPos = level.undead?.[0] || level.tinky?.[0];
  if(enemyPos){
    enemy=makeEnemy();
    enemy.position.set(enemyPos.x,enemyPos.y,enemyPos.z);
    world.add(enemy);
  }

  levelLabel.textContent=`LEVEL ${key.replace("level","")}`;
  won=false;
  pausedGame=false;
  updateHUD();
  hide(win); hide(pause);
}

function hide(el){el.classList.add("hidden")}
function show(el){el.classList.remove("hidden")}

function updateHUD(){
  const got=papers.filter(p=>p.collected).length;
  paperCountEl.textContent=`${got}/${papers.length || 10}`;
  staminaEl.style.width=`${Math.round(player.stamina*100)}%`;
}

function blocked(nx,nz){
  for(const c of colliders){
    const dx=nx-c.x,dz=nz-c.z;
    if(dx*dx+dz*dz<c.r*c.r) return true;
  }
  return false;
}

function collect(){
  let nearest=null, best=3.0;
  for(const p of papers){
    if(p.collected) continue;
    const d=Math.hypot(player.pos.x-p.x,player.pos.z-p.z);
    if(d<best){best=d;nearest=p}
  }
  if(!nearest)return;
  nearest.collected=true;
  nearest.mesh.visible=false;
  updateHUD();
  if(papers.every(p=>p.collected)){
    won=true; running=false; document.exitPointerLock?.(); show(win);
  }
}

function updateEnemy(dt){
  if(!enemy || !enemy.visible || won) return;
  const dx=player.pos.x-enemy.position.x;
  const dz=player.pos.z-enemy.position.z;
  const dist=Math.hypot(dx,dz);
  if(dist>95)return;
  const speed=.9 + papers.filter(p=>p.collected).length*.07;
  if(dist<1.7){
    running=false; pausedGame=true; document.exitPointerLock?.();
    pause.querySelector("h2").textContent="CAUGHT";
    show(pause);
    return;
  }
  const vx=dx/dist*speed*dt, vz=dz/dist*speed*dt;
  enemy.position.x += vx;
  enemy.position.z += vz;
  enemy.lookAt(player.pos.x,enemy.position.y,player.pos.z);
}

function update(dt){
  if(!running || pausedGame || won)return;

  const move=new THREE.Vector3();
  if(keys.has("KeyW")) move.z-=1;
  if(keys.has("KeyS")) move.z+=1;
  if(keys.has("KeyA")) move.x-=1;
  if(keys.has("KeyD")) move.x+=1;

  const moving=move.lengthSq()>0;
  const sprinting=moving && (keys.has("ShiftLeft")||keys.has("ShiftRight")) && player.stamina>.04;
  const speed=sprinting?10:6;
  if(sprinting) player.stamina=Math.max(0,player.stamina-dt*.34);
  else player.stamina=Math.min(1,player.stamina+dt*.22);

  if(moving){
    move.normalize().applyAxisAngle(new THREE.Vector3(0,1,0),player.yaw);
    const nx=player.pos.x+move.x*speed*dt;
    const nz=player.pos.z+move.z*speed*dt;
    if(!blocked(nx,player.pos.z)) player.pos.x=nx;
    if(!blocked(player.pos.x,nz)) player.pos.z=nz;
  }

  player.pos.y=2.0 + Math.sin(performance.now()/310)*.025;
  camera.position.copy(player.pos);
  camera.rotation.x=player.pitch;
  camera.rotation.y=player.yaw;

  updateEnemy(dt);
  for(const p of papers){
    if(!p.collected)p.mesh.rotation.z+=dt*.7;
  }

  let near=Infinity;
  for(const p of papers){
    if(p.collected)continue;
    near=Math.min(near,Math.hypot(player.pos.x-p.x,player.pos.z-p.z));
  }
  promptEl.textContent=near<3 ? "E — collect paper" : "";
  updateHUD();
}

const flashlight = new THREE.SpotLight(0xe7eadf, 24, 95, Math.PI/5, .65, 1.0);
flashlight.position.set(0,0,0);
flashlight.target.position.set(0,0,-10);
camera.add(flashlight, flashlight.target);
scene.add(camera);

function setFlashlight(){
  flashlight.visible=player.flashlight;
}

addEventListener("resize",()=>{
  renderer.setSize(innerWidth,innerHeight);
  camera.aspect=innerWidth/innerHeight;
  camera.updateProjectionMatrix();
});

addEventListener("keydown",e=>{
  keys.add(e.code);
  if(e.code==="KeyE"&&!e.repeat)collect();
  if(e.code==="KeyF"&&!e.repeat){player.flashlight=!player.flashlight;setFlashlight()}
  if(e.code==="Escape"&&running&&!won) document.exitPointerLock?.();
});
addEventListener("keyup",e=>keys.delete(e.code));

view.addEventListener("click",()=>{
  if(running&&!pausedGame&&!won)view.requestPointerLock?.();
});
document.addEventListener("mousemove",e=>{
  if(document.pointerLockElement!==view || !running || pausedGame || won)return;
  player.yaw -= e.movementX*.0022;
  player.pitch -= e.movementY*.0017;
  player.pitch=Math.max(-1.35,Math.min(1.35,player.pitch));
});

document.addEventListener("pointerlockchange",()=>{
  if(!running||won)return;
  if(document.pointerLockElement!==view){
    pausedGame=true; show(pause);
  }
});

document.getElementById("start").onclick=()=>{
  loadLevel(levelSelect.value);
  running=true; pausedGame=false; hide(menu);
  view.requestPointerLock?.();
};
document.getElementById("resume").onclick=()=>{
  pausedGame=false; hide(pause); view.requestPointerLock?.();
};
document.getElementById("restart").onclick=()=>{
  loadLevel(currentKey); running=true; pausedGame=false; hide(pause); view.requestPointerLock?.();
};
document.getElementById("again").onclick=()=>{
  loadLevel(currentKey); running=true; pausedGame=false; hide(win); view.requestPointerLock?.();
};

loadLevel("level0");
setFlashlight();

function loop(now){
  const dt=Math.min(.05,(now-last)/1000); last=now;
  update(dt);
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
