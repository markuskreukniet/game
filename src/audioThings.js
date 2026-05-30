// TODO: naming of this file

const GAIN_EPSILON = 0.0001

export function audioThings(bpm) {
  const noteTimings = createNoteTimings(bpm)

  return {
    noteTimings,
    noteFrequencies: createNoteFrequencies(),
    gainEpsilon: GAIN_EPSILON,
    percussionBuffers: {bassDrum: createBassDrumBuffer(noteTimings.eightNotePlayDuration)}
  }
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
  const sixteenthNotePlayDuration = calculatePlayDuration(sixteenthNote)

  function calculatePlayDuration(noteTiming) {
    return noteTiming - note256th
  }

  function calculateSwung(noteTiming) {
    return noteTiming - note256th
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

function calculatePercussionSustain(noteTiming) {
  return (noteTiming / 8) * 7
}

// WIP
function createBassDrumBuffer(duration, transientFrequency, bassFrequency, maxGain) {
  const offlineContext = new OfflineAudioContext(1, duration * context.sampleRate, context.sampleRate)

  const sustainGain = Math.round((maxGain - 0.1) * 10) / 10 // floating-point precision // TODO comment

  const oscillator = offlineContext.createOscillator()
  const gain = offlineContext.createGain()

  oscillator.connect(gain)
  gain.connect(offlineContext.destination)

  oscillator.type = 'sine'

  const startAt = 0
  const endAt = duration

  const transientEndAt = startAt + 0.006
  const sustain = calculatePercussionSustain(duration)
  const releaseAt = startAt + sustain

  oscillator.frequency.setValueAtTime(transientFrequency, startAt)
  oscillator.frequency.linearRampToValueAtTime(bassFrequency, transientEndAt)
  oscillator.frequency.exponentialRampToValueAtTime(35, endAt)

  gain.gain.setValueAtTime(GAIN_EPSILON, startAt)
  gain.gain.linearRampToValueAtTime(1, startAt + 0.003)
  gain.gain.linearRampToValueAtTime(0.9, transientEndAt)
  gain.gain.setValueAtTime(0.9, releaseAt)
  gain.gain.exponentialRampToValueAtTime(GAIN_EPSILON, endAt)

  oscillator.start(startAt)
  oscillator.stop(endAt)

  return offlineContext.startRendering() // TODO: returns promise
}
