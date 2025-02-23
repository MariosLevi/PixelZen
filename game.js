// Get canvas and context with error checking
const canvas = document.getElementById('gameCanvas');
if (!canvas) {
    console.error('Canvas element not found!');
    throw new Error('Canvas not found - check HTML ID');
}
const ctx = canvas.getContext('2d');
if (!ctx) {
    console.error('Failed to get 2D context!');
    throw new Error('2D context not available');
}

// Dynamically set canvas size to match window
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    console.log(`Canvas resized to ${canvas.width}x${canvas.height}`);
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

// Colors
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const RED = '#FF0000';

// World scale
const worldScale = 5;

// Vector2 class
class Vector2 {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
    add(v) { return new Vector2(this.x + v.x, this.y + v.y); }
    subtract(v) { return new Vector2(this.x - v.x, this.y - v.y); }
    multiply(scalar) { return new Vector2(this.x * scalar, this.y * scalar); }
    distanceTo(v) { return Math.sqrt((this.x - v.x) ** 2 + (this.y - v.y) ** 2); }
}

class Car {
    constructor() {
        this.worldPos = new Vector2(canvas.width * worldScale / 2, canvas.height * worldScale / 2);
        this.width = 3;
        this.length = 6;
        this.speed = 1;
        this.velocity = new Vector2(0, 0);
        this.direction = 0;
        this.turnRate = 0.05;
        this.lines = [];
        this.currentRoute = null;
        this.isErasing = false;
        this.lastDrawnPos = null;
        this.hue = 0; // For rainbow gradient
    }

    move(keys) {
        if (keys['ArrowLeft']) this.direction += this.turnRate;
        if (keys['ArrowRight']) this.direction -= this.turnRate;
        if (keys['ArrowUp']) {
            this.velocity = new Vector2(
                Math.cos(this.direction),
                -Math.sin(this.direction)
            ).multiply(this.speed);
        } else if (keys['ArrowDown']) {
            this.velocity = new Vector2(
                -Math.cos(this.direction),
                Math.sin(this.direction)
            ).multiply(this.speed);
        } else {
            this.velocity = this.velocity.multiply(0.95);
        }
        const newPos = this.worldPos.add(this.velocity);
        const halfWidth = this.width / 2;
        const halfHeight = this.length / 2;
        this.worldPos = new Vector2(
            Math.max(halfWidth, Math.min(canvas.width * worldScale - halfWidth, newPos.x)),
            Math.max(halfHeight, Math.min(canvas.height * worldScale - halfHeight, newPos.y))
        );
    }

    updateWidth(keys) {
        if (keys['Control']) this.width = Math.min(20, this.width + 1);
        else if (keys['Shift']) this.width = Math.max(1, this.width - 1);
        this.length = this.width * 2;
    }

    drawLine(drawing, erasing, mode) {
        if (drawing) {
            if (!this.currentRoute || !this.lastDrawnPos) {
                this.currentRoute = [];
                this.lines.push(this.currentRoute);
                this.lastDrawnPos = new Vector2(this.worldPos.x, this.worldPos.y);
                this.hue = 0; // Reset hue for new route
            }
            if (this.worldPos.distanceTo(this.lastDrawnPos) > 0.1) {
                const color = (mode === 'rainbow') ? getRainbowGradientColor(this.hue) : (mode === 'light' ? BLACK : WHITE);
                this.currentRoute.push({
                    start: new Vector2(this.lastDrawnPos.x, this.lastDrawnPos.y),
                    end: new Vector2(this.worldPos.x, this.worldPos.y),
                    width: this.width,
                    color: color
                });
                this.hue = (this.hue + 10) % 360; // Increment hue for gradient (smooth transition)
                this.lastDrawnPos = new Vector2(this.worldPos.x, this.worldPos.y);
            }
        } else {
            this.currentRoute = null;
        }

        if (erasing) {
            this.isErasing = true;
            const currentRect = {
                x: this.worldPos.x - this.width / 2,
                y: this.worldPos.y - this.width / 2,
                w: this.width,
                h: this.length
            };
            for (let i = 0; i < this.lines.length; i++) {
                let route = this.lines[i];
                for (let j = route.length - 1; j >= 0; j--) {
                    const { start, end, width } = route[j];
                    const lineRect = {
                        x: Math.min(start.x, end.x) - width / 2,
                        y: Math.min(start.y, end.y) - width / 2,
                        w: Math.abs(start.x - end.x) + width,
                        h: Math.abs(start.y - end.y) + width
                    };
                    if (this.rectCollides(currentRect, lineRect)) {
                        route.splice(j, 1);
                    }
                }
                if (route.length === 0) {
                    this.lines.splice(i, 1); // Remove empty routes
                    i--;
                }
            }
        } else {
            this.isErasing = false;
        }
    }

