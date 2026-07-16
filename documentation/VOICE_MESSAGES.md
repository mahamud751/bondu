# Voice messages

The mobile chat composer records AAC/M4A voice notes through `react-native-nitro-sound`. Android requests microphone access at runtime; iOS uses the existing microphone usage declaration. Recording state is visible and clips shorter than 700 ms are rejected locally.

Voice files use the same private `CHAT` upload path as other attachments. The API validates ownership and MIME type, scans the object, and creates a paid `VOICE` message only after the asset is `READY`. Playback requests the protected file endpoint with the current bearer token, so recordings are not public URLs.

The dependency supports React Native 0.80 and autolinking. Run `pod install` with full Xcode selected before an iOS device build. The current development machine exposes only Command Line Tools, so CocoaPods cannot finish its Xcode-dependent code generation here. See the maintained [Nitro Sound package documentation](https://www.npmjs.com/package/react-native-nitro-sound) for native prerequisites.
