// Compact output: the texts of every language are one string, split once when
// the language is selected, and every text is a lookup by its index with the
// default text as fallback. A case over all languages per text compiles to a
// switch per function, which is mostly code, not text.

// Between the texts of a language and in place of {{...}} within a text stand
// the first two of these characters that no text contains. A printable one is
// one byte with every minifier, a control character is \x1f with SWC (Parcel)
// and \u001F without a minifier.
const CANDIDATES = [...'|~^#\u001F\u001E']

// a character as it is written in an Elm string
const elm = (c) =>
  c < ' ' ? `\\u{00${c.charCodeAt(0).toString(16).toUpperCase()}}` : c

const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)

module.exports = (fileContentMap, languages) => {
  // the default language is the last one, see index.js
  const defaultLang = languages[languages.length - 1]
  const keys = Object.keys(fileContentMap).sort()

  const helpers = ['Lang', 'getLnFromCode', 'getCodeFromLn', defaultLang]
    .concat(['i18nGet', 'i18nFill'])
  const clash = keys.find((key) => helpers.includes(key))
  if (clash) {
    throw new Error('a translation key clashes with a generated name: ' + clash)
  }

  // The texts are inserted as they are, as in the case output, so escapes like
  // \n within a translation keep their meaning, and \u{007C} is a | too.
  const used = keys
    .flatMap((key) => fileContentMap[key].map((t) => String(t.value)))
    .join('')
    .replace(/\\u\{([0-9a-fA-F]+)\}/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
  const [separator, placeholder] = CANDIDATES.filter(
    (c) => !used.includes(c),
  ).map(elm)
  if (!placeholder) {
    throw new Error(
      'the translations contain too many of ' + CANDIDATES.map(elm).join(' '),
    )
  }

  const value = (key, ln) => {
    const tr = fileContentMap[key].find((t) => t.ln === ln)
    return tr && tr.value
  }

  // a text that is missing in a language is the default text
  const text = (key, ln) => {
    const v = value(key, ln)
    return String(v === undefined ? value(key, '_') : v).replace(
      /\{\{.*?\}\}/g,
      placeholder,
    )
  }

  const texts = (ln) => keys.map((key) => text(key, ln)).join(separator)

  // Languages of the same script are put next to each other, they compress
  // better that way: gzip only looks back 32 KB, about ten languages. The
  // median character of a language tells its script.
  const script = {}
  for (const ln of languages) {
    const chars = [...texts(ln)].sort()
    script[ln] = chars[chars.length >> 1]
  }
  const others = languages
    .slice(0, -1)
    .sort((a, b) => cmp(script[a], script[b]) || cmp(a, b))

  // as in the case output, the number of arguments is taken from the first
  // translation of a key
  const placeholders = (key) =>
    (String(fileContentMap[key][0].value).match(/\{\{.*?\}\}/g) || []).length

  // Without placeholders a partial application, which is a third of the
  // JavaScript of `key lang = i18nGet 5 "text" lang`.
  const fn = (key, index) => {
    const n = placeholders(key)
    const args = [...Array(n).keys()].map((i) => 'str' + i)
    const signature = ['Lang'].concat(args.map(() => 'String'), ['String'])
    const get = `i18nGet ${index} "${text(key, '_')}"`

    return `${key} : ${signature.join(' -> ')}
${key}${n === 0 ? '' : ' ' + ['lang'].concat(args).join(' ')} =
    ${n === 0 ? get : `i18nFill [ ${args.join(', ')} ] (${get} lang)`}
`
  }

  // The texts are written into the case: as values of their own Elm would put
  // them in alphabetical order.
  const lnCase = (ln) => `        "${ln}" ->
            load "${texts(ln)}"
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
    let
        lower =
            String.toLower code

        load texts =
            Just (Lang lower (Array.fromList (String.split "${separator}" texts)))
    in
    case lower of
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


i18nGet : Int -> String -> Lang -> String
i18nGet index fallback (Lang _ texts) =
    Array.get index texts |> Maybe.withDefault fallback


{-| Put the arguments in place of the placeholders, a text may have fewer
placeholders than there are arguments.
-}
i18nFill : List String -> String -> String
i18nFill args str =
    case String.split "${placeholder}" str of
        first :: rest ->
            first ++ String.concat (List.map2 (++) (args ++ List.repeat (List.length rest) "") rest)

        [] ->
            str


${keys.map(fn).join('\n\n')}`
}
