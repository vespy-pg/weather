package eu.vespy.weather.ui

import android.graphics.Bitmap
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import eu.vespy.weather.R
import eu.vespy.weather.data.WeatherApi
import eu.vespy.weather.data.WeatherLocation
import eu.vespy.weather.data.WidgetDisplaySettings
import eu.vespy.weather.diagnostics.IssueDiagnostics
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@Composable
fun IssueReportDialog(
    appScreenshot: Bitmap?,
    sourceWidgetId: Int? = null,
    sourceWidgetSettings: WidgetDisplaySettings? = null,
    sourceForecastHours: Int? = null,
    sourceLocation: WeatherLocation? = null,
    onDismiss: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var description by remember { mutableStateOf("") }
    var includeDiagnostics by remember { mutableStateOf(true) }
    var submitting by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf(false) }
    var reportId by remember { mutableStateOf<String?>(null) }

    fun close() {
        if (!submitting) {
            if (appScreenshot?.isRecycled == false) appScreenshot.recycle()
            onDismiss()
        }
    }

    AlertDialog(
        onDismissRequest = ::close,
        title = { Text(stringResource(R.string.report_issue), fontWeight = FontWeight.ExtraBold) },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                if (reportId == null) {
                    Text(stringResource(R.string.report_issue_description))
                    OutlinedTextField(
                        value = description,
                        onValueChange = { if (it.length <= 4000) description = it },
                        modifier = Modifier.fillMaxWidth(),
                        minLines = 4,
                        maxLines = 8,
                        label = { Text(stringResource(R.string.report_issue_message)) },
                        enabled = !submitting,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text(stringResource(R.string.report_issue_include_diagnostics), Modifier.weight(1f).padding(end = 10.dp))
                        Switch(checked = includeDiagnostics, onCheckedChange = { includeDiagnostics = it }, enabled = !submitting)
                    }
                    Text(stringResource(R.string.report_issue_privacy), style = androidx.compose.material3.MaterialTheme.typography.bodySmall)
                    if (error) Text(stringResource(R.string.report_issue_failed), color = androidx.compose.material3.MaterialTheme.colorScheme.error)
                } else {
                    Text(stringResource(R.string.report_issue_sent, reportId!!))
                }
            }
        },
        dismissButton = {
            if (reportId == null) TextButton(onClick = ::close, enabled = !submitting) { Text(stringResource(R.string.close)) }
        },
        confirmButton = {
            if (reportId != null) {
                Button(onClick = ::close) { Text(stringResource(R.string.close)) }
            } else {
                Button(
                    enabled = description.trim().length >= 10 && !submitting,
                    onClick = {
                        submitting = true
                        error = false
                        scope.launch {
                            runCatching {
                                withContext(Dispatchers.IO) {
                                    val report = IssueDiagnostics.buildReport(
                                        context,
                                        description,
                                        includeDiagnostics,
                                        appScreenshot,
                                        sourceWidgetId,
                                        sourceWidgetSettings,
                                        sourceForecastHours,
                                        sourceLocation,
                                    )
                                    WeatherApi().submitIssueReport(report)
                                }
                            }.onSuccess { reportId = it }
                                .onFailure { error = true }
                            submitting = false
                        }
                    },
                ) {
                    if (submitting) CircularProgressIndicator(modifier = Modifier.size(18.dp).padding(end = 4.dp), strokeWidth = 2.dp)
                    Text(stringResource(R.string.report_issue_send))
                }
            }
        },
    )
}
