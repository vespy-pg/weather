package eu.vespy.weather.ui

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color.parseColor
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.app.Activity
import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.location.LocationManager
import android.net.Uri
import android.widget.Toast
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.ScrollableDefaults
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.rememberScrollableState
import androidx.compose.foundation.gestures.scrollable
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
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
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
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
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
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
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
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalWindowInfo
import androidx.compose.ui.draw.clipToBounds
import androidx.compose.ui.zIndex
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.input.pointer.positionChange
import androidx.compose.ui.window.DialogWindowProvider
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import eu.vespy.weather.R
import eu.vespy.weather.data.HourlyWeather
import eu.vespy.weather.data.DailyWeather
import eu.vespy.weather.data.Promotion
import eu.vespy.weather.data.ForecastDisplaySettings
import eu.vespy.weather.data.TemperatureThresholds
import eu.vespy.weather.data.WeatherAlert
import eu.vespy.weather.data.WeatherForecast
import eu.vespy.weather.data.currentIndex
import eu.vespy.weather.data.groupByHours
import eu.vespy.weather.data.timelineWindow
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
import kotlin.math.acos
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt
import kotlin.math.sin

private val DarkColors = darkColorScheme(
    background = Color(0xFF080C12),
    surface = Color(0xFF111923),
    surfaceVariant = Color(0xFF0B1420),
    primary = Color(0xFF58A6FF),
    onPrimary = Color(0xFF07111E),
    secondary = Color(0xFF45CF88),
    onBackground = Color(0xFFE7EDF7),
    onSurface = Color(0xFFE7EDF7),
    onSurfaceVariant = Color(0xFF9AA8BA),
    outline = Color(0xFF3A5672),
)

private val LightColors = lightColorScheme(
    background = Color(0xFFEDF3F9),
    surface = Color.White,
    surfaceVariant = Color(0xFFF5F8FC),
    primary = Color(0xFF176FC1),
    onPrimary = Color.White,
    secondary = Color(0xFF23865A),
    onBackground = Color(0xFF172234),
    onSurface = Color(0xFF172234),
    onSurfaceVariant = Color(0xFF5B6B80),
    outline = Color(0xFF9AAFC4),
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
    var showSettings by rememberSaveable { mutableStateOf(false) }
    var recreateAfterSettingsClose by rememberSaveable { mutableStateOf(false) }
    val updateDisplaySettings: (ForecastDisplaySettings) -> Unit = { settings ->
        val languageChanged = settings.language != viewModel.state.displaySettings.language
        val historyChanged = settings.showHistoricalData != viewModel.state.displaySettings.showHistoricalData
        val mushroomsChanged = settings.showMushrooms != viewModel.state.displaySettings.showMushrooms
        viewModel.setDisplaySettings(settings)
        if (languageChanged) recreateAfterSettingsClose = true
        else if (historyChanged || mushroomsChanged) viewModel.refresh()
    }
    val dismissSettings: () -> Unit = {
        showSettings = false
        if (recreateAfterSettingsClose) {
            recreateAfterSettingsClose = false
            (context as? Activity)?.recreate()
        }
    }
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
                            onLocation = viewModel::selectLocation,
                            onRetry = viewModel::refresh,
                            onSettings = { showSettings = true },
                            onDisplaySettings = updateDisplaySettings,
                            darkTheme = darkTheme,
                            modifier = Modifier.weight(1f),
                        )
                        PromotionRail(
                            state.promotions,
                            state.promotionRotationSeconds,
                            landscape = true,
                            onImpression = viewModel::recordPromotionImpression,
                            onClick = viewModel::recordPromotionClick,
                            modifier = Modifier.width(190.dp).fillMaxHeight(),
                        )
                    }
                } else {
                    Column(modifier = Modifier.fillMaxSize()) {
                        ForecastPane(
                            state = state,
                            landscape = false,
                            onLocation = viewModel::selectLocation,
                            onRetry = viewModel::refresh,
                            onSettings = { showSettings = true },
                            onDisplaySettings = updateDisplaySettings,
                            darkTheme = darkTheme,
                            modifier = Modifier.weight(1f),
                        )
                        PromotionRail(
                            state.promotions,
                            state.promotionRotationSeconds,
                            landscape = false,
                            onImpression = viewModel::recordPromotionImpression,
                            onClick = viewModel::recordPromotionClick,
                            modifier = Modifier.fillMaxWidth().height(132.dp),
                        )
                    }
                }
                if (showSettings) SettingsDialog(
                    state = state,
                    onDismiss = dismissSettings,
                    onSelectLocation = viewModel::selectLocation,
                    onAddLocation = viewModel::addLocation,
                    onCurrentLocation = viewModel::addCurrentLocation,
                    onRemoveLocation = viewModel::removeLocation,
                    onTemperatureUnit = viewModel::setTemperatureUnit,
                    onDisplaySettings = updateDisplaySettings,
                    onAnalyticsConsent = viewModel::setAnalyticsConsent,
                    onResetDefaults = {
                        viewModel.setTemperatureUnit("C")
                        updateDisplaySettings(ForecastDisplaySettings())
                    },
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
    darkTheme: Boolean,
    modifier: Modifier = Modifier,
) {
    Column(
        modifier = modifier
            .statusBarsPadding()
            .padding(horizontal = if (landscape) 10.dp else 14.dp, vertical = 8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            LocationTitleDropdown(
                locations = state.locations,
                active = state.location,
                compact = landscape,
                onLocation = onLocation,
                onManage = onSettings,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            SettingsButton(onSettings)
        }

        when {
            state.loading && state.forecast == null -> LoadingState(Modifier.weight(1f))
            state.error != null && state.forecast == null -> ErrorState(onRetry, Modifier.weight(1f))
            state.forecast != null -> {
                Column(
                    modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()),
                    verticalArrangement = Arrangement.spacedBy(7.dp),
                ) {
                    state.forecast.alerts.firstOrNull()?.let { WeatherAlertBanner(it, landscape) }
                    ForecastCard(state.forecast, landscape, state.temperatureUnit, state.displaySettings, onDisplaySettings, darkTheme, state.demo)
                }
            }
        }
    }
}

