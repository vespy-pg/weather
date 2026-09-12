# Weather localization rules

This package is the single source of truth for user-facing text shared by the web, Android, and iOS applications.

## Source files

- `locales/en-US.json` is the source catalog and the final fallback.
- `locales/pl-PL.json` contains the Polish translations.
- `languages.json` defines supported BCP 47 locale tags, native language names, text direction, provider language codes, legacy aliases, and country defaults.
- `schema/locale.schema.json` documents the locale file shape.

Only these source files may be edited when copy or translations change. Files under an application's `generated` directory are build artifacts and must never be edited manually.

## Message rules

- Use stable semantic keys such as `settings.temperatureUnit`; never use English text as a key.
- Keep UI text out of API responses. APIs return stable error codes and clients translate them.
- Use named placeholders such as `{time}`. Every translation must contain exactly the placeholders declared by the source message.
- Named placeholders are the currently supported message syntax. Before the first plural or select message is added, the SSOT schema, validator, web formatter, Android generator, and iOS generator must adopt the same ICU MessageFormat contract in one change. Do not assemble sentences from translated fragments.
- Keep markup, URLs, units, location names, and weather data outside translated messages unless they are intentional placeholders.
- Add translator context before introducing text whose meaning is ambiguous in isolation.
- Use Unicode text in locale sources. Generated platform escaping is the generator's responsibility.

## Locale selection and fallback

Clients resolve the locale in this order: an explicit launch parameter, the saved user choice, supported operating-system or browser preferences, the visitor country default, then `en-US`.

Matching uses an exact BCP 47 tag first and a configured base-language alias second. Missing locale files, missing keys, extra keys, invalid tags, invalid direction values, and placeholder mismatches fail validation. Runtime lookup still falls back to `en-US` as a defensive measure.

Country is only a fallback hint. It must not override an explicit or saved choice, and it must not be treated as proof of the user's language.

## Platform generation

Run `npm run i18n:generate` after editing source files. The generator currently writes the web message bundle and the API locale configuration. Android XML resources and the iOS string catalog will be added to the same generator when the native projects exist, without changing locale sources or message keys.

Run `npm run i18n:check` in CI. It validates the catalog and fails when committed generated files are stale.

Generated resources are committed so every platform build is reproducible without running the localization toolchain first.

## Adding languages later

Add languages in reviewed batches. A language is supported only when it is registered in `languages.json`, has a complete locale file, passes validation, renders correctly in its writing direction, and has been regenerated for all existing clients. The initial scope is intentionally limited to `en-US` and `pl-PL`.
