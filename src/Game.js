// Why are some values in px/s²? An example:
// In 'vy += gravity * dt;' is vy in px/s and dt in s.
// gravity * dt = vy. gravity * s = px/s
// gravity = px/s / s. gravity = px/s * 1/s. gravity = px/s²

// Why are some values in px/s? An example:
// In 'brakingDelta = groundDeceleration * dt;' is groundDeceleration in px/s² and dt in s.
// groundDeceleration * dt = brakingDelta. px/s² * s = brakingDelta
// px/s² * s = px / (s * s) * s = px * s / (s * s) = (px / s) * (s / s) = px / s

function createElement(element, parent) {
  const e = document.createElement(element)
  parent.appendChild(e)
  return e
}

function createPxSize(size) {
  return `${size}px`
}

// TODO: should there be a version that accepts a halfSize? Maybe good if there are multiple of the same size
// TODO: createEntity is too broad for some entities
function createEntity(x, y, size, vx = null, vy = null, isGrounded = null) {
  return {
    x,
    y,
    size,
    halfSize: size / 2,
    vx, // px/s
    vy, // px/s
    isGrounded
  }
}

function snapshotWorld(world) {
  return {
    player: { x: world.player.x, y: world.player.y }
  }
}

function respawnPlayer(world) {
  world.player.x = world.spawn.x
  world.player.y = world.spawn.y
  world.player.vx = 0 // TODO: duplicate
  world.player.vy = 0 // TODO: duplicate
  world.player.isGrounded = false // TODO: duplicate
}

function computeBoundingBoxCollisionData(a, b) {
  const combinedHalfSize = a.halfSize + b.halfSize

  const dx = a.x - b.x
  const dy = a.y - b.y

  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  return {
    combinedHalfSize,
    dx,
    dy,
    absDx,
    absDy,
    overlaps: absDx < combinedHalfSize && absDy < combinedHalfSize
  }
}

function interpolate(start, end, alpha) {
  return start + (end - start) * alpha
}

function resetWorld(world) {
  world.isWon = false
  respawnPlayer(world)
}

function createWorld() {
  const width = 800
  const size = 50
  const maxX = width / 2
  const spawn = { x: 0, y: -200 }

  return {
    width,
    height: 600,
    maxX,
    minX: -maxX,
    spawn,
    killPlaneY: 900,
    player: createEntity(spawn.x, spawn.y, size, 0, 0, false),
    solids: [createEntity(0, 200, size), createEntity(-100, 180, size), createEntity(50, 530, 500)],
    goal: createEntity(100, 150, size),
    isWon: false
  }
}

function buildFrameData(previous, current, alpha, world) {
  const playerX = interpolate(previous.player.x, current.player.x, alpha)
  const playerY = interpolate(previous.player.y, current.player.y, alpha)

  // TODO: duplicate x, y, size, halfSize
  return {
    renderWidth: world.width,
    renderHeight: world.height,
    isWon: world.isWon,
    goal: {
      x: world.goal.x,
      y: world.goal.y,
      size: world.goal.size,
      halfSize: world.goal.halfSize
    },
    solids: world.solids.map((s) => ({
      x: s.x,
      y: s.y,
      size: s.size,
      halfSize: s.halfSize
    })),
    player: {
      x: playerX,
      y: playerY,
      size: world.player.size,
      halfSize: world.player.halfSize
    }
  }
}

function createInputSystem() {
  const arrowLeft = "ArrowLeft"
  const arrowRight = "ArrowRight"
  const arrowUp = "ArrowUp"
  const keyR = "KeyR"

  const input = {
    left: false,
    right: false,
    jump: false,
    reset: false
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === arrowLeft) input.left = true
    if (e.code === arrowRight) input.right = true
    if (e.code === arrowUp) input.jump = true
    if (e.code === keyR) input.reset = true // TODO: make sure it triggers once
  })

  document.addEventListener("keyup", (e) => {
    if (e.code === arrowLeft) input.left = false
    if (e.code === arrowRight) input.right = false
    if (e.code === arrowUp) input.jump = false
    if (e.code === keyR) input.reset = false
  })

  return { input }
}

