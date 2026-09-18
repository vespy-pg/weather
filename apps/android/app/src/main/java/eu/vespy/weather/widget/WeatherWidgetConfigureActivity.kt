package eu.vespy.weather.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.Image
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import eu.vespy.weather.R
import eu.vespy.weather.withSavedAppLocale
import eu.vespy.weather.data.WeatherLocation
import eu.vespy.weather.data.WeatherPreferences
import eu.vespy.weather.data.WidgetDisplaySettings
import eu.vespy.weather.ui.DEFAULT_LOCATIONS
import eu.vespy.weather.ui.LEGACY_DEFAULT_LOCATIONS
import eu.vespy.weather.ui.LocationControls
import eu.vespy.weather.ui.WeatherFieldShape
import eu.vespy.weather.ui.WeatherPanelShape
import eu.vespy.weather.ui.WeatherSettingsSection
import eu.vespy.weather.ui.WeatherSupportingText
import eu.vespy.weather.ui.hideNavigationControls

class WeatherWidgetConfigureActivity : ComponentActivity() {
    private var widgetId = AppWidgetManager.INVALID_APPWIDGET_ID

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(newBase.withSavedAppLocale())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setResult(Activity.RESULT_CANCELED)
        widgetId = intent?.extras?.getInt(
            AppWidgetManager.EXTRA_APPWIDGET_ID,
            AppWidgetManager.INVALID_APPWIDGET_ID,
        ) ?: AppWidgetManager.INVALID_APPWIDGET_ID
        if (widgetId == AppWidgetManager.INVALID_APPWIDGET_ID) {
            finish()
            return
        }
        val preferences = WeatherPreferences(this)
        val locations = preferences.migrateLegacyDefaultLocations(DEFAULT_LOCATIONS, LEGACY_DEFAULT_LOCATIONS)
        val initialLocation = preferences.widgetLocation(widgetId, locations.firstOrNull() ?: DEFAULT_LOCATIONS.first())
        setContent {
            WidgetLocationPicker(
                locations = locations,
                initialLocation = initialLocation,
                initialForecastHours = preferences.widgetForecastHours(widgetId),
                initialWidgetSettings = preferences.widgetDisplaySettings(widgetId),
                initialAppTheme = preferences.displaySettings().theme,
                onBack = ::finish,
                onRemoveLocation = { removed ->
                    val saved = preferences.locations(DEFAULT_LOCATIONS)
                    if (saved.size > 1) preferences.saveLocations(saved.filterNot { it.samePlaceAs(removed) })
                },
            ) { location, forecastHours, widgetSettings ->
                    preferences.saveWidgetLocation(widgetId, location)
                    preferences.saveWidgetForecastHours(widgetId, forecastHours)
                    preferences.saveWidgetDisplaySettings(widgetId, widgetSettings)
                    WeatherWidgetProvider.refresh(this, widgetId)
                    setResult(Activity.RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
                    finish()
            }
        }
        hideNavigationControls(window)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideNavigationControls(window)
    }
}

private val widgetDarkColors = darkColorScheme(
    background = Color(0xFF080C12),
    surface = Color(0xFF111923),
    surfaceVariant = Color(0xFF0B1420),
    primary = Color(0xFF58A6FF),
    onPrimary = Color(0xFF07111E),
    onSurface = Color(0xFFE7EDF7),
    onSurfaceVariant = Color(0xFF9AA8BA),
    outline = Color(0xFF3A5672),
)

private val widgetLightColors = lightColorScheme(
    background = Color(0xFFEDF3F9),
    surface = Color.White,
    surfaceVariant = Color(0xFFF5F8FC),
    primary = Color(0xFF176FC1),
    onPrimary = Color.White,
    onSurface = Color(0xFF172234),
    onSurfaceVariant = Color(0xFF5B6B80),
    outline = Color(0xFF9AAFC4),
)

