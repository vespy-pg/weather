package eu.vespy.weather.ui

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.graphics.Color.parseColor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.app.Activity
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.nativeCanvas
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import eu.vespy.weather.R
import eu.vespy.weather.data.HourlyWeather
import eu.vespy.weather.data.Promotion
import eu.vespy.weather.data.ForecastDisplaySettings
import eu.vespy.weather.data.TemperatureThresholds
import eu.vespy.weather.data.WeatherForecast
import eu.vespy.weather.data.atExactInterval
import eu.vespy.weather.widget.WeatherWidgetProvider
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDateTime
import java.time.LocalDate
import java.time.format.DateTimeFormatter
import java.time.format.FormatStyle
import java.util.Locale
import kotlin.math.PI
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

private val DarkColors = darkColorScheme(
    background = Color(0xFF080C12),
    surface = Color(0xFF151C27),
    surfaceVariant = Color(0xFF0D1118),
    primary = Color(0xFF58A6FF),
    secondary = Color(0xFF45CF88),
    onBackground = Color(0xFFE7EDF7),
    onSurface = Color(0xFFE7EDF7),
)

private val LightColors = lightColorScheme(
    background = Color(0xFFEDF3F9),
    surface = Color.White,
    surfaceVariant = Color(0xFFF5F8FC),
    primary = Color(0xFF176FC1),
    secondary = Color(0xFF23865A),
    onBackground = Color(0xFF172234),
    onSurface = Color(0xFF172234),
)

private val ChartLine = Color(0xFF2C3748)
private val ChartWind = Color(0xFF9BC7D7)
private val Muted = Color(0xFF8D98AA)

@Composable
fun VespyWeatherApp(viewModel: WeatherViewModel) {
    val systemDarkTheme = isSystemInDarkTheme()
    val state = viewModel.state
    val darkTheme = when (state.displaySettings.theme) {
        "dark" -> true
        "light" -> false
        else -> systemDarkTheme
    }
    val context = LocalContext.current
    val updateDisplaySettings: (ForecastDisplaySettings) -> Unit = { settings ->
        val languageChanged = settings.language != viewModel.state.displaySettings.language
        val themeChanged = settings.theme != viewModel.state.displaySettings.theme
        viewModel.setDisplaySettings(settings)
        if (languageChanged) (context as? Activity)?.recreate()
        else if (themeChanged) viewModel.refresh(settings.theme == "dark" || settings.theme == "system" && systemDarkTheme)
    }
    var showSettings by remember { mutableStateOf(false) }
    MaterialTheme(colorScheme = if (darkTheme) DarkColors else LightColors) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            BoxWithConstraints(modifier = Modifier.fillMaxSize()) {
                val landscape = maxWidth > maxHeight
                LaunchedEffect(landscape, darkTheme, state.displaySettings.language) {
                    viewModel.refreshPromotions(darkTheme, landscape)
                }
                if (landscape) {
                    Row(modifier = Modifier.fillMaxSize()) {
                        ForecastPane(
                            state = state,
                            landscape = true,
                            onLocation = { viewModel.selectLocation(it, darkTheme) },
                            onRetry = { viewModel.refresh(darkTheme) },
                            onSettings = { showSettings = true },
                            onDisplaySettings = updateDisplaySettings,
                            modifier = Modifier.weight(1f),
                        )
                        PromotionRail(
                            state.promotions,
                            state.promotionRotationSeconds,
                            landscape = true,
                            onImpression = viewModel::recordPromotionImpression,
                            onClick = viewModel::recordPromotionClick,
                            modifier = Modifier.width(150.dp).fillMaxHeight(),
                        )
                    }
                } else {
                    Column(modifier = Modifier.fillMaxSize()) {
                        ForecastPane(
                            state = state,
                            landscape = false,
                            onLocation = { viewModel.selectLocation(it, darkTheme) },
                            onRetry = { viewModel.refresh(darkTheme) },
                            onSettings = { showSettings = true },
                            onDisplaySettings = updateDisplaySettings,
                            modifier = Modifier.weight(1f),
                        )
                        PromotionRail(
                            state.promotions,
                            state.promotionRotationSeconds,
                            landscape = false,
                            onImpression = viewModel::recordPromotionImpression,
                            onClick = viewModel::recordPromotionClick,
                            modifier = Modifier.fillMaxWidth().height(64.dp),
                        )
                    }
                }
                if (showSettings) SettingsDialog(
                    state = state,
                    darkTheme = darkTheme,
                    onDismiss = { showSettings = false },
                    onSearch = viewModel::searchLocations,
                    onAddLocation = { viewModel.addLocation(it, darkTheme) },
                    onCurrentLocation = { latitude, longitude -> viewModel.addCurrentLocation(latitude, longitude, darkTheme) },
                    onRemoveLocation = { viewModel.removeLocation(it, darkTheme) },
                    onTemperatureUnit = viewModel::setTemperatureUnit,
                    onDisplaySettings = updateDisplaySettings,
                    onAnalyticsConsent = viewModel::setAnalyticsConsent,
                )
                if (state.analyticsConsent == null) AnalyticsConsentDialog(viewModel::setAnalyticsConsent)
            }
        }
    }
}

