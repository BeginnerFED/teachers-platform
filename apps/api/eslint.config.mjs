import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', '.turbo/**'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ['src/**/*.ts', '*.ts', '*.mjs'],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    // The Supabase clients hold the service-role key and bypass row level security
    // entirely. Confining them to the repository layer means every authorisation
    // decision sits somewhere a reviewer knows to look, rather than three calls deep
    // inside a controller where nobody will find it.
    files: ['src/**/*.ts'],
    ignores: ['src/lib/supabase/**', 'src/**/*.repository.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['**/lib/supabase/**', '@supabase/supabase-js'],
              message:
                'Supabase may only be reached from a *.repository.ts file. Put the query there and call it from the service.',
            },
          ],
        },
      ],
    },
  },
)
