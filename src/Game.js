import { createElement, createPxSize } from './dom.js'
import { font, FONT_GLYPH_SIZE, fontPalette, playerPalette, playerSprite, PLAYER_SPRITE_SIZE } from './renderAssets.js'

// TODO: should there be a version that accepts a halfSize? Maybe good if there are multiple of the same size
function createEntity(x, y, size) {
  return {
    x,
    y,
    size,
    halfSize: size / 2
  }
}

function createPrevPosition(prevX, prevY) {
  return {
    prevX,
    prevY
  }
}

function createVelocity(vx, vy) {
  return {
    vx, // px/s
    vy // px/s
  }
}

function createPlayer(x, y, size) {
  return {
    ...createEntity(x, y, size),
    ...createPrevPosition(x, y),
    ...createVelocity(0, 0),
    isGrounded: false, // TODO: should start on false? or from param?
    standingOn: null,
    jumpActive: false,
    jumpBufferTime: 0,
    coyoteTime: 0
  }
}

function createSolid(x, y, size, oneWayPlatform) {
  return {
    ...createEntity(x, y, size),
    oneWayPlatform
  }
}

function createMovingSolid(x, y, size, oneWayPlatform, vx, vy, minX = null, maxX = null, minY = null, maxY = null) {
  return {
    ...createSolid(x, y, size, oneWayPlatform),
    ...createPrevPosition(x, y),
    ...createVelocity(vx, vy),
    minX: minX ?? x,
    maxX: maxX ?? x,
    minY: minY ?? y,
    maxY: maxY ?? y
  }
}

// TODO: same as createEntity, so remove it?
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
  const player = world.player

  player.x = world.spawn.x
  player.y = world.spawn.y
  player.vx = 0 // TODO: duplicate
  player.vy = 0 // TODO: duplicate
  player.isGrounded = false // TODO: duplicate
  player.standingOn = null
  player.jumpActive = false
  player.jumpBufferTime = 0
  player.coyoteTime = 0
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
    combinedHalfSize,
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
    player: createPlayer(spawn.x, spawn.y, size),
    solids: [
      createSolid(0, 200, size, false),
      createSolid(-100, 180, size, false),
      createSolid(20, 90, size, true),
      createSolid(50, 530, 500, false),
      createSolid(250, 100, size, false)
    ],
    movingSolids: [
      createMovingSolid(-150, 120, 50, false, -60, -60, -200, -100, 60, 130),
      createMovingSolid(200, 150, 50, false, 0, -400, null, null, 100, 300)
    ],
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
    movingSolids: world.movingSolids.map(toBox),
    player: createPlayer(playerX, playerY, world.player.size)
  }
}

function createInputSystem() {
  const arrowLeft = 'ArrowLeft'
  const arrowRight = 'ArrowRight'
  const arrowUp = 'ArrowUp'
  const keyR = 'KeyR'

  const input = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    reset: false
  }

  document.addEventListener('keydown', (e) => {
    if (e.code === arrowLeft) input.left = true
    if (e.code === arrowRight) input.right = true
    if (e.code === keyR) input.reset = true // TODO: make sure it triggers once

    if (e.code === arrowUp) {
      if (!input.jump) input.jumpPressed = true
      input.jump = true
    }
  })

  document.addEventListener('keyup', (e) => {
    if (e.code === arrowLeft) input.left = false
    if (e.code === arrowRight) input.right = false
    if (e.code === keyR) input.reset = false
    if (e.code === arrowUp) input.jump = false
  })

  return { input }
}

function createMovingSolidSystem() {
  return {
    update(world, dt) {
      for (const s of world.movingSolids) {
        s.prevX = s.x
        s.prevY = s.y

        s.x += s.vx * dt
        s.y += s.vy * dt

        if (s.x < s.minX) {
          s.x = s.minX
          s.vx *= -1
        } else if (s.x > s.maxX) {
          s.x = s.maxX
          s.vx *= -1
        }

        if (s.y < s.minY) {
          s.y = s.minY
          s.vy *= -1
        } else if (s.y > s.maxY) {
          s.y = s.maxY
          s.vy *= -1
        }
      }
    }
  }
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
  const jumpVelocity = -450
  const gravity = 800
  const coyoteTime = 0.08 // s // TODO: base it on frames?
  const jumpBufferTime = 0.1 // s // TODO: base it on frames?
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
        p.standingOn = null
        p.jumpBufferTime = 0
        p.coyoteTime = 0
        p.jumpActive = true
      }

      if (!input.jump && p.vy < 0 && p.jumpActive) {
        // TODO: to single line if and also on other places
        p.vy *= jumpCutMultiplier
      }

      p.prevX = p.x
      p.prevY = p.y
      p.vy += gravity * dt // px/s²

      input.jumpPressed = false
    }
  }
}