@Composable
private fun ForecastPane(
    state: WeatherUiState,
    landscape: Boolean,
    onLocation: (eu.vespy.weather.data.WeatherLocation) -> Unit,
    onRetry: () -> Unit,
    onSettings: () -> Unit,
    onDisplaySettings: (ForecastDisplaySettings) -> Unit,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .statusBarsPadding()
            .then(if (!landscape) Modifier.navigationBarsPadding() else Modifier)
            .padding(horizontal = if (landscape) 10.dp else 14.dp, vertical = 8.dp),
    ) {
        if (landscape) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                LocationTitle(state.location.name, compact = true)
                Spacer(Modifier.width(12.dp))
                FavoriteLocations(state.locations, state.location.name, onLocation, onSettings, Modifier.weight(1f))
                SettingsButton(onSettings)
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically) {
                LocationTitle(state.location.name, compact = false, modifier = Modifier.weight(1f))
                SettingsButton(onSettings)
            }
            FavoriteLocations(state.locations, state.location.name, onLocation, onSettings, Modifier.padding(vertical = 9.dp))
        }

        when {
            state.loading && state.forecast == null -> LoadingState(Modifier.weight(1f))
            state.error != null && state.forecast == null -> ErrorState(onRetry, Modifier.weight(1f))
            state.forecast != null -> ForecastCard(state.forecast, landscape, state.temperatureUnit, state.displaySettings, onDisplaySettings)
        }
    }
}

@Composable
private fun LocationTitle(name: String, compact: Boolean, modifier: Modifier = Modifier) {
    Column(modifier = modifier.widthIn(max = if (compact) 270.dp else Dp.Infinity)) {
        if (!compact) Text(
            text = stringResource(R.string.weather),
            color = MaterialTheme.colorScheme.primary,
            fontFamily = FontFamily.Monospace,
            fontSize = 9.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = 1.sp,
        )
        Text(
            text = name,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            fontSize = if (compact) 18.sp else 27.sp,
            fontWeight = FontWeight.ExtraBold,
        )
    }
}

@Composable
private fun SettingsButton(onClick: () -> Unit) {
    val description = stringResource(R.string.settings)
    Box(
        modifier = Modifier
            .size(34.dp)
            .clickable(onClick = onClick)
            .semantics { contentDescription = description }
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .45f), RoundedCornerShape(9.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text("⚙", fontSize = 16.sp)
    }
}

@Composable
private fun FavoriteLocations(locations: List<eu.vespy.weather.data.WeatherLocation>, active: String, onLocation: (eu.vespy.weather.data.WeatherLocation) -> Unit, onAdd: () -> Unit, modifier: Modifier = Modifier) {
    Row(modifier = modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        locations.forEach { location ->
            val selected = location.name == active
            Surface(
                modifier = Modifier.clickable { onLocation(location) },
                shape = CircleShape,
                color = if (selected) MaterialTheme.colorScheme.primary.copy(alpha = .2f) else MaterialTheme.colorScheme.surfaceVariant,
                border = androidx.compose.foundation.BorderStroke(1.dp, if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outline.copy(alpha = .35f)),
            ) {
                Text(location.name, modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp), fontSize = 9.sp, maxLines = 1)
            }
        }
        Surface(modifier = Modifier.clickable(onClick = onAdd), shape = CircleShape, color = MaterialTheme.colorScheme.surfaceVariant) {
            Text("+", modifier = Modifier.padding(horizontal = 10.dp, vertical = 5.dp), fontSize = 13.sp)
        }
    }
}

@Composable
private fun ForecastCard(
    forecast: WeatherForecast,
    landscape: Boolean,
    temperatureUnit: String,
    displaySettings: ForecastDisplaySettings,
    onDisplaySettings: (ForecastDisplaySettings) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        shape = RoundedCornerShape(10.dp),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .4f)),
        color = MaterialTheme.colorScheme.surfaceVariant,
    ) {
        Column {
            Row(
                modifier = Modifier.fillMaxWidth().height(if (landscape) 30.dp else 44.dp).padding(horizontal = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                if (landscape) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        ForecastEyebrow()
                        Text(stringResource(R.string.forecast_title), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                    }
                } else {
                    Column {
                        ForecastEyebrow()
                        Text(stringResource(R.string.forecast_title), fontSize = 13.sp, fontWeight = FontWeight.Bold)
                    }
                }
                ZoomControls(displaySettings, onDisplaySettings)
            }
            ForecastTimeline(forecast.hourly, forecast.daily, landscape, temperatureUnit, displaySettings)
            if (!landscape) Metrics(forecast, temperatureUnit)
        }
    }
}

