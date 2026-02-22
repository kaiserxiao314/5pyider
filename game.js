const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreElement = document.getElementById('score');

// Constants
const MAP_SIZE = 100; // 100x100 grid
const ZOOM = 8; // Each grid unit is 8px
const CANVAS_SIZE = MAP_SIZE * ZOOM;

canvas.width = CANVAS_SIZE;
canvas.height = CANVAS_SIZE;

// Game State Variables
let score = 0;
let flies = [];
let webs = []; // Active web shoot animations
let splats = []; // Static web splats at click locations
let attacks = []; // Active sky attacks (rocks)
let portal = null; // Shimmering portal to other dimensions
let dimension = 1; // 1 = Main (Hunting), 2 = Challenge (Survival), 3 = 3D Finale
let dodgedInDimension = 0; // Tracks progress in Dimension 2
let dimensionTimer = 0; // Used for timing dimension-specific events

// Spider State
// Radioactive Spider State & Properties
const spider = {
    x: MAP_SIZE / 2,
    y: MAP_SIZE / 2,
    targetX: MAP_SIZE / 2,
    targetY: MAP_SIZE / 2,
    angle: 0,
    color: '#ff0033', // Radioactive Red (Body)
    secondaryColor: '#0066ff', // Electric Blue (Legs/Accents)
    aoeUnlocked: false, // True once 5 flies are caught
    webAmmo: 10,
    maxAmmo: 10, // Max for UI bar width display
    health: 100,
    maxHealth: 100,
    isDead: false,
    deathTimer: 0, // Frame counter for 3D tumbling animation
    invulnerable: 0 // Remaining frames of post-hit protection
};

const INITIAL_FLY_COUNT = 8;
const MAX_FLY_COUNT = 20;

class Fly {
    constructor() {
        this.spawn();
    }

    spawn() {
        this.x = Math.floor(Math.random() * MAP_SIZE);
        this.y = Math.floor(Math.random() * MAP_SIZE);
        this.id = Math.random().toString(36).substr(2, 9);
        this.alive = true;
        this.health = 1;
        this.isBug = false;
        this.pulse = Math.random() * Math.PI * 2;
    }

    update() {
        this.pulse += 0.1;
    }

    draw() {
        const px = this.x * ZOOM + ZOOM / 2;
        const py = this.y * ZOOM + ZOOM / 2;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.sin(this.pulse * 0.5) * 0.2);

        // Glow effect
        const glow = Math.sin(this.pulse) * 5 + 5;
        ctx.shadowBlur = glow;
        ctx.shadowColor = '#00f2ff';

