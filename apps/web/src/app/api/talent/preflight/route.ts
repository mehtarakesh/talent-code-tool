import { NextResponse } from 'next/server'

import { buildPreflightAssessment, type PreflightInput } from '@/lib/talent/preflight'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PreflightInput
    const assessment = buildPreflightAssessment(body)

    return NextResponse.json(assessment)
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Preflight request failed.',
      },
      { status: 500 }
    )
  }
}
