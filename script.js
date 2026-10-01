/* PIXEL CACTUS CLASH - LEVEL + ZOMBIE DEFENSE UPDATE */
(function(){
'use strict';

const AudioEngine={
  ctx:null,
  muted:false,

  init(){
    if(!this.ctx){
      const A=window.AudioContext||window.webkitAudioContext;
      if(A)this.ctx=new A();
    }
  },

  tone(f,type,dur,end=null,vol=.14){
    if(this.muted)return;
    this.init();
    if(!this.ctx)return;
    if(this.ctx.state==='suspended')this.ctx.resume();

    const o=this.ctx.createOscillator();
    const g=this.ctx.createGain();

    o.type=type;
    o.frequency.setValueAtTime(f,this.ctx.currentTime);

    if(end){
      o.frequency.exponentialRampToValueAtTime(
        Math.max(10,end),
        this.ctx.currentTime+dur
      );
    }

    g.gain.setValueAtTime(vol,this.ctx.currentTime);
    g.gain.linearRampToValueAtTime(
      .0001,
      this.ctx.currentTime+dur
    );

    o.connect(g);
    g.connect(this.ctx.destination);

    o.start();
    o.stop(this.ctx.currentTime+dur);
  },

  warning(){this.tone(360,'square',.08,180)},
  fall(){this.tone(540,'sawtooth',.3,80,.12)},
  plop(){this.tone(130,'triangle',.2,25,.35)},
  spikeShot(){this.tone(700,'square',.05,220,.1)},
  hammerSwing(){this.tone(200,'sine',.1,50,.18)},
  hammerHit(){this.tone(140,'square',.08,30,.3)},
  deflect(){this.tone(850,'square',.07,1200,.2)},
  dash(){this.tone(420,'triangle',.12,950,.18)},
  pickup(){
    this.tone(523,'square',.05,null,.12);
    setTimeout(()=>this.tone(784,'square',.08,null,.14),50);
  },
  hurt(){this.tone(110,'sawtooth',.2,25,.35)},
  coin(){
    this.tone(659,'triangle',.07,null,.16);
    setTimeout(()=>this.tone(987,'triangle',.1,null,.18),70);
  },
  interact(){this.tone(440,'triangle',.08,null,.18)},
  destroy(){this.tone(140,'sawtooth',.25,20,.35)},
  zombie(){this.tone(90,'square',.12,55,.16)},
  turret(){this.tone(760,'square',.045,250,.1)}
};

const SAVE_KEY='PIXEL_CACTUS_CLASH_SAVE_v5';

let SaveData={
  money:0,
  cactusParts:0,
  wave:1,
  upgrades:{
    hammerSpeed:0,
    hammerStrength:0,
    harvestYield:0,
    moveSpeed:0,
    dashLength:0,
    dashCooldown:0,
    partValue:0,
    shockwaveDash:0,
    tempShield:0,
    magnetPickup:0
  }
};

function loadSave(){
  try{
    const d=JSON.parse(localStorage.getItem(SAVE_KEY)||'null');

    if(d){
      SaveData.money=d.money||0;
      SaveData.cactusParts=d.cactusParts||0;
      SaveData.wave=Math.max(1,d.wave||1);
      SaveData.upgrades=Object.assign(
        SaveData.upgrades,
        d.upgrades||{}
      );
    }
  }catch(e){
    console.warn(e);
  }
}

function saveGame(){
  try{
    localStorage.setItem(
      SAVE_KEY,
      JSON.stringify(SaveData)
    );
  }catch(e){}
}

/* A death starts a completely fresh run. */
function freshRun(){
  SaveData={
    money:0,
    cactusParts:0,
    wave:1,
    upgrades:{
      hammerSpeed:0,
      hammerStrength:0,
      harvestYield:0,
      moveSpeed:0,
      dashLength:0,
      dashCooldown:0,
      partValue:0,
      shockwaveDash:0,
      tempShield:0,
      magnetPickup:0
    }
  };

  try{
    localStorage.removeItem(SAVE_KEY);
  }catch(e){}

  defenses=[];
  activeCacti=[];
  zombies=[];
  spikes=[];
  droppedParts=[];

  buildMode.active=false;
  selectedDefense=null;
  dragDefense=null;
}

loadSave();

const UPGRADES_DB={
  hammerSpeed:{
    name:'Hammer Speed',
    desc:'Faster swing recovery',
    max:5,
    base:25,
    mult:1.8
  },
  hammerStrength:{
    name:'Hammer Power',
    desc:'Heavier blunt crush damage',
    max:5,
    base:30,
    mult:1.9
  },
  harvestYield:{
    name:'Harvest Yield',
    desc:'More parts per cactus',
    max:5,
    base:35,
    mult:2
  },
  moveSpeed:{
    name:'Block Agility',
    desc:'Faster arena movement',
    max:5,
    base:25,
    mult:1.7
  },
  dashLength:{
    name:'Dash Distance',
    desc:'Dash farther',
    max:4,
    base:40,
    mult:2
  },
  dashCooldown:{
    name:'Dash Recharge',
    desc:'Dash recharges faster',
    max:5,
    base:45,
    mult:1.85
  },
  partValue:{
    name:'Market Rates',
    desc:'Earn +$4 per part',
    max:5,
    base:50,
    mult:2.1
  },
  shockwaveDash:{
    name:'Shockwave Dash',
    desc:'Dash clears nearby spikes',
    max:1,
    base:180,
    mult:1
  },
  tempShield:{
    name:'Shield Aura',
    desc:'Absorbs 1 hit each level',
    max:1,
    base:140,
    mult:1
  },
  magnetPickup:{
    name:'Part Magnet',
    desc:'Attracts distant parts',
    max:4,
    base:60,
    mult:1.9
  }
};

const PROTECTION_DB={
  wall:{
    name:'Reinforced Wall',
    desc:'Blocks zombies and has a health bar.',
    cost:80,
    hp:180
  },
  turret:{
    name:'Auto Turret',
    desc:'Automatically shoots zombies in its radius.',
    cost:140,
    hp:120
  }
};

function upgradeCost(k){
  const i=UPGRADES_DB[k];
  const l=SaveData.upgrades[k]||0;

  return l>=i.max
    ? null
    : Math.floor(i.base*Math.pow(i.mult,l));
}

const canvas=document.getElementById('gameCanvas');
const ctx=canvas.getContext('2d');

ctx.imageSmoothingEnabled=false;

let screenW=innerWidth;
let screenH=innerHeight;

function resizeCanvas(){
  screenW=innerWidth;
  screenH=innerHeight;

  canvas.width=screenW;
  canvas.height=screenH;

  ctx.imageSmoothingEnabled=false;
}

addEventListener('resize',resizeCanvas);
resizeCanvas();

let shakeTime=0;
let shakeMag=0;
let hitStopTime=0;

function triggerShake(m,d){
  shakeMag=m;
  shakeTime=d;
}

function triggerHitStop(s){
  hitStopTime=s;
}

const STATES={
  MENU:'MENU',
  PLAYING:'PLAYING',
  GAMEOVER:'GAMEOVER'
};

let gameState=STATES.MENU;
const keys={};

addEventListener('keydown',e=>{
  AudioEngine.init();

  keys[e.key.toLowerCase()]=true;
  keys[e.code]=true;

  if(e.code==='Space'){
    e.preventDefault();
  }

  if(gameState===STATES.GAMEOVER){
    gameState=STATES.MENU;
    return;
  }

  if(e.key==='Escape'){
    if(buildMode.active){
      cancelBuild();
    }else{
      closeAllModals();
    }
    return;
  }

  if(gameState!==STATES.PLAYING)return;

  if(e.code==='Space'){
    if(buildMode.active){
      placeDefense();
    }else{
      Player.attack();
    }
  }

  if(e.key.toLowerCase()==='i'){
    Player.dash();
  }

  if(e.key.toLowerCase()==='e'){
    checkStandsInteraction();
  }

  if(
    buildMode.active &&
    (
      e.key==='ArrowLeft' ||
      e.key==='ArrowRight' ||
      e.key==='ArrowUp' ||
      e.key==='ArrowDown'
    )
  ){
    e.preventDefault();
    rotateBuild(e.key);
  }
});

addEventListener('keyup',e=>{
  keys[e.key.toLowerCase()]=false;
  keys[e.code]=false;
});

canvas.addEventListener('mousedown',e=>{
  AudioEngine.init();

  const pt=canvasPoint(e);

  if(gameState===STATES.MENU){

    const bw=240;
    const bh=56;
    const bx=screenW/2-bw/2;
    const by=screenH/2+25;

    if(
      pt.x>=bx &&
      pt.x<=bx+bw &&
      pt.y>=by &&
      pt.y<=by+bh
    ){
      startNewGame();
    }

  }else if(gameState===STATES.PLAYING){

    if(buildMode.active){
      buildMode.x=pt.x;
      buildMode.y=pt.y;
      placeDefense(pt.x,pt.y);
      return;
    }

    const hit=defenseAt(pt.x,pt.y);

    if(hit){
      selectedDefense=hit;
      dragDefense=hit;

      dragOffsetX=pt.x-hit.x;
      dragOffsetY=pt.y-hit.y;

      return;
    }

    if(!checkStandsInteraction(pt.x,pt.y)){
      Player.attack();
    }

  }else{
    gameState=STATES.MENU;
  }
});

canvas.addEventListener('mousemove',e=>{
  if(gameState!==STATES.PLAYING)return;

  const pt=canvasPoint(e);

  if(buildMode.active){
    buildMode.x=pt.x;
    buildMode.y=pt.y;
  }

  if(dragDefense){
    const nx=pt.x-dragOffsetX;
    const ny=pt.y-dragOffsetY;

    if(canMoveDefense(dragDefense,nx,ny)){
      dragDefense.x=nx;
      dragDefense.y=ny;
    }
  }
});

addEventListener('mouseup',()=>{
  if(dragDefense){
    saveGame();
    dragDefense=null;
  }
});

const joystickBase=document.getElementById('joystick-base');
const joystickStick=document.getElementById('joystick-stick');
const btnDash=document.getElementById('btn-dash');
const btnAttack=document.getElementById('btn-attack');

let touchX=0;
let touchY=0;
let activeTouchId=null;

joystickBase.addEventListener('touchstart',e=>{
  AudioEngine.init();
  e.preventDefault();

  const t=e.changedTouches[0];
  activeTouchId=t.identifier;

  handleJoystickMove(t);
},{passive:false});

addEventListener('touchmove',e=>{
  if(activeTouchId===null)return;

  for(const t of e.changedTouches){
    if(t.identifier===activeTouchId){
      handleJoystickMove(t);
      break;
    }
  }
},{passive:false});

function resetJoystick(e){
  for(const t of e.changedTouches){
    if(t.identifier===activeTouchId){
      activeTouchId=null;
      touchX=0;
      touchY=0;
      joystickStick.style.transform='translate(-50%,-50%)';
      break;
    }
  }
}

addEventListener('touchend',resetJoystick);
addEventListener('touchcancel',resetJoystick);

function handleJoystickMove(t){
  const r=joystickBase.getBoundingClientRect();

  const cx=r.left+r.width/2;
  const cy=r.top+r.height/2;

  const dx=t.clientX-cx;
  const dy=t.clientY-cy;

  const d=Math.hypot(dx,dy);
  const max=r.width/2;

  const a=Math.atan2(dy,dx);
  const cd=Math.min(d,max);

  touchX=Math.cos(a)*(cd/max);
  touchY=Math.sin(a)*(cd/max);

  joystickStick.style.transform=
    `translate(calc(-50% + ${Math.cos(a)*cd}px),calc(-50% + ${Math.sin(a)*cd}px))`;
}

btnDash.addEventListener('touchstart',e=>{
  e.preventDefault();
  AudioEngine.init();

  if(gameState===STATES.PLAYING){
    Player.dash();
  }
});

btnAttack.addEventListener('touchstart',e=>{
  e.preventDefault();
  AudioEngine.init();

  if(gameState!==STATES.PLAYING)return;

  if(buildMode.active){
    placeDefense();
  }else if(!checkStandsInteraction()){
    Player.attack();
  }
});

let particles=[];
let floatingTexts=[];
let shockwaves=[];
let droppedParts=[];
let spikes=[];

function addDust(
  x,
  y,
  count=8,
  color='#e8c288',
  sizeMax=5
){
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2;
    const s=Math.random()*3+1;

    particles.push({
      x:x+(Math.random()-.5)*16,
      y:y+(Math.random()-.5)*10,
      vx:Math.cos(a)*s,
      vy:Math.sin(a)*s*.6,
      size:Math.floor(Math.random()*sizeMax)+3,
      color,
      life:1,
      decay:Math.random()*.04+.03
    });
  }
}

function addChunks(x,y,count=15){
  const pal=[
    '#2ed573',
    '#1e824c',
    '#55efc4',
    '#ffa502'
  ];

  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2;
    const s=Math.random()*5+2;

    particles.push({
      x,
      y,
      vx:Math.cos(a)*s,
      vy:Math.sin(a)*s-2,
      size:Math.floor(Math.random()*6)+4,
      color:pal[Math.floor(Math.random()*pal.length)],
      life:1,
      decay:.032
    });
  }
}

