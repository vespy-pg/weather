package eu.vespy.weather.widget

import android.app.Activity
import android.appwidget.AppWidgetManager
import android.content.Context
import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
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
    surfaceVariant = Color(0xFF151C27),
    primary = Color(0xFF58A6FF),
    onPrimary = Color(0xFF07111E),
)

private val widgetLightColors = lightColorScheme(
    background = Color(0xFFEDF3F9),
    surfaceVariant = Color.White,
    primary = Color(0xFF176FC1),
    onPrimary = Color.White,
)

@Composable
private fun WidgetLocationPicker(
    locations: List<WeatherLocation>,
    initialLocation: WeatherLocation,
    initialForecastHours: Int,
    initialWidgetSettings: WidgetDisplaySettings,
    onRemoveLocation: (WeatherLocation) -> Unit,
    onSave: (WeatherLocation, Int, WidgetDisplaySettings) -> Unit,
) {
    var savedLocations by remember { mutableStateOf(locations) }
    var forecastHours by remember { mutableStateOf(initialForecastHours) }
    var forecastMenuExpanded by remember { mutableStateOf(false) }
    var selectedLocation by remember { mutableStateOf(initialLocation) }
    var widgetSettings by remember { mutableStateOf(initialWidgetSettings) }
    val systemDark = isSystemInDarkTheme()
    val dark = when (widgetSettings.theme) {
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
                    modifier = Modifier.weight(1f).verticalScroll(rememberScrollState()).padding(24.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    Text(stringResource(R.string.choose_widget_location), fontSize = 26.sp, fontWeight = FontWeight.ExtraBold)
                    Text(stringResource(R.string.choose_widget_location_description), color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(stringResource(R.string.saved_locations), fontSize = 16.sp, fontWeight = FontWeight.Bold)
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
                    Text(stringResource(R.string.widget_forecast_length), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    Box(modifier = Modifier.fillMaxWidth()) {
                        Button(
                            onClick = { forecastMenuExpanded = true },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Text("${forecastLengths.first { it.first == forecastHours }.second}  \u25BE")
                        }
                        DropdownMenu(
                            expanded = forecastMenuExpanded,
                            onDismissRequest = { forecastMenuExpanded = false },
                        ) {
                            forecastLengths.forEach { (hours, label) ->
                                DropdownMenuItem(
                                    text = { Text(label, fontWeight = if (forecastHours == hours) FontWeight.Bold else FontWeight.Normal) },
                                    onClick = {
                                        forecastHours = hours
                                        forecastMenuExpanded = false
                                    },
                                )
                            }
                        }
                    }
                    Text(stringResource(R.string.color_theme), fontSize = 16.sp, fontWeight = FontWeight.Bold)
                    WidgetThemeOptions(widgetSettings.theme) { widgetSettings = widgetSettings.copy(theme = it) }
                    WidgetSwitch(stringResource(R.string.show_hourly_temperatures), widgetSettings.showHourlyTemperatures) {
                        widgetSettings = widgetSettings.copy(showHourlyTemperatures = it)
                    }
                    WidgetSwitch(stringResource(R.string.show_apparent_temperature), widgetSettings.showApparentTemperature) {
                        widgetSettings = widgetSettings.copy(showApparentTemperature = it)
                    }
                    WidgetSwitch(stringResource(R.string.show_precipitation), widgetSettings.showPrecipitation) {
                        widgetSettings = widgetSettings.copy(showPrecipitation = it)
                    }
                    WidgetSwitch(stringResource(R.string.show_wind_arrows), widgetSettings.showWindArrows) {
                        widgetSettings = widgetSettings.copy(showWindArrows = it)
                    }
                    WidgetSwitch(stringResource(R.string.show_mushrooms), widgetSettings.showMushrooms) {
                        widgetSettings = widgetSettings.copy(showMushrooms = it)
                    }
                    WidgetDefaultOrOn(stringResource(R.string.show_widget_location), widgetSettings.forceLocationName) {
                        widgetSettings = widgetSettings.copy(forceLocationName = it)
                    }
                    WidgetSwitch(stringResource(R.string.demo_weather), widgetSettings.demo) {
                        widgetSettings = widgetSettings.copy(demo = it)
                    }
                }
                Button(
                    onClick = { onSave(selectedLocation, forecastHours, widgetSettings) },
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 24.dp, vertical = 12.dp),
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
