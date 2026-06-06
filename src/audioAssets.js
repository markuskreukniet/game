const GAIN_EPSILON = 0.0001
const MIN_FREQUENCY = 35
const MAX_FREQUENCY = 20000
const MIN_TREBLE_FREQUENCY = 6000
const TWO_MS_IN_SECONDS = 0.002

export async function audioThings(context, bpm) {
  const noteTimings = createNoteTimings(bpm)
  const whiteNoiseBuffer = createWhiteNoiseBuffer(context)

  const hiHatOscillatorFrequencies = [6007, 8009, 10007] /* prime numbers */
  const hiHatOscillatorsGain = 0.1
  const hiHatWhiteNoiseGain = roundToThreeDecimals(1 - hiHatOscillatorsGain * hiHatOscillatorFrequencies.length)
  const openHiHatBandpassFrequency = 9000
  const openHiHatTransientGain = 1
  const closedHiHatBandpassFrequency = 11000
  const closedHiHatTransientGain = 0.9
  const closedHiHatSustainGain = calculateSustainGain(closedHiHatTransientGain)
  const closedHiHatBandpassQ = roundToThreeDecimals(calculateBandpassQForMaxFrequency(closedHiHatBandpassFrequency))
  const closedHiHatPanLeft = -0.4 // TODO: is -0.4 correct?
  const closedHiHatPanRight = Math.abs(closedHiHatPanLeft)

  // TODO: WIP
  const hiHatAttack = TWO_MS_IN_SECONDS
  const hiHatTransientEndAt = hiHatAttack + 0.001 // TODO: use roundToThreeDecimals?
  const swungHiHatAttack = addTwoMs(noteTimings.swingAmount) // TODO: use roundToThreeDecimals?

  const [bassDrum, openHiHat, closedHiHatLeft, closedHiHatRight, swungClosedHiHatLeft, swungClosedHiHatRight] =
    await Promise.all([
      createBassDrumBuffer(context, 0, noteTimings.eightNotePlayDuration),
      createHiHatBuffer(
        context,
        whiteNoiseBuffer,
        0,
        noteTimings.eightNotePlayDuration,
        hiHatOscillatorFrequencies,
        hiHatOscillatorsGain,
        hiHatWhiteNoiseGain,
        openHiHatTransientGain,
        calculateSustainGain(openHiHatTransientGain),
        openHiHatBandpassFrequency,
        roundToThreeDecimals(calculateBandpassQForMaxFrequency(openHiHatBandpassFrequency)),
        0
      ),
      createHiHatBuffer(
        context,
        whiteNoiseBuffer,
        0,
        noteTimings.sixteenthNotePlayDuration,
        hiHatOscillatorFrequencies,
        hiHatOscillatorsGain,
        hiHatWhiteNoiseGain,
        closedHiHatTransientGain,
        closedHiHatSustainGain,
        closedHiHatBandpassFrequency,
        closedHiHatBandpassQ,
        closedHiHatPanLeft
      ),
      createHiHatBuffer(
        context,
        whiteNoiseBuffer,
        0,
        noteTimings.sixteenthNotePlayDuration,
        hiHatOscillatorFrequencies,
        hiHatOscillatorsGain,
        hiHatWhiteNoiseGain,
        closedHiHatTransientGain,
        closedHiHatSustainGain,
        closedHiHatBandpassFrequency,
        closedHiHatBandpassQ,
        closedHiHatPanRight
      ),
      createHiHatBuffer(
        context,
        whiteNoiseBuffer,
        noteTimings.swingAmount,
        noteTimings.swungSixteenthNotePlayDuration,
        hiHatOscillatorFrequencies,
        hiHatOscillatorsGain,
        hiHatWhiteNoiseGain,
        closedHiHatTransientGain,
        closedHiHatSustainGain,
        closedHiHatBandpassFrequency,
        closedHiHatBandpassQ,
        closedHiHatPanLeft
      ),
      createHiHatBuffer(
        context,
        whiteNoiseBuffer,
        noteTimings.swingAmount,
        noteTimings.swungSixteenthNotePlayDuration,
        hiHatOscillatorFrequencies,
        hiHatOscillatorsGain,
        hiHatWhiteNoiseGain,
        closedHiHatTransientGain,
        closedHiHatSustainGain,
        closedHiHatBandpassFrequency,
        closedHiHatBandpassQ,
        closedHiHatPanRight
      )
    ])

  return {
    noteTimings,
    noteFrequencies: createNoteFrequencies(),
    gainEpsilon: GAIN_EPSILON,
    minFrequency: MIN_FREQUENCY,
    maxFrequency: MAX_FREQUENCY,
    minTrebleFrequency: MIN_TREBLE_FREQUENCY,
    whiteNoiseBuffer,
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

function calculateBandpassQForMaxFrequency(centerFrequency) {
  return calculateBandpassQ(centerFrequency, MAX_FREQUENCY)
}

function calculateBandpassQ(centerFrequency, upperFrequency) {
  return centerFrequency / (2 * (upperFrequency - centerFrequency))
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

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10 // Prevent floating-point artifacts
}

function roundToThreeDecimals(value) {
  return Math.round(value * 1000) / 1000 // Prevent floating-point artifacts
}

function calculateSustainGain(value) {
  return roundToOneDecimal(value - 0.1)
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

function addTwoMs(s) {
  return s + TWO_MS_IN_SECONDS // TODO: use roundToThreeDecimals?
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

  const attack = startAt + 0.003 // TODO: use roundToThreeDecimals?
  const transientEndAt = addTwoMs(attack) // TODO: use roundToThreeDecimals?
  const sustainGain = calculateSustainGain(transientGain)

  oscillator.type = 'sine'

  oscillator.frequency.setValueAtTime(transientFrequency, startAt)
  oscillator.frequency.linearRampToValueAtTime(bassFrequency, transientEndAt)
  oscillator.frequency.exponentialRampToValueAtTime(MIN_FREQUENCY, duration)

  gain.gain.setValueAtTime(GAIN_EPSILON, startAt)
  gain.gain.linearRampToValueAtTime(transientGain, attack)
  gain.gain.linearRampToValueAtTime(sustainGain, transientEndAt)
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
  pan
) {
  const offlineContext = createOfflineAudioContext(context, startAt, duration)

  const bufferSource = context.createBufferSource()
  bufferSource.buffer = whiteNoiseBuffer

  const bandpass = context.createBiquadFilter()
  bandpass.type = 'bandpass'
  bandpass.frequency.value = bandpassFrequency
  bandpass.Q.value = bandpassQ

  const panner = context.createStereoPanner()
  panner.pan.value = pan

  const whiteNoiseGain = context.createGain()
  whiteNoiseGain.gain.value = whiteNoiseGainValue

  return offlineContext.startRendering()
}
