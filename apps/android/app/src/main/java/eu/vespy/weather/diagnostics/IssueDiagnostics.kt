package eu.vespy.weather.diagnostics

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.ContextWrapper
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.os.Build
import android.util.Base64
import eu.vespy.weather.BuildConfig
import eu.vespy.weather.data.ForecastDisplaySettings
import eu.vespy.weather.data.WeatherPreferences
import eu.vespy.weather.data.WeatherLocation
import eu.vespy.weather.data.WidgetDisplaySettings
import eu.vespy.weather.ui.DEFAULT_LOCATIONS
import eu.vespy.weather.widget.WeatherAdvisoryWidgetProvider
import eu.vespy.weather.widget.WeatherStripWidgetProvider
import eu.vespy.weather.widget.WeatherWidgetProvider
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.File
import java.util.Locale
import kotlin.math.max
import kotlin.math.roundToInt

object IssueDiagnostics {
    private const val MAX_APP_IMAGE_DIMENSION = 1600
    private const val MAX_WIDGET_IMAGE_DIMENSION = 1200

    fun captureAppWindow(context: Context): Bitmap? {
        var current = context
        while (current is ContextWrapper && current !is Activity) current = current.baseContext
        val activity = current as? Activity ?: return null
        val view = activity.window.decorView
        if (view.width <= 0 || view.height <= 0) return null
        return runCatching {
            Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888).also { bitmap ->
                view.draw(Canvas(bitmap))
            }
        }.getOrNull()
    }

    fun buildReport(
        context: Context,
        description: String,
        includeVisualsAndLocations: Boolean,
        appScreenshot: Bitmap?,
        sourceWidgetId: Int? = null,
        sourceWidgetSettings: WidgetDisplaySettings? = null,
        sourceForecastHours: Int? = null,
        sourceLocation: WeatherLocation? = null,
    ): JSONObject {
        val preferences = WeatherPreferences(context)
        val displaySettings = preferences.displaySettings()
        val metrics = context.resources.displayMetrics
        val configuration = context.resources.configuration
        val manager = AppWidgetManager.getInstance(context)
        val widgets = JSONArray()
        val attachments = JSONArray()
        val providers = listOf(
            "timeline" to WeatherWidgetProvider::class.java,
            "advisory" to WeatherAdvisoryWidgetProvider::class.java,
            "strip" to WeatherStripWidgetProvider::class.java,
        )
        val fallbackLocation = preferences.locations(DEFAULT_LOCATIONS).first()

        providers.forEach { (type, providerClass) ->
            manager.getAppWidgetIds(ComponentName(context, providerClass)).forEach { widgetId ->
                val widgetSettings = sourceWidgetSettings.takeIf { widgetId == sourceWidgetId }
                    ?: preferences.widgetDisplaySettings(widgetId, displaySettings)
                val options = manager.getAppWidgetOptions(widgetId)
                val widget = JSONObject()
                    .put("id", widgetId)
                    .put("type", type)
                    .put("source", widgetId == sourceWidgetId)
                    .put("forecastHours", sourceForecastHours.takeIf { widgetId == sourceWidgetId }
                        ?: preferences.widgetForecastHours(widgetId))
                    .put("size", JSONObject()
                        .put("minimumWidthDp", options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH))
                        .put("minimumHeightDp", options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT))
                        .put("maximumWidthDp", options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_WIDTH))
                        .put("maximumHeightDp", options.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT)))
                    .put("settings", widgetSettings.toJson())
                WidgetFrameCache.manifest(context, widgetId)?.let { widget.put("lastRender", it) }
                if (includeVisualsAndLocations) {
                    val location = sourceLocation.takeIf { widgetId == sourceWidgetId }
                        ?: preferences.widgetLocation(widgetId, fallbackLocation)
                    widget.put("location", JSONObject().put("name", location.name).put("country", location.country).put("timezone", location.timezone))
                    val attachmentName = "widget-$widgetId.jpg"
                    val frameAttached = WidgetFrameCache.frameFile(context, widgetId).takeIf(File::isFile)?.let { file ->
                        BitmapFactory.decodeFile(file.path)?.let { bitmap ->
                            attachments.put(bitmap.toAttachment(attachmentName, MAX_WIDGET_IMAGE_DIMENSION, 80))
                            bitmap.recycle()
                            true
                        }
                    } ?: false
                    widget.put("frameAttachment", attachmentName.takeIf { frameAttached } ?: JSONObject.NULL)
                }
                widgets.put(widget)
            }
        }

        if (includeVisualsAndLocations && appScreenshot != null) {
            attachments.put(appScreenshot.toAttachment("app-forecast.jpg", MAX_APP_IMAGE_DIMENSION, 86))
        }

        val activeLocation = preferences.activeLocation(fallbackLocation)
        return JSONObject()
            .put("schemaVersion", 1)
            .put("description", description.trim())
            .put("submittedAt", java.time.Instant.now().toString())
            .put("app", JSONObject()
                .put("packageName", context.packageName)
                .put("versionName", BuildConfig.VERSION_NAME)
                .put("versionCode", BuildConfig.VERSION_CODE)
                .put("language", Locale.getDefault().toLanguageTag())
                .apply {
                    if (includeVisualsAndLocations) {
                        put("temperatureUnit", preferences.temperatureUnit())
                        put("settings", displaySettings.toJson())
                    }
                })
            .put("device", if (includeVisualsAndLocations) JSONObject()
                .put("manufacturer", Build.MANUFACTURER)
                .put("brand", Build.BRAND)
                .put("model", Build.MODEL)
                .put("device", Build.DEVICE)
                .put("androidRelease", Build.VERSION.RELEASE)
                .put("apiLevel", Build.VERSION.SDK_INT)
                .put("screenWidthPx", metrics.widthPixels)
                .put("screenHeightPx", metrics.heightPixels)
                .put("density", metrics.density)
                .put("densityDpi", metrics.densityDpi)
                .put("fontScale", configuration.fontScale)
                .put("orientation", configuration.orientation) else JSONObject.NULL)
            .put("activeLocation", if (includeVisualsAndLocations) {
                JSONObject().put("name", activeLocation.name).put("country", activeLocation.country).put("timezone", activeLocation.timezone)
            } else JSONObject.NULL)
            .put("widgets", if (includeVisualsAndLocations) widgets else JSONArray())
            .put("attachments", attachments)
    }

    private fun ForecastDisplaySettings.toJson() = JSONObject()
        .put("zoom", zoom)
        .put("theme", theme)
        .put("language", language)
        .put("temperatureTextScale", temperatureTextScale)
        .put("showHourlyTemperatures", showHourlyTemperatures)
        .put("showApparentTemperature", showApparentTemperature)
        .put("showPrecipitation", showPrecipitation)
        .put("showWind", showWind)
        .put("showWindArrows", showWindArrows)
        .put("showUvIndex", showUvIndex)
        .put("showHumidity", showHumidity)
        .put("showPressure", showPressure)
        .put("showPollen", showPollen)
        .put("showHistoricalData", showHistoricalData)
        .put("showDates", showDates)
        .put("showMushrooms", showMushrooms)
        .put("showWidgetLocation", showWidgetLocation)
        .put("temperatureThresholds", JSONObject()
            .put("deepFrost", temperatureThresholds.deepFrost)
            .put("mild", temperatureThresholds.mild)
            .put("warm", temperatureThresholds.warm)
            .put("hot", temperatureThresholds.hot))

    private fun WidgetDisplaySettings.toJson() = JSONObject()
        .put("theme", theme)
        .put("forceLocationName", forceLocationName)
        .put("temperatureTextScale", temperatureTextScale)
        .put("showHourlyTemperatures", showHourlyTemperatures)
        .put("showApparentTemperature", showApparentTemperature)
        .put("showPrecipitation", showPrecipitation)
        .put("showWindArrows", showWindArrows)
        .put("showMushrooms", showMushrooms)
        .put("demo", demo)

    private fun Bitmap.toAttachment(name: String, maximumDimension: Int, quality: Int): JSONObject {
        val longestSide = max(width, height)
        val outputBitmap = if (longestSide > maximumDimension) {
            val scale = maximumDimension.toFloat() / longestSide
            Bitmap.createScaledBitmap(this, (width * scale).roundToInt(), (height * scale).roundToInt(), true)
        } else this
        val bytes = ByteArrayOutputStream().use { stream ->
            outputBitmap.compress(Bitmap.CompressFormat.JPEG, quality, stream)
            stream.toByteArray()
        }
        if (outputBitmap !== this) outputBitmap.recycle()
        return bytes.toAttachment(name, "image/jpeg")
    }

    private fun ByteArray.toAttachment(name: String, contentType: String) = JSONObject()
        .put("name", name)
        .put("contentType", contentType)
        .put("base64", Base64.encodeToString(this, Base64.NO_WRAP))
}

object WidgetFrameCache {
    private fun directory(context: Context) = File(context.cacheDir, "issue-report-widgets")

    fun store(context: Context, widgetId: Int, bitmap: Bitmap, manifest: JSONObject) {
        runCatching {
            val directory = directory(context).apply { mkdirs() }
            File(directory, "widget-$widgetId.png").outputStream().use { stream ->
                bitmap.compress(Bitmap.CompressFormat.PNG, 100, stream)
            }
            File(directory, "widget-$widgetId.json").writeText(manifest.toString())
        }
    }

    fun remove(context: Context, widgetId: Int) {
        runCatching {
            frameFile(context, widgetId).delete()
            manifestFile(context, widgetId).delete()
        }
    }

    fun frameFile(context: Context, widgetId: Int) = File(directory(context), "widget-$widgetId.png")
    private fun manifestFile(context: Context, widgetId: Int) = File(directory(context), "widget-$widgetId.json")
    fun manifest(context: Context, widgetId: Int): JSONObject? = runCatching {
        manifestFile(context, widgetId).takeIf(File::isFile)?.readText()?.let(::JSONObject)
    }.getOrNull()
}
