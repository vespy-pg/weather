package eu.vespy.weather.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import eu.vespy.weather.R
import eu.vespy.weather.data.WeatherApi
import eu.vespy.weather.data.WeatherLocation
import kotlinx.coroutines.delay
import java.util.Locale

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun LocationControls(
    locations: List<WeatherLocation>,
    selectedLocation: WeatherLocation,
    onSelectLocation: (WeatherLocation) -> Unit,
    onSearchResult: (WeatherLocation) -> Unit,
    modifier: Modifier = Modifier,
    onRemoveLocation: ((WeatherLocation) -> Unit)? = null,
    enabled: Boolean = true,
) {
    var locationMenuExpanded by remember { mutableStateOf(false) }
    var query by remember { mutableStateOf("") }
    var results by remember { mutableStateOf(emptyList<WeatherLocation>()) }
    var hasMoreResults by remember { mutableStateOf(false) }
    var searching by remember { mutableStateOf(false) }
    val api = remember { WeatherApi() }
    val availableLocations = (locations + selectedLocation).distinctBy { "${it.latitude},${it.longitude}" }

    LaunchedEffect(query, enabled) {
        val normalizedQuery = query.trim()
        if (!enabled || normalizedQuery.length < 2) {
            results = emptyList()
            hasMoreResults = false
            searching = false
            return@LaunchedEffect
        }
        delay(350)
        searching = true
        val response = runCatching { api.locations(normalizedQuery, Locale.getDefault().language) }.getOrNull()
        results = response?.locations.orEmpty()
        hasMoreResults = response?.hasMore == true
        searching = false
    }

    Column(modifier, verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Box(Modifier.fillMaxWidth()) {
            Button(
                onClick = { locationMenuExpanded = true },
                enabled = enabled,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.surfaceVariant,
                    contentColor = MaterialTheme.colorScheme.onSurface,
                ),
            ) {
                LocationLabel(selectedLocation, Modifier.weight(1f))
                Text("▾", fontSize = 15.sp)
            }
            DropdownMenu(
                expanded = locationMenuExpanded && enabled,
                onDismissRequest = { locationMenuExpanded = false },
            ) {
                availableLocations.forEach { location ->
                    val selected = location.samePlaceAs(selectedLocation)
                    val saved = locations.any { it.samePlaceAs(location) }
                    DropdownMenuItem(
                        text = { LocationLabel(location, fontWeight = if (selected) FontWeight.Bold else FontWeight.Normal) },
                        trailingIcon = if (onRemoveLocation != null && saved && locations.size > 1) {{
                            TextButton(onClick = {
                                onRemoveLocation(location)
                                if (selected) locationMenuExpanded = false
                            }) { Text(stringResource(R.string.remove)) }
                        }} else null,
                        onClick = {
                            locationMenuExpanded = false
                            onSelectLocation(location)
                        },
                    )
                }
            }
        }
        ExposedDropdownMenuBox(
            expanded = enabled && query.trim().length >= 2 && !searching && results.isNotEmpty(),
            onExpandedChange = {},
            modifier = Modifier.fillMaxWidth(),
        ) {
            OutlinedTextField(
                value = query,
                onValueChange = {
                    query = it
                    results = emptyList()
                    hasMoreResults = false
                },
                enabled = enabled,
                modifier = Modifier.menuAnchor(ExposedDropdownMenuAnchorType.PrimaryEditable).fillMaxWidth(),
                singleLine = true,
                label = { Text(stringResource(R.string.search_location), fontSize = 14.sp) },
                trailingIcon = if (searching) {{ CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp) }} else null,
            )
            ExposedDropdownMenu(
                expanded = enabled && query.trim().length >= 2 && !searching && results.isNotEmpty(),
                onDismissRequest = {
                    results = emptyList()
                    hasMoreResults = false
                },
            ) {
                results.forEach { location ->
                    DropdownMenuItem(
                        text = { LocationLabel(location) },
                        onClick = {
                            onSearchResult(location)
                            query = ""
                            results = emptyList()
                            hasMoreResults = false
                        },
                    )
                }
                if (hasMoreResults) {
                    DropdownMenuItem(
                        text = { Text(stringResource(R.string.more_locations_available), fontSize = 12.sp) },
                        enabled = false,
                        onClick = {},
                    )
                }
            }
        }
    }
}

@Composable
private fun LocationLabel(location: WeatherLocation, modifier: Modifier = Modifier, fontWeight: FontWeight = FontWeight.Normal) {
    Column(modifier) {
        Text(location.name, fontSize = 15.sp, fontWeight = fontWeight, maxLines = 1, overflow = TextOverflow.Ellipsis)
        location.details()?.let { details ->
            Text(details, color = MaterialTheme.colorScheme.onSurfaceVariant, fontSize = 10.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
    }
}

private fun WeatherLocation.details(): String? {
    val seen = mutableSetOf(name.lowercase(Locale.ROOT))
    return listOf(postalCode, admin3, admin2, admin1, country)
        .mapNotNull { value -> value?.trim()?.takeIf(String::isNotEmpty) }
        .filter { seen.add(it.lowercase(Locale.ROOT)) }
        .joinToString(", ")
        .takeIf(String::isNotEmpty)
}

private fun WeatherLocation.samePlaceAs(other: WeatherLocation): Boolean =
    latitude == other.latitude && longitude == other.longitude
