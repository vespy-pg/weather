package eu.vespy.weather.ui

import android.content.Context
import eu.vespy.weather.R
import eu.vespy.weather.data.ForecastSummary
import eu.vespy.weather.data.WeatherForecast
import eu.vespy.weather.data.nextDaysSummaries

fun forecastSummaryResource(summary: ForecastSummary): Int = when (summary) {
    ForecastSummary.FREEZING_PRECIPITATION -> R.string.forecast_summary_freezing_precipitation
    ForecastSummary.THUNDERSTORMS -> R.string.forecast_summary_thunderstorms
    ForecastSummary.SNOW -> R.string.forecast_summary_snow
    ForecastSummary.RAIN -> R.string.forecast_summary_rain
    ForecastSummary.WINDY -> R.string.forecast_summary_windy
    ForecastSummary.WIND_EASING -> R.string.forecast_summary_wind_easing
    ForecastSummary.WIND_INCREASING -> R.string.forecast_summary_wind_increasing
    ForecastSummary.WARMING -> R.string.forecast_summary_warming
    ForecastSummary.COOLING -> R.string.forecast_summary_cooling
    ForecastSummary.STABLE -> R.string.forecast_summary_stable
}

fun forecastSummaryText(context: Context, forecast: WeatherForecast): String = forecast.nextDaysSummaries()
    .joinToString(" ") { context.getString(forecastSummaryResource(it)) }
