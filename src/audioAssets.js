const GAIN_EPSILON = 0.0001
const MIN_FREQUENCY = 35

export async function audioThings(context, bpm) {
  const noteTimings = createNoteTimings(bpm)
  const whiteNoiseBuffer = createWhiteNoiseBuffer(context)

  const hiHatOscillatorFrequencies = [6007, 8009, 10007] /* prime numbers */

  const [bassDrum, openHiHat, closedHiHat, swungClosedHiHat] = await Promise.all([
    createBassDrumBuffer(context, 0, noteTimings.eightNotePlayDuration),
    createHiHatBuffer(context, whiteNoiseBuffer, hiHatOscillatorFrequencies, 0, noteTimings.eightNotePlayDuration),
    createHiHatBuffer(context, whiteNoiseBuffer, hiHatOscillatorFrequencies, 0, noteTimings.sixteenthNotePlayDuration),
    createHiHatBuffer(
      context,
      whiteNoiseBuffer,
      hiHatOscillatorFrequencies,
      noteTimings.swingAmount,
      noteTimings.swungSixteenthNotePlayDuration
    )
  ])

  return {
    noteTimings,
    noteFrequencies: createNoteFrequencies(),
    gainEpsilon: GAIN_EPSILON,
    minFrequency: MIN_FREQUENCY,
    whiteNoiseBuffer,
    percussionBuffers: {bassDrum, openHiHat, closedHiHat, swungClosedHiHat}
  }
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

function calculateSustainGain(value) {
  return roundToOneDecimal(value - 0.1)
}

function calculatePercussionSustain(noteTiming) {
  return (noteTiming / 8) * 7
}

function createOfflineAudioContext(context, startAt, duration) {
  return new OfflineAudioContext(1, (startAt + duration) * context.sampleRate, context.sampleRate)
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

function createBassDrumBuffer(context, startAt, duration, transientFrequency, bassFrequency, maxGain) {
  const offlineContext = createOfflineAudioContext(context, startAt, duration)

  const oscillator = offlineContext.createOscillator()
  const gain = offlineContext.createGain()

  oscillator.connect(gain)
  gain.connect(offlineContext.destination)

  const transientEndAt = startAt + 0.005
  const sustainGain = calculateSustainGain(maxGain)

  oscillator.type = 'sine'

  oscillator.frequency.setValueAtTime(transientFrequency, startAt)
  oscillator.frequency.linearRampToValueAtTime(bassFrequency, transientEndAt)
  oscillator.frequency.exponentialRampToValueAtTime(MIN_FREQUENCY, duration)

  gain.gain.setValueAtTime(GAIN_EPSILON, startAt)
  gain.gain.linearRampToValueAtTime(maxGain, startAt + 0.003)
  gain.gain.linearRampToValueAtTime(sustainGain, transientEndAt)
  gain.gain.setValueAtTime(sustainGain, startAt + calculatePercussionSustain(duration))
  gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, duration)

  oscillator.start(startAt)
  oscillator.stop(duration)

  return offlineContext.startRendering()
}

function createHiHatBuffer(context, whiteNoiseBuffer, oscillatorFrequencies, startAt, duration) {
  const offlineContext = createOfflineAudioContext(context, startAt, duration)
  return offlineContext.startRendering()
}