@Composable
private fun ForecastEyebrow() {
    Text(
        stringResource(R.string.next_ten_days),
        color = MaterialTheme.colorScheme.primary,
        fontFamily = FontFamily.Monospace,
        fontSize = 7.sp,
        fontWeight = FontWeight.Black,
        letterSpacing = .7.sp,
    )
}

@Composable
private fun ZoomControls(settings: ForecastDisplaySettings, onChange: (ForecastDisplaySettings) -> Unit) {
    val levels = listOf(.125f, .25f, .375f, .5f, .75f, 1f, 1.25f, 1.5f, 2f)
    val index = levels.indexOf(settings.zoom).coerceAtLeast(3)
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        ZoomButton("-", index > 0) { onChange(settings.copy(zoom = levels[index - 1])) }
        Box(
            Modifier.height(26.dp).width(38.dp).clickable { onChange(settings.copy(zoom = .5f)) }
                .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .35f), RoundedCornerShape(5.dp)),
            contentAlignment = Alignment.Center,
        ) { Text("${(settings.zoom * 100).roundToInt()}%", color = Muted, fontSize = 8.sp) }
        ZoomButton("+", index < levels.lastIndex) { onChange(settings.copy(zoom = levels[index + 1])) }
    }
}

@Composable
private fun ZoomButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    Box(
        Modifier.size(26.dp).clickable(enabled = enabled, onClick = onClick)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = if (enabled) .35f else .15f), RoundedCornerShape(5.dp)),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (enabled) MaterialTheme.colorScheme.onSurface else Muted.copy(alpha = .35f), fontSize = 12.sp) }
}

@Composable
private fun ForecastTimeline(
    hourly: List<HourlyWeather>,
    days: List<eu.vespy.weather.data.DailyWeather>,
    landscape: Boolean,
    temperatureUnit: String,
    settings: ForecastDisplaySettings,
) {
    val groupHours = when (settings.zoom) { .125f -> 12; .25f -> 6; .375f -> 4; .5f -> 3; .75f -> 2; else -> 1 }
    val points = remember(hourly, groupHours) { hourly.atExactInterval(groupHours) }
    val slotWidth = 22.dp * settings.zoom * groupHours
    val trackWidth = slotWidth * max(1, points.size)
    val timelineHeight = if (landscape) 258.dp else 368.dp
    val labelHeight = if (landscape) 44.dp else 62.dp
    val skyHeight = if (landscape) 68.dp else 103.dp
    val windHeight = if (!settings.showWind) 0.dp else if (settings.showWindArrows) {
        if (landscape) 48.dp else 60.dp
    } else if (landscape) 34.dp else 45.dp
    val scrollState = rememberScrollState()
    val todayLabel = stringResource(R.string.today)
    val dark = isSystemInDarkTheme()
    val legendWidth = if (landscape) 38.dp else 44.dp
    Box(modifier = Modifier.fillMaxWidth().height(timelineHeight).horizontalScroll(scrollState)) {
        Canvas(modifier = Modifier.width(legendWidth + trackWidth).fillMaxHeight()) {
            val legendWidthPx = legendWidth.toPx()
            ForecastGraphics.drawLegend(
                canvas = drawContext.canvas.nativeCanvas,
                bounds = android.graphics.RectF(0f, 0f, legendWidthPx, size.height),
                dark = dark,
                labelHeight = labelHeight.toPx(),
                skyHeight = skyHeight.toPx(),
                windHeight = windHeight.toPx(),
                pixelScale = density,
            )
            ForecastGraphics.drawTimeline(
                canvas = drawContext.canvas.nativeCanvas,
                bounds = android.graphics.RectF(legendWidthPx, 0f, size.width, size.height),
                points = points,
                days = days,
                dark = dark,
                todayLabel = todayLabel,
                labelHeight = labelHeight.toPx(),
                skyHeight = skyHeight.toPx(),
                windHeight = windHeight.toPx(),
                temperatureUnit = temperatureUnit,
                pixelScale = density,
                textScale = 1.6f,
                precipitationScale = 1.8f,
                showWeekdayNames = true,
                dayLabelTextSize = 16f * density,
                hourTextSize = 13f * density,
                temperatureTextSize = 24f * density,
                windScale = 1.22f,
                showTemperatureValues = settings.showHourlyTemperatures,
                showApparentTemperature = settings.showApparentTemperature,
                showPrecipitation = settings.showPrecipitation,
                showWind = settings.showWind,
                showWindArrows = settings.showWindArrows,
                temperatureThresholds = settings.temperatureThresholds,
            )
        }
    }
}

