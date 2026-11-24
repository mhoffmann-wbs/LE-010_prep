import { Suspense, lazy, useEffect, useState } from 'react'
import { vmAvailable } from '../vm/emulator'

const Terminal = lazy(() => import('../vm/Terminal'))

export default function TerminalPage() {
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    void vmAvailable().then(setAvailable)
  }, [])

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-bold">Terminal</h1>
      <p className="text-slate-700">
        A real Debian Linux running inside your browser. You are logged in as <code>mira</code> at TuxPixel Studio (password{' '}
        <code>tuxpixel</code>). Nothing you do here leaves your browser, and reloading the page starts a fresh machine.
      </p>
      {available === null && <p className="text-slate-500">Checking for the Linux image…</p>}
      {available === false && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm">
          The Linux image isn’t built yet. Run <code>npm run vm:build</code> and then <code>npm run vm:state</code>.
        </p>
      )}
      {available && (
        <Suspense fallback={<p className="text-slate-500">Loading the terminal…</p>}>
          <Terminal />
        </Suspense>
      )}
    </div>
  )
}