function createMovementSystem() {
  const maxRightwardSpeed = 220 // px/s
  const maxLeftwardSpeed = -maxRightwardSpeed // px/s

  return {
    update(world, input, dt) {
      const acceleration = world.player.isGrounded ? 1500 : 500 // px/s²

      if (input.left && !input.right) {
        world.player.vx -= acceleration * dt
      } else if (input.right && !input.left) {
        world.player.vx += acceleration * dt
      }

      world.player.vx -= world.player.vx * (world.player.isGrounded ? 15 : 2) * dt

      if (world.player.vx > maxRightwardSpeed) {
        world.player.vx = maxRightwardSpeed
      } else if (world.player.vx < maxLeftwardSpeed) {
        world.player.vx = maxLeftwardSpeed
      }
    }
  }
}

function createPhysicsSystem() {
  return {
    update(world, input, dt) {
      if (input.jump && world.player.isGrounded) {
        world.player.vy = -350 // px/s
      }

      world.player.vy += 800 * dt // px/s²
      world.player.x += world.player.vx * dt
      world.player.y += world.player.vy * dt
    }
  }
}

function createCollisionSystem() {
  return {
    update(world) {
      world.player.isGrounded = false

      for (const e of world.solids) {
        const data = computeBoundingBoxCollisionData(world.player, e)

        if (data.overlaps) {
          const overlapX = data.combinedHalfSize - data.absDx
          const overlapY = data.combinedHalfSize - data.absDy

          if (overlapX < overlapY) {
            world.player.x += data.dx > 0 ? overlapX : -overlapX
            world.player.vx = 0
          } else {
            world.player.y += data.dy > 0 ? overlapY : -overlapY
            world.player.vy = 0

            if (data.dy < 0) {
              world.player.isGrounded = true
            }
          }
        }
      }
    }
  }
}

function createGoalSystem() {
  return {
    update(world) {
      if (!world.isWon && computeBoundingBoxCollisionData(world.player, world.goal).overlaps) {
        world.isWon = true
      }
    }
  }
}

function createWorldConstraintSystem(world) {
  const minPlayerX = world.minX + world.player.halfSize
  const maxPlayerX = world.maxX - world.player.halfSize

  return {
    update(world) {
      const clampedX = Math.max(minPlayerX, Math.min(maxPlayerX, world.player.x))
      if (clampedX !== world.player.x) {
        world.player.x = clampedX
        world.player.vx = 0
      }

      if (world.player.y - world.player.halfSize > world.killPlaneY) {
        respawnPlayer(world)
      }
    }
  }
}

function createRenderer(canvas, context, world, camera) {
  let dpr = 0
  let lastDpr = dpr
  let imageData
  let data

  function resize() {
    dpr = window.devicePixelRatio
    if (dpr !== lastDpr) {
      lastDpr = dpr

      canvas.style.width = createPxSize(world.width)
      canvas.style.height = createPxSize(world.height)

      canvas.width = Math.floor(world.width * dpr)
      canvas.height = Math.floor(world.height * dpr)

      imageData = context.createImageData(canvas.width, canvas.height)
      data = imageData.data
    }
  }

  function worldToScreen(x, y) {
    return {
      x: x - camera.x + world.maxX,
      y: y - camera.y + world.height / 2
    }
  }

  function setPixel(x, y, r, g, b) {
    const i = (y * canvas.width + x) * 4
    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
    data[i + 3] = 255
  }

  function fillSquareScreen(x, y, size, r, g, b, a) {
    fillRectScreen(x, y, size, size, r, g, b, a)
  }

  function fillRectScreen(x, y, width, height, r, g, b, a) {
    // x/y may be fractional → integer pixels
    const startX = Math.max(0, Math.floor(x * dpr)) // TODO: duplicate
    const startY = Math.max(0, Math.floor(y * dpr))
    const endX = Math.min(canvas.width, Math.floor((x + width) * dpr))
    const endY = Math.min(canvas.height, Math.floor((y + height) * dpr))

    if (a === 255) {
      console.log("a", a) // TODO:
    }

    // Write pixels in row-major order
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        setPixel(px, py, r, g, b)
      }
    }
  }

  function fillSquareWorld(x, y, size, halfSize, r, g, b, a) {
    const screenPos = worldToScreen(x - halfSize, y - halfSize)
    fillSquareScreen(screenPos.x, screenPos.y, size, r, g, b, a)
  }

  function clear() {
    data.fill(0)
  }

  function present() {
    context.putImageData(imageData, 0, 0)
  }

  resize()
  window.addEventListener("resize", resize) // resize independent of main loop

  return {
    clear,
    fillSquareWorld,
    fillRectScreen,
    present
  }
}

