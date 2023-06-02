const path = require("path")
const fs   = require("fs")
const fsPromises = fs.promises
const Lsh = require('@agtabesh/lsh')
const levenshteinDistance = require('./levensteinDistance.js')
const core = require('@actions/core')


// Console colors used
const Reset = "\x1b[0m"
const FgRed = "\x1b[31m"
const FgGreen = "\x1b[32m"
const FgYellow = "\x1b[33m"
const FgMagenta = "\x1b[35m"

// How far in are we tabbing our output
const baseTabs = '\t'



function log() {
    if (core.info) {
        core.info(...arguments)
    } else {
        console.log(...arguments)
    }
}

function createIgnoreFile(ignoreTrans, ignoreTranslationFile) {
  try {
    fs.writeFileSync(ignoreTranslationFile, JSON.stringify(ignoreTrans))
  } catch (err) {
    core.debug(err)
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
  let files  = []
  for (const directory of folders) {
    fs.readdirSync(directory).forEach(file => {
      const absolute = path.join(directory, file)
      if (fs.statSync(absolute).isDirectory()) {
        files = files.concat(getAllFiles(fileEndings, [absolute]))
      } else if (fileEndings.some(end => file.endsWith(`.${end}`))) {
        files.push(absolute)
      }
    })
  }

  return files
}

async function findAllTranslations(files, translationRegex, ignoreTranslationFile) {
  const translations = {}
  const ignoreFile = loadIgnoreFile(ignoreTranslationFile)

  for (const file of files) {
    const data = await fsPromises.readFile(file, "utf8")

    translationRegex.forEach(regex => {

      for (const match of data.toString().matchAll(regex)) {
        const key = match?.groups?.translation.replace('\\', '')

        if (ignoreFile?.[`${file}:${match.index}`]) continue


        
        const lineIndexes = match.indices[0]
        const columnIndexes = match.indices[1]

        const lineStart = match.input.substr(0, lineIndexes[0]).split('\n').length
        const lineEnd = match.input.substr(0, lineIndexes[1]).split('\n').length
        
        const columnStart = match.input.substr(0, columnIndexes[0]).split('\n').pop().length
        const columnEnd = match.input.substr(0, columnIndexes[1]).split('\n').pop().length
        
        const location = {
          file,
          index: match.index,
          area: match.input.slice(Math.max(match.index-100, 0), Math.min(match.index+key.length+100, match.input.length)),
          lineStart,
          lineEnd,
          columnStart,
          columnEnd
        }

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


async function main(env) {
    const fileEndings = env.fileEndings || ['js', 'ts', 'vue', 'php']
    const folders = env.folders || []
    const translationFunctions = env.translationFunctions || ['$t', '$tc', '@lang', '__']
    const hyphen = env.hyphen || ['"', "'", '`']

    const translationFile = env.translationFile || 'lang/en.json'

    const findSimilarStrs = env.findSimilarStrs // Quite slow if set to true
    const similarDist = env.similarDist || 1

    const createRegex = (acc, hyph) => 
        acc.concat(
            translationFunctions.map(str => 
                new RegExp(`${str.replace('$', '\\$')}\\(\\n?\\s*[${hyph}](?<translation>([^${hyph}])+)[${hyph}]([,.\\n\\s]+)?[\\)\\{\\[]`, 'dg')
                )
            )

    const translationRegex = hyphen.reduce(createRegex, [])


    const ignoreTranslationFile = './.ignoretrans'


    const files = getAllFiles(fileEndings, folders)
    const translations = await findAllTranslations(files, translationRegex, ignoreTranslationFile)
    const uniqueTranslations = Object.keys(translations)

    const translationsJSONRaw = await fsPromises.readFile(translationFile)
    const translationJSON = JSON.parse(translationsJSONRaw.toString())
    const jsonArr = Object.keys(translationJSON)

    const missingTranslations = uniqueTranslations.filter(key => translationJSON[key] === undefined || translationJSON[key] === '')
    const unusedTranslations = jsonArr.filter(key => translations[key] === undefined)

    const shingleSize = 6

    const config = {
        storage: 'memory',
        shingleSize,
        numberOfHashFunctions: 120
    }

    const lsh = Lsh.getInstance(config)

    if (findSimilarStrs) {
        for (const [i, doc] of jsonArr.entries()) {
            try {
                lsh.addDocument(i, doc.padStart(Math.max(shingleSize-doc.length+5, 0), ' '))
            } catch (e) {
                log(doc)
            }
        }
    }


    for (const trans of missingTranslations) {

        let similar = []

        if (findSimilarStrs) {
            const q = {
                text: trans.padStart(Math.max(shingleSize-trans.length+5, 0), ' '),
            }
            const result = lsh.query(q)

            similar = result.map(i => jsonArr[i])
                .filter(k => !(k.length >= trans.length + similarDist && k.length <= trans.length - similarDist))
                .map(k => [levenshteinDistance(k, trans), k])
                .filter(v => v[0] <= similarDist)
                .map(v => v[1])
        }
        

        const similarStr = similar.length > 0 && similar[0] !== trans ? `\n${baseTabs}\t${FgGreen}Similar to: ${similar[0]}${Reset}` : ''


        const emptyStrMsg = translationJSON[trans] === '' ? `\n${baseTabs}\t${FgYellow}This key does exist in ${translationFile} but there is no translation given.\n${baseTabs}\tConsider adding a translation for this key.${Reset}` : ''

        const msg = `
${baseTabs}${FgRed}Missing translation for:${Reset}${FgMagenta} "${trans}"${Reset} ${emptyStrMsg}${similarStr} 
${baseTabs}\t${FgYellow}Found in: 
${baseTabs}\t\t${translations[trans].reduce((acc, loc) => `${acc}${loc.file}:${loc.lineStart}:${loc.columnStart}\n        `,'')}
${Reset}`
        core.info(msg)
        for (const t of translations[trans]) {
          core.error('', {
            title: `Missing translation for: "${trans}"`,
            file: t.file,
            startLine: t.lineStart,
            endLine: t.lineEnd,
            startColumn: t.columnStart,
            endColumn: t.columnEnd
          })
        }
    }


    log(
        `${baseTabs}${FgGreen}Total number of missing translations: ${missingTranslations.length} out of found translations: ${uniqueTranslations.length}${Reset}`
    )
    log(
        `${baseTabs}${FgGreen}Total number of unused translations: ${unusedTranslations.length} out of total translations: ${jsonArr.length}${Reset}`
    )


    if (env.createIgnore) {
      log('Creating and saving ignore file')
      const ignoreKey = locs => locs.reduce((acc, trans) => ({...acc, [`${trans.file}:${trans.index}`]: true}), {})
      createIgnoreFile(missingTranslations.reduce((acc, key) => ({...acc, ...ignoreKey(translations[key])}), {}), ignoreTranslationFile) 
    }

    return { missingTranslations, uniqueTranslations, unusedTranslations, translations: jsonArr }
}

module.exports = main
