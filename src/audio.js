export function createAudio() {
  const GAIN_EPSILON = 0.0001

  // TODO: reverb limitations:
  // 1. Identical feedback for all comb filters
  // 2. short reverbs could use 3 internal delays instead of always 5

  // TODO: this should only happen after user input, now it also happens before < results in warning
  const context = new AudioContext()
  const masterGain = context.createGain()
  masterGain.gain.value = 0.2
  masterGain.connect(context.destination)

  const reverbSend = context.createGain()
  const reverbReturn = context.createGain()

  reverbReturn.gain.value = 0.6
  reverbReturn.connect(masterGain)

  function createDiffuser(delayS, gain) {
    const input = context.createGain()
    const output = context.createGain()

    const feedbackDelay = createFeedbackDelay(delayS, gain)
    const feedforwardGain = context.createGain()

    feedforwardGain.gain.value = -gain

    input.connect(feedbackDelay)
    input.connect(feedforwardGain)

    feedbackDelay.connect(output)
    feedforwardGain.connect(output)
    input.connect(output) // Non-canonical: dry path added; not a true all-pass filter.

    return {input, output}
  }

  // Feedback delay produces decaying echoes.
  function createFeedbackDelay(delayS, gain) {
    const delayNode = context.createDelay()
    const feedbackGainNode = context.createGain()

    delayNode.delayTime.value = delayS
    feedbackGainNode.gain.value = gain

    delayNode.connect(feedbackGainNode)
    feedbackGainNode.connect(delayNode)

    return delayNode
  }

  // Limitation: Long pre-delay values can cause the reverb to become nearly inaudible for short
  // stereo-detuned/panned transient sounds because the sparse feedback network receives too little excitation energy.
  // TODO: still good naming the function?
  function createAlgorithmicReverb(decayS, stereoDelayOffset, pan) {
    // The early reflections range is 10–50 ms (inclusive), and the late reflections range is 50–120 ms (inclusive).
    // At the moment, the reverb uses 5 delay times for early reflections, and 5 delay times for late reflections.
    // For 5 delay times we prefer a maximum range with 3 low, 1 mid, and 1 high.
    // However, when a delay starts at 10 ms or 119 ms, there is almost no room to add or subtract an offset.
    // Subtracting 1 ms from 10 ms or adding 2 ms to 119 ms pushes the value outside the valid range.
    // We should avoid equal intervals between reflections to reduce resonances and ringing artifacts.
    // The early reflections should include a 0 ms delay (not in the array)
    // so they begin immediately after the pre-delay.
    // Delay times can be constructed as a sequence of cumulative sums,
    // where each value is obtained by adding increasing increments
    // (e.g. start at a base value, then add +11, +12, +13, ...).

    // For early reflections, start the second delay at 10 ms,
    // then build the following delays using cumulative sums with increments starting at +12.
    // This gives 10 ms, 22 ms, 35 ms, and 49 ms, which leaves little room for adding or subtracting an offset.
    // Therefore, use increments starting at +11 instead, resulting in 10 ms, 21 ms, 33 ms, and 46 ms.
    // Reordering the increments to 10 + 11 + 13 + 12 makes the spacing less regular (10 ms, 21 ms, 34 ms, and 46 ms).
    // Adding 2 ms to each value then improves the spacing, resulting in 12 ms, 23 ms, 36 ms, and 48 ms.

    // For late reflections, start the first delay at 50 ms,
    // then build the following delays using cumulative sums with increments starting at +16.
    // This gives 50 ms, 66 ms, 83 ms, 101 ms, and 120 ms, which leaves little room for adding or subtracting an offset.
    // Therefore, use increments starting at +15 instead, resulting in 50 ms, 65 ms, 81 ms, 98 ms, and 116 ms.
    // Reordering the increments to 15 + 16 + 17 + 19 + 18 makes the spacing less regular
    // (50 ms, 65 ms, 81 ms, 99 ms, and 116 ms).
    // Adding 2 ms to each value then improves the spacing, resulting in 52 ms, 67 ms, 83 ms, 101 ms, and 118 ms.
    const earlyReflectionDelayTimes = [0.012, 0.023, 0.036, 0.048].map(s => s + stereoDelayOffset)
    const lateReflectionDelayTimes = [0.052, 0.067, 0.083, 0.101, 0.118].map(s => s + stereoDelayOffset)

    const input = context.createGain()
    const output = context.createGain()
    const combSum = context.createGain()
    const earlyReflections = context.createGain()

    // Mix balance: early reflections are slightly louder than the reverb tail to preserve clarity and reduce diffusion
    earlyReflections.gain.value = 1
    combSum.gain.value = 0.8

    // Use ~6–10 ms for diffusion. Avoid matching early/late reflection delays to prevent ringing.
    // Shorter = smoother; too short reduces effectiveness.
    // Gain ~0.6–0.7 gives good diffusion; 0.65 is a safe midpoint.
    const diffuser = createDiffuser(0.007, 0.65)
    input.connect(diffuser.input)

    function addEarlyReflectionTap(delayS, gain) {
      const delayNode = context.createDelay()
      const gainNode = context.createGain()

      delayNode.delayTime.value = delayS
      gainNode.gain.value = gain

      input.connect(delayNode)
      delayNode.connect(gainNode)
      gainNode.connect(earlyReflections)
    }

    addEarlyReflectionTap(0, 0.5)

    for (let i = 0; i < earlyReflectionDelayTimes.length; i++) {
      addEarlyReflectionTap(earlyReflectionDelayTimes[i], Math.exp(-i * 0.2))
    }

    for (const delay of lateReflectionDelayTimes) {
      // Maps decay time to per-delay feedback; -3 shapes a natural decay.
      const feedbackCoefficient = Math.exp((-3 * delay) / decayS)

      const combFilterNode = createFeedbackDelay(delay, feedbackCoefficient)
      diffuser.output.connect(combFilterNode)
      combFilterNode.connect(combSum)
    }

    const reverbMix = context.createGain() // TODO: placement // good naming
    earlyReflections.connect(reverbMix)
    combSum.connect(reverbMix)

    const panner = context.createStereoPanner()
    panner.pan.value = pan

    // Highpass then lowpass: remove low-end buildup before shaping the highs
    chainFilters(chainFilters(reverbMix, 'highpass', 250, 4), 'lowpass', 6000, 1).connect(panner)

    panner.connect(output)

    return {input, output} // TODO: is it needed to send object back?
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

  function connectStereoReverbBus(preDelayS, decayS, node) {
    const preDelay = context.createDelay()
    preDelay.delayTime.value = preDelayS
    reverbSend.connect(preDelay)

    // 4 ms difference (2 * 0.002) is a good balance. 6 ms sounds more like a stereo effect than natural spaciousness.
    // Panning between 0.3 and 0.5 sounds natural without sounding too wide.
    // TODO: not efficient two times createAlgorithmicReverb? use haas effect instead?
    const reverbL = createAlgorithmicReverb(decayS, -0.002, -0.5)
    const reverbR = createAlgorithmicReverb(decayS, 0.002, 0.5)

    preDelay.connect(reverbL.input)
    preDelay.connect(reverbR.input)

    reverbL.output.connect(node)
    reverbR.output.connect(node)
  }

  connectStereoReverbBus(0.02, 2, reverbReturn)

  function ensureRunning() {
    if (context.state === 'suspended') context.resume()
  }

  // TODO: // sub-bass, bass, midrange

  // TODO: do not use destructuring, also not on other places in this file
  // TODO: reusing oscillators instead of creating them for every note is more efficient
  function playTone(options) {
    const {
      frequency = 440,
      sustain = 0.08,
      type = 'square',
      volume = 0.6, // TODO: gain is better naming?
      attack = 0.005,
      release = 0.04,
      startAt,
      targetFrequency = null,
      cutoffHz = 1200,
      filterStageCount = 1,
      numberOfVoices = 2 // TODO: naming
    } = options

    const attackEndAt = startAt + attack
    const releaseStartAt = attackEndAt + sustain
    const stopAt = releaseStartAt + release

    const gain = context.createGain() // TODO: naming
    const oscillatorMix = context.createGain() // TODO: naming

    oscillatorMix.gain.value = 1 / numberOfVoices

    const centerIndex = Math.trunc(numberOfVoices / 2) // TODO: naming
    const evenNumberOfVoices = numberOfVoices % 2 === 0 // TODO: naming

    for (let i = 0; i < numberOfVoices; i++) {
      let offset = i - centerIndex

      if (evenNumberOfVoices && offset >= 0) {
        offset += 1
      }

      const oscillator = context.createOscillator()
      oscillator.type = type
      oscillator.frequency.setValueAtTime(frequency, startAt)
      oscillator.detune.value = offset * 5

      if (targetFrequency !== null) oscillator.frequency.exponentialRampToValueAtTime(targetFrequency, releaseStartAt)

      const panner = context.createStereoPanner() // TODO: naming
      panner.pan.value = offset * 0.2

      oscillator.connect(panner)
      panner.connect(oscillatorMix)

      oscillator.start(startAt)
      oscillator.stop(stopAt)
    }

    gain.gain.setValueAtTime(GAIN_EPSILON, startAt)
    gain.gain.linearRampToValueAtTime(volume, attackEndAt)
    gain.gain.setValueAtTime(volume, releaseStartAt)
    gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, stopAt)

    chainFilters(oscillatorMix, 'lowpass', cutoffHz, filterStageCount).connect(gain)

    gain.connect(masterGain)

    const sendGain = context.createGain()
    sendGain.gain.value = 0.4

    gain.connect(sendGain)
    sendGain.connect(reverbSend)
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

    for (const frequency of [523.25, 659.25, 783.99, 1046.5]) /* noteFrequencies */ {
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
