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
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.relocation.BringIntoViewRequester
import androidx.compose.foundation.relocation.bringIntoViewRequester
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
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshotFlow
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
import eu.vespy.weather.data.visibleAlerts
import eu.vespy.weather.data.isAlertDismissed
import eu.vespy.weather.widget.WeatherWidgetProvider
import kotlinx.coroutines.delay
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL
import java.time.LocalDateTime
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
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
    var openLocationsInSettings by rememberSaveable { mutableStateOf(false) }
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
        openLocationsInSettings = false
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
                            onManageLocations = { openLocationsInSettings = true; showSettings = true },
                            onDismissAlert = viewModel::dismissAlert,
                            onRestoreAlerts = viewModel::restoreCurrentAlerts,
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
                            onManageLocations = { openLocationsInSettings = true; showSettings = true },
                            onDismissAlert = viewModel::dismissAlert,
                            onRestoreAlerts = viewModel::restoreCurrentAlerts,
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
                    initiallyOpenLocations = openLocationsInSettings,
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
    onManageLocations: () -> Unit,
    onDismissAlert: (String) -> Unit,
    onRestoreAlerts: () -> Unit,
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
                onManage = onManageLocations,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            val hiddenCurrentAlerts = state.forecast?.let { forecast ->
                forecast.alerts.any { state.location.isAlertDismissed(it.id, state.dismissedAlertKeys) }
            } == true
            if (hiddenCurrentAlerts) {
                HiddenAlertsButton(onRestoreAlerts)
                Spacer(Modifier.width(8.dp))
            }
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
                    state.forecast.visibleAlerts(state.location, state.dismissedAlertKeys).firstOrNull()?.let {
                        WeatherAlertBanner(it, landscape, onDismissAlert)
                    }
                    ForecastCard(state.forecast, landscape, state.temperatureUnit, state.displaySettings, onDisplaySettings, darkTheme, state.demo)
                }
            }
        }
    }
}

