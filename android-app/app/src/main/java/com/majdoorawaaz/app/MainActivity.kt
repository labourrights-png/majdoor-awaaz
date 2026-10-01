package com.majdoorawaaz.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.View
import android.webkit.*
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.content.ContextCompat
import androidx.webkit.WebViewAssetLoader

class MainActivity : AppCompatActivity() {
    private lateinit var webView: WebView
    private var fileCallback: ValueCallback<Array<Uri>>? = null

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val callback = fileCallback
        fileCallback = null
        if (callback == null) return@registerForActivityResult
        val uris = if (result.resultCode == Activity.RESULT_OK) {
            result.data?.let { data ->
                if (data.clipData != null) {
                    Array(data.clipData!!.itemCount) { i -> data.clipData!!.getItemAt(i).uri }
                } else data.data?.let { arrayOf(it) }
            }
        } else null
        callback.onReceiveValue(uris)
    }

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(false)
        webView = WebView(this)
        setContentView(webView)
        configureWebView()
        webView.loadUrl("https://labourrights-png.github.io/majdoor-awaaz/")
        requestNeededPermissions()
    }

    private fun configureWebView() {
        with(webView.settings) {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            allowFileAccess = true
            allowContentAccess = true
            mediaPlaybackRequiresUserGesture = false
            javaScriptCanOpenWindowsAutomatically = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            cacheMode = WebSettings.LOAD_DEFAULT
            userAgentString = userAgentString + " MajdoorAwaazAndroid/1.0"
        }

        webView.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val url = request.url.toString()
                return if (url.startsWith("http://") || url.startsWith("https://")) {
                    if (url.contains("labourrights-png.github.io") || url.contains("script.google.com") ||
                        url.contains("googleapis.com") || url.contains("googleusercontent.com")) {
                        false
                    } else {
                        startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
                        true
                    }
                } else true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onPermissionRequest(request: PermissionRequest) {
                runOnUiThread {
                    val resources = request.resources.toSet()
                    if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) ||
                        resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                        request.grant(request.resources)
                    } else request.deny()
                }
            }

            override fun onShowFileChooser(
                webView: WebView?,
                uploadMsg: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = uploadMsg
                val intent = fileChooserParams?.createIntent() ?: Intent(Intent.ACTION_GET_CONTENT).apply {
                    type = "*/*"
                    addCategory(Intent.CATEGORY_OPENABLE)
                }
                try { filePicker.launch(intent) } catch (_: Exception) {
                    fileCallback = null
                    return false
                }
                return true
            }
        }

        webView.setDownloadListener { url, _, _, _, _ ->
            startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        }
    }

    private fun requestNeededPermissions() {
        val permissions = mutableListOf<String>()
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED)
            permissions += Manifest.permission.RECORD_AUDIO
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED)
            permissions += Manifest.permission.CAMERA
        if (permissions.isNotEmpty()) permissionLauncher.launch(permissions.toTypedArray())
    }

    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }
}
