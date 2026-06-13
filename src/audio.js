import {createAudioAssets} from './audioAssets.js'

export async function createAudio() {
  // TODO: this should only happen after user input, now it also happens before < results in warning
  const context = new AudioContext()
  const BPM = 120

  const audioAssets = await createAudioAssets(context, BPM)
  const {noteFrequencies, percussionBuffers} = audioAssets

  const GAIN_EPSILON = 0.0001

  const BEAT = 60 / BPM // QUARTER_NOTE
  const WHOLE_NOTE = BEAT * 4
  const HALF_NOTE = BEAT * 2
  const EIGHTH_NOTE = BEAT / 2
  const SIXTEENTH_NOTE = BEAT / 4
  const THIRTY_SECOND_NOTE = BEAT / 8
  const SIXTY_FOURTH_NOTE = BEAT / 16
  const NOTE_128 = BEAT / 32
  const NOTE_256 = BEAT / 64
  const WHOLE_NOTE_PLAY_DURATION = WHOLE_NOTE - NOTE_256
  const HALF_NOTE_PLAY_DURATION = HALF_NOTE - NOTE_256
  const EIGHTH_NOTE_PLAY_DURATION = EIGHTH_NOTE - NOTE_256
  const SIXTEENTH_NOTE_PLAY_DURATION = SIXTEENTH_NOTE - NOTE_256
  const SWUNG_SIXTEENTH_NOTE_PLAY_DURATION = SIXTEENTH_NOTE - NOTE_128 - NOTE_256

  const WHITE_NOISE_BUFFER = createWhiteNoiseBuffer()

  // TODO: naming
  const CHORD_PROGRESSION = [
    ['E3', 'G3', 'B3'],
    ['C3', 'E3', 'G3'],
    ['G3', 'B3', 'D4'],
    ['D3', 'Fs3', 'A3']
  ]

  const masterGain = context.createGain()
  masterGain.gain.value = 0.2
  masterGain.connect(context.destination)

  const reverbSend = context.createGain()
  const reverbReturn = context.createGain()

  reverbReturn.gain.value = 0.6
  reverbReturn.connect(masterGain)

  function createWhiteNoiseBuffer() {
    const sampleRate = context.sampleRate
    const buffer = context.createBuffer(1, sampleRate, sampleRate)
    const data = buffer.getChannelData(0)

    for (let i = 0; i < sampleRate; i++) {
      data[i] = Math.random() * 2 - 1
    }

    return buffer
  }

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

  // TODO: check with namings
  function createMidSideSplit(input) {
    const splitter = context.createChannelSplitter(2)

    input.connect(splitter)

    // MID = (L + R) * 0.5
    const midL = context.createGain()
    const midR = context.createGain()
    const mid = context.createGain()

    midL.gain.value = 0.5
    midR.gain.value = 0.5

    splitter.connect(midL, 0)
    splitter.connect(midR, 1)

    midL.connect(mid)
    midR.connect(mid)

    // SIDE = (L - R) * 0.5
    const sideL = context.createGain()
    const sideR = context.createGain()
    const side = context.createGain()

    sideL.gain.value = 0.5
    sideR.gain.value = -0.5

    splitter.connect(sideL, 0)
    splitter.connect(sideR, 1)

    sideL.connect(side)
    sideR.connect(side)

    return {mid, side}
  }

  // TODO: naming createReverbBranch, earlyReflectionDelayTimes, and lateReflectionDelayTimes
  function createReverbBranch(decayS, earlyReflectionDelayTimes, lateReflectionDelayTimes, pan) {
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
    const diffuser = createDiffuser(0.01, 0.65)
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

  // TODO: Reverb limitations: short reverbs could use, for example, 3 internal delays instead of always 5
  function connectStereoReverbBus(preDelayS, decayS, node) {
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

    // Prime-number delay times can avoid repeating intervals and reduce ringing.
    // The diffuser delay (6–10 ms) should also avoid matching these intervals.

    // For early reflections, start at 10 ms,
    // then build the following delays using cumulative sums with increments starting at +9.
    // This gives 10 ms, 19 ms, 29 ms, and 40 ms, which is not ideal because 10 ms divides 40 ms.
    // Therefore, it becomes 11 ms, 20 ms, 30 ms, and 41 ms for the left side delays.
    // Reordering the increments to 11 + 9 + 11 + 10 makes the spacing less regular (11 ms, 20 ms, 31 ms, and 41 ms).

    // Add 4 ms to each left delay to construct the right side delays, resulting in 15 ms, 24 ms, 35 ms, and 45 ms.
    // These right side delays are not ideal because 15 ms divides 45 ms.
    // Therefore, add 1 ms to all left and right delays.
    // The left delays become 12 ms, 21 ms, 32 ms, and 42 ms, and the right become 16 ms, 25 ms, 36 ms, and 46 ms.
    // The mid delays are constructed by choosing a delay after each right delay and before the next left delay,
    // and spacing them as far apart as possible, resulting in 18 ms, 28 ms, 39 ms, and 49 ms.

    // The late reflections are constructed from prime numbers.

    // relevant prime numbers:
    // 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113

    const leftEarlyReflectionDelays = [0.012, 0.021, 0.032, 0.042]
    const rightEarlyReflectionDelays = [0.016, 0.025, 0.036, 0.046]
    const sideEarlyReflectionDelays = [0.018, 0.028, 0.039, 0.049]

    const leftLateReflectionDelays = [0.053, 0.067, 0.079, 0.097, 0.109]
    const rightLateReflectionDelays = [0.059, 0.071, 0.083, 0.101, 0.113]
    const sideLateReflectionDelays = [0.061, 0.073, 0.089, 0.103, 0.107]

    const midPreDelayNode = context.createDelay()
    midPreDelayNode.delayTime.value = preDelayS

    const sidePreDelayNode = context.createDelay() // TODO: does it makes sense to have two context.createDelay?
    sidePreDelayNode.delayTime.value = preDelayS

    const midSideChannels = createMidSideSplit(reverbSend)
    midSideChannels.mid.connect(midPreDelayNode)
    midSideChannels.side.connect(sidePreDelayNode)

    // 4 ms difference (2 * 0.002) is a good balance. 6 ms sounds more like a stereo effect than natural spaciousness.
    // Panning between 0.3 and 0.5 sounds natural without sounding too wide.
    const leftReverbBranch = createReverbBranch(decayS, leftEarlyReflectionDelays, leftLateReflectionDelays, -0.5)
    const rightReverbBranch = createReverbBranch(decayS, rightEarlyReflectionDelays, rightLateReflectionDelays, 0.5)
    const sideReverbBranch = createReverbBranch(decayS, sideEarlyReflectionDelays, sideLateReflectionDelays, 0)

    midPreDelayNode.connect(leftReverbBranch.input)
    midPreDelayNode.connect(rightReverbBranch.input)
    sidePreDelayNode.connect(sideReverbBranch.input)

    leftReverbBranch.output.connect(node)
    rightReverbBranch.output.connect(node)
    sideReverbBranch.output.connect(node)
  }

  connectStereoReverbBus(0.02, 2, reverbReturn)

  function ensureRunning() {
    if (context.state === 'suspended') context.resume()
  }

  // TODO: check + namings
  function playChord(noteNames, startAt, attack, sustain) {
    const volume = 0.3 / noteNames.length

    for (const noteName of noteNames) {
      playTone({
        frequency: noteFrequencies[noteName],
        sustain,
        type: 'sawtooth',
        volume,
        startAt,
        attack,
        release: 0.08,
        cutoffHz: 1800,
        filterStageCount: 2,
        numberOfVoices: 3
      })
    }
  }

  // TODO: check + namings
  function playProgression() {
    ensureRunning()

    const attack = 0.02
    const sustain = WHOLE_NOTE_PLAY_DURATION - attack
    const now = context.currentTime
    let offset = 0

    for (const chord of CHORD_PROGRESSION) {
      playChord(chord, now + offset, attack, sustain)
      offset += WHOLE_NOTE
    }
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

  function playQuarterNoteBassDrums(hitCount) {
    let startAt = context.currentTime

    for (let i = 0; i < hitCount; i++) {
      playBassDrum(startAt)
      startAt += BEAT
    }
  }

  function playBassDrum(startAt) {
    const bufferSource = context.createBufferSource()

    bufferSource.buffer = percussionBuffers.bassDrum
    bufferSource.connect(masterGain)
    bufferSource.start(startAt)

    bufferSource.onended = () => {
      bufferSource.disconnect()
    }
  }

  // TODO: only check if EIGHTH_NOTE and EIGHTH_NOTE_PLAY_DURATION is correct. TODO: it should be stereo with haas?
  function playOffbeatHiHats(hitCount) {
    let startAt = context.currentTime + EIGHTH_NOTE
    const sustain = (EIGHTH_NOTE_PLAY_DURATION / 8) * 7 // TODO: duplicate. TODO is correct?

    for (let i = 0; i < hitCount; i++) {
      playHiHat(startAt, startAt + EIGHTH_NOTE_PLAY_DURATION, startAt + sustain, 11000, 0.6, 0.598, 0.134, 1, 0.9, 0)
      startAt += BEAT
    }
  }

  function playSyncopatedHiHats(hitCount) {
    let startAt = context.currentTime
    const sustain = (SIXTEENTH_NOTE_PLAY_DURATION / 8) * 7 // TODO: duplicate <<< hats is eigenlijk * 6, kick iets meer
    const diff = (SIXTEENTH_NOTE_PLAY_DURATION / 8) * 7 - (SWUNG_SIXTEENTH_NOTE_PLAY_DURATION / 8) * 7 // TODO: naming

    // TODO: is it efficient?
    for (let i = 0; i < hitCount; i++) {
      if (i % 4 !== 2 || i < 2) {
        let pan = -0.4 // TODO: is 0.4 correct?
        let swungStartAt = startAt
        let swungReleaseAt = startAt + sustain
        if (i % 2 === 0) {
          pan = Math.abs(pan)
          swungStartAt += NOTE_128
          swungReleaseAt -= diff
        }

        playHiHat(
          swungStartAt,
          startAt + SIXTEENTH_NOTE_PLAY_DURATION,
          swungReleaseAt,
          9000,
          0.4,
          0.7,
          0.1,
          0.9,
          0.8,
          pan
        )
      }
      startAt += SIXTEENTH_NOTE
    }
  }

  function playHiHat(
    startAt,
    endAt,
    releaseAt,
    bandpassFrequency,
    bandpassQ,
    whiteNoiseGainValue,
    oscillatorsGainValue,
    transientGain,
    sustainGain,
    pan
  ) {
    const bufferSource = context.createBufferSource()
    bufferSource.buffer = WHITE_NOISE_BUFFER

    const highpass = context.createBiquadFilter() // TODO: duplicate
    highpass.type = 'highpass'
    highpass.frequency.value = 6000

    const bandpass = context.createBiquadFilter()
    bandpass.type = 'bandpass'
    bandpass.frequency.value = bandpassFrequency
    bandpass.Q.value = bandpassQ

    const panner = context.createStereoPanner()
    panner.pan.value = pan

    const whiteNoiseGain = context.createGain()
    whiteNoiseGain.gain.value = whiteNoiseGainValue

    const gain = context.createGain()
    gain.gain.setValueAtTime(GAIN_EPSILON, startAt)
    gain.gain.linearRampToValueAtTime(transientGain, startAt + 0.003) // TODO: duplicate
    gain.gain.linearRampToValueAtTime(sustainGain, startAt + 0.006) // TODO: duplicate
    gain.gain.setValueAtTime(sustainGain, releaseAt) // TODO: duplicate
    gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, endAt)

    const oscillatorsGain = context.createGain()
    oscillatorsGain.gain.value = oscillatorsGainValue

    for (const frequency of [6007, 8009, 10007]) /* prime numbers */ {
      const oscillator = context.createOscillator()

      oscillator.type = 'square'
      oscillator.frequency.value = frequency
      oscillator.connect(oscillatorsGain)
      oscillator.start(startAt)
      oscillator.stop(endAt)

      oscillator.onended = () => oscillator.disconnect()
    }

    bufferSource.connect(whiteNoiseGain)
    whiteNoiseGain.connect(highpass)
    oscillatorsGain.connect(highpass)
    highpass.connect(bandpass)
    bandpass.connect(gain)
    gain.connect(panner)
    panner.connect(masterGain)

    bufferSource.start(startAt)
    bufferSource.stop(endAt)

    bufferSource.onended = () => {
      bufferSource.disconnect()
      highpass.disconnect()
      bandpass.disconnect()
      gain.disconnect()
      panner.disconnect()
    }
  }

  function goal() {
    ensureRunning()

    const attack = 0.01
    const sustain = SIXTEENTH_NOTE_PLAY_DURATION - attack
    const now = context.currentTime
    let offset = 0

    for (const frequency of [noteFrequencies.C5, noteFrequencies.E5, noteFrequencies.G5, noteFrequencies.C6]) {
      playTone({frequency, sustain, type: 'square', volume: 0.6, startAt: now + offset, attack, release: 0.05})
      offset += SIXTEENTH_NOTE + NOTE_256
    }
  }

  return {goal, jump, land, respawn}
}
