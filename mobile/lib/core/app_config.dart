/// Central configuration for the Solidrow Staff App.
/// Change [baseUrl] to match your Laravel backend address.
class AppConfig {
  /// Base URL of the Laravel API (no trailing slash).
  /// For local dev on a physical Android device, use your machine's LAN IP:
  ///   e.g. http://192.168.1.100:8000
  /// For an emulator connecting to host: http://10.0.2.2:8000
  static const String baseUrl = 'https://registration.solidrow.lk';

  static const Duration connectTimeout = Duration(seconds: 15);
  static const Duration receiveTimeout = Duration(seconds: 30);
}