@Composable
private fun WeatherAlertBanner(alert: WeatherAlert, compact: Boolean) {
    val uriHandler = LocalUriHandler.current
    val accent = when (alert.severity) {
        "extreme" -> Color(0xFFE5484D)
        "severe" -> Color(0xFFF47B32)
        else -> Color(0xFFE6B62F)
    }
    Surface(
        modifier = Modifier.fillMaxWidth().padding(top = 7.dp, bottom = 7.dp)
            .clickable(enabled = alert.sourceUrl.startsWith("https://")) { uriHandler.openUri(alert.sourceUrl) },
        shape = RoundedCornerShape(10.dp),
        border = androidx.compose.foundation.BorderStroke(2.dp, accent),
        color = MaterialTheme.colorScheme.surface,
    ) {
        Row(
            modifier = Modifier.padding(horizontal = if (compact) 10.dp else 14.dp, vertical = if (compact) 7.dp else 10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Box(Modifier.size(if (compact) 28.dp else 36.dp).background(accent, RoundedCornerShape(50)), contentAlignment = Alignment.Center) {
                Text("!", color = Color(0xFF111820), fontSize = if (compact) 18.sp else 23.sp, fontWeight = FontWeight.Black)
            }
            Column(Modifier.weight(1f).padding(start = 10.dp)) {
                Text(stringResource(R.string.weather_alert_label), color = accent, fontFamily = FontFamily.Monospace, fontSize = 8.sp, fontWeight = FontWeight.Black)
                Text(alert.headline, fontSize = if (compact) 11.sp else 14.sp, lineHeight = if (compact) 12.sp else 16.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                if (!compact) Text(alert.description ?: alert.instruction.orEmpty(), color = Muted, fontSize = 11.sp, lineHeight = 13.sp, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Text(stringResource(R.string.weather_alert_source, alert.source), color = MaterialTheme.colorScheme.primary, fontSize = 9.sp)
            }
        }
    }
}

@Composable
private fun LocationTitleDropdown(
    locations: List<eu.vespy.weather.data.WeatherLocation>,
    active: eu.vespy.weather.data.WeatherLocation,
    compact: Boolean,
    onLocation: (eu.vespy.weather.data.WeatherLocation) -> Unit,
    onManage: () -> Unit,
    modifier: Modifier = Modifier,
) {
    var expanded by remember { mutableStateOf(false) }
    Box(modifier.widthIn(max = if (compact) 420.dp else Dp.Infinity)) {
        Column(Modifier.fillMaxWidth().clickable { expanded = true }) {
            if (!compact) Text(
                text = stringResource(R.string.weather),
                color = MaterialTheme.colorScheme.primary,
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = 1.sp,
            )
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = active.name,
                    modifier = Modifier.weight(1f, fill = false),
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    fontSize = if (compact) 18.sp else 27.sp,
                    fontWeight = FontWeight.ExtraBold,
                )
                Text("▾", modifier = Modifier.padding(start = 7.dp, end = 4.dp), fontSize = if (compact) 13.sp else 16.sp)
            }
        }
        DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
            locations.forEach { location ->
                val selected = location.latitude == active.latitude && location.longitude == active.longitude
                DropdownMenuItem(
                    text = { Text(location.name, fontSize = 15.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                    onClick = {
                        expanded = false
                        onLocation(location)
                    },
                )
            }
            DropdownMenuItem(
                text = { Text("+ ${stringResource(R.string.saved_locations)}", fontSize = 15.sp) },
                onClick = {
                    expanded = false
                    onManage()
                },
            )
        }
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
private fun ForecastCard(
    forecast: WeatherForecast,
    landscape: Boolean,
    temperatureUnit: String,
    displaySettings: ForecastDisplaySettings,
    onDisplaySettings: (ForecastDisplaySettings) -> Unit,
    darkTheme: Boolean,
    demo: Boolean,
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
                modifier = Modifier.fillMaxWidth()
                    .heightIn(min = if (landscape) 44.dp else 58.dp)
                    .padding(horizontal = 10.dp, vertical = if (landscape) 3.dp else 6.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                ForecastSummaryHeader(forecast, landscape, Modifier.weight(1f).padding(end = 8.dp))
                ZoomControls(displaySettings, onDisplaySettings, large = false)
            }
            ForecastTimeline(forecast, landscape, temperatureUnit, displaySettings, onDisplaySettings, darkTheme, demo)
        }
    }
}

@Composable
private fun ForecastSummaryHeader(forecast: WeatherForecast, compact: Boolean, modifier: Modifier = Modifier) {
    val summaryText = forecastSummaryText(LocalContext.current, forecast)
    Column(modifier) {
        Text(
            stringResource(R.string.forecast_summary_label),
            color = MaterialTheme.colorScheme.primary,
            fontFamily = FontFamily.Monospace,
            fontSize = if (compact) 7.sp else 8.sp,
            fontWeight = FontWeight.Black,
            letterSpacing = .7.sp,
        )
        Text(summaryText, fontSize = if (compact) 11.sp else 13.sp, lineHeight = if (compact) 12.sp else 15.sp, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun ZoomControls(settings: ForecastDisplaySettings, onChange: (ForecastDisplaySettings) -> Unit, large: Boolean = false) {
    val levels = listOf(.25f, .3f, .5f, .75f, 1f, 2f)
    val index = levels.indexOf(settings.zoom).coerceAtLeast(2)
    val buttonSize = if (large) 48.dp else 34.dp
    val valueWidth = if (large) 74.dp else 52.dp
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(if (large) 8.dp else 5.dp)) {
        ZoomButton("-", index > 0, buttonSize, if (large) 22 else 17) { onChange(settings.copy(zoom = levels[index - 1])) }
        Box(
            Modifier.height(buttonSize).width(valueWidth).clickable { onChange(settings.copy(zoom = .5f)) }
                .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .35f), RoundedCornerShape(if (large) 10.dp else 5.dp)),
            contentAlignment = Alignment.Center,
        ) { Text("${(settings.zoom * 100).roundToInt()}%", color = Muted, fontSize = if (large) 16.sp else 11.sp, fontWeight = FontWeight.Bold) }
        ZoomButton("+", index < levels.lastIndex, buttonSize, if (large) 22 else 17) { onChange(settings.copy(zoom = levels[index + 1])) }
    }
}

@Composable
private fun ZoomButton(label: String, enabled: Boolean, size: Dp, fontSize: Int, onClick: () -> Unit) {
    Box(
        Modifier.size(size).clickable(enabled = enabled, onClick = onClick)
            .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = if (enabled) .35f else .15f), RoundedCornerShape(if (size > 30.dp) 10.dp else 5.dp)),
        contentAlignment = Alignment.Center,
    ) { Text(label, color = if (enabled) MaterialTheme.colorScheme.onSurface else Muted.copy(alpha = .35f), fontSize = fontSize.sp, fontWeight = FontWeight.Bold) }
}

