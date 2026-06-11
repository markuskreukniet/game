const GAIN_EPSILON = 0.0001
const MIN_FREQUENCY = 35
const MAX_FREQUENCY = 20000
const MIN_TREBLE_FREQUENCY = 6000
const MAX_GAIN = 1
const ONE_MS_IN_SECONDS = 0.001
const TWO_MS_IN_SECONDS = 0.002

export async function createAudioAssets(context, bpm) {
  const noteFrequencies = createNoteFrequencies()
  const noteTimings = createNoteTimings(bpm)
  const hiHatBufferPromises = createHiHatBufferPromises(context, createWhiteNoiseBuffer(context), noteTimings)

  const [bassDrum, openHiHat, closedHiHatLeft, closedHiHatRight, swungClosedHiHatLeft, swungClosedHiHatRight] =
    await Promise.all([
      createBassDrumBuffer(
        context,
        0,
        noteTimings.eightNotePlayDuration,
        noteFrequencies.Ds10,
        noteFrequencies.B3,
        MAX_GAIN
      ),
      hiHatBufferPromises.openHiHatBufferPromise,
      hiHatBufferPromises.closedHiHatLeftBufferPromise,
      hiHatBufferPromises.closedHiHatRightBufferPromise,
      hiHatBufferPromises.swungClosedHiHatLeftBufferPromise,
      hiHatBufferPromises.swungClosedHiHatRightBufferPromise
    ])

  return {
    noteTimings,
    noteFrequencies,
    constants: {
      gainEpsilon: GAIN_EPSILON,
      minFrequency: MIN_FREQUENCY,
      maxFrequency: MAX_FREQUENCY,
      maxGain: MAX_GAIN,
      minTrebleFrequency: MIN_TREBLE_FREQUENCY
    },
    percussionBuffers: {
      bassDrum,
      openHiHat,
      closedHiHatLeft,
      closedHiHatRight,
      swungClosedHiHatLeft,
      swungClosedHiHatRight
    }
  }
}

function createHiHatBufferPromises(context, whiteNoiseBuffer, noteTimings) {
  const openHiHatBandpassFrequency = 9001 /* prime number */
  const hiHatOscillatorsGain = 0.1
  const openHiHatOscillatorFrequencies = [
    MIN_TREBLE_FREQUENCY,
    calculateMiddleFrequency(MIN_TREBLE_FREQUENCY, openHiHatBandpassFrequency),
    openHiHatBandpassFrequency
  ]
  const hiHatWhiteNoiseGain = roundToThreeDecimals(1 - hiHatOscillatorsGain * openHiHatOscillatorFrequencies.length)

  const openHiHatTransientGain = MAX_GAIN
  const closedHiHatBandpassFrequency = 11003 /* prime number */
  const closedHiHatTransientGain = 0.9
  const closedHiHatSustainGain = calculateSustainGain(closedHiHatTransientGain)
  const closedHiHatBandpassQ = calculateRoundedBandpassQForMaxFrequency(closedHiHatBandpassFrequency)
  const closedHiHatOscillatorFrequencies = [
    MIN_TREBLE_FREQUENCY,
    calculateMiddleFrequency(MIN_TREBLE_FREQUENCY, closedHiHatBandpassFrequency),
    closedHiHatBandpassFrequency
  ]
  const closedHiHatPanLeft = -0.4 // TODO: is -0.4 correct?
  const closedHiHatPanRight = Math.abs(closedHiHatPanLeft)

  const {sixteenthNotePlayDuration, swungSixteenthNotePlayDuration} = noteTimings
  const hiHatAttackEndAt = TWO_MS_IN_SECONDS
  const hiHatDecayEndAt = addOneMs(hiHatAttackEndAt)
  const swungHiHatAttackEndAt = addTwoMs(noteTimings.swingAmount)
  const swungHiHatDecayEndAt = addOneMs(swungHiHatAttackEndAt)
  const closedHiHatSustainEndAt = calculatePercussionSustain(sixteenthNotePlayDuration)
  const swungClosedHiHatSustainEndAt = calculatePercussionSustain(swungSixteenthNotePlayDuration)

  return {
    openHiHatBufferPromise: createHiHatBuffer(
      context,
      whiteNoiseBuffer,
      0,
      noteTimings.eightNotePlayDuration,
      openHiHatOscillatorFrequencies,
      hiHatOscillatorsGain,
      hiHatWhiteNoiseGain,
      openHiHatTransientGain,
      calculateSustainGain(openHiHatTransientGain),
      openHiHatBandpassFrequency,
      calculateRoundedBandpassQForMaxFrequency(openHiHatBandpassFrequency),
      hiHatAttackEndAt,
      hiHatDecayEndAt,
      calculatePercussionSustain(noteTimings.eightNotePlayDuration),
      0
    ),
    closedHiHatLeftBufferPromise: createHiHatBuffer(
      context,
      whiteNoiseBuffer,
      0,
      sixteenthNotePlayDuration,
      closedHiHatOscillatorFrequencies,
      hiHatOscillatorsGain,
      hiHatWhiteNoiseGain,
      closedHiHatTransientGain,
      closedHiHatSustainGain,
      closedHiHatBandpassFrequency,
      closedHiHatBandpassQ,
      hiHatAttackEndAt,
      hiHatDecayEndAt,
      closedHiHatSustainEndAt,
      closedHiHatPanLeft
    ),
    closedHiHatRightBufferPromise: createHiHatBuffer(
      context,
      whiteNoiseBuffer,
      0,
      sixteenthNotePlayDuration,
      closedHiHatOscillatorFrequencies,
      hiHatOscillatorsGain,
      hiHatWhiteNoiseGain,
      closedHiHatTransientGain,
      closedHiHatSustainGain,
      closedHiHatBandpassFrequency,
      closedHiHatBandpassQ,
      hiHatAttackEndAt,
      hiHatDecayEndAt,
      closedHiHatSustainEndAt,
      closedHiHatPanRight
    ),
    swungClosedHiHatLeftBufferPromise: createHiHatBuffer(
      context,
      whiteNoiseBuffer,
      noteTimings.swingAmount,
      swungSixteenthNotePlayDuration,
      closedHiHatOscillatorFrequencies,
      hiHatOscillatorsGain,
      hiHatWhiteNoiseGain,
      closedHiHatTransientGain,
      closedHiHatSustainGain,
      closedHiHatBandpassFrequency,
      closedHiHatBandpassQ,
      swungHiHatAttackEndAt,
      swungHiHatDecayEndAt,
      swungClosedHiHatSustainEndAt,
      closedHiHatPanLeft
    ),
    swungClosedHiHatRightBufferPromise: createHiHatBuffer(
      context,
      whiteNoiseBuffer,
      noteTimings.swingAmount,
      swungSixteenthNotePlayDuration,
      closedHiHatOscillatorFrequencies,
      hiHatOscillatorsGain,
      hiHatWhiteNoiseGain,
      closedHiHatTransientGain,
      closedHiHatSustainGain,
      closedHiHatBandpassFrequency,
      closedHiHatBandpassQ,
      swungHiHatAttackEndAt,
      swungHiHatDecayEndAt,
      swungClosedHiHatSustainEndAt,
      closedHiHatPanRight
    )
  }
}