function addShockwave(
  x,
  y,
  r=55,
  color='#ffd32a'
){
  shockwaves.push({
    x,
    y,
    r:10,
    maxR:r,
    color,
    life:1
  });
}

function addFloatText(
  x,
  y,
  text,
  color='#ffd32a',
  size=16
){
  floatingTexts.push({
    x,
    y,
    text,
    color,
    size,
    life:1,
    vy:-1.2
  });
}

function dropParts(x,y,count){
  for(let i=0;i<count;i++){
    const a=Math.random()*Math.PI*2;
    const d=Math.random()*55+15;

    droppedParts.push({
      x,
      y,
      targetX:Math.max(
        30,
        Math.min(screenW-30,x+Math.cos(a)*d)
      ),
      targetY:Math.max(
        60,
        Math.min(screenH-30,y+Math.sin(a)*d)
      ),
      progress:0,
      bob:Math.random()*6.28
    });
  }
}

function fireSpike(x,y,vx,vy,s){
  spikes.push({
    x,
    y,
    vx:vx*s,
    vy:vy*s,
    size:10,
    trail:[]
  });
}

const PixelIcons={
  heart(x,y,full){
    ctx.save();
    ctx.translate(x,y);

    ctx.fillStyle=full?'#ff4757':'#332b45';

    ctx.fillRect(1,0,2,1);
    ctx.fillRect(4,0,2,1);
    ctx.fillRect(0,1,7,3);
    ctx.fillRect(1,4,5,1);
    ctx.fillRect(2,5,3,1);
    ctx.fillRect(3,6,1,1);

    if(full){
      ctx.fillStyle='#ff8a94';
      ctx.fillRect(1,1,1,1);
    }

    ctx.restore();
  },

  coin(x,y){
    ctx.fillStyle='#b37402';
    ctx.fillRect(x-3,y-4,6,8);

    ctx.fillStyle='#ffd32a';
    ctx.fillRect(x-2,y-3,4,6);

    ctx.fillStyle='#fff48f';
    ctx.fillRect(x-2,y-2,2,2);
  },

  cactus(x,y){
    ctx.fillStyle='#1e824c';
    ctx.fillRect(x-4,y-4,8,8);

    ctx.fillStyle='#2ed573';
    ctx.fillRect(x-3,y-3,6,6);

    ctx.fillStyle='#ffa502';
    ctx.fillRect(x-1,y-1,2,2);
  }
};

