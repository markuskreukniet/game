export function createAudio() {
  const GAIN_EPSILON = 0.0001

  // TODO: this should only happen after user input, now it also happens before < results in warning
  const context = new AudioContext()
  const masterGain = context.createGain()
  masterGain.gain.value = 0.2
  masterGain.connect(context.destination)

  function ensureRunning() {
    if (context.state === 'suspended') context.resume()
  }

  // TODO: do not use destructuring, also not on other places in this file
  function playTone(options) {
    const {
      frequency = 440,
      sustain = 0.08,
      type = 'square',
      volume = 0.6,
      attack = 0.005,
      release = 0.04,
      startAt,
      targetFrequency = null,
      filterFrequency = 1200, // TODO: naming
      doFilter = false // TODO: naming + does it makes sense?
    } = options

    const attackEndAt = startAt + attack
    const releaseStartAt = attackEndAt + sustain
    const stopAt = releaseStartAt + release

    const oscillator = context.createOscillator()
    const gain = context.createGain()

    oscillator.type = type
    oscillator.frequency.setValueAtTime(frequency, startAt)

    if (targetFrequency !== null) oscillator.frequency.exponentialRampToValueAtTime(targetFrequency, releaseStartAt)

    gain.gain.setValueAtTime(GAIN_EPSILON, startAt)
    gain.gain.linearRampToValueAtTime(volume, attackEndAt)
    gain.gain.setValueAtTime(volume, releaseStartAt)
    gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, stopAt)

    if (doFilter) {
      const filter = context.createBiquadFilter()
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(filterFrequency, startAt)
      filter.Q.setValueAtTime(Math.SQRT1_2, startAt)

      oscillator.connect(filter)
      filter.connect(gain)
    } else oscillator.connect(gain)

    gain.connect(masterGain)

    oscillator.start(startAt)
    oscillator.stop(stopAt)
  }

  function jump() {
    ensureRunning() // TODO: should happen every time? same for other functions here
    playTone({
      frequency: 520,
      targetFrequency: 760,
      sustain: 0.07,
      type: 'square',
      volume: 0.18,
      startAt: context.currentTime
    })
  }

  function land() {
    ensureRunning()
    playTone({
      frequency: 180,
      targetFrequency: 120,
      sustain: 0.04,
      type: 'square',
      volume: 0.12,
      startAt: context.currentTime
    })
  }

  function respawn() {
    ensureRunning()
    playTone({
      frequency: 300,
      targetFrequency: 90,
      sustain: 0.12,
      type: 'sawtooth',
      volume: 0.15,
      startAt: context.currentTime
    })
  }

  function goal() {
    ensureRunning()

    const now = context.currentTime
    let offset = 0

    // noteFrequencies
    for (const frequency of [523.25, 659.25, 783.99, 1046.5]) {
      playTone({
        frequency,
        sustain: 0.09,
        type: 'square',
        volume: 0.6,
        startAt: now + offset,
        attack: 0.01,
        release: 0.05
      })
      offset += 0.09
    }
  }

  return {goal, jump, land, respawn}
}
