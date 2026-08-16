export interface VerticalScrollState {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}

export function canOwnVerticalGesture(
  { scrollTop, clientHeight, scrollHeight }: VerticalScrollState,
  fingerDeltaY: number,
): boolean {
  const maxScrollTop = Math.max(0, scrollHeight - clientHeight)

  if (maxScrollTop === 0 || fingerDeltaY === 0) return false
  if (fingerDeltaY > 0) return scrollTop > 0
  return scrollTop < maxScrollTop
}
