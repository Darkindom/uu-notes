const ONBOARDING_TUTORIAL_KEY_PREFIX = 'onboarding_tutorial_seen'

interface TutorialStorage {
  getStorageSync: (key: string) => unknown
  setStorageSync: (key: string, value: unknown) => void
}

export function getOnboardingTutorialKey(userId?: number | string | null): string {
  return userId ? `${ONBOARDING_TUTORIAL_KEY_PREFIX}_${userId}` : `${ONBOARDING_TUTORIAL_KEY_PREFIX}_global`
}

export function hasSeenOnboardingTutorial(
  storage: TutorialStorage,
  userId?: number | string | null,
): boolean {
  return Boolean(storage.getStorageSync(getOnboardingTutorialKey(userId)))
}

export function markOnboardingTutorialSeen(
  storage: TutorialStorage,
  userId?: number | string | null,
): void {
  storage.setStorageSync(getOnboardingTutorialKey(userId), true)
}
