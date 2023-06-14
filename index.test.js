const process = require('process')
const cp = require('child_process')
const path = require('path')

const fileEndings = 'INPUT_FILEENDINGS'
const translationFunctions = 'INPUT_TRANSLATIONFUNCTIONS'
const translationFile = 'INPUT_TRANSLATIONFILE'
const findSimilarStrs = 'INPUT_FINDSIMILARSTRS'
const folders = 'INPUT_FOLDERS'

// shows how the runner will run a javascript action with env / stdout protocol
test('test runs', () => {
  process.env[fileEndings] = `
    js
  `
  process.env[translationFunctions] = `
    $t
  `
  process.env[translationFile] = 'test-env/lang/en.json'
  process.env[findSimilarStrs] = 'true'
  process.env[folders] = `
    test-env
  `

  const ip = path.join(__dirname, 'index.js')
  try {
    const result = cp
      .execSync(`node ${ip}`, { env: process.env })
      .toString()
    console.log(result)
  } catch (e) {
    console.error(e)
  }
})
