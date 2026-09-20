package eu.vespy.weather.data

data class WeatherLocation(
    val name: String,
    val country: String,
    val latitude: Double,
    val longitude: Double,
    val timezone: String,
    val countryCode: String? = null,
    val admin1: String? = null,
    val admin2: String? = null,
    val admin3: String? = null,
    val postalCode: String? = null,
)

data class LocationSearchResults(
    val locations: List<WeatherLocation>,
    val hasMore: Boolean,
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
    val relativeHumidity: Double? = null,
    val visibility: Double? = null,
    val surfacePressure: Double? = null,
    val uvIndex: Double? = null,
    val pollen: PollenForecast? = null,
)

data class DailyWeather(
    val date: String,
    val sunrise: String?,
    val sunset: String?,
    val mushroom: MushroomCondition? = null,
    val weatherCode: Int? = null,
    val temperatureMaximum: Double? = null,
    val temperatureMinimum: Double? = null,
    val apparentTemperatureMaximum: Double? = null,
    val apparentTemperatureMinimum: Double? = null,
    val daylightDuration: Double? = null,
    val sunshineDuration: Double? = null,
    val precipitation: Double? = null,
    val precipitationProbability: Double? = null,
    val windSpeedMaximum: Double? = null,
    val windGustsMaximum: Double? = null,
    val windDirection: Double? = null,
    val uvIndexMaximum: Double? = null,
    val pollen: PollenForecast? = null,
    val airQuality: AirQualityForecast? = null,
)

data class PollenForecast(
    val alder: Double?,
    val birch: Double?,
    val grass: Double?,
    val mugwort: Double?,
    val olive: Double?,
    val ragweed: Double?,
)

data class AirQualityForecast(
    val europeanAqi: Double?,
    val pm25: Double?,
    val pm10: Double?,
    val nitrogenDioxide: Double?,
    val ozone: Double?,
    val sulphurDioxide: Double?,
    val carbonMonoxide: Double?,
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
    val alerts: List<WeatherAlert> = emptyList(),
)

data class WeatherAlert(
    val id: String,
    val event: String,
    val headline: String,
    val description: String?,
    val instruction: String?,
    val area: String?,
    val severity: String,
    val onset: String?,
    val expires: String?,
    val source: String,
    val sourceUrl: String,
)

enum class ForecastSummary {
    FREEZING_PRECIPITATION,
    THUNDERSTORMS,
    SNOW,
    RAIN,
    WINDY,
    WIND_EASING,
    WIND_INCREASING,
    WARMING,
    COOLING,
    STABLE,
}

private data class ForecastSummaryCandidate(val summary: ForecastSummary, val priority: Int, val start: Int)