@Composable
private fun WeatherAlertBanner(alert: WeatherAlert, compact: Boolean, onDismiss: (String) -> Unit) {
    val uriHandler = LocalUriHandler.current
    val dismissDescription = stringResource(R.string.dismiss_weather_alert)
    val accent = when (alert.severity) {
        "extreme" -> Color(0xFFE5484D)
        "severe" -> Color(0xFFF47B32)
        else -> Color(0xFFE6B62F)
    }
    Surface(
        modifier = Modifier.fillMaxWidth().padding(top = 7.dp, bottom = 7.dp),
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
                Text(
                    stringResource(R.string.weather_alert_source, alert.source),
                    modifier = Modifier.clickable(enabled = alert.sourceUrl.startsWith("https://")) { uriHandler.openUri(alert.sourceUrl) },
                    color = MaterialTheme.colorScheme.primary,
                    fontSize = 9.sp,
                )
            }
            Box(
                modifier = Modifier
                    .size(if (compact) 28.dp else 32.dp)
                    .clickable { onDismiss(alert.id) }
                    .semantics { contentDescription = dismissDescription },
                contentAlignment = Alignment.Center,
            ) {
                Text("×", color = Muted, fontSize = if (compact) 18.sp else 22.sp, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun HiddenAlertsButton(onClick: () -> Unit) {
    val description = stringResource(R.string.show_hidden_weather_alerts)
    Box(
        modifier = Modifier
            .size(34.dp)
            .clickable(onClick = onClick)
            .semantics { contentDescription = description }
            .border(1.dp, Color(0xFFE6B62F).copy(alpha = .7f), RoundedCornerShape(9.dp)),
        contentAlignment = Alignment.Center,
    ) {
        Text("!", color = Color(0xFFE6B62F), fontSize = 18.sp, fontWeight = FontWeight.Black)
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
                text = { Text("✎ ${stringResource(R.string.edit_locations)}", fontSize = 15.sp) },
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

private enum class TimelineHelpKind {
    SKY,
    TEMPERATURE,
    WIND,
    UV,
    HUMIDITY,
    PRESSURE,
    AIR_QUALITY,
    POLLEN,
    MUSHROOMS,
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
    val metricRows = remember(
        points,
        settings.showUvIndex, settings.showHumidity, settings.showPressure, settings.showAirQuality, settings.showPollen,
        settings.showUvValues, settings.showHumidityValues, settings.showPressureValues, settings.showAirQualityValues, settings.showPollenValues,
    ) {
        buildList {
            if (settings.showUvIndex || settings.showUvValues) {
                val values = points.map(HourlyWeather::uvIndex)
                add(TimelineMetric("UV", "uv", android.graphics.Color.rgb(255, 200, 61), values, 0.0, max(11.0, values.filterNotNull().maxOrNull() ?: 0.0), showValues = settings.showUvValues, showChart = settings.showUvIndex))
            }
            if (settings.showHumidity || settings.showHumidityValues) add(TimelineMetric("%", "humidity", android.graphics.Color.rgb(74, 163, 255), points.map(HourlyWeather::relativeHumidity), 0.0, 100.0, showValues = settings.showHumidityValues, showChart = settings.showHumidity))
            if (settings.showPressure || settings.showPressureValues) {
                val values = points.map(HourlyWeather::surfacePressure)
                val available = values.filterNotNull()
                add(TimelineMetric("hPa", "pressure", android.graphics.Color.rgb(177, 145, 255), values, available.minOrNull(), available.maxOrNull(), available.takeIf { it.isNotEmpty() }?.average(), settings.showPressureValues, settings.showPressure))
            }
            if (settings.showAirQuality || settings.showAirQualityValues) {
                val values = points.map { it.airQuality?.europeanAqi }
                add(TimelineMetric("AQI", "airQuality", android.graphics.Color.rgb(150, 158, 170), values, 0.0, max(100.0, values.filterNotNull().maxOrNull() ?: 0.0), showValues = settings.showAirQualityValues, showChart = settings.showAirQuality))
            }
            if (settings.showPollen || settings.showPollenValues) {
                val values = points.map { point ->
                    point.pollen?.let { pollen ->
                        listOf(pollen.alder, pollen.birch, pollen.grass, pollen.mugwort, pollen.olive, pollen.ragweed)
                            .filterNotNull()
                            .takeIf { it.isNotEmpty() }
                            ?.sum()
                    }
                }
                add(TimelineMetric("", "pollen", android.graphics.Color.rgb(255, 200, 61), values, 0.0, values.filterNotNull().maxOrNull()?.coerceAtLeast(1.0), showValues = settings.showPollenValues, showChart = settings.showPollen))
            }
        }
    }
    val metricRowHeight = if (landscape) 30.dp else 40.dp
    val valueRowHeight = if (landscape) 24.dp else 30.dp
    val environmentHeight = metricRows.fold(0.dp) { height, metric -> height + (if (metric.showChart) metricRowHeight else 0.dp) + if (metric.showValues) valueRowHeight else 0.dp }
    val mushroomChartHeight = if (settings.showMushrooms) (if (landscape) 34.dp else 44.dp) else 0.dp
    val mushroomValueHeight = if (settings.showMushroomValues) valueRowHeight else 0.dp
    val mushroomHeight = mushroomChartHeight + mushroomValueHeight
    val skyValuesHeight = if (settings.showSkyValues) valueRowHeight * 3 else 0.dp
    val timelineHeight = (if (landscape) 290.dp else 368.dp) + skyValuesHeight + environmentHeight + mushroomHeight
    val labelHeight = 72.dp
    val skyHeight = if (landscape) 62.dp else 93.dp
    val windChartHeight = if (!settings.showWind) 0.dp else if (settings.showWindArrows) {
        if (landscape) 48.dp else 60.dp
    } else if (landscape) 34.dp else 45.dp
    val windValueHeight = if (settings.showWindValues) valueRowHeight else 0.dp
    val windHeight = windChartHeight + windValueHeight
    val todayLabel = stringResource(R.string.today)
    val historyLabel = stringResource(R.string.history)
    val pressureHighLabel = stringResource(R.string.pressure_high_symbol)
    val pressureLowLabel = stringResource(R.string.pressure_low_symbol)
    val legendWidth = if (landscape) 38.dp else 44.dp
    val densityContext = LocalDensity.current
    val slotWidthPx = with(densityContext) { slotWidth.toPx() }
    val nowIndex = remember(points, forecast.current.timestamp) { points.currentIndex(forecast.current.timestamp).coerceAtLeast(0) }
    val nowPosition = if (settings.showHistoricalData) nowIndex * slotWidthPx else 0f
    val positionState = remember(points, settings.zoom, settings.showHistoricalData) { mutableFloatStateOf(nowPosition) }
    var nowBarrierSide by remember(points, settings.zoom, settings.showHistoricalData) { mutableIntStateOf(0) }
    var nowBoundaryReached by remember(points, settings.zoom, settings.showHistoricalData) { mutableStateOf(false) }
    var focusedDate by remember(points, nowIndex) { mutableStateOf(points.getOrNull(nowIndex)?.timestamp?.take(10)) }
    var zoomAnchorTimestamp by remember { mutableStateOf<String?>(null) }
    var legendHelp by remember { mutableStateOf<TimelineHelpKind?>(null) }
    var selectedSegmentIndex by remember(points) { mutableStateOf<Int?>(null) }
    var expandedSegmentIndex by remember(points) { mutableStateOf<Int?>(null) }
    val detailsRequester = remember { BringIntoViewRequester() }
    val coroutineScope = rememberCoroutineScope()
    Column {
    BoxWithConstraints(modifier = Modifier.fillMaxWidth().height(timelineHeight).clipToBounds()) {
        val viewportPx = with(densityContext) { maxWidth.toPx() }
        val contentPx = with(densityContext) { (legendWidth + trackWidth).toPx() }
        val maxPosition = (contentPx - viewportPx).coerceAtLeast(0f)
        val legendWidthPx = with(densityContext) { legendWidth.toPx() }
        fun pointIndexAtViewportCenter(): Int = ((positionState.floatValue + viewportPx / 2f - legendWidthPx) / slotWidthPx)
            .toInt().coerceIn(0, points.lastIndex)
        fun firstVisiblePointIndex(): Int = ((positionState.floatValue - legendWidthPx) / slotWidthPx)
            .toInt().coerceIn(0, points.lastIndex)
        fun detailsPointIndex(): Int = (firstVisiblePointIndex() + 1).coerceAtMost(points.lastIndex)
        LaunchedEffect(settings.zoom, zoomAnchorTimestamp, viewportPx, points) {
            val anchor = zoomAnchorTimestamp ?: return@LaunchedEffect
            val anchorIndex = points.indexOfLast { it.timestamp <= anchor }.coerceAtLeast(0)
            positionState.floatValue = (legendWidthPx + (anchorIndex + .5f) * slotWidthPx - viewportPx / 2f).coerceIn(0f, maxPosition)
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
        val timelineTapModifier = Modifier.pointerInput(points, slotWidthPx, legendWidthPx, viewportPx) {
            detectTapGestures { tap ->
                if (legendHelp != null) {
                    legendHelp = null
                    return@detectTapGestures
                }
                val pointIndex = ((positionState.floatValue + tap.x - legendWidthPx) / slotWidthPx).toInt().coerceIn(0, points.lastIndex)
                if (tap.y <= labelHeight.toPx()) {
                    val date = points[pointIndex].timestamp.take(10)
                    val dayStart = points.indexOfFirst { it.timestamp.take(10) == date }
                    val nextDayStart = ((dayStart + 1) until points.size).firstOrNull { points[it].timestamp.take(10) != date }
                        ?: points.size
                    if (pointIndex in dayStart until min(dayStart + 3, nextDayStart)) {
                        focusedDate = date
                        positionState.floatValue = (legendWidthPx + dayStart * slotWidthPx).coerceIn(0f, maxPosition)
                        coroutineScope.launch {
                            detailsRequester.bringIntoView()
                        }
                    }
                } else if (tap.x >= legendWidthPx) {
                    selectedSegmentIndex = if (selectedSegmentIndex == null) pointIndex else null
                }
            }
        }
        val nowBoundaryModifier = Modifier.pointerInput(points, nowPosition) {
            awaitEachGesture {
                awaitFirstDown(requireUnconsumed = false)
                nowBarrierSide = when {
                    positionState.floatValue < nowPosition -> -1
                    positionState.floatValue > nowPosition -> 1
                    else -> 0
                }
                nowBoundaryReached = false
                do {
                    val event = awaitPointerEvent()
                } while (event.changes.any { it.pressed })
            }
        }
        val scrollableState = rememberScrollableState { delta ->
            val oldPosition = positionState.floatValue
            val proposedPosition = (oldPosition - delta).coerceIn(0f, maxPosition)
            val boundary = stopAtNowBoundary(oldPosition, proposedPosition, nowPosition, nowBarrierSide, nowBoundaryReached)
            positionState.floatValue = boundary.position
            nowBoundaryReached = boundary.stopped
            oldPosition - positionState.floatValue
        }
        LaunchedEffect(scrollableState, points, settings.zoom) {
            snapshotFlow { scrollableState.isScrollInProgress }.collect { scrolling ->
                if (!scrolling) {
                    focusedDate = points.getOrNull(detailsPointIndex())?.timestamp?.take(10)
                }
            }
        }
        val tileWidthPx = (viewportPx * 2f).roundToInt().coerceAtLeast(1)
        val tileHeightPx = with(densityContext) { timelineHeight.roundToPx() }.coerceAtLeast(1)
        val trackWidthPx = with(densityContext) { trackWidth.toPx() }
        val labelHeightPx = with(densityContext) { labelHeight.toPx() }
        val skyHeightPx = with(densityContext) { skyHeight.toPx() }
        val windHeightPx = with(densityContext) { windHeight.toPx() }
        val environmentHeightPx = with(densityContext) { environmentHeight.toPx() }
        val mushroomHeightPx = with(densityContext) { mushroomHeight.toPx() }
        val mushroomValueHeightPx = with(densityContext) { mushroomValueHeight.toPx() }
        val skyValuesHeightPx = with(densityContext) { skyValuesHeight.toPx() }
        val windChartHeightPx = with(densityContext) { windChartHeight.toPx() }
        val windValueHeightPx = with(densityContext) { windValueHeight.toPx() }
        val metricRowHeightPx = with(densityContext) { metricRowHeight.toPx() }
        val valueRowHeightPx = with(densityContext) { valueRowHeight.toPx() }
        val legendTapModifier = Modifier.pointerInput(metricRows, timelineHeight, windHeight, mushroomHeight) {
            detectTapGestures { tap ->
                val temperatureBottom = size.height - windHeightPx - environmentHeightPx - mushroomHeightPx
                val environmentTop = size.height - environmentHeightPx - mushroomHeightPx
                val kind = when {
                    tap.y < labelHeightPx + skyHeightPx + skyValuesHeightPx -> TimelineHelpKind.SKY
                    tap.y < temperatureBottom -> TimelineHelpKind.TEMPERATURE
                    windHeightPx > 0f && tap.y < environmentTop -> TimelineHelpKind.WIND
                    tap.y < environmentTop + environmentHeightPx -> {
                        var top = environmentTop
                        metricRows.firstOrNull { metric ->
                            val bottom = top + (if (metric.showChart) metricRowHeightPx else 0f) + if (metric.showValues) valueRowHeightPx else 0f
                            val hit = tap.y in top..bottom
                            top = bottom
                            hit
                        }?.style?.toTimelineHelpKind()
                    }
                    mushroomHeightPx > 0f -> TimelineHelpKind.MUSHROOMS
                    else -> null
                }
                if (kind != null) legendHelp = if (legendHelp == kind) null else kind
            }
        }
        val pixelScale = densityContext.density
        val tileCache = remember(
            points,
            forecast.daily,
            dark,
            settings,
            temperatureUnit,
            metricRows,
            tileWidthPx,
            tileHeightPx,
            todayLabel,
            historyLabel,
            pressureHighLabel,
            pressureLowLabel,
            demo,
        ) { TimelineTileCache(4) }
        fun drawTimelineContent(nativeCanvas: android.graphics.Canvas, height: Float) {
            ForecastGraphics.drawTimeline(
                canvas = nativeCanvas,
                bounds = android.graphics.RectF(legendWidthPx, 0f, legendWidthPx + trackWidthPx, height),
                points = points,
                days = forecast.daily,
                dark = dark,
                todayLabel = todayLabel,
                labelHeight = labelHeightPx,
                skyHeight = skyHeightPx,
                skyValuesHeight = skyValuesHeightPx,
                windHeight = windHeightPx,
                environmentHeight = environmentHeightPx,
                mushroomHeight = mushroomHeightPx,
                temperatureUnit = temperatureUnit,
                pixelScale = pixelScale,
                textScale = 1.6f,
                precipitationScale = 1.8f,
                showWeekdayNames = true,
                fullWeekdayNames = true,
                dayLabelTextSize = 16f * pixelScale,
                hourTextSize = 13f * pixelScale,
                temperatureTextSize = 24f * pixelScale * settings.temperatureTextScale,
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
                pointOffset = 0,
                drawAnnotations = false,
            )
            if (settings.showSkyValues) {
                val top = labelHeightPx + skyHeightPx
                ForecastGraphics.drawValueTable(
                    nativeCanvas,
                    android.graphics.RectF(legendWidthPx, top, legendWidthPx + trackWidthPx, top + skyValuesHeightPx),
                    listOf(
                        points.map { timelineValue(it.precipitationProbability, 0) },
                        points.map { timelineValue(it.precipitation, 1) },
                        points.map { timelineValue(it.cloudCover, 0) },
                    ),
                    dark,
                    pixelScale,
                )
            }
            if (windHeightPx > 0f) {
                val windTop = height - windHeightPx - environmentHeightPx - mushroomHeightPx
                if (settings.showWind) ForecastGraphics.drawWindLayer(
                    canvas = nativeCanvas,
                    bounds = android.graphics.RectF(
                        legendWidthPx,
                        windTop,
                        legendWidthPx + trackWidthPx,
                        windTop + windChartHeightPx,
                    ),
                    points = points,
                    dark = dark,
                    pixelScale = pixelScale,
                    windScale = 1.22f,
                    showAnnotations = settings.showWindArrows,
                    pointOffset = 0,
                )
                if (settings.showWindValues) ForecastGraphics.drawValueTable(
                    nativeCanvas,
                    android.graphics.RectF(legendWidthPx, windTop + windChartHeightPx, legendWidthPx + trackWidthPx, windTop + windChartHeightPx + windValueHeightPx),
                    listOf(points.map { timelineValue(it.windSpeed, 0) }),
                    dark,
                    pixelScale,
                )
            }
            val environmentTop = height - environmentHeightPx - mushroomHeightPx
            var metricTop = environmentTop
            metricRows.forEach { metric ->
                if (metric.showChart) ForecastGraphics.drawMetricLayer(
                    canvas = nativeCanvas,
                    bounds = android.graphics.RectF(
                        legendWidthPx,
                        metricTop,
                        legendWidthPx + trackWidthPx,
                        metricTop + metricRowHeightPx,
                    ),
                    points = points,
                    values = metric.values,
                    dark = dark,
                    color = metric.color,
                    metricStyle = metric.style,
                    pixelScale = pixelScale,
                    pressureHighLabel = pressureHighLabel,
                    pressureLowLabel = pressureLowLabel,
                    fixedMinimum = metric.minimum,
                    fixedMaximum = metric.maximum,
                    fixedAverage = metric.average,
                )
                if (metric.showChart) metricTop += metricRowHeightPx
                if (metric.showValues) {
                    ForecastGraphics.drawValueTable(
                        nativeCanvas,
                        android.graphics.RectF(legendWidthPx, metricTop, legendWidthPx + trackWidthPx, metricTop + valueRowHeightPx),
                        listOf(metric.values.map { timelineMetricValue(metric.style, it) }),
                        dark,
                        pixelScale,
                    )
                    metricTop += valueRowHeightPx
                }
            }
            if (settings.showMushroomValues) {
                val values = points.map { point -> forecast.daily.firstOrNull { it.date == point.timestamp.take(10) }?.mushroom?.score?.toDouble() }
                ForecastGraphics.drawValueTable(
                    nativeCanvas,
                    android.graphics.RectF(legendWidthPx, height - mushroomValueHeightPx, legendWidthPx + trackWidthPx, height),
                    listOf(values.map { timelineValue(it, 0) }),
                    dark,
                    pixelScale,
                )
            }
            ForecastGraphics.drawTimelineAnnotations(
                canvas = nativeCanvas,
                bounds = android.graphics.RectF(legendWidthPx, 0f, legendWidthPx + trackWidthPx, height),
                points = points,
                dark = dark,
                currentTimestamp = forecast.current.timestamp,
                showHistory = settings.showHistoricalData,
                historyLabel = historyLabel,
                pixelScale = pixelScale,
            )
        }
        fun createTimelineTile(tileIndex: Int): Bitmap =
            Bitmap.createBitmap(tileWidthPx, tileHeightPx, Bitmap.Config.ARGB_8888).also { bitmap ->
                val tileCanvas = android.graphics.Canvas(bitmap)
                tileCanvas.translate(-tileIndex * tileWidthPx.toFloat(), 0f)
                drawTimelineContent(tileCanvas, tileHeightPx.toFloat())
            }
        LaunchedEffect(tileCache, tileWidthPx) {
            snapshotFlow { (positionState.floatValue / tileWidthPx).toInt() }.collect { currentTile ->
                withContext(Dispatchers.Default) {
                    listOf(currentTile - 1, currentTile + 1, currentTile + 2)
                        .filter { it >= 0 }
                        .forEach { tileIndex ->
                            if (!tileCache.contains(tileIndex)) {
                                tileCache.getOrCreate(tileIndex) { createTimelineTile(tileIndex) }
                            }
                        }
                }
            }
        }
        Box(
            modifier = Modifier.fillMaxSize()
                .then(nowBoundaryModifier)
                .scrollable(scrollableState, Orientation.Horizontal, flingBehavior = ScrollableDefaults.flingBehavior())
                .then(pinchModifier)
                .then(timelineTapModifier),
        ) {
            Canvas(
                modifier = Modifier.fillMaxSize(),
            ) {
                val position = positionState.floatValue
                val firstTile = (position / tileWidthPx).toInt().coerceAtLeast(0)
                val lastTile = ((position + size.width) / tileWidthPx).toInt()
                for (tileIndex in firstTile..lastTile) {
                    val tile = tileCache.getOrCreate(tileIndex) { createTimelineTile(tileIndex) }
                    drawContext.canvas.nativeCanvas.drawBitmap(
                        tile,
                        tileIndex * tileWidthPx - position,
                        0f,
                        null,
                    )
                }
            }
            Canvas(
                modifier = Modifier.width(legendWidth).fillMaxHeight()
                    .offset {
                        val legendOffset = if (settings.showHistoricalData) -max(0f, positionState.floatValue - nowPosition) else 0f
                        IntOffset(legendOffset.roundToInt(), 0)
                    }
                    .then(legendTapModifier)
                    .zIndex(2f),
            ) {
                ForecastGraphics.drawLegend(
                    canvas = drawContext.canvas.nativeCanvas,
                    bounds = android.graphics.RectF(0f, 0f, size.width, size.height),
                    dark = dark,
                    labelHeight = labelHeight.toPx(),
                    skyHeight = skyHeight.toPx(),
                    windHeight = windHeight.toPx(),
                    environmentHeight = environmentHeight.toPx(),
                    mushroomHeight = mushroomHeight.toPx(),
                    pixelScale = density,
                )
                if (settings.showSkyValues) ForecastGraphics.drawValueTableLegend(
                    drawContext.canvas.nativeCanvas,
                    android.graphics.RectF(0f, labelHeight.toPx() + skyHeight.toPx(), size.width, labelHeight.toPx() + skyHeight.toPx() + skyValuesHeight.toPx()),
                    listOf("%", "mm", "☁"),
                    dark,
                    density,
                )
                if (settings.showWindValues) {
                    val top = size.height - windHeight.toPx() - environmentHeight.toPx() - mushroomHeight.toPx() + windChartHeight.toPx()
                    val bounds = android.graphics.RectF(0f, top, size.width, top + windValueHeight.toPx())
                    if (settings.showWind) ForecastGraphics.drawValueTableLegend(
                        drawContext.canvas.nativeCanvas, bounds, listOf("km/h"), dark, density,
                    ) else ForecastGraphics.drawCompactValueLegend(
                        drawContext.canvas.nativeCanvas, bounds, "wind", "km/h", dark, density, android.graphics.Color.rgb(155, 199, 215),
                    )
                }
                val environmentTop = size.height - environmentHeight.toPx() - mushroomHeight.toPx()
                var metricTop = environmentTop
                metricRows.forEach { metric ->
                    if (metric.showChart) ForecastGraphics.drawMetricLegend(
                        canvas = drawContext.canvas.nativeCanvas,
                        bounds = android.graphics.RectF(0f, metricTop, size.width, metricTop + metricRowHeight.toPx()),
                        dark = dark,
                        label = metric.label,
                        color = metric.color,
                        metricStyle = metric.style,
                        pixelScale = density,
                    )
                    if (metric.showChart) metricTop += metricRowHeight.toPx()
                    if (metric.showValues) {
                        val bounds = android.graphics.RectF(0f, metricTop, size.width, metricTop + valueRowHeight.toPx())
                        if (metric.showChart) ForecastGraphics.drawValueTableLegend(
                            drawContext.canvas.nativeCanvas, bounds, listOf(metricValueUnit(metric.style)), dark, density,
                        ) else ForecastGraphics.drawCompactValueLegend(
                            drawContext.canvas.nativeCanvas, bounds, metric.style, metricValueUnit(metric.style), dark, density, metric.color,
                        )
                        metricTop += valueRowHeight.toPx()
                    }
                }
                if (settings.showMushroomValues) {
                    val bounds = android.graphics.RectF(0f, size.height - mushroomValueHeight.toPx(), size.width, size.height)
                    if (settings.showMushrooms) ForecastGraphics.drawValueTableLegend(
                        drawContext.canvas.nativeCanvas, bounds, listOf("/100"), dark, density,
                    ) else ForecastGraphics.drawCompactValueLegend(
                        drawContext.canvas.nativeCanvas, bounds, "mushrooms", "/100", dark, density, android.graphics.Color.rgb(224, 83, 66),
                    )
                }
                drawContext.canvas.nativeCanvas.drawLine(
                    size.width - density,
                    0f,
                    size.width - density,
                    size.height,
                    android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG).apply {
                        color = ForecastGraphics.palette(dark).separator
                        strokeWidth = 1.25f * density
                    },
                )
            }
            selectedSegmentIndex?.let { index ->
                points.getOrNull(index)?.let { point ->
                    TimelineSegmentCard(
                        point = point,
                        groupHours = groupHours,
                        temperatureUnit = temperatureUnit,
                        onExpand = {
                            expandedSegmentIndex = index
                            selectedSegmentIndex = null
                        },
                        modifier = Modifier.align(Alignment.BottomEnd).padding(8.dp).widthIn(min = 210.dp, max = 290.dp).zIndex(3f),
                    )
                }
            }
        }
    }
        Box(Modifier.bringIntoViewRequester(detailsRequester)) {
            focusedDate?.let { date ->
                ForecastDayBrief(
                    date = date,
                    availableDates = forecast.daily.map { it.date },
                    onSelectDate = { focusedDate = it },
                    points = hourly.filter { it.timestamp.take(10) == date },
                    daily = forecast.daily.firstOrNull { it.date == date },
                    latitude = forecast.location.latitude,
                    timezone = forecast.location.timezone,
                    temperatureUnit = temperatureUnit,
                    compact = landscape,
                )
            }
        }
    }
    legendHelp?.let { kind ->
        Dialog(
            onDismissRequest = { legendHelp = null },
            properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false),
        ) {
            Box(
                modifier = Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding().pointerInput(Unit) {
                    detectTapGestures { legendHelp = null }
                },
                contentAlignment = Alignment.Center,
            ) {
                TimelineLegendHelp(
                    kind = kind,
                    points = points,
                    dark = dark,
                    temperatureThresholds = settings.temperatureThresholds,
                    pressureHighLabel = pressureHighLabel,
                    pressureLowLabel = pressureLowLabel,
                    onClose = { legendHelp = null },
                    modifier = Modifier.padding(horizontal = 16.dp).widthIn(max = 360.dp),
                )
            }
        }
    }
    expandedSegmentIndex?.let { index ->
        points.getOrNull(index)?.let { point ->
            TimelineSegmentDialog(
                point = point,
                groupHours = groupHours,
                temperatureUnit = temperatureUnit,
                onClose = { expandedSegmentIndex = null },
            )
        }
    }
}

private data class TimelineMetric(
    val label: String,
    val style: String,
    val color: Int,
    val values: List<Double?>,
    val minimum: Double?,
    val maximum: Double?,
    val average: Double? = null,
    val showValues: Boolean = false,
    val showChart: Boolean = true,
)

private fun timelineValue(value: Double?, decimals: Int): String = value?.let {
    String.format(Locale.getDefault(), if (decimals == 0) "%.0f" else "%.1f", it)
} ?: "-"

private fun timelineMetricValue(style: String, value: Double?): String = when (style) {
    "uv", "pollen" -> timelineValue(value, 1)
    else -> timelineValue(value, 0)
}

private fun metricValueUnit(style: String): String = when (style) {
    "uv" -> "UV"
    "humidity" -> "%"
    "pressure" -> "hPa"
    "airQuality" -> "AQI"
    "pollen" -> "#/m³"
    else -> ""
}

private fun String.toTimelineHelpKind(): TimelineHelpKind? = when (this) {
    "uv" -> TimelineHelpKind.UV
    "humidity" -> TimelineHelpKind.HUMIDITY
    "pressure" -> TimelineHelpKind.PRESSURE
    "airQuality" -> TimelineHelpKind.AIR_QUALITY
    "pollen" -> TimelineHelpKind.POLLEN
    else -> null
}

@Composable
private fun TimelineLegendHelp(
    kind: TimelineHelpKind,
    points: List<HourlyWeather>,
    dark: Boolean,
    temperatureThresholds: TemperatureThresholds,
    pressureHighLabel: String,
    pressureLowLabel: String,
    onClose: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val title = stringResource(kind.titleResource())
    Surface(
        modifier = modifier,
        shape = RoundedCornerShape(14.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = .98f),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .55f)),
        shadowElevation = 12.dp,
    ) {
        Column(Modifier.padding(14.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, modifier = Modifier.weight(1f), fontSize = 17.sp, fontWeight = FontWeight.Bold)
                Text("×", modifier = Modifier.size(32.dp).clickable(onClick = onClose).wrapContentSize(), fontSize = 24.sp, color = Muted)
            }
            Text(stringResource(kind.descriptionResource()), color = Muted, fontSize = 12.sp, lineHeight = 17.sp)
            Text(
                stringResource(R.string.timeline_help_example),
                modifier = Modifier.padding(top = 10.dp, bottom = 5.dp),
                color = MaterialTheme.colorScheme.primary,
                fontFamily = FontFamily.Monospace,
                fontSize = 9.sp,
                fontWeight = FontWeight.Black,
            )
            TimelineLegendGraphic(kind, points, dark, temperatureThresholds, pressureHighLabel, pressureLowLabel)
            TimelineLegendScale(kind, pressureHighLabel, pressureLowLabel)
        }
    }
}

private fun TimelineHelpKind.titleResource(): Int = when (this) {
    TimelineHelpKind.SKY -> R.string.timeline_help_sky_title
    TimelineHelpKind.TEMPERATURE -> R.string.timeline_help_temperature_title
    TimelineHelpKind.WIND -> R.string.timeline_help_wind_title
    TimelineHelpKind.UV -> R.string.timeline_help_uv_title
    TimelineHelpKind.HUMIDITY -> R.string.timeline_help_humidity_title
    TimelineHelpKind.PRESSURE -> R.string.timeline_help_pressure_title
    TimelineHelpKind.AIR_QUALITY -> R.string.timeline_help_air_quality_title
    TimelineHelpKind.POLLEN -> R.string.timeline_help_pollen_title
    TimelineHelpKind.MUSHROOMS -> R.string.timeline_help_mushrooms_title
}

private fun TimelineHelpKind.descriptionResource(): Int = when (this) {
    TimelineHelpKind.SKY -> R.string.timeline_help_sky
    TimelineHelpKind.TEMPERATURE -> R.string.timeline_help_temperature
    TimelineHelpKind.WIND -> R.string.timeline_help_wind
    TimelineHelpKind.UV -> R.string.timeline_help_uv
    TimelineHelpKind.HUMIDITY -> R.string.timeline_help_humidity
    TimelineHelpKind.PRESSURE -> R.string.timeline_help_pressure
    TimelineHelpKind.AIR_QUALITY -> R.string.timeline_help_air_quality
    TimelineHelpKind.POLLEN -> R.string.timeline_help_pollen
    TimelineHelpKind.MUSHROOMS -> R.string.timeline_help_mushrooms
}

@Composable
private fun TimelineLegendGraphic(
    kind: TimelineHelpKind,
    sourcePoints: List<HourlyWeather>,
    dark: Boolean,
    temperatureThresholds: TemperatureThresholds,
    pressureHighLabel: String,
    pressureLowLabel: String,
) {
    val surface = MaterialTheme.colorScheme.surfaceVariant
    val examplePoints = remember(kind, sourcePoints.firstOrNull()) { legendExamplePoints(sourcePoints.firstOrNull(), kind) }
    val exampleDays = remember(kind) { legendExampleDays(kind) }
    Canvas(Modifier.fillMaxWidth().height(if (kind == TimelineHelpKind.SKY) 82.dp else 64.dp).background(surface, RoundedCornerShape(9.dp))) {
        val nativeBounds = android.graphics.RectF(0f, 0f, size.width, size.height)
        val values = legendExampleValues(kind)
        when (kind) {
            TimelineHelpKind.SKY, TimelineHelpKind.TEMPERATURE, TimelineHelpKind.MUSHROOMS -> {
                val skyHeight = if (kind == TimelineHelpKind.SKY) size.height else 0f
                val mushroomHeight = if (kind == TimelineHelpKind.MUSHROOMS) size.height else 0f
                ForecastGraphics.drawTimeline(
                    canvas = drawContext.canvas.nativeCanvas,
                    bounds = nativeBounds,
                    points = examplePoints,
                    days = exampleDays,
                    dark = dark,
                    todayLabel = "",
                    labelHeight = 0f,
                    skyHeight = skyHeight,
                    windHeight = 0f,
                    mushroomHeight = mushroomHeight,
                    pixelScale = density,
                    showHours = false,
                    showTemperatureValues = false,
                    showApparentTemperature = true,
                    showPrecipitation = kind == TimelineHelpKind.SKY,
                    showWind = false,
                    temperatureThresholds = temperatureThresholds,
                    showMushrooms = kind == TimelineHelpKind.MUSHROOMS,
                    showTemperatureChart = kind == TimelineHelpKind.TEMPERATURE,
                    temperatureMinimum = -8.0,
                    temperatureMaximum = 32.0,
                    drawAnnotations = false,
                )
            }
            TimelineHelpKind.WIND -> ForecastGraphics.drawWindLayer(
                drawContext.canvas.nativeCanvas, nativeBounds, examplePoints, dark, density, 1.22f, false,
            )
            else -> ForecastGraphics.drawMetricLayer(
                canvas = drawContext.canvas.nativeCanvas,
                bounds = nativeBounds,
                points = examplePoints,
                values = values,
                dark = dark,
                color = when (kind) {
                    TimelineHelpKind.HUMIDITY -> android.graphics.Color.rgb(74, 163, 255)
                    TimelineHelpKind.AIR_QUALITY -> android.graphics.Color.rgb(150, 158, 170)
                    TimelineHelpKind.POLLEN -> android.graphics.Color.rgb(255, 200, 61)
                    TimelineHelpKind.UV, TimelineHelpKind.PRESSURE -> android.graphics.Color.rgb(177, 145, 255)
                },
                metricStyle = when (kind) {
                    TimelineHelpKind.UV -> "uv"
                    TimelineHelpKind.HUMIDITY -> "humidity"
                    TimelineHelpKind.PRESSURE -> "pressure"
                    TimelineHelpKind.AIR_QUALITY -> "airQuality"
                    TimelineHelpKind.POLLEN -> "pollen"
                },
                pixelScale = density,
                pressureHighLabel = pressureHighLabel,
                pressureLowLabel = pressureLowLabel,
                fixedMinimum = if (kind == TimelineHelpKind.PRESSURE) 985.0 else 0.0,
                fixedMaximum = when (kind) {
                    TimelineHelpKind.UV -> 11.0
                    TimelineHelpKind.HUMIDITY, TimelineHelpKind.AIR_QUALITY -> 100.0
                    TimelineHelpKind.PRESSURE -> 1040.0
                    TimelineHelpKind.POLLEN -> 80.0
                },
                fixedAverage = if (kind == TimelineHelpKind.PRESSURE) 1013.0 else null,
            )
        }
    }
}

@Composable
private fun TimelineLegendScale(kind: TimelineHelpKind, pressureHighLabel: String, pressureLowLabel: String) {
    val labels = when (kind) {
        TimelineHelpKind.SKY -> listOf(
            stringResource(R.string.sky_night), stringResource(R.string.sky_clear), stringResource(R.string.sky_cloudy),
            stringResource(R.string.sky_rain), stringResource(R.string.sky_snow), stringResource(R.string.sky_hail),
        )
        TimelineHelpKind.PRESSURE -> listOf("$pressureLowLabel 988 hPa", "$pressureHighLabel 1021 hPa", "$pressureLowLabel 1005 hPa")
        TimelineHelpKind.AIR_QUALITY -> listOf("AQI 8", "AQI 84", "AQI 10")
        TimelineHelpKind.HUMIDITY -> listOf("20%", "71%", "25%")
        TimelineHelpKind.POLLEN -> listOf("2", "69", "3")
        TimelineHelpKind.UV -> listOf("UV 0", "UV 9.5", "UV 0")
        TimelineHelpKind.WIND -> listOf("5 km/h", "47 km/h", "6 km/h")
        TimelineHelpKind.TEMPERATURE -> listOf("-5°", "21°", "5°")
        TimelineHelpKind.MUSHROOMS -> listOf("0/100", "54/100", "99/100")
    }
    Row(Modifier.fillMaxWidth().padding(top = 5.dp), horizontalArrangement = Arrangement.SpaceBetween) {
        labels.forEach { Text(it, color = Muted, fontSize = if (labels.size > 3) 8.sp else 9.sp, maxLines = 1) }
    }
}

private fun legendExampleValues(kind: TimelineHelpKind): List<Double?> = when (kind) {
    TimelineHelpKind.UV -> listOf(0.0, .5, 1.5, 3.0, 5.0, 8.0, 11.0, 8.0, 5.0, 3.0, 1.0, 0.0)
    TimelineHelpKind.HUMIDITY -> listOf(20.0, 25.0, 32.0, 42.0, 52.0, 64.0, 78.0, 95.0, 82.0, 66.0, 45.0, 25.0)
    TimelineHelpKind.PRESSURE -> listOf(988.0, 993.0, 1001.0, 1008.0, 1013.0, 1017.0, 1024.0, 1036.0, 1027.0, 1018.0, 1013.0, 1005.0)
    TimelineHelpKind.AIR_QUALITY -> listOf(8.0, 12.0, 20.0, 32.0, 48.0, 68.0, 100.0, 84.0, 62.0, 42.0, 24.0, 10.0)
    TimelineHelpKind.POLLEN -> listOf(2.0, 4.0, 9.0, 18.0, 34.0, 58.0, 80.0, 66.0, 45.0, 25.0, 10.0, 3.0)
    else -> emptyList()
}

private fun legendExamplePoints(basePoint: HourlyWeather?, kind: TimelineHelpKind): List<HourlyWeather> {
    val base = basePoint ?: HourlyWeather("2026-06-21T06:00", 10.0, 8.0, 0.0, 0.0, 0.0, 0.0, 0, 0.0, 5.0, 0.0, 8.0)
    val start = LocalDateTime.of(2026, 6, 21, 6, 0)
    val temperatures = listOf(-5.0, -2.0, 2.0, 7.0, 12.0, 18.0, 24.0, 30.0, 27.0, 20.0, 12.0, 5.0)
    val wind = listOf(5.0, 7.0, 10.0, 15.0, 22.0, 34.0, 60.0, 48.0, 30.0, 20.0, 12.0, 6.0)
    return List(12) { index ->
        val skyCodes = listOf(0, 0, 2, 3, 61, 61, 71, 71, 96, 3, 1, 0)
        val code = skyCodes[index]
        base.copy(
            timestamp = if (kind == TimelineHelpKind.MUSHROOMS) {
                LocalDate.of(2026, 6, 21).plusDays(index.toLong()).atTime(12, 0).toString()
            } else {
                start.plusHours(index.toLong() * 2).toString()
            },
            temperature = temperatures[index],
            apparentTemperature = temperatures[index] + if (index < 5) -3.0 else 2.0,
            windSpeed = wind[index],
            windGusts = wind[index] * 1.45,
            cloudCover = listOf(0.0, 8.0, 35.0, 82.0, 92.0, 75.0, 70.0, 55.0, 88.0, 78.0, 25.0, 0.0)[index],
            weatherCode = if (kind == TimelineHelpKind.SKY) code else 0,
            precipitationProbability = if (code in listOf(61, 71, 96)) 85.0 else 0.0,
            precipitation = if (code in listOf(61, 96)) 2.0 else if (code == 71) 1.0 else 0.0,
            snowfall = if (code == 71) 2.0 else 0.0,
        )
    }
}

private fun legendExampleDays(kind: TimelineHelpKind): List<DailyWeather> = if (kind == TimelineHelpKind.MUSHROOMS) {
    (0 until 12).map { index ->
        DailyWeather(LocalDate.of(2026, 6, 21).plusDays(index.toLong()).toString(), null, null, mushroom = eu.vespy.weather.data.MushroomCondition(index * 9, null, null, null, null))
    }
} else {
    listOf(DailyWeather("2026-06-21", "2026-06-21T07:00", "2026-06-21T19:00"), DailyWeather("2026-06-22", "2026-06-22T07:00", "2026-06-22T19:00"))
}

@Composable
private fun TimelineSegmentCard(
    point: HourlyWeather,
    groupHours: Int,
    temperatureUnit: String,
    onExpand: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val locale = LocalContext.current.resources.configuration.locales[0]
    Surface(
        modifier = modifier.clickable(onClick = onExpand),
        shape = RoundedCornerShape(12.dp),
        color = MaterialTheme.colorScheme.surface.copy(alpha = .97f),
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .6f)),
        shadowElevation = 10.dp,
    ) {
        Column(Modifier.padding(11.dp)) {
            Text(segmentDateLabel(point.timestamp, locale), fontSize = 14.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(segmentTimeLabel(point.timestamp, groupHours), color = MaterialTheme.colorScheme.primary, fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Bold)
            Spacer(Modifier.height(7.dp))
            SegmentValueRow(
                stringResource(R.string.temperature), temperatureText(point.temperature, temperatureUnit),
                stringResource(R.string.wind), point.windSpeed.number("%.0f km/h"),
            )
            SegmentValueRow(
                stringResource(R.string.rain_chance), point.precipitationProbability.number("%.0f%%"),
                stringResource(R.string.humidity), point.relativeHumidity.number("%.0f%%"),
            )
            SegmentValueRow(
                stringResource(R.string.air_quality_short), point.airQuality?.europeanAqi.number("%.0f AQI"),
                stringResource(R.string.pollen_total), point.pollen.total().number("%.1f"),
            )
            Text(stringResource(R.string.tap_for_details), modifier = Modifier.padding(top = 5.dp), color = Muted, fontSize = 9.sp)
        }
    }
}