const Player={
  x:0,
  y:0,

  /* Restored faster normal movement. */
  baseSpeed:5.2,

  facing:'down',

  eyeLookX:0,
  eyeLookY:2,

  blinkTimer:2.5,
  isBlinking:false,

  squashX:1,
  squashY:1,

  health:4,
  maxHealth:4,

  shield:0,
  invincibleTimer:0,

  dashing:false,
  dashTimer:0,
  dashCooldownTimer:0,

  dashVx:0,
  dashVy:0,

  dashTrail:[],

  isAttacking:false,
  attackTimer:0,
  attackCooldown:0,

  reset(){
    this.x=screenW/2;
    this.y=screenH/2;

    this.health=this.maxHealth;
    this.shield=SaveData.upgrades.tempShield?1:0;

    this.dashing=false;
    this.dashTimer=0;
    this.dashCooldownTimer=0;

    this.isAttacking=false;
    this.attackCooldown=0;

    this.invincibleTimer=0;
    this.dashTrail=[];
  },

  getSpeed(){
    return this.baseSpeed+
      SaveData.upgrades.moveSpeed*.45;
  },

  getHammerDelay(){
    return Math.max(
      .18,
      .44-SaveData.upgrades.hammerSpeed*.05
    );
  },

  getHammerDamage(){
    return 26+
      SaveData.upgrades.hammerStrength*14;
  },

  getDashDuration(){
    return .17+
      SaveData.upgrades.dashLength*.035;
  },

  getDashCooldown(){
    return Math.max(
      .55,
      1.4-SaveData.upgrades.dashCooldown*.16
    );
  },

  dash(){
    if(
      this.dashCooldownTimer>0 ||
      this.dashing ||
      buildMode.active
    )return;

    AudioEngine.dash();

    this.dashing=true;

    this.dashTimer=this.getDashDuration();
    this.dashCooldownTimer=this.getDashCooldown();

    let dx=0;
    let dy=0;

    if(keys.w||keys.arrowup)dy--;
    if(keys.s||keys.arrowdown)dy++;
    if(keys.a||keys.arrowleft)dx--;
    if(keys.d||keys.arrowright)dx++;

    if(touchX||touchY){
      dx=touchX;
      dy=touchY;
    }

    if(!dx&&!dy){
      if(this.facing==='up')dy=-1;
      else if(this.facing==='down')dy=1;
      else if(this.facing==='left')dx=-1;
      else dx=1;
    }

    const l=Math.hypot(dx,dy)||1;

    this.dashVx=dx/l*12.5;
    this.dashVy=dy/l*12.5;

    addDust(this.x,this.y,10,'#fff');

    if(SaveData.upgrades.shockwaveDash){
      spikes=spikes.filter(s=>{
        if(Math.hypot(
          s.x-this.x,
          s.y-this.y
        )<110){
          addDust(s.x,s.y,5,'#ffd32a');
          return false;
        }

        return true;
      });
    }
  },

  attack(){
    if(
      this.attackCooldown>0 ||
      this.dashing ||
      buildMode.active
    )return;

    AudioEngine.hammerSwing();

    this.isAttacking=true;
    this.attackTimer=.2;
    this.attackCooldown=this.getHammerDelay();

    const sx=this.x+
      (
        this.facing==='left'
          ?-22
          :this.facing==='right'
            ?22
            :0
      );

    const sy=this.y+
      (
        this.facing==='up'
          ?-22
          :this.facing==='down'
            ?22
            :0
      );

    addShockwave(sx,sy,48,'#fff');

    let hit=false;

    spikes=spikes.filter(s=>{
      if(Math.hypot(
        s.x-sx,
        s.y-sy
      )<58){
        addDust(s.x,s.y,5,'#ffd32a');
        hit=true;
        return false;
      }

      return true;
    });

    if(hit){
      AudioEngine.deflect();
    }

    activeCacti.forEach(c=>{
      if(
        c.state==='GROUNDED' &&
        Math.hypot(
          sx-c.x,
          sy-c.y
        )<c.width/2+52
      ){
        c.hit(this.getHammerDamage());
        hit=true;
      }
    });

    zombies.forEach(z=>{
      if(
        !z.dead &&
        Math.hypot(
          sx-z.x,
          sy-z.y
        )<48
      ){
        z.takeDamage(this.getHammerDamage());
        hit=true;
      }
    });

    if(hit){
      triggerHitStop(.035);
    }
  },

  takeDamage(a=1){
    if(
      this.invincibleTimer>0 ||
      this.dashing
    )return;

    if(this.shield>0){
      this.shield--;
      this.invincibleTimer=.8;

      addFloatText(
        this.x,
        this.y-30,
        'SHIELD SAVED!',
        '#00e1ff',
        16
      );

      return;
    }

    this.health-=a;
    this.invincibleTimer=1;

    AudioEngine.hurt();

    triggerShake(9,.35);

    addDust(
      this.x,
      this.y,
      12,
      '#ff4757'
    );

    addFloatText(
      this.x,
      this.y-30,
      '-1 HP',
      '#ff2222',
      20
    );

    if(this.health<=0){
      /* COMPLETE RESET ON DEATH */
      freshRun();
      this.reset();
      gameState=STATES.GAMEOVER;
    }
  },

  update(dt){
    this.dashCooldownTimer=
      Math.max(
        0,
        this.dashCooldownTimer-dt
      );

    this.attackCooldown=
      Math.max(
        0,
        this.attackCooldown-dt
      );

    if(this.attackTimer>0){
      this.attackTimer-=dt;

      if(this.attackTimer<=0){
        this.isAttacking=false;
      }
    }

    this.invincibleTimer=
      Math.max(
        0,
        this.invincibleTimer-dt
      );

    this.blinkTimer-=dt;

    if(this.blinkTimer<=0){
      this.isBlinking=true;

      if(this.blinkTimer<-.15){
        this.isBlinking=false;
        this.blinkTimer=Math.random()*3+2;
      }
    }

    if(this.dashing){

      this.dashTimer-=dt;

      this.x+=this.dashVx*(dt*60);
      this.y+=this.dashVy*(dt*60);

      this.squashX=1.25;
      this.squashY=.8;

      if(this.dashTimer<=0){
        this.dashing=false;
      }

    }else{

      let mx=0;
      let my=0;

      if(keys.w||keys.arrowup)my--;
      if(keys.s||keys.arrowdown)my++;
      if(keys.a||keys.arrowleft)mx--;
      if(keys.d||keys.arrowright)mx++;

      if(touchX||touchY){
        mx=touchX;
        my=touchY;
      }

      if(mx||my){

        const l=Math.hypot(mx,my);
        const s=this.getSpeed();

        this.x+=mx/l*s*(dt*60);
        this.y+=my/l*s*(dt*60);

        this.eyeLookX=mx/l*4;
        this.eyeLookY=my/l*4;

        this.squashX=
          1+Math.sin(Date.now()*.02)*.08;

        this.squashY=
          1-Math.sin(Date.now()*.02)*.08;

        if(Math.abs(mx)>Math.abs(my)){
          this.facing=mx>0?'right':'left';
        }else{
          this.facing=my>0?'down':'up';
        }

      }else{

        this.eyeLookX*=.8;
        this.eyeLookY=2;

        this.squashX=1;
        this.squashY=1;
      }
    }

    this.x=Math.max(
      24,
      Math.min(screenW-24,this.x)
    );

    this.y=Math.max(
      72,
      Math.min(screenH-24,this.y)
    );
  },

  draw(){

    if(
      this.invincibleTimer>0 &&
      Math.floor(Date.now()/60)%2===0
    )return;

    ctx.fillStyle='rgba(0,0,0,.45)';

    ctx.beginPath();

    ctx.ellipse(
      this.x,
      this.y+16,
      16*this.squashX,
      7,
      0,
      0,
      Math.PI*2
    );

    ctx.fill();

    if(this.shield){
      ctx.strokeStyle='#00f0ff';
      ctx.lineWidth=3;

      ctx.beginPath();

      ctx.arc(
        this.x,
        this.y,
        24+Math.sin(Date.now()*.008)*2,
        0,
        Math.PI*2
      );

      ctx.stroke();
    }

    drawBlockPlayer(
      this.x,
      this.y,
      this.facing,
      this.eyeLookX,
      this.eyeLookY,
      this.isBlinking,
      this.squashX,
      this.squashY,
      null,
      this.isAttacking,
      this.attackTimer
    );
  }
};

function drawBlockPlayer(
  x,
  y,
  facing,
  eyeX,
  eyeY,
  blink,
  sx,
  sy,
  tint=null,
  attacking=false,
  attackTimer=0
){
  ctx.save();

  ctx.translate(
    Math.round(x),
    Math.round(y)
  );

  ctx.scale(sx,sy);

  const b=30;
  const body=tint||'#ffa801';
  const shade=tint||'#d35400';
  const hi=tint||'#ffd32a';

  ctx.fillStyle=body;
  ctx.fillRect(-15,-15,30,30);

  ctx.fillStyle=hi;
  ctx.fillRect(-15,-15,30,4);

  ctx.fillStyle=shade;
  ctx.fillRect(-15,11,30,4);
  ctx.fillRect(11,-15,4,30);

  if(!blink){

    ctx.fillStyle='#fff';

    ctx.fillRect(
      -11+eyeX,
      -3+eyeY,
      6,
      8
    );

    ctx.fillRect(
      5+eyeX,
      -3+eyeY,
      6,
      8
    );

    ctx.fillStyle='#0f0f1c';

    ctx.fillRect(
      -10+eyeX,
      -1+eyeY,
      3,
      4
    );

    ctx.fillRect(
      6+eyeX,
      -1+eyeY,
      3,
      4
    );

  }else{

    ctx.fillStyle='#0f0f1c';

    ctx.fillRect(-9,1,7,2);
    ctx.fillRect(3,1,7,2);
  }

  const side=facing==='left'?-1:1;

  if(attacking){

    ctx.save();

    const p=(.2-attackTimer)/.2;

    ctx.translate(
      side*14,
      -4
    );

    ctx.rotate(
      side*Math.sin(p*Math.PI)*2.2
    );

    ctx.fillStyle='#8b5a2b';
    ctx.fillRect(-2,-26,4,30);

    ctx.fillStyle='#718093';
    ctx.fillRect(-12,-34,24,12);

    ctx.fillStyle='#dcdde1';
    ctx.fillRect(-12,-34,4,12);

    ctx.restore();

  }else{

    ctx.fillStyle='#8b5a2b';
    ctx.fillRect(side*12,-10,3,22);

    ctx.fillStyle='#718093';
    ctx.fillRect(
      side*12-5,
      -16,
      14,
      8
    );
  }

  ctx.restore();
}

const CACTUS_TYPES={
  SMALL:{
    scale:.7,
    spikes:6,
    speed:4.8,
    drops:2,
    hp:.6
  },
  MEDIUM:{
    scale:1,
    spikes:10,
    speed:3.8,
    drops:4,
    hp:1
  },
  GIANT:{
    scale:1.5,
    spikes:16,
    speed:3.2,
    drops:8,
    hp:2.2
  }
};

