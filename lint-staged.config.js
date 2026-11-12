export default {
	'*.{js,ts,tsx}': ['eslint --fix --max-warnings=0', 'prettier --write'],
	'*.{json,css,md,yml,html}': 'prettier --write',
}
