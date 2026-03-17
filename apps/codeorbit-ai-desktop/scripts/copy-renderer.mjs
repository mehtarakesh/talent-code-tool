import { cpSync, mkdirSync, rmSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const source = path.join(root, 'src', 'renderer')
const destination = path.join(root, 'dist', 'renderer')

rmSync(destination, { recursive: true, force: true })
mkdirSync(path.dirname(destination), { recursive: true })
cpSync(source, destination, { recursive: true })
