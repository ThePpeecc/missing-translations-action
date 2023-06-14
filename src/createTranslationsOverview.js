const path = require('path')
const fs = require('fs')
const fsPromises = fs.promises
const { Minhash, LshIndex } = require('minhash')
const levenshteinDistance = require('./levensteinDistance.js')
const core = require('@actions/core')
const {
  Reset,
  FgRed,
  FgGreen,
  FgYellow,
  FgMagenta,
  baseTabs,
} = require('./consoleConsts')

let log = () => console.log(...arguments)

function createIgnoreFile(ignoreTrans, ignoreTranslationFile) {
  try {
    fs.writeFileSync(
      ignoreTranslationFile,
      JSON.stringify(ignoreTrans)
    )
  } catch (err) {
    core.debug(err)
  }
}

module.exports.createIgnoreFile = function (
  env,
  missingTranslations,
  translations
) {
  if (env.createIgnore) {
    log('Creating and saving ignore file')
    const ignoreKey = (locs) =>
      locs.reduce(
        (acc, trans) => ({
          ...acc,
          [`${trans.file}:${trans.index}`]: true,
        }),
        {}
      )
    createIgnoreFile(
      missingTranslations.reduce(
        (acc, key) => ({ ...acc, ...ignoreKey(translations[key]) }),
        {}
      ),
      env.ignoreTranslationFile
    )
  }
}

function loadIgnoreFile(ignoreTranslationFile) {
  try {
    return JSON.parse(fs.readFileSync(ignoreTranslationFile, 'utf-8'))
  } catch (_) {
    return false // We probably don't have an ignorefile
  }
}

function getAllFiles(fileEndings, folders) {
  let files = []
  for (const directory of folders) {
    fs.readdirSync(directory).forEach((file) => {
      const absolute = path.join(directory, file)
      if (fs.statSync(absolute).isDirectory()) {
        files = files.concat(getAllFiles(fileEndings, [absolute]))
      } else if (
        fileEndings.some((end) => file.endsWith(`.${end}`))
      ) {
        files.push(absolute)
      }
    })
  }

  return files
}

function* findTranslations(data, regex, fileName, ignoreFile) {
  for (const match of data.toString().matchAll(regex)) {
    const key = match?.groups?.translation

    // Could be improved by checking locality as well as index
    if (ignoreFile?.[`${fileName}:${match.index}`]) continue

    const lineIndexes = match.indices[0]
    const columnIndexes = match.indices[1]

    const lineStart = match.input
      .substr(0, lineIndexes[0])
      .split('\n').length
    const lineEnd = match.input
      .substr(0, lineIndexes[1])
      .split('\n').length

    const columnStart = match.input
      .substr(0, columnIndexes[0])
      .split('\n')
      .pop().length
    const columnEnd = match.input
      .substr(0, columnIndexes[1])
      .split('\n')
      .pop().length

    const location = {
      file: fileName,
      index: match.index,
      area: match.input.slice(
        Math.max(match.index - 100, 0),
        Math.min(match.index + key.length + 100, match.input.length)
      ),
      lineStart,
      lineEnd,
      columnStart,
      columnEnd,
    }

    yield { location, key }
  }
}

async function findAllTranslations(
  files,
  regexes,
  ignoreTranslationFile
) {
  const translations = {}
  const ignoreFile = loadIgnoreFile(ignoreTranslationFile)

  for (const file of files) {
    const data = await fsPromises.readFile(file, 'utf8')

    regexes.forEach((regex) => {
      for (const { location, key } of findTranslations(
        data,
        regex,
        file,
        ignoreFile
      )) {
        if (translations[key]) {
          translations[key].push(location)
        } else {
          translations[key] = [location]
        }
      }
    })
  }

  return translations
}

function loadEnvData(env) {
  const fileEndings = env.fileEndings || ['js', 'ts', 'vue', 'php']
  const folders = env.folders || []
  const translationFunctions = env.translationFunctions || [
    '$t',
    '$tc',
    '@lang',
    '__',
  ]
  const hyphen = env.hyphen || ['"', "'", '`']

  const translationFile = env.translationFile || 'lang/en.json'

  const findSimilarStrs = env.findSimilarStrs // Quite slow if set to true
  const similarDist = env.similarDist || 1

  const ignoreTranslationFile = './.ignoretrans'

  return {
    fileEndings,
    folders,
    translationFunctions,
    hyphen,
    translationFile,
    findSimilarStrs,
    similarDist,
    ignoreTranslationFile,
    createIgnore: !!env.createIgnore,
  }
}

