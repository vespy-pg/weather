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

    fun dismissedAlertKeys(): Set<String> = preferences.getStringSet(KEY_DISMISSED_ALERT_KEYS, emptySet()).orEmpty().toSet()

    fun dismissAlert(location: WeatherLocation, alertId: String) {
        if (alertId.isBlank()) return
        val updated = (dismissedAlertKeys() + location.alertDismissalKey(alertId)).toList().takeLast(MAX_DISMISSED_ALERT_KEYS).toSet()
        preferences.edit().putStringSet(KEY_DISMISSED_ALERT_KEYS, updated).commit()
    }

    fun restoreAlerts(location: WeatherLocation, alertIds: Set<String>) {
        if (alertIds.isEmpty()) return
        val remainingKeys = dismissedAlertKeys().filterNot { key ->
            alertIds.any { alertId -> location.isAlertDismissed(alertId, setOf(key)) }
        }.toSet()
        preferences.edit().putStringSet(KEY_DISMISSED_ALERT_KEYS, remainingKeys).commit()
    }

    fun displaySettings() = ForecastDisplaySettings(
        zoom = preferences.getFloat(KEY_ZOOM, .5f).takeIf { it in ZOOM_LEVELS } ?: .5f,
        theme = preferences.getString(KEY_THEME, "dark").takeIf { it in THEMES } ?: "dark",
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
        showUvIndex = preferences.getBoolean(KEY_SHOW_UV_INDEX, true),
        showHumidity = preferences.getBoolean(KEY_SHOW_HUMIDITY, true),
        showPressure = preferences.getBoolean(KEY_SHOW_PRESSURE, true),
        showPollen = preferences.getBoolean(KEY_SHOW_POLLEN, true),
        showAirQuality = preferences.getBoolean(KEY_SHOW_AIR_QUALITY, true),
        showHistoricalData = preferences.getBoolean(KEY_SHOW_HISTORICAL_DATA, true),
        showDates = preferences.getBoolean(KEY_SHOW_DATES, false),
        showMushrooms = preferences.getBoolean(KEY_SHOW_MUSHROOMS, false),
        showWidgetLocation = preferences.getBoolean(KEY_SHOW_WIDGET_LOCATION, true),
        showSkyValues = preferences.getBoolean(KEY_SHOW_SKY_VALUES, false),
        showWindValues = preferences.getBoolean(KEY_SHOW_WIND_VALUES, false),
        showUvValues = preferences.getBoolean(KEY_SHOW_UV_VALUES, false),
        showHumidityValues = preferences.getBoolean(KEY_SHOW_HUMIDITY_VALUES, false),
        showPressureValues = preferences.getBoolean(KEY_SHOW_PRESSURE_VALUES, false),
        showPollenValues = preferences.getBoolean(KEY_SHOW_POLLEN_VALUES, false),
        showAirQualityValues = preferences.getBoolean(KEY_SHOW_AIR_QUALITY_VALUES, false),
        showMushroomValues = preferences.getBoolean(KEY_SHOW_MUSHROOM_VALUES, false),
        temperatureTextScale = preferences.getFloat(KEY_TEMPERATURE_TEXT_SCALE, .92f).takeIf { it in TEMPERATURE_TEXT_SCALES } ?: .92f,
    )

    fun saveLocations(locations: List<WeatherLocation>) {
        val encoded = JSONArray().apply { locations.forEach { put(it.toJson()) } }.toString()
        val currentLocations = locations(locations)
        val editor = preferences.edit()
        preferences.all.keys
            .filter { it.startsWith(KEY_WIDGET_LOCATION_PREFIX) }
            .forEach { key ->
                val widgetLocationKey = preferences.getString(key, null)?.takeUnless { it.startsWith('{') }
                currentLocations.firstOrNull { it.preferenceKey() == widgetLocationKey }?.let { location ->
                    editor.putString(key, location.toJson().toString())
                }
            }
        editor.putString(KEY_LOCATIONS, encoded).apply()
    }

    fun migrateLegacyDefaultLocations(fallback: List<WeatherLocation>, obsolete: List<WeatherLocation>): List<WeatherLocation> {
        val current = locations(fallback)
        if (preferences.getBoolean(KEY_DEFAULT_LOCATIONS_MIGRATED, false)) return current
        val migrated = current.filterNot { location -> obsolete.any { it.preferenceKey() == location.preferenceKey() } }.ifEmpty { fallback }
        saveLocations(migrated)
        preferences.edit().putBoolean(KEY_DEFAULT_LOCATIONS_MIGRATED, true).apply()
        return migrated
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
            .putBoolean(KEY_SHOW_UV_INDEX, settings.showUvIndex)
            .putBoolean(KEY_SHOW_HUMIDITY, settings.showHumidity)
            .putBoolean(KEY_SHOW_PRESSURE, settings.showPressure)
            .putBoolean(KEY_SHOW_POLLEN, settings.showPollen)
            .putBoolean(KEY_SHOW_AIR_QUALITY, settings.showAirQuality)
            .putBoolean(KEY_SHOW_HISTORICAL_DATA, settings.showHistoricalData)
            .putBoolean(KEY_SHOW_DATES, settings.showDates)
            .putBoolean(KEY_SHOW_MUSHROOMS, settings.showMushrooms)
            .putBoolean(KEY_SHOW_WIDGET_LOCATION, settings.showWidgetLocation)
            .putBoolean(KEY_SHOW_SKY_VALUES, settings.showSkyValues)
            .putBoolean(KEY_SHOW_WIND_VALUES, settings.showWindValues)
            .putBoolean(KEY_SHOW_UV_VALUES, settings.showUvValues)
            .putBoolean(KEY_SHOW_HUMIDITY_VALUES, settings.showHumidityValues)
            .putBoolean(KEY_SHOW_PRESSURE_VALUES, settings.showPressureValues)
            .putBoolean(KEY_SHOW_POLLEN_VALUES, settings.showPollenValues)
            .putBoolean(KEY_SHOW_AIR_QUALITY_VALUES, settings.showAirQualityValues)
            .putBoolean(KEY_SHOW_MUSHROOM_VALUES, settings.showMushroomValues)
            .putFloat(KEY_TEMPERATURE_TEXT_SCALE, settings.temperatureTextScale)
            .apply()
    }

    fun widgetLocation(widgetId: Int, fallback: WeatherLocation): WeatherLocation {
        val encoded = preferences.getString("$KEY_WIDGET_LOCATION_PREFIX$widgetId", null) ?: return fallback
        val savedLocation = encoded.takeIf { it.startsWith('{') }?.let {
            runCatching { JSONObject(it).toLocation() }.getOrNull()
        }
        if (savedLocation != null) return savedLocation

        val locationFromSharedList = locations(listOf(fallback)).firstOrNull { it.preferenceKey() == encoded }
            ?: return fallback
        saveWidgetLocation(widgetId, locationFromSharedList)
        return locationFromSharedList
    }

    fun saveWidgetLocation(widgetId: Int, location: WeatherLocation) {
        preferences.edit().putString("$KEY_WIDGET_LOCATION_PREFIX$widgetId", location.toJson().toString()).apply()
    }

    fun widgetForecastHours(widgetId: Int): Int = preferences
        .getInt("$KEY_WIDGET_FORECAST_HOURS_PREFIX$widgetId", DEFAULT_WIDGET_FORECAST_HOURS)
        .takeIf { it in WIDGET_FORECAST_HOURS }
        ?: DEFAULT_WIDGET_FORECAST_HOURS

    fun saveWidgetForecastHours(widgetId: Int, hours: Int) {
        preferences.edit().putInt(
            "$KEY_WIDGET_FORECAST_HOURS_PREFIX$widgetId",
            hours.takeIf { it in WIDGET_FORECAST_HOURS } ?: DEFAULT_WIDGET_FORECAST_HOURS,
        ).apply()
    }

    fun widgetDisplaySettings(widgetId: Int, defaults: ForecastDisplaySettings = displaySettings()) = WidgetDisplaySettings(
        theme = preferences.getString("${KEY_WIDGET_PREFIX}theme_$widgetId", "dark").takeIf { it in THEMES } ?: "dark",
        forceLocationName = preferences.getBoolean("${KEY_WIDGET_PREFIX}location_$widgetId", false),
        showHourlyTemperatures = preferences.getBoolean("${KEY_WIDGET_PREFIX}temperatures_$widgetId", defaults.showHourlyTemperatures),
        showApparentTemperature = preferences.getBoolean("${KEY_WIDGET_PREFIX}apparent_$widgetId", defaults.showApparentTemperature),
        showPrecipitation = preferences.getBoolean("${KEY_WIDGET_PREFIX}precipitation_$widgetId", defaults.showPrecipitation),
        showWindArrows = preferences.getBoolean("${KEY_WIDGET_PREFIX}wind_arrows_$widgetId", defaults.showWindArrows),
        showMushrooms = preferences.getBoolean("${KEY_WIDGET_PREFIX}mushrooms_$widgetId", defaults.showMushrooms),
        showAlerts = preferences.getBoolean("${KEY_WIDGET_PREFIX}alerts_$widgetId", true),
        demo = preferences.getBoolean("${KEY_WIDGET_PREFIX}demo_$widgetId", false),
        temperatureTextScale = preferences.getFloat("${KEY_WIDGET_PREFIX}temperature_text_scale_$widgetId", 1f)
            .takeIf { it in TEMPERATURE_TEXT_SCALES } ?: 1f,
    )

    fun saveWidgetDisplaySettings(widgetId: Int, settings: WidgetDisplaySettings) {
        preferences.edit()
            .putString("${KEY_WIDGET_PREFIX}theme_$widgetId", settings.theme)
            .putBoolean("${KEY_WIDGET_PREFIX}location_$widgetId", settings.forceLocationName)
            .putBoolean("${KEY_WIDGET_PREFIX}temperatures_$widgetId", settings.showHourlyTemperatures)
            .putBoolean("${KEY_WIDGET_PREFIX}apparent_$widgetId", settings.showApparentTemperature)
            .putBoolean("${KEY_WIDGET_PREFIX}precipitation_$widgetId", settings.showPrecipitation)
            .putBoolean("${KEY_WIDGET_PREFIX}wind_arrows_$widgetId", settings.showWindArrows)
            .putBoolean("${KEY_WIDGET_PREFIX}mushrooms_$widgetId", settings.showMushrooms)
            .putBoolean("${KEY_WIDGET_PREFIX}alerts_$widgetId", settings.showAlerts)
            .putBoolean("${KEY_WIDGET_PREFIX}demo_$widgetId", settings.demo)
            .putFloat("${KEY_WIDGET_PREFIX}temperature_text_scale_$widgetId", settings.temperatureTextScale)
            .apply()
    }

    fun removeWidgetLocation(widgetId: Int) {
        preferences.edit()
            .remove("$KEY_WIDGET_LOCATION_PREFIX$widgetId")
            .remove("$KEY_WIDGET_FORECAST_HOURS_PREFIX$widgetId")
            .remove("${KEY_WIDGET_PREFIX}theme_$widgetId")
            .remove("${KEY_WIDGET_PREFIX}location_$widgetId")
            .remove("${KEY_WIDGET_PREFIX}temperatures_$widgetId")
            .remove("${KEY_WIDGET_PREFIX}apparent_$widgetId")
            .remove("${KEY_WIDGET_PREFIX}precipitation_$widgetId")
            .remove("${KEY_WIDGET_PREFIX}wind_arrows_$widgetId")
            .remove("${KEY_WIDGET_PREFIX}mushrooms_$widgetId")
            .remove("${KEY_WIDGET_PREFIX}alerts_$widgetId")
            .remove("${KEY_WIDGET_PREFIX}demo_$widgetId")
            .remove("${KEY_WIDGET_PREFIX}temperature_text_scale_$widgetId")
            .apply()
    }

    private fun WeatherLocation.toJson() = JSONObject().apply {
        put("name", name)
        put("country", country)
        put("latitude", latitude)
        put("longitude", longitude)
        put("timezone", timezone)
        put("countryCode", countryCode)
        put("admin1", admin1)
        put("admin2", admin2)
        put("admin3", admin3)
        put("postalCode", postalCode)
    }

    private fun WeatherLocation.preferenceKey() = "$latitude,$longitude"

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
            countryCode = optString("countryCode").takeIf(String::isNotBlank),
            admin1 = optString("admin1").takeIf(String::isNotBlank),
            admin2 = optString("admin2").takeIf(String::isNotBlank),
            admin3 = optString("admin3").takeIf(String::isNotBlank),
            postalCode = optString("postalCode").takeIf(String::isNotBlank),
        )
    }

    private companion object {
        const val PREFERENCES_NAME = "weather_preferences"
        const val KEY_LOCATIONS = "favorite_locations"
        const val KEY_DEFAULT_LOCATIONS_MIGRATED = "default_locations_migrated_v2"
        const val KEY_ACTIVE_LOCATION = "active_location"
        const val KEY_TEMPERATURE_UNIT = "temperature_unit"
        const val KEY_ANALYTICS_CONSENT = "analytics_consent"
        const val KEY_DISMISSED_ALERT_KEYS = "dismissed_alert_keys"
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
        const val KEY_SHOW_UV_INDEX = "show_uv_index"
        const val KEY_SHOW_HUMIDITY = "show_humidity"
        const val KEY_SHOW_PRESSURE = "show_pressure"
        const val KEY_SHOW_POLLEN = "show_pollen"
        const val KEY_SHOW_AIR_QUALITY = "show_air_quality"
        const val KEY_SHOW_HISTORICAL_DATA = "show_historical_data"
        const val KEY_SHOW_DATES = "show_dates"
        const val KEY_SHOW_MUSHROOMS = "show_mushrooms"
        const val KEY_SHOW_WIDGET_LOCATION = "show_widget_location"
        const val KEY_SHOW_SKY_VALUES = "show_sky_values"
        const val KEY_SHOW_WIND_VALUES = "show_wind_values"
        const val KEY_SHOW_UV_VALUES = "show_uv_values"
        const val KEY_SHOW_HUMIDITY_VALUES = "show_humidity_values"
        const val KEY_SHOW_PRESSURE_VALUES = "show_pressure_values"
        const val KEY_SHOW_POLLEN_VALUES = "show_pollen_values"
        const val KEY_SHOW_AIR_QUALITY_VALUES = "show_air_quality_values"
        const val KEY_SHOW_MUSHROOM_VALUES = "show_mushroom_values"
        const val KEY_TEMPERATURE_TEXT_SCALE = "temperature_text_scale"
        const val KEY_WIDGET_LOCATION_PREFIX = "widget_location_"
        const val KEY_WIDGET_FORECAST_HOURS_PREFIX = "widget_forecast_hours_"
        const val KEY_WIDGET_PREFIX = "widget_setting_"
        const val DEFAULT_WIDGET_FORECAST_HOURS = 48
        const val MAX_DISMISSED_ALERT_KEYS = 100
        val WIDGET_FORECAST_HOURS = (6..120 step 6).toSet()
        val ZOOM_LEVELS = setOf(.25f, .3f, .5f, .75f, 1f, 2f)
        val THEMES = setOf("system", "dark", "light")
        val LANGUAGES = setOf("system", "en-US", "pl-PL")
        val TEMPERATURE_TEXT_SCALES = setOf(.8f, .9f, .92f, 1f, 1.1f)
    }
}
