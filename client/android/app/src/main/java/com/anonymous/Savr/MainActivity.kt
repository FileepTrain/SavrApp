package com.anonymous.Savr
import expo.modules.splashscreen.SplashScreenManager

import android.os.Build
import android.os.Bundle

import android.util.Log
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.location.Location
import android.location.LocationManager
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.activity.result.contract.ActivityResultContracts
import androidx.lifecycle.lifecycleScope
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import kotlin.coroutines.resume
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.launch


import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

import expo.modules.ReactActivityDelegateWrapper

class MainActivity : ReactActivity() {

    lateinit var fusedClient: FusedLocationProviderClient
    lateinit var locationHelper: LocationHelper

    private var locationCallback: ((Location?) -> Unit)? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        // Set the theme to AppTheme BEFORE onCreate to support
        // coloring the background, status bar, and navigation bar.
        // This is required for expo-splash-screen.
        // setTheme(R.style.AppTheme);
        // @generated begin expo-splashscreen - expo prebuild (DO NOT MODIFY) sync-f3ff59a738c56c9a6119210cb55f0b613eb8b6af
        SplashScreenManager.registerOnActivity(this)
        // @generated end expo-splashscreen
        super.onCreate(null)

        fusedClient = LocationServices.getFusedLocationProviderClient(this)
        locationHelper = LocationHelper(this, fusedClient)
    }

    /**
     * Returns the name of the main component registered from JavaScript. This is used to schedule
     * rendering of the component.
     */
    override fun getMainComponentName(): String = "main"

    /**
     * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
     * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
     */
    override fun createReactActivityDelegate(): ReactActivityDelegate {
        return ReactActivityDelegateWrapper(
            this,
            BuildConfig.IS_NEW_ARCHITECTURE_ENABLED,
            object : DefaultReactActivityDelegate(
                this,
                mainComponentName,
                fabricEnabled
            ) {})
    }

    /**
     * Align the back button behavior with Android S
     * where moving root activities to background instead of finishing activities.
     * @see <a href="https://developer.android.com/reference/android/app/Activity#onBackPressed()">onBackPressed</a>
     */
    override fun invokeDefaultOnBackPressed() {
        if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.R) {
            if (!moveTaskToBack(false)) {
                // For non-root activities, use the default implementation to finish them.
                super.invokeDefaultOnBackPressed()
            }
            return
        }

        // Use the default back button implementation on Android S
        // because it's doing more than [Activity.moveTaskToBack] in fact.
        super.invokeDefaultOnBackPressed()
    }


    private val locationPermissionRequest = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->

        val fineLocationGranted =
            permissions[android.Manifest.permission.ACCESS_FINE_LOCATION] == true
        val coarseLocationGranted =
            permissions[android.Manifest.permission.ACCESS_COARSE_LOCATION] == true

        if (fineLocationGranted || coarseLocationGranted) {
            lifecycleScope.launch {
                val location = locationHelper.getLocation()
                locationCallback?.invoke(location)
            }
        } else {
            Toast.makeText(this, "Location permission denied", Toast.LENGTH_LONG).show()
            locationCallback?.invoke(null)
        }
    }

    /**
     * call this function to get permission (can be a button)
     * the popup only shows the first time
     * if denied user needs to change in settings
    * */
    fun requestLocationPermission() {   //call this to get permission (can be a button)
        locationPermissionRequest.launch(
            arrayOf(
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }

    private fun getUserLocation() {
        lifecycleScope.launch {
            val location = locationHelper.getLocation()

            if (location != null) {
                Log.d("LOCATION", "Lat: ${location.latitude}, Lng: ${location.longitude}")
            } else {
                Toast.makeText(this@MainActivity, "Could not get location", Toast.LENGTH_SHORT).show()
            }
        }
    }

    fun fetchLocation(callback: (Location?) -> Unit) {
        locationCallback = callback

        locationPermissionRequest.launch(
            arrayOf(
                android.Manifest.permission.ACCESS_FINE_LOCATION,
                android.Manifest.permission.ACCESS_COARSE_LOCATION
            )
        )
    }
}


class LocationHelper(
    private val context: Context,  //used to get access to android systems features (talks to OS)
    private val fusedLocationProviderClient: FusedLocationProviderClient
) {

    @SuppressLint("MissingPermission")
    suspend fun getLocation(): Location? {  // ?: nullable, user has right to deny location

        val hasGrantedFineLocationPermission = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val hasGrantedCoarseLocationPermission = ContextCompat.checkSelfPermission(
            context,
            android.Manifest.permission.ACCESS_COARSE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED

        val locationManager = context.getSystemService(
            Context.LOCATION_SERVICE
        ) as LocationManager

        val isGpsEnabled =
            locationManager.isProviderEnabled(LocationManager.NETWORK_PROVIDER) ||
                    locationManager.isProviderEnabled(LocationManager.GPS_PROVIDER)

        if (!isGpsEnabled || !(hasGrantedCoarseLocationPermission || hasGrantedFineLocationPermission)) {
            return null
        }

        return suspendCancellableCoroutine { cont ->

            fusedLocationProviderClient.lastLocation
                .addOnSuccessListener { location ->
                    cont.resume(location)
                }
                .addOnFailureListener {
                    cont.resume(null)
                }
                .addOnCanceledListener {
                    cont.cancel()
                }
        }
    }
}