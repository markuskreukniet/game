export function createAudio() {
  const GAIN_EPSILON = 0.0001

  // TODO: reverb limitations:
  // 1. No diffusion
  // 2. Identical feedback for all comb filters
  // 3. No pre-delay
  // 4. No stereo spread
  // (not a problem maybe) 5. Energy can build up at long decay
  // 6. no difference between early reflections and late tail (if it is the correct name)
  // 7. short reverbs could use 3 internal delays instead of always 5

  // TODO: comment
  // The delays should be between 10 ms en 36 ms (10 and 35 is also allowed).
  // When 4, 5, 6, and 7 in step to 10, we stop at 32 ms.
  // When we start at 5, 6, 7, 8, then we go too high
  // it makes more sense to add 4, 6, 5, 7, to make it less math like
  // After the delays we can add 1 to every number.
  // Also it is good te prefer 3 delays low, 1 mid, and 1 high
  // And and there should not be equal steps between the delays
  const EARLY_REFLECTION_DELAYS = [0.011, 0.015, 0.021, 0.026, 0.033] // TODO: naming

  // TODO: this should only happen after user input, now it also happens before < results in warning
  const context = new AudioContext()
  const masterGain = context.createGain()
  masterGain.gain.value = 0.2
  masterGain.connect(context.destination)

  const reverbSend = context.createGain()
  const reverbReturn = context.createGain()

  reverbReturn.gain.value = 0.6
  reverbReturn.connect(masterGain)

  // Feedback delay produces decaying echoes.
  function createCombFilter(delay, feedbackCoefficient) {
    const delayNode = context.createDelay()
    const feedbackGainNode = context.createGain()

    delayNode.delayTime.value = delay
    feedbackGainNode.gain.value = feedbackCoefficient

    delayNode.connect(feedbackGainNode)
    feedbackGainNode.connect(delayNode)

    return delayNode
  }

  // namings are good in whole function // TODO: how does it work?
  function createSchroederReverb(decaySeconds) {
    const reverbIn = context.createGain()
    const reverbOut = context.createGain()
    const combSum = context.createGain()

    for (const delay of [0.03, 0.037, 0.041, 0.043]) /* combFilterDelays */ {
      // Uses Euler's number (e) to compute feedback for RT60 decay; -3 approximates a natural-sounding reverb tail. // TODO: comment
      const combFilterNode = createCombFilter(delay, Math.exp((-3 * delay) / decaySeconds))
      reverbIn.connect(combFilterNode)
      combFilterNode.connect(combSum)
    }

    // highpass first, then lowpass // TODO: comment
    chainFilters(chainFilters(combSum, 'highpass', 250, 4), 'lowpass', 6000, 1).connect(reverbOut)

    return {reverbIn, reverbOut} // TODO: is it needed to send object back?
  }

  function chainFilters(inputNode, type, cutoffHz, filterStageCount) {
    for (let i = 0; i < filterStageCount; i++) {
      const filter = context.createBiquadFilter()
      filter.type = type
      filter.frequency.value = cutoffHz
      filter.Q.value = Math.SQRT1_2

      inputNode.connect(filter)
      inputNode = filter
    }

    return inputNode
  }

  const reverbNode = createSchroederReverb(3)

  reverbSend.connect(reverbNode.reverbIn)
  reverbNode.reverbOut.connect(reverbReturn)

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
      cutoffHz = 1200,
      filterStageCount = 1
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

    chainFilters(oscillator, 'lowpass', cutoffHz, filterStageCount).connect(gain)

    gain.connect(masterGain)

    const sendGain = context.createGain()
    sendGain.gain.value = 0.4

    gain.connect(sendGain)
    sendGain.connect(reverbSend)

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
