// Compact output: the texts of every language are one string, split once when
// the language is selected, and every text is a lookup by its index with the
// default text as fallback. A case over all languages per text compiles to a
// switch per function, which is mostly code, not text.

const SEPARATOR = '\\u{001F}' // between the texts of a language
const PLACEHOLDER = '\\u{001E}' // stands for {{...}} within a text

const capitalize = (string) => string.charAt(0).toUpperCase() + string.slice(1)

// The value is inserted as it is, as in the case output, so escapes like \n
// within a translation keep their meaning.
const text = (value) => {
  const str = String(value)
  if (str.includes('\u001F') || str.includes('\u001E')) {
    throw new Error('a translation contains \\u001F or \\u001E: ' + str)
  }
  return str.replace(/\{\{.*?\}\}/g, PLACEHOLDER)
}

module.exports = (fileContentMap, languages) => {
  // the default language is the last one, see index.js
  const defaultLang = languages[languages.length - 1]
  const others = languages.slice(0, -1)
  const keys = Object.keys(fileContentMap).sort()

  const helpers = ['Lang', 'getLnFromCode', 'getCodeFromLn', defaultLang]
    .concat(['i18nLoad', 'i18nGet', 'i18nFill'])
    .concat(others.map((ln) => 'i18n' + capitalize(ln)))
  const clash = keys.find((key) => helpers.includes(key))
  if (clash) {
    throw new Error('a translation key clashes with a generated name: ' + clash)
  }

  const value = (key, ln) => {
    const tr = fileContentMap[key].find((t) => t.ln === ln)
    return tr && tr.value
  }

  const defaultValue = (key) => value(key, '_')

  // as in the case output, the number of arguments is taken from the first
  // translation of a key
  const placeholders = (key) =>
    (String(fileContentMap[key][0].value).match(/\{\{.*?\}\}/g) || []).length

  const languageString = (ln) => `i18n${capitalize(ln)} : String
i18n${capitalize(ln)} =
    "${keys
      .map((key) => {
        const v = value(key, ln)
        return text(v === undefined ? defaultValue(key) : v)
      })
      .join(SEPARATOR)}"
`

  const fn = (key, index) => {
    const n = placeholders(key)
    const args = [...Array(n).keys()].map((i) => 'str' + i)
    const signature = ['Lang'].concat(args.map(() => 'String'), ['String'])
    const get = `i18nGet ${index} "${text(defaultValue(key))}" lang`

    return `${key} : ${signature.join(' -> ')}
${key} ${['lang'].concat(args).join(' ')} =
    ${n === 0 ? get : `i18nFill [ ${args.join(', ')} ] (${get})`}
`
  }

  const lnCase = (ln) => `        "${ln}" ->
            Just (i18nLoad "${ln}" i18n${capitalize(ln)})
`

  return `module Translations exposing (..)

{-| This file was automatically generated with elm-i18n-gen --compact.
For more in information visit:

<https://github.com/andre-dietrich/elm-i18n-module-generator>

-}

import Array exposing (Array)


{-| A language, its code and its texts, see \`getLnFromCode\`.
-}
type Lang
    = Lang String (Array String)


{-| The default language, its texts are part of the functions.
-}
${defaultLang} : Lang
${defaultLang} =
    Lang "${defaultLang}" Array.empty


{-| Pass a language code that will return a Lang-type, if it exists.
Otherwise \`Nothing\` is returned. The texts of the language are split from
one string, so call it once and keep the result.
-}
getLnFromCode : String -> Maybe Lang
getLnFromCode code =
    case String.toLower code of
${others.map(lnCase).join('\n')}
        "${defaultLang}" ->
            Just ${defaultLang}

        _ ->
            Nothing


{-| Return the lowerCase language code for the given Lang.
-}
getCodeFromLn : Lang -> String
getCodeFromLn (Lang code _) =
    code


i18nLoad : String -> String -> Lang
i18nLoad code texts =
    Lang code (Array.fromList (String.split "${SEPARATOR}" texts))


i18nGet : Int -> String -> Lang -> String
i18nGet index fallback (Lang _ texts) =
    Array.get index texts |> Maybe.withDefault fallback


{-| Put the arguments in place of the placeholders.
-}
i18nFill : List String -> String -> String
i18nFill args str =
    let
        parts =
            String.split "${PLACEHOLDER}" str
    in
    List.map2 (++) parts (args ++ List.repeat (List.length parts) "")
        |> String.concat


${others.map(languageString).join('\n\n')}

${keys.map(fn).join('\n\n')}`
}
