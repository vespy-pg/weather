package eu.vespy.weather.analytics

import android.content.Context
import android.os.Bundle
import com.google.firebase.analytics.FirebaseAnalytics

class WeatherAnalytics(context: Context, initialConsent: Boolean?) {
    private val analytics = FirebaseAnalytics.getInstance(context)
    private val promotionImpressions = mutableSetOf<String>()
    private var enabled = initialConsent == true

    init {
        initialConsent?.let(::setConsent)
    }

    fun setConsent(granted: Boolean) {
        val analyticsStatus = if (granted) FirebaseAnalytics.ConsentStatus.GRANTED else FirebaseAnalytics.ConsentStatus.DENIED
        analytics.setConsent(
            mapOf(
                FirebaseAnalytics.ConsentType.AD_STORAGE to FirebaseAnalytics.ConsentStatus.DENIED,
                FirebaseAnalytics.ConsentType.AD_USER_DATA to FirebaseAnalytics.ConsentStatus.DENIED,
                FirebaseAnalytics.ConsentType.AD_PERSONALIZATION to FirebaseAnalytics.ConsentStatus.DENIED,
                FirebaseAnalytics.ConsentType.ANALYTICS_STORAGE to analyticsStatus,
            ),
        )
        analytics.setAnalyticsCollectionEnabled(granted)
        enabled = granted
    }

    fun forecastLoaded() = log("forecast_loaded")

    fun locationSelected(source: String) = log("location_selected", "source" to source)

    fun displayPreferenceChanged(preference: String, value: String) = log(
        "display_preference_changed",
        "preference" to preference,
        "value" to value,
    )

    fun promotionImpression(campaignId: String) {
        if (promotionImpressions.add(campaignId)) log("promotion_impression", "campaign_id" to campaignId)
    }

    fun promotionClick(campaignId: String) = log("promotion_click", "campaign_id" to campaignId)

    private fun log(name: String, vararg parameters: Pair<String, String>) {
        if (!enabled) return
        analytics.logEvent(name, Bundle().apply {
            parameters.forEach { (key, value) -> putString(key, value) }
        })
    }
}