@Composable
private fun HourlyLabels(points: List<HourlyWeather>, slotWidth: Dp, height: Dp) {
    val today = LocalDate.now()
    val todayLabel = stringResource(R.string.today)
    Row(modifier = Modifier.height(height)) {
        points.forEachIndexed { index, point ->
            val dateTime = point.dateTime()
            val previousDate = points.getOrNull(index - 1)?.timestamp?.take(10)
            val newDay = previousDate != point.timestamp.take(10)
            Column(
                modifier = Modifier
                    .width(slotWidth)
                    .fillMaxHeight()
                    .border(width = if (newDay) 1.dp else .25.dp, color = if (newDay) Muted else ChartLine)
                    .padding(top = 3.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    if (newDay) {
                        dateTime?.toLocalDate()?.let { date ->
                            if (date == today) todayLabel else date.format(DateTimeFormatter.ofLocalizedDate(FormatStyle.SHORT))
                        } ?: ""
                    } else "",
                    maxLines = 1,
                    fontSize = 6.sp,
                    fontWeight = FontWeight.Black,
                )
                Text(dateTime?.format(DateTimeFormatter.ofPattern("HH")) ?: "--", color = Muted, fontFamily = FontFamily.Monospace, fontSize = 8.sp)
                Text(temperatureText(point.temperature), color = temperatureColor(point.temperature), fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun SkyChart(points: List<HourlyWeather>, modifier: Modifier) {
    val dark = isSystemInDarkTheme()
    Canvas(modifier = modifier.border(.5.dp, ChartLine)) {
        if (points.isEmpty()) return@Canvas
        val cell = size.width / points.size
        points.forEachIndexed { index, point ->
            val hour = point.dateTime()?.hour ?: 12
            val daylight = hour in 7..18
            val left = index * cell
            drawRect(if (daylight) Color(0x1A58A6FF) else Color(0xAA000000), Offset(left, 0f), Size(cell, size.height))
            if (daylight) {
                val clear = 1f - ((point.cloudCover ?: 0.0).toFloat() / 100f)
                drawRect(Color(0x99FFD43D).copy(alpha = .12f + clear * .48f), Offset(left, 0f), Size(cell, size.height * (.18f + clear * .34f)))
            } else if (index % 3 == 1) {
                drawCircle(if (dark) Color(0xFFDCE9FF) else Color(0xFF61738C), radius = min(cell, size.height) * .13f, center = Offset(left + cell / 2, size.height * .34f))
                drawCircle(if (dark) Color.Black else Color(0xFFD6E0EB), radius = min(cell, size.height) * .13f, center = Offset(left + cell / 2 + cell * .06f, size.height * .29f))
            }
        }

        val cloud = Path().apply {
            moveTo(0f, size.height * .14f)
            points.forEachIndexed { index, point ->
                val x = (index + .5f) * cell
                val y = size.height * (.14f + ((point.cloudCover ?: 0.0).toFloat() / 100f) * .34f)
                lineTo(x, y)
            }
            lineTo(size.width, 0f)
            lineTo(0f, 0f)
            close()
        }
        drawPath(cloud, if (dark) Color(0x889CA8B8) else Color(0x887F8FA3))

        points.forEachIndexed { index, point ->
            val center = Offset((index + .5f) * cell, size.height * .8f)
            val probability = ((point.precipitationProbability ?: 0.0) / 100.0).toFloat().coerceIn(.15f, 1f)
            when {
                (point.snowfall ?: 0.0) > 0 -> drawSnowflake(center, probability, min(cell, size.height) * .17f)
                (point.rain ?: point.precipitation ?: 0.0) > 0 -> drawRaindrop(center, Color(0xFF58A6FF).copy(alpha = probability), min(cell, size.height) * .12f)
            }
        }
        drawDaySeparators(points)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawRaindrop(center: Offset, color: Color, radius: Float) {
    val path = Path().apply {
        moveTo(center.x, center.y - radius * 1.4f)
        quadraticTo(center.x - radius, center.y, center.x, center.y + radius)
        quadraticTo(center.x + radius, center.y, center.x, center.y - radius * 1.4f)
        close()
    }
    drawPath(path, color)
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawSnowflake(center: Offset, alpha: Float, radius: Float) {
    repeat(3) { line ->
        val angle = line * PI.toFloat() / 3f
        val direction = Offset(kotlin.math.cos(angle) * radius, kotlin.math.sin(angle) * radius)
        drawLine(Color(0xFFD9F1FF).copy(alpha = alpha), center - direction, center + direction, strokeWidth = 1.5f)
    }
}

@Composable
private fun TemperatureChart(points: List<HourlyWeather>, modifier: Modifier) {
    Canvas(modifier = modifier.border(.5.dp, ChartLine)) {
        val allValues = points.flatMap { listOfNotNull(it.temperature, it.apparentTemperature) }
        if (points.size < 2 || allValues.isEmpty()) return@Canvas
        val minimum = allValues.min() - 3.0
        val maximum = allValues.max() + 3.0
        val range = max(1.0, maximum - minimum)
        val cell = size.width / points.size
        fun x(index: Int) = (index + .5f) * cell
        fun y(value: Double) = (size.height * .12f + ((maximum - value) / range).toFloat() * size.height * .76f)

        repeat(3) { row ->
            val y = size.height * (row + 1) / 4f
            drawLine(ChartLine, Offset(0f, y), Offset(size.width, y), strokeWidth = 1f)
        }
        points.zipWithNext().forEachIndexed { index, pair ->
            val first = pair.first
            val second = pair.second
            val firstTemp = first.temperature ?: return@forEachIndexed
            val secondTemp = second.temperature ?: return@forEachIndexed
            val firstFeels = first.apparentTemperature ?: firstTemp
            val secondFeels = second.apparentTemperature ?: secondTemp
            val warmer = (firstFeels + secondFeels) > (firstTemp + secondTemp)
            val area = Path().apply {
                moveTo(x(index), y(firstTemp))
                lineTo(x(index + 1), y(secondTemp))
                lineTo(x(index + 1), y(secondFeels))
                lineTo(x(index), y(firstFeels))
                close()
            }
            drawPath(area, if (warmer) Color(0x553F210D) else Color(0x55235B91))
            drawLine(
                color = temperatureColor((firstTemp + secondTemp) / 2),
                start = Offset(x(index), y(firstTemp)),
                end = Offset(x(index + 1), y(secondTemp)),
                strokeWidth = 3.2f,
                cap = StrokeCap.Round,
            )
            if ((first.weatherCode ?: 0) >= 95) drawLightning(Offset(x(index), max(13f, y(firstTemp) - 18f)))
        }
        drawDaySeparators(points)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawLightning(center: Offset) {
    val path = Path().apply {
        moveTo(center.x + 2f, center.y - 10f)
        lineTo(center.x - 5f, center.y + 1f)
        lineTo(center.x, center.y + 1f)
        lineTo(center.x - 2f, center.y + 11f)
        lineTo(center.x + 7f, center.y - 2f)
        lineTo(center.x + 2f, center.y - 2f)
        close()
    }
    drawPath(path, Color(0xFFFFD34D))
}

@Composable
private fun WindChart(points: List<HourlyWeather>, modifier: Modifier) {
    Canvas(modifier = modifier.background(if (isSystemInDarkTheme()) Color(0xFF0F151E) else Color(0xFFEEF4FA)).border(.5.dp, ChartLine)) {
        if (points.size < 2) return@Canvas
        val cell = size.width / points.size
        repeat(7) { lane ->
            val laneOffset = lane - 3f
            points.zipWithNext().forEachIndexed { index, pair ->
                val speed = ((pair.first.windSpeed ?: 0.0) / 55.0).toFloat().coerceIn(0f, 1f)
                val nextSpeed = ((pair.second.windSpeed ?: 0.0) / 55.0).toFloat().coerceIn(0f, 1f)
                fun windY(item: Int, strength: Float): Float {
                    val wave = sin((item * .72f + lane * .37f)) * size.height * .25f * strength
                    return size.height / 2f + laneOffset * (1.2f + strength * 2.4f) + wave
                }
                drawLine(
                    color = ChartWind.copy(alpha = .08f + speed * .42f),
                    start = Offset((index + .5f) * cell, windY(index, speed)),
                    end = Offset((index + 1.5f) * cell, windY(index + 1, nextSpeed)),
                    strokeWidth = .7f + speed * 1.8f,
                    cap = StrokeCap.Round,
                )
            }
        }
        drawDaySeparators(points)
    }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawDaySeparators(points: List<HourlyWeather>) {
    if (points.isEmpty()) return
    val cell = size.width / points.size
    points.forEachIndexed { index, point ->
        if (index > 0 && point.timestamp.take(10) != points[index - 1].timestamp.take(10)) {
            val x = index * cell
            drawLine(Muted.copy(alpha = .8f), Offset(x, 0f), Offset(x, size.height), strokeWidth = 2f)
        }
    }
}

@Composable
private fun Metrics(forecast: WeatherForecast, temperatureUnit: String) {
    Row(modifier = Modifier.fillMaxWidth().padding(8.dp), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        Metric(stringResource(R.string.feels_like), temperatureText(forecast.current.apparentTemperature, temperatureUnit), Modifier.weight(1f))
        Metric(stringResource(R.string.precipitation), "${forecast.current.precipitation ?: 0.0} mm", Modifier.weight(1f))
        Metric(stringResource(R.string.wind), "${forecast.current.windSpeed?.toInt() ?: 0} km/h", Modifier.weight(1f))
    }
}

@Composable
private fun Metric(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier.background(MaterialTheme.colorScheme.surface, RoundedCornerShape(8.dp)).padding(8.dp)) {
        Text(label, color = Muted, fontSize = 8.sp)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold)
    }
}

@Composable
private fun PromotionRail(
    promotions: List<Promotion>,
    rotationSeconds: Int,
    landscape: Boolean,
    onImpression: (String) -> Unit,
    onClick: (String) -> Unit,
    modifier: Modifier = Modifier,
) {
    if (promotions.isEmpty()) return
    var activeIndex by remember(promotions) { mutableIntStateOf(0) }
    LaunchedEffect(promotions) {
        while (promotions.size > 1) {
            delay(rotationSeconds.coerceIn(3, 300) * 1_000L)
            activeIndex = (activeIndex + 1) % promotions.size
        }
    }
    val promotion = promotions[activeIndex]
    LaunchedEffect(promotion.id) { onImpression(promotion.id) }
    val uriHandler = LocalUriHandler.current
    val background = promotion.backgroundColor.toColorOrNull() ?: MaterialTheme.colorScheme.surface
    val accent = promotion.accentColor.toColorOrNull() ?: Color(0xFFF47B32)
    Box(
        modifier = modifier
            .background(background)
            .clickable {
                onClick(promotion.id)
                uriHandler.openUri(promotion.targetUrl)
            }
            .padding(if (landscape) 12.dp else 8.dp),
        contentAlignment = Alignment.Center,
    ) {
        if (promotion.type == "image-banner" && promotion.imageUrl != null) {
            RemotePromotionImage(promotion.imageUrl, promotion.imageAlt.orEmpty(), Modifier.fillMaxSize())
        } else if (landscape) {
            Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                Text(promotion.eyebrow, color = Muted, fontFamily = FontFamily.Monospace, fontSize = 7.sp, fontWeight = FontWeight.Black)
                Spacer(Modifier.height(10.dp))
                PromotionLogo(promotion, accent)
                Spacer(Modifier.height(10.dp))
                Text(promotion.title, fontSize = 15.sp, fontWeight = FontWeight.ExtraBold)
                Text(promotion.description, modifier = Modifier.padding(top = 5.dp), color = Muted, fontSize = 8.sp, lineHeight = 11.sp, maxLines = 4, overflow = TextOverflow.Ellipsis)
                Spacer(Modifier.height(10.dp))
                Text(promotion.actionLabel, color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }
        } else {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                PromotionLogo(promotion, accent, Modifier.size(46.dp))
                Column(Modifier.weight(1f)) {
                    Text(promotion.title, fontSize = 13.sp, fontWeight = FontWeight.ExtraBold)
                    Text(promotion.description, color = Muted, fontSize = 8.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
                Text(promotion.actionLabel, color = accent, fontSize = 8.sp, fontWeight = FontWeight.Black)
            }
        }
    }
}

@Composable
private fun PromotionLogo(promotion: Promotion, accent: Color, modifier: Modifier = Modifier.size(56.dp)) {
    val bitmap by remoteBitmap(promotion.logoUrl)
    Box(modifier.background(Color.White, RoundedCornerShape(12.dp)).border(2.dp, accent, RoundedCornerShape(12.dp)), contentAlignment = Alignment.Center) {
        if (bitmap != null) Image(bitmap!!.asImageBitmap(), contentDescription = "", modifier = Modifier.fillMaxSize().padding(5.dp), contentScale = ContentScale.Fit)
        else Text(promotion.title.take(1).uppercase(), color = accent, fontSize = 28.sp, fontWeight = FontWeight.Black)
    }
}

@Composable
private fun RemotePromotionImage(url: String, alternativeText: String, modifier: Modifier = Modifier) {
    val bitmap by remoteBitmap(url)
    bitmap?.let { Image(it.asImageBitmap(), alternativeText, modifier, contentScale = ContentScale.Fit) }
}

@Composable
private fun remoteBitmap(url: String?) = produceState<Bitmap?>(initialValue = null, key1 = url) {
    value = if (url == null || !url.startsWith("https://")) null else withContext(Dispatchers.IO) {
        runCatching {
            (URL(url).openConnection() as HttpURLConnection).run {
                connectTimeout = 5_000
                readTimeout = 8_000
                instanceFollowRedirects = false
                try {
                    if (responseCode !in 200..299 || contentLengthLong > 5_000_000L) null
                    else inputStream.use(BitmapFactory::decodeStream)
                } finally {
                    disconnect()
                }
            }
        }.getOrNull()
    }
}

@Composable
private fun SettingsDialog(
    state: WeatherUiState,
    darkTheme: Boolean,
    onDismiss: () -> Unit,
    onSearch: (String) -> Unit,
    onAddLocation: (eu.vespy.weather.data.WeatherLocation) -> Unit,
    onCurrentLocation: (Double, Double) -> Unit,
    onRemoveLocation: (eu.vespy.weather.data.WeatherLocation) -> Unit,
    onTemperatureUnit: (String) -> Unit,
    onDisplaySettings: (ForecastDisplaySettings) -> Unit,
    onAnalyticsConsent: (Boolean) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    val context = LocalContext.current
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) useLastKnownLocation(context, onCurrentLocation)
        else Toast.makeText(context, R.string.location_permission_denied, Toast.LENGTH_LONG).show()
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(stringResource(R.string.settings), fontWeight = FontWeight.ExtraBold) },
        text = {
            Column(
                modifier = Modifier.heightIn(max = 430.dp).verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(stringResource(R.string.saved_locations), color = Muted, fontSize = 11.sp)
                state.locations.forEach { location ->
                    Row(
                        modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.SpaceBetween,
                    ) {
                        Text(location.name, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
                        TextButton(onClick = { onRemoveLocation(location) }, enabled = state.locations.size > 1) {
                            Text(stringResource(R.string.remove))
                        }
                    }
                }
                Button(
                    onClick = {
                        if (context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                            useLastKnownLocation(context, onCurrentLocation)
                        } else permissionLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(stringResource(R.string.use_device_location)) }
                Text(stringResource(R.string.language), color = Muted, fontSize = 11.sp)
                OptionButtons(
                    options = listOf("system" to stringResource(R.string.system_default), "en-US" to "English", "pl-PL" to "Polski"),
                    selected = state.displaySettings.language,
                ) { onDisplaySettings(state.displaySettings.copy(language = it)) }
                Text(stringResource(R.string.color_theme), color = Muted, fontSize = 11.sp)
                OptionButtons(
                    options = listOf(
                        "system" to stringResource(R.string.system_default),
                        "dark" to stringResource(R.string.dark_theme),
                        "light" to stringResource(R.string.light_theme),
                    ),
                    selected = state.displaySettings.theme,
                ) { onDisplaySettings(state.displaySettings.copy(theme = it)) }
                Text(stringResource(R.string.temperature_unit), color = Muted, fontSize = 11.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("C", "F").forEach { unit ->
                        Button(
                            onClick = { onTemperatureUnit(unit) },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (state.temperatureUnit == unit) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                            ),
                        ) { Text("°$unit") }
                    }
                }
                Text(stringResource(R.string.temperature_color_thresholds), color = Muted, fontSize = 11.sp)
                ThresholdSlider(stringResource(R.string.deep_frost), state.displaySettings.temperatureThresholds.deepFrost, -30f..-1f, state.temperatureUnit) { value ->
                    updateThresholds(state, onDisplaySettings, state.displaySettings.temperatureThresholds.copy(deepFrost = value))
                }
                ThresholdSlider(stringResource(R.string.mild), state.displaySettings.temperatureThresholds.mild, 1f..(state.displaySettings.temperatureThresholds.warm - 1f), state.temperatureUnit) { value ->
                    updateThresholds(state, onDisplaySettings, state.displaySettings.temperatureThresholds.copy(mild = value))
                }
                ThresholdSlider(stringResource(R.string.warm), state.displaySettings.temperatureThresholds.warm, (state.displaySettings.temperatureThresholds.mild + 1f)..(state.displaySettings.temperatureThresholds.hot - 1f), state.temperatureUnit) { value ->
                    updateThresholds(state, onDisplaySettings, state.displaySettings.temperatureThresholds.copy(warm = value))
                }
                ThresholdSlider(stringResource(R.string.hot), state.displaySettings.temperatureThresholds.hot, (state.displaySettings.temperatureThresholds.warm + 1f)..45f, state.temperatureUnit) { value ->
                    updateThresholds(state, onDisplaySettings, state.displaySettings.temperatureThresholds.copy(hot = value))
                }
                Text(stringResource(R.string.forecast_display), color = Muted, fontSize = 11.sp)
                SettingSwitch(stringResource(R.string.show_hourly_temperatures), state.displaySettings.showHourlyTemperatures) {
                    onDisplaySettings(state.displaySettings.copy(showHourlyTemperatures = it))
                }
                SettingSwitch(stringResource(R.string.show_apparent_temperature), state.displaySettings.showApparentTemperature) {
                    onDisplaySettings(state.displaySettings.copy(showApparentTemperature = it))
                }
                SettingSwitch(stringResource(R.string.show_precipitation), state.displaySettings.showPrecipitation) {
                    onDisplaySettings(state.displaySettings.copy(showPrecipitation = it))
                }
                SettingSwitch(stringResource(R.string.show_wind), state.displaySettings.showWind) {
                    onDisplaySettings(state.displaySettings.copy(showWind = it))
                }
                SettingSwitch(stringResource(R.string.show_wind_arrows), state.displaySettings.showWindArrows) {
                    onDisplaySettings(state.displaySettings.copy(showWindArrows = it, showWind = if (it) true else state.displaySettings.showWind))
                }
                SettingSwitch(stringResource(R.string.analytics_consent), state.analyticsConsent == true, onAnalyticsConsent)
                Text(stringResource(R.string.default_zoom), color = Muted, fontSize = 11.sp)
                ZoomControls(state.displaySettings, onDisplaySettings)
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text(stringResource(R.string.search_location)) },
                )
                Button(
                    onClick = { onSearch(query) },
                    enabled = query.trim().length >= 2 && !state.searchingLocations,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (state.searchingLocations) CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                    else Text(stringResource(R.string.search))
                }
                state.locationResults.forEach { location ->
                    Surface(
                        modifier = Modifier.fillMaxWidth().clickable {
                            onAddLocation(location)
                            query = ""
                        },
                        color = MaterialTheme.colorScheme.surfaceVariant,
                        shape = RoundedCornerShape(8.dp),
                    ) {
                        Column(Modifier.padding(10.dp)) {
                            Text(location.name, fontWeight = FontWeight.Bold)
                            Text(location.country, color = Muted, fontSize = 10.sp)
                        }
                    }
                }
                Button(
                    onClick = {
                        val supported = AppWidgetManager.getInstance(context).requestPinAppWidget(
                            ComponentName(context, WeatherWidgetProvider::class.java),
                            null,
                            null,
                        )
                        if (!supported) Toast.makeText(context, R.string.widget_pin_unavailable, Toast.LENGTH_LONG).show()
                    },
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(stringResource(R.string.add_widget)) }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text(stringResource(R.string.close)) } },
    )
}

@Composable
private fun AnalyticsConsentDialog(onConsent: (Boolean) -> Unit) {
    AlertDialog(
        onDismissRequest = {},
        title = { Text(stringResource(R.string.analytics_title), fontWeight = FontWeight.ExtraBold) },
        text = { Text(stringResource(R.string.analytics_message)) },
        dismissButton = {
            TextButton(onClick = { onConsent(false) }) {
                Text(stringResource(R.string.analytics_decline))
            }
        },
        confirmButton = {
            Button(onClick = { onConsent(true) }) {
                Text(stringResource(R.string.analytics_allow))
            }
        },
    )
}

private fun useLastKnownLocation(context: Context, onLocation: (Double, Double) -> Unit) {
    val manager = context.getSystemService(LocationManager::class.java)
    val location = runCatching {
        manager.getProviders(true).mapNotNull(manager::getLastKnownLocation).maxByOrNull { it.time }
    }.getOrNull()
    if (location == null) Toast.makeText(context, R.string.location_unavailable, Toast.LENGTH_LONG).show()
    else onLocation(location.latitude, location.longitude)
}

@Composable
private fun SettingSwitch(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, modifier = Modifier.weight(1f), fontSize = 12.sp)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun OptionButtons(options: List<Pair<String, String>>, selected: String, onSelect: (String) -> Unit) {
    Row(modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        options.forEach { (value, label) ->
            Button(
                onClick = { onSelect(value) },
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selected == value) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                ),
            ) { Text(label, fontSize = 10.sp) }
        }
    }
}

private fun updateThresholds(state: WeatherUiState, onChange: (ForecastDisplaySettings) -> Unit, thresholds: TemperatureThresholds) {
    onChange(state.displaySettings.copy(temperatureThresholds = thresholds))
}

@Composable
private fun ThresholdSlider(label: String, value: Float, range: ClosedFloatingPointRange<Float>, unit: String, onChange: (Float) -> Unit) {
    val displayed = if (unit == "F") value * 9f / 5f + 32f else value
    Column {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, fontSize = 10.sp)
            Text("${displayed.toInt()}°$unit", color = Muted, fontSize = 10.sp)
        }
        Slider(value = value, onValueChange = onChange, valueRange = range)
    }
}

@Composable
private fun LoadingState(modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            CircularProgressIndicator(modifier = Modifier.size(28.dp))
            Text(stringResource(R.string.loading_forecast), modifier = Modifier.padding(top = 12.dp), color = Muted, fontSize = 11.sp)
        }
    }
}

