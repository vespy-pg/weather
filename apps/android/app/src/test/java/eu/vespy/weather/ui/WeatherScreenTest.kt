package eu.vespy.weather.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class WeatherScreenTest {
    @Test
    fun `sunlight chart fills the available range near the equator`() {
        val rows = listOf(
            Triple("shortest", 361, 1079),
            Triple("selected", 360, 1080),
            Triple("longest", 359, 1081),
        )

        assertEquals(359..1081, sunlightDomain(rows))
    }

    @Test
    fun `sunlight chart supports a complete polar-day range`() {
        val rows = listOf(
            Triple("shortest", 720, 720),
            Triple("selected", 60, 1380),
            Triple("longest", 0, 1440),
        )

        assertEquals(0..1440, sunlightDomain(rows))
    }

    @Test
    fun `sunlight chart keeps a safe domain when all events coincide`() {
        val rows = List(3) { Triple("collapsed", 720, 720) }

        assertEquals(690..750, sunlightDomain(rows))
    }
}
