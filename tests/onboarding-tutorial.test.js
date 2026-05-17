const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function loadOnboardingTutorialModule() {
  const filename = path.join(__dirname, '..', 'src', 'utils', 'onboardingTutorial.ts')
  const source = fs.readFileSync(filename, 'utf8')
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2017,
    },
  })

  const mod = new Module(filename, module)
  mod.filename = filename
  mod.paths = Module._nodeModulePaths(path.dirname(filename))
  mod._compile(outputText, filename)
  return mod.exports
}

function createStorage(initial = {}) {
  const data = { ...initial }
  return {
    getStorageSync(key) {
      return data[key]
    },
    setStorageSync(key, value) {
      data[key] = value
    },
  }
}

test('uses a user-scoped onboarding tutorial storage key with a global fallback', () => {
  const { getOnboardingTutorialKey } = loadOnboardingTutorialModule()

  assert.equal(getOnboardingTutorialKey(42), 'onboarding_tutorial_seen_42')
  assert.equal(getOnboardingTutorialKey(null), 'onboarding_tutorial_seen_global')
})

test('marks onboarding tutorial as seen as soon as it is shown', () => {
  const {
    hasSeenOnboardingTutorial,
    markOnboardingTutorialSeen,
  } = loadOnboardingTutorialModule()
  const storage = createStorage()

  assert.equal(hasSeenOnboardingTutorial(storage, 42), false)
  markOnboardingTutorialSeen(storage, 42)
  assert.equal(hasSeenOnboardingTutorial(storage, 42), true)
})
