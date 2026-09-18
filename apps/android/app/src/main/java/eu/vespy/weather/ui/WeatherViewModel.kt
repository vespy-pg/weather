package eu.vespy.weather.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.viewModelScope
import eu.vespy.weather.analytics.WeatherAnalytics
import eu.vespy.weather.data.Promotion
import eu.vespy.weather.data.ForecastDisplaySettings
import eu.vespy.weather.data.WeatherApi
import eu.vespy.weather.data.WeatherForecast
import eu.vespy.weather.data.WeatherLocation
import eu.vespy.weather.data.WeatherPreferences
import eu.vespy.weather.widget.WeatherWidgetProvider
import eu.vespy.weather.widget.widgetDemoForecast
import kotlinx.coroutines.launch
import java.util.Locale

data class WeatherUiState(
    val location: WeatherLocation = DEFAULT_LOCATIONS.first(),
    val forecast: WeatherForecast? = null,
    val promotions: List<Promotion> = emptyList(),
    val promotionRotationSeconds: Int = 8,
    val loading: Boolean = true,
    val error: String? = null,
    val locations: List<WeatherLocation> = DEFAULT_LOCATIONS,
    val locationResults: List<WeatherLocation> = emptyList(),
    val searchingLocations: Boolean = false,
    val temperatureUnit: String = "C",
    val displaySettings: ForecastDisplaySettings = ForecastDisplaySettings(),
    val analyticsConsent: Boolean? = null,
    val demo: Boolean = false,
)

val DEFAULT_LOCATIONS = listOf(
    WeatherLocation("Jastrząb Rozparcelowany", "Poland", 50.67244, 19.18239, "Europe/Warsaw"),
    WeatherLocation("Katowice", "Poland", 50.2649, 19.0238, "Europe/Warsaw"),
    WeatherLocation("London", "United Kingdom", 51.5074, -0.1278, "Europe/London"),
)

class WeatherViewModel(application: Application) : AndroidViewModel(application) {
    private val api = WeatherApi()
    private val preferences = WeatherPreferences(application)
    private val analytics = WeatherAnalytics(application, preferences.analyticsConsent())
    private val savedLocations = preferences.locations(DEFAULT_LOCATIONS)
    private val savedLocation = preferences.activeLocation(savedLocations.first())

    var state by mutableStateOf(
        WeatherUiState(
            location = savedLocation,
            locations = savedLocations,
            temperatureUnit = preferences.temperatureUnit(),
            displaySettings = preferences.displaySettings(),
            analyticsConsent = preferences.analyticsConsent(),
        ),
    )
        private set

    init {
        refresh()
    }

    fun selectLocation(location: WeatherLocation, darkTheme: Boolean) {
        if (location == state.location) return
        state = state.copy(location = location, demo = false)
        preferences.saveActiveLocation(location)
        analytics.locationSelected("saved")
        WeatherWidgetProvider.refreshAll(getApplication())
        refresh(darkTheme)
    }

    fun showDemo() {
        val forecast = widgetDemoForecast()
        state = state.copy(
            location = forecast.location,
            forecast = forecast,
            displaySettings = state.displaySettings.copy(zoom = .3f),
            loading = false,
            error = null,
            demo = true,
        )
    }

    fun addLocation(location: WeatherLocation, darkTheme: Boolean, source: String = "search") {
        val locations = (state.locations + location).distinctBy { "${it.latitude},${it.longitude}" }
        state = state.copy(locations = locations, locationResults = emptyList(), location = location)
        preferences.saveLocations(locations)
        preferences.saveActiveLocation(location)
        analytics.locationSelected(source)
        WeatherWidgetProvider.refreshAll(getApplication())
        refresh(darkTheme)
    }

    fun removeLocation(location: WeatherLocation, darkTheme: Boolean) {
        if (state.locations.size <= 1) return
        val removedActiveLocation = state.location.latitude == location.latitude && state.location.longitude == location.longitude
        val locations = state.locations.filterNot { it.latitude == location.latitude && it.longitude == location.longitude }
        val activeLocation = if (removedActiveLocation) locations.first() else state.location
        state = state.copy(locations = locations, location = activeLocation)
        preferences.saveLocations(locations)
        preferences.saveActiveLocation(activeLocation)
        WeatherWidgetProvider.refreshAll(getApplication())
        if (removedActiveLocation) refresh(darkTheme)
    }

    fun searchLocations(query: String) {
        if (query.trim().length < 2) return
        state = state.copy(searchingLocations = true, locationResults = emptyList())
        viewModelScope.launch {
            val results = runCatching { api.locations(query.trim(), Locale.getDefault().language) }.getOrDefault(emptyList())
            state = state.copy(searchingLocations = false, locationResults = results)
        }
    }