@Composable
private fun SegmentValueRow(leftLabel: String, leftValue: String, rightLabel: String, rightValue: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        SegmentValue(leftLabel, leftValue, Modifier.weight(1f))
        SegmentValue(rightLabel, rightValue, Modifier.weight(1f))
    }
}

@Composable
private fun SegmentValue(label: String, value: String, modifier: Modifier = Modifier) {
    Column(modifier.padding(vertical = 2.dp)) {
        Text(label, color = Muted, fontSize = 8.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(value, fontSize = 12.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

@Composable
private fun TimelineSegmentDialog(point: HourlyWeather, groupHours: Int, temperatureUnit: String, onClose: () -> Unit) {
    val locale = LocalContext.current.resources.configuration.locales[0]
    val sections = listOf(
        stringResource(R.string.day_brief_temperature) to listOf(
            stringResource(R.string.temperature) to temperatureText(point.temperature, temperatureUnit),
            stringResource(R.string.feels_like) to temperatureText(point.apparentTemperature, temperatureUnit),
            stringResource(R.string.weather_condition) to (point.weatherCode?.toString() ?: "-"),
            stringResource(R.string.cloud_cover) to point.cloudCover.number("%.0f%%"),
        ),
        stringResource(R.string.day_brief_rain) to listOf(
            stringResource(R.string.rain_chance) to point.precipitationProbability.number("%.0f%%"),
            stringResource(R.string.precipitation) to point.precipitation.number("%.1f mm"),
            stringResource(R.string.rain_total) to point.rain.number("%.1f mm"),
            stringResource(R.string.snowfall) to point.snowfall.number("%.1f cm"),
        ),
        stringResource(R.string.day_brief_air) to listOf(
            stringResource(R.string.wind) to point.windSpeed.number("%.0f km/h"),
            stringResource(R.string.wind_gusts) to point.windGusts.number("%.0f km/h"),
            stringResource(R.string.wind_direction) to (point.windDirection?.let(::windDirectionText) ?: "-"),
            stringResource(R.string.humidity) to point.relativeHumidity.number("%.0f%%"),
            stringResource(R.string.pressure) to point.surfacePressure.number("%.0f hPa"),
            stringResource(R.string.visibility) to point.visibility?.div(1000.0).number("%.1f km"),
            stringResource(R.string.uv_max) to point.uvIndex.number("%.1f"),
            stringResource(R.string.air_quality_short) to point.airQuality?.europeanAqi.number("%.0f AQI"),
        ),
        stringResource(R.string.day_brief_air_quality) to listOf(
            "PM2.5" to point.airQuality?.pm25.number("%.1f µg/m³"),
            "PM10" to point.airQuality?.pm10.number("%.1f µg/m³"),
            "NO₂" to point.airQuality?.nitrogenDioxide.number("%.1f µg/m³"),
            "O₃" to point.airQuality?.ozone.number("%.1f µg/m³"),
            "SO₂" to point.airQuality?.sulphurDioxide.number("%.1f µg/m³"),
            "CO" to point.airQuality?.carbonMonoxide.number("%.1f µg/m³"),
        ),
        stringResource(R.string.day_brief_pollen) to listOf(
            stringResource(R.string.pollen_alder) to point.pollen?.alder.number("%.1f"),
            stringResource(R.string.pollen_birch) to point.pollen?.birch.number("%.1f"),
            stringResource(R.string.pollen_grass) to point.pollen?.grass.number("%.1f"),
            stringResource(R.string.pollen_mugwort) to point.pollen?.mugwort.number("%.1f"),
            stringResource(R.string.pollen_olive) to point.pollen?.olive.number("%.1f"),
            stringResource(R.string.pollen_ragweed) to point.pollen?.ragweed.number("%.1f"),
        ),
    )
    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false, decorFitsSystemWindows = false)) {
        Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(Modifier.fillMaxSize().statusBarsPadding().navigationBarsPadding()) {
                Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Column(Modifier.weight(1f)) {
                        Text(stringResource(R.string.segment_details), color = MaterialTheme.colorScheme.primary, fontFamily = FontFamily.Monospace, fontSize = 10.sp, fontWeight = FontWeight.Black)
                        Text(segmentDateLabel(point.timestamp, locale), fontSize = 22.sp, fontWeight = FontWeight.Bold)
                        Text(segmentTimeLabel(point.timestamp, groupHours), color = Muted, fontSize = 13.sp)
                    }
                    Text("×", modifier = Modifier.size(44.dp).clickable(onClick = onClose).wrapContentSize(), fontSize = 30.sp)
                }
                Column(Modifier.fillMaxWidth().weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 12.dp, vertical = 4.dp)) {
                    sections.forEach { (title, values) -> SegmentDetailsSection(title, values) }
                    Spacer(Modifier.height(18.dp))
                }
            }
        }
    }
}