class Cactus{

  constructor(x,y,typeKey){

    this.x=x;
    this.y=y;

    this.type=CACTUS_TYPES[typeKey];
    this.scale=this.type.scale;

    this.width=46*this.scale;
    this.height=68*this.scale;

    const base=35+SaveData.wave*10;

    this.maxHp=Math.round(
      base*this.type.hp
    );

    this.hp=this.maxHp;

    this.state='WARNING';

    this.warnTimer=1.25;
    this.yHeight=400;
    this.fallSpeed=0;
    this.plopTimer=0;
    this.shake=0;
    this.warned=false;
  }

  hit(d){

    if(this.state!=='GROUNDED')return;

    this.hp-=d;
    this.shake=.15;

    AudioEngine.hammerHit();

    addChunks(
      this.x,
      this.y,
      6
    );

    addFloatText(
      this.x,
      this.y-30,
      `-${d}`,
      '#fffa40',
      17
    );

    if(this.hp<=0){
      this.destroy();
    }
  }

  destroy(){

    this.state='DESTROYED';

    AudioEngine.destroy();

    triggerShake(
      7*this.scale,
      .3
    );

    addChunks(
      this.x,
      this.y,
      20*this.scale
    );

    const n=
      this.type.drops+
      SaveData.upgrades.harvestYield*2;

    dropParts(
      this.x,
      this.y,
      n
    );

    addFloatText(
      this.x,
      this.y-40,
      `+${n} PARTS!`,
      '#2ed573',
      18
    );
  }

  fireSpikes(){

    const n=
      this.type.spikes+
      Math.min(
        8,
        Math.floor(SaveData.wave*.5)
      );

    const step=Math.PI*2/n;
    const off=Math.random()*Math.PI;

    for(let i=0;i<n;i++){

      const a=off+i*step;

      fireSpike(
        this.x,
        this.y+6,
        Math.cos(a),
        Math.sin(a),
        this.type.speed
      );
    }
  }

  update(dt){

    if(this.shake>0){
      this.shake-=dt;
    }

    if(this.state==='WARNING'){

      this.warnTimer-=dt;

      if(
        !this.warned &&
        this.warnTimer<.65
      ){
        AudioEngine.warning();
        this.warned=true;
      }

      if(this.warnTimer<=0){

        this.state='FALLING';
        this.fallSpeed=6;

        AudioEngine.fall();
      }

    }else if(this.state==='FALLING'){

      this.fallSpeed+=30*dt;
      this.yHeight-=this.fallSpeed;

      if(this.yHeight<=0){

        this.yHeight=0;
        this.state='IMPACT';
        this.plopTimer=.5;

        AudioEngine.plop();

        triggerShake(
          8*this.scale,
          .3
        );

        addDust(
          this.x,
          this.y+16*this.scale,
          15,
          '#d8aa6d',
          6
        );

        this.fireSpikes();
      }

    }else if(this.state==='IMPACT'){

      this.plopTimer-=dt;

      if(this.plopTimer<=0){
        this.state='GROUNDED';
      }
    }
  }

  draw(){

    if(this.state==='DESTROYED')return;

    const sr=Math.max(
      .2,
      1-this.yHeight/400*.7
    );

    ctx.fillStyle='rgba(0,0,0,.5)';

    ctx.beginPath();

    ctx.ellipse(
      this.x,
      this.y+16*this.scale,
      26*this.scale*sr,
      12*this.scale*sr,
      0,
      0,
      Math.PI*2
    );

    ctx.fill();

    if(this.state==='WARNING'){

      ctx.strokeStyle=
        Date.now()%200<100
          ?'#ff4757'
          :'#ffd32a';

      ctx.lineWidth=3;

      ctx.beginPath();

      ctx.arc(
        this.x,
        this.y,
        36*this.scale+
          Math.sin(Date.now()*.016)*4,
        0,
        Math.PI*2
      );

      ctx.stroke();

      ctx.fillStyle='#ff4757';
      ctx.font='bold 12px Courier New';
      ctx.textAlign='center';

      ctx.fillText(
        'CACTUS DROP',
        this.x,
        this.y-44*this.scale
      );
    }

    ctx.save();

    let dx=this.x;
    let dy=this.y-this.yHeight;

    if(this.shake>0){
      dx+=(Math.random()-.5)*6;
      dy+=(Math.random()-.5)*6;
    }

    ctx.translate(dx,dy);
    ctx.scale(this.scale,this.scale);

    renderCactus();

    ctx.restore();

    if(this.state==='GROUNDED'){

      const w=54*this.scale;
      const bx=this.x-w/2;
      const by=this.y-56*this.scale;

      ctx.fillStyle='#0a0a14';
      ctx.fillRect(
        bx-2,
        by-2,
        w+4,
        11
      );

      ctx.fillStyle=
        this.hp/this.maxHp>.35
          ?'#2ed573'
          :'#ff4757';

      ctx.fillRect(
        bx,
        by,
        w*Math.max(
          0,
          this.hp/this.maxHp
        ),
        7
      );
    }
  }
}

function renderCactus(){

  ctx.fillStyle='#2ed573';

  ctx.fillRect(-14,-36,28,52);

  ctx.fillRect(-28,-20,16,10);
  ctx.fillRect(-28,-32,10,16);

  ctx.fillRect(12,-14,16,10);
  ctx.fillRect(18,-28,10,18);

  ctx.fillStyle='#1e824c';

  ctx.fillRect(-14,-36,6,52);
  ctx.fillRect(-28,-32,3,16);

  ctx.fillStyle='#7bed9f';

  ctx.fillRect(4,-34,4,50);
  ctx.fillRect(24,-28,3,18);

  ctx.fillStyle='#fff';

  ctx.fillRect(-16,-26,3,2);
  ctx.fillRect(-16,-10,3,2);
  ctx.fillRect(14,-28,3,2);
  ctx.fillRect(14,-8,3,2);

  ctx.fillStyle='#ff4757';
  ctx.fillRect(-6,-42,12,6);
}

/* LEVEL SYSTEM */

let activeCacti=[];
let zombies=[];

let levelCactiTarget=0;
let levelZombieTarget=0;

let cactiSpawned=0;
let zombiesSpawned=0;

let cactusTimer=0;
let zombieTimer=0;

let levelCleared=false;
let levelIntroTimer=0;

function levelTargets(l){
  return{
    cacti:Math.min(40,8+l*3),
    zombies:Math.min(35,4+l*2)
  };
}

function initWave(n){

  /*
    IMPORTANT:
    Defenses are NOT cleared here.
    They remain between levels.
  */

  activeCacti=[];
  zombies=[];
  spikes=[];
  droppedParts=[];

  buildMode.active=false;
  selectedDefense=null;
  dragDefense=null;

  const t=levelTargets(n);

  levelCactiTarget=t.cacti;
  levelZombieTarget=t.zombies;

  cactiSpawned=0;
  zombiesSpawned=0;

  cactusTimer=.5;
  zombieTimer=2;

  levelCleared=false;
  levelIntroTimer=1.4;

  Stands.active=false;

  addFloatText(
    screenW/2,
    screenH/2-70,
    `LEVEL ${n}`,
    '#ffd32a',
    28
  );
}

function randomSpawn(){

  const p=90;

  return{
    x:p+Math.random()*(screenW-p*2),
    y:80+Math.random()*(screenH-110)
  };
}

function updateWave(dt){

  if(levelIntroTimer>0){
    levelIntroTimer-=dt;
  }

  if(
    cactiSpawned<levelCactiTarget &&
    cactusTimer<=0
  ){

    const p=randomSpawn();

    const r=Math.random();

    const type=
      r<.55
        ?'SMALL'
        :r<.88
          ?'MEDIUM'
          :'GIANT';

    activeCacti.push(
      new Cactus(
        p.x,
        p.y,
        type
      )
    );

    cactiSpawned++;

    cactusTimer=
      Math.max(
        .18,
        .7-SaveData.wave*.015
      );
  }else{
    cactusTimer-=dt;
  }

  if(
    zombiesSpawned<levelZombieTarget &&
    zombieTimer<=0
  ){

    spawnZombie();

    zombiesSpawned++;

    zombieTimer=
      Math.max(
        .35,
        1.7-SaveData.wave*.025
      );
  }else{
    zombieTimer-=dt;
  }

  activeCacti=
    activeCacti.filter(
      c=>c.state!=='DESTROYED'
    );

  zombies=
    zombies.filter(
      z=>!z.dead
    );

  const allCactiDone=
    cactiSpawned>=levelCactiTarget &&
    activeCacti.length===0;

  const allZombiesDone=
    zombiesSpawned>=levelZombieTarget &&
    zombies.length===0;

  if(
    !levelCleared &&
    allCactiDone &&
    allZombiesDone
  ){

    levelCleared=true;

    Stands.spawn();

    AudioEngine.coin();

    addFloatText(
      screenW/2,
      screenH/2-80,
      'LEVEL CLEARED!',
      '#2ed573',
      25
    );
  }
}

