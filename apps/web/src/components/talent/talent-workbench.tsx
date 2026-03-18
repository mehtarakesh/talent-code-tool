'use client'

import { useEffect, useMemo, useState } from 'react'

import { decodeSessionCapsule, encodeSessionCapsule, type SessionCapsule } from '@/lib/talent/advanced'
import { innovationFeatureCards, providerCatalog, releaseChecklist } from '@/lib/talent/catalog'
import { buildBlastRadius, buildOpsSuggestion, buildReleaseContract, buildShipMemo } from '@/lib/talent/innovation'
import { buildMissionLock, evaluateProofGate } from '@/lib/talent/mission-lock'
import type { PreflightAssessment } from '@/lib/talent/preflight'
import { createSnapshot, deserializeSnapshots, mergeSnapshots, serializeSnapshots, type WorkbenchSnapshot } from '@/lib/talent/vault'

type ProviderRecord = {
  id: string
  name: string
  tagline: string
  baseUrl: string
  models: string[]
}

type ApiResult = {
  output: string
  provider: string
  model: string
  baseUrl: string
  recovered?: boolean
  attempts?: Array<{ provider: string; model: string; baseUrl: string; ok: boolean; note: string }>
}

type JuryBallot = {
  provider: string
  model: string
  ok: boolean
  durationMs: number
  output?: string
  error?: string
}

type LedgerEntry = {
  provider: string
  model: string
  status: 'success' | 'error'
  durationMs: number
  note: string
}

const starterPrompt = 'Review the selected workspace, suggest the implementation plan, produce the patch strategy, and define the release validation steps.'
const vaultStorageKey = 'codeorbit-ai.vault.snapshots'