function createCollisionSystem() {
  const contactTolerance = 1 // pixels // prevents misclassification from precision and timestep error

  return {
    update(world, dt) {
      let blockedLeft = false
      let blockedRight = false
      let blockedTop = false
      let blockedBottom = false

      const p = world.player

      if (p.standingOn) {
        p.x += p.standingOn.x - p.standingOn.prevX
      }

      p.isGrounded = false
      p.standingOn = null // TODO: duplicate setting isGrounded and ground together

      const prevBottom = p.prevY + p.halfSize

      function handlePlayerSolidCollision(player, solid, solidPrevX, solidPrevY, applyPlatformMotion = false) {
        // TODO: solid.halfSize + contactTolerance is duplicate a lot and solid.halfSize - contactTolerance, and maybe more?

        if (solid.oneWayPlatform && prevBottom > solidPrevY - solid.halfSize + contactTolerance) return
        const collision = collideAABB(player, solid)
        if (!collision) return

        // player was above solid (prev)
        if (player.prevY + player.halfSize <= solidPrevY - solid.halfSize + contactTolerance) {
          player.y = solid.y - solid.halfSize - player.halfSize
          blockedBottom = true
          player.isGrounded = true
          player.standingOn = applyPlatformMotion ? solid : null
          player.jumpActive = false
          player.vy = Math.min(player.vy, solid.vy ?? 0)
        }
        // player was below solid (prev)
        else if (player.prevY - player.halfSize >= solidPrevY + solid.halfSize - contactTolerance) {
          player.y = solid.y + collision.combinedHalfSize
          blockedTop = true
          player.vy = 0 // TODO: moving solids that should act as a catapult does cancel that?
        }
        // player was left of solid (prev)
        else if (player.prevX + player.halfSize <= solidPrevX - solid.halfSize + contactTolerance) {
          player.x = solid.x - solid.halfSize - player.halfSize // TODO: duplicate
          blockedRight = true
          player.vx = 0 // TODO: duplicate
        }
        // player was right of solid (prev)
        else if (player.prevX - player.halfSize >= solidPrevX + solid.halfSize - contactTolerance) {
          player.x = solid.x + collision.combinedHalfSize
          blockedLeft = true
          player.vx = 0
        }
        // Fallback: player already overlaps the solid, making collision direction ambiguous
        else if (collision.penetrationX < collision.penetrationY) {
          if (collision.dx > 0) {
            player.x += collision.penetrationX
          } else if (collision.dx < 0 || player.prevX < solidPrevX) {
            player.x -= collision.penetrationX
          } else {
            player.x += collision.penetrationX
          }

          player.vx = 0
        } else {
          if (collision.dy > 0) {
            player.y += collision.penetrationY
          } else if (collision.dy < 0 || player.prevY < solidPrevY) {
            player.y -= collision.penetrationY
            player.isGrounded = true
            player.jumpActive = false // TODO: duplicate with grounded
          } else {
            player.y += collision.penetrationY
          }

          player.vy = 0
        }
      }

      p.x += p.vx * dt
      p.y += p.vy * dt

      // Resolve moving platforms first to preserve accurate collision classification
      for (const s of world.movingSolids) handlePlayerSolidCollision(p, s, s.prevX, s.prevY, true)
      for (const s of world.solids) handlePlayerSolidCollision(p, s, s.x, s.y)

      if ((blockedLeft && blockedRight) || (blockedTop && blockedBottom)) respawnPlayer(world)
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
  const followWeight = 0.2

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
    return Math.max(0, Math.floor(coord * dpr))
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

  function drawBitmapScreen(bitmap, bitmapSize, palette, topLeftX, topLeftY, size) {
    const pixelSize = size / bitmapSize

    for (let row = 0; row < bitmapSize; row++) {
      const rowOffset = row * bitmapSize
      for (let col = 0; col < bitmapSize; col++) {
        const colorIndex = bitmap[rowOffset + col]
        if (colorIndex === 0) continue

        const [r, g, b] = palette[colorIndex]
        fillRectScreen(topLeftX + col * pixelSize, topLeftY + row * pixelSize, pixelSize, pixelSize, r, g, b)
      }
    }
  }

  function drawBitmapWorld(bitmap, bitmapSize, palette, x, y, size, halfSize) {
    const topLeft = worldToScreen(x - halfSize, y - halfSize)
    drawBitmapScreen(bitmap, bitmapSize, palette, topLeft.x, topLeft.y, size)
  }

  function drawTextScreen(text, x, y, pixelScale, palette) {
    const glyphSize = FONT_GLYPH_SIZE * pixelScale
    let cursorX = x

    for (const char of text) {
      drawBitmapScreen(font[char], FONT_GLYPH_SIZE, palette, cursorX, y, glyphSize)
      cursorX += glyphSize + pixelScale
    }
  }

  function clear() {
    data.fill(0)
  }

  function present() {
    context.putImageData(imageData, 0, 0)
  }

  resize()
  window.addEventListener('resize', resize) // resize independent of main loop

  return {
    clear,
    fillSquareWorld,
    fillRectScreen,
    drawBitmapWorld,
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
      for (const s of frameData.movingSolids) {
        renderer.fillSquareWorld(s.x, s.y, s.size, s.halfSize, 50, 50, 50)
      }

      const player = frameData.player
      renderer.drawBitmapWorld(
        playerSprite,
        PLAYER_SPRITE_SIZE,
        playerPalette,
        player.x,
        player.y,
        player.size,
        player.halfSize
      )

      const goal = frameData.goal
      if (frameData.isWon) {
        renderer.fillSquareWorld(goal.x, goal.y, goal.size, goal.halfSize, 255, 215, 0)
        renderer.fillRectScreen(0, 0, frameData.renderWidth, frameData.renderHeight, 0, 0, 0, 180)
        renderer.drawTextScreen('YOU WIN!', 220, 260, 4, fontPalette)
      } else {
        renderer.fillSquareWorld(goal.x, goal.y, goal.size, goal.halfSize, 0, 200, 0)
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

  const canvas = createElement('canvas', parent)
  const context = canvas.getContext('2d')

  const camera = {
    x: 0,
    y: 0
  }

  const world = createWorld()

  const inputSystem = createInputSystem()
  const movingSolidSystem = createMovingSolidSystem()
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
        movingSolidSystem.update(world, deltaS)
        movementSystem.update(world, inputSystem.input, deltaS)
        physicsSystem.update(world, inputSystem.input, deltaS)
        collisionSystem.update(world, deltaS)
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

    requestAnimationFrame(loop)
  }

  requestAnimationFrame(loop)
}
