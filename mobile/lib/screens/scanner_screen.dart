import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';

import '../core/api_client.dart';
import '../models/scan_result.dart';
import '../main.dart';
import '../widgets/result_bottom_sheet.dart';

class ScannerScreen extends StatefulWidget {
  const ScannerScreen({super.key});

  @override
  State<ScannerScreen> createState() => _ScannerScreenState();
}

class _ScannerScreenState extends State<ScannerScreen>
    with SingleTickerProviderStateMixin {
  final MobileScannerController _scanCtrl = MobileScannerController(
    detectionSpeed: DetectionSpeed.normal,
    facing: CameraFacing.back,
  );

  bool _processing = false;   // prevents double-scan
  bool _torchOn    = false;

  late AnimationController _pulseCtrl;
  late Animation<double>   _pulseAnim;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1600),
    )..repeat(reverse: true);
    _pulseAnim = Tween<double>(begin: 0.85, end: 1.0).animate(
      CurvedAnimation(parent: _pulseCtrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _scanCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  Future<void> _onDetect(BarcodeCapture capture) async {
    if (_processing) return;
    final barcode = capture.barcodes.firstOrNull;
    final raw     = barcode?.rawValue;
    if (raw == null || raw.isEmpty) return;

    setState(() => _processing = true);
    await _scanCtrl.stop();

    ScanResult result;
    try {
      final resp = await ApiClient.post('/attendance/scan', {
        'candidate_reg_no': raw.trim(),
      });
      result = ScanResult.fromJson(
        resp.data as Map<String, dynamic>,
        httpStatus: resp.statusCode ?? 200,
      );
    } on DioException catch (e) {
      if (e.response != null && e.response!.data is Map) {
        result = ScanResult.fromJson(
          e.response!.data as Map<String, dynamic>,
          httpStatus: e.response!.statusCode ?? 0,
        );
      } else {
        result = ScanResult.error(
          e.type == DioExceptionType.connectionTimeout
              ? 'Cannot reach server. Check connection.'
              : 'Scan failed: ${e.message}',
          httpStatus: e.response?.statusCode ?? 0,
        );
      }
    } catch (e) {
      result = ScanResult.error('Unexpected error: $e');
    }

    if (!mounted) return;

    // Show result sheet — await user dismissal
    final shouldContinue = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => ResultBottomSheet(result: result, scannedCode: raw),
    );

    if (mounted) {
      if (shouldContinue == true) {
        // Resume scanning
        setState(() => _processing = false);
        await _scanCtrl.start();
      } else {
        // Return to dashboard signalling a successful scan
        context.pop(result.success);
      }
    }
  }

  void _toggleTorch() {
    setState(() => _torchOn = !_torchOn);
    _scanCtrl.toggleTorch();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Camera
          MobileScanner(
            controller: _scanCtrl,
            onDetect: _onDetect,
          ),

          // Dark overlay with cutout hole
          _ScanOverlay(pulseAnim: _pulseAnim),

          // Top bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  // Back
                  _CircleButton(
                    icon: Icons.arrow_back_ios_new_rounded,
                    onTap: () => context.pop(false),
                  ),
                  const Spacer(),
                  const Text('Scan QR Code',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                      )),
                  const Spacer(),
                  // Torch
                  _CircleButton(
                    icon: _torchOn
                        ? Icons.flash_on_rounded
                        : Icons.flash_off_rounded,
                    onTap: _toggleTorch,
                    active: _torchOn,
                  ),
                ],
              ),
            ),
          ),

          // Bottom hint
          Positioned(
            bottom: 60,
            left: 0, right: 0,
            child: Column(children: [
              if (_processing)
                const CircularProgressIndicator(color: AppColors.accent)
              else ...[
                ScaleTransition(
                  scale: _pulseAnim,
                  child: Container(
                    width: 56, height: 56,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: AppColors.accentGlow,
                      border: Border.all(color: AppColors.accent, width: 1.5),
                    ),
                    child: const Icon(Icons.qr_code_rounded,
                        color: AppColors.accent, size: 26),
                  ),
                ),
                const SizedBox(height: 14),
                const Text('Point at the candidate\'s QR code',
                    style: TextStyle(color: Colors.white70, fontSize: 14)),
              ],
            ]),
          ),
        ],
      ),
    );
  }
}