class Zombie{

  constructor(x,y){

    this.x=x;
    this.y=y;

    this.maxHp=
      45+SaveData.wave*12;

    this.hp=this.maxHp;

    this.dead=false;

    this.speed=
      1+
      Math.min(
        .8,
        SaveData.wave*.025
      );

    this.attackCd=0;
    this.target=null;
    this.hitFlash=0;
    this.radius=17;
  }

  takeDamage(d){

    if(this.dead)return;

    this.hp-=d;
    this.hitFlash=.12;

    addFloatText(
      this.x,
      this.y-25,
      `-${d}`,
      '#fffa40',
      14
    );

    addDust(
      this.x,
      this.y,
      4,
      '#b7e4c7',
      3
    );

    if(this.hp<=0){
      this.die();
    }
  }

  die(){

    this.dead=true;

    AudioEngine.zombie();

    addDust(
      this.x,
      this.y,
      14,
      '#6abf69',
      5
    );

    addFloatText(
      this.x,
      this.y-25,
      'ZOMBIE DOWN',
      '#2ed573',
      13
    );
  }

  update(dt){

    if(this.dead)return;

    this.hitFlash=
      Math.max(
        0,
        this.hitFlash-dt
      );

    this.attackCd=
      Math.max(
        0,
        this.attackCd-dt
      );

    let best=null;
    let bestD=Infinity;

    for(const d of defenses){

      if(d.dead)continue;

      const dist=Math.hypot(
        this.x-d.x,
        this.y-d.y
      );

      if(dist<bestD){
        bestD=dist;
        best=d;
      }
    }

    const playerD=Math.hypot(
      this.x-Player.x,
      this.y-Player.y
    );

    if(best&&bestD<250){
      this.target=best;
    }else{
      this.target=Player;
    }

    if(this.target){

      const tx=this.target.x;
      const ty=this.target.y;

      const dx=tx-this.x;
      const dy=ty-this.y;

      const dist=Math.hypot(dx,dy)||1;

      const stop=
        this.target===Player
          ?25
          :(this.target.type==='wall'
            ?36
            :32);

      if(dist>stop){

        this.x+=
          dx/dist*this.speed;

        this.y+=
          dy/dist*this.speed;

      }else if(this.attackCd<=0){

        this.attackCd=
          Math.max(
            .35,
            1.05-SaveData.wave*.025
          );

        if(this.target===Player){

          Player.takeDamage(1);

        }else{

          this.target.takeDamage(
            18+SaveData.wave*2
          );
        }
      }
    }

    this.x=Math.max(
      24,
      Math.min(
        screenW-24,
        this.x
      )
    );

    this.y=Math.max(
      68,
      Math.min(
        screenH-24,
        this.y
      )
    );
  }

  draw(){

    if(this.dead)return;

    ctx.fillStyle='rgba(0,0,0,.45)';

    ctx.beginPath();

    ctx.ellipse(
      this.x,
      this.y+16,
      18,
      7,
      0,
      0,
      Math.PI*2
    );

    ctx.fill();

    ctx.save();

    ctx.translate(
      Math.round(this.x),
      Math.round(this.y)
    );

    ctx.fillStyle=
      this.hitFlash>0
        ?'#fff'
        :'#6abf69';

    ctx.fillRect(
      -14,
      -17,
      28,
      30
    );

    ctx.fillStyle='#386b3a';

    ctx.fillRect(
      -14,
      8,
      28,
      5
    );

    ctx.fillStyle='#c8ffd0';

    ctx.fillRect(-10,-10,7,7);
    ctx.fillRect(3,-10,7,7);

    ctx.fillStyle='#152018';

    ctx.fillRect(-8,-8,3,4);
    ctx.fillRect(5,-8,3,4);

    ctx.fillStyle='#4b7845';

    ctx.fillRect(-20,-7,6,8);
    ctx.fillRect(14,-4,7,7);

    ctx.restore();

    const w=38;
    const bx=this.x-w/2;
    const by=this.y-29;

    ctx.fillStyle='#111';

    ctx.fillRect(
      bx-1,
      by-1,
      w+2,
      6
    );

    ctx.fillStyle='#ff4757';

    ctx.fillRect(
      bx,
      by,
      w*Math.max(
        0,
        this.hp/this.maxHp
      ),
      4
    );
  }
}

function spawnZombie(){

  const side=
    Math.floor(Math.random()*4);

  let x,y;

  if(side===0){

    x=Math.random()*screenW;
    y=65;

  }else if(side===1){

    x=screenW-20;
    y=70+Math.random()*(screenH-90);

  }else if(side===2){

    x=Math.random()*screenW;
    y=screenH-20;

  }else{

    x=20;
    y=70+Math.random()*(screenH-90);
  }

  zombies.push(
    new Zombie(x,y)
  );

  AudioEngine.zombie();
}

/* DEFENSE BUILDING */

let defenses=[];

const buildMode={
  active:false,
  type:null,
  rotation:0,
  x:0,
  y:0
};

let selectedDefense=null;
let dragDefense=null;
let dragOffsetX=0;
let dragOffsetY=0;

function beginBuild(type){

  if(!levelCleared)return;

  const p=PROTECTION_DB[type];

  if(SaveData.money<p.cost){

    addFloatText(
      Player.x,
      Player.y-40,
      'NOT ENOUGH GOLD',
      '#ff4757',
      15
    );

    return;
  }

  closeAllModals();

  buildMode.active=true;
  buildMode.type=type;
  buildMode.rotation=0;

  buildMode.x=Player.x;
  buildMode.y=Player.y;

  addFloatText(
    Player.x,
    Player.y-42,
    type==='wall'
      ?'PLACE WALL'
      :'PLACE TURRET',
    '#00d2d3',
    15
  );
}

function cancelBuild(){
  buildMode.active=false;
  buildMode.type=null;
}

function rotateBuild(key){

  if(
    !buildMode.active ||
    buildMode.type!=='wall'
  )return;

  buildMode.rotation=
    (
      buildMode.rotation+
      (
        key==='ArrowLeft'||
        key==='ArrowUp'
          ?90
          :270
      )
    )%360;
}

function canvasPoint(e){

  const r=canvas.getBoundingClientRect();

  return{
    x:(e.clientX-r.left)*
      (canvas.width/r.width),

    y:(e.clientY-r.top)*
      (canvas.height/r.height)
  };
}

function defenseAt(x,y){

  for(
    let i=defenses.length-1;
    i>=0;
    i--
  ){

    const d=defenses[i];

    if(d.dead)continue;

    const hit=
      d.type==='wall'
        ?Math.hypot(
          x-d.x,
          y-d.y
        )<48
        :Math.hypot(
          x-d.x,
          y-d.y
        )<30;

    if(hit)return d;
  }

  return null;
}

/* Walls/turrets can now be dragged around. */
function canMoveDefense(d,x,y){

  if(
    x<45 ||
    x>screenW-45 ||
    y<70 ||
    y>screenH-35
  )return false;

  if(
    Math.hypot(
      Player.x-x,
      Player.y-y
    )<30
  )return false;

  for(const other of defenses){

    if(
      other!==d &&
      !other.dead &&
      Math.hypot(
        other.x-x,
        other.y-y
      )<42
    ){
      return false;
    }
  }

  for(const c of activeCacti){

    if(
      c.state!=='DESTROYED' &&
      Math.hypot(
        c.x-x,
        c.y-y
      )<38
    ){
      return false;
    }
  }

  return true;
}

function moveDefenseTo(d,x,y){

  if(!d)return false;

  if(!canMoveDefense(d,x,y)){
    return false;
  }

  d.x=x;
  d.y=y;

  saveGame();

  return true;
}

function validPlacement(x,y,type){

  if(
    x<45 ||
    x>screenW-45 ||
    y<70 ||
    y>screenH-35
  )return false;

  if(
    Math.hypot(
      Player.x-x,
      Player.y-y
    )<40
  )return false;

  for(const d of defenses){

    if(
      !d.dead &&
      Math.hypot(
        d.x-x,
        d.y-y
      )<45
    ){
      return false;
    }
  }

  for(const c of activeCacti){

    if(
      c.state!=='DESTROYED' &&
      Math.hypot(
        c.x-x,
        c.y-y
      )<45
    ){
      return false;
    }
  }

  return true;
}

function placeDefense(
  x=buildMode.x,
  y=buildMode.y
){

  if(!buildMode.active)return;

  const p=PROTECTION_DB[
    buildMode.type
  ];

  if(SaveData.money<p.cost){
    cancelBuild();
    return;
  }

  if(x==null){
    x=Player.x;
    y=Player.y;
  }

  if(
    !validPlacement(
      x,
      y,
      buildMode.type
    )
  ){

    addFloatText(
      x,
      y,
      'BAD SPOT',
      '#ff4757',
      13
    );

    return;
  }

  SaveData.money-=p.cost;

  const d={
    type:buildMode.type,
    x,
    y,
    rotation:buildMode.rotation,
    hp:p.hp,
    maxHp:p.hp,
    dead:false,
    fireCd:0
  };

  defenses.push(d);

  selectedDefense=d;

  saveGame();

  AudioEngine.coin();

  addDust(
    x,
    y,
    12,
    buildMode.type==='wall'
      ?'#718093'
      :'#00d2d3'
  );

  addFloatText(
    x,
    y-35,
    'BUILT!',
    '#2ed573',
    15
  );

  cancelBuild();
}

