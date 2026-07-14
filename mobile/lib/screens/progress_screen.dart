import 'package:dio/dio.dart';
import 'package:flutter/material.dart';

import '../core/api_client.dart';
import '../main.dart';

/// Progress-lookup screen (used by logged-in staff from the dashboard).
class ProgressScreen extends StatelessWidget {
  const ProgressScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Check Progress'),
        leading: const BackButton(),
      ),
      body: const SafeArea(
        child: SingleChildScrollView(
          padding: EdgeInsets.fromLTRB(20, 8, 20, 32),
          child: ProgressLookup(),
        ),
      ),
    );
  }
}

/// Reusable candidate progress lookup: a search field + results panel.
///
/// Looks up a candidate's registration progress by passport / mobile / NIC
/// number — no candidate login required. Backed by the public
/// `GET /api/progress?q=` endpoint. Shared by [ProgressScreen] (staff) and the
/// public home landing.
class ProgressLookup extends StatefulWidget {
  const ProgressLookup({super.key});

  @override
  State<ProgressLookup> createState() => _ProgressLookupState();
}

class _ProgressLookupState extends State<ProgressLookup> {
  final _controller = TextEditingController();

  bool _loading = false;
  String? _error;
  _ProgressResult? _result;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    final q = _controller.text.trim();
    if (q.isEmpty) {
      setState(() => _error = 'Enter a passport, mobile or NIC number.');
      return;
    }

    FocusScope.of(context).unfocus();
    setState(() {
      _loading = true;
      _error = null;
      _result = null;
    });

    try {
      final res = await ApiClient.get('/progress?q=${Uri.encodeQueryComponent(q)}');
      if (!mounted) return;
      setState(() {
        _result = _ProgressResult.fromJson(res.data as Map<String, dynamic>);
        _loading = false;
      });
    } on DioException catch (e) {
      if (!mounted) return;
      final msg = e.response?.data is Map
          ? (e.response!.data['message'] as String? ?? 'Lookup failed.')
          : 'Network error. Please try again.';
      setState(() {
        _error = msg;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = 'Something went wrong. Please try again.';
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const Text(
          'Enter the candidate\'s passport, mobile or NIC number to view '
          'their registration progress.',
          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
        ),
        const SizedBox(height: 18),
        TextField(
          controller: _controller,
          textInputAction: TextInputAction.search,
          onSubmitted: (_) => _search(),
          decoration: const InputDecoration(
            hintText: 'Passport / Mobile / NIC',
            prefixIcon: Icon(Icons.search_rounded,
                color: AppColors.textSecondary),
          ),
        ),
        const SizedBox(height: 14),
        ElevatedButton(
          onPressed: _loading ? null : _search,
          child: _loading
              ? const SizedBox(
                  width: 22, height: 22,
                  child: CircularProgressIndicator(
                      strokeWidth: 2.4, color: AppColors.navy),
                )
              : const Text('Search'),
        ),
        if (_error != null) ...[
          const SizedBox(height: 20),
          _ErrorBox(message: _error!),
        ],
        if (_result != null) ...[
          const SizedBox(height: 24),
          _ProgressCard(result: _result!),
        ],
      ],
    );
  }
}

// ── Result card ───────────────────────────────────────────────────────────────

class _ProgressCard extends StatelessWidget {
  final _ProgressResult result;
  const _ProgressCard({required this.result});

