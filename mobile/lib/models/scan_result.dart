/// Result returned from the /api/attendance/scan endpoint.
class ScanResult {
  final bool   success;
  final String message;
  final String? candidateName;
  final String? candidateRegNo;
  final String? date;
  final String? time;
  final String? slot;        // 'pre_test' | 'final_test'
  final int?    cycleNo;
  final int?    attendanceDays;
  final int?    daysRemaining;
  final int     httpStatus;  // 200, 409, 404, etc.

  const ScanResult({
    required this.success,
    required this.message,
    required this.httpStatus,
    this.candidateName,
    this.candidateRegNo,
    this.date,
    this.time,
    this.slot,
    this.cycleNo,
    this.attendanceDays,
    this.daysRemaining,
  });

  factory ScanResult.fromJson(Map<String, dynamic> json, {int httpStatus = 200}) {
    return ScanResult(
      success:        json['success']           as bool?   ?? false,
      message:        json['message']           as String? ?? 'Unknown response.',
      candidateName:  json['candidate_name']    as String?,
      candidateRegNo: json['candidate_reg_no']  as String?,
      date:           json['date']              as String?,
      time:           json['time']              as String?,
      slot:           json['slot']              as String?,
      cycleNo:        json['cycle_no']          as int?,
      attendanceDays: json['attendance_days']   as int?,
      daysRemaining:  json['days_remaining']    as int?,
      httpStatus:     httpStatus,
    );
  }

  factory ScanResult.error(String message, {int httpStatus = 0}) {
    return ScanResult(
      success: false,
      message: message,
      httpStatus: httpStatus,
    );
  }

  bool get isAlreadyMarked => httpStatus == 409;
  bool get isNotFound      => httpStatus == 404;

  String get slotLabel {
    if (slot == 'pre_test') {
      return cycleNo != null ? 'Pre Test — Cycle $cycleNo' : 'Pre Test';
    }
    if (slot == 'final_test') return 'Final Test';
    return '';
  }
}
