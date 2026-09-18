package eu.vespy.weather.data

import android.net.Uri
import eu.vespy.weather.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class WeatherApi(private val baseUrl: String = BuildConfig.API_BASE_URL) {
    suspend fun locations(query: String, language: String): List<WeatherLocation> = withContext(Dispatchers.IO) {
        val url = endpoint("locations").buildUpon()
            .appendQueryParameter("q", query)
            .appendQueryParameter("language", language)
            .build()
        val results = request(url).optJSONArray("results") ?: JSONArray()
        buildList {
            for (index in 0 until results.length()) {
                val item = results.optJSONObject(index) ?: continue
                val name = item.optString("name").takeIf(String::isNotBlank) ?: continue
                add(WeatherLocation(
                    name = name,
                    country = item.optString("country"),
                    latitude = item.optDouble("latitude"),
                    longitude = item.optDouble("longitude"),
                    timezone = item.optString("timezone").takeIf(String::isNotBlank) ?: "auto",
                    admin1 = item.optString("admin1").takeIf(String::isNotBlank),
                    admin2 = item.optString("admin2").takeIf(String::isNotBlank),
                    postalCode = item.optString("postalCode").takeIf(String::isNotBlank),
                ))
            }
        }
    }

    suspend fun forecast(location: WeatherLocation, pastDays: Int = 0, includeMushrooms: Boolean = false): WeatherForecast = withContext(Dispatchers.IO) {
        val url = endpoint("weather").buildUpon()
            .appendQueryParameter("latitude", location.latitude.toString())
            .appendQueryParameter("longitude", location.longitude.toString())
            .appendQueryParameter("timezone", location.timezone)
            .appendQueryParameter("name", location.name)
            .appendQueryParameter("past_days", pastDays.coerceIn(0, 3).toString())
            .appendQueryParameter("mushrooms", if (includeMushrooms) "1" else "0")
            .build()
        parseForecast(request(url), location)
    }

    suspend fun reverseLocation(latitude: Double, longitude: Double, language: String): WeatherLocation = withContext(Dispatchers.IO) {
        val url = endpoint("reverse-location").buildUpon()
            .appendQueryParameter("latitude", latitude.toString())
            .appendQueryParameter("longitude", longitude.toString())
            .appendQueryParameter("timezone", "auto")
            .appendQueryParameter("language", language)
            .build()
        val item = request(url).getJSONObject("location")
        WeatherLocation(
            name = item.optString("name").ifBlank { "Current location" },
            country = item.optString("country"),
            latitude = item.optDouble("latitude", latitude),
            longitude = item.optDouble("longitude", longitude),
            timezone = item.optString("timezone").ifBlank { "auto" },
            admin1 = item.optString("admin1").takeIf(String::isNotBlank),
            admin2 = item.optString("admin2").takeIf(String::isNotBlank),
            postalCode = item.optString("postalCode").takeIf(String::isNotBlank),
        )
    }

    suspend fun promotions(language: String, theme: String, placement: String): PromotionFeed = withContext(Dispatchers.IO) {
        val url = endpoint("promotions").buildUpon()
            .appendQueryParameter("platform", "android")
            .appendQueryParameter("placement", placement)
            .appendQueryParameter("language", language)
            .appendQueryParameter("theme", theme)
            .build()
        val feed = request(url)
        val campaigns = feed.optJSONArray("campaigns") ?: JSONArray()
        val parsedCampaigns = buildList {
            for (index in 0 until campaigns.length()) {
                val item = campaigns.optJSONObject(index) ?: continue
                val type = item.optString("type")
                if (type !in setOf("native-card", "image-banner")) continue
                add(Promotion(
                    id = item.optString("id"),
                    type = type,
                    eyebrow = item.optString("eyebrow"),
                    title = item.optString("title"),
                    description = item.optString("description"),
                    actionLabel = item.optString("actionLabel"),
                    targetUrl = safeHttpsUrl(item.optString("targetUrl")) ?: continue,
                    logoUrl = safeAssetUrl(item.optNullableString("logoUrl")),
                    imageUrl = safeAssetUrl(item.optNullableString("imageUrl")),
                    imageAlt = item.optNullableString("imageAlt"),
                    backgroundColor = item.optNullableString("backgroundColor"),
                    accentColor = item.optNullableString("accentColor"),
                    priority = item.optInt("priority", 0),
                ))
            }
        }.sortedByDescending(Promotion::priority)
        PromotionFeed(parsedCampaigns, feed.optInt("rotationSeconds", 8).coerceIn(3, 300))
    }

    private fun safeHttpsUrl(value: String?): String? = value?.let {
        runCatching { URL(it) }.getOrNull()?.takeIf { url -> url.protocol == "https" }?.toString()
    }

    private fun safeAssetUrl(value: String?): String? = value?.let {
        runCatching { URL(URL(BuildConfig.API_BASE_URL), it) }.getOrNull()
            ?.takeIf { url -> url.protocol == "https" }
            ?.toString()
    }

    private fun endpoint(path: String): Uri = Uri.parse(baseUrl.trimEnd('/') + "/" + path)

    private fun request(uri: Uri): JSONObject {
        val connection = URL(uri.toString()).openConnection() as HttpURLConnection
        return try {
            connection.connectTimeout = 8_000
            connection.readTimeout = 12_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("User-Agent", "VespyWeather-Android/${BuildConfig.VERSION_NAME}")
            if (connection.responseCode !in 200..299) error("Server returned ${connection.responseCode}")
            JSONObject(connection.inputStream.bufferedReader().use { it.readText() })
        } finally {
            connection.disconnect()
        }
    }

    private fun parseForecast(source: JSONObject, fallbackLocation: WeatherLocation): WeatherForecast {
        val locationSource = source.optJSONObject("location")
        val location = WeatherLocation(
            name = locationSource?.optString("name")?.takeIf(String::isNotBlank) ?: fallbackLocation.name,
            country = locationSource?.optString("country") ?: fallbackLocation.country,
            latitude = locationSource?.optDouble("latitude") ?: fallbackLocation.latitude,
            longitude = locationSource?.optDouble("longitude") ?: fallbackLocation.longitude,
            timezone = locationSource?.optString("timezone")?.takeIf(String::isNotBlank) ?: fallbackLocation.timezone,
        )
        val currentSource = source.getJSONObject("current")
        val current = CurrentWeather(
            timestamp = currentSource.optString("timestamp"),
            temperature = currentSource.optNullableDouble("temperature"),
            apparentTemperature = currentSource.optNullableDouble("apparentTemperature"),
            precipitation = currentSource.optNullableDouble("precipitation"),
            windSpeed = currentSource.optNullableDouble("windSpeed"),
        )
        val hourlySource = source.getJSONArray("hourly")
        val hourly = buildList {
            for (index in 0 until hourlySource.length()) {
                val item = hourlySource.getJSONObject(index)
                add(HourlyWeather(
                    timestamp = item.optString("timestamp"),
                    temperature = item.optNullableDouble("temperature"),
                    apparentTemperature = item.optNullableDouble("apparentTemperature"),
                    precipitationProbability = item.optNullableDouble("precipitationProbability"),
                    precipitation = item.optNullableDouble("precipitation"),
                    rain = item.optNullableDouble("rain"),
                    snowfall = item.optNullableDouble("snowfall"),
                    weatherCode = item.optNullableInt("weatherCode"),
                    cloudCover = item.optNullableDouble("cloudCover"),
                    windSpeed = item.optNullableDouble("windSpeed"),
                    windDirection = item.optNullableDouble("windDirection"),
                    windGusts = item.optNullableDouble("windGusts"),
                    tornado = item.optBoolean("tornado", false),
                ))
            }
        }
        val dailySource = source.optJSONArray("daily") ?: JSONArray()
        val daily = buildList {
            for (index in 0 until dailySource.length()) {
                val item = dailySource.getJSONObject(index)
                val mushroom = item.optJSONObject("mushroom")
                add(DailyWeather(
                    date = item.optString("date"),
                    sunrise = item.optNullableString("sunrise"),
                    sunset = item.optNullableString("sunset"),
                    mushroom = mushroom?.let {
                        MushroomCondition(
                            score = it.optNullableInt("score"),
                            level = it.optNullableString("level"),
                            recentRainfall = it.optNullableDouble("recentRainfall"),
                            relativeHumidity = it.optNullableDouble("relativeHumidity"),
                            soilMoisture = it.optNullableDouble("soilMoisture"),
                        )
                    },
                ))
            }
        }
        return WeatherForecast(location, current, hourly, daily)
    }
}

private fun JSONObject.optNullableDouble(name: String): Double? =
    if (isNull(name) || !has(name)) null else optDouble(name).takeUnless(Double::isNaN)

private fun JSONObject.optNullableInt(name: String): Int? =
    if (isNull(name) || !has(name)) null else optInt(name)

private fun JSONObject.optNullableString(name: String): String? =
    if (isNull(name) || !has(name)) null else optString(name).takeIf(String::isNotBlank)
