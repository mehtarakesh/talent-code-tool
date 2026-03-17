export {}

declare global {
  interface Window {
    talentDesktop: {
      runPrompt: (payload: Record<string, string>) => Promise<string>
    }
  }
}