@Composable
private fun WidgetLocationPicker(
    locations: List<WeatherLocation>,
    initialLocation: WeatherLocation,
    initialForecastHours: Int,
    initialWidgetSettings: WidgetDisplaySettings,
    initialAppTheme: String,
    onBack: () -> Unit,
    onRemoveLocation: (WeatherLocation) -> Unit,
    onSave: (WeatherLocation, Int, WidgetDisplaySettings) -> Unit,
) {
    var savedLocations by remember { mutableStateOf(locations) }
    var forecastHours by remember { mutableStateOf(initialForecastHours) }
    var forecastMenuExpanded by remember { mutableStateOf(false) }
    var selectedLocation by remember { mutableStateOf(initialLocation) }
    var widgetSettings by remember { mutableStateOf(initialWidgetSettings) }
    val systemDark = isSystemInDarkTheme()
    val dark = when (initialAppTheme) {
        "light" -> false
        "system" -> systemDark
        else -> true
    }
    val forecastLengths = (6..120 step 6).map { hours ->
        val days = (hours / 24.0).toString().trimEnd('0').trimEnd('.')
        hours to stringResource(R.string.widget_forecast_option, hours, days)
    }
    MaterialTheme(colorScheme = if (dark) widgetDarkColors else widgetLightColors) {
        Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
            Column(
                modifier = Modifier.statusBarsPadding().navigationBarsPadding(),
            ) {
                Column(
                    modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(horizontal = 18.dp, vertical = 16.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("‹", modifier = Modifier.clickable(onClick = onBack).padding(end = 14.dp), fontSize = 38.sp, fontWeight = FontWeight.Light)
                        Column {
                            Text(
                                stringResource(R.string.widget_settings_eyebrow).uppercase(),
                                color = MaterialTheme.colorScheme.primary,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 10.sp,
                                fontWeight = FontWeight.Black,
                                letterSpacing = 1.2.sp,
                            )
                            Text(stringResource(R.string.widget_settings_title), fontSize = 25.sp, fontWeight = FontWeight.ExtraBold)
                        }
                    }
                    Surface(
                        shape = WeatherPanelShape,
                        color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .18f)),
                    ) {
                        Row(Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                            Surface(
                                modifier = Modifier.width(122.dp).height(72.dp),
                                shape = WeatherFieldShape,
                                color = Color(0xFF09111B),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .4f)),
                            ) {
                                Image(
                                    painter = painterResource(R.drawable.widget_preview_chart),
                                    contentDescription = null,
                                    contentScale = ContentScale.FillBounds,
                                )
                            }
                            Column(Modifier.padding(start = 14.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                                Text(selectedLocation.name, fontSize = 17.sp, fontWeight = FontWeight.ExtraBold, maxLines = 1)
                                WeatherSupportingText(forecastLengths.first { it.first == forecastHours }.second)
                            }
                        }
                    }
                    WeatherSettingsSection(stringResource(R.string.widget_location_section)) {
                        LocationControls(
                            locations = savedLocations,
                            selectedLocation = selectedLocation,
                            onSelectLocation = { selectedLocation = it },
                            onSearchResult = { selectedLocation = it },
                            onRemoveLocation = { removed ->
                                if (savedLocations.size > 1) {
                                    savedLocations = savedLocations.filterNot { it.samePlaceAs(removed) }
                                    onRemoveLocation(removed)
                                }
                            },
                            enabled = !widgetSettings.demo,
                        )
                        WeatherSupportingText(stringResource(R.string.choose_widget_location_description))
                    }
                    WeatherSettingsSection(stringResource(R.string.widget_forecast_length)) {
                        Box(modifier = Modifier.fillMaxWidth()) {
                            Button(
                                onClick = { forecastMenuExpanded = true },
                                modifier = Modifier.fillMaxWidth().height(52.dp),
                                shape = WeatherFieldShape,
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                                    contentColor = MaterialTheme.colorScheme.onSurface,
                                ),
                                border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = .28f)),
                            ) {
                                Text(forecastLengths.first { it.first == forecastHours }.second, Modifier.weight(1f), fontWeight = FontWeight.Bold)
                                Text("▾")
                            }
                            DropdownMenu(expanded = forecastMenuExpanded, onDismissRequest = { forecastMenuExpanded = false }) {
                                forecastLengths.forEach { (hours, label) ->
                                    DropdownMenuItem(
                                        text = { Text(label, fontWeight = if (forecastHours == hours) FontWeight.Bold else FontWeight.Normal) },
                                        onClick = { forecastHours = hours; forecastMenuExpanded = false },
                                    )
                                }
                            }
                        }
                    }
                    WeatherSettingsSection(stringResource(R.string.widget_appearance_section)) {
                        WidgetThemeOptions(widgetSettings.theme) { widgetSettings = widgetSettings.copy(theme = it) }
                    }
                    WeatherSettingsSection(stringResource(R.string.widget_display_section)) {
                        WidgetSwitch(stringResource(R.string.show_hourly_temperatures), widgetSettings.showHourlyTemperatures) { widgetSettings = widgetSettings.copy(showHourlyTemperatures = it) }
                        WidgetSwitch(stringResource(R.string.show_apparent_temperature), widgetSettings.showApparentTemperature) { widgetSettings = widgetSettings.copy(showApparentTemperature = it) }
                        WidgetSwitch(stringResource(R.string.show_precipitation), widgetSettings.showPrecipitation) { widgetSettings = widgetSettings.copy(showPrecipitation = it) }
                        WidgetSwitch(stringResource(R.string.show_wind_arrows), widgetSettings.showWindArrows) { widgetSettings = widgetSettings.copy(showWindArrows = it) }
                        WidgetSwitch(stringResource(R.string.show_mushrooms), widgetSettings.showMushrooms) { widgetSettings = widgetSettings.copy(showMushrooms = it) }
                        WidgetDefaultOrOn(stringResource(R.string.show_widget_location), widgetSettings.forceLocationName) { widgetSettings = widgetSettings.copy(forceLocationName = it) }
                        WidgetSwitch(stringResource(R.string.demo_weather), widgetSettings.demo) { widgetSettings = widgetSettings.copy(demo = it) }
                    }
                }
                Button(
                    onClick = { onSave(selectedLocation, forecastHours, widgetSettings) },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp, vertical = 12.dp).height(52.dp),
                    shape = RoundedCornerShape(12.dp),
                ) {
                    Text(stringResource(R.string.save_widget_settings))
                }
            }
        }
    }
}

