import 'package:flutter/material.dart';
import 'package:dio/dio.dart';
import 'package:go_router/go_router.dart';

import '../core/api_client.dart';
import '../core/auth_storage.dart';
import '../models/staff_user.dart';
import '../main.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with TickerProviderStateMixin {
  final _formKey     = GlobalKey<FormState>();
  final _emailCtrl   = TextEditingController();
  final _passCtrl    = TextEditingController();
  bool  _obscurePass = true;
  bool  _loading     = false;
  String? _errorMsg;

  late AnimationController _fadeCtrl;
  late AnimationController _slideCtrl;
  late Animation<double>   _fadeAnim;
  late Animation<Offset>   _slideAnim;

  @override
  void initState() {
    super.initState();

    _fadeCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 900));
    _slideCtrl = AnimationController(vsync: this, duration: const Duration(milliseconds: 800));

    _fadeAnim = CurvedAnimation(parent: _fadeCtrl, curve: Curves.easeOut);
    _slideAnim = Tween<Offset>(begin: const Offset(0, 0.12), end: Offset.zero)
        .animate(CurvedAnimation(parent: _slideCtrl, curve: Curves.easeOutCubic));

    Future.delayed(const Duration(milliseconds: 100), () {
      _fadeCtrl.forward();
      _slideCtrl.forward();
    });
  }

  @override
  void dispose() {
    _fadeCtrl.dispose();
    _slideCtrl.dispose();
    _emailCtrl.dispose();
    _passCtrl.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() { _loading = true; _errorMsg = null; });

    try {
      final resp = await ApiClient.post('/login', {
        'username': _emailCtrl.text.trim(),
        'password': _passCtrl.text,
      });

      final data  = resp.data as Map<String, dynamic>;
      final token = data['token'] as String;
      final user  = StaffUser.fromJson(data['user'] as Map<String, dynamic>);

      await AuthStorage.saveSession(
        token:     token,
        userId:    user.id,
        userName:  user.name,
        userRole:  user.role,
        userEmail: user.email,
      );

      if (mounted) context.go('/dashboard');
    } on DioException catch (e) {
      String msg = 'Login failed. Check your credentials.';
      if (e.response?.data is Map) {
        final errors = e.response!.data['errors'] as Map?;
        if (errors != null && errors['username'] is List) {
          msg = (errors['username'] as List).first.toString();
        } else if (e.response!.data['message'] != null) {
          msg = e.response!.data['message'].toString();
        }
      } else if (e.type == DioExceptionType.connectionTimeout ||
                 e.type == DioExceptionType.receiveTimeout) {
        msg = 'Cannot reach the server. Check your connection.';
      }
      setState(() { _errorMsg = msg; });
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          // ── Background gradient ──────────────────────────────────────
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                begin: Alignment.topLeft,
                end:   Alignment.bottomRight,
                colors: [Color(0xFF0A0F1E), Color(0xFF0D1B2A), Color(0xFF0A0F1E)],
              ),
            ),
          ),
          // Subtle glow blob
          Positioned(
            top: -80, left: -60,
            child: Container(
              width: 320, height: 320,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                gradient: RadialGradient(colors: [
                  AppColors.accent.withValues(alpha: 0.12),
                  Colors.transparent,
                ]),
              ),
            ),
          ),
          // ── Form ─────────────────────────────────────────────────────
          SafeArea(
            child: Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(horizontal: 28),
                child: FadeTransition(
                  opacity: _fadeAnim,
                  child: SlideTransition(
                    position: _slideAnim,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Logo / branding
                        _buildLogo(),
                        const SizedBox(height: 48),

                        // Card
                        _buildCard(),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLogo() {
    return Column(
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 22, vertical: 18),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(22),
            boxShadow: [BoxShadow(
              color: AppColors.accentGlow,
              blurRadius: 28, spreadRadius: 4,
            )],
          ),
          child: Image.asset(
            'assets/images/solidrow-foreign-employment.png',
            height: 76,
            fit: BoxFit.contain,
          ),
        ),
        const SizedBox(height: 20),
        const Text(
          'Staff Attendance Portal',
          style: TextStyle(fontSize: 14, color: AppColors.textSecondary),
        ),
      ],
    );
  }

  Widget _buildCard() {
    return Container(
      padding: const EdgeInsets.all(28),
      decoration: BoxDecoration(
        color: AppColors.navyCard,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: AppColors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.4),
            blurRadius: 40, offset: const Offset(0, 12),
          ),
        ],
      ),
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Sign In', style: TextStyle(
              fontSize: 22, fontWeight: FontWeight.w700,
            )),
            const SizedBox(height: 6),
            const Text('Use your staff email and password.',
                style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
            const SizedBox(height: 28),

            // Email / username
            TextFormField(
              controller: _emailCtrl,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: const InputDecoration(
                labelText: 'Email',
                prefixIcon: Icon(Icons.email_outlined, color: AppColors.textSecondary),
              ),
              validator: (v) =>
                  v == null || v.trim().isEmpty ? 'Enter your email' : null,
            ),
            const SizedBox(height: 16),

            // Password
            TextFormField(
              controller: _passCtrl,
              obscureText: _obscurePass,
              textInputAction: TextInputAction.done,
              onFieldSubmitted: (_) => _submit(),
              style: const TextStyle(color: AppColors.textPrimary),
              decoration: InputDecoration(
                labelText: 'Password',
                prefixIcon: const Icon(Icons.lock_outline_rounded,
                    color: AppColors.textSecondary),
                suffixIcon: IconButton(
                  icon: Icon(
                    _obscurePass ? Icons.visibility_outlined
                                 : Icons.visibility_off_outlined,
                    color: AppColors.textSecondary,
                  ),
                  onPressed: () => setState(() => _obscurePass = !_obscurePass),
                ),
              ),
              validator: (v) =>
                  v == null || v.isEmpty ? 'Enter your password' : null,
            ),

            // Error message
            if (_errorMsg != null) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                decoration: BoxDecoration(
                  color: AppColors.danger.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: AppColors.danger.withValues(alpha: 0.4)),
                ),
                child: Row(children: [
                  const Icon(Icons.error_outline, color: AppColors.danger, size: 18),
                  const SizedBox(width: 10),
                  Expanded(child: Text(_errorMsg!,
                      style: const TextStyle(color: AppColors.danger, fontSize: 13))),
                ]),
              ),
            ],

            const SizedBox(height: 28),

            // Submit
            ElevatedButton(
              onPressed: _loading ? null : _submit,
              child: _loading
                  ? const SizedBox(
                      height: 22, width: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.5, color: AppColors.navy,
                      ),
                    )
                  : const Text('Sign In'),
            ),
          ],
        ),
      ),
    );
  }
}
