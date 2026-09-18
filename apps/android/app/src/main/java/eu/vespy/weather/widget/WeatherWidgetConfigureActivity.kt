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
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Color
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import eu.vespy.weather.R
import eu.vespy.weather.withSavedAppLocale
import eu.vespy.weather.data.WeatherLocation
import eu.vespy.weather.data.WeatherApi
import eu.vespy.weather.data.WeatherPreferences
import eu.vespy.weather.data.WidgetDisplaySettings
import eu.vespy.weather.ui.DEFAULT_LOCATIONS
import eu.vespy.weather.ui.hideNavigationControls
import kotlinx.coroutines.launch
import java.util.Locale

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
        val locations = preferences.locations(DEFAULT_LOCATIONS)
        val initialLocation = preferences.widgetLocation(widgetId, locations.firstOrNull() ?: DEFAULT_LOCATIONS.first())
        setContent {
            val systemDark = isSystemInDarkTheme()
            val dark = when (preferences.displaySettings().theme) {
                "dark" -> true
                "light" -> false
                else -> systemDark
            }
            MaterialTheme(colorScheme = if (dark) widgetDarkColors else widgetLightColors) {
                WidgetLocationPicker(locations, initialLocation, preferences.widgetForecastHours(widgetId), preferences.widgetDisplaySettings(widgetId)) { location, forecastHours, widgetSettings ->
                    preferences.saveWidgetLocation(widgetId, location)
                    preferences.saveWidgetForecastHours(widgetId, forecastHours)
                    preferences.saveWidgetDisplaySettings(widgetId, widgetSettings)
                    WeatherWidgetProvider.refresh(this, widgetId)
                    setResult(Activity.RESULT_OK, Intent().putExtra(AppWidgetManager.EXTRA_APPWIDGET_ID, widgetId))
                    finish()
                }
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
    onSave: (WeatherLocation, Int, WidgetDisplaySettings) -> Unit,
) {
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf(emptyList<WeatherLocation>()) }
    var searching by remember { mutableStateOf(false) }
    var forecastHours by remember { mutableStateOf(initialForecastHours) }
    var forecastMenuExpanded by remember { mutableStateOf(false) }
    var locationMenuExpanded by remember { mutableStateOf(false) }
    var selectedLocation by remember { mutableStateOf(initialLocation) }
    var widgetSettings by remember { mutableStateOf(initialWidgetSettings) }
    val scope = rememberCoroutineScope()
    fun search() {
        if (query.trim().length < 2 || searching) return
        searching = true
        scope.launch {
            results = runCatching { WeatherApi().locations(query.trim(), Locale.getDefault().language) }.getOrDefault(emptyList())
            searching = false
            locationMenuExpanded = results.isNotEmpty()
        }
    }
    val availableLocations = (locations + results).distinctBy { "${it.latitude},${it.longitude}" }
    val forecastLengths = (6..120 step 6).map { hours ->
        val days = (hours / 24.0).toString().trimEnd('0').trimEnd('.')
        hours to stringResource(R.string.widget_forecast_option, hours, days)
    }
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
                Box(modifier = Modifier.fillMaxWidth()) {
                    Button(
                        onClick = { locationMenuExpanded = true },
                        enabled = !widgetSettings.demo,
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Text(selectedLocation.name, modifier = Modifier.weight(1f), fontSize = 15.sp)
                        Text("▾", fontSize = 15.sp)
                    }
                    DropdownMenu(
                        expanded = locationMenuExpanded && !widgetSettings.demo,
                        onDismissRequest = { locationMenuExpanded = false },
                    ) {
                        availableLocations.forEach { location ->
                            val selected = location.samePlaceAs(selectedLocation)
                            DropdownMenuItem(
                                text = { Text(location.name, fontSize = 15.sp, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                                onClick = {
                                    selectedLocation = location
                                    locationMenuExpanded = false
                                },
                            )
                        }
                    }
                }
                OutlinedTextField(
                    value = query,
                    onValueChange = { query = it },
                    enabled = !widgetSettings.demo,
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    label = { Text(stringResource(R.string.search_location), fontSize = 14.sp) },
                )
                Button(
                    onClick = ::search,
                    enabled = !widgetSettings.demo && query.trim().length >= 2 && !searching,
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    if (searching) CircularProgressIndicator(Modifier.padding(2.dp), strokeWidth = 2.dp)
                    else Text(stringResource(R.string.search), fontSize = 15.sp)
                }
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
                    if (it) locationMenuExpanded = false
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
