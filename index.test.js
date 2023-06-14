const process = require('process')
const cp = require('child_process')
const path = require('path')
const { expect, test } = require('@jest/globals')

const fileEndings = 'INPUT_FILEENDINGS'
const translationFunctions = 'INPUT_TRANSLATIONFUNCTIONS'
const translationFile = 'INPUT_TRANSLATIONFILE'
const findSimilarStrs = 'INPUT_FINDSIMILARSTRS'
const folders = 'INPUT_FOLDERS'

// Should fail and show errors with translations
test('test failure runs', () => {
  process.env[fileEndings] = `
    js
  `
  process.env[translationFunctions] = `
    $t
  `
  process.env[translationFile] = 'test-env/failure-env/lang/en.json'
  process.env[findSimilarStrs] = 'true'
  process.env[folders] = `
    test-env/failure-env
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
    expect(
      output.includes('test-env/failure-env/src/main.js:23:20')
    ).toBeTruthy()

    // console.log(output)
  }
})

// Should fail and show errors with translations
test('test successfull runs', () => {
  process.env[fileEndings] = `
    js
  `
  process.env[translationFunctions] = `
    $t
  `
  process.env[translationFile] = 'test-env/success-env/lang/en.json'
  process.env[findSimilarStrs] = 'true'
  process.env[folders] = `
    test-env/success-env
  `

  const ip = path.join(__dirname, 'index.js')
  try {
    const output = cp
      .execSync(`node ${ip}`, { env: process.env })
      .toString()

    // Basic tests to check for
    expect(
      output.includes('Total number of missing translations: 0')
    ).toBeTruthy()
    expect(
      output.includes('Total number of unused translations: 1')
    ).toBeTruthy()
    expect(
      output.includes('No missing translations found 🥳 good job!!')
    ).toBeTruthy()
  } catch (e) {
    // Our setup in test-env should cause the action to fail, this should catch such issues.
    expect(true).toBe(false)
  }
})
