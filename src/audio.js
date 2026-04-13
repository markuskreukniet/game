export function createAudio() {
  const MIN_GAIN = 0.0001 // TODO: naming

  // TODO: this should only happen after user input, now it also happens before < results in warning
  const context = new AudioContext()
  const masterGain = context.createGain()
  masterGain.gain.value = 0.2
  masterGain.connect(context.destination)

  // TODO: check + naming
  function ensureContext() {
    if (context.state !== 'running') context.resume()
  }

  // TODO: do not use destructuring, also not on other places in this file
  // playTone is good naming
  function playTone({
    frequency = 440,
    duration = 0.08, // TODO: naming. Should become sustain?
    delay = 0, // TODO: naming
    type = 'square',
    volume = 0.6,
    attack = 0.005,
    release = 0.04,
    slideTo = null // TODO: naming
  } = {}) {
    const now = context.currentTime + delay // TODO: naming
    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, now)
    oscillator.connect(gain)
    gain.connect(masterGain)

    // TOD: add const now + duration and with release

    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, now + duration)

    gain.gain.setValueAtTime(MIN_GAIN, now)
    gain.gain.linearRampToValueAtTime(volume, now + attack)
    gain.gain.exponentialRampToValueAtTime(MIN_GAIN, now + duration + release)

    oscillator.start(now)
    oscillator.stop(now + duration + release)
  }

  // TODO: naming
  function jump() {
    ensureContext() // TODO: should happen everytime? same for other functions here
    playTone({frequency: 520, slideTo: 760, duration: 0.07, type: 'square', volume: 0.18})
  }

  // TODO: naming
  function land() {
    ensureContext()
    playTone({frequency: 180, slideTo: 120, duration: 0.04, type: 'square', volume: 0.12})
  }

  // TODO: naming
  function reset() {
    ensureContext()
    playTone({frequency: 300, slideTo: 90, duration: 0.12, type: 'sawtooth', volume: 0.15})
  }

  // TODO: naming
  function win() {
    ensureContext()

    const notes = [523.25, 659.25, 783.99, 1046.5] // TODO: naming
    let delay = 0 // TODO: naming

    // TODO: naming
    for (const note of notes) {
      playTone({frequency: note, duration: 0.09, type: 'square', volume: 0.6, delay, attack: 0.01, release: 0.05})
      delay += 0.09
    }
  }

  return {jump, land, reset, win}
}
