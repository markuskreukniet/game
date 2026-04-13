import {createAudio} from './audio.js'
import {createElement, createPxSize} from './dom.js'
import {
  backdropColor,
  FAR_LAYER_SPRITE_SIZE,
  farLayerCloudPalette,
  farLayerCloudSprite,
  font,
  FONT_GLYPH_SIZE,
  fontPalette,
  FRONT_LAYER_SPRITE_SIZE,
  MID_LAYER_SPRITE_SIZE,
  midLayerHillPalette,
  midLayerHillSprite,
  oneWayPlatformPalette,
  oneWayPlatformSprite,
  platformPalette,
  platformSprite,
  oneWayTerrainPalette,
  oneWayTerrainSprite,
  playerPalette,
  playerSprite,
  terrainPalette,
  terrainSprite
} from './renderAssets.js'

// TODO: rename bitmap to sprite

function flipBitmapHorizontally(bitmap, bitmapSize) {
  const flipped = new Uint8Array(bitmap.length)
  const lastColumnIndex = bitmapSize - 1

  for (let row = 0; row < bitmapSize; row++) {
    const rowOffset = row * bitmapSize

    for (let col = 0; col < bitmapSize; col++) {
      flipped[rowOffset + col] = bitmap[rowOffset + (lastColumnIndex - col)]
    }
  }

  return flipped
}

const playerSpriteFlipped = flipBitmapHorizontally(playerSprite, FRONT_LAYER_SPRITE_SIZE)

const MID_LAYER_SPRITE_RENDER_SIZE = MID_LAYER_SPRITE_SIZE * 5
const FAR_LAYER_SPRITE_RENDER_SIZE = FAR_LAYER_SPRITE_SIZE * 13

// TODO: should there be a version that accepts a halfSize? Maybe good if there are multiple of the same size
function createEntity(x, y, size) {
  return {x, y, size, halfSize: size / 2}
}

function createPrevPosition(prevX, prevY) {
  return {prevX, prevY}
}

function createVelocity(vx, vy) {
  return {
    vx, // px/s
    vy // px/s
  }
}

function createPlayer(x, y, size, facingRight) {
  return {
    ...createEntity(x, y, size),
    ...createPrevPosition(x, y),
    ...createVelocity(0, 0),
    isGrounded: false, // TODO: should start on false? or from param?
    standingOn: null,
    jumpActive: false,
    jumpBufferTime: 0,
    coyoteTime: 0,
    facingRight
  }
}

