package eu.vespy.weather.data

import org.junit.Assert.assertEquals
import org.junit.Test

class WeatherModelsTest {
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
}