    rectCollides(r1, r2) {
        return r1.x < r2.x + r2.w && r1.x + r1.w > r2.x &&
               r1.y < r2.y + r2.h && r1.y + r1.h > r2.y;
    }

    render(offset, zoom, mode) {
        console.log(`Rendering car at ${this.worldPos.x}, ${this.worldPos.y}, mode: ${mode}`);

        ctx.lineCap = 'round';
        for (const route of this.lines) {
            for (const { start, end, width, color } of route) {
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = Math.max(1, width * zoom);
                ctx.moveTo((start.x - offset.x) * zoom, (start.y - offset.y) * zoom);
                ctx.lineTo((end.x - offset.x) * zoom, (end.y - offset.y) * zoom);
                ctx.stroke();
            }
        }

        const screenPos = this.worldPos.subtract(offset).multiply(zoom);
        ctx.save();
        ctx.translate(screenPos.x, screenPos.y);
        ctx.rotate(this.direction);
        const carColor = this.isErasing ? RED : (mode === 'light' || mode === 'rainbow' ? BLACK : WHITE);
        ctx.fillStyle = carColor;
        ctx.fillRect(
            -this.width * zoom / 2,
            -this.length * zoom / 2,
            this.width * zoom,
            this.length * zoom
        );
        ctx.restore();
    }
}

// Rainbow gradient color generator (smooth transition)
function getRainbowGradientColor(hue) {
    return `hsl(${hue}, 100%, 50%)`;
}

// Game state
const car = new Car();
let offset = new Vector2(canvas.width * (worldScale - 1) / 2, canvas.height * (worldScale - 1) / 2);
let zoom = 1;
const keys = {};
let mode = 'dark';

// Mode toggle
const modeToggle = document.getElementById('modeToggle');
if (!modeToggle) {
    console.error('Mode toggle element not found!');
    throw new Error('Mode toggle not found - check HTML ID');
}
modeToggle.addEventListener('click', (e) => {
    e.preventDefault();
    const modes = ['dark', 'light', 'rainbow'];
    const currentIndex = modes.indexOf(mode);
    mode = modes[(currentIndex + 1) % 3];
    modeToggle.className = mode;
    const span = modeToggle.getElementsByTagName('span')[0];
    span.textContent = mode.charAt(0).toUpperCase() + mode.slice(1);
    document.body.style.backgroundColor = (mode === 'dark') ? BLACK : WHITE;
    document.getElementById('helpButton').style.color = (mode === 'dark') ? WHITE : BLACK;
    document.getElementById('musicButton').style.color = (mode === 'dark') ? WHITE : BLACK;
    canvas.focus();
});

// Help button and instructions
const helpButton = document.getElementById('helpButton');
if (!helpButton) {
    console.error('Help button element not found!');
    throw new Error('Help button not found - check HTML ID');
}
const instructions = document.getElementById('instructions');
if (!instructions) {
    console.error('Instructions element not found!');
    throw new Error('Instructions not found - check HTML ID');
}

helpButton.addEventListener('click', (e) => {
    e.preventDefault();
    instructions.classList.add('show');
    setTimeout(() => instructions.classList.remove('show'), 6000);
    canvas.focus();
});

// Background music and music toggle
const backgroundMusic = document.getElementById('backgroundMusic');
const musicButton = document.getElementById('musicButton');
if (!backgroundMusic) {
    console.error('Background music element not found!');
    throw new Error('Background music not found - check HTML ID');
}
if (!musicButton) {
    console.error('Music button element not found!');
    throw new Error('Music button not found - check HTML ID');
}