@Composable
private fun WidgetThemeOptions(selected: String, onSelect: (String) -> Unit) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(
            "system" to stringResource(R.string.system_default),
            "dark" to stringResource(R.string.dark_theme),
            "light" to stringResource(R.string.light_theme),
        ).forEach { (value, label) ->
            Button(
                onClick = { onSelect(value) },
                modifier = Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 8.dp, vertical = 8.dp),
                colors = ButtonDefaults.buttonColors(
                    containerColor = if (selected == value) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant,
                    contentColor = if (selected == value) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface,
                ),
            ) { Text(label, fontSize = 13.sp, maxLines = 1) }
        }
    }
}

@Composable
private fun WidgetSwitch(label: String, checked: Boolean, onCheckedChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().clickable { onCheckedChange(!checked) }.padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, modifier = Modifier.weight(1f).padding(end = 12.dp), fontSize = 16.sp)
        Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
}

@Composable
private fun WidgetDefaultOrOn(label: String, forceOn: Boolean, onChange: (Boolean) -> Unit) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, modifier = Modifier.weight(1f).padding(end = 12.dp), fontSize = 16.sp)
        Button(onClick = { onChange(!forceOn) }) {
            Text(stringResource(if (forceOn) R.string.on_value else R.string.default_value))
        }
    }
}

private fun WeatherLocation.samePlaceAs(other: WeatherLocation): Boolean =
    latitude == other.latitude && longitude == other.longitude
