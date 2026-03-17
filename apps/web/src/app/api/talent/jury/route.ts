import { NextResponse } from 'next/server'

import { runTalentPrompt, type TalentRequest } from '@/lib/talent/provider-client'

type JuryMember = {
  provider: TalentRequest['provider']
  model: string
  baseUrl?: string
  apiKey?: string
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      prompt: string
      workspaceContext?: string
      members: JuryMember[]
    }

    const members = body.members.slice(0, 3)

    const ballots = await Promise.all(
      members.map(async (member) => {
        const startedAt = Date.now()

        try {
          const output = await runTalentPrompt({
            provider: member.provider,
            model: member.model,
            baseUrl: member.baseUrl,
            apiKey: member.apiKey,
            prompt: body.prompt,
            workspaceContext: body.workspaceContext,
          })

          return {
            ...member,
            ok: true,
            durationMs: Date.now() - startedAt,
            output,
          }
        } catch (error) {
          return {
            ...member,
            ok: false,
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : 'Jury member failed.',
          }
        }
      })
    )

    const successful = ballots.filter((ballot) => ballot.ok)
    const synthesis = successful.length
      ? `Jury completed with ${successful.length}/${ballots.length} successful ballots. Fastest successful member: ${
          successful.sort((left, right) => left.durationMs - right.durationMs)[0].model
        }.`
      : 'No jury members completed successfully. Use the Ops Ledger and fallback guidance before retrying.'

    return NextResponse.json({
      ballots,
      synthesis,
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Talent jury request failed.',
      },
      { status: 500 }
    )
  }
}