@Composable
private fun SegmentDetailsSection(title: String, values: List<Pair<String, String>>) {
    Text(title, modifier = Modifier.padding(start = 3.dp, top = 14.dp, bottom = 6.dp), color = MaterialTheme.colorScheme.primary, fontFamily = FontFamily.Monospace, fontSize = 11.sp, fontWeight = FontWeight.Black)
    values.chunked(2).forEach { rowValues ->
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(7.dp)) {
            rowValues.forEach { (label, value) ->
                DayBriefMetric(label, value, Modifier.weight(1f))
            }
            if (rowValues.size == 1) Spacer(Modifier.weight(1f))
        }
        Spacer(Modifier.height(7.dp))
    }
}

private fun segmentDateLabel(timestamp: String, locale: Locale): String = runCatching {
    val value = LocalDateTime.parse(timestamp).format(DateTimeFormatter.ofPattern("EEEE, d MMMM yyyy", locale))
    value.replaceFirstChar { if (it.isLowerCase()) it.titlecase(locale) else it.toString() }
}.getOrDefault(timestamp.take(10))

private fun segmentTimeLabel(timestamp: String, groupHours: Int): String = runCatching {
    val start = LocalDateTime.parse(timestamp)
    val formatter = DateTimeFormatter.ofPattern("HH:mm")
    if (groupHours <= 1) start.format(formatter) else "${start.format(formatter)} - ${start.plusHours(groupHours.toLong()).format(formatter)}"
}.getOrDefault(timestamp.takeLast(5))

