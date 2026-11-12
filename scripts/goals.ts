import {mkdirSync, writeFileSync} from 'node:fs'
import {resolve} from 'node:path'

import {goalsMarkdown} from '../src/analytics/goalsDoc'

const file = resolve(import.meta.dirname, '../docs/metrika-goals.md')
mkdirSync(resolve(file, '..'), {recursive: true})
writeFileSync(file, goalsMarkdown())
console.log(`Записано: ${file}`)
