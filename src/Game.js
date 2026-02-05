function createElement(element, parent) {
  const e = document.createElement(element);
  parent.appendChild(e);
  return e;
}

function createPxSize(size) {
  return `${size}${"px"}`;
}

export default function game(parent) {
  const width = 800;
  const height = 600;
  const dpr = window.devicePixelRatio || 1;
  const fps = 30;
  const targetFrameTime = 1000 / fps;
  const speed = 100; // px/s

  let lastTime = 0;

  const canvas = createElement("canvas", parent);
  canvas.style.width = createPxSize(width);
  canvas.style.height = createPxSize(height);
  canvas.width = width * dpr;
  canvas.height = height * dpr;

  const context = canvas.getContext("2d");

  const imageData = context.createImageData(canvas.width, canvas.height);
  const data = imageData.data;

  function setPixel(x, y, r, g, b, a) {
    const index = (y * canvas.width + x) * 4;
    data[index] = r;
    data[index + 1] = g;
    data[index + 2] = b;
    data[index + 3] = a;
  }

  function fillSquare(x, y, size, r, g, b, a) {
    // TODO: is it more efficient to check if dpr is 1 and skip the is Math.floor?
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
    fillSquare(x, y, 50, 50, 50, 50, 255);
    context.putImageData(imageData, 0, 0);
  }

  let positionX = 0;

  function loop(time) {
    const elapsedMs = time - lastTime;
    if (elapsedMs >= targetFrameTime) {
      lastTime = time;
      const deltaTime = elapsedMs / 1000;

      data.fill(0);
      renderSquare(positionX, 0);

      positionX += speed * deltaTime;
    }

    requestAnimationFrameLoop();
  }

  function requestAnimationFrameLoop() {
    requestAnimationFrame(loop);
  }

  requestAnimationFrameLoop();
}
