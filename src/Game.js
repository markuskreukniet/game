function createElement(element, parent) {
  const e = document.createElement(element);
  parent.appendChild(e);
  return e;
}

function createPxSize(size) {
  return `${size}px`;
}

function createWorld() {
  const width = 800;
  const size = 50;
  const maxX = width / 2;
  const halfSize = size / 2;

  return {
    width,
    height: 600,
    maxX,
    minX: -maxX,
    entities: [
      {
        type: "player",
        x: 0,
        y: 0,
        size,
        halfSize,
        vx: 0,
      },
      {
        type: "block",
        x: 200,
        y: 0,
        size,
        halfSize,
        vx: 0,
      },
    ],
  };
}

function createInputSystem() {
  const arrowLeft = "ArrowLeft";
  const arrowRight = "ArrowRight";

  const input = {
    left: false,
    right: false,
  };

  document.addEventListener("keydown", (e) => {
    if (e.key === arrowLeft) input.left = true;
    if (e.key === arrowRight) input.right = true;
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === arrowLeft) input.left = false;
    if (e.key === arrowRight) input.right = false;
  });

  return { input };
}

function createMovementSystem(speed) {
  return {
    update(world, input, dt) {
      for (const e of world.entities) {
        if (e.type === "player") {
          if (input.left && !input.right) e.vx = -speed;
          else if (input.right && !input.left) e.vx = speed;
          else e.vx = 0; // TODO: duplicate three times

          e.x += e.vx * dt;
        }
      }
    },
  };
}

function createCollisionSystem() {
  return {
    update(world) {
      for (const e of world.entities) {
        if (e.x - e.halfSize < world.minX) {
          e.x = world.minX + e.halfSize;
          e.vx = 0;
        } else if (e.x + e.halfSize > world.maxX) {
          e.x = world.maxX - e.halfSize;
          e.vx = 0;
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

  const canvas = createElement("canvas", parent);
  const context = canvas.getContext("2d");

  const camera = {
    x: 0,
    y: 0,
  };

  const world = createWorld();

  const inputSystem = createInputSystem();
  const movementSystem = createMovementSystem(speed);
  const collisionSystem = createCollisionSystem();
  const renderer = createRenderer(canvas, context, world, camera);
  const renderSystem = createRenderSystem(renderer);

  let lastTime = 0;

  function loop(time) {
    const frameTime = time - lastTime;

    if (frameTime >= targetFrameTime) {
      lastTime = time;

      movementSystem.update(world, inputSystem.input, frameTime / SECOND_IN_MS);

      camera.x = world.entities[0].x;
      camera.y = world.entities[0].y;

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
