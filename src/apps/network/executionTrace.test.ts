import { describe, expect, it } from 'vitest'
import { operationPhases, reachedPhases } from './executionTrace'
import type { TargetOperation } from './targetProjection'

function operation(kind: TargetOperation['kind'], percent: number): TargetOperation {
  return { kind, title: 'OPERATION', percent, facts: [] }
}

describe('NodeScan execution trace', () => {
  it('reveals a mark only once canonical progress has actually reached it', () => {
    const marks = (percent: number) => reachedPhases(operation('credential_access', percent)).map(({ label }) => label)

    expect(marks(0)).toEqual(['PROVIDER LINKED'])
    expect(marks(7)).toEqual(['PROVIDER LINKED'])
    expect(marks(8)).toEqual(['PROVIDER LINKED', 'ROUTE SELECTED'])
    expect(marks(100)).toEqual(operationPhases('credential_access').map(({ label }) => label))
  })

  it('derives the same trace every time, so leaving a running target and returning changes nothing', () => {
    const running = operation('service_analysis', 61)

    expect(reachedPhases(running)).toEqual(reachedPhases(operation('service_analysis', 61)))
    // Progress only ever adds marks; it never rewrites or removes one already passed.
    expect(reachedPhases(operation('service_analysis', 90))).toEqual(expect.arrayContaining([...reachedPhases(running)]))
  })

  it('states only the operation acting on itself, never an observation of the target', () => {
    const kinds = ['service_analysis', 'credential_access', 'rack_update_exploit', 'package_submission'] as const
    const labels = kinds.flatMap((kind) => operationPhases(kind).map(({ label }) => label))

    // A mark is procedural choreography. Anything that would read as a finding
    // belongs to the projection, which derives it from represented state.
    expect(labels.filter((label) => /FOUND|DETECTED|DISCOVERED|OPEN|VULNERABLE|CREDENTIAL[S] |BYTES|PACKETS|HOSTS/.test(label))).toEqual([])
    expect(kinds.every((kind) => operationPhases(kind)[0].at === 0)).toBe(true)
    expect(kinds.every((kind) => operationPhases(kind).every(({ at }, index, all) => index === 0 || at > all[index - 1].at))).toBe(true)
  })
})
