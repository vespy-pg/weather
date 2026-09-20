package eu.vespy.weather.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.time.LocalDate

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

    @Test
    fun `moon phase follows known new and full moon dates`() {
        val newMoon = moonPhase(LocalDate.of(2000, 1, 6))
        val fullMoon = moonPhase(LocalDate.of(2000, 1, 21))

        assertTrue(newMoon < .04)
        assertTrue(fullMoon in 0.48..0.55)
    }

    @Test
    fun `moon times wrap safely across midnight`() {
        assertEquals(30, normalizeMinutes(1470))
        assertEquals(1410, normalizeMinutes(-30))
    }

    @Test
    fun `scroll gesture stops at now without attracting nearby positions`() {
        assertEquals(NowBoundaryResult(100f, true), stopAtNowBoundary(80f, 120f, 100f, -1, false))
        assertEquals(NowBoundaryResult(100f, true), stopAtNowBoundary(120f, 80f, 100f, 1, false))
        assertEquals(NowBoundaryResult(92f, false), stopAtNowBoundary(80f, 92f, 100f, -1, false))
        assertEquals(NowBoundaryResult(100f, true), stopAtNowBoundary(100f, 140f, 100f, -1, true))
        assertEquals(NowBoundaryResult(120f, false), stopAtNowBoundary(100f, 120f, 100f, 0, false))
    }
}