    fun addCurrentLocation(latitude: Double, longitude: Double, darkTheme: Boolean) {
        viewModelScope.launch {
            val fallback = WeatherLocation("Current location", "", latitude, longitude, "auto")
            val location = runCatching { api.reverseLocation(latitude, longitude, Locale.getDefault().language) }.getOrDefault(fallback)
            addLocation(location, darkTheme, "device")
        }
    }

    fun setTemperatureUnit(unit: String) {
        val normalized = if (unit == "F") "F" else "C"
        if (normalized == state.temperatureUnit) return
        state = state.copy(temperatureUnit = normalized)
        preferences.saveTemperatureUnit(normalized)
        analytics.displayPreferenceChanged("temperature_unit", normalized)
        WeatherWidgetProvider.refreshAll(getApplication())
    }

    fun setDisplaySettings(settings: ForecastDisplaySettings) {
        val previous = state.displaySettings
        state = state.copy(displaySettings = settings)
        preferences.saveDisplaySettings(settings)
        when {
            settings.theme != previous.theme -> analytics.displayPreferenceChanged("theme", settings.theme)
            settings.language != previous.language -> analytics.displayPreferenceChanged("language", settings.language)
            settings.zoom != previous.zoom -> analytics.displayPreferenceChanged("zoom", settings.zoom.toString())
            settings.temperatureThresholds != previous.temperatureThresholds -> analytics.displayPreferenceChanged("temperature_threshold", "changed")
            settings.showHourlyTemperatures != previous.showHourlyTemperatures -> analytics.displayPreferenceChanged("hourly_temperatures", settings.showHourlyTemperatures.toString())
            settings.showApparentTemperature != previous.showApparentTemperature -> analytics.displayPreferenceChanged("apparent_temperature", settings.showApparentTemperature.toString())
            settings.showPrecipitation != previous.showPrecipitation -> analytics.displayPreferenceChanged("precipitation", settings.showPrecipitation.toString())
            settings.showWind != previous.showWind -> analytics.displayPreferenceChanged("wind", settings.showWind.toString())
            settings.showWindArrows != previous.showWindArrows -> analytics.displayPreferenceChanged("wind_arrows", settings.showWindArrows.toString())
            settings.showHistoricalData != previous.showHistoricalData -> analytics.displayPreferenceChanged("historical_data", settings.showHistoricalData.toString())
            settings.showDates != previous.showDates -> analytics.displayPreferenceChanged("dates", settings.showDates.toString())
            settings.showMushrooms != previous.showMushrooms -> analytics.displayPreferenceChanged("mushrooms", settings.showMushrooms.toString())
            settings.showWidgetLocation != previous.showWidgetLocation -> analytics.displayPreferenceChanged("widget_location", settings.showWidgetLocation.toString())
        }
        if (settings.theme != previous.theme || settings.temperatureThresholds != previous.temperatureThresholds || settings.showWidgetLocation != previous.showWidgetLocation) {
            WeatherWidgetProvider.refreshAll(getApplication())
        }
    }

    fun setAnalyticsConsent(enabled: Boolean) {
        preferences.saveAnalyticsConsent(enabled)
        analytics.setConsent(enabled)
        state = state.copy(analyticsConsent = enabled)
    }

    fun recordPromotionImpression(campaignId: String) = analytics.promotionImpression(campaignId)

    fun recordPromotionClick(campaignId: String) = analytics.promotionClick(campaignId)

    fun refreshPromotions(darkTheme: Boolean, landscape: Boolean) {
        viewModelScope.launch {
            val language = state.displaySettings.language.takeUnless { it == "system" } ?: Locale.getDefault().toLanguageTag()
            val feed = runCatching {
                api.promotions(language, if (darkTheme) "dark" else "light", if (landscape) "forecast_landscape" else "forecast_portrait")
            }.getOrNull()
            state = state.copy(
                promotions = feed?.campaigns.orEmpty(),
                promotionRotationSeconds = feed?.rotationSeconds ?: 8,
            )
        }
    }

    fun refresh(darkTheme: Boolean = true) {
        val requestedLocation = state.location
        val requestedDemo = state.demo
        state = state.copy(loading = true, error = null)
        viewModelScope.launch {
            try {
                val forecast = if (requestedDemo) widgetDemoForecast() else api.forecast(
                    requestedLocation,
                    if (state.displaySettings.showHistoricalData) 3 else 0,
                    state.displaySettings.showMushrooms,
                )
                val promotions = runCatching {
                    api.promotions(Locale.getDefault().language, if (darkTheme) "dark" else "light", "forecast_portrait")
                }.getOrNull()
                if (state.demo != requestedDemo || (!requestedDemo && state.location != requestedLocation)) return@launch
                state = state.copy(
                    forecast = forecast,
                    promotions = promotions?.campaigns.orEmpty(),
                    loading = false,
                )
                analytics.forecastLoaded()
            } catch (error: Exception) {
                state = state.copy(loading = false, error = error.message ?: "Unknown error")
            }
        }
    }
}
