package eu.vespy.weather.ui

import android.graphics.BlurMaskFilter
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RectF
import android.graphics.Shader
import android.graphics.Typeface
import eu.vespy.weather.data.DailyWeather
import eu.vespy.weather.data.HourlyWeather
import eu.vespy.weather.data.TemperatureThresholds
import java.time.LocalDate
import java.time.LocalDateTime
import java.time.format.TextStyle
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.sin
import kotlin.math.sqrt

data class ForecastPalette(
    val background: Int,
    val day: Int,
    val night: Int,
    val grid: Int,
    val separator: Int,
    val text: Int,
    val muted: Int,
    val cloud: Int,
    val moon: Int,
    val moonCutout: Int,
    val rain: Int,
    val snow: Int,
    val wind: Int,
)

object ForecastGraphics {
    fun palette(dark: Boolean) = if (dark) ForecastPalette(
        background = Color.rgb(13, 17, 24),
        day = Color.rgb(22, 36, 52),
        night = Color.rgb(2, 5, 9),
        grid = Color.argb(45, 154, 164, 178),
        separator = Color.argb(210, 180, 193, 208),
        text = Color.rgb(231, 237, 247),
        muted = Color.rgb(141, 152, 170),
        cloud = Color.rgb(190, 199, 211),
        moon = Color.rgb(219, 232, 255),
        moonCutout = Color.rgb(2, 5, 9),
        rain = Color.rgb(88, 166, 255),
        snow = Color.rgb(217, 241, 255),
        wind = Color.rgb(155, 199, 215),
    ) else ForecastPalette(
        background = Color.rgb(247, 250, 255),
        day = Color.rgb(222, 235, 249),
        night = Color.rgb(207, 218, 232),
        grid = Color.argb(50, 74, 91, 113),
        separator = Color.argb(210, 75, 94, 119),
        text = Color.rgb(23, 34, 52),
        muted = Color.rgb(91, 107, 128),
        cloud = Color.rgb(91, 107, 128),
        moon = Color.rgb(80, 100, 127),
        moonCutout = Color.rgb(207, 218, 232),
        rain = Color.rgb(25, 118, 189),
        snow = Color.rgb(40, 121, 174),
        wind = Color.rgb(66, 116, 139),
    )

    fun drawLegend(
        canvas: Canvas,
        bounds: RectF,
        dark: Boolean,
        labelHeight: Float,
        skyHeight: Float,
        windHeight: Float,
        mushroomHeight: Float = 0f,
        pixelScale: Float,
    ) {
        val palette = palette(dark)
        val skyBottom = bounds.top + labelHeight + skyHeight
        val temperatureBottom = bounds.bottom - windHeight - mushroomHeight
        val windBottom = bounds.bottom - mushroomHeight
        val centerX = bounds.centerX()
        canvas.drawRect(bounds, Paint().apply { color = palette.background })

        val separator = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.separator
            strokeWidth = 1.25f * pixelScale
        }
        canvas.drawLine(bounds.right - pixelScale, bounds.top, bounds.right - pixelScale, bounds.bottom, separator)
        canvas.drawLine(bounds.left, skyBottom, bounds.right, skyBottom, separator)
        canvas.drawLine(bounds.left, temperatureBottom, bounds.right, temperatureBottom, separator)
        if (mushroomHeight > 0f) canvas.drawLine(bounds.left, windBottom, bounds.right, windBottom, separator)

        val skySectionHeight = skyBottom - bounds.top
        val iconStroke = 1.6f * pixelScale
        val sunRadius = min(bounds.width() * .12f, skySectionHeight * .055f)
        val sunY = bounds.top + skySectionHeight * .18f
        val sunPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(255, 211, 61)
            style = Paint.Style.STROKE
            strokeWidth = iconStroke
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawCircle(centerX, sunY, sunRadius, sunPaint)
        repeat(8) { ray ->
            val angle = ray * PI.toFloat() / 4f
            val inner = sunRadius * 1.55f
            val outer = sunRadius * 2.15f
            canvas.drawLine(centerX + cos(angle) * inner, sunY + sin(angle) * inner, centerX + cos(angle) * outer, sunY + sin(angle) * outer, sunPaint)
        }

