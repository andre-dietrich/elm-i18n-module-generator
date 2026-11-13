# Elm i18n Gen (JSON/YAML language file to Elm Functions Generator)

[![npm version](https://badge.fury.io/js/elm-i18n-gen.svg)](https://badge.fury.io/js/elm-i18n-gen)

This tool lets you generate elm functions from JSON or YAML translation files.

This tool is for you if ...

- you store your translations in JSON or YAML files
- you want to be able to switch languages during runtime
- you want to use your translations in your Elm app

## Why was this tool created?

The company I work for stores all their translation files in JSON and also
depends on this format, for collaboration with a third party translation
service. So storing the translations in Elm directly was not an option for us.
We still didn't want to miss out on the Elm goodness. Thus, this i18n module
generator was born.

## How to use?

Warning: This module currently only supports placeholders in
translations that are surrounded by `{{ ... }}`.

For every translation string one elm function will be generated.
Translations without placeholders will be transformed to a function with this
signature.

`Lang -> String`

With Placeholders the signature will look more like this:
(for one placeholder):

`Lang -> String -> String`

### Generating the Translation elm module

Install via npm.

`npm install -g elm-i18n-gen`

Then run it from the command line, `--compact` is recommended (see
[Compact output](#compact-output-recommended)):

`elm-i18n-gen --default en --compact path/to/localeFolder path/to/output/Translations.elm`

This assumes that you have a single folder that contains all your translation
files, named `*.<lang>.json` or `*.<lang>.yaml`, on the same level like so:

```
locale
  |- mytranslation.en.json
  |- mytranslation.de.yaml
  ...
```

JSON and YAML can be mixed, every file is read with a YAML parser (JSON is
valid YAML). Imagine the translation files look like this, in english (JSON):

```json
{
  "hello": "Hello",
  "gooddaySalute": "Good Day {{name}} {{assi}}",
  "tigers": {
    "roar": "Roar!"
  }
}
```

and in german (YAML):

```yaml
hello: Hallo
gooddaySalute: "Guten Tag {{name}} {{assi}}"
tigers:
  roar: Brüll!
```

Nested keys are joined in camelCase (`tigers.roar` becomes `tigersRoar`).

#### Compact output (recommended)

With `--compact` (or `-c`) every language becomes one string, which is split
once when the language is selected. Every text is a lookup by its index, with
the text of the default language as fallback. The classic output (without
`--compact`, see below) has a `case` over all languages per text, which
compiles to a `switch` per function and is mostly code: for 44 languages and
140 texts `--compact` reduces the minified JavaScript by about a third (242 KB
to 162 KB, gzip 76 KB to 60 KB) and the code the browser has to compile.
`--compact` requires a default language.

`elm-i18n-gen --default en --compact path/to/localeFolder path/to/output/Translations.elm`

generates (shortened):

```elm
type Lang
    = Lang String (Array String)


en : Lang
en =
    Lang "en" Array.empty


getLnFromCode : String -> Maybe Lang
getLnFromCode code =
    case String.toLower code of
        "de" ->
            Just (i18nLoad "de" i18nDe)

        "en" ->
            Just en

        _ ->
            Nothing


getCodeFromLn : Lang -> String
getCodeFromLn (Lang code _) =
    code


i18nDe : String
i18nDe =
    "Guten Tag \u{001E} \u{001E}\u{001F}Hallo\u{001F}Brüll!"


hello : Lang -> String
hello lang =
    i18nGet 1 "Hello" lang


gooddaySalute : Lang -> String -> String -> String
gooddaySalute lang str0 str1 =
    i18nFill [ str0, str1 ] (i18nGet 0 "Good Day \u{001E} \u{001E}" lang)


tigersRoar : Lang -> String
tigersRoar lang =
    i18nGet 2 "Roar!" lang
```

The functions and their signatures are the same as in the classic output, the
differences are:

- `Lang` has no variant per language, the default language is a value named by
  its code (`en` instead of `En`), all others come from `getLnFromCode`.
- `getLnFromCode` splits the texts of the language every time it is called,
  call it once and keep the result in your model.
- A text missing in a language falls back to the default language.
- The names `i18nLoad`, `i18nGet`, `i18nFill` and `i18n<Lang>` are used by the
  generated module, a translation key with one of these names is an error, as
  is a translation that contains `\u001F` or `\u001E`.

`node tests/compact/run.js path/to/localeFolder en` checks that the compact
module returns the same texts as the classic module for every language and
every function (needs elm 0.19.1 on the PATH or in `$ELM`).

#### Classic output

Without `--compact` every language is a variant of `Lang` and every text a
`case` over all languages:

`elm-i18n-gen path/to/localeFolder path/to/output/Translations.elm`

This will generate a `Translations.elm` file with the following content.

```elm
module Translations exposing (..)


type Lang
    = De
    | En


getLnFromCode : String -> Maybe Lang
getLnFromCode code =
    case code of
        "de" ->
            Just De

        "en" ->
            Just En

        _ ->
            Nothing


hello : Lang -> String
hello lang =
    case lang of
        De ->
            "Hallo"

        En ->
            "Hello"


gooddaySalute : Lang -> String -> String -> String
gooddaySalute lang str0 str1 =
    case lang of
        De ->
            "Guten Tag " ++ str0 ++ " " ++ str1 ++ ""

        En ->
            "Good Day " ++ str0 ++ " " ++ str1 ++ ""


tigersRoar : Lang -> String
tigersRoar lang =
    case lang of
        De ->
            "Brüll!"

        En ->
            "Roar!"
```

##### Default Lang

In case you have missing translations for some languages, it is possible to use the command-line parameter `--default` as listed below.

`elm-i18n-gen --default DE path/to/localeFolder path/to/output/Translations.elm`

This will result in the following code:

```elm
module Translations exposing (..)


type Lang
    = De
    | En


getLnFromCode : String -> Maybe Lang
getLnFromCode code =
    case code of
        "de" ->
            Just De

        "en" ->
            Just En

        _ ->
            Nothing


hello : Lang -> String
hello lang =
    case lang of
        En ->
            "Hello"

        _ ->
            "Hallo"


gooddaySalute : Lang -> String -> String -> String
gooddaySalute lang str0 str1 =
    case lang of
        En ->
            "Good Day " ++ str0 ++ " " ++ str1 ++ ""

        _ ->
            "Guten Tag " ++ str0 ++ " " ++ str1 ++ ""


tigersRoar : Lang -> String
tigersRoar lang =
    case lang of
        En ->
            "Roar!"

        _ ->
            "Brüll!"
```

### Using the Translations module

Import the generated module in your elm code like this.

`import Translations`

Initialize your Model with the default language and switch it with
`getLnFromCode`, keep the result in the model (compact output):

```elm
initialModel : Model
initialModel =
    { tigers = List Tiger
    , lang = Translations.en -- <---- the default language
    }


update : Msg -> Model -> Model
update msg model =
    case msg of
        SetLanguage code ->
            { model
                | lang =
                    Translations.getLnFromCode code
                        |> Maybe.withDefault model.lang
            }
```

With the classic output the languages are variants, e.g. `Translations.En`.

Then in your view function do this:

```elm
view : Model -> Html Msg
view model =
    div [] [ text (Translations.hello model.lang) ]
```

## Future Features

This is a list of TODOs that I plan to implement. Pull Requests are also
welcome. Just contact me if you want to contribute.

- Clean up
- Use command line arguments to configure different placeholder separator
  (\_\_xxx\_\_, {{{xxx}}}, etc)
- Port the generating logic to elm in an elm worker and only use node for
  file IO.

## Contributing

If you find bugs are need additional features please open an issue or contact
me to discuss ideas. If you want to write code check out the repo
and add your code. Make sure to run the test with `npm test` before and
add tests wherever it makes sense. Submit a PR against the master branch.

## Credits

This project was inspired by
[IOSphere/elm-i18n](https://github.com/iosphere/elm-i18n), namely the idea of
representing translation strings as constants or functions. But it is adapted to
fit other needs. It differs in the fact that `elm-i18n-gen` generates a single
elm module from multiple JSON files vs `iosphere/elm-i18n`, which stores its
translations in elm directly and generates other formats from it.
