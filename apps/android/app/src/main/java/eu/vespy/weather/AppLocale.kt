package eu.vespy.weather

import android.content.Context
import android.content.res.Configuration
import android.content.res.Resources
import android.os.LocaleList
import eu.vespy.weather.data.WeatherPreferences
import java.util.Locale

fun Context.withSavedAppLocale(): Context {
    val language = WeatherPreferences(this).displaySettings().language
    val locales = if (language == "system") {
        Resources.getSystem().configuration.locales
    } else {
        LocaleList(Locale.forLanguageTag(language))
    }
    if (!locales.isEmpty) {
        LocaleList.setDefault(locales)
        Locale.setDefault(locales[0])
    }
    val configuration = Configuration(resources.configuration).apply {
        setLocales(locales)
        if (!locales.isEmpty) setLayoutDirection(locales[0])
    }
    return createConfigurationContext(configuration)
}
