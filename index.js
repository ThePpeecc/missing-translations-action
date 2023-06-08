const core = require('@actions/core')
const missingTranslationsAction = require('./missing-translations')

function parseArray(multiLineStr) {
  return multiLineStr.split('\n')
}

async function run() {
  try {    

    const { missingTranslations, uniqueTranslations, unusedTranslations, translations } = await missingTranslationsAction({
      fileEndings: parseArray(core.getInput('fileEndings')),
      folders: parseArray(core.getInput('folders')),
      translationFunctions: parseArray(core.getInput('translationFunctions')),
      hyphen: core.getInput('hyphen') !== '' ? parseArray(core.getInput('hyphen')) : '',
      translationFile: core.getInput('translationFile'),
      findSimilarStrs: core.getInput('findSimilarStrs') === 'true',
      similarDist: parseInt(core.getInput('similarDist')),
      createIgnore: core.getInput('createIgnore') === 'true',
    })


    if (missingTranslations.length > 0) {
      core.setFailed('Found some translations missing')      
    }

    core.setOutput('missingTranslations', missingTranslations)
    core.setOutput('uniqueTranslations', uniqueTranslations)
    core.setOutput('unusedTranslations', unusedTranslations)
    core.setOutput('translations', translations)
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