@Composable
private fun ForecastTimeline(
    forecast: WeatherForecast,
    landscape: Boolean,
    temperatureUnit: String,
    settings: ForecastDisplaySettings,
    onDisplaySettings: (ForecastDisplaySettings) -> Unit,
    dark: Boolean,
    demo: Boolean,
) {
    val groupHours = when (settings.zoom) { .25f -> 12; .3f -> 6; .5f -> 4; .75f -> 3; 1f -> 2; else -> 1 }
    val hourly = remember(forecast.hourly, forecast.current.timestamp, settings.showHistoricalData) {
        forecast.hourly.timelineWindow(forecast.current.timestamp, 10, if (settings.showHistoricalData) 3 else 0)
    }
    val points = remember(hourly, groupHours) { hourly.groupByHours(groupHours) }
    val temperatureRange = remember(points, settings.showApparentTemperature) {
        points.flatMap { point ->
            if (settings.showApparentTemperature) listOfNotNull(point.temperature, point.apparentTemperature) else listOfNotNull(point.temperature)
        }.takeIf { it.isNotEmpty() }?.let { (it.min() - 3.0) to (it.max() + 3.0) }
    }
    val slotWidth = 22.dp * settings.zoom * groupHours
    val trackWidth = slotWidth * max(1, points.size)
    val mushroomHeight = if (settings.showMushrooms) (if (landscape) 34.dp else 44.dp) else 0.dp
    val timelineHeight = (if (landscape) 290.dp else 368.dp) + mushroomHeight
    val labelHeight = 72.dp
    val skyHeight = if (landscape) 62.dp else 93.dp
    val windHeight = if (!settings.showWind) 0.dp else if (settings.showWindArrows) {
        if (landscape) 48.dp else 60.dp
    } else if (landscape) 34.dp else 45.dp
    val todayLabel = stringResource(R.string.today)
    val historyLabel = stringResource(R.string.history)
    val legendWidth = if (landscape) 38.dp else 44.dp
    val densityContext = LocalDensity.current
    val slotWidthPx = with(densityContext) { slotWidth.toPx() }
    val nowIndex = remember(points, forecast.current.timestamp) { points.currentIndex(forecast.current.timestamp).coerceAtLeast(0) }
    val nowPosition = if (settings.showHistoricalData) nowIndex * slotWidthPx else 0f
    var position by remember(points, settings.zoom, settings.showHistoricalData) { mutableFloatStateOf(nowPosition) }
    var focusedDate by remember(points, nowIndex) { mutableStateOf(points.getOrNull(nowIndex)?.timestamp?.take(10)) }
    var zoomAnchorTimestamp by remember { mutableStateOf<String?>(null) }
    Column {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(timelineHeight).clipToBounds()) {
        val viewportPx = with(densityContext) { maxWidth.toPx() }
        val contentPx = with(densityContext) { (legendWidth + trackWidth).toPx() }
        val maxPosition = (contentPx - viewportPx).coerceAtLeast(0f)
        val legendWidthPx = with(densityContext) { legendWidth.toPx() }
        fun pointIndexAtViewportCenter(): Int = ((position + viewportPx / 2f - legendWidthPx) / slotWidthPx)
            .toInt().coerceIn(0, points.lastIndex)
        fun firstVisiblePointIndex(): Int = ((position - legendWidthPx) / slotWidthPx)
            .toInt().coerceIn(0, points.lastIndex)
        fun detailsPointIndex(): Int = (firstVisiblePointIndex() + 1).coerceAtMost(points.lastIndex)
        LaunchedEffect(position, viewportPx, slotWidthPx, legendWidthPx, points) {
            focusedDate = points.getOrNull(detailsPointIndex())?.timestamp?.take(10)
        }
        LaunchedEffect(settings.zoom, zoomAnchorTimestamp, viewportPx, points) {
            val anchor = zoomAnchorTimestamp ?: return@LaunchedEffect
            val anchorIndex = points.indexOfLast { it.timestamp <= anchor }.coerceAtLeast(0)
            position = (legendWidthPx + (anchorIndex + .5f) * slotWidthPx - viewportPx / 2f).coerceIn(0f, maxPosition)
            zoomAnchorTimestamp = null
        }
        val pinchModifier = Modifier.pointerInput(points, settings.zoom) {
            awaitEachGesture {
                var previousDistance: Float? = null
                var accumulatedZoom = 1f
                do {
                    val event = awaitPointerEvent()
                    val fingers = event.changes.filter { it.pressed }
                    if (fingers.size >= 2) {
                        val distance = (fingers[0].position - fingers[1].position).getDistance()
                        previousDistance?.takeIf { it > 0f }?.let { previous ->
                            accumulatedZoom *= distance / previous
                            val levels = listOf(.25f, .3f, .5f, .75f, 1f, 2f)
                            val index = levels.indexOf(settings.zoom).coerceAtLeast(0)
                            val nextIndex = when {
                                accumulatedZoom >= 1.12f -> (index + 1).coerceAtMost(levels.lastIndex)
                                accumulatedZoom <= .88f -> (index - 1).coerceAtLeast(0)
                                else -> index
                            }
                            if (nextIndex != index) {
                                zoomAnchorTimestamp = points[pointIndexAtViewportCenter()].timestamp
                                onDisplaySettings(settings.copy(zoom = levels[nextIndex]))
                                accumulatedZoom = 1f
                            }
                        }
                        previousDistance = distance
                    } else {
                        previousDistance = null
                        accumulatedZoom = 1f
                    }
                } while (event.changes.any { it.pressed })
            }
        }
        val dayHeaderModifier = Modifier.pointerInput(points, position, slotWidthPx, legendWidthPx, viewportPx) {
            detectTapGestures { tap ->
                if (tap.y > labelHeight.toPx()) return@detectTapGestures
                val pointIndex = ((position + tap.x - legendWidthPx) / slotWidthPx).toInt().coerceIn(0, points.lastIndex)
                val date = points[pointIndex].timestamp.take(10)
                val dayStart = points.indexOfFirst { it.timestamp.take(10) == date }
                val nextDayStart = ((dayStart + 1) until points.size).firstOrNull { points[it].timestamp.take(10) != date }
                    ?: points.size
                if (pointIndex in dayStart until min(dayStart + 3, nextDayStart)) {
                    focusedDate = date
                    position = (legendWidthPx + dayStart * slotWidthPx).coerceIn(0f, maxPosition)
                }
            }
        }
        val scrollableState = rememberScrollableState { delta ->
            val oldPosition = position
            position = (oldPosition - delta).coerceIn(0f, maxPosition)
            oldPosition - position
        }
        Box(
            modifier = Modifier.fillMaxSize()
                .scrollable(scrollableState, Orientation.Horizontal, flingBehavior = ScrollableDefaults.flingBehavior())
                .then(pinchModifier)
                .then(dayHeaderModifier),
        ) {
            Canvas(
                modifier = Modifier.fillMaxSize(),
            ) {
            val nativeCanvas = drawContext.canvas.nativeCanvas
            val firstVisible = ((position - legendWidthPx) / slotWidthPx).toInt().coerceAtLeast(0)
            val bufferedStart = (firstVisible - 2).coerceAtLeast(0)
            val visibleCount = (size.width / slotWidthPx).toInt() + 5
            val bufferedEnd = (bufferedStart + visibleCount).coerceAtMost(points.size)
            val visiblePoints = points.subList(bufferedStart, bufferedEnd)
            val visibleLeft = legendWidthPx + bufferedStart * slotWidthPx
            nativeCanvas.save()
            nativeCanvas.translate(-position, 0f)
            ForecastGraphics.drawTimeline(
                canvas = nativeCanvas,
                bounds = android.graphics.RectF(visibleLeft, 0f, visibleLeft + visiblePoints.size * slotWidthPx, size.height),
                points = visiblePoints,
                days = forecast.daily,
                dark = dark,
                todayLabel = todayLabel,
                labelHeight = labelHeight.toPx(),
                skyHeight = skyHeight.toPx(),
                windHeight = windHeight.toPx(),
                mushroomHeight = mushroomHeight.toPx(),
                temperatureUnit = temperatureUnit,
                pixelScale = density,
                textScale = 1.6f,
                precipitationScale = 1.8f,
                showWeekdayNames = true,
                fullWeekdayNames = true,
                dayLabelTextSize = 16f * density,
                hourTextSize = 13f * density,
                temperatureTextSize = 24f * density * settings.temperatureTextScale,
                windScale = 1.22f,
                showTemperatureValues = settings.showHourlyTemperatures,
                showApparentTemperature = settings.showApparentTemperature,
                showPrecipitation = settings.showPrecipitation,
                showWind = false,
                showWindArrows = false,
                temperatureThresholds = settings.temperatureThresholds,
                currentTimestamp = forecast.current.timestamp,
                showDates = settings.showDates,
                showHistory = settings.showHistoricalData,
                historyLabel = historyLabel,
                showMushrooms = settings.showMushrooms,
                temperatureMinimum = temperatureRange?.first,
                temperatureMaximum = temperatureRange?.second,
                demoLabel = "DEMO".takeIf { demo },
                demoEveryDay = demo,
                pointOffset = bufferedStart,
            )
            if (settings.showWind && windHeight.toPx() > 0f) {
                ForecastGraphics.drawWindLayer(
                    canvas = nativeCanvas,
                    bounds = android.graphics.RectF(
                        legendWidthPx,
                        size.height - windHeight.toPx() - mushroomHeight.toPx(),
                        legendWidthPx + trackWidth.toPx(),
                        size.height - mushroomHeight.toPx(),
                    ),
                    points = points,
                    dark = dark,
                    pixelScale = density,
                    windScale = 1.22f,
                    showAnnotations = settings.showWindArrows,
                )
            }
            nativeCanvas.restore()
            }
            val legendOffset = if (settings.showHistoricalData) -max(0f, position - nowPosition) else 0f
            Canvas(
                modifier = Modifier.width(legendWidth).fillMaxHeight()
                    .offset { IntOffset(legendOffset.roundToInt(), 0) }
                    .zIndex(2f),
            ) {
                ForecastGraphics.drawLegend(
                    canvas = drawContext.canvas.nativeCanvas,
                    bounds = android.graphics.RectF(0f, 0f, size.width, size.height),
                    dark = dark,
                    labelHeight = labelHeight.toPx(),
                    skyHeight = skyHeight.toPx(),
                    windHeight = windHeight.toPx(),
                    mushroomHeight = mushroomHeight.toPx(),
                    pixelScale = density,
                )
            }
        }
    }
        focusedDate?.let { date ->
            ForecastDayBrief(
                date = date,
                points = hourly.filter { it.timestamp.take(10) == date },
                daily = forecast.daily.firstOrNull { it.date == date },
                latitude = forecast.location.latitude,
                temperatureUnit = temperatureUnit,
                compact = landscape,
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
private fun ForecastDayBrief(
    date: String,
    points: List<HourlyWeather>,
    daily: DailyWeather?,
    latitude: Double,
    temperatureUnit: String,
    compact: Boolean,
) {
    if (points.isEmpty()) return
    val context = LocalContext.current
    val locale = context.resources.configuration.locales[0]
    val title = runCatching {
        LocalDate.parse(date).format(DateTimeFormatter.ofLocalizedDate(FormatStyle.FULL).withLocale(locale))
    }.getOrDefault(date)
    val temperatures = points.mapNotNull(HourlyWeather::temperature)
    val apparent = points.mapNotNull(HourlyWeather::apparentTemperature)
    val precipitation = daily?.precipitation ?: points.sumOf { it.precipitation ?: 0.0 }
    val rainProbability = daily?.precipitationProbability ?: points.mapNotNull(HourlyWeather::precipitationProbability).maxOrNull()
    val wetHours = points.count { (it.precipitation ?: 0.0) > 0.05 }
    val cloudCover = points.mapNotNull(HourlyWeather::cloudCover).averageOrNull()
    val humidity = points.mapNotNull(HourlyWeather::relativeHumidity).averageOrNull()
    val pressure = points.mapNotNull(HourlyWeather::surfacePressure).averageOrNull()
    val visibility = points.mapNotNull(HourlyWeather::visibility).minOrNull()
    val peakWind = daily?.windSpeedMaximum ?: points.maxOfOrNull { it.windSpeed ?: 0.0 }
    val peakGust = daily?.windGustsMaximum ?: points.maxOfOrNull { it.windGusts ?: 0.0 }
    val sunrise = daily?.sunrise?.let(::clockTime) ?: "-"
    val sunset = daily?.sunset?.let(::clockTime) ?: "-"
    val dayLength = daily?.daylightDuration ?: estimatedDaylightSeconds(date, latitude)
    val shortestDay = estimatedDaylightSeconds("${LocalDate.parse(date).year}-12-21", latitude)
    val longestDay = estimatedDaylightSeconds("${LocalDate.parse(date).year}-06-21", latitude)
    val shortest = min(shortestDay, longestDay)
    val longest = max(shortestDay, longestDay)
    Surface(
        modifier = Modifier.fillMaxWidth().padding(horizontal = if (compact) 6.dp else 8.dp, vertical = 8.dp),
        shape = RoundedCornerShape(9.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .32f)),
    ) {
        Column(modifier = Modifier.padding(horizontal = 10.dp, vertical = 8.dp)) {
            Text(
                stringResource(R.string.day_brief),
                color = MaterialTheme.colorScheme.primary,
                fontFamily = FontFamily.Monospace,
                fontSize = 8.sp,
                fontWeight = FontWeight.Black,
                letterSpacing = .7.sp,
            )
            Text(title, fontSize = if (compact) 16.sp else 20.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(stringResource(R.string.day_brief_context), color = Muted, fontSize = 11.sp, modifier = Modifier.padding(top = 2.dp))
            DayBriefSection(stringResource(R.string.day_brief_temperature)) {
                DayBriefTemperatureRow(
                    stringResource(R.string.low_high), daily?.temperatureMinimum ?: temperatures.minOrNull(), daily?.temperatureMaximum ?: temperatures.maxOrNull(),
                    stringResource(R.string.apparent_range), daily?.apparentTemperatureMinimum ?: apparent.minOrNull(), daily?.apparentTemperatureMaximum ?: apparent.maxOrNull(),
                    temperatureUnit,
                )
            }
            DayBriefSection(stringResource(R.string.day_brief_rain)) {
                DayBriefRow(stringResource(R.string.rain_total), String.format(locale, "%.1f mm", precipitation), stringResource(R.string.rain_chance), rainProbability?.let { "${it.toInt()}%" } ?: "-", Color(0xFF4AA3FF), Color(0xFF4AA3FF))
                DayBriefRow(stringResource(R.string.wet_hours), "$wetHours h", stringResource(R.string.cloud_cover), cloudCover?.let { "${it.toInt()}%" } ?: "-", Color(0xFF4AA3FF), Color(0xFF94A4B8))
            }
            DayBriefSection(stringResource(R.string.day_brief_air)) {
                DayBriefRow(stringResource(R.string.peak_wind), peakWind?.let { "${it.toInt()} km/h" } ?: "-", stringResource(R.string.wind_gusts), peakGust?.let { "${it.toInt()} km/h" } ?: "-", windColor(peakWind), windColor(peakGust))
                DayBriefRow(stringResource(R.string.humidity), humidity?.let { "${it.toInt()}%" } ?: "-", stringResource(R.string.pressure), pressure?.let { "${it.toInt()} hPa" } ?: "-", Color(0xFF4AA3FF), Color(0xFFB1C6DA))
                DayBriefRow(stringResource(R.string.visibility), visibility?.let { String.format(locale, "%.1f km", it / 1000) } ?: "-", stringResource(R.string.wind_direction), daily?.windDirection?.let(::windDirectionText) ?: "-", Color(0xFF64D5C2), ChartWind)
            }
            DayBriefSection(stringResource(R.string.day_brief_sun)) {
                SunlightComparison(daily?.sunrise, daily?.sunset, dayLength, shortest, longest)
                DayBriefRow(stringResource(R.string.daylight), durationText(dayLength), stringResource(R.string.sunshine), durationText(daily?.sunshineDuration), Color(0xFFFFC83D), Color(0xFFFFA928))
                DayBriefRow(stringResource(R.string.uv_max), daily?.uvIndexMaximum?.let { String.format(locale, "%.1f", it) } ?: "-", stringResource(R.string.sun_window), "$sunrise - $sunset", uvColor(daily?.uvIndexMaximum), Color(0xFFFFC83D))
            }
            DayBriefSection(stringResource(R.string.day_brief_pollen)) {
                val pollen = daily?.pollen
                if (pollen == null) Text(stringResource(R.string.pollen_unavailable), color = Muted, fontSize = 12.sp)
                else PollenChart(listOf(
                    stringResource(R.string.pollen_alder) to pollen.alder,
                    stringResource(R.string.pollen_birch) to pollen.birch,
                    stringResource(R.string.pollen_grass) to pollen.grass,
                    stringResource(R.string.pollen_mugwort) to pollen.mugwort,
                    stringResource(R.string.pollen_olive) to pollen.olive,
                    stringResource(R.string.pollen_ragweed) to pollen.ragweed,
                ))
            }
        }
    }
}

@Composable
private fun DayBriefSection(title: String, content: @Composable () -> Unit) {
    Column(modifier = Modifier.padding(top = 14.dp)) {
        Text(title, color = MaterialTheme.colorScheme.primary, fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Black, letterSpacing = .6.sp)
        Column(modifier = Modifier.padding(top = 6.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) { content() }
    }
}

@Composable
private fun DayBriefRow(leftLabel: String, leftValue: String, rightLabel: String, rightValue: String, leftColor: Color = Color.Unspecified, rightColor: Color = Color.Unspecified) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        DayBriefMetric(leftLabel, leftValue, Modifier.weight(1f), leftColor)
        DayBriefMetric(rightLabel, rightValue, Modifier.weight(1f), rightColor)
    }
}

@Composable
private fun DayBriefMetric(label: String, value: String, modifier: Modifier = Modifier, valueColor: Color = Color.Unspecified) {
    Column(modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 8.dp)) {
        Text(label, color = Muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(value, color = valueColor, fontSize = 17.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun DayBriefTemperatureRow(leftLabel: String, leftLow: Double?, leftHigh: Double?, rightLabel: String, rightLow: Double?, rightHigh: Double?, unit: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        DayBriefTemperatureMetric(leftLabel, leftLow, leftHigh, unit, Modifier.weight(1f))
        DayBriefTemperatureMetric(rightLabel, rightLow, rightHigh, unit, Modifier.weight(1f))
    }
}

@Composable
private fun DayBriefTemperatureMetric(label: String, low: Double?, high: Double?, unit: String, modifier: Modifier = Modifier) {
    Column(modifier = modifier.background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(horizontal = 10.dp, vertical = 8.dp)) {
        Text(label, color = Muted, fontSize = 11.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(temperatureText(low, unit), color = temperatureColor(low), fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(" / ", color = Muted, fontSize = 17.sp, fontWeight = FontWeight.Bold)
            Text(temperatureText(high, unit), color = temperatureColor(high), fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun SunlightComparison(sunrise: String?, sunset: String?, dayLength: Double, shortestDay: Double, longestDay: Double) {
    val sunriseMinutes = clockMinutes(sunrise) ?: return
    val sunsetMinutes = clockMinutes(sunset) ?: return
    val shortestDifference = ((dayLength - shortestDay).coerceAtLeast(0.0) / 120).toInt()
    val longestDifference = ((longestDay - dayLength).coerceAtLeast(0.0) / 120).toInt()
    val rows = listOf(
        Triple(stringResource(R.string.shortest_day), sunriseMinutes + shortestDifference, sunsetMinutes - shortestDifference),
        Triple(stringResource(R.string.selected_day), sunriseMinutes, sunsetMinutes),
        Triple(stringResource(R.string.longest_day), sunriseMinutes - longestDifference, sunsetMinutes + longestDifference),
    )
    Column(
        modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
        rows.forEachIndexed { index, (label, rise, set) -> SunlightRow(label, rise, set, emphasized = index == 1) }
        Text(stringResource(R.string.sunrise_difference, durationText(shortestDifference * 60.0), durationText(longestDifference * 60.0)), color = Muted, fontSize = 10.sp)
        Text(stringResource(R.string.sunset_difference, durationText(shortestDifference * 60.0), durationText(longestDifference * 60.0)), color = Muted, fontSize = 10.sp)
    }
}

@Composable
private fun SunlightRow(label: String, sunriseMinutes: Int, sunsetMinutes: Int, emphasized: Boolean) {
    val color = if (emphasized) Color(0xFFFFC83D) else Color(0xFF8D98AA)
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = if (emphasized) MaterialTheme.colorScheme.onSurface else Muted, fontSize = 11.sp, modifier = Modifier.width(76.dp), maxLines = 1)
        Text(formatClockMinutes(sunriseMinutes), color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(42.dp))
        BoxWithConstraints(modifier = Modifier.weight(1f).height(16.dp)) {
            val start = sunriseMinutes.coerceIn(0, 1440) / 1440f
            val end = sunsetMinutes.coerceIn(0, 1440) / 1440f
            Box(Modifier.fillMaxWidth().height(3.dp).align(Alignment.Center).background(Muted.copy(alpha = .18f), RoundedCornerShape(2.dp)))
            Box(Modifier.fillMaxWidth((end - start).coerceAtLeast(0f)).height(if (emphasized) 6.dp else 4.dp).align(Alignment.CenterStart).offset(x = maxWidth * start).background(color, RoundedCornerShape(3.dp)))
            Box(Modifier.size(if (emphasized) 10.dp else 7.dp).align(Alignment.CenterStart).offset(x = maxWidth * start - if (emphasized) 5.dp else 3.5.dp).background(color, RoundedCornerShape(50)))
            Box(Modifier.size(if (emphasized) 10.dp else 7.dp).align(Alignment.CenterStart).offset(x = maxWidth * end - if (emphasized) 5.dp else 3.5.dp).background(color, RoundedCornerShape(50)))
        }
        Text(formatClockMinutes(sunsetMinutes), color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(42.dp), maxLines = 1)
    }
}

@Composable
private fun PollenChart(values: List<Pair<String, Double?>>) {
    val maximum = values.mapNotNull { it.second }.maxOrNull()?.coerceAtLeast(1.0) ?: 1.0
    Column(
        modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        values.forEach { (label, value) ->
            val color = pollenColor(value)
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(label, color = Muted, fontSize = 11.sp, modifier = Modifier.width(68.dp), maxLines = 1, overflow = TextOverflow.Ellipsis)
                Box(Modifier.weight(1f).height(8.dp).background(Muted.copy(alpha = .18f), RoundedCornerShape(4.dp))) {
                    Box(Modifier.fillMaxWidth(((value ?: 0.0) / maximum).toFloat().coerceIn(0f, 1f)).fillMaxHeight().background(color, RoundedCornerShape(4.dp)))
                }
                Text(pollenValue(value), color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(82.dp).padding(start = 8.dp), maxLines = 1)
            }
        }
    }
}

private fun List<Double>.averageOrNull(): Double? = takeIf { it.isNotEmpty() }?.average()

@Composable
private fun durationText(seconds: Double?): String {
    val minutes = ((seconds ?: 0.0) / 60).toInt().coerceAtLeast(0)
    return stringResource(R.string.duration_hours_minutes, minutes / 60, minutes % 60)
}

@Composable
private fun pollenValue(value: Double?): String = value?.let { "${String.format(Locale.getDefault(), "%.1f", it)} ${stringResource(R.string.pollen_unit)}" } ?: "-"

private fun windColor(value: Double?): Color = when {
    value == null -> Muted
    value < 12 -> Color(0xFF55CF8A)
    value < 30 -> Color(0xFFFFC83D)
    value < 50 -> Color(0xFFFF8A3D)
    else -> Color(0xFFFF4055)
}

private fun uvColor(value: Double?): Color = when {
    value == null -> Muted
    value < 3 -> Color(0xFF55CF8A)
    value < 6 -> Color(0xFFFFC83D)
    value < 8 -> Color(0xFFFF8A3D)
    else -> Color(0xFFFF4055)
}

private fun pollenColor(value: Double?): Color = when {
    value == null || value <= 0 -> Muted
    value < 1 -> Color(0xFF55CF8A)
    value < 10 -> Color(0xFFFFC83D)
    value < 50 -> Color(0xFFFF8A3D)
    else -> Color(0xFFFF4055)
}

private fun windDirectionText(degrees: Double): String = listOf("N", "NE", "E", "SE", "S", "SW", "W", "NW")[((degrees + 22.5) / 45).toInt() % 8]

private fun estimatedDaylightSeconds(date: String, latitude: Double): Double {
    val day = runCatching { LocalDate.parse(date).dayOfYear }.getOrDefault(172)
    val latitudeRadians = Math.toRadians(latitude.coerceIn(-89.8, 89.8))
    val declination = Math.toRadians(-23.44 * cos(2 * PI * (day + 10) / 365.25))
    val horizon = Math.toRadians(-.833)
    val hourAngle = ((sin(horizon) - sin(latitudeRadians) * sin(declination)) / (cos(latitudeRadians) * cos(declination))).coerceIn(-1.0, 1.0)
    return 24 * acos(hourAngle) / PI * 3600
}

private fun clockTime(timestamp: String): String = runCatching {
    LocalDateTime.parse(timestamp).format(DateTimeFormatter.ofPattern("HH:mm"))
}.getOrDefault("-")

private fun clockMinutes(timestamp: String?): Int? = timestamp?.let {
    runCatching { LocalDateTime.parse(it).let { time -> time.hour * 60 + time.minute } }.getOrNull()
}

private fun formatClockMinutes(minutes: Int): String {
    val normalized = minutes.coerceIn(0, 1439)
    return "%02d:%02d".format(Locale.US, normalized / 60, normalized % 60)
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
    val foreground = if (background.luminance() < .45f) Color.White else Color(0xFF172234)
    val secondaryForeground = foreground.copy(alpha = .68f)
    val density = LocalDensity.current
    val navigationLift = if (landscape) 0.dp else with(density) { WindowInsets.navigationBars.getBottom(this).toDp() }
    Box(modifier = modifier) {
        Box(
            modifier = Modifier.fillMaxSize()
                .offset(y = -navigationLift)
                .background(background)
                .pointerInput(promotion.id, promotion.targetUrl) {
                    awaitEachGesture {
                        val down = awaitFirstDown(requireUnconsumed = false)
                        var totalMovement = Offset.Zero
                        var released = false
                        while (!released) {
                            val event = awaitPointerEvent()
                            val change = event.changes.firstOrNull { it.id == down.id } ?: break
                            totalMovement += change.positionChange()
                            if (!change.pressed) {
                                released = true
                                if (!change.isConsumed && totalMovement.getDistance() <= viewConfiguration.touchSlop) {
                                    onClick(promotion.id)
                                    uriHandler.openUri(promotion.targetUrl)
                                }
                            }
                        }
                    }
                }
                .padding(if (landscape) 14.dp else 9.dp),
            contentAlignment = Alignment.Center,
        ) {
            if (promotion.type == "image-banner" && promotion.imageUrl != null) {
                RemotePromotionImage(promotion.imageUrl, promotion.imageAlt.orEmpty(), Modifier.fillMaxSize())
            } else if (landscape) {
                Column(horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
                    Text(promotion.eyebrow, color = secondaryForeground, fontFamily = FontFamily.Monospace, fontSize = 13.sp, fontWeight = FontWeight.Black)
                    Spacer(Modifier.height(18.dp))
                    PromotionLogo(promotion, accent, Modifier.size(86.dp))
                    Spacer(Modifier.height(18.dp))
                    Text(promotion.title, color = foreground, fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                    Text(promotion.description, modifier = Modifier.padding(top = 12.dp), color = foreground.copy(alpha = .86f), fontSize = 18.sp, lineHeight = 24.sp, maxLines = 8, overflow = TextOverflow.Ellipsis)
                    Spacer(Modifier.height(22.dp))
                    PromotionAction(promotion.actionLabel, accent, 15)
                }
            } else {
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                    PromotionLogo(promotion, accent, Modifier.size(82.dp))
                    Column(Modifier.weight(1f)) {
                        Text(promotion.title, color = foreground, fontSize = 22.sp, fontWeight = FontWeight.ExtraBold)
                        Text(promotion.description, color = foreground.copy(alpha = .9f), fontSize = 16.sp, lineHeight = 20.sp, maxLines = 4, overflow = TextOverflow.Ellipsis)
                    }
                    PromotionAction(promotion.actionLabel, accent, 14)
                }
            }
        }
    }
}

@Composable
private fun PromotionAction(label: String, accent: Color, fontSize: Int = 12) {
    val contentColor = if (accent.luminance() > .5f) Color(0xFF17100B) else Color.White
    val windowWidth = LocalWindowInfo.current.containerSize.width
    val narrowScreen = with(LocalDensity.current) { windowWidth.toDp() < 420.dp }
    Surface(
        modifier = Modifier.widthIn(max = if (narrowScreen) 120.dp else 180.dp),
        color = accent,
        contentColor = contentColor,
        shape = RoundedCornerShape(8.dp),
    ) {
        Text(
            label,
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 9.dp),
            fontSize = fontSize.sp,
            lineHeight = (fontSize + 2).sp,
            fontWeight = FontWeight.Black,
            maxLines = 2,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
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
    onDismiss: () -> Unit,
    onSelectLocation: (eu.vespy.weather.data.WeatherLocation) -> Unit,
    onAddLocation: (eu.vespy.weather.data.WeatherLocation) -> Unit,
    onCurrentLocation: (Double, Double) -> Unit,
    onRemoveLocation: (eu.vespy.weather.data.WeatherLocation) -> Unit,
    onTemperatureUnit: (String) -> Unit,
    onDisplaySettings: (ForecastDisplaySettings) -> Unit,
    onAnalyticsConsent: (Boolean) -> Unit,
    onResetDefaults: () -> Unit,
) {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    var showIssueReport by remember { mutableStateOf(false) }
    var reportScreenshot by remember { mutableStateOf<Bitmap?>(null) }
    val permissionLauncher = rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (granted) useLastKnownLocation(context, onCurrentLocation)
        else Toast.makeText(context, R.string.location_permission_denied, Toast.LENGTH_LONG).show()
    }
    Dialog(
        onDismissRequest = onDismiss,
        properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
    ) {
        HideDialogNavigation()
        Surface(
            modifier = Modifier.fillMaxSize(),
            color = MaterialTheme.colorScheme.background,
            tonalElevation = 0.dp,
        ) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                Column(Modifier.fillMaxWidth().padding(horizontal = 20.dp, vertical = 16.dp)) {
                Text(
                    stringResource(R.string.weather).uppercase(),
                    color = MaterialTheme.colorScheme.primary,
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.Black,
                    letterSpacing = 1.2.sp,
                )
                Text(stringResource(R.string.settings), fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
                }
                Column(
                modifier = Modifier.weight(1f).fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                WeatherSettingsSection(stringResource(R.string.saved_locations)) {
                    LocationControls(
                        locations = state.locations,
                        selectedLocation = state.location,
                        onSelectLocation = onSelectLocation,
                        onSearchResult = onAddLocation,
                        onShareLocation = { shareLocation(context, it, state.displaySettings.language) },
                        onRemoveLocation = onRemoveLocation,
                    )
                    Button(
                        onClick = {
                            if (context.checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                                useLastKnownLocation(context, onCurrentLocation)
                            } else permissionLauncher.launch(Manifest.permission.ACCESS_COARSE_LOCATION)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = WeatherFieldShape,
                    ) { Text(stringResource(R.string.use_device_location)) }
                }
                WeatherSettingsSection(stringResource(R.string.app_appearance_section)) {
                    WeatherSupportingText(stringResource(R.string.language))
                    OptionButtons(
                        options = listOf("system" to stringResource(R.string.system_default), "en-US" to "English", "pl-PL" to "Polski"),
                        selected = state.displaySettings.language,
                    ) { onDisplaySettings(state.displaySettings.copy(language = it)) }
                    WeatherSupportingText(stringResource(R.string.color_theme))
                    OptionButtons(
                        options = listOf(
                            "system" to stringResource(R.string.system_default),
                            "dark" to stringResource(R.string.dark_theme),
                            "light" to stringResource(R.string.light_theme),
                        ),
                        selected = state.displaySettings.theme,
                    ) { onDisplaySettings(state.displaySettings.copy(theme = it)) }
                }
                WeatherSettingsSection(stringResource(R.string.app_temperature_section)) {
                    WeatherSupportingText(stringResource(R.string.temperature_unit))
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        listOf("C", "F").forEach { unit ->
                            Button(
                                onClick = { onTemperatureUnit(unit) },
                                shape = WeatherFieldShape,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (state.temperatureUnit == unit) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = if (state.temperatureUnit == unit) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                                ),
                            ) { Text("°$unit") }
                        }
                    }
                    WeatherSupportingText(stringResource(R.string.temperature_text_size))
                    TemperatureTextSizeDropdown(state.displaySettings.temperatureTextScale) {
                        onDisplaySettings(state.displaySettings.copy(temperatureTextScale = it))
                    }
                    WeatherSupportingText(stringResource(R.string.temperature_color_thresholds))
                    ThresholdSlider(stringResource(R.string.deep_frost), state.displaySettings.temperatureThresholds.deepFrost, -30f..-1f, state.temperatureUnit) { value -> updateThresholds(state, onDisplaySettings, state.displaySettings.temperatureThresholds.copy(deepFrost = value)) }
                    ThresholdSlider(stringResource(R.string.mild), state.displaySettings.temperatureThresholds.mild, 1f..(state.displaySettings.temperatureThresholds.warm - 1f), state.temperatureUnit) { value -> updateThresholds(state, onDisplaySettings, state.displaySettings.temperatureThresholds.copy(mild = value)) }
                    ThresholdSlider(stringResource(R.string.warm), state.displaySettings.temperatureThresholds.warm, (state.displaySettings.temperatureThresholds.mild + 1f)..(state.displaySettings.temperatureThresholds.hot - 1f), state.temperatureUnit) { value -> updateThresholds(state, onDisplaySettings, state.displaySettings.temperatureThresholds.copy(warm = value)) }
                    ThresholdSlider(stringResource(R.string.hot), state.displaySettings.temperatureThresholds.hot, (state.displaySettings.temperatureThresholds.warm + 1f)..45f, state.temperatureUnit) { value -> updateThresholds(state, onDisplaySettings, state.displaySettings.temperatureThresholds.copy(hot = value)) }
                }
                WeatherSettingsSection(stringResource(R.string.forecast_display)) {
                    SettingSwitch(stringResource(R.string.show_hourly_temperatures), state.displaySettings.showHourlyTemperatures) { onDisplaySettings(state.displaySettings.copy(showHourlyTemperatures = it)) }
                    SettingSwitch(stringResource(R.string.show_apparent_temperature), state.displaySettings.showApparentTemperature) { onDisplaySettings(state.displaySettings.copy(showApparentTemperature = it)) }
                    SettingSwitch(stringResource(R.string.show_precipitation), state.displaySettings.showPrecipitation) { onDisplaySettings(state.displaySettings.copy(showPrecipitation = it)) }
                    SettingSwitch(stringResource(R.string.show_wind), state.displaySettings.showWind) { onDisplaySettings(state.displaySettings.copy(showWind = it)) }
                    SettingSwitch(stringResource(R.string.show_wind_arrows), state.displaySettings.showWindArrows) { onDisplaySettings(state.displaySettings.copy(showWindArrows = it, showWind = if (it) true else state.displaySettings.showWind)) }
                    SettingSwitch(stringResource(R.string.show_historical_data), state.displaySettings.showHistoricalData) { onDisplaySettings(state.displaySettings.copy(showHistoricalData = it)) }
                    SettingSwitch(stringResource(R.string.show_dates), state.displaySettings.showDates) { onDisplaySettings(state.displaySettings.copy(showDates = it)) }
                    SettingSwitch(stringResource(R.string.show_mushrooms), state.displaySettings.showMushrooms) { onDisplaySettings(state.displaySettings.copy(showMushrooms = it)) }
                    SettingSwitch(stringResource(R.string.show_widget_location), state.displaySettings.showWidgetLocation) { onDisplaySettings(state.displaySettings.copy(showWidgetLocation = it)) }
                    WeatherSupportingText(stringResource(R.string.default_zoom))
                    ZoomControls(state.displaySettings, onDisplaySettings, large = true)
                }
                WeatherSettingsSection(stringResource(R.string.app_privacy_section)) {
                    Button(
                        onClick = {
                            val supported = AppWidgetManager.getInstance(context).requestPinAppWidget(ComponentName(context, WeatherWidgetProvider::class.java), null, null)
                            if (!supported) Toast.makeText(context, R.string.widget_pin_unavailable, Toast.LENGTH_LONG).show()
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = WeatherFieldShape,
                    ) { Text(stringResource(R.string.add_widget)) }
                    SettingSwitch(stringResource(R.string.analytics_consent), state.analyticsConsent == true, onAnalyticsConsent)
                    Button(
                        onClick = {
                            reportScreenshot = eu.vespy.weather.diagnostics.IssueDiagnostics.captureAppWindow(context)
                            showIssueReport = true
                        },
                        modifier = Modifier.fillMaxWidth(),
                        shape = WeatherFieldShape,
                    ) { Text(stringResource(R.string.report_issue)) }
                    TextButton(onClick = onResetDefaults, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.reset_defaults)) }
                    TextButton(onClick = { uriHandler.openUri("https://weather.vespy.eu/privacy.html") }, modifier = Modifier.fillMaxWidth()) { Text(stringResource(R.string.privacy_policy)) }
                }
                Spacer(Modifier.height(8.dp))
            }
                TextButton(
                    onClick = onDismiss,
                    modifier = Modifier.align(Alignment.End).padding(horizontal = 20.dp, vertical = 8.dp),
                ) { Text(stringResource(R.string.close), fontSize = 16.sp, fontWeight = FontWeight.Bold) }
            }
        }
    }
    if (showIssueReport) {
        IssueReportDialog(
            appScreenshot = reportScreenshot,
            onDismiss = { showIssueReport = false; reportScreenshot = null },
        )
    }
}

@Composable
fun TemperatureTextSizeDropdown(selected: Float, onSelect: (Float) -> Unit) {
    var expanded by remember { mutableStateOf(false) }
    val options = listOf(
        .8f to stringResource(R.string.temperature_text_size_extra_small),
        .9f to stringResource(R.string.temperature_text_size_small),
        .92f to stringResource(R.string.temperature_text_size_default),
        1f to stringResource(R.string.temperature_text_size_large),
        1.1f to stringResource(R.string.temperature_text_size_extra_large),
    )
    val selectedLabel = options.minByOrNull { kotlin.math.abs(it.first - selected) }?.second.orEmpty()
    BoxWithConstraints(Modifier.fillMaxWidth()) {
        Button(
            onClick = { expanded = true },
            modifier = Modifier.fillMaxWidth().height(48.dp),
            shape = WeatherFieldShape,
            colors = ButtonDefaults.buttonColors(
                containerColor = MaterialTheme.colorScheme.surfaceVariant,
                contentColor = MaterialTheme.colorScheme.onSurface,
            ),
        ) {
            Text(selectedLabel, Modifier.weight(1f), fontWeight = FontWeight.Bold)
            Text("▾")
        }
        DropdownMenu(
            expanded = expanded,
            onDismissRequest = { expanded = false },
            modifier = Modifier.width(maxWidth),
        ) {
            options.forEach { (scale, label) ->
                DropdownMenuItem(
                    text = { Text(label, fontWeight = if (scale == selected) FontWeight.Bold else FontWeight.Normal) },
                    onClick = { onSelect(scale); expanded = false },
                )
            }
        }
    }
}

@Composable
private fun AnalyticsConsentDialog(onConsent: (Boolean) -> Unit) {
    AlertDialog(
        onDismissRequest = {},
        title = { Text(stringResource(R.string.analytics_title), fontWeight = FontWeight.ExtraBold) },
        text = {
            HideDialogNavigation()
            Text(stringResource(R.string.analytics_message))
        },
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

@Composable
private fun HideDialogNavigation() {
    val view = LocalView.current
    val window = (view.parent as? DialogWindowProvider)?.window
    LaunchedEffect(window) {
        window?.let(::hideNavigationControls)
    }
}

private fun shareLocation(context: Context, location: eu.vespy.weather.data.WeatherLocation, language: String) {
    val locale = (language.takeUnless { it == "system" } ?: Locale.getDefault().toLanguageTag())
        .let { if (it.startsWith("pl", ignoreCase = true)) "pl-PL" else "en-US" }
    val slug = location.name.trim()
        .replace(Regex("[^\\p{L}\\p{N}]+"), "-")
        .trim('-')
        .ifEmpty { "location" }
    val coordinates = String.format(Locale.US, "%.5f,%.5f", location.latitude, location.longitude)
    val url = Uri.Builder()
        .scheme("https")
        .authority("weather.vespy.eu")
        .appendPath(locale)
        .appendPath(slug)
        .appendQueryParameter("ll", coordinates)
        .appendQueryParameter("share", "1")
        .build()
        .toString()
    val intent = Intent(Intent.ACTION_SEND)
        .setType("text/plain")
        .putExtra(Intent.EXTRA_SUBJECT, context.getString(R.string.share_location))
        .putExtra(Intent.EXTRA_TEXT, context.getString(R.string.share_location_message, location.name, url))
    context.startActivity(Intent.createChooser(intent, context.getString(R.string.share_location)))
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
        Text(label, modifier = Modifier.weight(1f), fontSize = 15.sp)
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
                    contentColor = if (selected == value) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                ),
            ) { Text(label, fontSize = 14.sp) }
        }
    }
}

private fun updateThresholds(state: WeatherUiState, onChange: (ForecastDisplaySettings) -> Unit, thresholds: TemperatureThresholds) {
    onChange(state.displaySettings.copy(temperatureThresholds = thresholds))
}

@Composable
private fun ThresholdSlider(label: String, value: Float, range: ClosedFloatingPointRange<Float>, unit: String, onChange: (Float) -> Unit) {
    var sliderValue by remember(value) { mutableFloatStateOf(value) }
    val displayed = if (unit == "F") sliderValue * 9f / 5f + 32f else sliderValue
    Column {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text(label, fontSize = 14.sp)
            Text("${displayed.toInt()}°$unit", color = Muted, fontSize = 14.sp)
        }
        Slider(
            value = sliderValue.coerceIn(range),
            onValueChange = { sliderValue = it },
            onValueChangeFinished = { onChange(sliderValue) },
            valueRange = range,
        )
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