        // Wings
        const wingSpread = Math.sin(this.pulse * 5) * 5 + 8;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.ellipse(-3, 0, wingSpread, 4, -Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(3, 0, wingSpread, 4, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();

        // Body
        ctx.fillStyle = '#0a0a0a';
        ctx.strokeStyle = '#00f2ff';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.ellipse(0, 2, 3, 5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -3, 2.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.fillStyle = '#ff0055';
        ctx.beginPath();
        ctx.arc(-1, -4, 0.8, 0, Math.PI * 2);
        ctx.arc(1, -4, 0.8, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

class GoldenBug {
    constructor() {
        this.spawn();
    }

    spawn() {
        this.x = Math.floor(Math.random() * MAP_SIZE);
        this.y = Math.floor(Math.random() * MAP_SIZE);
        this.id = Math.random().toString(36).substr(2, 9);
        this.alive = true;
        this.health = 1;
        this.isBug = true;
        this.pulse = Math.random() * Math.PI * 2;
    }

    update() {
        this.pulse += 0.15; // Faster pulse
    }

    draw() {
        const px = this.x * ZOOM + ZOOM / 2;
        const py = this.y * ZOOM + ZOOM / 2;

        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(Math.sin(this.pulse * 0.8) * 0.3);

        // Golden Glow
        const glow = Math.sin(this.pulse) * 10 + 10;
        ctx.shadowBlur = glow;
        ctx.shadowColor = '#ffe600';

        // Smaller Wings
        const wingSpread = Math.sin(this.pulse * 8) * 3 + 4;
        ctx.strokeStyle = '#fff700';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.ellipse(-2, 0, wingSpread, 2, -Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();

        ctx.beginPath();
        ctx.ellipse(2, 0, wingSpread, 2, Math.PI / 4, 0, Math.PI * 2);
        ctx.stroke();

        // Shiny Golden Body (Smaller)
        ctx.fillStyle = '#ffcc00';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.ellipse(0, 1, 2, 3.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(0, -2, 1.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        // Sparkling eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-0.8, -2.5, 0.5, 0, Math.PI * 2);
        ctx.arc(0.8, -2.5, 0.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
        ctx.shadowBlur = 0;
    }
}

class WebLine {
    constructor(startX, startY, targetX, targetY, flyId) {
        this.startX = startX;
        this.startY = startY;
        this.targetX = targetX;
        this.targetY = targetY;
        this.flyId = flyId;
        this.progress = 0;
        this.speed = 0.1;
        this.done = false;
        this.opacity = 1;
        this.fadeOut = false;
    }

    update() {
        if (!this.fadeOut) {
            this.progress += this.speed;
            if (this.progress >= 1) {
                this.progress = 1;
                this.fadeOut = true;

                if (this.flyId) {
                    const flyIndex = flies.findIndex(f => f.id === this.flyId);
                    if (flyIndex > -1) {
                        const target = flies[flyIndex];
                        target.health--;

                        if (target.health <= 0) {
                            flies.splice(flyIndex, 1);
                            score += target.isBug ? 10 : 1;
                            scoreElement.innerText = score;

                            spider.webAmmo += target.isBug ? 10 : 2;
                            if (target.isBug) {
                                spider.health = Math.min(spider.maxHealth, spider.health + 10);
                            }

                            if (!spider.aoeUnlocked && score >= 5) {
                                spider.aoeUnlocked = true;
                                const overlay = document.getElementById('ui-overlay');
                                if (overlay) overlay.innerHTML = '<p>AOE Unlocked! Right-click to move & BEWARE OF ROCKS!</p>';
                            }

                            // Infinite Respawn: Check for 2% Bug chance
                            const currentTarget = spider.aoeUnlocked ? MAX_FLY_COUNT : INITIAL_FLY_COUNT;
                            while (flies.length < currentTarget) {
                                if (Math.random() < 0.02) {
                                    flies.push(new GoldenBug());
                                } else {
                                    flies.push(new Fly());
                                }
                            }
                        }
                    }
                }
            }
        } else {
            this.opacity -= 0.05;
            if (this.opacity <= 0) {
                this.done = true;
            }
        }
    }

    draw() {
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity})`;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);

        const currentX = this.startX + (this.targetX - this.startX) * this.progress;
        const currentY = this.startY + (this.targetY - this.startY) * this.progress;

        ctx.beginPath();
        ctx.moveTo(this.startX, this.startY);
        ctx.lineTo(currentX, currentY);
        ctx.stroke();
        ctx.setLineDash([]);
    }
}

class WebSplat {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.opacity = 1;
        this.done = false;
        this.size = 30 + Math.random() * 20;
        this.rays = 8 + Math.floor(Math.random() * 6);
    }

    update() {
        this.opacity -= 0.01;
        if (this.opacity <= 0) {
            this.done = true;
        }
    }

    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.strokeStyle = `rgba(255, 255, 255, ${this.opacity * 0.5})`;
        ctx.lineWidth = 1;

        for (let i = 0; i < this.rays; i++) {
            const angle = (i / this.rays) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(Math.cos(angle) * this.size, Math.sin(angle) * this.size);
            ctx.stroke();
        }

        for (let j = 1; j <= 3; j++) {
            const r = (j / 3) * this.size;
            ctx.beginPath();
            for (let i = 0; i <= this.rays; i++) {
                const angle = (i / this.rays) * Math.PI * 2;
                if (i === 0) ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
                else ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
            }
            ctx.stroke();
        }
        ctx.restore();
    }
}

/**
 * Portal Class: Manages inter-dimensional gateways
 * Target Dimension 2: Challenging Void
 * Target Dimension 3: Real Life (Finale)
 */
class Portal {
    constructor(x, y, targetDimension) {
        this.x = x;
        this.y = y;
        this.targetDimension = targetDimension;
        this.pulse = 0;
        this.radius = 40;
    }

    update() {
        this.pulse += 0.05;
    }

    draw() {
        const px = this.x * ZOOM + ZOOM / 2;
        const py = this.y * ZOOM + ZOOM / 2;
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(this.pulse);

        // Swirling Portal Logic
        for (let i = 0; i < 3; i++) {
            ctx.rotate(Math.PI / 1.5);
            ctx.strokeStyle = this.targetDimension === 2 ? '#ff00ff' : '#00ffff';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius, this.radius * 0.4, 0, 0, Math.PI * 2);
            ctx.stroke();
        }

        ctx.fillStyle = this.targetDimension === 2 ? 'rgba(255, 0, 255, 0.2)' : 'rgba(0, 255, 255, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * (0.8 + Math.sin(this.pulse * 2) * 0.2), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    isInside(tx, ty) {
        const dx = this.x - tx;
        const dy = this.y - ty;
        return Math.sqrt(dx * dx + dy * dy) < 5;
    }
}

function init() {
    for (let i = 0; i < INITIAL_FLY_COUNT; i++) {
        if (Math.random() < 0.02) {
            flies.push(new GoldenBug());
        } else {
            flies.push(new Fly());
        }
    }
}

function showComicScreen() {
    const comic = document.createElement('div');
    comic.id = 'comic-overlay';
    comic.innerHTML = `
        <div class="comic-container">
            <h2 class="comic-title">THE END OF 5PYIDER</h2>
            <div class="comic-grid">
                <div class="comic-panel panel-1">
                    <img src="" alt="" class="panel-icon">
                    <div class="panel-text">THWIP!</div>
                </div>
                <div class="comic-panel panel-2">
                    <div class="panel-text">BZZZT...</div>
                </div>
                <div class="comic-panel panel-3">
                    <div class="panel-text">WHOOSH!</div>
                </div>
                <div class="comic-panel panel-4">
                    <div class="panel-text">CRUNCH!</div>
                </div>
            </div>
            <button onclick="location.reload()" class="retry-btn">RETRY MISSION</button>
        </div>
    `;
    document.body.appendChild(comic);
}

class RockAttack {
    constructor(targetX, targetY) {
        this.tx = targetX;
        this.ty = targetY;
        this.px = targetX * ZOOM + ZOOM / 2;
        this.py = targetY * ZOOM + ZOOM / 2;
        this.warningTime = 30; // 0.5 seconds at 60fps
        this.stayTime = 60; // 1 second after hitting
        this.timer = 0;
        this.stayTimer = 0;
        this.done = false;
        this.rockY = -400; // Starting altitude
        this.hit = false;

        // Random jaggedness for the rock
        this.points = [];
        const numPoints = 8;
        for (let i = 0; i < numPoints; i++) {
            const angle = (i / numPoints) * Math.PI * 2;
            const dist = 20 + Math.random() * 15;
            this.points.push({ x: Math.cos(angle) * dist, y: Math.sin(angle) * dist });
        }
    }

    update() {
        if (this.timer < this.warningTime) {
            this.timer++;
        } else if (!this.hit) {
            // Drop the rock fast
            this.rockY += 35;
            if (this.rockY >= 0) {
                this.rockY = 0;
                this.hit = true;
                this.checkHit();
                splats.push(new WebSplat(this.px, this.py));
            }
        } else {
            // Stuck in ground
            this.stayTimer++;
            if (this.stayTimer >= this.stayTime) {
                this.done = true;
            }
        }
    }

    checkHit() {
        const dx = spider.x - this.tx;
        const dy = spider.y - this.ty;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 6 && !spider.isDead && spider.invulnerable <= 0) {
            spider.health = Math.max(0, spider.health - 25);
            if (spider.health <= 0) {
                spider.isDead = true;
                setTimeout(showComicScreen, 1200); // Show after death animation
            }
            spider.invulnerable = 60;
        }
    }

    draw() {
        if (this.timer < this.warningTime) {
            // Draw Warning Circle (Quick 1s flash)
            const progress = this.timer / this.warningTime;
            const radius = 40 * (1 - progress);

            ctx.strokeStyle = `rgba(255, 100, 0, ${0.4 + progress * 0.6})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(this.px, this.py, 30, 0, Math.PI * 2);
            ctx.stroke();

            ctx.fillStyle = `rgba(255, 50, 0, ${0.2 + progress * 0.3})`;
            ctx.beginPath();
            ctx.arc(this.px, this.py, radius, 0, Math.PI * 2);
            ctx.fill();
        } else {
            // Draw Rock
            ctx.save();
            ctx.translate(this.px, this.py + this.rockY);

            // Rock Shadow
            if (this.rockY < 0) {
                const shadowScale = 1 - (Math.abs(this.rockY) / 400);
                ctx.fillStyle = `rgba(0, 0, 0, ${0.4 * shadowScale})`;
                ctx.beginPath();
                ctx.ellipse(0, -this.rockY, 25 * shadowScale, 15 * shadowScale, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            // Rock Body
            ctx.fillStyle = '#555555';
            ctx.strokeStyle = '#222222';
            ctx.lineWidth = 2;

            if (this.hit) {
                // Dim slightly when stuck and about to disappear
                const fade = 1 - (this.stayTimer / this.stayTime);
                ctx.globalAlpha = Math.min(1, fade * 2);
            }

            ctx.beginPath();
            ctx.moveTo(this.points[0].x, this.points[0].y);
            for (let i = 1; i < this.points.length; i++) {
                ctx.lineTo(this.points[i].x, this.points[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Rock Highlights/Textures
            ctx.strokeStyle = '#777777';
            ctx.beginPath();
            ctx.moveTo(-10, -10);
            ctx.lineTo(-5, -15);
            ctx.stroke();

            ctx.restore();
            ctx.globalAlpha = 1;
        }
    }
}

/**
 * Smoothly interpolates spider position and rotation towards target.
 * Rotation handles shortest-path angular wrapping.
 */
function updateSpider() {
    if (spider.isDead) {
        spider.deathTimer++;
        return;
    }

    if (spider.invulnerable > 0) spider.invulnerable--;

    const dx = spider.targetX - spider.x;
    const dy = spider.targetY - spider.y;

    spider.x += dx * 0.15;
    spider.y += dy * 0.15;

    if (Math.sqrt(dx * dx + dy * dy) > 0.1) {
        const targetAngle = Math.atan2(dy, dx) + Math.PI / 2;
        let angleDiff = targetAngle - spider.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        spider.angle += angleDiff * 0.25;
    }
}

/**
 * Handles all spider rendering:
 * 1. 3D Death Animation (tumble/scale)
 * 2. Alive state (radioactive colors/legs)
 * 3. UI overlays (Health & Ammo bars)
 */
function drawSpider() {
    // Persistent indicator at target if unlocked
    if (spider.aoeUnlocked) {
        const tx = spider.targetX * ZOOM + ZOOM / 2;
        const ty = spider.targetY * ZOOM + ZOOM / 2;
        ctx.save();
        ctx.translate(tx, ty);
        ctx.strokeStyle = `rgba(255, 255, 255, 0.15)`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(Math.cos(angle) * 40, Math.sin(angle) * 40); ctx.stroke();
        }
        for (let j = 1; j <= 2; j++) {
            ctx.beginPath(); ctx.arc(0, 0, j * 20, 0, Math.PI * 2); ctx.stroke();
        }
        ctx.restore();
    }

    const px = spider.x * ZOOM + ZOOM / 2;
    const py = spider.y * ZOOM + ZOOM / 2;

    ctx.save();
    ctx.translate(px, py);

    if (spider.isDead) {
        // 3D Death Animation (Tumble and Fly Off)
        const t = spider.deathTimer;
        const scale = Math.max(0, 1 - t / 60);
        const rotate3D = t * 0.2;
        ctx.scale(scale * Math.cos(rotate3D), scale); // Simulated 3D Y-axis flip
        ctx.rotate(t * 0.1); // Spinning
        ctx.translate(t * 2, -t * 3); // Flying off
    } else {
        ctx.rotate(spider.angle);
        // Flash white if invulnerable (hit recently)
        if (spider.invulnerable > 0 && Math.floor(Date.now() / 50) % 2 === 0) {
            ctx.shadowBlur = 0;
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = spider.color;
        }
    }

    ctx.fillStyle = '#1e1e24';
    ctx.strokeStyle = spider.color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 12, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Radioactive Body (Red and Blue Gradient)
    const bodyGrad = ctx.createRadialGradient(0, 0, 2, 0, 0, 12);
    bodyGrad.addColorStop(0, spider.color);
    bodyGrad.addColorStop(1, '#1e1e24');

    ctx.fillStyle = bodyGrad;
    ctx.strokeStyle = spider.secondaryColor;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Secondary Accents (Blue dots on back)
    ctx.fillStyle = spider.secondaryColor;
    ctx.beginPath();
    ctx.arc(0, 4, 2, 0, Math.PI * 2);
    ctx.arc(-3, 8, 1.5, 0, Math.PI * 2);
    ctx.arc(3, 8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Glowing Eyes (Red)
    ctx.fillStyle = '#ff0000';
    ctx.shadowBlur = 10;
    ctx.shadowColor = '#ff0000';
    ctx.beginPath();
    ctx.arc(-4, -8, 2.5, 0, Math.PI * 2);
    ctx.arc(4, -8, 2.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Radioactive Legs (Sharp Blue)
    ctx.strokeStyle = spider.secondaryColor;
    ctx.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
        // Right legs - jointed
        ctx.beginPath();
        ctx.moveTo(8, (i - 1.5) * 4);
        ctx.lineTo(18, (i - 1.5) * 8);
        ctx.lineTo(24, (i - 1.5) * 15);
        ctx.stroke();
        // Left legs - jointed
        ctx.beginPath();
        ctx.moveTo(-8, (i - 1.5) * 4);
        ctx.lineTo(-18, (i - 1.5) * 8);
        ctx.lineTo(-24, (i - 1.5) * 15);
        ctx.stroke();
    }
    ctx.restore();

    // Ammo UI
    const barWidth = 40;
    const barHeight = 4;
    const ammoPct = Math.min(1, spider.webAmmo / spider.maxAmmo);
    const healthPct = spider.health / spider.maxHealth;

    // Health Bar (Red)
    ctx.fillStyle = 'rgba(255, 0, 0, 0.2)';
    ctx.fillRect(px - barWidth / 2, py - 38, barWidth, barHeight);
    ctx.fillStyle = '#ff3300';
    ctx.fillRect(px - barWidth / 2, py - 38, barWidth * healthPct, barHeight);

    // Ammo Bar
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fillRect(px - barWidth / 2, py - 45, barWidth, barHeight);
    ctx.fillStyle = spider.color;
    ctx.fillRect(px - barWidth / 2, py - 45, barWidth * ammoPct, barHeight);

    // Numerical Ammo Counter
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px Outfit';
    ctx.textAlign = 'center';
    ctx.fillText(spider.webAmmo, px, py - 52);
}

let attackTimer = 0;

/**
 * Main Game Loop (approx 60fps):
 * Handles coordinate grids, physics updates for all entities,
 * dimension transitions, and attack spawning logic.
 */
function gameLoop() {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= MAP_SIZE; i++) {
        ctx.beginPath(); ctx.moveTo(i * ZOOM, 0); ctx.lineTo(i * ZOOM, CANVAS_SIZE); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(0, i * ZOOM); ctx.lineTo(CANVAS_SIZE, i * ZOOM); ctx.stroke();
    }

    for (let i = webs.length - 1; i >= 0; i--) {
        webs[i].update();
        webs[i].draw();
        if (webs[i].done) webs.splice(i, 1);
    }

    for (let i = splats.length - 1; i >= 0; i--) {
        splats[i].update();
        splats[i].draw();
        if (splats[i].done) splats.splice(i, 1);
    }

    // Update and Draw Attacks
    for (let i = attacks.length - 1; i >= 0; i--) {
        attacks[i].update();
        attacks[i].draw();
        if (attacks[i].done) attacks.splice(i, 1);
    }

    // Spawn Attacks
    if (spider.aoeUnlocked && !spider.isDead) {
        attackTimer++;

        let currentDelay;
        if (dimension === 1) {
            const speedMultiplier = Math.floor(score / 10);
            currentDelay = Math.max(15, 60 - speedMultiplier * 6);
        } else if (dimension === 2) {
            // Speed starts reset at 60 and scales down as you dodge more rocks here
            const speedMultiplier = Math.floor(dodgedInDimension / 4);
            currentDelay = Math.max(15, 60 - speedMultiplier * 10);
        }

        if (attackTimer > currentDelay) {
            attacks.push(new RockAttack(spider.x, spider.y));
            attackTimer = 0;
            if (dimension === 2) {
                dodgedInDimension++;
                if (dodgedInDimension >= 30 && !portal) {
                    portal = new Portal(MAP_SIZE / 2, MAP_SIZE / 2, 3);
                }
            }
        }
    }

    if (dimension !== 3) {
        if (dimension === 1) {
            flies.forEach(fly => {
                fly.update();
                fly.draw();
            });
        }

        if (portal) {
            portal.update();
            portal.draw();
        }

        updateSpider();
        drawSpider();
    } else {
        // WORLD 3: REALLIFE 3D 5PYIDER
        ctx.save();
        ctx.fillStyle = '#111';
        ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

        const center = CANVAS_SIZE / 2;
        ctx.translate(center, center);

        ctx.font = 'bold 40px Outfit';
        ctx.fillStyle = spider.color;
        ctx.textAlign = 'center';
        ctx.fillText('TRANSITIONING TO 3D WORLD...', 0, -100);

        // Draw a large, spinning "Realistic" Spider
        const t = Date.now() / 1000;
        ctx.rotate(t);
        ctx.scale(2 + Math.sin(t), 2 + Math.sin(t));

        // We reuse spider drawing logic but bigger and with more shadow depth
        ctx.shadowBlur = 30;
        ctx.shadowColor = spider.color;

        // Draw 3D-ish body
        ctx.fillStyle = '#ff0033';
        ctx.beginPath(); ctx.ellipse(0, 0, 30, 40, 0, 0, Math.PI * 2); ctx.fill();

        // Legs pulsing
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            ctx.beginPath();
            ctx.moveTo(Math.cos(angle) * 20, Math.sin(angle) * 20);
            ctx.lineTo(Math.cos(angle) * 60, Math.sin(angle) * 60);
            ctx.strokeStyle = spider.secondaryColor;
            ctx.lineWidth = 5;
            ctx.stroke();
        }

        ctx.restore();

        if (Math.random() < 0.01) {
            const overlay = document.getElementById('ui-overlay');
            if (overlay) overlay.innerHTML = '<h1>YOU ARE NOW A REALLIFE 5PYIDER</h1>';
        }
    }

    if (dimension === 1 && score >= 75 && !portal) {
        portal = new Portal(MAP_SIZE / 2, MAP_SIZE / 2, 2);
        const overlay = document.getElementById('ui-overlay');
        if (overlay) overlay.innerHTML = '<p style="color: #ff00ff">DIMENSIONAL PORTAL OPENED! Enter to escape the rocks!</p>';
    }

    if (spider.aoeUnlocked && score < 15) {
        ctx.fillStyle = spider.color;
        ctx.font = 'bold 20px Outfit';
        ctx.textAlign = 'center';
        ctx.fillText('AOE & MOVEMENT UNLOCKED!', CANVAS_SIZE / 2, 50);
        ctx.font = '14px Outfit';
        ctx.fillStyle = '#ff3300';
        ctx.fillText('BEWARE OF FALLING ROCKS!', CANVAS_SIZE / 2, 75);
    }

    requestAnimationFrame(gameLoop);
}

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const gridX = Math.floor(clickX / ZOOM);
    const gridY = Math.floor(clickY / ZOOM);
    const targetPxX = gridX * ZOOM + ZOOM / 2;
    const targetPxY = gridY * ZOOM + ZOOM / 2;

    if (spider.webAmmo <= 0 && dimension === 1) return;
    if (dimension === 1) spider.webAmmo--;

    shootWebAtCoord(targetPxX, targetPxY);
    splats.push(new WebSplat(targetPxX, targetPxY));

    if (spider.aoeUnlocked) {
        flies.forEach(f => {
            const dx = Math.abs(f.x - gridX);
            const dy = Math.abs(f.y - gridY);
            if (dx <= 2 && dy <= 2) shootWebAtFly(f);
        });
    } else {
        const clickedFly = flies.find(f => {
            const dx = f.x - gridX;
            const dy = f.y - gridY;
            return Math.sqrt(dx * dx + dy * dy) < 3;
        });
        if (clickedFly) shootWebAtFly(clickedFly);
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    if (!spider.aoeUnlocked) return;

    const rect = canvas.getBoundingClientRect();
    const tx = Math.floor((e.clientX - rect.left) / ZOOM);
    const ty = Math.floor((e.clientY - rect.top) / ZOOM);

    if (portal && portal.isInside(tx, ty)) {
        dimension = portal.targetDimension;
        portal = null;
        if (dimension === 2) {
            flies = [];
            const overlay = document.getElementById('ui-overlay');
            if (overlay) overlay.innerHTML = '<p style="color: #ff00ff">WELCOME TO THE SECOND DIMENSION. SURVIVE 30 ROCKS! INFINITE WEB ENABLED.</p>';
        }
        return;
    }

    if (spider.webAmmo < 2 && dimension === 1) {
        return;
    }

    if (dimension === 1) spider.webAmmo -= 2;

    spider.targetX = tx;
    spider.targetY = ty;
});

function shootWebAtCoord(tx, ty) {
    const spx = spider.x * ZOOM + ZOOM / 2;
    const spy = spider.y * ZOOM + ZOOM / 2;
    spider.angle = Math.atan2(ty - spy, tx - spx) + Math.PI / 2;
    webs.push(new WebLine(spx, spy, tx, ty, null));
}

function shootWebAtFly(targetFly) {
    const spx = spider.x * ZOOM + ZOOM / 2;
    const spy = spider.y * ZOOM + ZOOM / 2;
    const fpx = targetFly.x * ZOOM + ZOOM / 2;
    const fpy = targetFly.y * ZOOM + ZOOM / 2;

    if (!webs.some(w => w.flyId === targetFly.id)) {
        spider.angle = Math.atan2(fpy - spy, fpx - spx) + Math.PI / 2;
        webs.push(new WebLine(spx, spy, fpx, fpy, targetFly.id));
    }
}

init();
gameLoop();