function updateDefenses(dt){

  for(
    let i=defenses.length-1;
    i>=0;
    i--
  ){

    const d=defenses[i];

    if(d.dead){
      defenses.splice(i,1);
      continue;
    }

    if(d.type==='turret'){

      d.fireCd=
        Math.max(
          0,
          d.fireCd-dt
        );

      if(d.fireCd<=0){

        let target=null;
        let best=Infinity;

        for(const z of zombies){

          if(z.dead)continue;

          const dist=Math.hypot(
            z.x-d.x,
            z.y-d.y
          );

          if(
            dist<145 &&
            dist<best
          ){
            best=dist;
            target=z;
          }
        }

        if(target){

          target.takeDamage(
            18+SaveData.wave*2
          );

          d.fireCd=.55;

          AudioEngine.turret();

          addShockwave(
            target.x,
            target.y,
            15,
            '#00d2d3'
          );
        }
      }
    }

    if(d.hp<=0){

      d.dead=true;

      AudioEngine.destroy();

      addDust(
        d.x,
        d.y,
        20,
        '#747d8c'
      );

      addFloatText(
        d.x,
        d.y-25,
        `${d.type==='wall'?'WALL':'TURRET'} DESTROYED`,
        '#ff4757',
        13
      );
    }
  }
}

function drawDefense(d){

  if(d.dead)return;

  ctx.save();

  ctx.translate(
    d.x,
    d.y
  );

  if(d.type==='wall'){

    ctx.rotate(
      d.rotation*Math.PI/180
    );

    ctx.fillStyle='#202b38';
    ctx.fillRect(
      -38,
      -10,
      76,
      20
    );

    ctx.fillStyle='#718093';
    ctx.fillRect(
      -38,
      -10,
      76,
      5
    );

    ctx.fillStyle='#9aa6b2';

    ctx.fillRect(
      -30,
      -5,
      8,
      5
    );

    ctx.fillRect(
      -5,
      -5,
      8,
      5
    );

    ctx.fillRect(
      20,
      -5,
      8,
      5
    );

  }else{

    if(d===selectedDefense){

      ctx.fillStyle='rgba(0,210,211,.10)';

      ctx.beginPath();

      ctx.arc(
        0,
        0,
        145,
        0,
        Math.PI*2
      );

      ctx.fill();
    }

    ctx.fillStyle='#2f3b45';

    ctx.fillRect(
      -17,
      -17,
      34,
      34
    );

    ctx.fillStyle='#00d2d3';

    ctx.fillRect(
      -7,
      -27,
      14,
      18
    );

    ctx.fillStyle='#718093';

    ctx.fillRect(
      -4,
      -37,
      8,
      13
    );

    ctx.fillRect(
      -37,
      -4,
      13,
      8
    );

    ctx.fillRect(
      24,
      -4,
      13,
      8
    );
  }

  ctx.restore();

  if(d===selectedDefense){

    ctx.strokeStyle='#fff';
    ctx.lineWidth=2;
    ctx.setLineDash([5,4]);

    ctx.strokeRect(
      d.x-48,
      d.y-48,
      96,
      96
    );

    ctx.setLineDash([]);
  }

  const w=72;
  const bx=d.x-w/2;
  const by=d.y-48;

  ctx.fillStyle='#10151b';

  ctx.fillRect(
    bx-2,
    by-2,
    w+4,
    8
  );

  ctx.fillStyle=
    d.type==='wall'
      ?'#ffd32a'
      :'#00d2d3';

  ctx.fillRect(
    bx,
    by,
    w*Math.max(
      0,
      d.hp/d.maxHp
    ),
    4
  );
}

const Stands={
  active:false,

  sell:{x:0,y:0},
  shop:{x:0,y:0},
  protect:{x:0,y:0},

  next:{
    x:0,
    y:0,
    r:42
  },

  spawn(){

    this.active=true;

    const cy=screenH/2;

    this.sell.x=
      screenW/2-220;

    this.shop.x=
      screenW/2;

    this.protect.x=
      screenW/2+220;

    this.sell.y=
      this.shop.y=
      this.protect.y=
      cy;

    this.next.x=
      screenW/2;

    this.next.y=
      cy+120;

    addDust(
      this.sell.x,
      cy,
      12,
      '#ffa502'
    );

    addDust(
      this.shop.x,
      cy,
      12,
      '#3742fa'
    );

    addDust(
      this.protect.x,
      cy,
      12,
      '#00d2d3'
    );
  },

  draw(){

    if(!this.active)return;

    drawStand(
      this.sell.x,
      this.sell.y,
      '#ffa502',
      '#e67e22',
      'SELL',
      'STAND'
    );

    drawStand(
      this.shop.x,
      this.shop.y,
      '#3742fa',
      '#2f3542',
      'SHOP',
      'UPGRADES'
    );

    drawStand(
      this.protect.x,
      this.protect.y,
      '#00d2d3',
      '#126e75',
      'PROTECTION',
      'SHOP'
    );

    ctx.save();

    ctx.translate(
      this.next.x,
      this.next.y
    );

    const p=
      Math.sin(Date.now()*.008)*4;

    ctx.strokeStyle='#2ed573';
    ctx.lineWidth=4;

    ctx.beginPath();

    ctx.arc(
      0,
      0,
      this.next.r+p,
      0,
      Math.PI*2
    );

    ctx.stroke();

    ctx.fillStyle='#fff';
    ctx.textAlign='center';

    ctx.font='bold 12px Courier New';

    ctx.fillText(
      'NEXT LEVEL',
      0,
      4
    );

    ctx.font='10px Courier New';

    ctx.fillText(
      '[E / CLICK]',
      0,
      18
    );

    ctx.restore();

    const spots=[
      [this.sell,'SELL'],
      [this.shop,'UPGRADE'],
      [this.protect,'PROTECTION']
    ];

    for(const [s,t] of spots){

      if(
        Math.hypot(
          Player.x-s.x,
          Player.y-s.y
        )<78
      ){

        ctx.fillStyle='#fff';
        ctx.font='bold 12px Courier New';
        ctx.textAlign='center';

        ctx.fillText(
          'CLICK / [E] '+t,
          s.x,
          s.y-52
        );
      }
    }

    if(
      Math.hypot(
        Player.x-this.next.x,
        Player.y-this.next.y
      )<55
    ){

      ctx.fillStyle='#2ed573';
      ctx.font='bold 12px Courier New';
      ctx.textAlign='center';

      ctx.fillText(
        'START LEVEL '+(SaveData.wave+1),
        this.next.x,
        this.next.y-52
      );
    }
  }
};

function drawStand(
  x,
  y,
  c1,
  c2,
  a,
  b
){

  ctx.save();

  ctx.translate(x,y);

  ctx.fillStyle=c2;
  ctx.fillRect(
    -36,
    0,
    72,
    30
  );

  ctx.fillStyle='#2c1e13';

  ctx.fillRect(
    -36,
    26,
    72,
    4
  );

  ctx.fillStyle='#533b24';

  ctx.fillRect(
    -34,
    -28,
    6,
    28
  );

  ctx.fillRect(
    28,
    -28,
    6,
    28
  );

  ctx.fillStyle=c1;

  ctx.fillRect(
    -40,
    -38,
    80,
    14
  );

  ctx.fillStyle='#fff';

  ctx.fillRect(
    -28,
    -38,
    12,
    14
  );

  ctx.fillRect(
    8,
    -38,
    12,
    14
  );

  ctx.font='bold 10px Courier New';
  ctx.textAlign='center';

  ctx.fillText(
    a,
    0,
    14
  );

  ctx.fillText(
    b,
    0,
    24
  );

  ctx.restore();
}

function checkStandsInteraction(
  cx=null,
  cy=null
){

  if(!Stands.active)return false;

  const x=
    cx===null
      ?Player.x
      :cx;

  const y=
    cy===null
      ?Player.y
      :cy;

  const tests=[
    [
      Stands.sell,
      ()=>openSellModal(),
      65
    ],
    [
      Stands.shop,
      ()=>openShopModal(),
      65
    ],
    [
      Stands.protect,
      ()=>openProtectionModal(),
      70
    ],
    [
      Stands.next,
      ()=>{
        SaveData.wave++;
        saveGame();
        initWave(
          SaveData.wave
        );
      },
      55
    ]
  ];

  for(const [s,fn,r] of tests){

    if(
      Math.hypot(
        x-s.x,
        y-s.y
      )<r
    ){

      AudioEngine.interact();

      fn();

      return true;
    }
  }

  return false;
}

