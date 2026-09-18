package eu.vespy.weather

import android.content.Context
import android.os.Bundle
import android.content.Intent
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import eu.vespy.weather.ui.VespyWeatherApp
import eu.vespy.weather.ui.WeatherViewModel
import eu.vespy.weather.ui.hideNavigationControls
import eu.vespy.weather.data.WeatherLocation

class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<WeatherViewModel>()

    override fun attachBaseContext(newBase: Context) {
        super.attachBaseContext(newBase.withSavedAppLocale())
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            VespyWeatherApp(viewModel)
        }
        openWidgetLocation(intent)
        hideNavigationControls(window)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        openWidgetLocation(intent)
    }

    private fun openWidgetLocation(intent: Intent?) {
        if (intent?.action != "eu.vespy.weather.OPEN_WIDGET_LOCATION") return
        intent.action = null
        if (intent.getBooleanExtra("widget_demo", false)) {
            viewModel.showDemo()
            return
        }
        val name = intent.getStringExtra("widget_location_name") ?: return
        if (!intent.hasExtra("widget_location_latitude") || !intent.hasExtra("widget_location_longitude")) return
        val location = WeatherLocation(
            name = name,
            country = intent.getStringExtra("widget_location_country").orEmpty(),
            latitude = intent.getDoubleExtra("widget_location_latitude", 0.0),
            longitude = intent.getDoubleExtra("widget_location_longitude", 0.0),
            timezone = intent.getStringExtra("widget_location_timezone") ?: "auto",
        )
        viewModel.selectLocation(location, true)
    }

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) hideNavigationControls(window)
    }
}
