const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function loadTutorialStepsModule() {
  const filename = path.join(__dirname, '..', 'src', 'utils', 'tutorialSteps.ts')
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

test('tutorial steps include one compact visual for each onboarding step', () => {
  const { TUTORIAL_STEPS } = loadTutorialStepsModule()

  assert.deepEqual(
    TUTORIAL_STEPS.map((step) => step.visual),
    ['add-baby', 'record-milk', 'records-list', 'baby-chart'],
  )
  assert.equal(TUTORIAL_STEPS.length, 4)
})
