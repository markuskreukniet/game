function createElement(element, parent) {
  const e = document.createElement(element);
  parent.appendChild(e);
  return e;
}

function createPxSize(size) {
  return `${size}px`;
}

// TODO: type should be an enum
function createWorld() {
  const width = 800;
  const size = 50;
  const maxX = width / 2;
  const halfSize = size / 2;

  const player = {
    type: "player",
    x: 0,
    y: -200, // TODO: should be 200
    size,
    halfSize,
    vx: 0,
    vy: 0,
    grounded: false,
  };

  return {
    width,
    height: 600,
    maxX,
    minX: -maxX,
    entities: [
      player,
      {
        type: "solid",
        x: 0,
        y: 200,
        size,
        halfSize,
        vx: null,
        vy: null,
        grounded: null,
      },
    ],
    player,
  };
}

function createInputSystem() {
  const arrowLeft = "ArrowLeft";
  const arrowRight = "ArrowRight";
  const arrowUp = "ArrowUp";

  const input = {
    left: false,
    right: false,
    jump: false,
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === arrowLeft) input.left = true;
    if (e.key === arrowRight) input.right = true;
    if (e.key === arrowUp) input.jump = true;
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === arrowLeft) input.left = false;
    if (e.key === arrowRight) input.right = false;
    if (e.key === arrowUp) input.jump = false;
  });

  return { input };
}

function createMovementSystem(speed) {
  return {
    update(world, input) {
      for (const e of world.entities) {
        if (e.type === "player") {
          if (input.left && !input.right) e.vx = -speed;
          else if (input.right && !input.left) e.vx = speed;
          else e.vx = 0; // TODO: duplicate
        }
      }
    },
  };
}

function createPhysicsSystem(gravity, jumpVelocity) {
  return {
    update(world, input, dt) {
      for (const e of world.entities) {
        if (e.type === "player") {
          if (input.jump && e.grounded) {
            e.vy = -jumpVelocity; // TODO: should be without the -
          }

          e.vy += gravity * dt;
          e.x += e.vx * dt;
          e.y += e.vy * dt;
        }
      }
    },
  };
}

function createCollisionSystem() {
  return {
    update(world) {
      world.player.grounded = false;

      for (const e of world.entities) {
        if (e.type === "solid") {
          const combinedHalfExtent = world.player.halfSize + e.halfSize;

          const dx = world.player.x - e.x;
          const dy = world.player.y - e.y;

          const absDx = Math.abs(dx);
          const absDy = Math.abs(dy);

          if (absDx < combinedHalfExtent && absDy < combinedHalfExtent) {
            const overlapX = combinedHalfExtent - absDx;
            const overlapY = combinedHalfExtent - absDy;

            if (overlapX < overlapY) {
              world.player.x += dx > 0 ? overlapX : -overlapX;
              world.player.vx = 0;
            } else {
              world.player.y += dy > 0 ? overlapY : -overlapY;
              world.player.vy = 0;

              if (dy < 0) {
                world.player.grounded = true;
              }
            }
          }
        }
      }
    },
  };
}

function createRenderer(canvas, context, world, camera) {
  let dpr = 0;
  let lastDpr = dpr;
  let imageData;
  let data;

  function resize() {
    dpr = window.devicePixelRatio;
    if (dpr !== lastDpr) {
      lastDpr = dpr;

      canvas.style.width = createPxSize(world.width);
      canvas.style.height = createPxSize(world.height);

      canvas.width = Math.floor(world.width * dpr);
      canvas.height = Math.floor(world.height * dpr);

      imageData = context.createImageData(canvas.width, canvas.height);
      data = imageData.data;
    }
  }

  function worldToScreen(x, y) {
    return {
      x: x - camera.x + world.maxX,
      y: y - camera.y + world.height / 2,
    };
  }

  function setPixel(x, y, r, g, b, a) {
    const i = (y * canvas.width + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }

  function fillSquareScreen(x, y, size, r, g, b, a) {
    // x/y may be fractional → integer pixels
    const startX = Math.floor(x * dpr);
    const startY = Math.floor(y * dpr);
    const endX = Math.floor((x + size) * dpr);
    const endY = Math.floor((y + size) * dpr);

    // Write pixels in row-major order
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        setPixel(px, py, r, g, b, a);
      }
    }
  }

  function fillSquareWorld(x, y, size, halfSize, r, g, b, a) {
    const screenPos = worldToScreen(x - halfSize, y - halfSize);
    fillSquareScreen(screenPos.x, screenPos.y, size, r, g, b, a);
  }

  function clear() {
    data.fill(0);
  }

  function present() {
    context.putImageData(imageData, 0, 0);
  }

  resize();
  window.addEventListener("resize", resize); // resize independent of main loop

  return {
    clear,
    fillSquareWorld,
    present,
  };
}

function createRenderSystem(renderer) {
  return {
    render(world) {
      renderer.clear();

      for (const e of world.entities) {
        renderer.fillSquareWorld(e.x, e.y, e.size, e.halfSize, 50, 50, 50, 255);
      }

      renderer.present();
    },
  };
}

export default function game(parent) {
  const SECOND_IN_MS = 1000;

  const fps = 30;
  const targetFrameTime = SECOND_IN_MS / fps;
  const speed = 100; // px/s
  const jumpVelocity = 350; // px/s

  // In 'e.vy += gravity * dt;' is vy in px/s and dt in s.
  // gravity * dt = vy. gravity * s = px/s
  // gravity = px/s / s. gravity = px/s * 1/s. gravity = px/s²
  const gravity = 800;

  const canvas = createElement("canvas", parent);
  const context = canvas.getContext("2d");

  const camera = {
    x: 0,
    y: 0,
  };

  const world = createWorld();

  const inputSystem = createInputSystem();
  const movementSystem = createMovementSystem(speed);
  const physicsSystem = createPhysicsSystem(gravity, jumpVelocity);
  const collisionSystem = createCollisionSystem();
  const renderer = createRenderer(canvas, context, world, camera);
  const renderSystem = createRenderSystem(renderer);

  let lastTime = 0;

  function loop(time) {
    const frameTime = time - lastTime;
    const dt = frameTime / SECOND_IN_MS;

    if (frameTime >= targetFrameTime) {
      lastTime = time;

      movementSystem.update(world, inputSystem.input, dt);

      camera.x = world.player.x;
      camera.y = world.player.y;

      physicsSystem.update(world, inputSystem.input, dt);
      collisionSystem.update(world);
      renderSystem.render(world);
    }

    requestAnimationFrameLoop();
  }

  function requestAnimationFrameLoop() {
    requestAnimationFrame(loop);
  }

  requestAnimationFrameLoop();
}

// TODO:
// Fixed Time-Step Update (Engine Quality Improvement). A fixed update with an accumulator.
// Minimal Gameplay Goal. Platformer (gravity + jumping)

// goal for platformer