  @override
  Widget build(BuildContext context) {
    final done = result.sections.where((s) => s.submitted).length;
    final total = result.totalSections;
    final pct = total == 0 ? 0.0 : done / total;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.navyCard,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(result.fullName,
                        style: const TextStyle(
                            fontSize: 18, fontWeight: FontWeight.w800)),
                    const SizedBox(height: 4),
                    Text(result.registrationNo,
                        style: const TextStyle(
                            fontSize: 13, color: AppColors.accent)),
                  ],
                ),
              ),
              if (result.isCompleted)
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 10, vertical: 5),
                  decoration: BoxDecoration(
                    color: AppColors.success.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(
                        color: AppColors.success.withValues(alpha: 0.5)),
                  ),
                  child: const Row(children: [
                    Icon(Icons.check_circle_rounded,
                        size: 14, color: AppColors.success),
                    SizedBox(width: 4),
                    Text('Completed',
                        style: TextStyle(
                            fontSize: 11,
                            color: AppColors.success,
                            fontWeight: FontWeight.w600)),
                  ]),
                ),
            ],
          ),
          const SizedBox(height: 18),
          // Progress bar
          Row(
            children: [
              Text('$done / $total sections',
                  style: const TextStyle(
                      fontSize: 13, fontWeight: FontWeight.w600)),
              const Spacer(),
              Text('${(pct * 100).round()}%',
                  style: const TextStyle(
                      fontSize: 13,
                      color: AppColors.textSecondary,
                      fontWeight: FontWeight.w600)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(8),
            child: LinearProgressIndicator(
              value: pct,
              minHeight: 8,
              backgroundColor: AppColors.navyLight,
              valueColor: const AlwaysStoppedAnimation(AppColors.accent),
            ),
          ),
          const SizedBox(height: 20),
          ...result.sections.map((s) => _SectionRow(section: s)),
        ],
      ),
    );
  }
}

class _SectionRow extends StatelessWidget {
  final _SectionStatus section;
  const _SectionRow({required this.section});

  @override
  Widget build(BuildContext context) {
    final color = section.submitted ? AppColors.success : AppColors.textSecondary;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            section.submitted
                ? Icons.check_circle_rounded
                : Icons.radio_button_unchecked_rounded,
            size: 20,
            color: color,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Section ${section.sectionNo}',
                    style: const TextStyle(
                        fontSize: 11, color: AppColors.textSecondary)),
                const SizedBox(height: 2),
                Text(section.title,
                    style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: section.submitted
                            ? AppColors.textPrimary
                            : AppColors.textSecondary)),
              ],
            ),
          ),
          Text(
            section.submitted ? 'Done' : 'Pending',
            style: TextStyle(
                fontSize: 12, color: color, fontWeight: FontWeight.w600),
          ),
        ],
      ),
    );
  }
}

class _ErrorBox extends StatelessWidget {
  final String message;
  const _ErrorBox({required this.message});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.danger.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.danger.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline_rounded,
              size: 20, color: AppColors.danger),
          const SizedBox(width: 12),
          Expanded(
            child: Text(message,
                style: const TextStyle(fontSize: 13, color: AppColors.danger)),
          ),
        ],
      ),
    );
  }
}

// ── Model ─────────────────────────────────────────────────────────────────────

class _ProgressResult {
  final String fullName;
  final String registrationNo;
  final int totalSections;
  final bool isCompleted;
  final List<_SectionStatus> sections;

  _ProgressResult({
    required this.fullName,
    required this.registrationNo,
    required this.totalSections,
    required this.isCompleted,
    required this.sections,
  });

  factory _ProgressResult.fromJson(Map<String, dynamic> json) {
    return _ProgressResult(
      fullName: (json['full_name'] ?? '—').toString(),
      registrationNo: (json['registration_no'] ?? '—').toString(),
      totalSections: (json['total_sections'] as num?)?.toInt() ?? 0,
      isCompleted: json['is_completed'] == true,
      sections: ((json['sections'] as List?) ?? [])
          .map((e) => _SectionStatus.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}

class _SectionStatus {
  final int sectionNo;
  final String title;
  final bool submitted;

  _SectionStatus({
    required this.sectionNo,
    required this.title,
    required this.submitted,
  });

  factory _SectionStatus.fromJson(Map<String, dynamic> json) {
    return _SectionStatus(
      sectionNo: (json['section_no'] as num?)?.toInt() ?? 0,
      title: (json['title'] ?? '').toString(),
      submitted: json['submitted'] == true,
    );
  }
}