fun WeatherForecast.nextDaysSummaries(limit: Int = 2): List<ForecastSummary> {
    val currentHour = current.timestamp.take(13)
    val nextHours = hourly.filter { it.timestamp.take(13) >= currentHour }.take(72)
    if (nextHours.isEmpty()) return listOf(ForecastSummary.STABLE)
    val candidates = mutableListOf<ForecastSummaryCandidate>()
    fun add(summary: ForecastSummary, priority: Int, predicate: (HourlyWeather) -> Boolean) {
        val index = nextHours.indexOfFirst(predicate).takeIf { it >= 0 } ?: nextHours.lastIndex
        candidates += ForecastSummaryCandidate(summary, priority, index)
    }
    val freezing: (HourlyWeather) -> Boolean = { it.weatherCode in setOf(56, 57, 66, 67) }
    val storm: (HourlyWeather) -> Boolean = { it.tornado || it.weatherCode in setOf(95, 96, 99) }
    val snow: (HourlyWeather) -> Boolean = { (it.snowfall ?: 0.0) > 0.0 || it.weatherCode in 71..77 || it.weatherCode in 85..86 }
    val rain: (HourlyWeather) -> Boolean = { (it.rain ?: it.precipitation ?: 0.0) > 0.0 || it.weatherCode in setOf(51, 53, 55, 61, 63, 65, 80, 81, 82) }
    if (nextHours.any(freezing)) add(ForecastSummary.FREEZING_PRECIPITATION, 100, freezing)
    if (nextHours.any(storm)) add(ForecastSummary.THUNDERSTORMS, 95, storm)
    if (nextHours.sumOf { it.snowfall ?: 0.0 } >= 1.0 || nextHours.any(snow)) add(ForecastSummary.SNOW, 85, snow)
    if (nextHours.sumOf { it.rain ?: it.precipitation ?: 0.0 } >= 5.0 || nextHours.any { it.weatherCode in setOf(51, 53, 55, 61, 63, 65, 80, 81, 82) }) {
        add(ForecastSummary.RAIN, 75, rain)
    }
    val sampleSize = minOf(24, nextHours.size / 2)
    if (sampleSize >= 6) {
        val initial = nextHours.take(sampleSize)
        val final = nextHours.takeLast(sampleSize)
        val initialWind = initial.mapNotNull(HourlyWeather::windSpeed).averageOrNull() ?: 0.0
        val finalWind = final.mapNotNull(HourlyWeather::windSpeed).averageOrNull() ?: 0.0
        val initialGust = initial.maxOfOrNull { it.windGusts ?: 0.0 } ?: 0.0
        val finalGust = final.maxOfOrNull { it.windGusts ?: 0.0 } ?: 0.0
        val windCurrentlyStrong = initialWind >= 25.0 || initialGust >= 40.0
        val windLaterStrong = finalWind >= 25.0 || finalGust >= 40.0
        when {
            windCurrentlyStrong && initialWind - finalWind >= 8.0 && initialGust - finalGust >= 10.0 ->
                candidates += ForecastSummaryCandidate(ForecastSummary.WIND_EASING, 80, 0)
            windLaterStrong && finalWind - initialWind >= 8.0 && finalGust - initialGust >= 10.0 ->
                candidates += ForecastSummaryCandidate(ForecastSummary.WIND_INCREASING, 80, sampleSize)
            (nextHours.maxOfOrNull { it.windSpeed ?: 0.0 } ?: 0.0) >= 35.0 || (nextHours.maxOfOrNull { it.windGusts ?: 0.0 } ?: 0.0) >= 55.0 ->
                add(ForecastSummary.WINDY, 80) { (it.windSpeed ?: 0.0) >= 35.0 || (it.windGusts ?: 0.0) >= 55.0 }
        }
        val initialTemperature = initial.mapNotNull(HourlyWeather::temperature).averageOrNull()
        val finalTemperature = final.mapNotNull(HourlyWeather::temperature).averageOrNull()
        val change = if (initialTemperature == null || finalTemperature == null) 0.0 else finalTemperature - initialTemperature
        when {
            change >= 3.0 -> candidates += ForecastSummaryCandidate(ForecastSummary.WARMING, 50, sampleSize)
            change <= -3.0 -> candidates += ForecastSummaryCandidate(ForecastSummary.COOLING, 50, sampleSize)
        }
    }
    if (candidates.isEmpty()) return listOf(ForecastSummary.STABLE)
    return candidates.sortedWith(compareByDescending<ForecastSummaryCandidate> { it.priority }.thenBy { it.start })
        .take(limit.coerceAtLeast(1))
        .sortedWith(compareBy<ForecastSummaryCandidate> { it.start }.thenByDescending { it.priority })
        .map(ForecastSummaryCandidate::summary)
}

fun WeatherForecast.nextDaysSummary(): ForecastSummary = nextDaysSummaries(1).first()

private fun List<Double>.averageOrNull(): Double? = if (isEmpty()) null else average()

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
    val theme: String = "dark",
    val language: String = "system",
    val temperatureThresholds: TemperatureThresholds = TemperatureThresholds(),
    val showHourlyTemperatures: Boolean = true,
    val showApparentTemperature: Boolean = true,
    val showPrecipitation: Boolean = true,
    val showWind: Boolean = true,
    val showWindArrows: Boolean = false,
    val showUvIndex: Boolean = true,
    val showHumidity: Boolean = true,
    val showPressure: Boolean = true,
    val showPollen: Boolean = true,
    val showHistoricalData: Boolean = true,
    val showDates: Boolean = false,
    val showMushrooms: Boolean = false,
    val showWidgetLocation: Boolean = true,
    val temperatureTextScale: Float = .92f,
)

data class TemperatureThresholds(
    val deepFrost: Float = -12f,
    val mild: Float = 18f,
    val warm: Float = 27f,
    val hot: Float = 32f,
)

data class WidgetDisplaySettings(
    val theme: String = "dark",
    val forceLocationName: Boolean = false,
    val showHourlyTemperatures: Boolean = true,
    val showApparentTemperature: Boolean = true,
    val showPrecipitation: Boolean = true,
    val showWindArrows: Boolean = false,
    val showMushrooms: Boolean = false,
    val demo: Boolean = false,
    val temperatureTextScale: Float = 1f,
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
    val requestedEnd = (currentIndex + futureDays.coerceAtLeast(0) * 24).coerceAtMost(size)
    val boundaryDate = getOrNull(requestedEnd - 1)?.timestamp?.take(10)
    val end = if (boundaryDate == null) requestedEnd else {
        (requestedEnd until size).firstOrNull { this[it].timestamp.take(10) != boundaryDate } ?: size
    }
    return subList(start, end)
}

fun List<HourlyWeather>.currentIndex(currentTimestamp: String): Int =
    indexOfLast { it.timestamp.take(13) <= currentTimestamp.take(13) }