private fun Double?.number(pattern: String): String = this?.let { String.format(Locale.getDefault(), pattern, it) } ?: "-"

private fun eu.vespy.weather.data.PollenForecast?.total(): Double? = this?.let { pollen ->
    listOf(pollen.alder, pollen.birch, pollen.grass, pollen.mugwort, pollen.olive, pollen.ragweed).filterNotNull().takeIf { it.isNotEmpty() }?.sum()
}

private class TimelineTileCache(private val maximumSize: Int) {
    private val tiles = LinkedHashMap<Int, Bitmap>(maximumSize, .75f, true)

    @Synchronized
    fun contains(index: Int): Boolean = tiles.containsKey(index)

    fun getOrCreate(index: Int, create: () -> Bitmap): Bitmap {
        synchronized(this) { tiles[index] }?.let { return it }
        val created = create()
        synchronized(this) {
            tiles[index]?.let { return it }
            tiles[index] = created
            while (tiles.size > maximumSize) {
                tiles.remove(tiles.entries.first().key)
            }
            return created
        }
    }
}

internal data class NowBoundaryResult(val position: Float, val stopped: Boolean)

internal fun stopAtNowBoundary(oldPosition: Float, proposedPosition: Float, nowPosition: Float, gestureSide: Int, alreadyStopped: Boolean): NowBoundaryResult {
    if (alreadyStopped) return NowBoundaryResult(nowPosition, true)
    val crossesNow = (gestureSide < 0 && oldPosition <= nowPosition && proposedPosition >= nowPosition) ||
        (gestureSide > 0 && oldPosition >= nowPosition && proposedPosition <= nowPosition)
    return if (crossesNow) NowBoundaryResult(nowPosition, true) else NowBoundaryResult(proposedPosition, false)
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
    availableDates: List<String>,
    onSelectDate: (String) -> Unit,
    points: List<HourlyWeather>,
    daily: DailyWeather?,
    latitude: Double,
    timezone: String,
    temperatureUnit: String,
    compact: Boolean,
) {
    if (points.isEmpty() && daily == null) return
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
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, modifier = Modifier.weight(1f), fontSize = if (compact) 16.sp else 20.sp, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis)
                val dayIndex = availableDates.indexOf(date)
                TextButton(onClick = { onSelectDate(availableDates[dayIndex - 1]) }, enabled = dayIndex > 0, modifier = Modifier.semantics { contentDescription = context.getString(R.string.previous_day) }) { Text("‹", fontSize = 24.sp) }
                TextButton(onClick = { onSelectDate(availableDates[dayIndex + 1]) }, enabled = dayIndex >= 0 && dayIndex < availableDates.lastIndex, modifier = Modifier.semantics { contentDescription = context.getString(R.string.next_day) }) { Text("›", fontSize = 24.sp) }
            }
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
            DayBriefSection(stringResource(R.string.day_brief_air_quality)) {
                val airQuality = daily?.airQuality
                if (airQuality == null) Text(stringResource(R.string.air_quality_unavailable), color = Muted, fontSize = 12.sp)
                else AirQualityDetails(airQuality)
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
            DayBriefSection(stringResource(R.string.day_brief_sun)) {
                SunlightComparison(date, daily?.sunrise, daily?.sunset, dayLength, shortest, longest, timezone)
                DayBriefRow(stringResource(R.string.daylight), durationText(dayLength), stringResource(R.string.sunshine), durationText(daily?.sunshineDuration), Color(0xFFFFC83D), Color(0xFFFFA928))
                DayBriefRow(stringResource(R.string.uv_max), daily?.uvIndexMaximum?.let { String.format(locale, "%.1f", it) } ?: "-", stringResource(R.string.sun_window), "$sunrise - $sunset", uvColor(daily?.uvIndexMaximum), Color(0xFFFFC83D))
            }
            DayBriefSection(stringResource(R.string.moon_path)) {
                MoonPanel(LocalDate.parse(date), clockMinutes(daily?.sunrise) ?: 360)
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
private fun SunlightComparison(date: String, sunrise: String?, sunset: String?, dayLength: Double, shortestDay: Double, longestDay: Double, timezone: String) {
    val sunriseMinutes = clockMinutes(sunrise) ?: return
    val sunsetMinutes = clockMinutes(sunset) ?: return
    val localNow by produceState(initialValue = runCatching { LocalDateTime.now(ZoneId.of(timezone)) }.getOrElse { LocalDateTime.now() }, timezone) {
        while (true) {
            value = runCatching { LocalDateTime.now(ZoneId.of(timezone)) }.getOrElse { LocalDateTime.now() }
            delay(60_000)
        }
    }
    val aboveShortest = (dayLength - shortestDay).coerceAtLeast(0.0)
    val belowLongest = (longestDay - dayLength).coerceAtLeast(0.0)
    val shortestDifference = (aboveShortest / 120).toInt()
    val longestDifference = (belowLongest / 120).toInt()
    val rows = listOf(
        Triple(stringResource(R.string.shortest_day), (sunriseMinutes + shortestDifference).coerceIn(0, 1440), (sunsetMinutes - shortestDifference).coerceIn(0, 1440)),
        Triple(stringResource(R.string.selected_day), sunriseMinutes.coerceIn(0, 1440), sunsetMinutes.coerceIn(0, 1440)),
        Triple(stringResource(R.string.longest_day), (sunriseMinutes - longestDifference).coerceIn(0, 1440), (sunsetMinutes + longestDifference).coerceIn(0, 1440)),
    )
    val domain = sunlightDomain(rows)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Column(
            modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(10.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            rows.forEachIndexed { index, (label, rise, set) ->
                val color = sunlightColor(index)
                Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                    Box(Modifier.size(7.dp).background(color, RoundedCornerShape(50)))
                    Text(label, color = if (index == 1) MaterialTheme.colorScheme.onSurface else Muted, fontSize = 10.sp, modifier = Modifier.padding(start = 5.dp).weight(1f))
                    Text("${formatClockMinutes(rise)} - ${formatClockMinutes(set)}", color = color, fontSize = 10.sp, fontWeight = FontWeight.Bold)
                }
            }
            val markerMinute = if (localNow.toLocalDate().toString() == date) localNow.hour * 60 + localNow.minute else null
            SunPathChart(rows, domain.first, domain.last, markerMinute)
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                listOf(domain.first, (domain.first + domain.last) / 2, domain.last).forEach { Text(formatClockMinutes(it), color = Muted, fontSize = 8.sp) }
            }
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                SunEventSummary(
                    stringResource(R.string.sunrise),
                    earliest = rows[2].second,
                    current = rows[1].second,
                    latest = rows[0].second,
                    modifier = Modifier.weight(1f),
                )
                SunEventSummary(
                    stringResource(R.string.sunset),
                    earliest = rows[0].third,
                    current = rows[1].third,
                    latest = rows[2].third,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        DayBriefRow(
            stringResource(R.string.above_shortest_day), "+${durationText(aboveShortest)}",
            stringResource(R.string.below_longest_day), durationText(belowLongest),
            Color(0xFFFFC83D), Color(0xFFFFC83D),
        )
    }
}

@Composable
private fun MoonPanel(date: LocalDate, sunriseMinutes: Int) {
    val phase = moonPhase(date)
    val moonrise = normalizeMinutes(sunriseMinutes + (phase * 1440).roundToInt())
    val moonset = normalizeMinutes(moonrise + 720)
    val illumination = ((1 - cos(2 * PI * phase)) / 2 * 100).roundToInt()
    Column(modifier = Modifier.padding(top = 8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            MoonPhaseIcon(phase, Modifier.size(34.dp))
            Column(Modifier.padding(start = 9.dp).weight(1f)) {
                Text(stringResource(R.string.moon_path), color = Color(0xFFC2D2FF), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                Text("${moonPhaseName(phase)} - $illumination%", color = Muted, fontSize = 10.sp)
            }
            Text("~${formatClockMinutes(moonrise)} - ~${formatClockMinutes(moonset)}", color = Color(0xFFC2D2FF), fontSize = 10.sp, fontWeight = FontWeight.Bold)
        }
        MoonPathChart(moonrise, phase)
        Text(stringResource(R.string.moon_times_approximate), color = Muted, fontSize = 9.sp)
        Text(stringResource(R.string.next_moon_phases), color = Muted, fontSize = 10.sp, fontWeight = FontWeight.Bold)
        Row(
            Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            (0 until 30).forEach { offset ->
                val phaseDate = date.plusDays(offset.toLong())
                val itemPhase = moonPhase(phaseDate)
                Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.width(36.dp)) {
                    MoonPhaseIcon(itemPhase, Modifier.size(24.dp))
                    Text("${phaseDate.dayOfMonth}.${phaseDate.monthValue}", color = if (offset == 0) MaterialTheme.colorScheme.onSurface else Muted, fontSize = 9.sp, fontWeight = if (offset == 0) FontWeight.Bold else FontWeight.Normal)
                }
            }
        }
    }
}

@Composable
private fun MoonPathChart(moonrise: Int, phase: Double) {
    Canvas(Modifier.fillMaxWidth().height(76.dp)) {
        val horizonY = size.height - 10.dp.toPx()
        val moonColor = Color(0xFFC2D2FF)
        drawRect(Color(0xFF0B1220).copy(alpha = .62f), Offset(0f, horizonY), Size(size.width, size.height - horizonY))
        drawLine(Muted.copy(alpha = .4f), Offset(0f, horizonY), Offset(size.width, horizonY), strokeWidth = 1.5.dp.toPx())
        val path = Path()
        var drawing = false
        for (step in 0..96) {
            val minute = step * 15
            val sinceRise = normalizeMinutes(minute - moonrise)
            if (sinceRise <= 720) {
                val x = size.width * minute / 1440f
                val y = horizonY - sin(PI * sinceRise / 720.0).toFloat() * 48.dp.toPx()
                if (!drawing) path.moveTo(x, y) else path.lineTo(x, y)
                drawing = true
            } else {
                drawing = false
            }
        }
        drawPath(path, moonColor.copy(alpha = .78f), style = Stroke(width = 2.5.dp.toPx(), cap = StrokeCap.Round))
        val transit = normalizeMinutes(moonrise + 360)
        val transitX = size.width * transit / 1440f
        val transitY = horizonY - 48.dp.toPx()
        drawCircle(moonColor.copy(alpha = .13f), 13.dp.toPx(), Offset(transitX, transitY))
        drawMoonPhase(phase, Offset(transitX, transitY), 7.dp.toPx(), moonColor, Color(0xFF0B1220))
    }
}

@Composable
private fun MoonPhaseIcon(phase: Double, modifier: Modifier = Modifier) {
    val lit = Color(0xFFC2D2FF)
    val shadow = MaterialTheme.colorScheme.surfaceVariant
    Canvas(modifier) { drawMoonPhase(phase, center, size.minDimension * .43f, lit, shadow) }
}

private fun androidx.compose.ui.graphics.drawscope.DrawScope.drawMoonPhase(phase: Double, center: Offset, radius: Float, lit: Color, shadow: Color) {
    val normalized = ((phase % 1) + 1) % 1
    val illumination = ((1 - cos(2 * PI * normalized)) / 2).toFloat()
    drawCircle(lit, radius, center)
    val shift = if (normalized < .5) -2 * radius * illumination else 2 * radius * illumination
    drawCircle(shadow, radius, Offset(center.x + shift, center.y))
    drawCircle(lit.copy(alpha = .72f), radius, center, style = Stroke(width = max(1f, radius * .11f)))
}

internal fun moonPhase(date: LocalDate): Double {
    val days = ChronoUnit.DAYS.between(LocalDate.of(2000, 1, 6), date).toDouble() + .76
    return ((days / 29.53058867) % 1.0 + 1.0) % 1.0
}

@Composable
private fun moonPhaseName(phase: Double): String = stringResource(when ((phase * 8 + .5).toInt() % 8) {
    0 -> R.string.moon_new
    1 -> R.string.moon_waxing_crescent
    2 -> R.string.moon_first_quarter
    3 -> R.string.moon_waxing_gibbous
    4 -> R.string.moon_full
    5 -> R.string.moon_waning_gibbous
    6 -> R.string.moon_last_quarter
    else -> R.string.moon_waning_crescent
})

internal fun normalizeMinutes(minutes: Int): Int = ((minutes % 1440) + 1440) % 1440

@Composable
private fun SunPathChart(rows: List<Triple<String, Int, Int>>, domainStart: Int, domainEnd: Int, markerMinute: Int?) {
    Canvas(Modifier.fillMaxWidth().height(132.dp)) {
        val horizonY = size.height - 14.dp.toPx()
        val edgePadding = 6.dp.toPx()
        val drawableWidth = (size.width - edgePadding * 2).coerceAtLeast(1f)
        val domainSpan = (domainEnd - domainStart).coerceAtLeast(1)
        val xForTime: (Int) -> Float = { minutes ->
            edgePadding + drawableWidth * (minutes.coerceIn(domainStart, domainEnd) - domainStart) / domainSpan.toFloat()
        }
        drawRect(Color(0xFF16212D).copy(alpha = .72f), Offset(0f, horizonY), Size(size.width, size.height - horizonY))
        drawLine(Muted.copy(alpha = .45f), Offset(0f, horizonY), Offset(size.width, horizonY), strokeWidth = 2.dp.toPx())
        listOf(2, 0, 1).forEach { index ->
            val (_, rise, set) = rows[index]
            val startX = xForTime(rise)
            val endX = xForTime(set)
            val midpoint = (startX + endX) / 2f
            val apexY = when (index) {
                0 -> horizonY - 55.dp.toPx()
                1 -> horizonY - 78.dp.toPx()
                else -> horizonY - 105.dp.toPx()
            }
            val color = sunlightColor(index)
            val path = Path().apply {
                moveTo(startX, horizonY)
                quadraticTo(midpoint, apexY, endX, horizonY)
            }
            if (index == 1) {
                val glow = Path().apply {
                    moveTo(startX, horizonY)
                    quadraticTo(midpoint, apexY, endX, horizonY)
                    lineTo(startX, horizonY)
                    close()
                }
                drawPath(glow, color.copy(alpha = .08f))
            }
            drawPath(path, color.copy(alpha = if (index == 1) 1f else .72f), style = Stroke(width = if (index == 1) 4.dp.toPx() else 2.dp.toPx(), cap = StrokeCap.Round))
            if (index == 1 && markerMinute != null && markerMinute in rise..set) {
                val progress = (markerMinute - rise).toFloat() / (set - rise).coerceAtLeast(1)
                val sunY = horizonY - 2f * (horizonY - apexY) * progress * (1f - progress)
                val sunX = xForTime(markerMinute)
                drawCircle(color.copy(alpha = .18f), radius = 12.dp.toPx(), center = Offset(sunX, sunY))
                drawCircle(color, radius = 6.dp.toPx(), center = Offset(sunX, sunY))
            }
        }
    }
}

internal fun sunlightDomain(rows: List<Triple<String, Int, Int>>): IntRange {
    val rawStart = rows.minOfOrNull { min(it.second, it.third) }?.coerceIn(0, 1440) ?: 0
    val rawEnd = rows.maxOfOrNull { max(it.second, it.third) }?.coerceIn(0, 1440) ?: 1440
    if (rawEnd - rawStart >= 60) return rawStart..rawEnd
    val center = (rawStart + rawEnd) / 2
    val start = (center - 30).coerceIn(0, 1380)
    return start..(start + 60)
}

@Composable
private fun SunEventSummary(label: String, earliest: Int, current: Int, latest: Int, modifier: Modifier = Modifier) {
    Column(modifier.background(MaterialTheme.colorScheme.background.copy(alpha = .38f), RoundedCornerShape(7.dp)).padding(8.dp)) {
        Text(label, color = MaterialTheme.colorScheme.onSurface, fontSize = 11.sp, fontWeight = FontWeight.Bold)
        SunEventValue(stringResource(R.string.earliest), earliest, sunlightColor(2))
        SunEventValue(stringResource(R.string.current), current, sunlightColor(1))
        SunEventValue(stringResource(R.string.latest), latest, sunlightColor(0))
    }
}

@Composable
private fun SunEventValue(label: String, minutes: Int, color: Color) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = Muted, fontSize = 9.sp)
        Text(formatClockMinutes(minutes), color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold)
    }
}

