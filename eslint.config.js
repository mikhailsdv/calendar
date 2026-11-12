import js from '@eslint/js'
import reactHooks from 'eslint-plugin-react-hooks'
import simpleImportSort from 'eslint-plugin-simple-import-sort'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
	{ignores: ['dist', 'coverage', 'public']},
	js.configs.recommended,
	...tseslint.configs.recommended,
	reactHooks.configs.flat['recommended-latest'],
	{
		languageOptions: {globals: {...globals.browser, ...globals.node}},
		plugins: {'simple-import-sort': simpleImportSort},
		rules: {
			'simple-import-sort/imports': 'error',
			'simple-import-sort/exports': 'error',
			'prefer-const': 'error',
			'@typescript-eslint/no-unused-vars': ['error', {argsIgnorePattern: '^_'}],
			'@typescript-eslint/consistent-type-imports': 'error',
			// Состояние живёт в @preact/signals, которые меняются присваиванием .value — это их нормальный API
			'react-hooks/immutability': 'off',
		},
	}
)
