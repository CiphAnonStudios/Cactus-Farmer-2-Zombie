(() => {
"use strict";
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;
let screenW = window.innerWidth;
let screenH = window.innerHeight;
function resizeCanvas() {
screenW = window.innerWidth;
screenH = window.innerHeight;
canvas.width = screenW;
canvas.height = screenH;
ctx.imageSmoothingEnabled = false;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();
const STATES = {
MENU: "MENU",
PLAYING: "PLAYING",
GAMEOVER: "GAMEOVER"
};
let gameState = STATES.MENU;
const keys = {};
let touchX = 0;
let touchY = 0;
let activeTouchId = null;
let shakeTime = 0;
let shakeMagnitude = 0;
let hitStopTime = 0;
const SAVE_KEY = "PIXEL_CACTUS_CLASH_SAVE_v7";
const SaveData = {
money: 0,
cactusParts: 0,
wave: 1,
upgrades: {
  hammerSpeed: 0,
  hammerStrength: 0,
  harvestYield: 0,
  moveSpeed: 0,
  dashLength: 0,
  dashCooldown: 0,
  partValue: 0,
  shockwaveDash: 0,
  tempShield: 0,
  magnetPickup: 0
}

};
function loadSave() {
try {
const saved = localStorage.getItem(SAVE_KEY);
  if (!saved) return;

  const parsed = JSON.parse(saved);

  SaveData.money = Number(parsed.money) || 0;
  SaveData.cactusParts = Number(parsed.cactusParts) || 0;
  SaveData.wave = Math.max(1, Number(parsed.wave) || 1);

  SaveData.upgrades = Object.assign(
    SaveData.upgrades,
    parsed.upgrades || {}
  );
} catch (error) {
  console.warn("Save loading failed:", error);
}

}
function saveGame() {
try {
localStorage.setItem(
SAVE_KEY,
JSON.stringify(SaveData)
);
} catch (error) {
console.warn("Save failed:", error);
}
}
loadSave();
const AudioEngine = {
ctx: null,
muted: false,
init() {
  if (!this.ctx) {
    const AudioContext =
      window.AudioContext ||
      window.webkitAudioContext;

    if (AudioContext) {
      this.ctx = new AudioContext();
    }
  }
},

tone(
  frequency,
  type,
  duration,
  endFrequency = null,
  volume = 0.16
) {
  if (this.muted) return;

  this.init();

  if (!this.ctx) return;

  if (this.ctx.state === "suspended") {
    this.ctx.resume();
  }

  const oscillator = this.ctx.createOscillator();
  const gain = this.ctx.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(
    frequency,
    this.ctx.currentTime
  );

  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(10, endFrequency),
      this.ctx.currentTime + duration
    );
  }

  gain.gain.setValueAtTime(
    volume,
    this.ctx.currentTime
  );

  gain.gain.linearRampToValueAtTime(
    0.0001,
    this.ctx.currentTime + duration
  );

  oscillator.connect(gain);
  gain.connect(this.ctx.destination);

  oscillator.start();
  oscillator.stop(
    this.ctx.currentTime + duration
  );
},

warning() {
  this.tone(360, "square", 0.08, 180, 0.14);
},

fall() {
  this.tone(540, "sawtooth", 0.55, 80, 0.12);
},

plop(scale = 1) {
  this.tone(
    130 / scale,
    "triangle",
    0.28,
    25,
    0.45
  );

  setTimeout(() => {
    this.tone(65, "square", 0.35, 15, 0.4);
  }, 40);
},

spikeShot() {
  this.tone(700, "square", 0.06, 220, 0.12);
},

hammerSwing() {
  this.tone(200, "sine", 0.12, 50, 0.2);
},

hammerHit() {
  this.tone(140, "square", 0.1, 30, 0.38);
  this.tone(70, "triangle", 0.16, 20, 0.42);
},

deflect() {
  this.tone(850, "square", 0.08, 1200, 0.25);
},

dash() {
  this.tone(420, "triangle", 0.15, 950, 0.2);
},

pickup() {
  this.tone(523, "square", 0.06, null, 0.12);

  setTimeout(() => {
    this.tone(784, "square", 0.1, null, 0.15);
  }, 50);
},

hurt() {
  this.tone(110, "sawtooth", 0.26, 25, 0.4);
},

coin() {
  this.tone(659, "triangle", 0.08, null, 0.18);

  setTimeout(() => {
    this.tone(987, "triangle", 0.14, null, 0.22);
  }, 70);
},

interact() {
  this.tone(440, "triangle", 0.1, null, 0.2);
},

destroy() {
  this.tone(140, "sawtooth", 0.35, 20, 0.4);
  this.tone(75, "square", 0.3, 15, 0.35);
}

};
const UPGRADES_DB = {
hammerSpeed: {
name: "Hammer Speed",
desc: "Faster swing recovery",
max: 5,
base: 25,
multiplier: 1.8
},
hammerStrength: {
  name: "Hammer Power",
  desc: "More hammer damage",
  max: 5,
  base: 30,
  multiplier: 1.9
},

harvestYield: {
  name: "Harvest Yield",
  desc: "More parts from cactuses",
  max: 5,
  base: 35,
  multiplier: 2
},

moveSpeed: {
  name: "Block Agility",
  desc: "Move faster",
  max: 5,
  base: 25,
  multiplier: 1.7
},

dashLength: {
  name: "Dash Distance",
  desc: "Dash farther",
  max: 4,
  base: 40,
  multiplier: 2
},

dashCooldown: {
  name: "Dash Recharge",
  desc: "Dash recharges faster",
  max: 5,
  base: 45,
  multiplier: 1.85
},

partValue: {
  name: "Market Rates",
  desc: "Earn more gold per cactus part",
  max: 5,
  base: 50,
  multiplier: 2.1
},

shockwaveDash: {
  name: "Shockwave Dash",
  desc: "Dash destroys nearby spikes",
  max: 1,
  base: 180,
  multiplier: 1
},

tempShield: {
  name: "Shield Aura",
  desc: "Absorbs one hit per wave",
  max: 1,
  base: 140,
  multiplier: 1
},

magnetPickup: {
  name: "Part Magnet",
  desc: "Attracts nearby parts",
  max: 4,
  base: 60,
  multiplier: 1.9
}

};
const PROTECTION_DB = {
wall: {
name: "Steel Wall",
desc: "Blocks zombies and has a health bar",
cost: 75,
type: "WALL"
},
turret: {
  name: "Auto Turret",
  desc: "Shoots zombies within a radius",
  cost: 150,
  type: "TURRET"
}

};
function getUpgradeCost(key) {
const item = UPGRADES_DB[key];
const level = SaveData.upgrades[key] || 0;
if (level >= item.max) {
  return null;
}

return Math.floor(
  item.base *
  Math.pow(item.multiplier, level)
);

}
const modalContainer =
document.getElementById("modal-container");
const sellModal =
document.getElementById("sell-modal");
const shopModal =
document.getElementById("shop-modal");
const protectionModal =
document.getElementById("protection-modal");
const sellPartsCount =
document.getElementById("sell-parts-count");
const sellRateText =
document.getElementById("sell-rate-text");
const shopGoldDisplay =
document.getElementById("shop-gold-display");
const upgradesList =
document.getElementById("upgrades-list");
const protectionGoldDisplay =
document.getElementById("protection-gold-display");
const protectionList =
document.getElementById("protection-list");
const btnSellOne =
document.getElementById("btn-sell-one");
const btnSellAll =
document.getElementById("btn-sell-all");
const btnCloseSell =
document.getElementById("btn-close-sell");
const btnCloseShop =
document.getElementById("btn-close-shop");
const btnCloseProtection =
document.getElementById("btn-close-protection");
const joystickBase =
document.getElementById("joystick-base");
const joystickStick =
document.getElementById("joystick-stick");
const btnDash =
document.getElementById("btn-dash");
const btnAttack =
document.getElementById("btn-attack");
let particles = [];
let floatingTexts = [];
let shockwaves = [];
let droppedParts = [];
let spikes = [];
let zombies = [];
let defenses = [];
let zombieWaveActive = false;
let zombiesSpawned = 0;
let totalZombiesForWave = 0;
let zombieSpawnTimer = 0;
let selectedDefense = null;
let wallRotation = 0;
function triggerShake(magnitude, duration) {
shakeMagnitude = magnitude;
shakeTime = duration;
}
function triggerHitStop(duration) {
hitStopTime = duration;
}
function addFloatText(
x,
y,
text,
color = "#ffd32a",
size = 16
) {
floatingTexts.push({
x,
y,
text,
color,
size,
life: 1,
velocityY: -1.2
});
}
function addDust(
x,
y,
count = 8,
color = "#e8c288",
maxSize = 5
) {
for (let i = 0; i < count; i++) {
const angle =
Math.random() * Math.PI * 2;
  const speed =
    Math.random() * 3 + 1;

  particles.push({
    x: x + (Math.random() - 0.5) * 16,
    y: y + (Math.random() - 0.5) * 10,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed * 0.6,
    size:
      Math.floor(
        Math.random() * maxSize
      ) + 3,
    color,
    life: 1,
    decay:
      Math.random() * 0.04 + 0.03
  });
}

}
function addCactusChunks(
x,
y,
count = 15
) {
const colors = [
"#2ed573",
"#1e824c",
"#55efc4",
"#ffa502"
];
for (let i = 0; i < count; i++) {
  const angle =
    Math.random() * Math.PI * 2;

  const speed =
    Math.random() * 5 + 2;

  particles.push({
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed - 2,
    size:
      Math.floor(
        Math.random() * 6
      ) + 4,
    color:
      colors[
        Math.floor(
          Math.random() *
          colors.length
        )
      ],
    life: 1,
    decay: 0.032
  });
}

}
function addShockwave(
x,
y,
maxRadius = 55,
color = "#ffd32a"
) {
shockwaves.push({
x,
y,
radius: 10,
maxRadius,
color,
life: 1
});
}
function dropParts(x, y, count) {
for (let i = 0; i < count; i++) {
const angle =
Math.random() * Math.PI * 2;
  const distance =
    Math.random() * 55 + 15;

  droppedParts.push({
    x,
    y,
    targetX: Math.max(
      30,
      Math.min(
        screenW - 30,
        x + Math.cos(angle) * distance
      )
    ),
    targetY: Math.max(
      65,
      Math.min(
        screenH - 30,
        y + Math.sin(angle) * distance
      )
    ),
    progress: 0,
    bob: Math.random() * Math.PI * 2
  });
}

}
function fireSpike(
x,
y,
velocityX,
velocityY,
speed
) {
spikes.push({
x,
y,
vx: velocityX * speed,
vy: velocityY * speed,
trail: []
});
}
function drawHealthBar(
context,
x,
y,
width,
height,
percent,
color
) {
const safePercent =
Math.max(
0,
Math.min(1, percent)
);
context.fillStyle = "#090812";

context.fillRect(
  x - 2,
  y - 2,
  width + 4,
  height + 4
);

context.fillStyle = color;

context.fillRect(
  x,
  y,
  width * safePercent,
  height
);

}
const Player = {
x: 0,
y: 0,
baseSpeed: 4,
facing: "down",
eyeLookX: 0,
eyeLookY: 2,

blinkTimer: 2.5,
isBlinking: false,
squashX: 1,
squashY: 1,

health: 4,
maxHealth: 4,
shield: 0,
invincibleTimer: 0,

dashing: false,
dashTimer: 0,
dashCooldownTimer: 0,
dashVelocityX: 0,
dashVelocityY: 0,
dashTrail: [],

isAttacking: false,
attackTimer: 0,
attackCooldown: 0,

reset() {
  this.x = screenW / 2;
  this.y = screenH / 2;

  this.health = this.maxHealth;

  this.shield =
    SaveData.upgrades.tempShield > 0
      ? 1
      : 0;

  this.invincibleTimer = 0;
  this.dashing = false;
  this.dashTimer = 0;
  this.dashCooldownTimer = 0;
  this.isAttacking = false;
  this.attackTimer = 0;
  this.attackCooldown = 0;
  this.dashTrail = [];
},

getSpeed() {
  return (
    this.baseSpeed +
    SaveData.upgrades.moveSpeed *
    0.45
  );
},

getHammerDelay() {
  return Math.max(
    0.18,
    0.44 -
      SaveData.upgrades.hammerSpeed *
      0.05
  );
},

getHammerDamage() {
  return (
    26 +
    SaveData.upgrades.hammerStrength *
    14
  );
},

getDashDuration() {
  return (
    0.17 +
    SaveData.upgrades.dashLength *
    0.035
  );
},

getDashCooldown() {
  return Math.max(
    0.55,
    1.4 -
      SaveData.upgrades.dashCooldown *
      0.16
  );
},

dash() {
  if (
    this.dashCooldownTimer > 0 ||
    this.dashing
  ) {
    return;
  }

  AudioEngine.dash();

  this.dashing = true;
  this.dashTimer =
    this.getDashDuration();

  this.dashCooldownTimer =
    this.getDashCooldown();

  let directionX = 0;
  let directionY = 0;

  if (
    keys.w ||
    keys.arrowup
  ) {
    directionY -= 1;
  }

  if (
    keys.s ||
    keys.arrowdown
  ) {
    directionY += 1;
  }

  if (
    keys.a ||
    keys.arrowleft
  ) {
    directionX -= 1;
  }

  if (
    keys.d ||
    keys.arrowright
  ) {
    directionX += 1;
  }

  if (
    touchX !== 0 ||
    touchY !== 0
  ) {
    directionX = touchX;
    directionY = touchY;
  }

  if (
    directionX === 0 &&
    directionY === 0
  ) {
    if (this.facing === "up") {
      directionY = -1;
    } else if (
      this.facing === "down"
    ) {
      directionY = 1;
    } else if (
      this.facing === "left"
    ) {
      directionX = -1;
    } else {
      directionX = 1;
    }
  }

  const length =
    Math.hypot(
      directionX,
      directionY
    ) || 1;

  const speed = 12.5;

  this.dashVelocityX =
    directionX / length * speed;

  this.dashVelocityY =
    directionY / length * speed;

  addDust(
    this.x,
    this.y,
    10,
    "#ffffff"
  );

  if (
    SaveData.upgrades.shockwaveDash
  ) {
    spikes = spikes.filter(spike => {
      const distance =
        Math.hypot(
          spike.x - this.x,
          spike.y - this.y
        );

      if (distance < 110) {
        addDust(
          spike.x,
          spike.y,
          6,
          "#ffd32a"
        );

        return false;
      }

      return true;
    });
  }
},

attack() {
  if (
    this.attackCooldown > 0 ||
    this.dashing
  ) {
    return;
  }

  AudioEngine.hammerSwing();

  this.isAttacking = true;
  this.attackTimer = 0.2;
  this.attackCooldown =
    this.getHammerDelay();

  const smashX =
    this.x +
    (this.facing === "left"
      ? -22
      : this.facing === "right"
        ? 22
        : 0);

  const smashY =
    this.y +
    (this.facing === "up"
      ? -22
      : this.facing === "down"
        ? 22
        : 0);

  addShockwave(
    smashX,
    smashY,
    48,
    "#ffffff"
  );

  spikes = spikes.filter(spike => {
    const distance =
      Math.hypot(
        spike.x - smashX,
        spike.y - smashY
      );

    if (distance < 58) {
      addDust(
        spike.x,
        spike.y,
        6,
        "#ffd32a"
      );

      AudioEngine.deflect();
      return false;
    }

    return true;
  });

  activeCacti.forEach(cactus => {
    if (
      cactus.state !== "GROUNDED"
    ) {
      return;
    }

    const distance =
      Math.hypot(
        smashX - cactus.x,
        smashY - cactus.y
      );

    if (
      distance <=
      cactus.width / 2 + 52
    ) {
      cactus.hit(
        this.getHammerDamage()
      );
    }
  });

  for (
    let i = zombies.length - 1;
    i >= 0;
    i--
  ) {
    const zombie = zombies[i];

    const distance =
      Math.hypot(
        smashX - zombie.x,
        smashY - zombie.y
      );

    if (distance <= 62) {
      const defeated =
        zombie.takeDamage(
          this.getHammerDamage()
        );

      if (defeated) {
        zombies.splice(i, 1);
      }
    }
  }

  triggerHitStop(0.04);
},

takeDamage(amount = 1) {
  if (
    this.invincibleTimer > 0 ||
    this.dashing
  ) {
    return;
  }

  if (this.shield > 0) {
    this.shield--;
    this.invincibleTimer = 0.8;

    AudioEngine.tone(
      600,
      "square",
      0.2,
      1200,
      0.2
    );

    addFloatText(
      this.x,
      this.y - 30,
      "SHIELD SAVED!",
      "#00e1ff",
      16
    );

    return;
  }

  this.health -= amount;
  this.invincibleTimer = 1;

  AudioEngine.hurt();

  triggerShake(9, 0.35);

  addDust(
    this.x,
    this.y,
    12,
    "#ff4757"
  );

  addFloatText(
    this.x,
    this.y - 30,
    "-1 HP",
    "#ff2222",
    20
  );

  if (this.health <= 0) {
    gameState = STATES.GAMEOVER;
    saveGame();
  }
},

update(deltaTime) {
  if (
    this.dashCooldownTimer > 0
  ) {
    this.dashCooldownTimer -=
      deltaTime;
  }

  if (
    this.attackCooldown > 0
  ) {
    this.attackCooldown -=
      deltaTime;
  }

  if (this.attackTimer > 0) {
    this.attackTimer -=
      deltaTime;

    if (this.attackTimer <= 0) {
      this.isAttacking = false;
    }
  }

  if (
    this.invincibleTimer > 0
  ) {
    this.invincibleTimer -=
      deltaTime;
  }

  this.blinkTimer -= deltaTime;

  if (this.blinkTimer <= 0) {
    this.isBlinking = true;

    if (this.blinkTimer < -0.15) {
      this.isBlinking = false;
      this.blinkTimer =
        Math.random() * 3 + 2;
    }
  }

  if (this.dashing) {
    this.dashTimer -= deltaTime;

    this.x += this.dashVelocityX;
    this.y += this.dashVelocityY;

    this.squashX = 1.25;
    this.squashY = 0.8;

    if (Math.random() < 0.6) {
      this.dashTrail.push({
        x: this.x,
        y: this.y,
        life: 0.22,
        facing: this.facing
      });
    }

    if (this.dashTimer <= 0) {
      this.dashing = false;
    }
  } else {
    let movementX = 0;
    let movementY = 0;

    if (
      keys.w ||
      keys.arrowup
    ) {
      movementY -= 1;
    }

    if (
      keys.s ||
      keys.arrowdown
    ) {
      movementY += 1;
    }

    if (
      keys.a ||
      keys.arrowleft
    ) {
      movementX -= 1;
    }

    if (
      keys.d ||
      keys.arrowright
    ) {
      movementX += 1;
    }

    if (
      touchX !== 0 ||
      touchY !== 0
    ) {
      movementX = touchX;
      movementY = touchY;
    }

    if (
      movementX !== 0 ||
      movementY !== 0
    ) {
      const length =
        Math.hypot(
          movementX,
          movementY
        ) || 1;

      const speed =
        this.getSpeed();

      this.x +=
        movementX / length *
        speed;

      this.y +=
        movementY / length *
        speed;

      this.eyeLookX =
        movementX / length * 4;

      this.eyeLookY =
        movementY / length * 4;

      if (
        Math.abs(movementX) >
        Math.abs(movementY)
      ) {
        this.facing =
          movementX > 0
            ? "right"
            : "left";
      } else {
        this.facing =
          movementY > 0
            ? "down"
            : "up";
      }

      if (Math.random() < 0.15) {
        addDust(
          this.x,
          this.y + 14,
          1
        );
      }
    } else {
      this.eyeLookX *= 0.8;
      this.eyeLookY = 2;
      this.squashX = 1;
      this.squashY = 1;
    }
  }

  const padding = 24;

  this.x = Math.max(
    padding,
    Math.min(
      screenW - padding,
      this.x
    )
  );

  this.y = Math.max(
    padding + 50,
    Math.min(
      screenH - padding,
      this.y
    )
  );

  for (
    let i = this.dashTrail.length - 1;
    i >= 0;
    i--
  ) {
    this.dashTrail[i].life -=
      deltaTime;

    if (
      this.dashTrail[i].life <= 0
    ) {
      this.dashTrail.splice(i, 1);
    }
  }
},

draw(context) {
  this.dashTrail.forEach(trail => {
    context.save();

    context.globalAlpha =
      Math.max(
        0,
        trail.life / 0.22
      ) * 0.45;

    drawBlockPlayer(
      context,
      trail.x,
      trail.y,
      trail.facing,
      0,
      0,
      false,
      1,
      1,
      "#00d2d3"
    );

    context.restore();
  });

  if (
    this.invincibleTimer > 0 &&
    Math.floor(Date.now() / 60) % 2 === 0
  ) {
    return;
  }

  context.fillStyle =
    "rgba(0, 0, 0, 0.45)";

  context.beginPath();

  context.ellipse(
    this.x,
    this.y + 16,
    16 * this.squashX,
    7,
    0,
    0,
    Math.PI * 2
  );

  context.fill();

  if (this.shield > 0) {
    context.strokeStyle = "#00f0ff";
    context.lineWidth = 3;

    context.beginPath();

    context.arc(
      this.x,
      this.y,
      24 +
        Math.sin(
          Date.now() * 0.008
        ) * 2,
      0,
      Math.PI * 2
    );

    context.stroke();
  }

  drawBlockPlayer(
    context,
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
context,
x,
y,
facing,
eyeX,
eyeY,
blinking,
scaleX,
scaleY,
tintColor = null,
attacking = false,
attackTimer = 0
) {
context.save();
context.translate(
  Math.round(x),
  Math.round(y)
);

context.scale(
  scaleX,
  scaleY
);

const size = 30;

const bodyColor =
  tintColor || "#ffa801";

const shadeColor =
  tintColor || "#d35400";

const highlightColor =
  tintColor || "#ffd32a";

context.fillStyle = bodyColor;

context.fillRect(
  -size / 2,
  -size / 2,
  size,
  size
);

context.fillStyle = highlightColor;

context.fillRect(
  -size / 2,
  -size / 2,
  size,
  4
);

context.fillStyle = shadeColor;

context.fillRect(
  -size / 2,
  size / 2 - 4,
  size,
  4
);

context.fillRect(
  size / 2 - 4,
  -size / 2,
  4,
  size
);

if (!blinking) {
  context.fillStyle = "#ffffff";

  context.fillRect(
    -10 + eyeX,
    -3 + eyeY,
    6,
    8
  );

  context.fillRect(
    5 + eyeX,
    -3 + eyeY,
    6,
    8
  );

  context.fillStyle = "#0f0f1c";

  context.fillRect(
    -9 + eyeX,
    -1 + eyeY,
    3,
    4
  );

  context.fillRect(
    6 + eyeX,
    -1 + eyeY,
    3,
    4
  );
} else {
  context.fillStyle = "#0f0f1c";
  context.fillRect(-9, 1, 7, 2);
  context.fillRect(3, 1, 7, 2);
}

const side =
  facing === "left"
    ? -1
    : 1;

const wood = "#8b5a2b";
const iron = "#718093";
const ironLight = "#dcdde1";

if (attacking) {
  const progress =
    (0.2 - attackTimer) / 0.2;

  const angle =
    Math.sin(progress * Math.PI) *
    2.2;

  context.save();

  context.translate(
    side * 14,
    -4
  );

  context.rotate(
    side * angle
  );

  context.fillStyle = wood;

  context.fillRect(
    -2,
    -26,
    4,
    30
  );

  context.fillStyle = iron;

  context.fillRect(
    -12,
    -34,
    24,
    12
  );

  context.fillStyle = ironLight;

  context.fillRect(
    -12,
    -34,
    24,
    3
  );

  context.restore();
} else {
  context.fillStyle = wood;

  context.fillRect(
    side * 12,
    -10,
    3,
    22
  );

  context.fillStyle = iron;

  context.fillRect(
    side * 12 - 5,
    -16,
    14,
    8
  );
}

context.restore();

}
const CACTUS_TYPES = {
SMALL: {
scale: 0.7,
spikes: 6,
speed: 4.8,
drops: 2,
healthMultiplier: 0.6
},
MEDIUM: {
  scale: 1,
  spikes: 10,
  speed: 3.8,
  drops: 4,
  healthMultiplier: 1
},

GIANT: {
  scale: 1.5,
  spikes: 16,
  speed: 3.2,
  drops: 8,
  healthMultiplier: 2.2
}

};
class CactusInstance {
constructor(x, y, typeKey) {
this.x = x;
this.y = y;
this.type =
CACTUS_TYPES[typeKey] ||
CACTUS_TYPES.MEDIUM;
  this.scale = this.type.scale;
  this.width = 46 * this.scale;

  const baseHealth =
    42 + SaveData.wave * 14;

  this.maxHealth = Math.round(
    baseHealth *
    this.type.healthMultiplier
  );

  this.health = this.maxHealth;

  this.state = "WARNING";
  this.warningTimer = 1.9;
  this.heightFromGround = 400;
  this.fallSpeed = 0;
  this.impactTimer = 0;
  this.shakeTimer = 0;
  this.soundPlayed = false;
}

hit(damage) {
  if (this.state !== "GROUNDED") {
    return;
  }

  this.health -= damage;
  this.shakeTimer = 0.16;

  AudioEngine.hammerHit();

  addCactusChunks(
    this.x,
    this.y,
    8
  );

  addFloatText(
    this.x,
    this.y - 30,
    `-${damage}`,
    "#fffa40",
    17
  );

  triggerShake(4, 0.14);

  if (this.health <= 0) {
    this.destroy();
  }
}

destroy() {
  this.state = "DESTROYED";

  AudioEngine.destroy();

  triggerShake(
    8 * this.scale,
    0.35
  );

  addCactusChunks(
    this.x,
    this.y,
    25
  );

  addDust(
    this.x,
    this.y,
    16,
    "#2ed573"
  );

  const extra =
    SaveData.upgrades.harvestYield *
    2;

  const totalDrops =
    this.type.drops + extra;

  dropParts(
    this.x,
    this.y,
    totalDrops
  );

  addFloatText(
    this.x,
    this.y - 40,
    `+${totalDrops} PARTS!`,
    "#2ed573",
    18
  );
}

fireSpikes() {
  AudioEngine.spikeShot();

  const count =
    this.type.spikes +
    Math.min(
      8,
      Math.floor(
        SaveData.wave * 0.5
      )
    );

  const step =
    Math.PI * 2 / count;

  const offset =
    Math.random() * Math.PI;

  for (let i = 0; i < count; i++) {
    const angle =
      offset + i * step;

    fireSpike(
      this.x,
      this.y + 6,
      Math.cos(angle),
      Math.sin(angle),
      this.type.speed
    );
  }
}

update(deltaTime) {
  if (this.shakeTimer > 0) {
    this.shakeTimer -= deltaTime;
  }

  if (this.state === "WARNING") {
    this.warningTimer -= deltaTime;

    if (
      !this.soundPlayed &&
      this.warningTimer < 0.9
    ) {
      this.soundPlayed = true;
      AudioEngine.warning();
    }

    if (this.warningTimer <= 0) {
      this.state = "FALLING";
      this.fallSpeed = 6;
      AudioEngine.fall();
    }
  } else if (
    this.state === "FALLING"
  ) {
    this.fallSpeed +=
      30 * deltaTime;

    this.heightFromGround -=
      this.fallSpeed;

    if (
      this.heightFromGround <= 0
    ) {
      this.heightFromGround = 0;
      this.state = "IMPACT";
      this.impactTimer = 0.7;

      AudioEngine.plop(
        this.scale
      );

      triggerShake(
        10 * this.scale,
        0.4
      );

      addDust(
        this.x,
        this.y,
        20,
        "#d8aa6d",
        6
      );

      this.fireSpikes();
    }
  } else if (
    this.state === "IMPACT"
  ) {
    this.impactTimer -= deltaTime;

    if (this.impactTimer <= 0) {
      this.state = "GROUNDED";
    }
  }
}

draw(context) {
  if (this.state === "DESTROYED") {
    return;
  }

  const shadowScale =
    Math.max(
      0.2,
      1 -
        (this.heightFromGround /
          400) *
          0.7
    );

  context.fillStyle =
    "rgba(0, 0, 0, 0.5)";

  context.beginPath();

  context.ellipse(
    this.x,
    this.y + 16 * this.scale,
    26 *
      this.scale *
      shadowScale,
    12 *
      this.scale *
      shadowScale,
    0,
    0,
    Math.PI * 2
  );

  context.fill();

  if (this.state === "WARNING") {
    const pulse =
      Math.sin(
        Date.now() * 0.016
      );

    context.strokeStyle =
      Math.floor(
        Date.now() / 100
      ) % 2 === 0
        ? "#ff4757"
        : "#ffd32a";

    context.lineWidth = 3;

    context.beginPath();

    context.arc(
      this.x,
      this.y,
      36 * this.scale +
        pulse * 4,
      0,
      Math.PI * 2
    );

    context.stroke();

    context.fillStyle = "#ff4757";
    context.font =
      "bold 13px Courier New";
    context.textAlign = "center";

    context.fillText(
      "DROP ZONE",
      this.x,
      this.y -
        44 * this.scale
    );
  }

  let drawX = this.x;
  let drawY =
    this.y -
    this.heightFromGround;

  if (this.shakeTimer > 0) {
    drawX +=
      (Math.random() - 0.5) * 6;

    drawY +=
      (Math.random() - 0.5) * 6;
  }

  context.save();

  context.translate(
    Math.round(drawX),
    Math.round(drawY)
  );

  context.scale(
    this.scale,
    this.scale
  );

  drawCactusGraphic(context);

  context.restore();

  if (
    this.state === "GROUNDED"
  ) {
    drawHealthBar(
      context,
      this.x -
        27 * this.scale,
      this.y -
        60 * this.scale,
      54 * this.scale,
      7,
      this.health /
        this.maxHealth,
      this.health /
        this.maxHealth >
        0.35
        ? "#2ed573"
        : "#ff4757"
    );
  }
}

}
function drawCactusGraphic(context) {
context.fillStyle = "#2ed573";
context.fillRect(
  -14,
  -36,
  28,
  52
);

context.fillStyle = "#1e824c";

context.fillRect(
  -14,
  -36,
  6,
  52
);

context.fillStyle = "#7bed9f";

context.fillRect(
  4,
  -34,
  4,
  50
);

context.fillStyle = "#2ed573";

context.fillRect(
  -28,
  -20,
  16,
  10
);

context.fillRect(
  -28,
  -32,
  10,
  16
);

context.fillRect(
  12,
  -14,
  16,
  10
);

context.fillRect(
  18,
  -28,
  10,
  18
);

context.fillStyle = "#ffffff";

context.fillRect(
  -16,
  -26,
  3,
  2
);

context.fillRect(
  -16,
  -10,
  3,
  2
);

context.fillRect(
  14,
  -28,
  3,
  2
);

context.fillRect(
  14,
  -8,
  3,
  2
);

context.fillStyle = "#ff4757";

context.fillRect(
  -6,
  -42,
  12,
  6
);

}
let activeCacti = [];
let totalCactiForWave = 0;
let cactiSpawned = 0;
let cactusSpawnTimer = 0;
let cactusWaveFinished = false;
function initWave(waveNumber) {
activeCacti = [];
droppedParts = [];
spikes = [];
zombies = [];
defenses = [];
zombieWaveActive = false;
zombiesSpawned = 0;
totalZombiesForWave = 0;
zombieSpawnTimer = 0;

cactiSpawned = 0;
cactusWaveFinished = false;

totalCactiForWave =
  Math.min(
    50,
    Math.max(
      25,
      25 +
        (waveNumber - 1) * 5 +
        Math.floor(Math.random() * 6)
    )
  );

cactusSpawnTimer = 0.5;
Stands.active = false;

}
function updateCactusWave(deltaTime) {
if (
cactiSpawned <
totalCactiForWave
) {
cactusSpawnTimer -= deltaTime;
  if (cactusSpawnTimer <= 0) {
    cactiSpawned++;

    cactusSpawnTimer =
      Math.max(
        0.7,
        2 -
          SaveData.wave * 0.05
      );

    const padding = 90;

    const spawnX =
      padding +
      Math.random() *
        (screenW - padding * 2);

    const spawnY =
      padding +
      60 +
      Math.random() *
        (screenH -
          padding * 2 -
          60);

    const roll = Math.random();

    let type = "MEDIUM";

    if (roll < 0.4) {
      type = "SMALL";
    } else if (roll > 0.82) {
      type = "GIANT";
    }

    activeCacti.push(
      new CactusInstance(
        spawnX,
        spawnY,
        type
      )
    );
  }
}

const remainingCacti =
  activeCacti.filter(
    cactus =>
      cactus.state !==
      "DESTROYED"
  ).length;

if (
  cactiSpawned >=
    totalCactiForWave &&
  remainingCacti === 0 &&
  !cactusWaveFinished
) {
  cactusWaveFinished = true;

  startZombieWave();

  addFloatText(
    screenW / 2,
    screenH / 2 - 80,
    "ZOMBIE WAVE!",
    "#ff4757",
    26
  );
}

}
function startZombieWave() {
zombies = [];
defenses = [];
zombiesSpawned = 0;

totalZombiesForWave =
  5 + SaveData.wave * 3;

zombieSpawnTimer = 0.2;
zombieWaveActive = true;

}
class Zombie {
constructor(x, y) {
this.x = x;
this.y = y;
  this.maxHealth =
    45 + SaveData.wave * 12;

  this.health = this.maxHealth;

  this.speed =
    0.45 + SaveData.wave * 0.025;

  this.attackCooldown = 0;
}

takeDamage(damage) {
  this.health -= damage;

  addFloatText(
    this.x,
    this.y - 24,
    `-${damage}`,
    "#ff4757",
    14
  );

  addDust(
    this.x,
    this.y,
    3,
    "#ff4757"
  );

  if (this.health <= 0) {
    SaveData.money += 15;
    saveGame();

    addFloatText(
      this.x,
      this.y - 42,
      "+$15",
      "#ffd32a",
      15
    );

    addDust(
      this.x,
      this.y,
      16,
      "#ff4757"
    );

    AudioEngine.destroy();

    return true;
  }

  return false;
}

update(deltaTime) {
  if (this.attackCooldown > 0) {
    this.attackCooldown -=
      deltaTime;
  }

  let target = Player;

  let closestDistance =
    Math.hypot(
      Player.x - this.x,
      Player.y - this.y
    );

  defenses.forEach(defense => {
    if (defense.health <= 0) {
      return;
    }

    const distance =
      Math.hypot(
        defense.x - this.x,
        defense.y - this.y
      );

    if (
      distance <
      closestDistance + 90
    ) {
      target = defense;
      closestDistance = distance;
    }
  });

  if (closestDistance > 30) {
    const directionX =
      target.x - this.x;

    const directionY =
      target.y - this.y;

    const distance =
      Math.hypot(
        directionX,
        directionY
      ) || 1;

    this.x +=
      directionX /
      distance *
      this.speed;

    this.y +=
      directionY /
      distance *
      this.speed;
  } else if (
    this.attackCooldown <= 0
  ) {
    if (target === Player) {
      Player.takeDamage(1);
    } else {
      target.health -=
        12 + SaveData.wave * 2;

      addFloatText(
        target.x,
        target.y - 30,
        "-DAMAGE",
        "#ff4757",
        13
      );
    }

    this.attackCooldown = 0.8;
  }
}

draw(context) {
  context.save();

  context.translate(
    this.x,
    this.y
  );

  context.fillStyle = "#263238";

  context.fillRect(
    -14,
    -18,
    28,
    32
  );

  context.fillStyle = "#607d8b";

  context.fillRect(
    -18,
    -28,
    36,
    22
  );

  context.fillStyle = "#ff4757";

  context.fillRect(
    -10,
    -22,
    6,
    6
  );

  context.fillRect(
    5,
    -22,
    6,
    6
  );

  context.fillStyle = "#111111";

  context.fillRect(
    -12,
    0,
    8,
    18
  );

  context.fillRect(
    4,
    0,
    8,
    18
  );

  context.restore();

  drawHealthBar(
    context,
    this.x - 22,
    this.y - 40,
    44,
    6,
    this.health /
      this.maxHealth,
    "#ff4757"
  );
}

}
class Defense {
constructor(x, y, type) {
this.x = x;
this.y = y;
this.type = type;
this.rotation = wallRotation;
  if (type === "WALL") {
    this.maxHealth = 180;
    this.health = 180;
    this.width = 64;
    this.height = 20;
  } else {
    this.maxHealth = 120;
    this.health = 120;
    this.width = 28;
    this.height = 28;
    this.shootCooldown = 0;
  }
}

update(deltaTime) {
  if (this.health <= 0) {
    return;
  }

  if (this.type !== "TURRET") {
    return;
  }

  if (this.shootCooldown > 0) {
    this.shootCooldown -=
      deltaTime;

    return;
  }

  let target = null;
  let targetDistance = 190;

  zombies.forEach(zombie => {
    const distance =
      Math.hypot(
        zombie.x - this.x,
        zombie.y - this.y
      );

    if (
      distance < targetDistance
    ) {
      target = zombie;
      targetDistance = distance;
    }
  });

  if (!target) {
    return;
  }

  const defeated =
    target.takeDamage(
      20 + SaveData.wave * 2
    );

  if (defeated) {
    const index =
      zombies.indexOf(target);

    if (index !== -1) {
      zombies.splice(index, 1);
    }
  }

  addShockwave(
    target.x,
    target.y,
    14,
    "#00d2d3"
  );

  AudioEngine.spikeShot();

  this.shootCooldown = 0.6;
}

draw(context) {
  context.save();

  context.translate(
    this.x,
    this.y
  );

  if (this.type === "WALL") {
    context.rotate(
      this.rotation
    );

    context.fillStyle = "#8d6e63";

    context.fillRect(
      -32,
      -10,
      64,
      20
    );

    context.fillStyle = "#d7ccc8";

    context.fillRect(
      -32,
      -10,
      64,
      4
    );

    context.fillStyle = "#4e342e";

    context.fillRect(
      -32,
      6,
      64,
      4
    );
  } else {
    context.fillStyle = "#3742fa";

    context.beginPath();

    context.arc(
      0,
      0,
      17,
      0,
      Math.PI * 2
    );

    context.fill();

    context.fillStyle = "#00d2d3";

    context.fillRect(
      -5,
      -25,
      10,
      22
    );

    context.fillRect(
      -25,
      -5,
      22,
      10
    );

    context.fillRect(
      3,
      -5,
      22,
      10
    );
  }

  context.restore();

  drawHealthBar(
    context,
    this.x - 30,
    this.y - 42,
    60,
    7,
    this.health /
      this.maxHealth,
    "#2ed573"
  );
}

}
function updateZombieWave(deltaTime) {
if (!zombieWaveActive) {
return;
}
if (
  zombiesSpawned <
  totalZombiesForWave
) {
  zombieSpawnTimer -= deltaTime;

  if (zombieSpawnTimer <= 0) {
    const side =
      Math.floor(
        Math.random() * 4
      );

    let spawnX;
    let spawnY;

    if (side === 0) {
      spawnX = 35;
      spawnY =
        70 +
        Math.random() *
          (screenH - 140);
    } else if (side === 1) {
      spawnX = screenW - 35;
      spawnY =
        70 +
        Math.random() *
          (screenH - 140);
    } else if (side === 2) {
      spawnX =
        35 +
        Math.random() *
          (screenW - 70);

      spawnY = 70;
    } else {
      spawnX =
        35 +
        Math.random() *
          (screenW - 70);

      spawnY = screenH - 35;
    }

    zombies.push(
      new Zombie(
        spawnX,
        spawnY
      )
    );

    zombiesSpawned++;

    zombieSpawnTimer =
      Math.max(
        0.35,
        1.2 -
          SaveData.wave * 0.03
      );
  }
}

zombies.forEach(zombie => {
  zombie.update(deltaTime);
});

defenses.forEach(defense => {
  defense.update(deltaTime);
});

defenses = defenses.filter(
  defense => defense.health > 0
);

zombies = zombies.filter(
  zombie => zombie.health > 0
);

if (
  zombiesSpawned >=
    totalZombiesForWave &&
  zombies.length === 0
) {
  zombieWaveActive = false;
  Stands.spawn();

  addFloatText(
    screenW / 2,
    screenH / 2 - 80,
    "ZOMBIES DEFEATED!",
    "#2ed573",
    24
  );
}

}
const Stands = {
active: false,
sellStand: {
  x: 0,
  y: 0
},

upgradeStand: {
  x: 0,
  y: 0
},

protectionStand: {
  x: 0,
  y: 0
},

nextPortal: {
  x: 0,
  y: 0,
  radius: 42
},

spawn() {
  this.active = true;

  const centerY =
    Math.max(
      180,
      Math.min(
        screenH - 230,
        screenH / 2
      )
    );

  this.sellStand.x =
    screenW / 2 - 190;

  this.sellStand.y = centerY;

  this.protectionStand.x =
    screenW / 2;

  this.protectionStand.y =
    centerY;

  this.upgradeStand.x =
    screenW / 2 + 190;

  this.upgradeStand.y =
    centerY;

  this.nextPortal.x =
    screenW / 2;

  this.nextPortal.y =
    centerY + 120;

  addDust(
    this.sellStand.x,
    this.sellStand.y,
    16,
    "#ffa502"
  );

  addDust(
    this.protectionStand.x,
    this.protectionStand.y,
    16,
    "#00d2d3"
  );

  addDust(
    this.upgradeStand.x,
    this.upgradeStand.y,
    16,
    "#3742fa"
  );
},

draw(context) {
  if (!this.active) {
    return;
  }

  drawPixelStand(
    context,
    this.sellStand.x,
    this.sellStand.y,
    "#ffa502",
    "#e67e22",
    "SELL",
    "STAND"
  );

  drawPixelStand(
    context,
    this.protectionStand.x,
    this.protectionStand.y,
    "#00d2d3",
    "#3742fa",
    "PROTECT",
    "SHOP"
  );

  drawPixelStand(
    context,
    this.upgradeStand.x,
    this.upgradeStand.y,
    "#3742fa",
    "#2f3542",
    "SHOP",
    "UPGRADES"
  );

  context.save();

  context.translate(
    this.nextPortal.x,
    this.nextPortal.y
  );

  const pulse =
    Math.sin(
      Date.now() * 0.008
    ) * 4;

  context.fillStyle =
    "rgba(46, 213, 115, 0.2)";

  context.beginPath();

  context.arc(
    0,
    0,
    this.nextPortal.radius +
      pulse,
    0,
    Math.PI * 2
  );

  context.fill();

  context.strokeStyle = "#2ed573";
  context.lineWidth = 4;

  context.beginPath();

  context.arc(
    0,
    0,
    this.nextPortal.radius +
      pulse,
    0,
    Math.PI * 2
  );

  context.stroke();

  context.fillStyle = "#ffffff";
  context.font =
    "bold 13px Courier New";
  context.textAlign = "center";

  context.fillText(
    "NEXT WAVE",
    0,
    4
  );

  context.font =
    "10px Courier New";

  context.fillText(
    "[ENTER / E]",
    0,
    18
  );

  context.restore();

  const sellDistance =
    Math.hypot(
      Player.x -
        this.sellStand.x,
      Player.y -
        this.sellStand.y
    );

  const protectionDistance =
    Math.hypot(
      Player.x -
        this.protectionStand.x,
      Player.y -
        this.protectionStand.y
    );

  const upgradeDistance =
    Math.hypot(
      Player.x -
        this.upgradeStand.x,
      Player.y -
        this.upgradeStand.y
    );

  const portalDistance =
    Math.hypot(
      Player.x -
        this.nextPortal.x,
      Player.y -
        this.nextPortal.y
    );

  context.fillStyle = "#ffffff";
  context.font =
    "bold 12px Courier New";
  context.textAlign = "center";

  if (sellDistance < 75) {
    context.fillText(
      "CLICK / [E] TO SELL",
      this.sellStand.x,
      this.sellStand.y - 48
    );
  }

  if (protectionDistance < 75) {
    context.fillText(
      "CLICK / [E] TO PROTECT",
      this.protectionStand.x,
      this.protectionStand.y - 48
    );
  }

  if (upgradeDistance < 75) {
    context.fillText(
      "CLICK / [E] TO UPGRADE",
      this.upgradeStand.x,
      this.upgradeStand.y - 48
    );
  }

  if (portalDistance < 55) {
    context.fillText(
      "START NEXT WAVE!",
      this.nextPortal.x,
      this.nextPortal.y - 50
    );
  }
}

};
function drawPixelStand(
context,
x,
y,
canopyColor,
woodColor,
firstLine,
secondLine
) {
context.save();
context.translate(x, y);

context.fillStyle = woodColor;

context.fillRect(
  -36,
  0,
  72,
  30
);

context.fillStyle = "#2c1e13";

context.fillRect(
  -36,
  26,
  72,
  4
);

context.fillStyle = "#533b24";

context.fillRect(
  -34,
  -28,
  6,
  28
);

context.fillRect(
  28,
  -28,
  6,
  28
);

context.fillStyle = canopyColor;

context.fillRect(
  -40,
  -38,
  80,
  14
);

context.fillStyle = "#ffffff";

context.fillRect(
  -28,
  -38,
  12,
  14
);

context.fillRect(
  8,
  -38,
  12,
  14
);

context.font =
  "bold 10px Courier New";

context.textAlign = "center";

context.fillText(
  firstLine,
  0,
  14
);

context.fillText(
  secondLine,
  0,
  24
);

context.restore();

}
function checkStandsInteraction(
clickX = null,
clickY = null
) {
if (!Stands.active) {
return false;
}
const distanceToSell =
  clickX === null
    ? Math.hypot(
        Player.x -
          Stands.sellStand.x,
        Player.y -
          Stands.sellStand.y
      )
    : Math.hypot(
        clickX -
          Stands.sellStand.x,
        clickY -
          Stands.sellStand.y
      );

if (distanceToSell < 65) {
  openSellModal();
  return true;
}

const distanceToProtection =
  clickX === null
    ? Math.hypot(
        Player.x -
          Stands.protectionStand.x,
        Player.y -
          Stands.protectionStand.y
      )
    : Math.hypot(
        clickX -
          Stands.protectionStand.x,
        clickY -
          Stands.protectionStand.y
      );

if (distanceToProtection < 65) {
  openProtectionModal();
  return true;
}

const distanceToUpgrade =
  clickX === null
    ? Math.hypot(
        Player.x -
          Stands.upgradeStand.x,
        Player.y -
          Stands.upgradeStand.y
      )
    : Math.hypot(
        clickX -
          Stands.upgradeStand.x,
        clickY -
          Stands.upgradeStand.y
      );

if (distanceToUpgrade < 65) {
  openShopModal();
  return true;
}

const distanceToPortal =
  clickX === null
    ? Math.hypot(
        Player.x -
          Stands.nextPortal.x,
        Player.y -
          Stands.nextPortal.y
      )
    : Math.hypot(
        clickX -
          Stands.nextPortal.x,
        clickY -
          Stands.nextPortal.y
      );

if (
  distanceToPortal < 50 &&
  !zombieWaveActive
) {
  SaveData.wave++;
  saveGame();
  initWave(SaveData.wave);
  return true;
}

return false;

}
function openSellModal() {
modalContainer.classList.remove("hidden");
sellModal.classList.remove("hidden");
shopModal.classList.add("hidden");
protectionModal.classList.add("hidden");

updateSellModal();

}
function updateSellModal() {
const rate =
10 +
SaveData.upgrades.partValue *
4;
sellPartsCount.textContent =
  `Parts In Bag: ${SaveData.cactusParts}`;

sellRateText.textContent =
  `Market Rate: $${rate} Gold / Part`;

}
function openShopModal() {
modalContainer.classList.remove("hidden");
sellModal.classList.add("hidden");
shopModal.classList.remove("hidden");
protectionModal.classList.add("hidden");

renderUpgradesList();

}
function renderUpgradesList() {
shopGoldDisplay.textContent =
GOLD: $${SaveData.money};
upgradesList.innerHTML = "";

Object.keys(UPGRADES_DB).forEach(key => {
  const item = UPGRADES_DB[key];

  const level =
    SaveData.upgrades[key] || 0;

  const cost =
    getUpgradeCost(key);

  const row =
    document.createElement("div");

  row.className = "upgrade-row";

  const info =
    document.createElement("div");

  info.className = "upg-info";

  info.innerHTML = `
    <div class="upg-title">
      ${item.name} (Lv. ${level}/${item.max})
    </div>
    <div class="upg-desc">
      ${item.desc}
    </div>
  `;

  const button =
    document.createElement("button");

  button.className =
    "pixel-btn btn-buy";

  if (level >= item.max) {
    button.textContent = "MAX";
    button.classList.add("btn-max");
  } else {
    button.textContent =
      `$${cost} BUY`;

    if (SaveData.money < cost) {
      button.classList.add("btn-max");
    } else {
      button.addEventListener(
        "click",
        () => {
          if (
            SaveData.money < cost
          ) {
            return;
          }

          SaveData.money -= cost;

          SaveData.upgrades[key] =
            level + 1;

          saveGame();
          AudioEngine.coin();
          renderUpgradesList();
        }
      );
    }
  }

  row.appendChild(info);
  row.appendChild(button);
  upgradesList.appendChild(row);
});

}
function openProtectionModal() {
modalContainer.classList.remove("hidden");
sellModal.classList.add("hidden");
shopModal.classList.add("hidden");
protectionModal.classList.remove("hidden");

renderProtectionList();

}
function renderProtectionList() {
protectionGoldDisplay.textContent =
GOLD: $${SaveData.money};
protectionList.innerHTML = "";

Object.keys(PROTECTION_DB).forEach(key => {
  const item = PROTECTION_DB[key];

  const row =
    document.createElement("div");

  row.className =
    "protection-row";

  const info =
    document.createElement("div");

  info.className = "upg-info";

  info.innerHTML = `
    <div class="upg-title">
      ${item.name}
    </div>
    <div class="upg-desc">
      ${item.desc}
    </div>
  `;

  const button =
    document.createElement("button");

  button.className =
    "pixel-btn btn-buy";

  button.textContent =
    `$${item.cost} BUY`;

  if (SaveData.money < item.cost) {
    button.classList.add("btn-max");
  } else {
    button.addEventListener(
      "click",
      () => {
        if (
          SaveData.money < item.cost
        ) {
          return;
        }

        SaveData.money -= item.cost;
        selectedDefense = item.type;
        wallRotation = 0;

        saveGame();
        AudioEngine.coin();
        closeAllModals();

        addFloatText(
          Player.x,
          Player.y - 35,
          `PLACE ${item.name.toUpperCase()}`,
          "#00d2d3",
          14
        );
      }
    );
  }

  row.appendChild(info);
  row.appendChild(button);
  protectionList.appendChild(row);
});

}
function closeAllModals() {
modalContainer.classList.add("hidden");
sellModal.classList.add("hidden");
shopModal.classList.add("hidden");
protectionModal.classList.add("hidden");

}
function placeDefense(x, y) {
if (!selectedDefense) {
return;
}
const distanceFromPlayer =
  Math.hypot(
    Player.x - x,
    Player.y - y
  );

if (distanceFromPlayer < 35) {
  addFloatText(
    x,
    y - 30,
    "TOO CLOSE!",
    "#ff4757",
    14
  );

  return;
}

defenses.push(
  new Defense(
    x,
    y,
    selectedDefense
  )
);

selectedDefense = null;
wallRotation = 0;

AudioEngine.interact();

}
function startNewGame() {
closeAllModals();
Player.reset();
initWave(SaveData.wave);
gameState = STATES.PLAYING;
}
function update(deltaTime) {
if (shakeTime > 0) {
shakeTime -= deltaTime;
}
if (
  gameState === STATES.PLAYING
) {
  Player.update(deltaTime);

  updateCactusWave(deltaTime);
  updateZombieWave(deltaTime);

  activeCacti.forEach(cactus => {
    cactus.update(deltaTime);
  });

  const magnetLevel =
    SaveData.upgrades.magnetPickup;

  const magnetRadius =
    70 + magnetLevel * 60;

  for (
    let i = droppedParts.length - 1;
    i >= 0;
    i--
  ) {
    const drop =
      droppedParts[i];

    if (drop.progress < 1) {
      drop.progress +=
        deltaTime * 3.5;

      drop.x +=
        (drop.targetX - drop.x) *
        0.15;

      drop.y +=
        (drop.targetY - drop.y) *
        0.15;
    }

    if (magnetLevel > 0) {
      const distance =
        Math.hypot(
          Player.x - drop.x,
          Player.y - drop.y
        );

      if (
        distance < magnetRadius
      ) {
        drop.x +=
          (Player.x - drop.x) *
          0.08 *
          magnetLevel;

        drop.y +=
          (Player.y - drop.y) *
          0.08 *
          magnetLevel;
      }
    }

    const playerDistance =
      Math.hypot(
        Player.x - drop.x,
        Player.y - drop.y
      );

    if (playerDistance < 26) {
      SaveData.cactusParts++;
      saveGame();

      AudioEngine.pickup();

      addFloatText(
        drop.x,
        drop.y - 10,
        "+1 PART",
        "#2ed573",
        14
      );

      droppedParts.splice(i, 1);
    }
  }

  for (
    let i = spikes.length - 1;
    i >= 0;
    i--
  ) {
    const spike = spikes[i];

    spike.x += spike.vx;
    spike.y += spike.vy;

    if (Math.random() < 0.35) {
      spike.trail.push({
        x: spike.x,
        y: spike.y,
        life: 0.16
      });
    }

    for (
      let j = spike.trail.length - 1;
      j >= 0;
      j--
    ) {
      spike.trail[j].life -=
        deltaTime;

      if (
        spike.trail[j].life <= 0
      ) {
        spike.trail.splice(j, 1);
      }
    }

    const playerDistance =
      Math.hypot(
        Player.x - spike.x,
        Player.y - spike.y
      );

    if (playerDistance < 18) {
      Player.takeDamage(1);
      spikes.splice(i, 1);
      continue;
    }

    if (
      spike.x < -30 ||
      spike.x > screenW + 30 ||
      spike.y < -30 ||
      spike.y > screenH + 30
    ) {
      spikes.splice(i, 1);
    }
  }
}

for (
  let i = shockwaves.length - 1;
  i >= 0;
  i--
) {
  const shockwave =
    shockwaves[i];

  shockwave.radius +=
    (shockwave.maxRadius -
      shockwave.radius) *
    0.25;

  shockwave.life -=
    deltaTime * 3.5;

  if (
    shockwave.life <= 0
  ) {
    shockwaves.splice(i, 1);
  }
}

for (
  let i = particles.length - 1;
  i >= 0;
  i--
) {
  const particle =
    particles[i];

  particle.x += particle.vx;
  particle.y += particle.vy;
  particle.life -= particle.decay;

  if (
    particle.life <= 0
  ) {
    particles.splice(i, 1);
  }
}

for (
  let i = floatingTexts.length - 1;
  i >= 0;
  i--
) {
  const text =
    floatingTexts[i];

  text.y += text.velocityY;
  text.life -=
    deltaTime * 1.3;

  if (
    text.life <= 0
  ) {
    floatingTexts.splice(i, 1);
  }
}

}
function drawArena() {
const tileSize = 48;
for (
  let x = 0;
  x < screenW;
  x += tileSize
) {
  for (
    let y = 0;
    y < screenH;
    y += tileSize
  ) {
    const evenTile =
      (
        Math.floor(x / tileSize) +
        Math.floor(y / tileSize)
      ) % 2 === 0;

    ctx.fillStyle = evenTile
      ? "#171126"
      : "#1e1631";

    ctx.fillRect(
      x,
      y,
      tileSize,
      tileSize
    );
  }
}

ctx.strokeStyle = "#3d2b56";
ctx.lineWidth = 12;

ctx.strokeRect(
  6,
  6,
  screenW - 12,
  screenH - 12
);

}
function drawGame() {
Stands.draw(ctx);
defenses.forEach(defense => {
  defense.draw(ctx);
});

zombies.forEach(zombie => {
  zombie.draw(ctx);
});

activeCacti.forEach(cactus => {
  cactus.draw(ctx);
});

droppedParts.forEach(drop => {
  const bob =
    Math.sin(
      Date.now() * 0.007 +
      drop.bob
    ) * 3;

  ctx.fillStyle = "#2ed573";

  ctx.fillRect(
    drop.x - 7,
    drop.y - 7 + bob,
    14,
    14
  );

  ctx.fillStyle = "#ffa502";

  ctx.fillRect(
    drop.x - 2,
    drop.y - 2 + bob,
    4,
    4
  );
});

spikes.forEach(spike => {
  spike.trail.forEach(trail => {
    ctx.fillStyle =
      "rgba(255, 165, 2, 0.45)";

    ctx.fillRect(
      trail.x - 3,
      trail.y - 3,
      6,
      6
    );
  });

  ctx.save();

  ctx.translate(
    spike.x,
    spike.y
  );

  ctx.rotate(
    Math.atan2(
      spike.vy,
      spike.vx
    )
  );

  ctx.fillStyle = "#ffd32a";

  ctx.beginPath();

  ctx.moveTo(9, 0);
  ctx.lineTo(-7, -4);
  ctx.lineTo(-3, 0);
  ctx.lineTo(-7, 4);
  ctx.closePath();

  ctx.fill();
  ctx.restore();
});

if (selectedDefense) {
  ctx.save();

  ctx.globalAlpha = 0.55;

  if (selectedDefense === "WALL") {
    ctx.translate(
      Player.x,
      Player.y
    );

    ctx.rotate(wallRotation);

    ctx.fillStyle = "#8d6e63";

    ctx.fillRect(
      -32,
      -10,
      64,
      20
    );
  } else {
    ctx.fillStyle = "#3742fa";

    ctx.beginPath();

    ctx.arc(
      Player.x,
      Player.y,
      17,
      0,
      Math.PI * 2
    );

    ctx.fill();
  }

  ctx.restore();

  ctx.fillStyle = "#ffffff";
  ctx.font =
    "bold 12px Courier New";
  ctx.textAlign = "center";

  ctx.fillText(
    "CLICK TO PLACE",
    Player.x,
    Player.y - 35
  );
}

Player.draw(ctx);

shockwaves.forEach(shockwave => {
  ctx.save();

  ctx.globalAlpha =
    Math.max(0, shockwave.life);

  ctx.strokeStyle =
    shockwave.color;

  ctx.lineWidth = 3;

  ctx.beginPath();

  ctx.arc(
    shockwave.x,
    shockwave.y,
    shockwave.radius,
    0,
    Math.PI * 2
  );

  ctx.stroke();
  ctx.restore();
});

particles.forEach(particle => {
  ctx.fillStyle = particle.color;

  ctx.fillRect(
    particle.x,
    particle.y,
    particle.size,
    particle.size
  );
});

floatingTexts.forEach(text => {
  ctx.globalAlpha =
    Math.max(0, text.life);

  ctx.fillStyle = text.color;

  ctx.font =
    `bold ${text.size}px Courier New`;

  ctx.textAlign = "center";

  ctx.fillText(
    text.text,
    text.x,
    text.y
  );

  ctx.globalAlpha = 1;
});

}
function drawHud() {
ctx.fillStyle =
"rgba(10, 8, 20, 0.9)";
ctx.fillRect(
  0,
  0,
  screenW,
  50
);

ctx.strokeStyle = "#3d2b56";
ctx.lineWidth = 2;

ctx.strokeRect(
  0,
  48,
  screenW,
  2
);

ctx.textAlign = "left";
ctx.font =
  "bold 14px Courier New";

ctx.fillStyle = "#ff4757";

ctx.fillText(
  `HP: ${Player.health}/${Player.maxHealth}`,
  18,
  31
);

ctx.fillStyle = "#ffd32a";

ctx.fillText(
  `GOLD: $${SaveData.money}`,
  125,
  31
);

ctx.fillStyle = "#2ed573";

ctx.fillText(
  `PARTS: ${SaveData.cactusParts}`,
  260,
  31
);

ctx.fillStyle = "#a55eea";

ctx.fillText(
  `WAVE: ${SaveData.wave}`,
  410,
  31
);

if (zombieWaveActive) {
  ctx.fillStyle = "#ff4757";

  ctx.fillText(
    `ZOMBIES: ${zombies.length}/${totalZombiesForWave}`,
    510,
    31
  );
} else if (Stands.active) {
  ctx.fillStyle = "#2ed573";

  ctx.fillText(
    "SHOPS OPEN",
    510,
    31
  );
} else {
  ctx.fillStyle = "#ff4757";

  ctx.fillText(
    `CACTUSES: ${cactiSpawned}/${totalCactiForWave}`,
    510,
    31
  );
}

const cooldownPercent =
  Math.max(
    0,
    Player.dashCooldownTimer /
      Player.getDashCooldown()
  );

const barWidth = 84;
const barHeight = 16;
const barX =
  screenW - barWidth - 20;
const barY = 18;

ctx.fillStyle = "#1e272e";

ctx.fillRect(
  barX,
  barY,
  barWidth,
  barHeight
);

ctx.fillStyle =
  cooldownPercent === 0
    ? "#00d2d3"
    : "#576574";

ctx.fillRect(
  barX,
  barY,
  barWidth *
    (1 - cooldownPercent),
  barHeight
);

ctx.strokeStyle = "#ffffff";

ctx.strokeRect(
  barX,
  barY,
  barWidth,
  barHeight
);

ctx.fillStyle = "#ffffff";
ctx.font =
  "bold 10px Courier New";

ctx.fillText(
  "DASH [I]",
  barX + 14,
  barY + 12
);

}
function drawMenu() {
ctx.fillStyle = "#0f0a1c";
ctx.fillRect(
  0,
  0,
  screenW,
  screenH
);

const time =
  Date.now() * 0.001;

ctx.fillStyle = "#ffffff";

for (let i = 0; i < 50; i++) {
  const x =
    (i * 123) % screenW;

  const y =
    (i * 77 + time * 14) %
    screenH;

  ctx.fillRect(
    x,
    y,
    2,
    2
  );
}

ctx.textAlign = "center";

ctx.fillStyle = "#2ed573";
ctx.strokeStyle = "#051b11";
ctx.lineWidth = 10;
ctx.font =
  "900 48px Courier New";

ctx.strokeText(
  "PIXEL CACTUS CLASH",
  screenW / 2,
  screenH / 2 - 90
);

ctx.fillText(
  "PIXEL CACTUS CLASH",
  screenW / 2,
  screenH / 2 - 90
);

ctx.fillStyle = "#ffd32a";
ctx.font =
  "bold 15px Courier New";

ctx.fillText(
  "RETRO PIXEL SURVIVAL & HAMMER SMASH",
  screenW / 2,
  screenH / 2 - 45
);

ctx.font =
  "bold 16px Courier New";

ctx.fillText(
  `SAVED GOLD: $${SaveData.money} | SAVED PARTS: ${SaveData.cactusParts}`,
  screenW / 2,
  screenH / 2 - 10
);

const buttonWidth = 240;
const buttonHeight = 56;

const buttonX =
  screenW / 2 -
  buttonWidth / 2;

const buttonY =
  screenH / 2 + 25;

ctx.fillStyle = "#1e824c";

ctx.fillRect(
  buttonX,
  buttonY + 4,
  buttonWidth,
  buttonHeight
);

ctx.fillStyle = "#2ed573";

ctx.fillRect(
  buttonX,
  buttonY,
  buttonWidth,
  buttonHeight
);

ctx.fillStyle =
  "rgba(255, 255, 255, 0.3)";

ctx.fillRect(
  buttonX,
  buttonY,
  buttonWidth,
  4
);

ctx.fillStyle = "#0a2314";
ctx.font =
  "900 24px Courier New";

ctx.fillText(
  "START GAME",
  screenW / 2,
  buttonY + 37
);

ctx.fillStyle = "#a4b0be";
ctx.font =
  "13px Courier New";

ctx.fillText(
  "WASD: Move | SPACE: Smash | I: Dash | E: Use Stands",
  screenW / 2,
  screenH / 2 + 130
);

}
function drawGameOver() {
ctx.fillStyle =
"rgba(10, 6, 18, 0.94)";
ctx.fillRect(
  0,
  0,
  screenW,
  screenH
);

ctx.textAlign = "center";

ctx.fillStyle = "#ff4757";
ctx.font =
  "900 48px Courier New";

ctx.fillText(
  "GAME OVER",
  screenW / 2,
  screenH / 2 - 90
);

ctx.fillStyle = "#ffffff";
ctx.font =
  "bold 17px Courier New";

ctx.fillText(
  `WAVE REACHED: ${SaveData.wave}`,
  screenW / 2,
  screenH / 2 - 25
);

ctx.fillText(
  `PARTS IN BAG: ${SaveData.cactusParts}`,
  screenW / 2,
  screenH / 2 + 5
);

ctx.fillText(
  `TOTAL GOLD: $${SaveData.money}`,
  screenW / 2,
  screenH / 2 + 35
);

const buttonWidth = 280;
const buttonHeight = 50;

const buttonX =
  screenW / 2 -
  buttonWidth / 2;

const buttonY =
  screenH / 2 + 85;

ctx.fillStyle = "#1e2499";

ctx.fillRect(
  buttonX,
  buttonY + 4,
  buttonWidth,
  buttonHeight
);

ctx.fillStyle = "#3742fa";

ctx.fillRect(
  buttonX,
  buttonY,
  buttonWidth,
  buttonHeight
);

ctx.fillStyle = "#ffffff";
ctx.font =
  "bold 16px Courier New";

ctx.fillText(
  "MAIN MENU [CLICK / KEY]",
  screenW / 2,
  buttonY + 32
);

}
function updateInput() {
if (gameState !== STATES.PLAYING) {
return;
}
}
function render() {
ctx.save();
if (shakeTime > 0) {
  ctx.translate(
    (Math.random() - 0.5) *
      shakeMagnitude *
      2,
    (Math.random() - 0.5) *
      shakeMagnitude *
      2
  );
}

ctx.fillStyle = "#100c1e";

ctx.fillRect(
  0,
  0,
  screenW,
  screenH
);

if (gameState === STATES.MENU) {
  drawMenu();
} else if (
  gameState === STATES.PLAYING
) {
  drawArena();
  drawGame();
  drawHud();
} else {
  drawGameOver();
}

ctx.restore();

}
window.addEventListener(
"keydown",
event => {
AudioEngine.init();
  const key =
    event.key.toLowerCase();

  keys[key] = true;
  keys[event.code] = true;

  if (
    gameState === STATES.GAMEOVER
  ) {
    gameState = STATES.MENU;
    return;
  }

  if (
    event.code === "Space"
  ) {
    event.preventDefault();

    if (
      gameState === STATES.PLAYING
    ) {
      Player.attack();
    }
  }

  if (
    key === "i" &&
    gameState === STATES.PLAYING
  ) {
    Player.dash();
  }

  if (
    selectedDefense === "WALL" &&
    key === "arrowleft"
  ) {
    wallRotation -=
      Math.PI / 2;
  }

  if (
    selectedDefense === "WALL" &&
    key === "arrowright"
  ) {
    wallRotation +=
      Math.PI / 2;
  }

  if (key === "escape") {
    closeAllModals();
  }

  if (
    key === "e" &&
    gameState === STATES.PLAYING
  ) {
    checkStandsInteraction();
  }

  if (
    key === "enter" &&
    gameState === STATES.PLAYING
  ) {
    checkStandsInteraction();
  }
}

);
window.addEventListener(
"keyup",
event => {
keys[event.key.toLowerCase()] =
false;
  keys[event.code] = false;
}

);
canvas.addEventListener(
"mousedown",
event => {
AudioEngine.init();
  if (gameState === STATES.MENU) {
    const buttonWidth = 240;
    const buttonHeight = 56;

    const buttonX =
      screenW / 2 -
      buttonWidth / 2;

    const buttonY =
      screenH / 2 + 25;

    if (
      event.clientX >= buttonX &&
      event.clientX <=
        buttonX + buttonWidth &&
      event.clientY >= buttonY &&
      event.clientY <=
        buttonY + buttonHeight
    ) {
      startNewGame();
    }

    return;
  }

  if (
    gameState === STATES.PLAYING
  ) {
    if (selectedDefense) {
      placeDefense(
        event.clientX,
        event.clientY
      );

      return;
    }

    if (
      !checkStandsInteraction(
        event.clientX,
        event.clientY
      )
    ) {
      Player.attack();
    }

    return;
  }

  gameState = STATES.MENU;
}

);
function handleJoystickMove(touch) {
const rect =
joystickBase.getBoundingClientRect();
const centerX =
  rect.left + rect.width / 2;

const centerY =
  rect.top + rect.height / 2;

const deltaX =
  touch.clientX - centerX;

const deltaY =
  touch.clientY - centerY;

const distance =
  Math.hypot(
    deltaX,
    deltaY
  );

const maxRadius =
  rect.width / 2;

const angle =
  Math.atan2(
    deltaY,
    deltaX
  );

const limitedDistance =
  Math.min(
    distance,
    maxRadius
  );

touchX =
  Math.cos(angle) *
  (limitedDistance /
    maxRadius);

touchY =
  Math.sin(angle) *
  (limitedDistance /
    maxRadius);

const stickX =
  Math.cos(angle) *
  limitedDistance;

const stickY =
  Math.sin(angle) *
  limitedDistance;

joystickStick.style.transform =
  `translate(calc(-50% + ${stickX}px), calc(-50% + ${stickY}px))`;

}
function resetJoystick(event) {
for (
const touch of event.changedTouches
) {
if (
touch.identifier ===
activeTouchId
) {
activeTouchId = null;
touchX = 0;
touchY = 0;
    joystickStick.style.transform =
      "translate(-50%, -50%)";
  }
}

}
joystickBase.addEventListener(
"touchstart",
event => {
event.preventDefault();
  AudioEngine.init();

  const touch =
    event.changedTouches[0];

  activeTouchId =
    touch.identifier;

  handleJoystickMove(touch);
},
{ passive: false }

);
window.addEventListener(
"touchmove",
event => {
if (
activeTouchId === null
) {
return;
}
  for (
    const touch of event.changedTouches
  ) {
    if (
      touch.identifier ===
      activeTouchId
    ) {
      handleJoystickMove(touch);
    }
  }
},
{ passive: false }

);
window.addEventListener(
"touchend",
resetJoystick
);
window.addEventListener(
"touchcancel",
resetJoystick
);
btnDash.addEventListener(
"click",
() => {
if (
gameState === STATES.PLAYING
) {
Player.dash();
}
}
);
btnAttack.addEventListener(
"click",
() => {
if (
gameState !== STATES.PLAYING
) {
return;
}
  if (selectedDefense) {
    placeDefense(
      Player.x,
      Player.y
    );
  } else {
    Player.attack();
  }
}

);
btnSellOne.addEventListener(
"click",
() => {
if (
SaveData.cactusParts <= 0
) {
return;
}
  const rate =
    10 +
    SaveData.upgrades.partValue *
    4;

  SaveData.cactusParts--;
  SaveData.money += rate;

  saveGame();
  AudioEngine.pickup();
  updateSellModal();
}

);
btnSellAll.addEventListener(
"click",
() => {
if (
SaveData.cactusParts <= 0
) {
return;
}
  const rate =
    10 +
    SaveData.upgrades.partValue *
    4;

  SaveData.money +=
    SaveData.cactusParts * rate;

  SaveData.cactusParts = 0;

  saveGame();
  AudioEngine.coin();
  updateSellModal();
}

);
btnCloseSell.addEventListener(
"click",
closeAllModals
);
btnCloseShop.addEventListener(
"click",
closeAllModals
);
btnCloseProtection.addEventListener(
"click",
closeAllModals
);
function closeAllModals() {
modalContainer.classList.add("hidden");
sellModal.classList.add("hidden");
shopModal.classList.add("hidden");
protectionModal.classList.add("hidden");

}
function update(deltaTime) {
if (shakeTime > 0) {
shakeTime -= deltaTime;
}
if (
  gameState === STATES.PLAYING
) {
  Player.update(deltaTime);

  updateCactusWave(deltaTime);
  updateZombieWave(deltaTime);

  activeCacti.forEach(cactus => {
    cactus.update(deltaTime);
  });

  const magnetLevel =
    SaveData.upgrades.magnetPickup;

  const magnetRadius =
    70 + magnetLevel * 60;

  for (
    let i = droppedParts.length - 1;
    i >= 0;
    i--
  ) {
    const drop =
      droppedParts[i];

    if (drop.progress < 1) {
      drop.progress +=
        deltaTime * 3.5;

      drop.x +=
        (drop.targetX - drop.x) *
        0.15;

      drop.y +=
        (drop.targetY - drop.y) *
        0.15;
    }

    if (magnetLevel > 0) {
      const distance =
        Math.hypot(
          Player.x - drop.x,
          Player.y - drop.y
        );

      if (
        distance < magnetRadius
      ) {
        drop.x +=
          (Player.x - drop.x) *
          0.08 *
          magnetLevel;

        drop.y +=
          (Player.y - drop.y) *
          0.08 *
          magnetLevel;
      }
    }

    const playerDistance =
      Math.hypot(
        Player.x - drop.x,
        Player.y - drop.y
      );

    if (
      playerDistance < 26
    ) {
      SaveData.cactusParts++;
      saveGame();

      AudioEngine.pickup();

      addFloatText(
        drop.x,
        drop.y - 10,
        "+1 PART",
        "#2ed573",
        14
      );

      droppedParts.splice(i, 1);
    }
  }

  for (
    let i = spikes.length - 1;
    i >= 0;
    i--
  ) {
    const spike =
      spikes[i];

    spike.x += spike.vx;
    spike.y += spike.vy;

    if (Math.random() < 0.35) {
      spike.trail.push({
        x: spike.x,
        y: spike.y,
        life: 0.16
      });
    }

    for (
      let j = spike.trail.length - 1;
      j >= 0;
      j--
    ) {
      spike.trail[j].life -=
        deltaTime;

      if (
        spike.trail[j].life <= 0
      ) {
        spike.trail.splice(j, 1);
      }
    }

    const playerDistance =
      Math.hypot(
        Player.x - spike.x,
        Player.y - spike.y
      );

    if (
      playerDistance < 18
    ) {
      Player.takeDamage(1);
      spikes.splice(i, 1);
      continue;
    }

    if (
      spike.x < -30 ||
      spike.x > screenW + 30 ||
      spike.y < -30 ||
      spike.y > screenH + 30
    ) {
      spikes.splice(i, 1);
    }
  }
}

for (
  let i = shockwaves.length - 1;
  i >= 0;
  i--
) {
  const shockwave =
    shockwaves[i];

  shockwave.radius +=
    (shockwave.maxRadius -
      shockwave.radius) *
    0.25;

  shockwave.life -=
    deltaTime * 3.5;

  if (
    shockwave.life <= 0
  ) {
    shockwaves.splice(i, 1);
  }
}

for (
  let i = particles.length - 1;
  i >= 0;
  i--
) {
  const particle =
    particles[i];

  particle.x += particle.vx;
  particle.y += particle.vy;
  particle.life -= particle.decay;

  if (
    particle.life <= 0
  ) {
    particles.splice(i, 1);
  }
}

for (
  let i = floatingTexts.length - 1;
  i >= 0;
  i--
) {
  const text =
    floatingTexts[i];

  text.y += text.velocityY;

  text.life -=
    deltaTime * 1.3;

  if (
    text.life <= 0
  ) {
    floatingTexts.splice(i, 1);
  }
}

}
let lastTime = performance.now();
function loop(now) {
const deltaTime =
Math.min(
(now - lastTime) / 1000,
0.1
);
lastTime = now;

if (hitStopTime > 0) {
  hitStopTime -= deltaTime;
} else {
  update(deltaTime);
}

render();

requestAnimationFrame(loop);

}
requestAnimationFrame(loop);
})();
