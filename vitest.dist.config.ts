import {defineConfig} from 'vitest/config'

/** Проверка собранного dist/: запускать после npm run build */
export default defineConfig({
	test: {
		include: ['tests/dist.test.ts'],
		environment: 'node',
	},
})