const modalContainer=
  document.getElementById(
    'modal-container'
  );

const sellModal=
  document.getElementById(
    'sell-modal'
  );

const shopModal=
  document.getElementById(
    'shop-modal'
  );

const protectionModal=
  document.getElementById(
    'protection-modal'
  );

function closeAllModals(){

  modalContainer.classList.add('hidden');

  sellModal.classList.add('hidden');
  shopModal.classList.add('hidden');
  protectionModal.classList.add('hidden');
}

function openSellModal(){

  if(!Stands.active)return;

  modalContainer.classList.remove('hidden');

  sellModal.classList.remove('hidden');
  shopModal.classList.add('hidden');
  protectionModal.classList.add('hidden');

  updateSell();
}

function updateSell(){

  document.getElementById(
    'sell-parts-count'
  ).textContent=
    `Parts In Bag: ${SaveData.cactusParts}`;

  document.getElementById(
    'sell-rate-text'
  ).textContent=
    `Market Rate: $${10+SaveData.upgrades.partValue*4} Gold / Part`;
}

document.getElementById(
  'btn-sell-one'
).onclick=()=>{

  if(SaveData.cactusParts>0){

    SaveData.cactusParts--;

    SaveData.money+=
      10+SaveData.upgrades.partValue*4;

    saveGame();

    AudioEngine.pickup();

    updateSell();
  }
};

document.getElementById(
  'btn-sell-all'
).onclick=()=>{

  if(SaveData.cactusParts>0){

    SaveData.money+=
      SaveData.cactusParts*
      (10+SaveData.upgrades.partValue*4);

    SaveData.cactusParts=0;

    saveGame();

    AudioEngine.coin();

    updateSell();
  }
};

document.getElementById(
  'btn-close-sell'
).onclick=closeAllModals;

function openShopModal(){

  modalContainer.classList.remove('hidden');

  sellModal.classList.add('hidden');
  protectionModal.classList.add('hidden');

  shopModal.classList.remove('hidden');

  renderUpgrades();
}

function renderUpgrades(){

  document.getElementById(
    'shop-gold-display'
  ).textContent=
    `GOLD: $${SaveData.money}`;

  const list=
    document.getElementById(
      'upgrades-list'
    );

  list.innerHTML='';

  for(const k of Object.keys(UPGRADES_DB)){

    const i=UPGRADES_DB[k];

    const l=
      SaveData.upgrades[k]||0;

    const c=upgradeCost(k);

    const row=
      document.createElement('div');

    row.className='upgrade-row';

    row.innerHTML=
      `<div class="upg-info">
        <div class="upg-title">${i.name} (Lv. ${l}/${i.max})</div>
        <div class="upg-desc">${i.desc}</div>
      </div>`;

    const b=
      document.createElement('button');

    b.className='pixel-btn btn-buy';

    if(l>=i.max){

      b.textContent='MAX';
      b.classList.add('btn-max');

    }else{

      b.textContent=`$${c} BUY`;

      if(SaveData.money<c){

        b.classList.add('btn-max');

      }else{

        b.onclick=()=>{

          SaveData.money-=c;
          SaveData.upgrades[k]=l+1;

          saveGame();

          AudioEngine.coin();

          renderUpgrades();
        };
      }
    }

    row.appendChild(b);
    list.appendChild(row);
  }
}

document.getElementById(
  'btn-close-shop'
).onclick=closeAllModals;

function openProtectionModal(){

  modalContainer.classList.remove('hidden');

  sellModal.classList.add('hidden');
  shopModal.classList.add('hidden');

  protectionModal.classList.remove('hidden');

  renderProtection();
}

function renderProtection(){

  document.getElementById(
    'protection-gold-display'
  ).textContent=
    `GOLD: $${SaveData.money}`;

  const list=
    document.getElementById(
      'protection-list'
    );

  list.innerHTML='';

  for(const k of Object.keys(PROTECTION_DB)){

    const i=PROTECTION_DB[k];

    const row=
      document.createElement('div');

    row.className='upgrade-row';

    row.innerHTML=
      `<div class="upg-info">
        <div class="upg-title">${i.name}</div>
        <div class="upg-desc">${i.desc} HP: ${i.hp}</div>
      </div>`;

    const b=
      document.createElement('button');

    b.className='pixel-btn btn-buy';
    b.textContent=`$${i.cost} BUILD`;

    if(SaveData.money<i.cost){

      b.classList.add('btn-max');

    }else{

      b.onclick=()=>{
        beginBuild(k);
      };
    }

    row.appendChild(b);
    list.appendChild(row);
  }
}

document.getElementById(
  'btn-close-protection'
).onclick=closeAllModals;

function startNewGame(){

  closeAllModals();

  freshRun();

  Player.reset();

  initWave(1);

  gameState=STATES.PLAYING;
}

function update(dt){

  if(shakeTime>0){
    shakeTime-=dt;
  }

  if(gameState===STATES.PLAYING){

    if(!buildMode.active){
      Player.update(dt);
    }

    updateWave(dt);

    activeCacti.forEach(
      c=>c.update(dt)
    );

    zombies.forEach(
      z=>z.update(dt)
    );

    updateDefenses(dt);

    collectParts(dt);

    updateSpikes(dt);
  }

  updateEffects(dt);
}

function collectParts(dt){

  const ml=
    SaveData.upgrades.magnetPickup;

  const mr=70+ml*60;

  for(
    let i=droppedParts.length-1;
    i>=0;
    i--
  ){

    const d=droppedParts[i];

    if(d.progress<1){
      d.progress+=dt*3.5;
    }

    d.x+=(d.targetX-d.x)*.15;
    d.y+=(d.targetY-d.y)*.15;

    if(
      ml &&
      Math.hypot(
        Player.x-d.x,
        Player.y-d.y
      )<mr
    ){

      d.x+=(Player.x-d.x)*.08*ml;
      d.y+=(Player.y-d.y)*.08*ml;
    }

    if(
      Math.hypot(
        Player.x-d.x,
        Player.y-d.y
      )<26
    ){

      SaveData.cactusParts++;

      saveGame();

      AudioEngine.pickup();

      addFloatText(
        d.x,
        d.y-10,
        '+1 PART',
        '#2ed573',
        14
      );

      droppedParts.splice(i,1);
    }
  }
}

function updateSpikes(dt){

  for(
    let i=spikes.length-1;
    i>=0;
    i--
  ){

    const s=spikes[i];

    s.x+=s.vx;
    s.y+=s.vy;

    if(
      Math.hypot(
        Player.x-s.x,
        Player.y-s.y
      )<18
    ){

      Player.takeDamage(1);

      spikes.splice(i,1);

      continue;
    }

    if(
      s.x<-30 ||
      s.x>screenW+30 ||
      s.y<50 ||
      s.y>screenH+30
    ){
      spikes.splice(i,1);
    }
  }
}

function updateEffects(dt){

  for(
    let i=shockwaves.length-1;
    i>=0;
    i--
  ){

    const s=shockwaves[i];

    s.r+=(s.maxR-s.r)*.25;
    s.life-=dt*3.5;

    if(s.life<=0){
      shockwaves.splice(i,1);
    }
  }

  for(
    let i=particles.length-1;
    i>=0;
    i--
  ){

    const p=particles[i];

    p.x+=p.vx;
    p.y+=p.vy;

    p.life-=p.decay;

    if(p.life<=0){
      particles.splice(i,1);
    }
  }

  for(
    let i=floatingTexts.length-1;
    i>=0;
    i--
  ){

    const f=floatingTexts[i];

    f.y+=f.vy;
    f.life-=dt*1.3;

    if(f.life<=0){
      floatingTexts.splice(i,1);
    }
  }
}

function render(){

  ctx.save();

  if(shakeTime>0){

    ctx.translate(
      (Math.random()-.5)*shakeMag*2,
      (Math.random()-.5)*shakeMag*2
    );
  }

  ctx.fillStyle='#100c1e';

  ctx.fillRect(
    0,
    0,
    screenW,
    screenH
  );

  if(gameState===STATES.MENU){

    drawMenu();

  }else if(gameState===STATES.PLAYING){

    drawArena();
    drawGame();
    drawHUD();

  }else{

    drawGameOver();
  }

  ctx.restore();
}

function drawArena(){

  const ts=48;

  for(
    let x=0;
    x<screenW;
    x+=ts
  ){

    for(
      let y=0;
      y<screenH;
      y+=ts
    ){

      ctx.fillStyle=
        (
          x/ts+y/ts
        )%2===0
          ?'#171126'
          :'#1e1631';

      ctx.fillRect(
        x,
        y,
        ts,
        ts
      );
    }
  }

  ctx.strokeStyle='#3d2b56';
  ctx.lineWidth=12;

  ctx.strokeRect(
    6,
    6,
    screenW-12,
    screenH-12
  );
}