// ── Scan frame overlay ────────────────────────────────────────────────────────

class _ScanOverlay extends StatelessWidget {
  final Animation<double> pulseAnim;
  const _ScanOverlay({required this.pulseAnim});

  @override
  Widget build(BuildContext context) {
    const cutSize = 260.0;
    return CustomPaint(
      painter: _OverlayPainter(cutSize: cutSize),
      child: Center(
        child: SizedBox(
          width: cutSize,
          height: cutSize,
          child: AnimatedBuilder(
            animation: pulseAnim,
            builder: (_, __) => CustomPaint(
              painter: _CornerPainter(opacity: pulseAnim.value),
            ),
          ),
        ),
      ),
    );
  }
}

class _OverlayPainter extends CustomPainter {
  final double cutSize;
  const _OverlayPainter({required this.cutSize});

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width  / 2;
    final cy = size.height / 2;
    final half = cutSize / 2;

    final paint = Paint()..color = Colors.black.withValues(alpha: 0.62);
    final full  = Rect.fromLTWH(0, 0, size.width, size.height);
    final hole  = Rect.fromLTRB(cx - half, cy - half, cx + half, cy + half);

    canvas.drawPath(
      Path.combine(
        PathOperation.difference,
        Path()..addRect(full),
        Path()..addRRect(RRect.fromRectAndRadius(hole, const Radius.circular(18))),
      ),
      paint,
    );
  }

  @override
  bool shouldRepaint(_) => false;
}

class _CornerPainter extends CustomPainter {
  final double opacity;
  const _CornerPainter({required this.opacity});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color  = AppColors.accent.withValues(alpha: opacity)
      ..strokeWidth = 3.5
      ..style  = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    const r    = 18.0;
    const arm  = 30.0;
    final w    = size.width;
    final h    = size.height;

    // Top-left
    canvas.drawPath(Path()
      ..moveTo(0, r + arm)..lineTo(0, r)
      ..arcToPoint(Offset(r, 0), radius: const Radius.circular(r))
      ..lineTo(r + arm, 0), paint);
    // Top-right
    canvas.drawPath(Path()
      ..moveTo(w - r - arm, 0)..lineTo(w - r, 0)
      ..arcToPoint(Offset(w, r), radius: const Radius.circular(r))
      ..lineTo(w, r + arm), paint);
    // Bottom-left
    canvas.drawPath(Path()
      ..moveTo(0, h - r - arm)..lineTo(0, h - r)
      ..arcToPoint(Offset(r, h), radius: const Radius.circular(r), clockwise: false)
      ..lineTo(r + arm, h), paint);
    // Bottom-right
    canvas.drawPath(Path()
      ..moveTo(w - r - arm, h)..lineTo(w - r, h)
      ..arcToPoint(Offset(w, h - r), radius: const Radius.circular(r), clockwise: false)
      ..lineTo(w, h - r - arm), paint);
  }

  @override
  bool shouldRepaint(_CornerPainter old) => old.opacity != opacity;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

class _CircleButton extends StatefulWidget {
  final IconData icon;
  final VoidCallback onTap;
  final bool active;

  const _CircleButton({
    required this.icon,
    required this.onTap,
    this.active = false,
  });

  @override
  State<_CircleButton> createState() => _CircleButtonState();
}

class _CircleButtonState extends State<_CircleButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 90),
      reverseDuration: const Duration(milliseconds: 180),
    );
    _scale = Tween<double>(begin: 1.0, end: 0.88).animate(
      CurvedAnimation(parent: _ctrl, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) {
        HapticFeedback.lightImpact();
        _ctrl.forward();
      },
      onTapUp: (_) {
        _ctrl.reverse();
        widget.onTap();
      },
      onTapCancel: () => _ctrl.reverse(),
      child: AnimatedBuilder(
        animation: _scale,
        builder: (_, child) => Transform.scale(
          scale: _scale.value,
          child: child,
        ),
        child: Container(
          width: 40, height: 40,
          decoration: BoxDecoration(
            color: widget.active ? AppColors.accentGlow : Colors.black45,
            shape: BoxShape.circle,
            border: widget.active
                ? Border.all(color: AppColors.accent)
                : null,
          ),
          child: Icon(widget.icon,
              color: widget.active ? AppColors.accent : Colors.white, size: 20),
        ),
      ),
    );
  }
}
