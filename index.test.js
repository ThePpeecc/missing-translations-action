const process = require('process')
const cp = require('child_process')
const path = require('path')
const { expect, test } = require('@jest/globals')

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
    cp.execSync(`node ${ip}`, { env: process.env }).toString()

    // Our setup in test-env should cause the action to fail, this should catch such issues.
    expect(true).toBe(false)
  } catch (e) {
    const output = e.stdout.toString('utf8')

    // Basic tests to check for
    expect(output.includes('Missing translation for:')).toBeTruthy()
    expect(output.includes('This key does exist in ')).toBeTruthy()
    expect(output.includes('Found in:')).toBeTruthy()
    expect(output.includes('test-env/src/main.js:23:20')).toBeTruthy()

    console.log(output)
  }
})