let isMuted = true; // Start muted (off) by default, no playback on load
musicButton.textContent = `Music: ${isMuted ? 'Off' : 'On'}`; // Ensure button starts as "Music: Off"

musicButton.addEventListener('click', (e) => {
    e.preventDefault();
    isMuted = !isMuted;
    if (isMuted) {
        backgroundMusic.pause();
    } else {
        backgroundMusic.play().catch(error => {
            console.error('Audio play failed:', error);
            alert('Click this button again to start music after interacting with the page.');
            isMuted = true; // Revert if playback fails
        });
    }
    musicButton.textContent = `Music: ${isMuted ? 'Off' : 'On'}`;
    console.log(`Music ${isMuted ? 'muted' : 'unmuted'}`);
    canvas.focus();
});

// Keyboard input
window.addEventListener('keydown', (e) => {
    if (e.key === ' ') keys['Space'] = true;
    else if (e.key === 'e') keys['e'] = true;
    else if (e.key === 'Control') keys['Control'] = true;
    else if (e.key === 'Shift') keys['Shift'] = true;
    else keys[e.key] = true;
});
window.addEventListener('keyup', (e) => {
    if (e.key === ' ') keys['Space'] = false;
    else if (e.key === 'e') keys['e'] = false;
    else if (e.key === 'Control') keys['Control'] = false;
    else if (e.key === 'Shift') keys['Shift'] = false;
    else keys[e.key] = false;
});

// Mouse wheel for zoom
canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const mousePos = new Vector2(e.offsetX, e.offsetY);
    const worldMouseBefore = mousePos.multiply(1 / zoom).add(offset);
    if (e.deltaY < 0) zoom = Math.min(10, zoom + 0.5);
    else if (e.deltaY > 0) zoom = Math.max(0.5, zoom - 0.5);
    const worldMouseAfter = mousePos.multiply(1 / zoom).add(offset);
    offset = offset.add(worldMouseBefore.subtract(worldMouseAfter));
});

// Game loop (reverted to original, no throttling)
function gameLoop() {
    console.log(`Game loop, mode: ${mode}, car pos: ${car.worldPos.x}, ${car.worldPos.y}`);

    car.move(keys);
    car.updateWidth(keys);
    car.drawLine(keys['Space'], keys['e'], mode);

    // Camera logic
    const screenPos = car.worldPos.subtract(offset);
    const deadZoneFactor = 0.5;
    const deadZoneX = canvas.width * deadZoneFactor / 2;
    const deadZoneY = canvas.height * deadZoneFactor / 2;
    const edgeBufferX = canvas.width * 0.1;
    const edgeBufferY = canvas.height * 0.1;

    if (zoom === 1) {
        if (screenPos.x < deadZoneX) offset.x -= deadZoneX - screenPos.x;
        else if (screenPos.x > canvas.width - deadZoneX) offset.x += screenPos.x - (canvas.width - deadZoneX);
        if (screenPos.y < deadZoneY) offset.y -= deadZoneY - screenPos.y;
        else if (screenPos.y > canvas.height - deadZoneY) offset.y += screenPos.y - (canvas.height - deadZoneY);
    } else {
        if (screenPos.x > canvas.width - edgeBufferX) offset.x += screenPos.x - (canvas.width - edgeBufferX);
        else if (screenPos.x < edgeBufferX) offset.x -= edgeBufferX - screenPos.x;
        if (screenPos.y > canvas.height - edgeBufferY) offset.y += screenPos.y - (canvas.height - edgeBufferY);
        else if (screenPos.y < edgeBufferY) offset.y -= edgeBufferY - screenPos.y;
    }

    // Render
    ctx.fillStyle = (mode === 'dark') ? BLACK : WHITE;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    car.render(offset, zoom, mode);

    // Zoom text
    ctx.fillStyle = (mode === 'dark') ? WHITE : BLACK;
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText(`Zoom: ${zoom.toFixed(1)}x`, canvas.width - 120, canvas.height - 10);

    requestAnimationFrame(gameLoop);
}

gameLoop();