import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../main.dart';
import 'progress_screen.dart';

/// Public landing screen shown when the app opens (no login required).
///
/// Anyone can look up a candidate's registration progress here. Staff can tap
/// "Staff Login" in the top-right to access the attendance dashboard.
class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // Background
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
                colors: [Color(0xFF0A1628), AppColors.navy],
              ),
            ),
          ),
          // Top glow
          Positioned(
            top: -40, right: -60,
            child: Container(
              width: 280, height: 280,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  AppColors.accent.withValues(alpha: 0.08),
                  Colors.transparent,
                ]),
              ),
            ),
          ),
          SafeArea(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // ── Top bar: brand + Staff Login ─────────────────────────
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Image.asset(
                          'assets/images/solidrow-foreign-employment.png',
                          height: 30,
                          fit: BoxFit.contain,
                        ),
                      ),
                      const Spacer(),
                      _StaffLoginButton(onTap: () => context.push('/login')),
                    ],
                  ),
                  const SizedBox(height: 30),
                  // ── Heading ──────────────────────────────────────────────
                  const Text('Check Your Registration Progress',
                      style: TextStyle(
                          fontSize: 24, fontWeight: FontWeight.w800, height: 1.2)),
                  const SizedBox(height: 24),
                  // ── Lookup card ──────────────────────────────────────────
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      color: AppColors.navyCard,
                      borderRadius: BorderRadius.circular(18),
                      border: Border.all(color: AppColors.border),
                    ),
                    child: const ProgressLookup(),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _StaffLoginButton extends StatelessWidget {
  final VoidCallback onTap;
  const _StaffLoginButton({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 9),
        decoration: BoxDecoration(
          color: AppColors.navyLight,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.border),
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.badge_outlined, size: 16, color: AppColors.accent),
            SizedBox(width: 7),
            Text('Staff Login',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w600,
                    color: AppColors.textPrimary)),
          ],
        ),
      ),
    );
  }
}