function calculateRoundedBandpassQForMaxFrequency(centerFrequency) {
  return roundToThreeDecimals(calculateBandpassQForMaxFrequency(centerFrequency))
}

function calculateBandpassQForMaxFrequency(centerFrequency) {
  return calculateBandpassQ(centerFrequency, MAX_FREQUENCY)
}

function calculateBandpassQ(centerFrequency, upperFrequency) {
  return centerFrequency / (2 * (upperFrequency - centerFrequency))
}

function calculateMiddleFrequency(lowerFrequency, upperFrequency) {
  return (lowerFrequency + upperFrequency) / 2
}

function createWhiteNoiseBuffer(context) {
  const sampleRate = context.sampleRate
  const buffer = context.createBuffer(1, sampleRate, sampleRate)
  const data = buffer.getChannelData(0)

  for (let i = 0; i < sampleRate; i++) {
    data[i] = Math.random() * 2 - 1
  }

  return buffer
}

function createNoteTimings(bpm) {
  const beat = 60 / bpm // quarterNote
  const wholeNote = beat * 4
  const halfNote = beat * 2
  const eighthNote = beat / 2
  const sixteenthNote = beat / 4
  const thirtySecondNote = beat / 8
  const sixtyFourthNote = beat / 16
  const note128th = beat / 32
  const note256th = beat / 64
  const swingAmount = note256th
  const sixteenthNotePlayDuration = calculatePlayDuration(sixteenthNote)

  function calculatePlayDuration(noteTiming) {
    return noteTiming - note256th
  }

  function calculateSwung(noteTiming) {
    return noteTiming - swingAmount
  }

  return {
    wholeNote,
    halfNote,
    eighthNote,
    sixteenthNote,
    thirtySecondNote,
    sixtyFourthNote,
    note128th,
    note256th,
    quarterNote: beat,
    wholeNotePlayDuration: calculatePlayDuration(wholeNote),
    halfNotePlayDuration: calculatePlayDuration(halfNote),
    eightNotePlayDuration: calculatePlayDuration(eighthNote),
    sixteenthNotePlayDuration,
    swingAmount,
    swungSixteenthNotePlayDuration: calculateSwung(sixteenthNotePlayDuration)
  }
}

