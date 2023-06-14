const core = require('@actions/core')
const {
  createTranslationsOverview,
} = require('./src/createTranslationsOverview')

function parseArray(multiLineStr) {
  return multiLineStr.split('\n')
}

async function run() {
  try {
    const {
      logList,
      missingTranslations,
      uniqueTranslations,
      unusedTranslations,
      translations,
      translationKeys,
    } = await createTranslationsOverview(
      {
        fileEndings: parseArray(core.getInput('fileEndings')),
        folders: parseArray(core.getInput('folders')),
        translationFunctions: parseArray(
          core.getInput('translationFunctions')
        ),
        hyphen:
          core.getInput('hyphen') !== ''
            ? parseArray(core.getInput('hyphen'))
            : null,
        translationFile: core.getInput('translationFile'),
        findSimilarStrs: core.getInput('findSimilarStrs') === 'true',
        similarDist: parseInt(core.getInput('similarDist')),
        createIgnore: core.getInput('createIgnore') === 'true',
      },
      core.info // Sets the log function
    )

    for (const { msg, translation } of logList) {
      core.info(msg)
      for (const t of translations[translation]) {
        core.error('', {
          title: `Missing translation for: "${translation}"`,
          file: t.file,
          startLine: t.lineStart,
          endLine: t.lineEnd,
          startColumn: t.columnStart,
          endColumn: t.columnEnd,
        })
      }
    }

    core.info(
      `${baseTabs}${FgGreen}Total number of missing translations: ${missingTranslations.length} out of found translations: ${uniqueTranslations.length}${Reset}`
    )
    core.info(
      `${baseTabs}${FgGreen}Total number of unused translations: ${unusedTranslations.length} out of total translations: ${translationKeys.length}${Reset}`
    )

    // if (missingTranslations.length > 0) {
    //   core.setFailed('Found some translations missing')
    // }

    core.setOutput('missingTranslations', missingTranslations)
    core.setOutput('uniqueTranslations', uniqueTranslations)
    core.setOutput('unusedTranslations', unusedTranslations)
    core.setOutput('translationKeys', translationKeys)
    core.setOutput('translations', translations)
  } catch (error) {
    // core.setFailed(error.message)
    console.log(error)
  }
}

run()
