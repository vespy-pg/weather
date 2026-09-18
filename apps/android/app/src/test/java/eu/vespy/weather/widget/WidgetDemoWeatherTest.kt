package eu.vespy.weather.widget

import org.junit.Assert.assertTrue
import org.junit.Test

class WidgetDemoWeatherTest {
    @Test
    fun demoContainsTheWebExtremeWeatherSequence() {
        val forecast = widgetDemoForecast()
        val fourthDay = forecast.hourly.drop(72).take(24)

        assertTrue(fourthDay.any { (it.snowfall ?: 0.0) > 0.0 })
        assertTrue(fourthDay.any { it.weatherCode == 99 })
        assertTrue(fourthDay.any { it.tornado })
        assertTrue(fourthDay.mapNotNull { it.temperature }.min() < 0.0)
    }
}