private fun sunlightColor(index: Int): Color = when (index) {
    0 -> Color(0xFF91A0B4)
    1 -> Color(0xFFFFC83D)
    else -> Color(0xFFED8A42)
}

@Composable
private fun AirQualityDetails(airQuality: eu.vespy.weather.data.AirQualityForecast) {
    val aqi = airQuality.europeanAqi
    val aqiColor = airQualityColor(aqi)
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().background(MaterialTheme.colorScheme.surfaceVariant, RoundedCornerShape(8.dp)).padding(10.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(stringResource(R.string.european_aqi), color = Muted, fontSize = 11.sp)
                Text(aqi?.let { it.toInt().toString() } ?: "-", color = aqiColor, fontSize = 28.sp, fontWeight = FontWeight.Black)
            }
            Text(airQualityLabel(aqi), color = aqiColor, fontSize = 17.sp, fontWeight = FontWeight.Bold)
        }
        PollutantChartRow("PM2.5", airQuality.pm25, 75.0)
        PollutantChartRow("PM10", airQuality.pm10, 150.0)
        PollutantChartRow("NO₂", airQuality.nitrogenDioxide, 340.0)
        PollutantChartRow("O₃", airQuality.ozone, 380.0)
        PollutantChartRow("SO₂", airQuality.sulphurDioxide, 750.0)
        PollutantChartRow("CO", airQuality.carbonMonoxide, 10_000.0)
        Text(stringResource(R.string.air_quality_peak_context), color = Muted, fontSize = 10.sp)
    }
}

