export function createAudio() {
  const GAIN_EPSILON = 0.0001

  // TODO: reverb limitations:
  // 1. No diffusion
  // 2. Identical feedback for all comb filters
  // 3. No stereo spread
  // (not a problem maybe) 4. Energy can build up at long decay
  // 5. no difference between early reflections and late tail (if it is the correct name)
  // 6. short reverbs could use 3 internal delays instead of always 5

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

  function createSchroederReverb(preDelaySeconds, decaySeconds) {
    // TODO: comment
    // The delays should be between 10 ms and 50 ms (10 and 50 is also allowed).
    // When we add 7, 8, 9, 10 at 10, we have a better range than we would start with 6 or 8.
    // Adding like 7, 8, 10, 9 sounds better (less like math).
    // We can add 3 to every number to space it better between 10 and 50 ms.
    // Also, the problem of starting at 10 and a 10 interval is then gone (we should avoid equal intervals).
    // Plus, it is good te prefer 3 delays low, 1 mid, and 1 high.
    const earlyReflectionDelays = [0.013, 0.02, 0.028, 0.038, 0.047]

    // TODO: comment
    // The delays should be between 10 ms and 120 ms (10 and 120 is also allowed).
    // When we add 16, 17, 18, 19 at 50, we have the best range from 50 to 120, but we can't randomize it/can't add stereo offset
    // Adding subtracting 1 from 50 or adding 1 to 120 makes a delay to short or too long.
    // When we add 15, 16, 17, 18 at 50, we have a range that we can randomize.
    // Adding like 15, 16, 18, 17 sounds better (less like math).
    // We can add 2 to every number to space it better between 50 and 120 ms.
    // Plus, it is good te prefer 3 delays low, 1 mid, and 1 high.
    const lateReflectionDelays = [0.052, 0.067, 0.083, 0.101, 0.118]

    const reverbIn = context.createGain()
    const reverbOut = context.createGain()
    const combSum = context.createGain()
    const earlyReflections = context.createGain()
    const preDelayNode = context.createDelay()

    // Early reflections are slightly brighter // TODO: comment
    earlyReflections.gain.value = 1
    combSum.gain.value = 0.8

    preDelayNode.delayTime.value = Math.max(0, preDelaySeconds - earlyReflectionDelays[0])
    reverbIn.connect(preDelayNode)

    for (let i = 0; i < earlyReflectionDelays.length; i++) {
      const delayNode = context.createDelay()
      const gainNode = context.createGain()

      delayNode.delayTime.value = earlyReflectionDelays[i]
      gainNode.gain.value = Math.exp(-i * 0.2)

      preDelayNode.connect(delayNode)
      delayNode.connect(gainNode)
      gainNode.connect(earlyReflections)
    }

    for (const delay of lateReflectionDelays) {
      // Maps decay time to per-delay feedback; -3 shapes a natural decay.
      const feedbackCoefficient = Math.exp((-3 * delay) / decaySeconds)

      const combFilterNode = createCombFilter(delay, feedbackCoefficient)
      preDelayNode.connect(combFilterNode)
      combFilterNode.connect(combSum)
    }

    const reverbSum = context.createGain() // TODO: naming + placement
    earlyReflections.connect(reverbSum)
    combSum.connect(reverbSum)

    // highpass first, then lowpass // TODO: comment
    chainFilters(chainFilters(reverbSum, 'highpass', 250, 4), 'lowpass', 6000, 1).connect(reverbOut)

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

  const reverbNode = createSchroederReverb(1, 2)

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
