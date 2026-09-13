package eu.vespy.weather.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.ComponentName
import android.content.Intent
import android.content.res.Configuration
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.widget.RemoteViews
import eu.vespy.weather.MainActivity
import eu.vespy.weather.R
import eu.vespy.weather.data.WeatherApi
import eu.vespy.weather.data.WeatherPreferences
import eu.vespy.weather.data.atExactInterval
import eu.vespy.weather.ui.DEFAULT_LOCATIONS
import eu.vespy.weather.ui.ForecastGraphics
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

class WeatherWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        val result = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val preferences = WeatherPreferences(context)
                val location = preferences.activeLocation(preferences.locations(DEFAULT_LOCATIONS).first())
                val forecast = WeatherApi().forecast(location)
                val temperatureUnit = preferences.temperatureUnit()
                val displaySettings = preferences.displaySettings()
                appWidgetIds.forEach { widgetId ->
                    val options = manager.getAppWidgetOptions(widgetId)
                    val widthDp = max(40, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 80))
                    val heightDp = max(40, options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110))
                    val density = context.resources.displayMetrics.density.coerceAtMost(2.5f)
                    val columns = options.getInt(SAMSUNG_COLUMN_SPAN, 0).takeIf { it > 0 }
                        ?: (widthDp / 80).coerceIn(1, 8)
                    val rows = options.getInt(SAMSUNG_ROW_SPAN, 0).takeIf { it > 0 }
                        ?: ((heightDp + 13) / 136).coerceIn(1, 8)
                    val hours = columns * 12
                    val points = forecast.hourly.take(hours).atExactInterval(3)
                    val dark = context.resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES
                    val bitmap = renderWidget(
                        width = min(1600, (widthDp * density).roundToInt()),
                        height = (heightDp * density).roundToInt(),
                        points = points,
                        days = forecast.daily,
                        dark = dark,
                        todayLabel = context.getString(R.string.today),
                        density = density,
                        rows = rows,
                        temperatureUnit = temperatureUnit,
                        temperatureThresholds = displaySettings.temperatureThresholds,
                    )
                    manager.updateAppWidget(widgetId, views(context, bitmap, widgetId))
                }
            } catch (_: Exception) {
                // Keep the last successful widget frame when the network or provider is unavailable.
            } finally {
                result.finish()
            }
        }
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, appWidgetId: Int, newOptions: android.os.Bundle) {
        onUpdate(context, manager, intArrayOf(appWidgetId))
    }

    private fun views(context: Context, bitmap: Bitmap, widgetId: Int): RemoteViews =
        RemoteViews(context.packageName, R.layout.weather_widget).apply {
            setImageViewBitmap(R.id.widget_image, bitmap)
            val intent = Intent(context, MainActivity::class.java)
            val pendingIntent = PendingIntent.getActivity(context, widgetId, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
            setOnClickPendingIntent(R.id.widget_image, pendingIntent)
        }

    private fun renderWidget(
        width: Int,
        height: Int,
        points: List<eu.vespy.weather.data.HourlyWeather>,
        days: List<eu.vespy.weather.data.DailyWeather>,
        dark: Boolean,
        todayLabel: String,
        density: Float,
        rows: Int,
        temperatureUnit: String,
        temperatureThresholds: eu.vespy.weather.data.TemperatureThresholds,
    ): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val radius = min(width, height) * .08f
        val bounds = RectF(0f, 0f, width.toFloat(), height.toFloat())
        canvas.drawRoundRect(bounds, radius, radius, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (dark) Color.rgb(12, 18, 27) else Color.rgb(247, 250, 255)
        })
        canvas.save()
        canvas.clipPath(android.graphics.Path().apply { addRoundRect(bounds, radius, radius, android.graphics.Path.Direction.CW) })
        val expanded = rows >= 3
        val labelHeight = height * if (rows == 1) .38f else .24f
        val contentHeight = height - labelHeight
        val skyHeight = if (expanded) min(68f * density, contentHeight * .36f) else min(56f * density, contentHeight * .3f)
        val windHeight = if (expanded) min(42f * density, contentHeight * .22f) else min(34f * density, contentHeight * .18f)
        ForecastGraphics.drawTimeline(
            canvas, bounds, points, days, dark, todayLabel, labelHeight, skyHeight, windHeight,
            pixelScale = density,
            textScale = when {
                expanded -> 1.6f
                rows == 1 -> 2.6f
                else -> 1.5f
            },
            showHours = expanded,
            temperatureStep = 2,
            precipitationScale = if (expanded) 1.8f else 1.55f,
            showWeekdayNames = true,
            temperatureUnit = temperatureUnit,
            dayLabelTextSize = 16f * density,
            hourTextSize = 13f * density,
            temperatureTextSize = 24f * density,
            windScale = if (expanded) 1.22f else 1f,
            temperatureThresholds = temperatureThresholds,
        )
        canvas.restore()
        return bitmap
    }

    companion object {
        private const val SAMSUNG_COLUMN_SPAN = "semAppWidgetColumnSpan"
        private const val SAMSUNG_ROW_SPAN = "semAppWidgetRowSpan"

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, WeatherWidgetProvider::class.java)
            val widgetIds = manager.getAppWidgetIds(component)
            if (widgetIds.isEmpty()) return
            context.sendBroadcast(Intent(context, WeatherWidgetProvider::class.java).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds)
            })
        }
    }
}