@Composable
private fun PollutantChartRow(label: String, value: Double?, scaleMaximum: Double) {
    val fraction = ((value ?: 0.0) / scaleMaximum).toFloat().coerceIn(0f, 1f)
    val color = airQualityColor((fraction * 100).toDouble())
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(label, color = Muted, fontSize = 11.sp, modifier = Modifier.width(44.dp))
        Box(Modifier.weight(1f).height(8.dp).background(Muted.copy(alpha = .18f), RoundedCornerShape(4.dp))) {
            Box(Modifier.fillMaxWidth(fraction).fillMaxHeight().background(color, RoundedCornerShape(4.dp)))
        }
        Text(value?.let { "${String.format(Locale.getDefault(), "%.1f", it)} µg/m³" } ?: "-", color = color, fontSize = 11.sp, fontWeight = FontWeight.Bold, modifier = Modifier.width(92.dp).padding(start = 8.dp), maxLines = 1)
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

private fun airQualityColor(value: Double?): Color = when {
    value == null -> Muted
    value <= 20 -> Color(0xFF55CF8A)
    value <= 40 -> Color(0xFFB3D14B)
    value <= 60 -> Color(0xFFFFC83D)
    value <= 80 -> Color(0xFFFF8A3D)
    else -> Color(0xFFFF4055)
}

@Composable
private fun airQualityLabel(value: Double?): String = stringResource(when {
    value == null -> R.string.air_quality_unavailable
    value <= 20 -> R.string.air_quality_good
    value <= 40 -> R.string.air_quality_fair
    value <= 60 -> R.string.air_quality_moderate
    value <= 80 -> R.string.air_quality_poor
    value <= 100 -> R.string.air_quality_very_poor
    else -> R.string.air_quality_extremely_poor
})

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
    if (minutes >= 1440) return "24:00"
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
    initiallyOpenLocations: Boolean,
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
                        initiallyExpanded = initiallyOpenLocations,
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
                    WeatherSupportingText(stringResource(R.string.forecast_layers_description))
                    ForecastLayerOption(
                        label = stringResource(R.string.timeline_help_sky_title),
                        chartEnabled = null,
                        valuesEnabled = state.displaySettings.showSkyValues,
                        onChartChange = {},
                        onValuesChange = { onDisplaySettings(state.displaySettings.copy(showSkyValues = it)) },
                    )
                    ForecastLayerOption(stringResource(R.string.show_wind), state.displaySettings.showWind, state.displaySettings.showWindValues,
                        { onDisplaySettings(state.displaySettings.copy(showWind = it)) },
                        { onDisplaySettings(state.displaySettings.copy(showWindValues = it)) })
                    ForecastLayerOption(stringResource(R.string.show_uv_index), state.displaySettings.showUvIndex, state.displaySettings.showUvValues,
                        { onDisplaySettings(state.displaySettings.copy(showUvIndex = it)) },
                        { onDisplaySettings(state.displaySettings.copy(showUvValues = it)) })
                    ForecastLayerOption(stringResource(R.string.show_humidity), state.displaySettings.showHumidity, state.displaySettings.showHumidityValues,
                        { onDisplaySettings(state.displaySettings.copy(showHumidity = it)) },
                        { onDisplaySettings(state.displaySettings.copy(showHumidityValues = it)) })
                    ForecastLayerOption(stringResource(R.string.show_pressure), state.displaySettings.showPressure, state.displaySettings.showPressureValues,
                        { onDisplaySettings(state.displaySettings.copy(showPressure = it)) },
                        { onDisplaySettings(state.displaySettings.copy(showPressureValues = it)) })
                    ForecastLayerOption(stringResource(R.string.show_pollen), state.displaySettings.showPollen, state.displaySettings.showPollenValues,
                        { onDisplaySettings(state.displaySettings.copy(showPollen = it)) },
                        { onDisplaySettings(state.displaySettings.copy(showPollenValues = it)) })
                    ForecastLayerOption(stringResource(R.string.show_air_quality), state.displaySettings.showAirQuality, state.displaySettings.showAirQualityValues,
                        { onDisplaySettings(state.displaySettings.copy(showAirQuality = it)) },
                        { onDisplaySettings(state.displaySettings.copy(showAirQualityValues = it)) })
                    ForecastLayerOption(stringResource(R.string.show_mushrooms), state.displaySettings.showMushrooms, state.displaySettings.showMushroomValues,
                        { onDisplaySettings(state.displaySettings.copy(showMushrooms = it)) },
                        { onDisplaySettings(state.displaySettings.copy(showMushroomValues = it)) })
                    SettingSwitch(stringResource(R.string.show_wind_arrows), state.displaySettings.showWindArrows) { onDisplaySettings(state.displaySettings.copy(showWindArrows = it, showWind = if (it) true else state.displaySettings.showWind)) }
                    SettingSwitch(stringResource(R.string.show_historical_data), state.displaySettings.showHistoricalData) { onDisplaySettings(state.displaySettings.copy(showHistoricalData = it)) }
                    SettingSwitch(stringResource(R.string.show_dates), state.displaySettings.showDates) { onDisplaySettings(state.displaySettings.copy(showDates = it)) }
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
private fun ForecastLayerOption(
    label: String,
    chartEnabled: Boolean?,
    valuesEnabled: Boolean,
    onChartChange: (Boolean) -> Unit,
    onValuesChange: (Boolean) -> Unit,
) {
    Surface(
        modifier = Modifier.fillMaxWidth(),
        shape = WeatherFieldShape,
        color = MaterialTheme.colorScheme.surfaceVariant,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = .28f)),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 7.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(label, Modifier.weight(1f), fontSize = 14.sp, fontWeight = FontWeight.SemiBold)
            chartEnabled?.let {
                LayerChoice(stringResource(R.string.chart), it) { onChartChange(!it) }
                Spacer(Modifier.width(6.dp))
            }
            LayerChoice(stringResource(R.string.values), valuesEnabled) { onValuesChange(!valuesEnabled) }
        }
    }
}

@Composable
private fun LayerChoice(label: String, selected: Boolean, onClick: () -> Unit) {
    Button(
        onClick = onClick,
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 10.dp, vertical = 4.dp),
        colors = ButtonDefaults.buttonColors(
            containerColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface,
            contentColor = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant,
        ),
        shape = RoundedCornerShape(8.dp),
    ) { Text(label, fontSize = 11.sp, fontWeight = FontWeight.Bold) }
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
