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

// TODO: check letters. naming is good
const bitmapFont8x8 = Object.freeze({
  I: [0x7e, 0x18, 0x18, 0x18, 0x18, 0x18, 0x18, 0x7e],
  N: [0x42, 0x62, 0x52, 0x4a, 0x46, 0x42, 0x42, 0x42],
  O: [0x3c, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x3c],
  U: [0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x42, 0x3c],
  W: [0x42, 0x42, 0x42, 0x5a, 0x5a, 0x5a, 0x66, 0x42],
  Y: [0x42, 0x42, 0x24, 0x18, 0x18, 0x18, 0x18, 0x18],
  "!": [0x18, 0x18, 0x18, 0x18, 0x18, 0x00, 0x18, 0x18],
  " ": [0, 0, 0, 0, 0, 0, 0, 0]
})

// TODO: should there be a version that accepts a halfSize? Maybe good if there are multiple of the same size
// TODO: createEntity is too broad for some entities
function createEntity(x, y, size, vx = null, vy = null, isGrounded = null, jumpBufferTime = null, coyoteTime = null) {
  return {
    x,
    y,
    size,
    halfSize: size / 2,
    vx, // px/s
    vy, // px/s // TODO: is it px/s?
    isGrounded,
    jumpBufferTime,
    coyoteTime
  }
}