export function TalentWorkbench() {
  const [providers, setProviders] = useState<ProviderRecord[]>(providerCatalog)
  const [provider, setProvider] = useState(providerCatalog[0]?.id || 'ollama')
  const [model, setModel] = useState(providerCatalog[0]?.models[0] || 'deepseek-coder:33b')
  const [baseUrl, setBaseUrl] = useState(providerCatalog[0]?.baseUrl || 'http://localhost:11434')
  const [apiKey, setApiKey] = useState('')
  const [workspaceContext, setWorkspaceContext] = useState('apps/web and apps/api are the active code surfaces. Focus on coding-assistant UX, release readiness, provider interoperability, and docs parity.')
  const [prompt, setPrompt] = useState(starterPrompt)
  const [result, setResult] = useState<ApiResult | null>(null)
  const [jury, setJury] = useState<{ ballots: JuryBallot[]; synthesis: string } | null>(null)
  const [preflight, setPreflight] = useState<PreflightAssessment | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [vaultSnapshots, setVaultSnapshots] = useState<WorkbenchSnapshot[]>([])
  const [capsuleInput, setCapsuleInput] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function loadProviders() {
      try {
        const response = await fetch('/api/talent/providers')
        const data = await response.json()

        if (!cancelled && Array.isArray(data.providers)) {
          setProviders(data.providers)
        }
      } catch {
        // Keep client-side fallback catalog if discovery is unavailable.
      }
    }

    loadProviders()

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

    setVaultSnapshots(deserializeSnapshots(window.localStorage.getItem(vaultStorageKey)))
  }, [])

  const activeProvider = useMemo(
    () => providers.find((entry) => entry.id === provider) || providerCatalog[0],
    [provider, providers]
  )

  useEffect(() => {
    if (!activeProvider) {
      return
    }

    setBaseUrl(activeProvider.baseUrl)
    setModel(activeProvider.models[0] || '')
  }, [activeProvider])

  function storeSnapshot(assessment?: PreflightAssessment | null, output?: ApiResult | null) {
    if (typeof window === 'undefined') {
      return
    }

    const snapshot = createSnapshot({
      provider,
      model,
      baseUrl,
      prompt,
      workspaceContext,
      gate: assessment?.gate,
      readinessScore: assessment?.readinessScore,
      outputPreview: output?.output?.slice(0, 220),
    })

    setVaultSnapshots((current) => {
      const next = mergeSnapshots(current, snapshot)
      window.localStorage.setItem(vaultStorageKey, serializeSnapshots(next))
      return next
    })
  }

  async function runPreflight() {
    const response = await fetch('/api/talent/preflight', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider,
        model,
        baseUrl,
        apiKey,
        prompt,
        workspaceContext,
      }),
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || 'Preflight request failed.')
    }

    setPreflight(data)
    storeSnapshot(data, result)
    return data as PreflightAssessment
  }

  async function runPrompt() {
    setLoading(true)
    setError('')
    const startedAt = Date.now()

    try {
      const assessment = await runPreflight()

      if (assessment.gate === 'blocked') {
        throw new Error(assessment.summary)
      }

      const response = await fetch('/api/talent/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          provider,
          model,
          baseUrl,
          apiKey,
          prompt,
          workspaceContext,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Talent request failed.')
      }

      setResult(data)
      storeSnapshot(assessment, data)
      setLedger((current) => {
        const nextEntry: LedgerEntry = {
          provider: data.provider,
          model: data.model,
          status: 'success',
          durationMs: Date.now() - startedAt,
          note: data.recovered ? 'Recovered through an auto-heal fallback lane.' : 'Primary run completed successfully.',
        }

        return [nextEntry, ...current].slice(0, 6)
      })
    } catch (requestError) {
      const message = requestError instanceof Error ? requestError.message : 'Request failed.'
      setError(message)
      setLedger((current) => {
        const nextEntry: LedgerEntry = {
          provider,
          model,
          status: 'error',
          durationMs: Date.now() - startedAt,
          note: buildOpsSuggestion(message, provider, model),
        }

        return [nextEntry, ...current].slice(0, 6)
      })
    } finally {
      setLoading(false)
    }
  }

  async function runJury() {
    setLoading(true)
    setError('')

    try {
      const assessment = preflight || (await runPreflight())
      const members = assessment.juryRecommendation.map((entry) => ({
        provider: entry.provider,
        model: entry.model,
        baseUrl: entry.baseUrl,
        apiKey: entry.provider === provider ? apiKey : undefined,
      }))

      const response = await fetch('/api/talent/jury', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          workspaceContext,
          members,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Talent jury request failed.')
      }

      setJury(data)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Jury request failed.')
    } finally {
      setLoading(false)
    }
  }

  const releaseContract = useMemo(() => buildReleaseContract(prompt, workspaceContext), [prompt, workspaceContext])
  const blastRadius = useMemo(() => buildBlastRadius(prompt, workspaceContext), [prompt, workspaceContext])
  const missionLock = useMemo(
    () => preflight?.missionLock || buildMissionLock(prompt, workspaceContext, releaseContract, blastRadius),
    [blastRadius, preflight?.missionLock, prompt, releaseContract, workspaceContext]
  )
  const proofGate = useMemo(() => evaluateProofGate(missionLock, result?.output), [missionLock, result?.output])
  const shipMemo = useMemo(
    () => buildShipMemo(prompt, provider, model, releaseContract, blastRadius, result?.output),
    [blastRadius, model, prompt, provider, releaseContract, result?.output]
  )
  const sessionCapsule = useMemo(
    () =>
      encodeSessionCapsule({
        version: 'codeorbit-ai.v1',
        provider: provider as SessionCapsule['provider'],
        model,
        baseUrl,
        prompt,
        workspaceContext,
        readinessScore: preflight?.readinessScore,
        gate: preflight?.gate,
        summary: preflight?.summary,
        output: result?.output,
        createdAt: new Date().toISOString(),
      }),
    [baseUrl, model, preflight?.gate, preflight?.readinessScore, preflight?.summary, prompt, provider, result?.output, workspaceContext]
  )

  function loadSessionCapsule() {
    const capsule = decodeSessionCapsule(capsuleInput)
    setProvider(capsule.provider)
    setModel(capsule.model)
    setBaseUrl(capsule.baseUrl)
    setPrompt(capsule.prompt)
    setWorkspaceContext(capsule.workspaceContext)
    setError('')
  }

  function restoreVaultSnapshot(snapshot: WorkbenchSnapshot) {
    setProvider(snapshot.provider)
    setModel(snapshot.model)
    setBaseUrl(snapshot.baseUrl || baseUrl)
    setPrompt(snapshot.prompt)
    setWorkspaceContext(snapshot.workspaceContext)
    setError('')
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {innovationFeatureCards.map((feature) => (
          <div key={feature.title} className="rounded-3xl border border-white/10 bg-slate-950/70 p-5">
            <p className="text-sm uppercase tracking-[0.25em] text-cyan-300">{feature.title}</p>
            <p className="mt-3 text-sm leading-7 text-slate-300">{feature.detail}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-3xl border border-white/10 bg-slate-950/70 p-6 shadow-2xl shadow-cyan-950/30">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Talent Workbench</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Ship from prompt to release notes</h1>
          </div>
          <button
            type="button"
            onClick={() => setPrompt(starterPrompt)}
            className="rounded-full border border-cyan-400/40 px-4 py-2 text-sm text-cyan-100 transition hover:border-cyan-300 hover:text-white"
          >
            Reset prompt
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm text-slate-300">Provider</span>
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            >
              {providers.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-300">Model</span>
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            />
          </label>
          <label className="space-y-2">
            <span className="text-sm text-slate-300">Base URL</span>
            <input
              value={baseUrl}
              onChange={(event) => setBaseUrl(event.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
            />
          </label>
        </div>

        <label className="mt-4 block space-y-2">
          <span className="text-sm text-slate-300">API Key</span>
          <input
            type="password"
            placeholder="Optional for local providers"
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
          />
        </label>

        <label className="mt-4 block space-y-2">
          <span className="text-sm text-slate-300">Workspace context</span>
          <textarea
            rows={5}
            value={workspaceContext}
            onChange={(event) => setWorkspaceContext(event.target.value)}
            className="w-full rounded-3xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
          />
        </label>

        <label className="mt-4 block space-y-2">
          <span className="text-sm text-slate-300">Task prompt</span>
          <textarea
            rows={7}
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            className="w-full rounded-3xl border border-white/10 bg-slate-900 px-4 py-3 text-white"
          />
        </label>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={runPrompt}
            disabled={loading}
            className="rounded-full bg-cyan-300 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? 'Running...' : 'Run talent prompt'}
          </button>
          <button
            type="button"
            onClick={async () => {
              setLoading(true)
              setError('')

              try {
                await runPreflight()
              } catch (requestError) {
                setError(requestError instanceof Error ? requestError.message : 'Preflight request failed.')
              } finally {
                setLoading(false)
              }
            }}
            className="rounded-full border border-emerald-400/40 px-5 py-3 text-sm text-emerald-100 transition hover:border-emerald-300 hover:text-white"
          >
            Run release preflight
          </button>
          <button
            type="button"
            onClick={runJury}
            className="rounded-full border border-cyan-400/40 px-5 py-3 text-sm text-cyan-100 transition hover:border-cyan-300 hover:text-white"
          >
            Run model jury
          </button>
          <button
            type="button"
            onClick={() => setPrompt('Inspect the workspace, identify release blockers, and produce a reviewer-ready checklist.')}
            className="rounded-full border border-white/15 px-5 py-3 text-sm text-white transition hover:border-white/40"
          >
            Release audit
          </button>
          <button
            type="button"
            onClick={() => setPrompt('Review the current files, outline the patch, and write the validation commands before coding.')}
            className="rounded-full border border-white/15 px-5 py-3 text-sm text-white transition hover:border-white/40"
          >
            Patch planning
          </button>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-rose-400/30 bg-rose-500/10 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}
      </section>

      <section className="space-y-6">
        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Provider Profile</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{activeProvider?.name}</h2>
          <p className="mt-3 text-sm text-slate-300">{activeProvider?.tagline}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {activeProvider?.models.map((entry) => (
              <span key={entry} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-200">
                {entry}
              </span>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-emerald-300">Release Gate</p>
          <div className="mt-4 space-y-4 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Status</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white">
                  {preflight?.gate || 'awaiting preflight'}
                </span>
                <span className="text-2xl font-semibold text-white">{preflight?.readinessScore ?? '--'}</span>
              </div>
              <p className="mt-3">{preflight?.summary || 'Run release preflight to validate provider readiness, workspace coverage, and release risk before prompting a model.'}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Checks</p>
              <div className="mt-3 space-y-3">
                {(preflight?.checks || []).map((check) => (
                  <div key={check.id} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      {check.label} / {check.status}
                    </p>
                    <p className="mt-2">{check.detail}</p>
                  </div>
                ))}
                {!preflight ? <p className="text-slate-300">No preflight checks yet.</p> : null}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-rose-300">Hidden Pain Detector</p>
          <div className="mt-4 space-y-4 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Operator Burden</p>
              <p className="mt-2 text-3xl font-semibold text-white">{preflight?.hiddenPainAnalysis.operatorBurdenScore ?? '--'}</p>
              <p className="mt-3">
                {preflight
                  ? 'This score measures how much unstated decision-making the human is still carrying outside the tool.'
                  : 'Run preflight to surface contradictions, missing assumptions, and invisible coordination costs.'}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Faultlines</p>
              <div className="mt-3 space-y-3">
                {preflight?.hiddenPainAnalysis.faultlines.map((faultline) => (
                  <div key={`${faultline.severity}-${faultline.title}`} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      {faultline.title} / {faultline.severity}
                    </p>
                    <p className="mt-2">{faultline.detail}</p>
                  </div>
                ))}
                {!preflight?.hiddenPainAnalysis.faultlines.length ? <p className="text-slate-300">No hidden faultlines surfaced yet.</p> : null}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Missing Inputs</p>
                <ul className="mt-3 space-y-2">
                  {(preflight?.hiddenPainAnalysis.missingInputs || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Invisible Costs</p>
                <ul className="mt-3 space-y-2">
                  {(preflight?.hiddenPainAnalysis.invisibleCosts || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Freshness Sentinel</p>
          <div className="mt-4 space-y-4 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Freshness Risk</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white">
                  {preflight?.freshness.status || 'stable'}
                </span>
                <span className="text-3xl font-semibold text-white">{preflight?.freshness.freshnessScore ?? '--'}</span>
              </div>
              <p className="mt-3">
                {preflight
                  ? 'This checks whether the task depends on fast-moving external APIs, packages, or platforms that should be verified live.'
                  : 'Run preflight to catch stale-doc risk before the model recommends outdated APIs or libraries.'}
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Live Proof Requests</p>
                <ul className="mt-3 space-y-2">
                  {(preflight?.freshness.liveProofRequests || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Suggested Artifacts</p>
                <ul className="mt-3 space-y-2">
                  {(preflight?.freshness.suggestedArtifacts || []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            {(preflight?.freshness.signals || []).length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Freshness Signals</p>
                <div className="mt-3 space-y-3">
                  {(preflight?.freshness.signals || []).map((signal) => (
                    <div key={`${signal.subject}-${signal.detail}`} className="rounded-2xl border border-white/10 bg-slate-950/60 px-4 py-3">
                      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                        {signal.subject} / {signal.type} / {signal.risk}
                      </p>
                      <p className="mt-2">{signal.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300">Release Checklist</p>
          <div className="mt-4 space-y-3">
            {releaseChecklist.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Release Contract</p>
          <div className="mt-4 space-y-4 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">{releaseContract.objective}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Deliverables</p>
              <ul className="mt-3 space-y-2">
                {releaseContract.deliverables.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Validations</p>
              <ul className="mt-3 space-y-2">
                {releaseContract.validations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300">Mission Lock</p>
          <div className="mt-4 space-y-4 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">{missionLock.northStar}</div>
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Immutable Constraints</p>
              <ul className="mt-3 space-y-2">
                {missionLock.immutableConstraints.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Non-Goals</p>
                <ul className="mt-3 space-y-2">
                  {missionLock.nonGoals.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Proof Requirements</p>
                <ul className="mt-3 space-y-2">
                  {missionLock.proofRequirements.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            {missionLock.driftRisks.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Drift Risks</p>
                <ul className="mt-3 space-y-2">
                  {missionLock.driftRisks.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-lime-300">Proof Gate</p>
          <div className="mt-4 space-y-4 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Trust Score</p>
              <div className="mt-3 flex items-center gap-3">
                <span className="rounded-full border border-white/10 px-3 py-1 text-xs uppercase tracking-[0.25em] text-white">
                  {proofGate.status}
                </span>
                <span className="text-3xl font-semibold text-white">{proofGate.trustScore}</span>
              </div>
              <p className="mt-3">{proofGate.nextAction}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Supported Claims</p>
                <ul className="mt-3 space-y-2">
                  {proofGate.supportedClaims.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                {!proofGate.supportedClaims.length ? <p className="mt-3 text-slate-300">No proof-backed claims yet.</p> : null}
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Missing Evidence</p>
                <ul className="mt-3 space-y-2">
                  {proofGate.missingEvidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
            {proofGate.unsupportedClaims.length ? (
              <div className="rounded-2xl border border-rose-400/30 bg-rose-500/10 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-rose-200">Unsupported Claims</p>
                <ul className="mt-3 space-y-2 text-rose-100">
                  {proofGate.unsupportedClaims.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Blast Radius Simulator</p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Risk Score</p>
            <p className="mt-2 text-4xl font-semibold text-white">{blastRadius.score}</p>
            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-400">Impacted Areas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {blastRadius.impactedAreas.map((item) => (
                <span key={item} className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-100">
                  {item}
                </span>
              ))}
            </div>
            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-400">Watchouts</p>
            <ul className="mt-3 space-y-2">
              {blastRadius.watchouts.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <p className="mt-4 text-xs uppercase tracking-[0.25em] text-slate-400">Required Checks</p>
            <ul className="mt-3 space-y-2">
              {blastRadius.requiredChecks.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            {blastRadius.releaseBlockers.length ? (
              <>
                <p className="mt-4 text-xs uppercase tracking-[0.25em] text-rose-300">Release Blockers</p>
                <ul className="mt-3 space-y-2 text-rose-100">
                  {blastRadius.releaseBlockers.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-fuchsia-300">Ops Ledger</p>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            {ledger.length ? (
              ledger.map((entry, index) => (
                <div key={`${entry.provider}-${entry.model}-${index}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    {entry.provider} / {entry.model} / {entry.status} / {entry.durationMs}ms
                  </p>
                  <p className="mt-2">{entry.note}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                Run a prompt to start building the request ledger and fallback guidance.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-violet-300">Model Jury</p>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
              {jury?.synthesis || 'Run the jury to compare ballots across the active provider, Ollama, and LM Studio presets.'}
            </div>
            {preflight?.juryRecommendation?.length ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">Recommended Jury</p>
                <ul className="mt-3 space-y-2">
                  {preflight.juryRecommendation.map((entry) => (
                    <li key={`${entry.provider}-${entry.model}`}>
                      {entry.provider} / {entry.model} - {entry.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {jury?.ballots.map((ballot) => (
              <div key={`${ballot.provider}-${ballot.model}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  {ballot.provider} / {ballot.model} / {ballot.ok ? 'success' : 'error'} / {ballot.durationMs}ms
                </p>
                <p className="mt-2 whitespace-pre-wrap">{ballot.output || ballot.error}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-teal-300">Ship Memo Autowriter</p>
          <pre className="mt-4 whitespace-pre-wrap rounded-2xl border border-white/10 bg-white/5 p-4 text-sm leading-7 text-slate-100">
            {shipMemo}
          </pre>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-sky-300">Session Capsule</p>
          <p className="mt-3 text-sm text-slate-300">
            Preserve the exact prompt, provider lane, and release state so another surface can resume without rebuilding context from memory.
          </p>
          <textarea
            readOnly
            value={sessionCapsule}
            rows={6}
            className="mt-4 w-full rounded-3xl border border-white/10 bg-slate-900 px-4 py-3 text-xs text-white"
          />
          <textarea
            value={capsuleInput}
            onChange={(event) => setCapsuleInput(event.target.value)}
            rows={5}
            placeholder="Paste a CodeOrbit session capsule to restore a run."
            className="mt-4 w-full rounded-3xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white"
          />
          <button
            type="button"
            onClick={() => {
              try {
                loadSessionCapsule()
              } catch (capsuleError) {
                setError(capsuleError instanceof Error ? capsuleError.message : 'Failed to load session capsule.')
              }
            }}
            className="mt-4 rounded-full border border-sky-400/40 px-5 py-3 text-sm text-sky-100 transition hover:border-sky-300 hover:text-white"
          >
            Load session capsule
          </button>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">Continuity Vault</p>
          <p className="mt-3 text-sm text-slate-300">
            Automatic local snapshots of the workbench state so a good run survives refreshes, interruptions, and surface changes.
          </p>
          <div className="mt-4 space-y-3">
            {vaultSnapshots.length ? (
              vaultSnapshots.map((snapshot) => (
                <div key={snapshot.id} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                  <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                    {snapshot.createdAt} / {snapshot.readinessScore ?? '--'} / {snapshot.gate || 'draft'}
                  </p>
                  <p className="mt-2 font-medium text-white">{snapshot.label}</p>
                  <p className="mt-2 text-slate-300">{snapshot.outputPreview || 'No output saved yet. Snapshot captured from preflight or draft state.'}</p>
                  <button
                    type="button"
                    onClick={() => restoreVaultSnapshot(snapshot)}
                    className="mt-3 rounded-full border border-cyan-400/40 px-4 py-2 text-xs text-cyan-100 transition hover:border-cyan-300 hover:text-white"
                  >
                    Restore snapshot
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
                Run preflight or execute a prompt to start the continuity vault.
              </div>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-orange-300">Recovery Playbook</p>
          <div className="mt-4 space-y-3 text-sm text-slate-200">
            {(preflight?.recoveryPlan || []).map((lane) => (
              <div key={`${lane.provider}-${lane.model}-${lane.trigger}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                  {lane.provider} / {lane.model} / {lane.trigger}
                </p>
                <p className="mt-2">{lane.reason}</p>
              </div>
            ))}
            {(preflight?.opsPlaybook || []).map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                {item}
              </div>
            ))}
            {!preflight ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                Run preflight to generate fallback steps for auth, missing models, and high-risk prompts.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-slate-950/70 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-amber-300">Latest Output</p>
          <div className="mt-4 rounded-3xl bg-slate-900 p-4">
            <p className="mb-3 text-xs uppercase tracking-[0.3em] text-slate-500">
              {result ? `${result.provider} / ${result.model}` : 'Awaiting run'}
            </p>
            {result?.attempts?.length ? (
              <div className="mb-4 space-y-2">
                {result.attempts.map((attempt) => (
                  <div key={`${attempt.provider}-${attempt.model}-${attempt.baseUrl}`} className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-slate-200">
                    <p className="text-xs uppercase tracking-[0.25em] text-slate-400">
                      {attempt.provider} / {attempt.model} / {attempt.ok ? 'success' : 'failed'}
                    </p>
                    <p className="mt-2">{attempt.note}</p>
                  </div>
                ))}
              </div>
            ) : null}
            <pre className="max-h-[32rem] overflow-auto whitespace-pre-wrap text-sm leading-6 text-slate-100">
              {result?.output || 'Run a prompt to generate plan, implementation notes, validation, and remaining risk sections.'}
            </pre>
          </div>
        </div>
      </section>
      </div>
    </div>
  )
}
