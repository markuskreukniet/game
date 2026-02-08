function createElement(element, parent) {
  const e = document.createElement(element);
  parent.appendChild(e);
  return e;
}

function createPxSize(size) {
  return `${size}${"px"}`;
}

export default function game(parent) {
  const SECOND_IN_MS = 1000;

  const width = 800;
  const height = 600;
  const fps = 30;
  const targetFrameTime = SECOND_IN_MS / fps;
  const speed = 100; // px/s
  const squareSize = 50;

  let dpr = 1;
  let lastDpr = dpr;
  let lastTime = 0;
  let velocityX = speed;
  let positionX = 0;

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
    fillSquare(x, y, squareSize, 50, 50, 50, 255);
  }

  function reverseVelocityX() {
    velocityX = -velocityX;
  }

  function update(deltaTime) {
    if (inputLeft && !inputRight) {
      velocityX = -speed;
    } else if (inputRight && !inputLeft) {
      velocityX = speed;
    }

    positionX += velocityX * deltaTime;

    if (positionX <= 0) {
      positionX = 0;
      reverseVelocityX();
    } else if (positionX + squareSize >= width) {
      positionX = width - squareSize;
      reverseVelocityX();
    }
  }

  function render() {
    data.fill(0);
    renderSquare(positionX, 0);
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
    canvas.style.width = createPxSize(width);
    canvas.style.height = createPxSize(height);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);

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
