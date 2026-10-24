/* eslint-disable no-console -- a CLI script: the console is its interface */
// One-time sign-in for the e2e tests.
//
// Google refuses to sign in inside a browser driven by automation, so this
// opens your normal Chrome (with its own throwaway profile), lets you sign in
// with a dummy account by hand, and saves the session to e2e/.auth/user.json.
// Firebase keeps its session in IndexedDB, which is why that is saved too.
//
//   npm run test:e2e:login
//
// Re-run it whenever the tests report the session expired.

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve } from 'node:path'
import { chromium } from '@playwright/test'

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000'
const authDir = resolve('e2e/.auth')
const statePath = resolve(authDir, 'user.json')
// Outside the project on purpose: Nuxt's dev watcher trips over the files
// Chrome keeps locked (EBUSY) when the profile lives in the repo.
const profileDir = join(process.env.LOCALAPPDATA || join(homedir(), '.cache'), 'spendy-e2e', 'chrome-profile')
const port = 9333

const CHROME_PATHS = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  `${process.env.LOCALAPPDATA}/Google/Chrome/Application/chrome.exe`,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome'
].filter(Boolean)

const chromePath = CHROME_PATHS.find(path => existsSync(path))
if (!chromePath) {
  console.error('Could not find Chrome. Set CHROME_PATH to its executable and try again.')
  process.exit(1)
}

mkdirSync(authDir, { recursive: true })

const chrome = spawn(chromePath, [
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profileDir}`,
  '--no-first-run',
  '--no-default-browser-check',
  baseURL
], { stdio: 'ignore' })

const connect = async () => {
  for (let attempt = 0; attempt < 40; attempt++) {
    try {
      return await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
    } catch {
      await new Promise(done => setTimeout(done, 250))
    }
  }
  throw new Error('Chrome did not open its debugging port.')
}

const browser = await connect()
const context = browser.contexts()[0]

console.log(`Sign in to Spendy with a dummy Google account in the Chrome window (${baseURL}).`)
console.log('Waiting up to 5 minutes...')

const findApp = () => context.pages().find(page => page.url().startsWith(baseURL))

try {
  const deadline = Date.now() + 5 * 60_000
  let app
  while (Date.now() < deadline) {
    app = findApp()
    if (app && await app.getByRole('button', { name: /^Account menu for/ }).isVisible().catch(() => false)) {
      break
    }
    app = undefined
    await new Promise(done => setTimeout(done, 1000))
  }

  if (!app) {
    throw new Error('Timed out waiting for sign-in.')
  }

  const name = await app.getByRole('button', { name: /^Account menu for/ }).getAttribute('aria-label')
  await context.storageState({ path: statePath, indexedDB: true })
  console.log(`Saved the session (${name}) to ${statePath}`)
} finally {
  await browser.close().catch(() => {})
  chrome.kill()
}
