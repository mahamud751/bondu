# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# Stripe's optional push-provisioning (Apple/Google Pay tap-to-pay) module isn't bundled
# since this app doesn't use it; its classes are only referenced, never loaded.
-dontwarn com.stripe.android.pushProvisioning.**