        val cloudY = bounds.top + skySectionHeight * .45f
        val cloudWidth = bounds.width() * .52f
        val cloudPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.cloud
            style = Paint.Style.STROKE
            strokeWidth = iconStroke
            strokeCap = Paint.Cap.ROUND
            strokeJoin = Paint.Join.ROUND
        }
        val cloudPath = Path().apply {
            moveTo(centerX - cloudWidth * .42f, cloudY + cloudWidth * .12f)
            cubicTo(centerX - cloudWidth * .62f, cloudY - cloudWidth * .12f, centerX - cloudWidth * .35f, cloudY - cloudWidth * .3f, centerX - cloudWidth * .18f, cloudY - cloudWidth * .2f)
            cubicTo(centerX - cloudWidth * .03f, cloudY - cloudWidth * .5f, centerX + cloudWidth * .36f, cloudY - cloudWidth * .42f, centerX + cloudWidth * .38f, cloudY - cloudWidth * .12f)
            cubicTo(centerX + cloudWidth * .65f, cloudY - cloudWidth * .08f, centerX + cloudWidth * .58f, cloudY + cloudWidth * .2f, centerX + cloudWidth * .38f, cloudY + cloudWidth * .2f)
            lineTo(centerX - cloudWidth * .42f, cloudY + cloudWidth * .2f)
        }
        canvas.drawPath(cloudPath, cloudPaint)
        drawDrop(canvas, centerX, bounds.top + skySectionHeight * .76f, min(bounds.width() * .22f, skySectionHeight * .11f), 1f, palette)

        val temperatureTop = skyBottom
        val temperatureHeight = temperatureBottom - temperatureTop
        val thermometerHeight = min(temperatureHeight * .62f, bounds.width() * 1.5f)
        val thermometerTop = temperatureTop + (temperatureHeight - thermometerHeight) / 2f
        val bulbRadius = min(bounds.width() * .15f, thermometerHeight * .15f)
        val bulbCenterY = thermometerTop + thermometerHeight - bulbRadius
        val tubeBottom = bulbCenterY - bulbRadius * .79f
        val scalePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = LinearGradient(
                centerX, tubeBottom, centerX, thermometerTop,
                intArrayOf(Color.WHITE, Color.rgb(127, 137, 150), Color.rgb(35, 88, 199), Color.rgb(69, 207, 136), Color.rgb(242, 142, 62), Color.rgb(255, 38, 63)),
                null,
                Shader.TileMode.CLAMP,
            )
            strokeWidth = max(3f * pixelScale, bulbRadius * .65f)
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawLine(centerX, tubeBottom, centerX, thermometerTop + bulbRadius * .25f, scalePaint)
        canvas.drawCircle(centerX, bulbCenterY, bulbRadius * .68f, scalePaint)
        val thermometerOutline = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.text
            style = Paint.Style.STROKE
            strokeWidth = 1.7f * pixelScale
            strokeCap = Paint.Cap.ROUND
        }
        canvas.drawLine(centerX - bulbRadius * .62f, thermometerTop + bulbRadius * .28f, centerX - bulbRadius * .62f, tubeBottom, thermometerOutline)
        canvas.drawLine(centerX + bulbRadius * .62f, thermometerTop + bulbRadius * .28f, centerX + bulbRadius * .62f, tubeBottom, thermometerOutline)
        canvas.drawArc(RectF(centerX - bulbRadius * .62f, thermometerTop, centerX + bulbRadius * .62f, thermometerTop + bulbRadius * .56f), 180f, 180f, false, thermometerOutline)
        canvas.drawCircle(centerX, bulbCenterY, bulbRadius, thermometerOutline)

        val windCenterY = temperatureBottom + windHeight / 2f
        val windPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.wind
            style = Paint.Style.STROKE
            strokeWidth = 1.7f * pixelScale
            strokeCap = Paint.Cap.ROUND
        }
        val iconScale = min(bounds.width() / 40f, windHeight / 38f) * .9f
        val iconLeft = centerX - 20f * iconScale
        val iconTop = windCenterY - 19f * iconScale
        canvas.drawPath(Path().apply {
            moveTo(iconLeft + 3f * iconScale, iconTop + 11f * iconScale)
            lineTo(iconLeft + 25f * iconScale, iconTop + 11f * iconScale)
            cubicTo(iconLeft + 32f * iconScale, iconTop + 11f * iconScale, iconLeft + 32f * iconScale, iconTop + 3f * iconScale, iconLeft + 27f * iconScale, iconTop + 3f * iconScale)
            cubicTo(iconLeft + 24f * iconScale, iconTop + 3f * iconScale, iconLeft + 23f * iconScale, iconTop + 5f * iconScale, iconLeft + 23f * iconScale, iconTop + 7f * iconScale)
        }, windPaint)
        canvas.drawPath(Path().apply {
            moveTo(iconLeft + 3f * iconScale, iconTop + 18f * iconScale)
            lineTo(iconLeft + 33f * iconScale, iconTop + 18f * iconScale)
            cubicTo(iconLeft + 40f * iconScale, iconTop + 18f * iconScale, iconLeft + 40f * iconScale, iconTop + 9f * iconScale, iconLeft + 35f * iconScale, iconTop + 9f * iconScale)
            cubicTo(iconLeft + 32f * iconScale, iconTop + 9f * iconScale, iconLeft + 30f * iconScale, iconTop + 11f * iconScale, iconLeft + 30f * iconScale, iconTop + 13f * iconScale)
        }, windPaint)
        canvas.drawPath(Path().apply {
            moveTo(iconLeft + 3f * iconScale, iconTop + 25f * iconScale)
            lineTo(iconLeft + 23f * iconScale, iconTop + 25f * iconScale)
            cubicTo(iconLeft + 30f * iconScale, iconTop + 25f * iconScale, iconLeft + 30f * iconScale, iconTop + 35f * iconScale, iconLeft + 24f * iconScale, iconTop + 35f * iconScale)
            cubicTo(iconLeft + 20f * iconScale, iconTop + 35f * iconScale, iconLeft + 19f * iconScale, iconTop + 32f * iconScale, iconLeft + 19f * iconScale, iconTop + 30f * iconScale)
        }, windPaint)
    }

    fun drawTimeline(
        canvas: Canvas,
        bounds: RectF,
        points: List<HourlyWeather>,
        days: List<DailyWeather>,
        dark: Boolean,
        todayLabel: String,
        labelHeight: Float,
        skyHeight: Float,
        windHeight: Float,
        mushroomHeight: Float = 0f,
        temperatureUnit: String = "C",
        pixelScale: Float = 1f,
        textScale: Float = 1f,
        showHours: Boolean = true,
        temperatureStep: Int = 1,
        precipitationScale: Float = 1f,
        showWeekdayNames: Boolean = false,
        fullWeekdayNames: Boolean = false,
        dayLabelTextSize: Float? = null,
        hourTextSize: Float? = null,
        temperatureTextSize: Float? = null,
        windScale: Float = 1f,
        showTemperatureValues: Boolean = true,
        showApparentTemperature: Boolean = true,
        showPrecipitation: Boolean = true,
        showWind: Boolean = true,
        showWindArrows: Boolean = false,
        temperatureThresholds: TemperatureThresholds = TemperatureThresholds(),
        currentTimestamp: String? = null,
        showDates: Boolean = false,
        showHistory: Boolean = false,
        historyLabel: String = "",
        showMushrooms: Boolean = false,
        temperatureMinimum: Double? = null,
        temperatureMaximum: Double? = null,
        demoLabel: String? = null,
        demoEveryDay: Boolean = false,
        pointOffset: Int = 0,
        lightningScale: Float = 1f,
    ) {
        if (points.isEmpty() || bounds.width() <= 0f || bounds.height() <= 0f) return
        val palette = palette(dark)
        val sky = RectF(bounds.left, bounds.top, bounds.right, bounds.top + labelHeight + skyHeight)
        val temperature = RectF(sky.left, sky.bottom, sky.right, bounds.bottom - windHeight - mushroomHeight)
        val wind = RectF(bounds.left, temperature.bottom, bounds.right, bounds.bottom - mushroomHeight)
        val mushrooms = RectF(bounds.left, wind.bottom, bounds.right, bounds.bottom)
        canvas.drawRect(bounds, Paint().apply { color = palette.background })
        drawSky(
            canvas, sky, points, days, palette, todayLabel, labelHeight, temperatureUnit,
            pixelScale, textScale, showHours, temperatureStep.coerceAtLeast(1), precipitationScale,
            showWeekdayNames, fullWeekdayNames, dayLabelTextSize, hourTextSize, temperatureTextSize,
            showTemperatureValues, showPrecipitation, temperatureThresholds, currentTimestamp, showDates,
        )
        drawTemperature(canvas, temperature, points, palette, pixelScale, showApparentTemperature, temperatureThresholds, temperatureMinimum, temperatureMaximum, lightningScale)
        if (demoLabel != null) drawDemoWatermarks(canvas, temperature, points, demoLabel, demoEveryDay, pixelScale, palette)
        if (showWind) {
            drawWind(canvas, wind, points, palette, pixelScale, windScale, pointOffset)
            if (showWindArrows) drawWindAnnotations(canvas, wind, points, palette, pixelScale)
        }
        if (showMushrooms && mushroomHeight > 0f) drawMushrooms(canvas, mushrooms, points, days, palette, pixelScale)
        if (showHistory && currentTimestamp != null) {
            drawHistoryOverlay(canvas, bounds, points, currentTimestamp, historyLabel, pixelScale)
        }
        drawDaySeparators(canvas, bounds, points, palette, pixelScale)
        val border = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.grid; strokeWidth = pixelScale; style = Paint.Style.STROKE }
        canvas.drawLine(bounds.left, sky.bottom, bounds.right, sky.bottom, border)
        canvas.drawLine(bounds.left, temperature.bottom, bounds.right, temperature.bottom, border)
        if (showMushrooms && mushroomHeight > 0f) canvas.drawLine(bounds.left, wind.bottom, bounds.right, wind.bottom, border)
        canvas.drawLine(bounds.left, bounds.bottom - 1f, bounds.right, bounds.bottom - 1f, border)
    }

    private fun drawMushrooms(
        canvas: Canvas,
        bounds: RectF,
        points: List<HourlyWeather>,
        days: List<DailyWeather>,
        palette: ForecastPalette,
        pixelScale: Float,
    ) {
        if (points.isEmpty() || bounds.height() <= 0f) return
        val conditions = days.associateBy(DailyWeather::date)
        val cell = bounds.width() / points.size
        points.forEachIndexed { index, point ->
            val score = conditions[point.timestamp.take(10)]?.mushroom?.score
            val color = if (score == null) palette.background else Color.HSVToColor(
                if (Color.luminance(palette.background) < .5f) 210 else 238,
                floatArrayOf(18f + score.coerceIn(0, 100) / 100f * 82f, .4f, if (Color.luminance(palette.background) < .5f) .28f else .78f),
            )
            val left = bounds.left + index * cell
            canvas.drawRect(left, bounds.top, left + cell, bounds.bottom, Paint().apply { this.color = color })
            if (index == 0 || point.timestamp.take(10) != points[index - 1].timestamp.take(10)) {
                val icon = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    this.color = if (Color.luminance(color) < .5f) Color.WHITE else Color.rgb(53, 45, 31)
                    textSize = 9f * pixelScale
                    typeface = Typeface.create("monospace", Typeface.BOLD)
                }
                val iconX = left + 10f * pixelScale
                val iconY = bounds.centerY()
                canvas.drawArc(RectF(iconX - 6f * pixelScale, iconY - 7f * pixelScale, iconX + 6f * pixelScale, iconY + 3f * pixelScale), 180f, 180f, true, icon)
                canvas.drawRoundRect(RectF(iconX - 2f * pixelScale, iconY, iconX + 2f * pixelScale, iconY + 7f * pixelScale), pixelScale, pixelScale, icon)
                canvas.drawText("${score ?: "-"}/100", iconX + 9f * pixelScale, iconY - (icon.ascent() + icon.descent()) / 2f, icon)
            }
        }
    }

    private fun drawSky(
        canvas: Canvas,
        bounds: RectF,
        points: List<HourlyWeather>,
        days: List<DailyWeather>,
        palette: ForecastPalette,
        todayLabel: String,
        labelHeight: Float,
        temperatureUnit: String,
        pixelScale: Float,
        textScale: Float,
        showHours: Boolean,
        temperatureStep: Int,
        precipitationScale: Float,
        showWeekdayNames: Boolean,
        fullWeekdayNames: Boolean,
        dayLabelTextSize: Float?,
        hourTextSize: Float?,
        temperatureTextSize: Float?,
        showTemperatureValues: Boolean,
        showPrecipitation: Boolean,
        temperatureThresholds: TemperatureThresholds,
        currentTimestamp: String?,
        showDates: Boolean,
    ) {
        val cell = bounds.width() / points.size
        val daylightByDate = days.associateBy({ it.date }, { day ->
            Pair(parseDateTime(day.sunrise), parseDateTime(day.sunset))
        })
        val daylight = points.map { point ->
            val time = parseDateTime(point.timestamp)
            val sun = daylightByDate[point.timestamp.take(10)]
            if (time != null && sun?.first != null && sun.second != null) time >= sun.first && time < sun.second
            else (time?.hour ?: 12) in 7..18
        }
        val fill = Paint()
        val grid = Paint().apply { color = palette.grid; strokeWidth = pixelScale * .6f }
        points.forEachIndexed { index, _ ->
            val left = bounds.left + index * cell
            fill.color = if (daylight[index]) palette.day else palette.night
            canvas.drawRect(left, bounds.top, left + cell, bounds.bottom, fill)
            canvas.drawLine(left + cell, bounds.top, left + cell, bounds.bottom, grid)
        }

        drawHeader(
            canvas, bounds, points, palette, todayLabel, labelHeight, cell, temperatureUnit,
            textScale, showHours, temperatureStep, pixelScale, showWeekdayNames, fullWeekdayNames,
            dayLabelTextSize, hourTextSize, temperatureTextSize, showTemperatureValues, temperatureThresholds,
            currentTimestamp, showDates,
        )
        val weatherLine = bounds.top + labelHeight
        val weatherDepth = (bounds.height() - labelHeight) * .58f
        val smoothedClouds = smooth(points.map { (it.cloudCover ?: 0.0).toFloat().coerceIn(0f, 100f) })
        val sunValues = smoothedClouds.mapIndexed { index, cloud ->
            if (!daylight[index]) 0f else (100f - cloud) * sunlightEdge(points[index], daylightByDate)
        }
        drawWeatherArea(canvas, bounds, sunValues, weatherLine, weatherDepth, true, palette)

        var nightStart: Int? = null
        (daylight + true).forEachIndexed { index, isDay ->
            if (!isDay && nightStart == null) nightStart = index
            if (!isDay || nightStart == null) {
                return@forEachIndexed
            }
                val centerX = bounds.left + ((nightStart + index) / 2f) * cell
            val centerY = weatherLine + (bounds.bottom - weatherLine) * .33f
            val radius = min(cell * .23f, (bounds.bottom - weatherLine) * .18f).coerceAtLeast(5f * pixelScale)
            val moon = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = palette.moon
                maskFilter = BlurMaskFilter(radius * .45f, BlurMaskFilter.Blur.NORMAL)
            }
            canvas.drawCircle(centerX, centerY, radius, moon)
            moon.maskFilter = null
            moon.color = palette.moonCutout
            canvas.drawCircle(centerX + radius * .42f, centerY - radius * .42f, radius, moon)
            nightStart = null
        }

        drawWeatherArea(canvas, bounds, smoothedClouds, weatherLine, weatherDepth, false, palette)
        val precipitationY = bounds.bottom - max(9f, (bounds.bottom - weatherLine) * .18f)
        if (showPrecipitation) points.forEachIndexed { index, point ->
            val probability = (point.precipitationProbability ?: 0.0).toFloat().coerceIn(0f, 100f)
            if (probability <= 0f) return@forEachIndexed
            val amount = max(0.0, point.precipitation ?: 0.0).toFloat()
            val x = bounds.left + (index + .5f) * cell
            val alpha = (.22f + probability / 100f * .78f).coerceIn(0f, 1f)
            when (point.weatherCode) {
                71, 73, 75, 77, 85, 86 -> drawSnow(canvas, x, precipitationY, (4.5f * pixelScale + sqrt(max(0.0, point.snowfall ?: 0.0)).toFloat() * 1.2f * pixelScale) * precipitationScale, alpha, palette, pixelScale)
                96, 99 -> drawHail(canvas, x, precipitationY, (4f * pixelScale + sqrt(amount) * .55f * pixelScale) * precipitationScale, alpha, palette, pixelScale)
                else -> drawDrop(canvas, x, precipitationY, (5.5f * pixelScale + min(5.5f * pixelScale, sqrt(amount) * 2.4f * pixelScale)) * precipitationScale, alpha, palette)
            }
        }
    }

    private fun drawHeader(
        canvas: Canvas,
        bounds: RectF,
        points: List<HourlyWeather>,
        palette: ForecastPalette,
        todayLabel: String,
        height: Float,
        cell: Float,
        unit: String,
        textScale: Float,
        showHours: Boolean,
        temperatureStep: Int,
        pixelScale: Float,
        showWeekdayNames: Boolean,
        fullWeekdayNames: Boolean,
        dayLabelTextSize: Float?,
        hourTextSize: Float?,
        temperatureTextSize: Float?,
        showTemperatureValues: Boolean,
        temperatureThresholds: TemperatureThresholds,
        currentTimestamp: String?,
        showDates: Boolean,
    ) {
        val mono = Typeface.create("monospace", Typeface.BOLD)
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { typeface = mono; textAlign = Paint.Align.CENTER }
        val today = parseDateTime(currentTimestamp)?.toLocalDate() ?: LocalDate.now()
        points.forEachIndexed { index, point ->
            val dateTime = parseDateTime(point.timestamp)
            val newDay = index == 0 || point.timestamp.take(10) != points[index - 1].timestamp.take(10)
            if (newDay) {
                paint.color = palette.text
                paint.textAlign = Paint.Align.LEFT
                paint.textSize = dayLabelTextSize ?: height * .17f * textScale
                val dayName = if (dateTime?.toLocalDate() == today) todayLabel.uppercase() else dateTime?.let {
                    if (showWeekdayNames) it.dayOfWeek.getDisplayName(if (fullWeekdayNames) TextStyle.FULL else TextStyle.SHORT, Locale.getDefault()).uppercase()
                    else "%02d/%02d".format(it.dayOfMonth, it.monthValue)
                }.orEmpty()
                val dateLabel = if (showDates && dateTime != null && dateTime.toLocalDate() != today) {
                    " " + dateTime.format(DateTimeFormatter.ofPattern("d MMM", Locale.getDefault()))
                } else ""
                val label = dayName + dateLabel
                val labelBaseline = bounds.top + max(2f * pixelScale, height * .01f) - paint.fontMetrics.top
                val nextDayIndex = ((index + 1) until points.size).firstOrNull { points[it].timestamp.take(10) != point.timestamp.take(10) } ?: points.size
                canvas.save()
                canvas.clipRect(bounds.left + index * cell, bounds.top, bounds.left + nextDayIndex * cell, bounds.top + paint.textSize + 4f * pixelScale)
                canvas.drawText(label, bounds.left + index * cell + 6f * pixelScale, labelBaseline, paint)
                canvas.restore()
            }
            paint.textAlign = Paint.Align.CENTER
            if (showHours) {
                paint.color = palette.muted
                paint.textSize = hourTextSize ?: height * .2f * textScale
                canvas.drawText(dateTime?.let { "%02d".format(it.hour) } ?: "--", bounds.left + (index + .5f) * cell, bounds.top + height * .55f, paint)
            }
            if (showTemperatureValues && index % temperatureStep == 0) {
                paint.color = temperatureColor(point.temperature, temperatureThresholds)
                val desiredSize = if (showHours) height * .24f * textScale else height * .28f * textScale
                paint.textSize = temperatureTextSize ?: desiredSize
                val temperature = shortTemperature(point.temperature, unit)
                val center = bounds.left + (index + .72f) * cell
                val halfWidth = paint.measureText(temperature) / 2f
                val textX = center.coerceIn(bounds.left + halfWidth + 3f * pixelScale, bounds.right - halfWidth - 3f * pixelScale)
                val temperatureBaseline = if (showHours) {
                    bounds.top + height * .91f
                } else {
                    bounds.top + height - max(3f * pixelScale, height * .08f)
                }
                canvas.drawText(temperature, textX, temperatureBaseline, paint)
            }
        }
    }

    private fun drawWeatherArea(canvas: Canvas, bounds: RectF, values: List<Float>, top: Float, depth: Float, sunlight: Boolean, palette: ForecastPalette) {
        if (values.isEmpty()) return
        val cell = bounds.width() / values.size
        val path = smoothAreaPath(bounds.left, top, cell, values.map { top + sqrt(it / 100f) * depth })
        val paint = Paint(Paint.ANTI_ALIAS_FLAG)
        if (sunlight) {
            paint.shader = LinearGradient(0f, top, 0f, top + depth * 1.5f, intArrayOf(Color.argb(225, 255, 216, 55), Color.argb(105, 255, 196, 32), Color.TRANSPARENT), null, Shader.TileMode.CLAMP)
            paint.maskFilter = BlurMaskFilter(5f, BlurMaskFilter.Blur.NORMAL)
        } else {
            val alpha = (55 + (values.average() / 100.0 * 125)).toInt()
            paint.color = Color.argb(alpha, Color.red(palette.cloud), Color.green(palette.cloud), Color.blue(palette.cloud))
        }
        canvas.drawPath(path, paint)
    }

    private fun smoothAreaPath(left: Float, top: Float, cell: Float, ys: List<Float>): Path = Path().apply {
        moveTo(left, top)
        lineTo(left, ys.first())
        ys.forEachIndexed { index, y ->
            if (index == 0) return@forEachIndexed
            val previousX = left + (index - .5f) * cell
            val x = left + (index + .5f) * cell
            quadTo(previousX, ys[index - 1], (previousX + x) / 2f, (ys[index - 1] + y) / 2f)
        }
        lineTo(left + ys.size * cell, ys.last())
        lineTo(left + ys.size * cell, top)
        close()
    }

    private fun drawTemperature(canvas: Canvas, bounds: RectF, points: List<HourlyWeather>, palette: ForecastPalette, pixelScale: Float, showApparentTemperature: Boolean, temperatureThresholds: TemperatureThresholds, fixedMinimum: Double?, fixedMaximum: Double?, lightningScale: Float) {
        val values = points.flatMap { point ->
            if (showApparentTemperature) listOfNotNull(point.temperature, point.apparentTemperature) else listOfNotNull(point.temperature)
        }
        if (points.size < 2 || values.isEmpty()) return
        val minimum = fixedMinimum ?: values.min() - 3.0
        val maximum = fixedMaximum ?: values.max() + 3.0
        val span = max(1.0, maximum - minimum)
        val cell = bounds.width() / points.size
        fun x(index: Int) = bounds.left + (index + .5f) * cell
        fun y(value: Double) = bounds.top + bounds.height() * .1f + ((maximum - value) / span).toFloat() * bounds.height() * .8f

        val grid = Paint().apply { color = palette.grid; strokeWidth = pixelScale * .6f }
        repeat(3) { row ->
            val lineY = bounds.top + bounds.height() * (row + 1) / 4f
            canvas.drawLine(bounds.left, lineY, bounds.right, lineY, grid)
        }
        if (minimum <= 0 && maximum >= 0) {
            val zero = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.argb(140, 86, 215, 229); strokeWidth = pixelScale; pathEffect = android.graphics.DashPathEffect(floatArrayOf(4f * pixelScale, 4f * pixelScale), 0f) }
            canvas.drawLine(bounds.left, y(0.0), bounds.right, y(0.0), zero)
        }

        if (showApparentTemperature) points.zipWithNext().forEachIndexed { index, pair ->
            val actualStart = pair.first.temperature ?: return@forEachIndexed
            val actualEnd = pair.second.temperature ?: return@forEachIndexed
            val apparentStart = pair.first.apparentTemperature ?: actualStart
            val apparentEnd = pair.second.apparentTemperature ?: actualEnd
            val area = Path().apply {
                moveTo(x(index), y(actualStart)); lineTo(x(index + 1), y(actualEnd))
                lineTo(x(index + 1), y(apparentEnd)); lineTo(x(index), y(apparentStart)); close()
            }
            val warmer = apparentStart + apparentEnd >= actualStart + actualEnd
            canvas.drawPath(area, Paint().apply { color = if (warmer) Color.argb(72, 242, 142, 62) else Color.argb(72, 59, 142, 229) })
        }

        points.zipWithNext().forEachIndexed { index, pair ->
            val start = pair.first.temperature ?: return@forEachIndexed
            val end = pair.second.temperature ?: return@forEachIndexed
            val startX = x(index)
            val endX = x(index + 1)
            val middleX = (startX + endX) / 2f
            val segment = Path().apply {
                moveTo(startX, y(start))
                cubicTo(middleX, y(start), middleX, y(end), endX, y(end))
            }
            canvas.drawPath(segment, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = 3.2f * pixelScale
                strokeCap = Paint.Cap.ROUND
                strokeJoin = Paint.Join.ROUND
                shader = LinearGradient(startX, 0f, endX, 0f, temperatureColor(start, temperatureThresholds), temperatureColor(end, temperatureThresholds), Shader.TileMode.CLAMP)
            })
        }
        points.first().temperature?.let { first ->
            canvas.drawLine(bounds.left, y(first), x(0), y(first), Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = temperatureColor(first, temperatureThresholds)
                strokeWidth = 3.2f * pixelScale
                strokeCap = Paint.Cap.ROUND
            })
        }
        points.last().temperature?.let { last ->
            canvas.drawLine(x(points.lastIndex), y(last), bounds.right, y(last), Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = temperatureColor(last, temperatureThresholds)
                strokeWidth = 3.2f * pixelScale
                strokeCap = Paint.Cap.ROUND
            })
        }
        points.forEachIndexed { index, point ->
            if (point.weatherCode !in listOf(95, 96, 99) || point.temperature == null) return@forEachIndexed
            val probability = ((point.precipitationProbability ?: 0.0) / 100.0).toFloat().coerceIn(0f, 1f)
            drawLightning(canvas, x(index), max(bounds.top + 16f * pixelScale, y(point.temperature) - 16f * pixelScale), (1.2f + probability * 1.4f) * pixelScale * lightningScale)
        }
    }

    private fun smoothLinePath(left: Float, cell: Float, values: List<Float?>): Path {
        val path = Path()
        var drawing = false
        values.forEachIndexed { index, y ->
            if (y == null) { drawing = false; return@forEachIndexed }
            val x = left + (index + .5f) * cell
            if (!drawing) { path.moveTo(if (index == 0) left else x, y); path.lineTo(x, y); drawing = true; return@forEachIndexed }
            val next = values.getOrNull(index + 1)
            if (next == null) path.lineTo(x, y) else {
                val nextX = left + (index + 1.5f) * cell
                path.quadTo(x, y, (x + nextX) / 2f, (y + next) / 2f)
            }
        }
        values.lastOrNull()?.let { y -> path.lineTo(left + values.size * cell, y) }
        return path
    }

    private fun drawWindAnnotations(canvas: Canvas, bounds: RectF, points: List<HourlyWeather>, palette: ForecastPalette, pixelScale: Float) {
        if (points.isEmpty()) return
        val cell = bounds.width() / points.size
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.wind
            textAlign = Paint.Align.CENTER
            textSize = 7f * pixelScale
            strokeWidth = 1.2f * pixelScale
            strokeCap = Paint.Cap.ROUND
            typeface = Typeface.create("monospace", Typeface.BOLD)
        }
        points.forEachIndexed { index, point ->
            val centerX = bounds.left + (index + .5f) * cell
            val centerY = bounds.top + bounds.height() * .34f
            val direction = (point.windDirection ?: 0.0).toFloat()
            val arrowLength = min(cell * .28f, 7f * pixelScale)
            canvas.save()
            canvas.rotate(direction, centerX, centerY)
            canvas.drawLine(centerX, centerY + arrowLength, centerX, centerY - arrowLength, paint)
            canvas.drawLine(centerX, centerY - arrowLength, centerX - arrowLength * .45f, centerY - arrowLength * .45f, paint)
            canvas.drawLine(centerX, centerY - arrowLength, centerX + arrowLength * .45f, centerY - arrowLength * .45f, paint)
            canvas.restore()
            canvas.drawText((point.windSpeed ?: 0.0).toInt().toString(), centerX, bounds.bottom - 2f * pixelScale, paint)
        }
    }

    fun drawWindLayer(canvas: Canvas, bounds: RectF, points: List<HourlyWeather>, dark: Boolean, pixelScale: Float, windScale: Float, showAnnotations: Boolean) {
        val palette = palette(dark)
        drawWind(canvas, bounds, points, palette, pixelScale, windScale, 0)
        if (showAnnotations) drawWindAnnotations(canvas, bounds, points, palette, pixelScale)
        canvas.drawLine(bounds.left, bounds.top, bounds.right, bounds.top, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = palette.separator
            strokeWidth = 1.25f * pixelScale
        })
        drawDaySeparators(canvas, bounds, points, palette, pixelScale)
    }

    private fun drawDemoWatermarks(canvas: Canvas, bounds: RectF, points: List<HourlyWeather>, label: String, everyDay: Boolean, pixelScale: Float, palette: ForecastPalette) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = withAlpha(palette.text, 72)
            textSize = 9f * pixelScale
            typeface = Typeface.create("monospace", Typeface.BOLD)
        }
        val cell = bounds.width() / points.size.coerceAtLeast(1)
        val ranges = if (!everyDay) listOf(0 until points.size) else points.indices.groupBy { points[it].timestamp.take(10) }.values.map { it.first()..it.last() }
        ranges.forEach { range ->
            val left = bounds.left + range.first * cell + 5f * pixelScale
            val right = bounds.left + (range.last + 1) * cell - 5f * pixelScale
            val top = bounds.top + 12f * pixelScale
            val bottom = bounds.bottom - 5f * pixelScale
            paint.textAlign = Paint.Align.LEFT
            canvas.drawText(label, left, top, paint)
            canvas.drawText(label, left, bottom, paint)
            paint.textAlign = Paint.Align.RIGHT
            canvas.drawText(label, right, top, paint)
            canvas.drawText(label, right, bottom, paint)
        }
    }

    private fun drawWind(canvas: Canvas, bounds: RectF, points: List<HourlyWeather>, palette: ForecastPalette, pixelScale: Float, windScale: Float, pointOffset: Int) {
        if (points.size < 2) return
        canvas.drawRect(bounds, Paint().apply { color = withAlpha(palette.background, if (Color.luminance(palette.background) < .5f) 255 else 245) })
        val cell = bounds.width() / points.size
        val raw = points.map { max(0.0, it.windSpeed ?: 0.0).toFloat() }
        val gustiness = points.mapIndexed { index, point -> ((max(raw[index].toDouble(), point.windGusts ?: raw[index].toDouble()) - raw[index]) / 30.0).toFloat().coerceIn(0f, 1f) }
        val speed = raw.mapIndexed { index, _ ->
            val weights = intArrayOf(1, 2, 3, 4, 3, 2, 1)
            var total = 0f; var weight = 0
            for (offset in -3..3) raw.getOrNull(index + offset)?.let { total += it * weights[offset + 3]; weight += weights[offset + 3] }
            total / max(1, weight)
        }
        val strength = speed.map { min(1f, it / 32f) }
        val directions = points.mapIndexed { index, _ ->
            var vectorX = 0f
            var vectorY = 0f
            for (nearby in max(0, index - 1)..min(points.lastIndex, index + 1)) {
                val radians = ((points[nearby].windDirection ?: 0.0) * PI / 180.0).toFloat()
                vectorX += cos(radians)
                vectorY += sin(radians)
            }
            atan2(vectorY, vectorX)
        }
        fun cumulativePhases(frequencies: List<Float>, initial: Float): List<Float> = buildList {
            frequencies.forEachIndexed { index, frequency ->
                add(if (index == 0) initial else last() + (frequencies[index - 1] + frequency) / 2f)
            }
        }
        val wavePhases = cumulativePhases(strength.mapIndexed { index, value -> .28f + value * .06f + gustiness[index].pow(1.35f) * 5f }, pointOffset * .42f)
        val gustPhases = cumulativePhases(gustiness.map { .68f + it * 6f }, pointOffset * .82f)
        val lanes = floatArrayOf(-1f, -.6f, -.2f, .2f, .6f, 1f)
        val laneWeights = floatArrayOf(.58f, .78f, 1f, .96f, .76f, .56f)
        fun sample(values: List<Float>, position: Float): Float {
            val start = position.toInt().coerceIn(0, values.lastIndex); val end = min(values.lastIndex, start + 1); val progress = (position - start).coerceIn(0f, 1f)
            return values[start] + (values[end] - values[start]) * progress
        }
        val flowCenters = points.indices.map { index ->
            bounds.top + bounds.height() * .61f + sin((index + pointOffset) * .085f + directions[index] * .2f) * (.15f + strength[index] * 1.2f) * windScale
        }
        fun lineY(position: Float, laneIndex: Int): Float {
            val current = sample(strength, position); val gust = sample(gustiness, position)
            val direction = sample(directions, position)
            val lane = lanes[laneIndex]
            val baseAmplitude = current.pow(1.08f) * bounds.height() * .18f * windScale
            val amplitude = min(bounds.height() * .34f * windScale, baseAmplitude * (1f + gust.pow(1.6f) * 1.8f))
            val mainWave = sin(sample(wavePhases, position) + direction * .14f + laneIndex * .11f) * amplitude
            val secondaryWave = sin((position + pointOffset) * .16f + laneIndex * .23f) * amplitude * .28f
            val gustWave = sin(sample(gustPhases, position) + laneIndex * .37f) * gust * baseAmplitude * .8f
            val separation = lane * (2.2f + current * 5.1f) * pixelScale * windScale
            return (sample(flowCenters, position) + separation + mainWave + secondaryWave + gustWave)
                .coerceIn(bounds.top + 3f * pixelScale * windScale, bounds.bottom - 3f * pixelScale * windScale)
        }
        val gradientPositions = strength.indices.map { it.toFloat() / max(1, strength.lastIndex) }.toFloatArray()
        val envelopeGradient = LinearGradient(
            bounds.left,
            0f,
            bounds.right,
            0f,
            strength.map { withAlpha(palette.wind, ((.006f + it.pow(1.35f) * .065f) * 255).toInt()) }.toIntArray(),
            gradientPositions,
            Shader.TileMode.CLAMP,
        )
        val envelope = Path()
        for (index in 0 until points.lastIndex) {
            val startX = bounds.left + (index + .5f) * cell
            val endX = bounds.left + (index + 1.5f) * cell
            val startLines = lanes.indices.map { lineY(index.toFloat(), it) }
            val endLines = lanes.indices.map { lineY(index + 1f, it) }
            val startTop = startLines.min()
            val startBottom = startLines.max()
            val endTop = endLines.min()
            val endBottom = endLines.max()
            envelope.moveTo(startX, startTop)
            envelope.cubicTo(startX + cell * .42f, startTop, endX - cell * .42f, endTop, endX, endTop)
            envelope.lineTo(endX, endBottom)
            envelope.cubicTo(endX - cell * .42f, endBottom, startX + cell * .42f, startBottom, startX, startBottom)
            envelope.close()
        }
        canvas.drawPath(envelope, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            shader = envelopeGradient
            style = Paint.Style.FILL
            maskFilter = BlurMaskFilter(2.5f * pixelScale * windScale, BlurMaskFilter.Blur.NORMAL)
        })
        val broadGradient = LinearGradient(
            bounds.left,
            0f,
            bounds.right,
            0f,
            strength.map { withAlpha(palette.wind, ((.006f + it.pow(1.35f) * .09f) * 255).toInt()) }.toIntArray(),
            gradientPositions,
            Shader.TileMode.CLAMP,
        )
        lanes.forEachIndexed { laneIndex, _ ->
            val path = Path().apply {
                moveTo(bounds.left, lineY(0f, laneIndex))
                lineTo(bounds.left + .5f * cell, lineY(0f, laneIndex))
                val samples = (points.size - 1) * 8
                for (sampleIndex in 1..samples) {
                    val position = sampleIndex / 8f
                    lineTo(bounds.left + (position + .5f) * cell, lineY(position, laneIndex))
                }
            }
            canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = broadGradient
                style = Paint.Style.STROKE
                strokeWidth = 5f * laneWeights[laneIndex] * pixelScale * windScale
                strokeCap = Paint.Cap.ROUND
                maskFilter = BlurMaskFilter(5f * pixelScale * windScale, BlurMaskFilter.Blur.NORMAL)
            })
            for (index in 0 until points.lastIndex) {
                val averageStrength = (strength[index] + strength[index + 1]) / 2f
                val segment = Path().apply {
                    moveTo(bounds.left + (index + .5f) * cell, lineY(index.toFloat(), laneIndex))
                    for (step in 1..8) {
                        val position = index + step / 8f
                        lineTo(bounds.left + (position + .5f) * cell, lineY(position, laneIndex))
                    }
                }
                val opacity = (.001f + averageStrength.pow(1.22f) * .92f) * (.65f + laneWeights[laneIndex] * .35f)
                canvas.drawPath(segment, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = withAlpha(palette.wind, (opacity * 255).toInt())
                    style = Paint.Style.STROKE
                    strokeWidth = (.35f + averageStrength * 1.85f) * (.82f + laneWeights[laneIndex] * .18f) * pixelScale * windScale
                    strokeCap = Paint.Cap.ROUND
                })
            }
        }
        var tornadoStart: Int? = null
        points.forEachIndexed { index, point ->
            if (point.tornado && tornadoStart == null) tornadoStart = index
            val closes = tornadoStart != null && (!point.tornado || index == points.lastIndex)
            if (closes) {
                val start = tornadoStart
                val end = if (point.tornado) index else index - 1
                val centerX = bounds.left + ((start + end + 1) / 2f) * cell
                val funnelWidth = max(18f * pixelScale, min(34f * pixelScale, (end - start + 1) * cell * 1.2f))
                drawTornadoFunnel(canvas, centerX, bounds, funnelWidth, palette.wind, pixelScale)
                tornadoStart = null
            }
        }
    }

    private fun drawTornadoFunnel(canvas: Canvas, centerX: Float, bounds: RectF, width: Float, color: Int, pixelScale: Float) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            this.color = color
            style = Paint.Style.STROKE
            strokeWidth = 1.5f * pixelScale
            strokeCap = Paint.Cap.ROUND
        }
        val top = bounds.top + bounds.height() * .16f
        val height = bounds.height() * .68f
        repeat(5) { index ->
            val progress = index / 4f
            val y = top + progress * height
            val half = width * (1f - progress * .78f) / 2f
            canvas.drawArc(centerX - half, y - 2f * pixelScale, centerX + half, y + 2f * pixelScale, if (index % 2 == 0) 195f else 15f, 300f, false, paint)
        }
    }

    private fun drawDaySeparators(canvas: Canvas, bounds: RectF, points: List<HourlyWeather>, palette: ForecastPalette, pixelScale: Float) {
        val cell = bounds.width() / points.size
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = palette.separator; strokeWidth = 1.25f * pixelScale }
        points.forEachIndexed { index, point ->
            if (index > 0 && point.timestamp.take(10) != points[index - 1].timestamp.take(10)) {
                val x = bounds.left + index * cell
                canvas.drawLine(x, bounds.top, x, bounds.bottom, paint)
            }
        }
    }

    private fun drawHistoryOverlay(canvas: Canvas, bounds: RectF, points: List<HourlyWeather>, currentTimestamp: String, historyLabel: String, pixelScale: Float) {
        val currentIndex = points.indexOfLast { it.timestamp.take(13) <= currentTimestamp.take(13) }
        if (currentIndex < 0) return
        val cell = bounds.width() / points.size
        val markerX = if (points.last().timestamp.take(13) <= currentTimestamp.take(13)) bounds.right else bounds.left + currentIndex * cell
        canvas.drawRect(bounds.left, bounds.top, markerX, bounds.bottom, Paint().apply { color = Color.argb(32, 244, 123, 50) })
        canvas.drawLine(bounds.left, bounds.top + 1.5f * pixelScale, markerX, bounds.top + 1.5f * pixelScale, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.argb(165, 244, 123, 50)
            strokeWidth = 2f * pixelScale
        })
        canvas.drawLine(markerX, bounds.top, markerX, bounds.bottom, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(244, 123, 50)
            strokeWidth = 1.5f * pixelScale
        })
        if (historyLabel.isNotBlank()) {
            canvas.drawText(historyLabel.uppercase(), markerX - 5f * pixelScale, bounds.top + 13f * pixelScale, Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.rgb(244, 123, 50)
                textAlign = Paint.Align.RIGHT
                textSize = 8f * pixelScale
                typeface = Typeface.create("monospace", Typeface.BOLD)
            })
        }
    }

    private fun drawDrop(canvas: Canvas, x: Float, y: Float, size: Float, alpha: Float, palette: ForecastPalette) {
        val path = Path().apply { moveTo(x, y - size); cubicTo(x - size * .65f, y - size * .15f, x - size * .55f, y + size * .55f, x, y + size * .65f); cubicTo(x + size * .55f, y + size * .55f, x + size * .65f, y - size * .15f, x, y - size); close() }
        canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = withAlpha(palette.rain, (alpha * 255).toInt()) })
    }

    private fun drawSnow(canvas: Canvas, x: Float, y: Float, size: Float, alpha: Float, palette: ForecastPalette, pixelScale: Float) {
        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = withAlpha(palette.snow, (alpha * 255).toInt()); strokeWidth = 1.5f * pixelScale; strokeCap = Paint.Cap.ROUND }
        repeat(3) { line -> val angle = line * PI.toFloat() / 3f; val dx = cos(angle) * size; val dy = sin(angle) * size; canvas.drawLine(x - dx, y - dy, x + dx, y + dy, paint) }
    }

    private fun drawHail(canvas: Canvas, x: Float, y: Float, size: Float, alpha: Float, palette: ForecastPalette, pixelScale: Float) {
        val path = Path().apply { moveTo(x, y - size * 1.35f); lineTo(x + size * .78f, y); lineTo(x, y + size * 1.35f); lineTo(x - size * .78f, y); close() }
        canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = withAlpha(palette.snow, (alpha * 255).toInt()); style = Paint.Style.FILL_AND_STROKE; strokeWidth = 1.1f * pixelScale })
    }

    private fun drawLightning(canvas: Canvas, x: Float, y: Float, scale: Float) {
        val path = Path().apply { moveTo(x + 2f * scale, y - 9f * scale); lineTo(x - 4f * scale, y + scale); lineTo(x, y + scale); lineTo(x - 2f * scale, y + 10f * scale); lineTo(x + 6f * scale, y - 2f * scale); lineTo(x + 2f * scale, y - 2f * scale); close() }
        canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply {
            color = Color.rgb(126, 82, 0)
            style = Paint.Style.STROKE
            strokeWidth = 1.25f * scale
            strokeJoin = Paint.Join.ROUND
        })
        canvas.drawPath(path, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.rgb(255, 220, 68); style = Paint.Style.FILL })
    }

    private fun sunlightEdge(point: HourlyWeather, daylight: Map<String, Pair<LocalDateTime?, LocalDateTime?>>): Float {
        val time = parseDateTime(point.timestamp) ?: return 1f
        val sun = daylight[point.timestamp.take(10)] ?: return 1f
        val sunrise = sun.first ?: return 1f; val sunset = sun.second ?: return 1f
        if (time <= sunrise || time >= sunset) return 0f
        val fromRise = java.time.Duration.between(sunrise, time).toMinutes() / 60f
        val toSet = java.time.Duration.between(time, sunset).toMinutes() / 60f
        return min(1f, min(fromRise, toSet)).coerceAtLeast(0f)
    }

    private fun smooth(values: List<Float>): List<Float> = values.mapIndexed { index, value ->
        val previous = values.getOrNull(index - 1) ?: value; val next = values.getOrNull(index + 1) ?: value
        (previous + value * 2f + next) / 4f
    }

    private fun parseDateTime(value: String?): LocalDateTime? = runCatching { LocalDateTime.parse(value) }.getOrNull()
    private fun shortTemperature(value: Double?, unit: String): String = value?.let { "${(if (unit == "F") it * 9 / 5 + 32 else it).toInt()}°" } ?: "-"
    private fun withAlpha(color: Int, alpha: Int) = Color.argb(alpha.coerceIn(0, 255), Color.red(color), Color.green(color), Color.blue(color))

    fun temperatureColor(value: Double?, thresholds: TemperatureThresholds = TemperatureThresholds()): Int {
        if (value == null) return Color.rgb(141, 152, 170)
        val stops = listOf(
            -40.0 to Color.WHITE, thresholds.deepFrost.toDouble() - .001 to Color.WHITE,
            thresholds.deepFrost.toDouble() to Color.rgb(127, 137, 150), -.001 to Color.rgb(127, 137, 150),
            0.0 to Color.rgb(35, 88, 199), thresholds.mild.toDouble() - .001 to Color.rgb(59, 158, 229),
            thresholds.mild.toDouble() to Color.rgb(69, 207, 136), thresholds.warm.toDouble() - .001 to Color.rgb(69, 207, 136),
            thresholds.warm.toDouble() to Color.rgb(242, 142, 62), thresholds.hot.toDouble() - .001 to Color.rgb(242, 142, 62),
            thresholds.hot.toDouble() to Color.rgb(255, 38, 63), 50.0 to Color.rgb(255, 38, 63),
        )
        if (value <= stops.first().first) return stops.first().second
        if (value >= stops.last().first) return stops.last().second
        val upper = stops.indexOfFirst { it.first >= value }
        val lowerStop = stops[upper - 1]; val upperStop = stops[upper]
        val progress = ((value - lowerStop.first) / (upperStop.first - lowerStop.first)).toFloat().coerceIn(0f, 1f)
        return Color.rgb(
            (Color.red(lowerStop.second) + (Color.red(upperStop.second) - Color.red(lowerStop.second)) * progress).toInt(),
            (Color.green(lowerStop.second) + (Color.green(upperStop.second) - Color.green(lowerStop.second)) * progress).toInt(),
            (Color.blue(lowerStop.second) + (Color.blue(upperStop.second) - Color.blue(lowerStop.second)) * progress).toInt(),
        )
    }
}
