const test = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const Module = require('node:module')
const ts = require('typescript')

function loadFormatModule() {
  const filename = path.join(__dirname, '..', 'src', 'utils', 'format.ts')
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

test('formats fruit and snack records with name and optional amount', () => {
  const { formatRecordSummary } = loadFormatModule()

  assert.equal(
    formatRecordSummary({
      category: 'food',
      subCategory: 'fruit',
      value: '半个',
      extra: { food_type: '苹果' },
    }),
    '水果 苹果 半个',
  )

  assert.equal(
    formatRecordSummary({
      category: 'food',
      subCategory: 'snack',
      value: '',
      extra: { food_type: '虾条' },
    }),
    '零食 虾条',
  )
})

test('keeps babycook scale summary and food detail behavior', () => {
  const { formatRecordSummary, getFoodTypeDetail } = loadFormatModule()
  const record = {
    category: 'food',
    subCategory: 'babycook',
    value: '1',
    extra: { food_type: '番薯粥' },
  }

  assert.equal(formatRecordSummary(record), '辅食 中')
  assert.equal(getFoodTypeDetail(record), '番薯粥')
})

test('identifies solid food subcategories used by food stats', () => {
  const { isSolidFoodSubCategory } = loadFormatModule()

  assert.equal(isSolidFoodSubCategory('babycook'), true)
  assert.equal(isSolidFoodSubCategory('fruit'), true)
  assert.equal(isSolidFoodSubCategory('snack'), true)
  assert.equal(isSolidFoodSubCategory('water'), false)
  assert.equal(isSolidFoodSubCategory('milk'), false)
})
