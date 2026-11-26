import { EXAM_IDS, EXAM_PROFILES, type ExamId } from '../content/blueprint'
import { setTrack, useProgress } from '../progress/store'

const TRACK_NOTES: Record<ExamId, string> = {
  '010-200': 'The current exam (objectives v2.0). Recommended unless you already booked 010-160.',
  '010-160': `The previous exam (objectives v1.6), available until ${EXAM_PROFILES['010-160'].availableUntil}. Same 19 objectives and weights, but with info pages, locate, syslog, ifconfig, netstat and desktop skills, and without find, systemd, SSH or IPv6 autoconfiguration.`,
}

/** The exam-track switch: it decides which questions, mock exams and objective lists the learner sees. */
export function ExamSettings() {
  const { track } = useProgress()
  return (
    <fieldset className="space-y-2">
      <legend className="font-semibold">Which exam are you preparing for?</legend>
      {EXAM_IDS.map((id) => (
        <label key={id} className={`flex cursor-pointer gap-3 rounded-lg border-2 p-3 ${track === id ? 'border-brand bg-brand/5' : 'border-slate-200 bg-white'}`}>
          <input type="radio" name="track" checked={track === id} onChange={() => setTrack(id)} className="mt-1 accent-brand" />
          <span>
            <span className="font-medium">Linux Essentials {id}</span>
            <span className="block text-sm text-slate-600">{TRACK_NOTES[id]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  )
}
