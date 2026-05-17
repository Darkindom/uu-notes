const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function loadVoiceAnalysisModule() {
  const filename = path.join(__dirname, '..', 'src', 'utils', 'voiceAnalysis.ts')
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

test('builds voice record payload without dropping extra details', () => {
  const { buildVoiceRecordPayload } = loadVoiceAnalysisModule()

  assert.deepEqual(
    buildVoiceRecordPayload(
      7,
      {
        category: 'shit',
        subCategory: 'big',
        value: '2',
        extra: { color: 'black' },
        note: '大便量多，颜色黑色',
      },
      'fallback',
      123456,
    ),
    {
      babyId: 7,
      category: 'shit',
      subCategory: 'big',
      startTime: 123456,
      value: '2',
      extra: { color: 'black' },
      note: '大便量多，颜色黑色',
    },
  )
})

test('formats voice review text from final saved details', () => {
  const { formatVoiceAnalysisReview } = loadVoiceAnalysisModule()

  assert.equal(
    formatVoiceAnalysisReview({
      category: 'food',
      subCategory: 'babycook',
      value: '',
      extra: { food_type: '番薯粥、肉骨汤' },
    }),
    '吃 · 辅食 · 番薯粥、肉骨汤',
  )

  assert.equal(
    formatVoiceAnalysisReview({
      category: 'shit',
      subCategory: 'big',
      value: '2',
      extra: { color: 'black' },
    }),
    '拉 · 大便 · 量多 · 黑',
  )
})
