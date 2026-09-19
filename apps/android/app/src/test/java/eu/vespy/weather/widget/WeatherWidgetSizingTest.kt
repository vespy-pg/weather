package eu.vespy.weather.widget

import org.junit.Assert.assertEquals
import org.junit.Test

class WeatherWidgetSizingTest {
    @Test
    fun mapsLauncherHeightsToExpectedWidgetRows() {
        assertEquals(1, widgetRowCount(40))
        assertEquals(2, widgetRowCount(110))
        assertEquals(3, widgetRowCount(180))
    }
}
