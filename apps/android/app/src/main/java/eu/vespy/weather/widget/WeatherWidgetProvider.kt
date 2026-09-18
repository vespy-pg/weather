package eu.vespy.weather.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.Context
import android.content.ComponentName
import android.content.Intent
import android.content.res.Configuration
import android.net.Uri
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.RectF
import android.os.Build
import android.os.Bundle
import android.util.SizeF
import android.widget.RemoteViews
import eu.vespy.weather.MainActivity
import eu.vespy.weather.R
import eu.vespy.weather.withSavedAppLocale
import eu.vespy.weather.data.WeatherApi
import eu.vespy.weather.data.WeatherPreferences
import eu.vespy.weather.data.forWidgetForecast
import eu.vespy.weather.ui.DEFAULT_LOCATIONS
import eu.vespy.weather.ui.ForecastGraphics
import eu.vespy.weather.ui.forecastSummaryText
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

open class WeatherWidgetProvider : AppWidgetProvider() {
    protected open val advisoryFooter = false

    override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
        val result = goAsync()
        CoroutineScope(SupervisorJob() + Dispatchers.IO).launch {
            try {
                val preferences = WeatherPreferences(context)
                val savedLocations = preferences.locations(DEFAULT_LOCATIONS)
                val fallbackLocation = savedLocations.first()
                val widgetLocations = appWidgetIds.associateWith { preferences.widgetLocation(it, fallbackLocation) }
                val temperatureUnit = preferences.temperatureUnit()
                val displaySettings = preferences.displaySettings()
                val localizedContext = context.withSavedAppLocale()
                val language = displaySettings.language.takeUnless { it == "system" }
                    ?: localizedContext.resources.configuration.locales[0].toLanguageTag()
                val forecasts = mutableMapOf<Pair<Double, Double>, eu.vespy.weather.data.WeatherForecast>()
                appWidgetIds.forEach { widgetId ->
                    val location = widgetLocations.getValue(widgetId)
                    val widgetSettings = preferences.widgetDisplaySettings(widgetId, displaySettings)
                    val locationKey = location.latitude to location.longitude
                    val forecast = if (widgetSettings.demo) widgetDemoForecast() else forecasts[locationKey]
                        ?: WeatherApi().forecast(location, language = language).also { forecasts[locationKey] = it }
                    val options = manager.getAppWidgetOptions(widgetId)
                    val density = context.resources.displayMetrics.density.coerceAtMost(2.5f)
                    val forecastHours = preferences.widgetForecastHours(widgetId)
                    val dark = when (widgetSettings.theme) {
                        "dark" -> true
                        "light" -> false
                        else -> context.resources.configuration.uiMode and android.content.res.Configuration.UI_MODE_NIGHT_MASK == android.content.res.Configuration.UI_MODE_NIGHT_YES
                    }
                    val viewsBySize = widgetSizes(context, options).associateWith { size ->
                        val widthDp = size.width.roundToInt().coerceAtLeast(40)
                        val heightDp = size.height.roundToInt().coerceAtLeast(40)
                        val columns = (widthDp / 80).coerceIn(1, 8)
                        val rows = ((heightDp + 13) / 136).coerceIn(1, 8)
                        val rawWidth = (widthDp * density).roundToInt()
                        val rawHeight = (heightDp * density).roundToInt()
                        val bitmapScale = min(1f, min(MAX_BITMAP_SIZE.toFloat() / rawWidth, MAX_BITMAP_SIZE.toFloat() / rawHeight))
                        val bitmap = renderWidget(
                            width = (rawWidth * bitmapScale).roundToInt(),
                            height = (rawHeight * bitmapScale).roundToInt(),
                            points = forecast.hourly.forWidgetForecast(forecastHours, columns),
                            days = forecast.daily,
                            dark = dark,
                            todayLabel = context.getString(R.string.today),
                            density = density * bitmapScale,
                            rows = rows,
                            temperatureUnit = temperatureUnit,
                            temperatureThresholds = displaySettings.temperatureThresholds,
                            locationLabel = location.name.takeIf { !widgetSettings.demo && (displaySettings.showWidgetLocation || widgetSettings.forceLocationName) },
                            widgetSettings = widgetSettings,
                            advisoryText = if (advisoryFooter) {
                                forecast.alerts.firstOrNull()?.let { localizedContext.getString(R.string.widget_alert_prefix, it.headline) }
                                    ?: forecastSummaryText(localizedContext, forecast)
                            } else null,
                            advisoryLabel = localizedContext.getString(R.string.forecast_summary_label),
                            advisoryIsAlert = advisoryFooter && forecast.alerts.isNotEmpty(),
                        )
                        views(context, bitmap, widgetId, location, widgetSettings.demo)
                    }
                    val responsiveViews = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && viewsBySize.size > 1) {
                        RemoteViews(viewsBySize)
                    } else {
                        viewsBySize.values.first()
                    }
                    manager.updateAppWidget(widgetId, responsiveViews)
                }
            } catch (_: Exception) {
                // Keep the last successful widget frame when the network or provider is unavailable.
            } finally {
                result.finish()
            }
        }
    }

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle) {
        onUpdate(context, manager, intArrayOf(appWidgetId))
    }

    override fun onDeleted(context: Context, appWidgetIds: IntArray) {
        val preferences = WeatherPreferences(context)
        appWidgetIds.forEach(preferences::removeWidgetLocation)
    }

    private fun widgetSizes(context: Context, options: Bundle): List<SizeF> {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            val advertisedSizes = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                options.getParcelableArrayList(AppWidgetManager.OPTION_APPWIDGET_SIZES, SizeF::class.java)
            } else {
                @Suppress("DEPRECATION")
                options.getParcelableArrayList<SizeF>(AppWidgetManager.OPTION_APPWIDGET_SIZES)
            }
            advertisedSizes
                ?.filter { it.width >= 40f && it.height >= 40f }
                ?.distinct()
                ?.takeIf { it.isNotEmpty() }
                ?.let { return it }
        }

        val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 80).coerceAtLeast(40)
        val minHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110).coerceAtLeast(40)
        val maxWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH, minWidth).coerceAtLeast(minWidth)
        val maxHeight = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, minHeight).coerceAtLeast(minHeight)
        val landscape = context.resources.configuration.orientation == Configuration.ORIENTATION_LANDSCAPE
        return listOf(SizeF(
            if (landscape) maxWidth.toFloat() else minWidth.toFloat(),
            if (landscape) minHeight.toFloat() else maxHeight.toFloat(),
        ))
    }

    private fun views(
        context: Context,
        bitmap: Bitmap,
        widgetId: Int,
        location: eu.vespy.weather.data.WeatherLocation,
        demo: Boolean,
    ): RemoteViews =
        RemoteViews(context.packageName, R.layout.weather_widget).apply {
            setImageViewBitmap(R.id.widget_image, bitmap)
            val intent = Intent(context, MainActivity::class.java).apply {
                action = "eu.vespy.weather.OPEN_WIDGET_LOCATION"
                data = Uri.Builder()
                    .scheme("vespy-weather")
                    .authority("widget")
                    .appendPath(widgetId.toString())
                    .appendQueryParameter("latitude", location.latitude.toString())
                    .appendQueryParameter("longitude", location.longitude.toString())
                    .appendQueryParameter("demo", demo.toString())
                    .build()
                flags = Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP
                putExtra("widget_location_name", location.name)
                putExtra("widget_location_country", location.country)
                putExtra("widget_location_latitude", location.latitude)
                putExtra("widget_location_longitude", location.longitude)
                putExtra("widget_location_timezone", location.timezone)
                putExtra("widget_demo", demo)
            }
            val pendingIntent = PendingIntent.getActivity(context, widgetId, intent, PendingIntent.FLAG_CANCEL_CURRENT or PendingIntent.FLAG_IMMUTABLE)
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
        locationLabel: String?,
        widgetSettings: eu.vespy.weather.data.WidgetDisplaySettings,
        advisoryText: String?,
        advisoryLabel: String,
        advisoryIsAlert: Boolean,
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
        val footerHeight = if (advisoryText != null) min(124f * density, height * .82f) else 0f
        val chartHeight = height - footerHeight
        val expanded = rows >= 3
        val labelHeight = chartHeight * if (rows == 1) .38f else .24f
        val contentHeight = chartHeight - labelHeight
        val skyHeight = if (expanded) min(68f * density, contentHeight * .36f) else min(56f * density, contentHeight * .3f)
        val windHeight = if (expanded) min(42f * density, contentHeight * .22f) else min(34f * density, contentHeight * .18f)
        val mushroomHeight = if (widgetSettings.showMushrooms && expanded) min(34f * density, contentHeight * .18f) else 0f
        ForecastGraphics.drawTimeline(
            canvas, RectF(0f, 0f, width.toFloat(), chartHeight), points, days, dark, todayLabel, labelHeight, skyHeight, windHeight,
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
            showTemperatureValues = widgetSettings.showHourlyTemperatures,
            showApparentTemperature = widgetSettings.showApparentTemperature,
            showPrecipitation = widgetSettings.showPrecipitation,
            showWindArrows = widgetSettings.showWindArrows,
            showMushrooms = widgetSettings.showMushrooms,
            mushroomHeight = mushroomHeight,
            demoLabel = "DEMO".takeIf { widgetSettings.demo },
            lightningScale = .68f,
        )
        if (locationLabel != null) {
            val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = if (dark) Color.argb(102, 255, 255, 255) else Color.argb(102, 23, 34, 52)
                textAlign = Paint.Align.RIGHT
                textSize = 14f * density
                typeface = android.graphics.Typeface.create("monospace", android.graphics.Typeface.BOLD)
            }
            val maxLabelWidth = width * .62f
            val fittingCharacters = labelPaint.breakText(locationLabel, true, maxLabelWidth, null)
            val displayedLabel = if (fittingCharacters < locationLabel.length) {
                locationLabel.take((fittingCharacters - 1).coerceAtLeast(1)).trimEnd() + "…"
            } else {
                locationLabel
            }
            canvas.drawText(displayedLabel, width - 7f * density, chartHeight - windHeight - mushroomHeight - 7f * density, labelPaint)
        }
        canvas.restore()
        if (advisoryText != null) drawAdvisoryFooter(canvas, width, height, footerHeight, advisoryLabel, advisoryText, advisoryIsAlert, dark, density, rows)
        return bitmap
    }

    private fun drawAdvisoryFooter(
        canvas: Canvas,
        width: Int,
        height: Int,
        footerHeight: Float,
        label: String,
        text: String,
        alert: Boolean,
        dark: Boolean,
        density: Float,
        rows: Int,
    ) {
        val top = height - footerHeight
        val accent = if (alert) Color.rgb(230, 182, 47) else if (dark) Color.rgb(88, 166, 255) else Color.rgb(23, 111, 193)
        canvas.drawRect(0f, top, width.toFloat(), height.toFloat(), Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (dark) Color.rgb(20, 28, 40) else Color.rgb(238, 244, 251)
        })
        canvas.drawRect(0f, top, width.toFloat(), top + max(1f, density), Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accent })
        canvas.drawText(label, 12f * density, top + 16f * density, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = accent
            textSize = 11f * density
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        })
        val prefixWidth = if (alert) 34f * density else 12f * density
        if (alert) canvas.drawText("!", 17f * density, top + footerHeight * .62f, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = accent
            textAlign = Paint.Align.CENTER
            textSize = 28f * density
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        })
        val descriptionTextSize = if (rows >= 3) 30f else 24f
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = if (dark) Color.rgb(231, 237, 247) else Color.rgb(23, 34, 52)
            textSize = descriptionTextSize * density
            typeface = android.graphics.Typeface.DEFAULT_BOLD
        }
        val availableWidth = width - prefixWidth - 10f * density
        val firstLength = paint.breakText(text, true, availableWidth, null).coerceAtLeast(1)
        var firstLine = text.take(firstLength).trimEnd()
        var remainder = text.drop(firstLength).trimStart()
        if (remainder.isNotEmpty() && firstLine.contains(' ')) {
            val split = firstLine.lastIndexOf(' ')
            remainder = (firstLine.drop(split + 1) + " " + remainder).trim()
            firstLine = firstLine.take(split)
        }
        val secondLength = paint.breakText(remainder, true, availableWidth, null).coerceAtLeast(0)
        val secondLine = if (remainder.length > secondLength && secondLength > 1) remainder.take(secondLength - 1).trimEnd() + "…" else remainder
        val x = prefixWidth
        val baseline = top + if (secondLine.isBlank()) footerHeight * .68f else footerHeight * .46f
        canvas.drawText(firstLine, x, baseline, paint)
        if (secondLine.isNotBlank()) {
            val lineSpacing = if (rows >= 3) 37f else 30f
            canvas.drawText(secondLine, x, baseline + lineSpacing * density, paint)
        }
    }

    companion object {
        private const val MAX_BITMAP_SIZE = 1600

        fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            listOf(WeatherWidgetProvider::class.java, WeatherAdvisoryWidgetProvider::class.java).forEach { providerClass ->
                val component = ComponentName(context, providerClass)
                val widgetIds = manager.getAppWidgetIds(component)
                if (widgetIds.isNotEmpty()) context.sendBroadcast(Intent(context, providerClass).apply {
                    action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                    putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, widgetIds)
                })
            }
        }

        fun refresh(context: Context, widgetId: Int) {
            val component = AppWidgetManager.getInstance(context).getAppWidgetInfo(widgetId)?.provider
                ?: ComponentName(context, WeatherWidgetProvider::class.java)
            context.sendBroadcast(Intent().setComponent(component).apply {
                action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
                putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, intArrayOf(widgetId))
            })
        }
    }
}
