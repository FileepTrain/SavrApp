package com.anonymous.Savr

import android.app.Activity
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.Arguments

import com.facebook.react.bridge.*
import com.google.android.gms.location.LocationServices

class LocationModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "LocationModule"

    @ReactMethod
    fun getCurrentLocation(promise: Promise) {
        val activity = reactApplicationContext.currentActivity as? MainActivity

        if (activity == null) {
            promise.reject("NO_ACTIVITY", "MainActivity is null")
            return
        }

        activity.fetchLocation { location ->
            if (location != null) {
                val map = Arguments.createMap()
                map.putDouble("latitude", location.latitude)
                map.putDouble("longitude", location.longitude)
                promise.resolve(map)
            } else {
                promise.reject("LOCATION_ERROR", "Could not get location")
            }
        }
    }
}