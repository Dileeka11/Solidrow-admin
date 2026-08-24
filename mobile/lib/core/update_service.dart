import 'package:dio/dio.dart';
import 'package:package_info_plus/package_info_plus.dart';

import 'api_client.dart';

/// Result of an app-version check against the backend.
class AppUpdateInfo {
  final String latestVersion;
  final int latestBuild;
  final String? apkUrl;
  final bool forceUpdate;
  final String notes;

  AppUpdateInfo({
    required this.latestVersion,
    required this.latestBuild,
    required this.apkUrl,
    required this.forceUpdate,
    required this.notes,
  });

  bool get canDownload => apkUrl != null && apkUrl!.isNotEmpty;

  factory AppUpdateInfo.fromJson(Map<String, dynamic> json) {
    return AppUpdateInfo(
      latestVersion: (json['latest_version'] ?? '').toString(),
      latestBuild: (json['latest_build'] as num?)?.toInt() ?? 0,
      apkUrl: (json['apk_url'] as String?)?.trim(),
      forceUpdate: json['force_update'] == true,
      notes: (json['notes'] ?? '').toString(),
    );
  }
}

/// Checks the backend for a newer app build. Compares the installed build
/// number (from the APK's `versionCode`) against the server's `latest_build`.
class AppUpdateService {
  AppUpdateService._();

  /// Returns update info when a newer build is available and downloadable,
  /// otherwise `null`. Never throws — a failed check simply lets the app run.
  static Future<AppUpdateInfo?> check() async {
    try {
      final info = await PackageInfo.fromPlatform();
      final currentBuild = int.tryParse(info.buildNumber) ?? 0;

      final res = await ApiClient.get('/app-version');
      final update = AppUpdateInfo.fromJson(res.data as Map<String, dynamic>);

      if (update.latestBuild > currentBuild && update.canDownload) {
        return update;
      }
      return null;
    } on DioException {
      return null;
    } catch (_) {
      return null;
    }
  }
}