function drawGame(){

  Stands.draw(ctx);

  defenses.forEach(
    drawDefense
  );

  shockwaves.forEach(s=>{

    ctx.strokeStyle=s.color;
    ctx.globalAlpha=
      Math.max(0,s.life);

    ctx.lineWidth=3;

    ctx.beginPath();

    ctx.arc(
      s.x,
      s.y,
      s.r,
      0,
      Math.PI*2
    );

    ctx.stroke();

    ctx.globalAlpha=1;
  });

  droppedParts.forEach(d=>{

    const b=
      Math.sin(
        Date.now()*.007+d.bob
      )*3;

    ctx.fillStyle='#2ed573';

    ctx.fillRect(
      d.x-7,
      d.y-7+b,
      14,
      14
    );

    ctx.fillStyle='#ffa502';

    ctx.fillRect(
      d.x-2,
      d.y-2+b,
      4,
      4
    );
  });

  /*
    Restored simple original-looking spike.
  */
  spikes.forEach(s=>{

    ctx.save();

    ctx.translate(
      Math.round(s.x),
      Math.round(s.y)
    );

    ctx.rotate(
      Math.atan2(
        s.vy,
        s.vx
      )
    );

    ctx.fillStyle='#ffd32a';

    ctx.fillRect(
      -7,
      -2,
      12,
      4
    );

    ctx.fillStyle='#fff2a6';

    ctx.fillRect(
      -3,
      -4,
      5,
      2
    );

    ctx.fillStyle='#e1a800';

    ctx.fillRect(
      4,
      -3,
      5,
      6
    );

    ctx.restore();
  });

  activeCacti.forEach(
    c=>c.draw()
  );

  zombies.forEach(
    z=>z.draw()
  );

  if(buildMode.active){

    ctx.save();

    ctx.globalAlpha=.55;

    drawDefense({
      type:buildMode.type,
      x:buildMode.x,
      y:buildMode.y,
      rotation:buildMode.rotation,
      hp:1,
      maxHp:1,
      dead:false
    });

    ctx.restore();

    ctx.fillStyle='#fff';
    ctx.font='bold 12px Courier New';
    ctx.textAlign='center';

    ctx.fillText(
      buildMode.type==='wall'
        ?`WALL ROTATION: ${buildMode.rotation}° | ARROWS TO ROTATE | CLICK/SPACE TO PLACE`
        :'TURRET | CLICK/SPACE TO PLACE',
      screenW/2,
      screenH-22
    );
  }

  Player.draw();

  particles.forEach(p=>{

    ctx.fillStyle=p.color;

    ctx.fillRect(
      p.x,
      p.y,
      p.size,
      p.size
    );
  });

  floatingTexts.forEach(f=>{

    ctx.globalAlpha=
      Math.max(0,f.life);

    ctx.fillStyle=f.color;

    ctx.font=
      `bold ${f.size}px Courier New`;

    ctx.textAlign='center';

    ctx.fillText(
      f.text,
      f.x,
      f.y
    );

    ctx.globalAlpha=1;
  });
}

function drawHUD(){

  ctx.fillStyle='rgba(10,8,20,.92)';

  ctx.fillRect(
    0,
    0,
    screenW,
    50
  );

  ctx.fillStyle='#3d2b56';

  ctx.fillRect(
    0,
    48,
    screenW,
    2
  );

  for(
    let i=0;
    i<Player.maxHealth;
    i++
  ){
    PixelIcons.heart(
      20+i*20,
      18,
      i<Player.health
    );
  }

  PixelIcons.coin(
    125,
    20
  );

  ctx.font='bold 14px Courier New';
  ctx.textAlign='left';

  ctx.fillStyle='#ffd32a';

  ctx.fillText(
    `$${SaveData.money}`,
    140,
    32
  );

  PixelIcons.cactus(
    235,
    20
  );

  ctx.fillStyle='#2ed573';

  ctx.fillText(
    `PARTS: ${SaveData.cactusParts}`,
    250,
    32
  );

  ctx.fillStyle='#a55eea';

  ctx.fillText(
    `LEVEL: ${SaveData.wave}`,
    385,
    32
  );

  ctx.fillStyle='#ff4757';

  ctx.fillText(
    `CACTI ${Math.max(0,cactiSpawned)}/${levelCactiTarget}`,
    490,
    32
  );

  ctx.fillStyle='#6abf69';

  ctx.fillText(
    `ZOMBIES ${zombiesSpawned}/${levelZombieTarget}`,
    610,
    32
  );

  if(levelCleared){

    ctx.fillStyle='#2ed573';

    ctx.fillText(
      'LEVEL CLEARED',
      755,
      32
    );
  }

  const cd=
    Math.max(
      0,
      Player.dashCooldownTimer/
      Player.getDashCooldown()
    );

  const mw=84;

  const mx=Math.min(
    screenW-mw-15,
    screenW-105
  );

  ctx.fillStyle='#1e272e';

  ctx.fillRect(
    mx,
    18,
    mw,
    16
  );

  ctx.fillStyle=
    cd===0
      ?'#00d2d3'
      :'#576574';

  ctx.fillRect(
    mx,
    18,
    mw*(1-cd),
    16
  );

  ctx.strokeStyle='#fff';

  ctx.strokeRect(
    mx,
    18,
    mw,
    16
  );

  ctx.fillStyle='#fff';
  ctx.font='bold 10px Courier New';

  ctx.fillText(
    'DASH [I]',
    mx+12,
    30
  );
}

function drawMenu(){

  ctx.fillStyle='#0f0a1c';

  ctx.fillRect(
    0,
    0,
    screenW,
    screenH
  );

  const t=Date.now()*.001;

  ctx.fillStyle='#fff';

  for(let i=0;i<50;i++){

    ctx.fillRect(
      (i*123)%screenW,
      (i*77+t*14)%screenH,
      2,
      2
    );
  }

  ctx.fillStyle='#2ed573';
  ctx.strokeStyle='#051b11';
  ctx.lineWidth=10;

  ctx.font='900 48px Courier New';
  ctx.textAlign='center';

  ctx.strokeText(
    'PIXEL CACTUS CLASH',
    screenW/2,
    screenH/2-90
  );

  ctx.fillText(
    'PIXEL CACTUS CLASH',
    screenW/2,
    screenH/2-90
  );

  ctx.fillStyle='#ffd32a';
  ctx.font='bold 15px Courier New';

  ctx.fillText(
    'LEVEL-BASED CACTUS SURVIVAL & ZOMBIE DEFENSE',
    screenW/2,
    screenH/2-45
  );

  ctx.font='bold 16px Courier New';

  ctx.fillText(
    `SAVED GOLD: $${SaveData.money}   |   SAVED PARTS: ${SaveData.cactusParts}`,
    screenW/2,
    screenH/2-10
  );

  const bw=240;
  const bh=56;
  const bx=screenW/2-bw/2;
  const by=screenH/2+25;

  ctx.fillStyle='#1e824c';

  ctx.fillRect(
    bx,
    by+4,
    bw,
    bh
  );

  ctx.fillStyle='#2ed573';

  ctx.fillRect(
    bx,
    by,
    bw,
    bh
  );

  ctx.fillStyle='#0a2314';
  ctx.font='900 24px Courier New';

  ctx.fillText(
    'START GAME',
    screenW/2,
    by+37
  );

  ctx.fillStyle='#a4b0be';
  ctx.font='13px Courier New';

  ctx.fillText(
    'WASD: Move | SPACE/CLICK: Smash | I: Dash | Build: Arrows + Click',
    screenW/2,
    screenH/2+130
  );
}

function drawGameOver(){

  ctx.fillStyle='rgba(10,6,18,.94)';

  ctx.fillRect(
    0,
    0,
    screenW,
    screenH
  );

  ctx.fillStyle='#ff4757';
  ctx.font='900 48px Courier New';
  ctx.textAlign='center';

  ctx.fillText(
    'GAME OVER',
    screenW/2,
    screenH/2-90
  );

  ctx.fillStyle='#fff';
  ctx.font='bold 17px Courier New';

  ctx.fillText(
    'YOUR RUN WAS RESET',
    screenW/2,
    screenH/2-25
  );

  ctx.fillText(
    'LEVEL 1 • $0 GOLD • NO UPGRADES • NO DEFENSES',
    screenW/2,
    screenH/2+5
  );

  ctx.fillStyle='#3742fa';

  ctx.fillRect(
    screenW/2-140,
    screenH/2+85,
    280,
    50
  );

  ctx.fillStyle='#fff';
  ctx.font='bold 16px Courier New';

  ctx.fillText(
    'MAIN MENU [CLICK / KEY]',
    screenW/2,
    screenH/2+117
  );
}

let last=performance.now();

function loop(now){

  const dt=
    Math.min(
      (now-last)/1000,
      .1
    );

  last=now;

  if(hitStopTime>0){
    hitStopTime-=dt;
  }else{
    update(dt);
  }

  render();

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);

})();