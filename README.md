# GitHub Action: Translation Check

<p align="center">
  <a href="https://github.com/actions/javascript-action/actions"><img alt="javscript-action status" src="https://github.com/actions/javascript-action/workflows/units-test/badge.svg"></a>
</p>


The Translation Check action is designed to help you identify missing translations in your codebase. It scans your project's source code and compares the text strings with the translations provided in your JSON files. This action can be integrated into your GitHub workflow to ensure that all text strings are properly translated, avoiding any missing or incomplete translations in your application.

## Example Output

Upon running the Translation Check action, you will receive a detailed report highlighting any missing translations. Here is a sample output from the action running on the `failure-env` in this repository:

```
Missing translation for: "We forgot to add this translation to our json file"  
	Found in: 
		test-env/failure-env/src/main.js:5:15

Missing translation for: "An empty translation" 
	This key does exist in test-env/failure-env/lang/en.json but there is no translation given.
	Consider adding a translation for this key. 
	Found in: 
		test-env/failure-env/src/main.js:9:15

Missing translation for: "Ups, I misspelled this key" 
	Similar to: Ups, I misspelled this key. 
	Found in: 
		test-env/failure-env/src/main.js:13:15
		test-env/failure-env/src/main.js:28:12
```

In the output, each missing translation is listed along with the corresponding file, line number, and column where it was found. Additionally, if there are similar keys to the missing translation, the action provides a suggestion to help identify potential spelling errors.

## Getting Started

To use the action in your GitHub workflow, follow these steps:

1. Ensure that your project contains the necessary JSON files with translations. These files should be organized according to your project's structure.

2. Create a workflow file (e.g., `.github/workflows/translation-check.yml`) in your repository, and define the Translation Check action as one of the steps.

```yaml
name: Translation Check

on: [push]

jobs:
  check-translations:
    runs-on: ubuntu-latest

    steps:
    - name: Checkout code
      uses: actions/checkout@v2

    - name: Translation Check
      uses: theppeecc/missing-translations-action@v1
      with:
        fileEndings: |
          js
          ts
        translationFile: './lang/en.json'
        translationFunctions: |
          $t
          $tc
        folders: |
          ./src/
          ./resources/js
```

3. Commit and push the workflow file to your repository.

Now, whenever a push event occurs in your repository, the Translation Check action will be triggered, scanning your codebase for missing translations and providing a detailed report of any issues found.

### Inputs

The following inputs are available for configuring the Missing Translations GitHub Action:

- **fileEndings** (required): Specifies the file types to search for the usage of translation functions. 

- **translationFile** (required): Specifies the path to the JSON file containing the translation key-value pairs.

- **translationFunctions** (required): Specifies the identifier names of the translation functions used in your code.

- **folders**: Specifies the path to the folders to search for missing translations in. The default path is `./src/`.

- **hyphen**: Specifies the hyphens used to identify a string. By default, it searches for strings enclosed in double quotes (`"`) or single quotes (`'`).

- **findSimilarStrs**: Determines whether to search for similar keys to missing translations. This option is useful for finding small spelling mistakes. Enabling it may impact performance, especially with large translation files. By default, it is set to `false`.

- **similarDist**: Sets the maximum distance of changes required to consider a spelling mistake. Higher values increase the time taken by the CI tool. The default value is `1`.

- **createIgnore**: Specifies whether to create or update an ignore file with newly found missing translations. By default, it is set to `false`. (BROKEN FOR NOW)

### Outputs

The action provides the following outputs:

- **missingTranslations**: An array of found keys that are missing a translation.

- **unusedTranslations**: An array of keys found in the translation file that are not used in any file.

- **uniqueTranslations**: An array of unique keys found in the files.

- **translationKeys**: An array of keys from the translation file.

- **translations**: An array of missing translations along with their file path, line, and column locations.


## Contributing

Contributions to the Translation Check action are welcome! If you encounter any issues, have suggestions for improvement, or would like to add new features, please open an issue or submit a pull request on the action's GitHub repository.
