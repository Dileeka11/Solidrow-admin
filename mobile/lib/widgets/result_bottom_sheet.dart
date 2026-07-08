import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../models/scan_result.dart';
import '../main.dart';

/// Bottom sheet shown after a QR scan with success, already-marked,
/// or error result. Returns true to continue scanning, false/null to go back.
class ResultBottomSheet extends StatefulWidget {
  final ScanResult result;
  final String     scannedCode;

  const ResultBottomSheet({
    super.key,
    required this.result,
    required this.scannedCode,
  });

  @override
  State<ResultBottomSheet> createState() => _ResultBottomSheetState();
}

class _ResultBottomSheetState extends State<ResultBottomSheet>
    with TickerProviderStateMixin {
  late AnimationController _ctrl;
  late AnimationController _entranceCtrl;
  late Animation<double>   _scaleAnim;
  late Animation<double>   _fadeAnim;
  late Animation<Offset>   _slideAnim;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(vsync: this,
        duration: const Duration(milliseconds: 500));
    _scaleAnim = CurvedAnimation(parent: _ctrl, curve: Curves.elasticOut);

    _entranceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 420),
    );
    _fadeAnim = CurvedAnimation(parent: _entranceCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero)
        .animate(CurvedAnimation(parent: _entranceCtrl, curve: Curves.easeOutCubic));

    _ctrl.forward();
    _entranceCtrl.forward();
  }

  @override
  void dispose() {
    _ctrl.dispose();
    _entranceCtrl.dispose();
    super.dispose();
  }

  // ── Appearance based on result ──────────────────────────────────────────

  Color get _accentColor {
    if (widget.result.success)         return AppColors.success;
    if (widget.result.isAlreadyMarked) return AppColors.warning;
    return AppColors.danger;
  }

  IconData get _icon {
    if (widget.result.success)         return Icons.check_circle_rounded;
    if (widget.result.isAlreadyMarked) return Icons.warning_amber_rounded;
    return Icons.cancel_rounded;
  }

  String get _title {
    if (widget.result.success)         return 'Attendance Marked';
    if (widget.result.isAlreadyMarked) return 'Already Marked';
    return 'Scan Failed';
  }

  @override
  Widget build(BuildContext context) {
    final r = widget.result;

    return FadeTransition(
      opacity: _fadeAnim,
      child: SlideTransition(
        position: _slideAnim,
        child: Container(
          margin: const EdgeInsets.fromLTRB(12, 0, 12, 12),
          decoration: BoxDecoration(
            color: AppColors.navyCard,
            borderRadius: BorderRadius.circular(28),
            border: Border.all(color: _accentColor.withValues(alpha: 0.35)),
            boxShadow: [
              BoxShadow(
                color: _accentColor.withValues(alpha: 0.15),
                blurRadius: 40, spreadRadius: 2,
              ),
            ],
          ),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(24, 32, 24, 28),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Icon
            ScaleTransition(
              scale: _scaleAnim,
              child: Container(
                width: 72, height: 72,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: _accentColor.withValues(alpha: 0.12),
                  border: Border.all(color: _accentColor.withValues(alpha: 0.5), width: 1.5),
                ),
                child: Icon(_icon, color: _accentColor, size: 36),
              ),
            ),
            const SizedBox(height: 16),

            // Title
            Text(_title,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.w800,
                  color: _accentColor,
                )),
            const SizedBox(height: 8),

            // Message
            Text(r.message,
                textAlign: TextAlign.center,
                style: const TextStyle(
                    fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 24),

            // Details card
            if (r.candidateName != null || r.date != null)
              _buildDetailsCard(r),

            const SizedBox(height: 24),

            // Action buttons
            Row(children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    Navigator.of(context).pop(false);
                  },
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.border),
                    minimumSize: const Size(0, 50),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                    foregroundColor: AppColors.textSecondary,
                  ),
                  child: const Text('Back'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  onPressed: () {
                    HapticFeedback.mediumImpact();
                    Navigator.of(context).pop(true);
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: _accentColor,
                    foregroundColor: AppColors.navy,
                    minimumSize: const Size(0, 50),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14)),
                  ),
                  child: const Text('Scan Next'),
                ),
              ),
            ]),
          ],
        ),
      ),
        ),
      ),
    );
  }

  Widget _buildDetailsCard(ScanResult r) {
    final rows = <_DetailRow>[];

    if (r.candidateName != null)  { rows.add(_DetailRow('Candidate', r.candidateName!)); }
    if (r.candidateRegNo != null) { rows.add(_DetailRow('Reg. No.', r.candidateRegNo!)); }
    if (r.slotLabel.isNotEmpty)   { rows.add(_DetailRow('Training', r.slotLabel)); }
    if (r.date != null)           { rows.add(_DetailRow('Date', r.date!)); }
    if (r.time != null)           { rows.add(_DetailRow('Time', r.time!)); }
    if (r.attendanceDays != null) { rows.add(_DetailRow('Days Attended', '${r.attendanceDays}')); }
    if (r.daysRemaining != null && r.daysRemaining! > 0) {
      rows.add(_DetailRow('Days Remaining', '${r.daysRemaining}'));
    }

    if (rows.isEmpty) return const SizedBox.shrink();

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.navyLight,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        children: rows.map((row) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 5),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(row.label,
                  style: const TextStyle(
                      fontSize: 12, color: AppColors.textSecondary)),
              Text(row.value,
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600)),
            ],
          ),
        )).toList(),
      ),
    );
  }
}

class _DetailRow {
  final String label;
  final String value;
  const _DetailRow(this.label, this.value);
}
