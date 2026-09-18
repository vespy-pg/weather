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
    val mushroom: MushroomCondition? = null,
)

data class MushroomCondition(
    val score: Int?,
    val level: String?,
    val recentRainfall: Double?,
    val relativeHumidity: Double?,
    val soilMoisture: Double?,
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
    val showHistoricalData: Boolean = true,
    val showDates: Boolean = false,
    val showMushrooms: Boolean = false,
    val showWidgetLocation: Boolean = true,
)

data class TemperatureThresholds(
    val deepFrost: Float = -12f,
    val mild: Float = 18f,
    val warm: Float = 27f,
    val hot: Float = 32f,
)

data class WidgetDisplaySettings(
    val forceLocationName: Boolean = false,
    val showHourlyTemperatures: Boolean = true,
    val showApparentTemperature: Boolean = true,
    val showPrecipitation: Boolean = true,
    val showWindArrows: Boolean = false,
    val showMushrooms: Boolean = false,
    val demo: Boolean = false,
)

fun List<HourlyWeather>.atExactInterval(hours: Int): List<HourlyWeather> {
    require(hours > 0)
    return filterIndexed { index, _ -> index % hours == 0 }
}

fun List<HourlyWeather>.forWidgetForecast(hours: Int, columns: Int): List<HourlyWeather> {
    val safeHours = hours.coerceIn(6, 120)
    val horizon = take(safeHours)
    if (horizon.isEmpty()) return emptyList()
    val maximumPoints = (columns.coerceIn(1, 8) * 4).coerceAtLeast(6)
    val days = safeHours / 24f
    val valuesPerDay = listOf(12, 8, 6, 4, 3, 2).firstOrNull { rate ->
        days <= 0.5f || rate * days <= maximumPoints
    } ?: 2
    val interval = if (safeHours <= 12) {
        (safeHours.toFloat() / maximumPoints).toInt().coerceAtLeast(1)
    } else {
        24 / valuesPerDay
    }
    return horizon.groupByHours(interval)
}

fun List<HourlyWeather>.groupByHours(hours: Int): List<HourlyWeather> {
    require(hours > 0)
    if (hours == 1) return this
    return groupBy { point ->
        val hour = point.timestamp.substring(11, 13).toIntOrNull() ?: 0
        "${point.timestamp.take(10)}-${hour / hours}"
    }.values.map { points ->
        fun average(selector: (HourlyWeather) -> Double?): Double? =
            points.mapNotNull(selector).takeIf { it.isNotEmpty() }?.average()
        fun total(selector: (HourlyWeather) -> Double?): Double? =
            points.mapNotNull(selector).takeIf { it.isNotEmpty() }?.sum()
        fun maximum(selector: (HourlyWeather) -> Double?): Double? =
            points.mapNotNull(selector).maxOrNull()
        fun averageDirection(): Double? {
            val directions = points.mapNotNull(HourlyWeather::windDirection)
            if (directions.isEmpty()) return null
            val x = directions.sumOf { kotlin.math.cos(Math.toRadians(it)) }
            val y = directions.sumOf { kotlin.math.sin(Math.toRadians(it)) }
            return (Math.toDegrees(kotlin.math.atan2(y, x)) + 360.0) % 360.0
        }
        val severeCodes = listOf(99, 96, 86, 85, 77, 75, 73, 71, 67, 66, 57, 56, 95, 82, 81, 80, 65, 63, 55, 53, 51, 48, 45, 3)
        val code = points.mapNotNull(HourlyWeather::weatherCode).minByOrNull { severeCodes.indexOf(it).takeIf { index -> index >= 0 } ?: Int.MAX_VALUE }
        points.first().copy(
            temperature = average(HourlyWeather::temperature),
            apparentTemperature = average(HourlyWeather::apparentTemperature),
            precipitationProbability = maximum(HourlyWeather::precipitationProbability),
            precipitation = total(HourlyWeather::precipitation),
            rain = total(HourlyWeather::rain),
            snowfall = total(HourlyWeather::snowfall),
            weatherCode = code,
            cloudCover = average(HourlyWeather::cloudCover),
            windSpeed = average(HourlyWeather::windSpeed),
            windDirection = averageDirection(),
            windGusts = maximum(HourlyWeather::windGusts),
            tornado = points.any(HourlyWeather::tornado),
        )
    }
}

fun List<HourlyWeather>.timelineWindow(currentTimestamp: String, futureDays: Int, historyDays: Int): List<HourlyWeather> {
    val currentHour = currentTimestamp.take(13)
    val currentIndex = indexOfFirst { it.timestamp.take(13) == currentHour }
    if (currentIndex < 0) return take(futureDays.coerceAtLeast(0) * 24)
    val start = (currentIndex - historyDays.coerceAtLeast(0) * 24).coerceAtLeast(0)
    val end = (currentIndex + futureDays.coerceAtLeast(0) * 24).coerceAtMost(size)
    return subList(start, end)
}

fun List<HourlyWeather>.currentIndex(currentTimestamp: String): Int =
    indexOfLast { it.timestamp.take(13) <= currentTimestamp.take(13) }
