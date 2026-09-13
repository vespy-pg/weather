package eu.vespy.weather.data

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

class WeatherPreferences(context: Context) {
    private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

    fun locations(fallback: List<WeatherLocation>): List<WeatherLocation> {
        val encoded = preferences.getString(KEY_LOCATIONS, null) ?: return fallback
        return runCatching {
            val source = JSONArray(encoded)
            buildList {
                for (index in 0 until source.length()) {
                    source.optJSONObject(index)?.toLocation()?.let(::add)
                }
            }.ifEmpty { fallback }
        }.getOrDefault(fallback)
    }

    fun activeLocation(fallback: WeatherLocation): WeatherLocation {
        val encoded = preferences.getString(KEY_ACTIVE_LOCATION, null) ?: return fallback
        return runCatching { JSONObject(encoded).toLocation() }.getOrNull() ?: fallback
    }

    fun temperatureUnit(): String = if (preferences.getString(KEY_TEMPERATURE_UNIT, "C") == "F") "F" else "C"

    fun analyticsConsent(): Boolean? = if (preferences.contains(KEY_ANALYTICS_CONSENT)) {
        preferences.getBoolean(KEY_ANALYTICS_CONSENT, false)
    } else {
        null
    }

    fun displaySettings() = ForecastDisplaySettings(
        zoom = preferences.getFloat(KEY_ZOOM, .5f).takeIf { it in ZOOM_LEVELS } ?: .5f,
        theme = preferences.getString(KEY_THEME, "system").takeIf { it in THEMES } ?: "system",
        language = preferences.getString(KEY_LANGUAGE, "system").takeIf { it in LANGUAGES } ?: "system",
        temperatureThresholds = TemperatureThresholds(
            deepFrost = preferences.getFloat(KEY_DEEP_FROST, -12f),
            mild = preferences.getFloat(KEY_MILD, 18f),
            warm = preferences.getFloat(KEY_WARM, 27f),
            hot = preferences.getFloat(KEY_HOT, 32f),
        ),
        showHourlyTemperatures = preferences.getBoolean(KEY_SHOW_HOURLY_TEMPERATURES, true),
        showApparentTemperature = preferences.getBoolean(KEY_SHOW_APPARENT_TEMPERATURE, true),
        showPrecipitation = preferences.getBoolean(KEY_SHOW_PRECIPITATION, true),
        showWind = preferences.getBoolean(KEY_SHOW_WIND, true),
        showWindArrows = preferences.getBoolean(KEY_SHOW_WIND_ARROWS, false),
    )

    fun saveLocations(locations: List<WeatherLocation>) {
        val encoded = JSONArray().apply { locations.forEach { put(it.toJson()) } }.toString()
        preferences.edit().putString(KEY_LOCATIONS, encoded).apply()
    }

    fun saveActiveLocation(location: WeatherLocation) {
        preferences.edit().putString(KEY_ACTIVE_LOCATION, location.toJson().toString()).apply()
    }

    fun saveTemperatureUnit(unit: String) {
        preferences.edit().putString(KEY_TEMPERATURE_UNIT, if (unit == "F") "F" else "C").apply()
    }

    fun saveAnalyticsConsent(enabled: Boolean) {
        preferences.edit().putBoolean(KEY_ANALYTICS_CONSENT, enabled).apply()
    }

    fun saveDisplaySettings(settings: ForecastDisplaySettings) {
        preferences.edit()
            .putFloat(KEY_ZOOM, settings.zoom)
            .putString(KEY_THEME, settings.theme)
            .putString(KEY_LANGUAGE, settings.language)
            .putFloat(KEY_DEEP_FROST, settings.temperatureThresholds.deepFrost)
            .putFloat(KEY_MILD, settings.temperatureThresholds.mild)
            .putFloat(KEY_WARM, settings.temperatureThresholds.warm)
            .putFloat(KEY_HOT, settings.temperatureThresholds.hot)
            .putBoolean(KEY_SHOW_HOURLY_TEMPERATURES, settings.showHourlyTemperatures)
            .putBoolean(KEY_SHOW_APPARENT_TEMPERATURE, settings.showApparentTemperature)
            .putBoolean(KEY_SHOW_PRECIPITATION, settings.showPrecipitation)
            .putBoolean(KEY_SHOW_WIND, settings.showWind)
            .putBoolean(KEY_SHOW_WIND_ARROWS, settings.showWindArrows)
            .apply()
    }

    private fun WeatherLocation.toJson() = JSONObject().apply {
        put("name", name)
        put("country", country)
        put("latitude", latitude)
        put("longitude", longitude)
        put("timezone", timezone)
    }

    private fun JSONObject.toLocation(): WeatherLocation? {
        val name = optString("name").takeIf(String::isNotBlank) ?: return null
        val latitude = optDouble("latitude", Double.NaN).takeUnless(Double::isNaN) ?: return null
        val longitude = optDouble("longitude", Double.NaN).takeUnless(Double::isNaN) ?: return null
        return WeatherLocation(
            name = name,
            country = optString("country"),
            latitude = latitude,
            longitude = longitude,
            timezone = optString("timezone").takeIf(String::isNotBlank) ?: "auto",
        )
    }

    private companion object {
        const val PREFERENCES_NAME = "weather_preferences"
        const val KEY_LOCATIONS = "favorite_locations"
        const val KEY_ACTIVE_LOCATION = "active_location"
        const val KEY_TEMPERATURE_UNIT = "temperature_unit"
        const val KEY_ANALYTICS_CONSENT = "analytics_consent"
        const val KEY_ZOOM = "timeline_zoom"
        const val KEY_THEME = "color_theme"
        const val KEY_LANGUAGE = "language"
        const val KEY_DEEP_FROST = "temperature_deep_frost"
        const val KEY_MILD = "temperature_mild"
        const val KEY_WARM = "temperature_warm"
        const val KEY_HOT = "temperature_hot"
        const val KEY_SHOW_HOURLY_TEMPERATURES = "show_hourly_temperatures"
        const val KEY_SHOW_APPARENT_TEMPERATURE = "show_apparent_temperature"
        const val KEY_SHOW_PRECIPITATION = "show_precipitation"
        const val KEY_SHOW_WIND = "show_wind"
        const val KEY_SHOW_WIND_ARROWS = "show_wind_arrows"
        val ZOOM_LEVELS = setOf(.125f, .25f, .375f, .5f, .75f, 1f, 1.25f, 1.5f, 2f)
        val THEMES = setOf("system", "dark", "light")
        val LANGUAGES = setOf("system", "en-US", "pl-PL")
    }
}
