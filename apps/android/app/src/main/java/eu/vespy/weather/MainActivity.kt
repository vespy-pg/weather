package eu.vespy.weather

import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.viewModels
import eu.vespy.weather.ui.VespyWeatherApp
import eu.vespy.weather.ui.WeatherViewModel
import eu.vespy.weather.data.WeatherPreferences
import java.util.Locale

class MainActivity : ComponentActivity() {
    private val viewModel by viewModels<WeatherViewModel>()

    override fun attachBaseContext(newBase: Context) {
        val language = WeatherPreferences(newBase).displaySettings().language
        if (language == "system") {
            super.attachBaseContext(newBase)
            return
        }
        val configuration = Configuration(newBase.resources.configuration).apply {
            setLocale(Locale.forLanguageTag(language))
        }
        super.attachBaseContext(newBase.createConfigurationContext(configuration))
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            VespyWeatherApp(viewModel)
        }
    }
}