function createSolid(x, y, size, oneWayPlatform) {
  return {...createEntity(x, y, size), oneWayPlatform}
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

function snapshotWorld(world) {
  return {
    player: {x: world.player.x, y: world.player.y},
    movingSolids: world.movingSolids.map(solid => ({x: solid.x, y: solid.y}))
  }
}

function respawnPlayer(world, audio) {
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

  audio.reset()
}

function collideAABB(a, b) {
  const combinedHalfSize = a.halfSize + b.halfSize

  const dx = a.x - b.x
  const dy = a.y - b.y

  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // TODO: to single line if and also on other places
  if (absDx >= combinedHalfSize || absDy >= combinedHalfSize) {
    return null
  }

  return {dx, dy, combinedHalfSize, penetrationX: combinedHalfSize - absDx, penetrationY: combinedHalfSize - absDy}
}

function interpolate(start, end, alpha) {
  return start + (end - start) * alpha
}

function resetWorld(world, audio) {
  world.isWon = false
  respawnPlayer(world, audio)
}

function createWorld() {
  const width = 800
  const size = 50
  const maxX = width / 2
  const spawn = {x: 0, y: -200}

  return {
    width,
    height: 600,
    maxX,
    minX: -maxX,
    spawn,
    killPlaneY: 900,
    player: createPlayer(spawn.x, spawn.y, size, true),
    solids: [
      createSolid(0, 200, size, false),
      createSolid(-100, 180, size, false),
      createSolid(20, 90, size, true),
      createSolid(50, 530, 600, false),
      createSolid(250, 100, size, false)
    ],
    movingSolids: [
      createMovingSolid(-150, 120, 50, false, -60, -60, -200, -100, 60, 130),
      createMovingSolid(200, 150, 50, false, 0, -400, null, null, 100, 300),
      createMovingSolid(350, 100, 50, true, 0, -100, null, null, 50, 150)
    ],
    goal: createEntity(100, 150, size),
    isWon: false
  }
}

function buildFrameData(previous, current, alpha, world) {
  const goal = world.goal
  const playerX = interpolate(previous.player.x, current.player.x, alpha)
  const playerY = interpolate(previous.player.y, current.player.y, alpha)

  return {
    renderWidth: world.width,
    renderHeight: world.height,
    isWon: world.isWon,
    goal: createEntity(goal.x, goal.y, goal.size),
    solids: world.solids.map(solid => createSolid(solid.x, solid.y, solid.size, solid.oneWayPlatform)),
    movingSolids: world.movingSolids.map((solid, index) => {
      const previousSolid = previous.movingSolids[index]

      return createSolid(
        interpolate(previousSolid.x, solid.x, alpha),
        interpolate(previousSolid.y, solid.y, alpha),
        solid.size,
        solid.oneWayPlatform
      )
    }),
    player: createPlayer(playerX, playerY, world.player.size, world.player.facingRight)
  }
}

function createInputSystem() {
  const arrowLeft = 'ArrowLeft'
  const arrowRight = 'ArrowRight'
  const arrowUp = 'ArrowUp'
  const keyR = 'KeyR'

  const input = {left: false, right: false, jump: false, jumpPressed: false, reset: false}

  document.addEventListener('keydown', e => {
    if (e.code === arrowLeft) input.left = true
    if (e.code === arrowRight) input.right = true
    if (e.code === keyR) input.reset = true // TODO: make sure it triggers once

    if (e.code === arrowUp) {
      if (!input.jump) input.jumpPressed = true
      input.jump = true
    }
  })

  document.addEventListener('keyup', e => {
    if (e.code === arrowLeft) input.left = false
    if (e.code === arrowRight) input.right = false
    if (e.code === keyR) input.reset = false
    if (e.code === arrowUp) input.jump = false
  })

  return {input}
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
      const player = world.player
      const acceleration = player.isGrounded ? 1500 : 500 // px/s²

      if (input.left && !input.right) {
        player.vx -= acceleration * dt
        player.facingRight = false
      } else if (input.right && !input.left) {
        player.vx += acceleration * dt
        player.facingRight = true
      }

      player.vx -= player.vx * (player.isGrounded ? 15 : 2) * dt

      if (player.vx > maxRightwardSpeed) {
        player.vx = maxRightwardSpeed
      } else if (player.vx < maxLeftwardSpeed) {
        player.vx = maxLeftwardSpeed
      }
    }
  }
}

function createPhysicsSystem(audio) {
  // TODO: these consts to a config
  const jumpVelocity = -450
  const gravity = 800
  const coyoteTime = 0.08 // s
  const jumpBufferTime = 0.1 // s
  const maxFallSpeed = 700
  const fallGravityScale = 1.6
  const earlyReleaseGravityScale = 1.6

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

        audio.jump()
      }

      let gravityScale = 1
      if (p.vy > 0) {
        gravityScale = fallGravityScale
      } else if (!input.jump && p.vy < 0 && p.jumpActive) {
        gravityScale = earlyReleaseGravityScale
      }

      p.vy += gravity * gravityScale * dt // px/s² // TODO: still px/s²?
      p.vy = Math.min(p.vy, maxFallSpeed)

      if (p.vy >= 0) {
        p.jumpActive = false
      }

      p.prevX = p.x
      p.prevY = p.y

      input.jumpPressed = false
    }
  }
}

function createCollisionSystem(audio) {
  const contactTolerance = 1 // pixels // prevents misclassification from precision and timestep error

  return {
    update(world, dt) {
      let blockedLeft = false
      let blockedRight = false
      let blockedTop = false
      let blockedBottom = false

      const p = world.player
      const wasGrounded = p.isGrounded

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

          if (!wasGrounded) audio.land()
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

            if (!wasGrounded) audio.land()
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

      if ((blockedLeft && blockedRight) || (blockedTop && blockedBottom)) respawnPlayer(world, audio)
    }
  }
}

function createGoalSystem(audio) {
  return {
    update(world) {
      if (!world.isWon && collideAABB(world.player, world.goal)) {
        world.isWon = true
        audio.win()
      }
    }
  }
}