function toBox(entity) {
  return {
    x: entity.x,
    y: entity.y,
    size: entity.size,
    halfSize: entity.halfSize
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
  world.player.jumpBufferTime = 0
  world.player.coyoteTime = 0
}

function collideAABB(a, b) {
  const combinedHalfSize = a.halfSize + b.halfSize

  const dx = a.x - b.x
  const dy = a.y - b.y

  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  if (absDx >= combinedHalfSize || absDy >= combinedHalfSize) {
    return null
  }

  return {
    dx,
    dy,
    penetrationX: combinedHalfSize - absDx,
    penetrationY: combinedHalfSize - absDy
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

  return {
    renderWidth: world.width,
    renderHeight: world.height,
    isWon: world.isWon,
    goal: toBox(world.goal),
    solids: world.solids.map(toBox),
    player: createEntity(playerX, playerY, world.player.size)
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
    jumpPressed: false,
    reset: false
  }

  document.addEventListener("keydown", (e) => {
    if (e.code === arrowLeft) input.left = true
    if (e.code === arrowRight) input.right = true
    if (e.code === keyR) input.reset = true // TODO: make sure it triggers once

    if (e.code === arrowUp) {
      if (!input.jump) input.jumpPressed = true
      input.jump = true
    }
  })

  document.addEventListener("keyup", (e) => {
    if (e.code === arrowLeft) input.left = false
    if (e.code === arrowRight) input.right = false
    if (e.code === keyR) input.reset = false
    if (e.code === arrowUp) input.jump = false
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
  // TODO: these consts to a config
  const jumpVelocity = -350
  const gravity = 800
  const coyoteTime = 0.08 // s
  const jumpBufferTime = 0.1 // s
  const jumpCutMultiplier = 0.5

  return {
    update(world, input, dt) {
      const p = world.player

      if (input.jumpPressed) {
        p.jumpBufferTime = jumpBufferTime
      } else {
        p.jumpBufferTime -= dt
      }

      if (p.isGrounded) {
        p.coyoteTime = coyoteTime
      } else {
        p.coyoteTime -= dt
      }

      if (p.jumpBufferTime > 0 && p.coyoteTime > 0) {
        p.vy = jumpVelocity // px/s
        p.isGrounded = false
        p.jumpBufferTime = 0
        p.coyoteTime = 0
      }

      if (!input.jump && p.vy < 0) {
        p.vy *= jumpCutMultiplier
      }

      p.vy += gravity * dt // px/s²
      p.x += p.vx * dt
      p.y += p.vy * dt

      input.jumpPressed = false
    }
  }
}

function createCollisionSystem() {
  return {
    update(world) {
      const p = world.player
      p.isGrounded = false

      for (const s of world.solids) {
        const collision = collideAABB(p, s)
        if (!collision) continue

        if (collision.penetrationX < collision.penetrationY) {
          p.x += collision.dx > 0 ? collision.penetrationX : -collision.penetrationX
          p.vx = 0
        } else {
          p.y += collision.dy > 0 ? collision.penetrationY : -collision.penetrationY
          p.vy = 0

          if (collision.dy < 0) {
            p.isGrounded = true
          }
        }
      }
    }
  }
}

function createGoalSystem() {
  return {
    update(world) {
      if (!world.isWon && collideAABB(world.player, world.goal)) {
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

function createCameraSystem(camera) {
  const followWeight = 0.2 // TODO: base it on frames?

  return {
    update(target) {
      camera.x = interpolate(camera.x, target.x, followWeight)
      camera.y = interpolate(camera.y, target.y, followWeight)
    }
  }
}

function createRenderer(canvas, context, world, camera) {
  const screenCenterY = world.height / 2

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
      y: y - camera.y + screenCenterY
    }
  }

  function snapToDevicePixel(coord) {
    return Math.max(0, Math.floor(coord * dpr)) // TODO: duplicate * dpr
  }

  function fillSquareScreen(x, y, size, r, g, b) {
    fillRectScreen(x, y, size, size, r, g, b)
  }

  function fillRectScreen(x, y, width, height, r, g, b, a = 255) {
    // x/y may be fractional → integer pixels
    const startX = snapToDevicePixel(x)
    const startY = snapToDevicePixel(y)
    const endX = Math.min(canvas.width, Math.floor((x + width) * dpr))
    const endY = Math.min(canvas.height, Math.floor((y + height) * dpr))

    const w = canvas.width

    // duplicate code for performance. // Write pixels in row-major order
    if (a === 255) {
      for (let py = startY; py < endY; py++) {
        let i = (py * w + startX) * 4

        for (let px = startX; px < endX; px++) {
          data[i] = r
          data[i + 1] = g
          data[i + 2] = b
          data[i + 3] = 255

          i += 4
        }
      }
    } else {
      const dstWeight = 255 - a
      const inv255 = 1 / 255

      const srcR = r * a
      const srcG = g * a
      const srcB = b * a

      for (let py = startY; py < endY; py++) {
        let i = (py * w + startX) * 4

        for (let px = startX; px < endX; px++) {
          const iPlusOne = i + 1
          const iPlusTwo = i + 2

          data[i] = (srcR + data[i] * dstWeight) * inv255
          data[iPlusOne] = (srcG + data[iPlusOne] * dstWeight) * inv255
          data[iPlusTwo] = (srcB + data[iPlusTwo] * dstWeight) * inv255
          data[i + 3] = 255

          i += 4
        }
      }
    }
  }

  function fillSquareWorld(x, y, size, halfSize, r, g, b) {
    const screenPos = worldToScreen(x - halfSize, y - halfSize)
    fillSquareScreen(screenPos.x, screenPos.y, size, r, g, b)
  }

  function drawGlyphScreen(char, x, y, scale, r, g, b) {
    for (let row = 0; row < 8; row++) {
      const rowBits = bitmapFont8x8[char][row]
      const rowY = y + row * scale

      for (let col = 0; col < 8; col++) {
        if (rowBits & (1 << (7 - col))) {
          fillSquareScreen(x + col * scale, rowY, scale, r, g, b)
        }
      }
    }
  }

  function drawTextScreen(text, x, y, scale, r, g, b) {
    const glyphAdvance = (8 + 1) * scale
    let cursorX = x

    for (const t of text) {
      drawGlyphScreen(t, cursorX, y, scale, r, g, b)
      cursorX += glyphAdvance // final increment is harmless and keeps the loop simple
    }
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
    drawTextScreen,
    present
  }
}

function createRenderSystem(renderer) {
  return {
    render(frameData) {
      renderer.clear()

      for (const s of frameData.solids) {
        renderer.fillSquareWorld(s.x, s.y, s.size, s.halfSize, 50, 50, 50)
      }

      renderer.fillSquareWorld(
        frameData.player.x,
        frameData.player.y,
        frameData.player.size,
        frameData.player.halfSize,
        100,
        100,
        100
      )

      if (frameData.isWon) {
        renderer.fillSquareWorld(
          frameData.goal.x,
          frameData.goal.y,
          frameData.goal.size,
          frameData.goal.halfSize,
          255,
          215,
          0
        )

        renderer.fillRectScreen(0, 0, frameData.renderWidth, frameData.renderHeight, 0, 0, 0, 180)
        renderer.drawTextScreen("YOU WIN!", 220, 260, 4, 252, 252, 252)
      } else {
        renderer.fillSquareWorld(
          frameData.goal.x,
          frameData.goal.y,
          frameData.goal.size,
          frameData.goal.halfSize,
          0,
          200,
          0
        )
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
  const cameraSystem = createCameraSystem(camera)
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
      cameraSystem.update(frameData.player)
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
// add and use a config
// add fall multiplier?
// input reset should trigger once

// do more like this const p = world.player. + remove some abstraction like requestAnimationFrameLoop()?
// should numbers like 255 be an constant? don't use / 2, but use * 0.5. Abstract * dpi and * dt?
