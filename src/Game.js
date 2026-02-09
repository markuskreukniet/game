function createElement(element, parent) {
  const e = document.createElement(element);
  parent.appendChild(e);
  return e;
}

function createPxSize(size) {
  return `${size}px`;
}

function createWorld() {
  return {
    width: 800,
    height: 600,
    entities: [
      {
        type: "player",
        x: 0,
        y: 0,
        size: 50,
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
        if (e.x < 0) {
          e.x = 0;
          e.vx = 0;
        } else if (e.x + e.size > world.width) {
          e.x = world.width - e.size;
          e.vx = 0;
        }
      }
    },
  };
}

function createRenderer(canvas, context, world) {
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

  function setPixel(x, y, r, g, b, a) {
    const i = (y * canvas.width + x) * 4;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
    data[i + 3] = a;
  }

  function fillSquare(x, y, size, r, g, b, a) {
    // x/y may be fractional → integer pixels
    const startX = Math.floor(x * dpr);
    const startY = Math.floor(y * dpr);
    const endX = Math.floor((x + size) * dpr);
    const endY = Math.floor((y + size) * dpr);

    // row-major order
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        setPixel(px, py, r, g, b, a);
      }
    }
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
    fillSquare,
    present,
  };
}

function createRenderSystem(renderer) {
  return {
    render(world) {
      renderer.clear();

      for (const e of world.entities) {
        renderer.fillSquare(e.x, e.y, e.size, 50, 50, 50, 255);
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

  const world = createWorld();

  const inputSystem = createInputSystem();
  const movementSystem = createMovementSystem(speed);
  const collisionSystem = createCollisionSystem();
  const renderer = createRenderer(canvas, context, world);
  const renderSystem = createRenderSystem(renderer);

  let lastTime = 0;

  function loop(time) {
    const frameTime = time - lastTime;

    if (frameTime >= targetFrameTime) {
      lastTime = time;

      movementSystem.update(world, inputSystem.input, frameTime / SECOND_IN_MS);
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
// pixel 0 in het midden van canvas?
// Camera / World vs Screen Space. Add a camera offset.
// Minimal Gameplay Goal. Platformer (gravity + jumping)
