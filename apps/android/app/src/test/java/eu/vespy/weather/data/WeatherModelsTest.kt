package eu.vespy.weather.data

import org.junit.Assert.assertEquals
import org.junit.Test

class WeatherModelsTest {
    private fun point(timestamp: String, temperature: Double, precipitation: Double = 0.0) = HourlyWeather(
        timestamp = timestamp,
        temperature = temperature,
        apparentTemperature = temperature - 1,
        precipitationProbability = temperature,
        precipitation = precipitation,
        rain = precipitation,
        snowfall = 0.0,
        weatherCode = 3,
        cloudCover = temperature,
        windSpeed = temperature,
        windDirection = 90.0,
        windGusts = temperature + 2,
    )

    @Test
    fun intervalSelectionKeepsExactSourceValues() {
        val points = (0..6).map { index ->
            HourlyWeather(
                timestamp = "2026-09-13T${index.toString().padStart(2, '0')}:00",
                temperature = index.toDouble(),
                apparentTemperature = index.toDouble(),
                precipitationProbability = null,
                precipitation = null,
                rain = null,
                snowfall = null,
                weatherCode = null,
                cloudCover = null,
                windSpeed = null,
                windGusts = null,
            )
        }

        assertEquals(listOf(0.0, 3.0, 6.0), points.atExactInterval(3).map { it.temperature })
    }

    @Test
    fun widgetForecastAdaptsGranularityToRangeAndWidth() {
        val points = (0 until 120).map { index ->
            point("2026-09-${(16 + index / 24).toString().padStart(2, '0')}T${(index % 24).toString().padStart(2, '0')}:00", index.toDouble())
        }

        assertEquals(6, points.forWidgetForecast(hours = 6, columns = 2).size)
        assertEquals(8, points.forWidgetForecast(hours = 24, columns = 2).size)
        assertEquals(15, points.forWidgetForecast(hours = 120, columns = 4).size)
        assertEquals(listOf(1.5, 5.5, 9.5, 13.5, 17.5, 21.5), points.forWidgetForecast(hours = 24, columns = 1).map { it.temperature })
    }

    @Test
    fun groupingMatchesWebGranularityAndAggregatesValues() {
        val points = listOf(
            point("2026-09-16T00:00", 10.0, 0.2),
            point("2026-09-16T01:00", 12.0, 0.3),
            point("2026-09-16T02:00", 14.0, 0.0),
            point("2026-09-16T03:00", 16.0, 0.5),
            point("2026-09-16T04:00", 20.0, 1.0),
        )

        val grouped = points.groupByHours(4)

        assertEquals(2, grouped.size)
        assertEquals(13.0, grouped[0].temperature!!, 0.001)
        assertEquals(1.0, grouped[0].precipitation!!, 0.001)
        assertEquals("2026-09-16T04:00", grouped[1].timestamp)
    }

    @Test
    fun timelineWindowKeepsHistoryAndFullFutureHorizon() {
        val points = (0 until 12 * 24).map { hour ->
            point("2026-09-${(10 + hour / 24).toString().padStart(2, '0')}T${(hour % 24).toString().padStart(2, '0')}:00", hour.toDouble())
        }
        val currentTimestamp = points[3 * 24 + 8].timestamp

        val window = points.timelineWindow(currentTimestamp, futureDays = 5, historyDays = 3)

        assertEquals(3 * 24 + 5 * 24 + 16, window.size)
        assertEquals(points[8].timestamp, window.first().timestamp)
        assertEquals("2026-09-18T23:00", window.last().timestamp)
        assertEquals(3 * 24, window.currentIndex(currentTimestamp))
    }
}
