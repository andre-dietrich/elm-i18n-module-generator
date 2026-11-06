#!/usr/bin/env node
// node tests/compact/run.js [localeDir] [default]
// Generates the case output and the --compact output for the same locale
// files and checks with Elm that every language and every function returns
// the same text in both. Needs elm 0.19.1, as `elm` on the PATH or in $ELM.
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFileSync } = require('child_process')

const locale = path.resolve(process.argv[2] || path.join(__dirname, '../../locale'))
const defaultLang = process.argv[3] || 'en'
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elm-i18n-compact-'))
const gen = path.join(__dirname, '../../src/index.js')

const run = (args) => execFileSync(process.execPath, [gen, ...args], { stdio: 'inherit' })
run(['-d', defaultLang, locale, path.join(dir, 'old.elm')])
run(['-d', defaultLang, '--compact', locale, path.join(dir, 'new.elm')])

fs.mkdirSync(path.join(dir, 'src'))
const old = fs.readFileSync(path.join(dir, 'old.elm'), 'utf8').replace(/^module Translations/m, 'module Old')
const neu = fs.readFileSync(path.join(dir, 'new.elm'), 'utf8').replace(/^module Translations/m, 'module New')
fs.writeFileSync(path.join(dir, 'src/Old.elm'), old)
fs.writeFileSync(path.join(dir, 'src/New.elm'), neu)

const fns = [...old.matchAll(/^(\w+) : Lang -> ((?:String -> )*)String$/gm)].map((m) => [m[1], (m[2].match(/String/g) || []).length])
const codes = [...old.matchAll(/^ {8}"([\w-]+)" ->\n {12}Just \w+$/gm)].map((m) => m[1])
const calls = fns.map(([f, n]) => {
  const args = [...Array(n).keys()].map((i) => `"ARG${i}"`).join(' ')
  return `( "${f}", Old.${f} o ${args}, New.${f} n ${args} )`
})

fs.writeFileSync(path.join(dir, 'src/Check.elm'), `port module Check exposing (main)

import New
import Old


port out : List String -> Cmd msg


check : String -> List String
check code =
    case ( Old.getLnFromCode code, New.getLnFromCode code ) of
        ( Just o, Just n ) ->
            (if Old.getCodeFromLn o /= New.getCodeFromLn n then
                [ code ++ ": getCodeFromLn" ]

             else
                []
            )
                ++ List.filterMap
                    (\\( name, a, b ) ->
                        if a == b then
                            Nothing

                        else
                            Just (code ++ ": " ++ name ++ ": " ++ a ++ " /= " ++ b)
                    )
                    [ ${calls.join('\n                    , ')}
                    ]

        ( Nothing, Nothing ) ->
            []

        _ ->
            [ code ++ ": getLnFromCode" ]


main : Program () () ()
main =
    Platform.worker
        { init = \\_ -> ( (), out (List.concatMap check [ ${codes.concat(['xx', codes[0].toUpperCase()]).map((c) => `"${c}"`).join(', ')} ]) )
        , update = \\_ m -> ( m, Cmd.none )
        , subscriptions = \\_ -> Sub.none
        }
`)

fs.writeFileSync(path.join(dir, 'elm.json'), JSON.stringify({
  type: 'application',
  'source-directories': ['src'],
  'elm-version': '0.19.1',
  dependencies: { direct: { 'elm/core': '1.0.5', 'elm/json': '1.1.3' }, indirect: {} },
  'test-dependencies': { direct: {}, indirect: {} },
}))

execFileSync(process.env.ELM || 'elm', ['make', 'src/Check.elm', '--output', 'check.js'], { cwd: dir, stdio: ['ignore', 'ignore', 'inherit'] })
const { Elm } = require(path.join(dir, 'check.js'))
Elm.Check.init().ports.out.subscribe((mismatches) => {
  console.log(`${codes.length} languages x ${fns.length} functions, ${mismatches.length} mismatches`)
  mismatches.slice(0, 20).forEach((m) => console.log('  ' + m))
  process.exit(mismatches.length ? 1 : 0)
})
