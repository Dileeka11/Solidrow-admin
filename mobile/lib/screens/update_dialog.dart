import 'package:flutter/material.dart';
import 'package:ota_update/ota_update.dart';

import '../core/update_service.dart';
import '../main.dart';

/// Blocking "Update required" dialog for the forced in-app update flow.
///
/// Downloads the new APK straight from the backend and hands it to the Android
/// package installer. The dialog cannot be dismissed — the user must update
/// before continuing to use the app.
class UpdateDialog extends StatefulWidget {
  final AppUpdateInfo info;
  const UpdateDialog({super.key, required this.info});

  /// Shows the dialog and keeps it on screen (barrier + back button disabled).
  static Future<void> show(BuildContext context, AppUpdateInfo info) {
    return showDialog<void>(
      context: context,
      barrierDismissible: false,
      builder: (_) => UpdateDialog(info: info),
    );
  }

  @override
  State<UpdateDialog> createState() => _UpdateDialogState();
}

class _UpdateDialogState extends State<UpdateDialog> {
  bool _downloading = false;
  int _progress = 0;
  String? _error;

  void _startUpdate() {
    setState(() {
      _downloading = true;
      _progress = 0;
      _error = null;
    });

    try {
      OtaUpdate()
          .execute(
        widget.info.apkUrl!,
        destinationFilename: 'solidrow-staff.apk',
      )
          .listen(
        (event) {
          if (!mounted) return;
          switch (event.status) {
            case OtaStatus.DOWNLOADING:
              setState(() => _progress = int.tryParse(event.value ?? '0') ?? 0);
              break;
            case OtaStatus.INSTALLING:
            case OtaStatus.INSTALLATION_DONE:
              // Android installer is taking over from here.
              setState(() => _progress = 100);
              break;
            case OtaStatus.CANCELED:
              setState(() {
                _downloading = false;
                _error = 'Update was cancelled. Tap Retry to try again.';
              });
              break;
            case OtaStatus.ALREADY_RUNNING_ERROR:
            case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
            case OtaStatus.INTERNAL_ERROR:
            case OtaStatus.DOWNLOAD_ERROR:
            case OtaStatus.INSTALLATION_ERROR:
            case OtaStatus.CHECKSUM_ERROR:
              setState(() {
                _downloading = false;
                _error = _messageFor(event.status);
              });
              break;
          }
        },
        onError: (_) {
          if (!mounted) return;
          setState(() {
            _downloading = false;
            _error = 'Download failed. Please check your connection and retry.';
          });
        },
      );
    } catch (_) {
      setState(() {
        _downloading = false;
        _error = 'Could not start the update. Please try again.';
      });
    }
  }

  String _messageFor(OtaStatus status) {
    switch (status) {
      case OtaStatus.PERMISSION_NOT_GRANTED_ERROR:
        return 'Please allow "Install unknown apps" for Solidrow Staff, then retry.';
      case OtaStatus.DOWNLOAD_ERROR:
        return 'Download failed. Please check your connection and retry.';
      case OtaStatus.ALREADY_RUNNING_ERROR:
        return 'An update is already in progress.';
      default:
        return 'Update failed. Please try again.';
    }
  }

  @override
  Widget build(BuildContext context) {
    // Block the hardware back button so a forced update can't be escaped.
    return PopScope(
      canPop: false,
      child: Dialog(
        backgroundColor: AppColors.navyCard,
        shape:
            RoundedRectangleBorder(borderRadius: BorderRadius.circular(18)),
        insetPadding: const EdgeInsets.symmetric(horizontal: 28),
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.accent.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.system_update_rounded,
                        color: AppColors.accent, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Text(
                      'Update required',
                      style: const TextStyle(
                          fontSize: 18, fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Text(
                'A new version (${widget.info.latestVersion}) is available. '
                'Please update to keep using the app.',
                style: const TextStyle(
                    fontSize: 14, color: AppColors.textSecondary, height: 1.4),
              ),
              if (widget.info.notes.isNotEmpty) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: AppColors.navyLight,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(widget.info.notes,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textPrimary)),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(_error!,
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.danger)),
              ],
              const SizedBox(height: 22),
              if (_downloading)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    ClipRRect(
                      borderRadius: BorderRadius.circular(8),
                      child: LinearProgressIndicator(
                        value: _progress > 0 ? _progress / 100 : null,
                        minHeight: 8,
                        backgroundColor: AppColors.navyLight,
                        valueColor:
                            const AlwaysStoppedAnimation(AppColors.accent),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Text(
                      _progress >= 100
                          ? 'Starting installer…'
                          : 'Downloading… $_progress%',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                          fontSize: 13, color: AppColors.textSecondary),
                    ),
                  ],
                )
              else
                ElevatedButton(
                  onPressed: _startUpdate,
                  child: Text(_error != null ? 'Retry' : 'Update now'),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
