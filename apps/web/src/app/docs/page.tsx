import Link from 'next/link'

import { SiteFooter } from '@/components/talent/site-footer'
import { SiteHeader } from '@/components/talent/site-header'
import { docsSections } from '@/lib/talent/catalog'
import { innovationFeatures } from '@/lib/talent/innovation'

export default function DocsPage() {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,_#020617_0%,_#111827_100%)] text-white">
      <SiteHeader />
      <main className="mx-auto grid max-w-7xl gap-10 px-6 py-14 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-3xl border border-white/10 bg-white/5 p-5">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Docs</p>
          <div className="mt-4 space-y-3">
            {docsSections.map((section) => (
              <Link key={section.id} href={`#${section.id}`} className="block rounded-2xl px-3 py-2 text-sm text-slate-300 transition hover:bg-white/5 hover:text-white">
                {section.title}
              </Link>
            ))}
          </div>
        </aside>
        <section className="space-y-8">
          {docsSections.map((section) => (
            <article key={section.id} id={section.id} className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-8">
              <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300">{section.title}</p>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-200">{section.body}</p>
            </article>
          ))}
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Feature Docs</p>
            <div className="mt-5 space-y-5">
              {innovationFeatures.map((feature) => (
                <div key={feature.id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
                  <h2 className="text-2xl font-semibold text-white">{feature.name}</h2>
                  <p className="mt-3 text-sm uppercase tracking-[0.25em] text-slate-400">Pain point</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">{feature.painPoint}</p>
                  <p className="mt-4 text-sm uppercase tracking-[0.25em] text-slate-400">What it changes</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">{feature.outcome}</p>
                  <p className="mt-4 text-sm uppercase tracking-[0.25em] text-slate-400">How CodeOrbit AI implements it</p>
                  <p className="mt-2 text-sm leading-7 text-slate-200">{feature.implementation}</p>
                </div>
              ))}
            </div>
          </article>
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Quick Start</p>
            <pre className="mt-5 overflow-auto rounded-3xl bg-slate-900 p-5 text-sm leading-7 text-slate-100">
{`npm install
npm run build:web
npm run test:web
npm run build:extension
npm run build:desktop
npm run build:cli

# Optional release packaging
npm run package:extension
npm run package:cli

# Run desktop packaging on the target OS
npm run package:desktop`}
            </pre>
          </article>
          <article className="rounded-[2rem] border border-white/10 bg-slate-950/80 p-8">
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Platform Targets</p>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-200">
                <strong>macOS</strong>
                <br />
                Desktop packaging outputs `dmg` and `zip`. CLI works through Terminal with the `codeorbit` binary.
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-200">
                <strong>Windows</strong>
                <br />
                Desktop packaging outputs `nsis` and `zip`. CLI works through PowerShell and Command Prompt.
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-200">
                <strong>Linux</strong>
                <br />
                Desktop packaging outputs `AppImage` and `tar.gz`. CLI works in bash, zsh, fish, and CI shells.
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 text-sm leading-7 text-slate-200">
                <strong>Shared core</strong>
                <br />
                All CodeOrbit surfaces use the same provider model: Ollama, LM Studio, Anthropic, OpenAI, OpenRouter, and compatible endpoints.
              </div>
            </div>
          </article>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
