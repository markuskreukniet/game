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

export default function game(parent) {
  const SECOND_IN_MS = 1000;

  const fps = 30;
  const targetFrameTime = SECOND_IN_MS / fps;
  const speed = 100; // px/s

  const world = createWorld();

  let dpr = 1;
  let lastDpr = dpr;
  let lastTime = 0;

  let inputLeft = false;
  let inputRight = false;

  const canvas = createElement("canvas", parent);
  const context = canvas.getContext("2d");

  let imageData;
  let data;

  function setPixel(x, y, r, g, b, a) {
    const index = (y * canvas.width + x) * 4;
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = a;
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

  function renderSquare(x, y) {
    fillSquare(x, y, world.entities[0].size, 50, 50, 50, 255);
  }

  function reverseVelocityX() {
    world.entities[0].vx = -world.entities[0].vx;
  }

  function update(deltaTime) {
    if (inputLeft && !inputRight) {
      world.entities[0].vx = -speed;
    } else if (inputRight && !inputLeft) {
      world.entities[0].vx = speed;
    }

    world.entities[0].x += world.entities[0].vx * deltaTime;

    if (world.entities[0].x <= 0) {
      world.entities[0].x = 0;
      reverseVelocityX();
    } else if (world.entities[0].x + world.entities[0].size >= world.width) {
      world.entities[0].x = world.width - world.entities[0].size;
      reverseVelocityX();
    }
  }

  function render() {
    data.fill(0);
    renderSquare(world.entities[0].x, world.entities[0].y);
    context.putImageData(imageData, 0, 0);
  }

  function loop(time) {
    dpr = window.devicePixelRatio || 1;
    if (dpr !== lastDpr) {
      lastDpr = dpr;
      resizeCanvas();
    }

    const elapsedMs = time - lastTime;

    if (elapsedMs >= targetFrameTime) {
      lastTime = time;

      update(elapsedMs / SECOND_IN_MS);
      render();
    }

    requestAnimationFrameLoop();
  }

  function requestAnimationFrameLoop() {
    requestAnimationFrame(loop);
  }

  function resizeCanvas() {
    canvas.style.width = createPxSize(world.width);
    canvas.style.height = createPxSize(world.height);

    canvas.width = Math.floor(world.width * dpr);
    canvas.height = Math.floor(world.height * dpr);

    imageData = context.createImageData(canvas.width, canvas.height);
    data = imageData.data;
  }

  resizeCanvas();
  requestAnimationFrameLoop();

  window.addEventListener("resize", resizeCanvas); // resize independent of main loop

  const arrowLeft = "ArrowLeft";
  const arrowRight = "ArrowRight";

  document.addEventListener("keydown", (e) => {
    if (e.key === arrowLeft) inputLeft = true;
    if (e.key === arrowRight) inputRight = true;
  });

  document.addEventListener("keyup", (e) => {
    if (e.key === arrowLeft) inputLeft = false;
    if (e.key === arrowRight) inputRight = false;
  });
}