async function loadTranslationFile(translationFile) {
  const raw = await fsPromises.readFile(translationFile)
  const json = JSON.parse(raw.toString())
  const keys = Object.keys(json)

  return { raw, json, keys }
}

function createHashInstance(doc) {
  const m = new Minhash()
  doc.split(' ').map((w) => m.update(w))
  return m
}

function buildLocalitySearch(keys) {
  const lsh = new LshIndex()

  for (const [i, doc] of keys.entries()) {
    try {
      lsh.insert(i, createHashInstance(doc))
    } catch (e) {
      log(doc)
    }
  }

  return lsh
}

function* createLogs(
  {
    missingTranslations,
    translationKeys,
    translationJSON,
    translations,
  },
  env
) {
  const { translationFile, findSimilarStrs, similarDist } =
    loadEnvData(env)

  let lsh
  for (const trans of missingTranslations) {
    let similar = []
    if (findSimilarStrs) {
      if (!lsh) lsh = buildLocalitySearch(translationKeys)

      const h = createHashInstance(trans)
      lsh.insert(trans, h)
      const result = lsh.query(h)

      similar = result
        .map((i) => translationKeys[i])
        .filter((str) => !!str)
        .filter(
          (k) =>
            !(
              k.length >= trans.length + similarDist &&
              k.length <= trans.length - similarDist
            )
        )
        .map((k) => [levenshteinDistance(k, trans), k])
        .filter((v) => v[0] <= similarDist)
        .map((v) => v[1])
    }

    const similarStr =
      similar.length > 0 && similar[0] !== trans
        ? `\n${baseTabs}\t${FgGreen}Similar to: ${similar[0]}${Reset}`
        : ''

    const emptyStrMsg =
      translationJSON[trans] === ''
        ? `\n${baseTabs}\t${FgYellow}This key does exist in ${translationFile} but there is no translation given.\n${baseTabs}\tConsider adding a translation for this key.${Reset}`
        : ''

    const msg = `
${baseTabs}${FgRed}Missing translation for:${Reset}${FgMagenta} "${trans}"${Reset} ${emptyStrMsg}${similarStr} 
${baseTabs}\t${FgYellow}Found in: 
${baseTabs}\t\t${translations[trans].reduce(
      (acc, loc) =>
        `${acc}${loc.file}:${loc.lineStart}:${loc.columnStart}\n${baseTabs}\t\t`,
      ''
    )}
${Reset}`

    yield {
      msg,
      translation: trans,
      similarStrings: similarStr,
    }
  }
}

function createRegexes(env) {
  const { translationFunctions, hyphen } = loadEnvData(env)

  const reducer = (acc, hyph) =>
    acc.concat(
      translationFunctions.map(
        (str) =>
          new RegExp(
            `${str.replaceAll(
              '$',
              '\\$'
            )}\\(\\n?\\s*[${hyph}](?<translation>([^${hyph}])+)[${hyph}]([,.\\n\\s]+)?[\\)\\{\\[]`,
            'dg'
          )
      )
    )

  return hyphen.reduce(reducer, [])
}

module.exports.createTranslationsOverview = async function (
  env,
  logFunc
) {
  if (logFunc) log = logFunc // Set the logging function, default is just console.log
  const {
    fileEndings,
    folders,
    translationFile,
    ignoreTranslationFile,
  } = loadEnvData(env)

  const regexes = createRegexes(env)

  const files = getAllFiles(fileEndings, folders)
  const translations = await findAllTranslations(
    files,
    regexes,
    ignoreTranslationFile
  )
  const uniqueTranslations = Object.keys(translations)

  const { keys: translationKeys, json: translationJSON } =
    await loadTranslationFile(translationFile)

  const missingTranslations = uniqueTranslations.filter(
    (key) =>
      translationJSON[key] === undefined ||
      translationJSON[key] === ''
  )

  const unusedTranslations = translationKeys.filter(
    (key) => translations[key] === undefined
  )

  const logList = createLogs(
    {
      missingTranslations,
      translationJSON,
      translationKeys,
      translations,
    },
    env
  )

  return {
    logList,
    missingTranslations,
    uniqueTranslations,
    unusedTranslations,
    translations,
    translationKeys,
  }
}
