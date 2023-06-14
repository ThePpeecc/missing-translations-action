import $t from 'translationFunction'

function doSomeWork() {
  return $t('We forgot to add this translation to our json file')
}

function quickHelpFunction() {
  return $t('An empty translation')
}

function smartFunction() {
  return $t('Ups, I spelled this key correctly.')
}

function inputFunction(input) {
  return $t('Here we will add a :variable', { variable: input })
}

function main() {
  doSomeWork()
  console.log(
    $t(`
multiline translation here`)
  )

  if (someCondition) {
    $t('Ups, I spelled this key correctly.')
  }

  return $t('A simple translation needed here')
}
