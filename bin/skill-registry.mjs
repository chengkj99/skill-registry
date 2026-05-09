#!/usr/bin/env node

import { run } from '../src/cli.js'

process.exit(run(process.argv.slice(2)))