@Composable
private fun ErrorState(onRetry: () -> Unit, modifier: Modifier = Modifier) {
    Box(modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(stringResource(R.string.forecast_unavailable), fontWeight = FontWeight.Bold)
            Button(onClick = onRetry, modifier = Modifier.padding(top = 12.dp), colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.primary)) {
                Text(stringResource(R.string.retry))
            }
        }
    }
}

private fun HourlyWeather.dateTime(): LocalDateTime? = runCatching { LocalDateTime.parse(timestamp) }.getOrNull()

private fun temperatureText(value: Double?, unit: String = "C"): String = value?.let {
    "${(if (unit == "F") it * 9 / 5 + 32 else it).toInt()}°"
} ?: "-"

private fun temperatureColor(value: Double?): Color = when {
    value == null -> Muted
    value < -12 -> Color.White
    value < 0 -> Color(0xFF7F8996)
    value < 18 -> Color(0xFF2F91ED)
    value < 27 -> Color(0xFF45CF88)
    value < 32 -> Color(0xFFF28E3E)
    else -> Color(0xFFFF263F)
}

private fun String?.toColorOrNull(): Color? = runCatching {
    takeIf { it?.matches(Regex("^#[0-9A-Fa-f]{6}$")) == true }?.let { Color(parseColor(it)) }
}.getOrNull()