function createNoteFrequencies() {
  const noteNames = ['C', 'Cs', 'D', 'Ds', 'E', 'F', 'Fs', 'G', 'Gs', 'A', 'As', 'B']
  const noteFrequencies = {}

  for (let octave = 0; octave <= 10; octave++) {
    for (let semitone = 0; semitone < noteNames.length; semitone++) {
      const midiNote = octave * 12 + semitone + 12
      const frequency = 440 * 2 ** ((midiNote - 69) / 12)

      noteFrequencies[`${noteNames[semitone]}${octave}`] = Math.round(frequency * 100) / 100
    }
  }

  return noteFrequencies
}

function roundToThreeDecimals(value) {
  return Math.round(value * 1000) / 1000
}

function calculateSustainGain(value) {
  return value - 0.1
}

function calculatePercussionSustain(noteTiming) {
  return (noteTiming / 8) * 7
}

function createOfflineAudioContext(context, startAt, duration) {
  return new OfflineAudioContext(1, (startAt + duration) * context.sampleRate, context.sampleRate)
}

function connect48DbOctTrebleFilter(inputNode) {
  for (let i = 0; i < 4; i++) {
    const filter = createTrebleFilter()
    inputNode.connect(filter)
    inputNode = filter
  }

  return inputNode
}

function createTrebleFilter() {
  return createHighPassFilter(MIN_TREBLE_FREQUENCY)
}

function createLowPassFilter(frequency) {
  return createLowOrHighPassFilter('lowpass', frequency)
}

function createHighPassFilter(frequency) {
  return createLowOrHighPassFilter('highpass', frequency)
}

function createLowOrHighPassFilter(type, frequency) {
  const filter = context.createBiquadFilter()
  filter.type = type
  filter.frequency.value = frequency
  filter.Q.value = Math.SQRT1_2

  return filter
}

function addOneMs(s) {
  return s + ONE_MS_IN_SECONDS
}

function addTwoMs(s) {
  return s + TWO_MS_IN_SECONDS
}

//
// Some abstractions are intentionally avoided below to keep the code simple.
//

function createBassDrumBuffer(context, startAt, duration, transientFrequency, bassFrequency, transientGain) {
  const offlineContext = createOfflineAudioContext(context, startAt, duration)

  const oscillator = offlineContext.createOscillator()
  const gain = offlineContext.createGain()

  oscillator.connect(gain)
  gain.connect(offlineContext.destination)

  const attackEndAt = startAt + 0.003
  const decayEndAt = addTwoMs(attackEndAt)
  const sustainGain = calculateSustainGain(transientGain)

  oscillator.type = 'sine'

  oscillator.frequency.setValueAtTime(transientFrequency, startAt)
  oscillator.frequency.linearRampToValueAtTime(bassFrequency, decayEndAt)
  oscillator.frequency.exponentialRampToValueAtTime(MIN_FREQUENCY, duration)

  gain.gain.setValueAtTime(GAIN_EPSILON, startAt)
  gain.gain.linearRampToValueAtTime(transientGain, attackEndAt)
  gain.gain.linearRampToValueAtTime(sustainGain, decayEndAt)
  gain.gain.setValueAtTime(sustainGain, startAt + calculatePercussionSustain(duration))
  gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, duration)

  oscillator.start(startAt)
  oscillator.stop(duration)

  return offlineContext.startRendering()
}

function createHiHatBuffer(
  context,
  whiteNoiseBuffer,
  startAt,
  duration,
  oscillatorFrequencies,
  oscillatorsGainValue,
  whiteNoiseGainValue,
  transientGain,
  sustainGain,
  bandpassFrequency,
  bandpassQ,
  attackEndAt,
  decayEndAt,
  sustainEndAt,
  pan
) {
  const offlineContext = createOfflineAudioContext(context, startAt, duration)

  const bufferSource = offlineContext.createBufferSource()
  bufferSource.buffer = whiteNoiseBuffer

  const bandpass = offlineContext.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = bandpassFrequency
  bandpass.Q.value = bandpassQ

  const panner = offlineContext.createStereoPanner()
  panner.pan.value = pan

  const whiteNoiseGain = offlineContext.createGain()
  whiteNoiseGain.gain.value = whiteNoiseGainValue

  const gain = context.createGain()
  gain.gain.setValueAtTime(GAIN_EPSILON, startAt)
  gain.gain.linearRampToValueAtTime(transientGain, attackEndAt)
  gain.gain.linearRampToValueAtTime(sustainGain, decayEndAt)
  gain.gain.setValueAtTime(sustainGain, sustainEndAt)
  gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, duration)

  const oscillatorsGain = context.createGain()
  oscillatorsGain.gain.value = oscillatorsGainValue

  for (const frequency of oscillatorFrequencies) {
  }

  return offlineContext.startRendering()
}
