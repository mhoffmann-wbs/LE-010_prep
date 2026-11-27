import { useEffect } from 'react'
import { Link, useParams } from 'react-router'
import { GUIDES, type Guide } from '../content/guides'
import { guideComponents } from '../lessons/components'

export default function GuidePage() {
  const { slug } = useParams()
  const guide = slug ? GUIDES.get(slug) : undefined
  if (!guide) {
    return (
      <>
        <h1 className="text-2xl font-semibold">No such guide</h1>
        <p className="mt-2">
          <Link to="/" className="underline">
            Back to the start page
          </Link>
        </p>
      </>
    )
  }
  return <GuideView key={slug} guide={guide} />
}

function GuideView({ guide: { meta, Content } }: { guide: Guide }) {
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])
  return (
    <article className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">{meta.title}</h1>
        <p className="text-slate-600">{meta.summary}</p>
        <p className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
          Checked against the objectives and LPI’s pages on {meta.updated}
          <button type="button" onClick={() => window.print()} className="rounded border px-3 py-1 print:hidden">
            Print
          </button>
        </p>
      </header>
      <div className="prose max-w-none prose-a:text-brand-dark prose-code:before:content-none prose-code:after:content-none">
        <Content components={guideComponents} />
      </div>
      <section className="rounded-lg border border-slate-200 bg-white p-4 break-inside-avoid">
        <h2 className="font-semibold">Sources</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
          {meta.links.map((link) => (
            <li key={link.url}>
              <a href={link.url} target="_blank" rel="noreferrer" className="text-brand-dark underline">
                {link.title}
              </a>
            </li>
          ))}
        </ul>
      </section>
    </article>
  )
}
