import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { defineVitestProject } from '@nuxt/test-utils/config'

const rootDir = fileURLToPath(new URL('./', import.meta.url))

export default defineConfig({
  test: {
    projects: [
      // Plain logic: no Nuxt runtime, so these start in milliseconds. Files that
      // touch the DOM opt in with a `// @vitest-environment happy-dom` comment.
      {
        resolve: {
          alias: { '~': rootDir }
        },
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
          environment: 'node'
        }
      },
      // Anything that needs Nuxt itself: auto-imports, useState, useNuxtApp,
      // plugins and component mounting.
      await defineVitestProject({
        test: {
          name: 'nuxt',
          include: ['tests/nuxt/**/*.test.ts'],
          environment: 'nuxt',
          // Each file boots Nuxt first. Usually ~2s, but on a busy machine (or
          // with coverage on) it can pass the 10s default and fail the push.
          hookTimeout: 60_000,
          environmentOptions: {
            nuxt: {
              domEnvironment: 'happy-dom'
            }
          }
        }
      })
    ],
    coverage: {
      provider: 'v8',
      include: ['components/**', 'composables/**', 'constants/**', 'plugins/**']
    }
  }
})
