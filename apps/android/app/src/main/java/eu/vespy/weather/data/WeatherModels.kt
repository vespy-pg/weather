package eu.vespy.weather.data

data class WeatherLocation(
    val name: String,
    val country: String,
    val latitude: Double,
    val longitude: Double,
    val timezone: String,
)

data class CurrentWeather(
    val timestamp: String,
    val temperature: Double?,
    val apparentTemperature: Double?,
    val precipitation: Double?,
    val windSpeed: Double?,
)

data class HourlyWeather(
    val timestamp: String,
    val temperature: Double?,
    val apparentTemperature: Double?,
    val precipitationProbability: Double?,
    val precipitation: Double?,
    val rain: Double?,
    val snowfall: Double?,
    val weatherCode: Int?,
    val cloudCover: Double?,
    val windSpeed: Double?,
    val windDirection: Double? = null,
    val windGusts: Double?,
    val tornado: Boolean = false,
)

data class DailyWeather(
    val date: String,
    val sunrise: String?,
    val sunset: String?,
)

data class WeatherForecast(
    val location: WeatherLocation,
    val current: CurrentWeather,
    val hourly: List<HourlyWeather>,
    val daily: List<DailyWeather>,
)

data class Promotion(
    val id: String,
    val type: String,
    val eyebrow: String,
    val title: String,
    val description: String,
    val actionLabel: String,
    val targetUrl: String,
    val logoUrl: String?,
    val imageUrl: String?,
    val imageAlt: String?,
    val backgroundColor: String?,
    val accentColor: String?,
    val priority: Int,
)

data class PromotionFeed(
    val campaigns: List<Promotion>,
    val rotationSeconds: Int,
)

data class ForecastDisplaySettings(
    val zoom: Float = .5f,
    val theme: String = "system",
    val language: String = "system",
    val temperatureThresholds: TemperatureThresholds = TemperatureThresholds(),
    val showHourlyTemperatures: Boolean = true,
    val showApparentTemperature: Boolean = true,
    val showPrecipitation: Boolean = true,
    val showWind: Boolean = true,
    val showWindArrows: Boolean = false,
)

data class TemperatureThresholds(
    val deepFrost: Float = -12f,
    val mild: Float = 18f,
    val warm: Float = 27f,
    val hot: Float = 32f,
)

fun List<HourlyWeather>.atExactInterval(hours: Int): List<HourlyWeather> {
    require(hours > 0)
    return filterIndexed { index, _ -> index % hours == 0 }
}