function createRenderSystem(renderer) {
  return {
    render(frameData) {
      renderer.clear()

      if (frameData.isWon) {
        renderer.fillSquareWorld(
          frameData.goal.x,
          frameData.goal.y,
          frameData.goal.size,
          frameData.goal.halfSize,
          255,
          215,
          0,
          255
        )

        renderer.fillRectScreen(0, 0, frameData.renderWidth, frameData.renderHeight, 0, 0, 0, 180) // TODO: does not work correct as an overlay. Is its place correct?
      } else {
        renderer.fillSquareWorld(
          frameData.goal.x,
          frameData.goal.y,
          frameData.goal.size,
          frameData.goal.halfSize,
          0,
          200,
          0,
          255
        )
      }

      renderer.fillSquareWorld(
        frameData.player.x,
        frameData.player.y,
        frameData.player.size,
        frameData.player.halfSize,
        100,
        100,
        100,
        255
      )

      for (const s of frameData.solids) {
        renderer.fillSquareWorld(s.x, s.y, s.size, s.halfSize, 50, 50, 50, 255)
      }

      renderer.present()
    }
  }
}

export default function game(parent) {
  const SECOND_IN_MS = 1000

  const targetFrameMs = SECOND_IN_MS / 30 // SECOND_IN_MS / targetFps
  const maxDeltaMs = targetFrameMs * 2
  const deltaS = targetFrameMs / SECOND_IN_MS

  const canvas = createElement("canvas", parent)
  const context = canvas.getContext("2d")

  const camera = {
    x: 0,
    y: 0
  }

  const world = createWorld()

  const inputSystem = createInputSystem()
  const movementSystem = createMovementSystem()
  const physicsSystem = createPhysicsSystem()
  const collisionSystem = createCollisionSystem()
  const goalSystem = createGoalSystem()
  const worldConstraintSystem = createWorldConstraintSystem(world)
  const renderer = createRenderer(canvas, context, world, camera)
  const renderSystem = createRenderSystem(renderer)

  let last = performance.now()
  let accumulator = 0
  let renderAccumulator = 0

  let currentSnapshot = snapshotWorld(world)
  let previousSnapshot = currentSnapshot

  function loop(now) {
    let deltaMs = now - last
    last = now

    if (deltaMs > maxDeltaMs) deltaMs = maxDeltaMs

    accumulator += deltaMs
    renderAccumulator += deltaMs

    while (accumulator >= targetFrameMs) {
      previousSnapshot = currentSnapshot

      if (world.isWon && inputSystem.input.reset) {
        resetWorld(world)
      } else {
        movementSystem.update(world, inputSystem.input, deltaS)
        physicsSystem.update(world, inputSystem.input, deltaS)
        collisionSystem.update(world)
        goalSystem.update(world)
        worldConstraintSystem.update(world)
      }

      currentSnapshot = snapshotWorld(world)
      accumulator -= targetFrameMs
    }

    if (renderAccumulator >= targetFrameMs) {
      const frameData = buildFrameData(previousSnapshot, currentSnapshot, accumulator / targetFrameMs, world)

      camera.x = frameData.player.x
      camera.y = frameData.player.y

      renderSystem.render(frameData)

      renderAccumulator -= targetFrameMs
    }

    requestAnimationFrameLoop()
  }

  function requestAnimationFrameLoop() {
    requestAnimationFrame(loop)
  }

  requestAnimationFrameLoop()
}

// TODO:
// Improve Collision System Architecture
// show message overlay; add “press R to restart” with Bitmap Font (Recommended for 8-bit)
// (maybe hard/big change?) Camera smoothing. Interpolate camera position towards player instead of snapping: camera.x = lerp(camera.x, targetX, 1 - exp(-k*dt)) (or simple alpha). Add dead-zone so camera doesn’t micro-jitter.