function createWorldConstraintSystem(world, audio) {
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
        respawnPlayer(world, audio)
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
    return {x: x - camera.x + world.maxX, y: y - camera.y + screenCenterY}
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

  function drawBackground() {
    fillRectScreen(0, world.height * 0.65, world.width, world.height * 0.35, 120, 200, 120) // TODO: check. don't use alpha?

    const midLayerOffset = (camera.x * 0.2) % 200
    const farLayerOffset = (camera.x * 0.1) % 300

    drawBitmapScreen(
      midLayerHillSprite,
      MID_LAYER_SPRITE_SIZE,
      midLayerHillPalette,
      40 - midLayerOffset,
      260,
      MID_LAYER_SPRITE_RENDER_SIZE
    )
    drawBitmapScreen(
      midLayerHillSprite,
      MID_LAYER_SPRITE_SIZE,
      midLayerHillPalette,
      220 - midLayerOffset,
      240,
      MID_LAYER_SPRITE_RENDER_SIZE
    )
    drawBitmapScreen(
      midLayerHillSprite,
      MID_LAYER_SPRITE_SIZE,
      midLayerHillPalette,
      500 - midLayerOffset,
      250,
      MID_LAYER_SPRITE_RENDER_SIZE
    )

    drawBitmapScreen(
      farLayerCloudSprite,
      FAR_LAYER_SPRITE_SIZE,
      farLayerCloudPalette,
      100 - farLayerOffset,
      80,
      FAR_LAYER_SPRITE_RENDER_SIZE
    )
    drawBitmapScreen(
      farLayerCloudSprite,
      FAR_LAYER_SPRITE_SIZE,
      farLayerCloudPalette,
      300 - farLayerOffset,
      120,
      FAR_LAYER_SPRITE_RENDER_SIZE
    )
    drawBitmapScreen(
      farLayerCloudSprite,
      FAR_LAYER_SPRITE_SIZE,
      farLayerCloudPalette,
      600 - farLayerOffset,
      60,
      FAR_LAYER_SPRITE_RENDER_SIZE
    )
  }

  function clear() {
    for (let i = 0; i < data.length; i += 4) {
      data[i] = backdropColor[0]
      data[i + 1] = backdropColor[1]
      data[i + 2] = backdropColor[2]
      data[i + 3] = 255
    }
  }

  function present() {
    context.putImageData(imageData, 0, 0)
  }

  resize()
  window.addEventListener('resize', resize) // resize independent of main loop

  return {clear, drawBackground, fillSquareWorld, fillRectScreen, drawBitmapWorld, drawTextScreen, present}
}

function createRenderSystem(renderer) {
  return {
    render(frameData) {
      renderer.clear()
      renderer.drawBackground()

      for (const s of frameData.solids) {
        if (s.oneWayPlatform) {
          renderer.drawBitmapWorld(
            oneWayTerrainSprite,
            FRONT_LAYER_SPRITE_SIZE,
            oneWayTerrainPalette,
            s.x,
            s.y,
            s.size,
            s.halfSize
          )
        } else {
          renderer.drawBitmapWorld(terrainSprite, FRONT_LAYER_SPRITE_SIZE, terrainPalette, s.x, s.y, s.size, s.halfSize)
        }
      }

      for (const s of frameData.movingSolids) {
        if (s.oneWayPlatform) {
          renderer.drawBitmapWorld(
            oneWayPlatformSprite,
            FRONT_LAYER_SPRITE_SIZE,
            oneWayPlatformPalette,
            s.x,
            s.y,
            s.size,
            s.halfSize
          )
        } else {
          renderer.drawBitmapWorld(
            platformSprite,
            FRONT_LAYER_SPRITE_SIZE,
            platformPalette,
            s.x,
            s.y,
            s.size,
            s.halfSize
          )
        }
      }

      const player = frameData.player
      renderer.drawBitmapWorld(
        player.facingRight ? playerSprite : playerSpriteFlipped,
        FRONT_LAYER_SPRITE_SIZE,
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

  const camera = {x: 0, y: 0}

  const world = createWorld()
  const audio = createAudio()

  const inputSystem = createInputSystem()
  const movingSolidSystem = createMovingSolidSystem()
  const movementSystem = createMovementSystem()
  const physicsSystem = createPhysicsSystem(audio)
  const collisionSystem = createCollisionSystem(audio)
  const goalSystem = createGoalSystem(audio)
  const worldConstraintSystem = createWorldConstraintSystem(world, audio)
  const cameraSystem = createCameraSystem(camera)
  const renderer = createRenderer(canvas, context, world, camera)
  const renderSystem = createRenderSystem(renderer)

  let last = performance.now()
  let accumulator = 0
  let renderAccumulator = 0

  let currentSnapshot = snapshotWorld(world)
  let previousSnapshot = currentSnapshot // TODO: is previousSnapshot usefull? Is it not the same as world?

  function loop(now) {
    let deltaMs = now - last
    last = now

    if (deltaMs > maxDeltaMs) deltaMs = maxDeltaMs

    accumulator += deltaMs
    renderAccumulator += deltaMs

    while (accumulator >= targetFrameMs) {
      previousSnapshot = currentSnapshot

      if (world.isWon && inputSystem.input.reset) {
        resetWorld(world, audio)
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
