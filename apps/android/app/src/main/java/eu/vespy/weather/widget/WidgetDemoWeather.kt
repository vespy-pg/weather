package eu.vespy.weather.widget

import eu.vespy.weather.data.CurrentWeather
import eu.vespy.weather.data.DailyWeather
import eu.vespy.weather.data.HourlyWeather
import eu.vespy.weather.data.MushroomCondition
import eu.vespy.weather.data.WeatherForecast
import eu.vespy.weather.data.WeatherLocation
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter
import kotlin.math.PI
import kotlin.math.sin

private val demoTimestamp = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")
private data class DemoScenario(val code: Int, val clouds: Double, val probability: Double = 0.0, val precipitation: Double = 0.0, val snowfall: Double = 0.0, val tornado: Boolean = false)

private fun demoScenario(day: Int, hour: Int): DemoScenario = when (day) {
    0 -> DemoScenario(if (hour < 18) 0 else 1, if (hour < 18) 0.0 else 18.0)
    1 -> when {
        hour < 14 -> DemoScenario(if (hour < 7) 1 else 0, if (hour < 7) 18.0 else 5.0)
        hour == 14 -> DemoScenario(2, 42.0, 10.0)
        hour == 15 -> DemoScenario(3, 68.0, 22.0, .1)
        hour in 16..18 -> DemoScenario(95, 78.0 + (hour - 16) * 7, 30.0 + (hour - 16) * 12, .25 + (hour - 16) * .25)
        hour == 19 -> DemoScenario(61, 72.0, 38.0, .35)
        else -> DemoScenario(2, 45.0, 12.0)
    }
    2 -> when { hour < 8 -> DemoScenario(1, 15.0); hour < 18 -> DemoScenario(0, 3.0); else -> DemoScenario(2, 28.0) }
    3 -> when {
        hour == 0 -> DemoScenario(45, 82.0, 5.0)
        hour <= 2 -> DemoScenario(48, 96.0, 8.0)
        hour == 3 -> DemoScenario(71, 78.0, 20.0, .08, .2)
        hour == 4 -> DemoScenario(73, 88.0, 46.0, .28, .8)
        hour == 5 -> DemoScenario(75, 100.0, 88.0, 1.1, 2.6)
        hour == 6 -> DemoScenario(86, 100.0, 98.0, 1.8, 4.1)
        hour == 7 -> DemoScenario(67, 98.0, 76.0, .9)
        hour == 8 -> DemoScenario(53, 88.0, 48.0, .25)
        hour in 9..10 -> DemoScenario(63, 92.0, if (hour == 9) 68.0 else 82.0, if (hour == 9) 1.2 else 2.2)
        hour == 11 -> DemoScenario(3, 80.0, 32.0, .15)
        hour == 12 -> DemoScenario(2, 58.0, 18.0)
        hour == 13 -> DemoScenario(3, 72.0, 22.0, .1)
        hour == 14 -> DemoScenario(96, 88.0, 38.0, .45)
        hour == 15 -> DemoScenario(99, 100.0, 98.0, 5.5)
        hour in 16..19 -> DemoScenario(99, 100.0, 96.0, 5.2, tornado = true)
        hour == 20 -> DemoScenario(95, 95.0, 84.0, 3.2)
        hour == 21 -> DemoScenario(63, 82.0, 62.0, 1.2)
        else -> DemoScenario(2, 55.0, 20.0, .1)
    }
    4 -> if (hour < 4) DemoScenario(3, 72.0, 12.0) else if (hour in 5..10) DemoScenario(if (hour < 7) 71 else 73, 84.0, 38.0, .22, .55) else DemoScenario(2, if (hour < 16) 52.0 else 35.0, 8.0)
    5 -> if (hour < 5) DemoScenario(3, 90.0, 42.0, .2, .5) else if (hour <= 15) DemoScenario(86, 100.0, 90.0, 1.5, 3.2) else DemoScenario(73, 82.0, 48.0, .25, .7)
    6 -> when { hour < 7 -> DemoScenario(48, 96.0, 8.0); hour < 10 -> DemoScenario(67, 92.0, 66.0, .7); hour < 15 -> DemoScenario(3, 78.0, 20.0); else -> DemoScenario(2, 45.0, 8.0) }
    7 -> DemoScenario(if (hour < 8 || hour > 20) 1 else 0, if (hour < 8 || hour > 20) 18.0 else 2.0)
    8 -> when { hour < 8 -> DemoScenario(45, 82.0, 5.0); hour < 14 -> DemoScenario(53, 75.0, 58.0, .2); else -> DemoScenario(61, 88.0, 78.0, .8) }
    else -> if (hour < 12) DemoScenario(3, 88.0, 25.0, .1) else DemoScenario(2, 48.0, 8.0)
}

fun widgetDemoForecast(): WeatherForecast {
    val start = LocalDateTime.now().toLocalDate().atStartOfDay()
    val ranges = listOf(14.0 to 25.0, 16.0 to 29.0, 8.0 to 32.0, -6.0 to 22.0, -4.0 to 3.0, -18.0 to -6.0, -2.0 to 7.0, 24.0 to 38.0, 16.0 to 27.0, 9.0 to 18.0)
    val hourly = (0 until 240).map { index ->
        val time = start.plusHours(index.toLong())
        val day = index / 24
        val (minimum, maximum) = ranges[day]
        val warmth = (1 + sin((time.hour - 9) / 24.0 * PI * 2)) / 2
        val temperature = minimum + (maximum - minimum) * warmth
        val scenario = demoScenario(day, time.hour)
        val snow = scenario.code in setOf(71, 73, 75, 77, 85, 86)
        val storm = scenario.code >= 95
        val wind = 2.0 + 28.0 * ((1 + sin(index / 9.0)) / 2) + if (storm) 12 else 0
        HourlyWeather(
            timestamp = time.format(demoTimestamp),
            temperature = temperature,
            apparentTemperature = temperature - wind / 12,
            precipitationProbability = scenario.probability,
            precipitation = scenario.precipitation,
            rain = if (!snow) scenario.precipitation else 0.0,
            snowfall = scenario.snowfall,
            weatherCode = scenario.code,
            cloudCover = scenario.clouds,
            windSpeed = wind,
            windDirection = (235.0 + sin(index / 13.0) * 22 + 360) % 360,
            windGusts = wind + if (storm) 22 else 7,
            tornado = scenario.tornado,
        )
    }
    val mushroomScores = listOf(38, 52, 68, 81, 87, 74, 59, 44, 31, 63)
    val daily = (0 until 10).map { day ->
        val date = start.toLocalDate().plusDays(day.toLong())
        val score = mushroomScores[day]
        DailyWeather(
            date = date.toString(),
            sunrise = "${date}T06:30",
            sunset = "${date}T18:45",
            mushroom = MushroomCondition(score, if (score >= 75) "excellent" else if (score >= 50) "good" else "fair", 4 + score * .32, 52 + score * .45, .1 + score * .0022),
        )
    }
    val first = hourly.first()
    return WeatherForecast(
        WeatherLocation("DEMO", "", 50.6709, 19.12265, "Europe/Warsaw"),
        CurrentWeather(first.timestamp, first.temperature, first.apparentTemperature, first.precipitation, first.windSpeed),
        hourly,
        daily,
    )
}
