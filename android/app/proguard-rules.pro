# Add project specific ProGuard rules here.
# You can control the set of applied configuration files using the
# proguardFiles setting in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Capacitor, if installed
-keep class com.getcapacitor.** { *; }
-keep class com.getcapacitor.android.** { *; }
-keep class com.getcapacitor.plugin.** { *; }
-keep class com.getcapacitor.plugin.bridge.** { *; }

# Preserve the Capacitor JavaScript interface used by the WebView bridge.
-keepclassmembers class * extends com.getcapacitor.Plugin {
    <fields>;
    <methods>;
}
-keepclassmembers class * {
    @com.getcapacitor.annotation.CapacitorPlugin *;
}

# WebView JavascriptInterface methods must not be renamed/removed.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Keep native methods referenced from JS
-keepclasseswithmembernames class * {
    native <methods>;
}

# If your project uses WebView with JS, uncomment the following
# and specify the fully qualified class name to the JavaScript interface
# class:
#-keepclassmembers class fqcn.of.javascript.interface.for.webview {
#   public *;
#}

# Uncomment this to preserve the line number information for
# debugging stack traces.
#-keepattributes SourceFile,LineNumberTable

# If you keep the line number information, uncomment this to
# hide the original source file name.
#-renamesourcefileattribute SourceFile