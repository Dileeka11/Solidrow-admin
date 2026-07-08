import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:google_fonts/google_fonts.dart';

import 'core/auth_storage.dart';
import 'screens/login_screen.dart';
import 'screens/dashboard_screen.dart';
import 'screens/scanner_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.light,
  ));
  runApp(const ProviderScope(child: SolidrowApp()));
}

// ── Colour palette ────────────────────────────────────────────────────────────

class AppColors {
  static const navy       = Color(0xFF0A0F1E);
  static const navyCard   = Color(0xFF111827);
  static const navyLight  = Color(0xFF1A2235);
  static const accent     = Color(0xFF00D4FF);
  static const accentGlow = Color(0x3300D4FF);
  static const success    = Color(0xFF00E5A0);
  static const warning    = Color(0xFFFFB800);
  static const danger     = Color(0xFFFF4B6E);
  static const textPrimary   = Color(0xFFEBEEF5);
  static const textSecondary = Color(0xFF8899AA);
  static const border     = Color(0xFF1E2D40);
}

// ── Router ────────────────────────────────────────────────────────────────────

Page<T> _buildPage<T>(BuildContext context, GoRouterState state, Widget child) {
  return CustomTransitionPage<T>(
    key: state.pageKey,
    child: child,
    transitionDuration: const Duration(milliseconds: 380),
    reverseTransitionDuration: const Duration(milliseconds: 280),
    transitionsBuilder: (context, animation, secondaryAnimation, child) {
      final fadeTween = Tween<double>(begin: 0.0, end: 1.0)
          .chain(CurveTween(curve: Curves.easeOutCubic));
      final slideTween = Tween<Offset>(begin: const Offset(0, 0.06), end: Offset.zero)
          .chain(CurveTween(curve: Curves.easeOutCubic));
      final fadeOut = Tween<double>(begin: 1.0, end: 0.0)
          .chain(CurveTween(curve: Curves.easeIn));
      return FadeTransition(
        opacity: secondaryAnimation.drive(fadeOut).drive(
          Tween<double>(begin: 1.0, end: 1.0),
        ),
        child: FadeTransition(
          opacity: animation.drive(fadeTween),
          child: SlideTransition(
            position: animation.drive(slideTween),
            child: child,
          ),
        ),
      );
    },
  );
}

final _router = GoRouter(
  initialLocation: '/login',
  redirect: (context, state) async {
    final hasToken = await AuthStorage.hasToken();
    final onLogin  = state.matchedLocation == '/login';
    if (!hasToken && !onLogin) return '/login';
    if (hasToken  &&  onLogin) return '/dashboard';
    return null;
  },
  routes: [
    GoRoute(
      path: '/login',
      pageBuilder: (c, s) => _buildPage(c, s, const LoginScreen()),
    ),
    GoRoute(
      path: '/dashboard',
      pageBuilder: (c, s) => _buildPage(c, s, const DashboardScreen()),
    ),
    GoRoute(
      path: '/scanner',
      pageBuilder: (c, s) => _buildPage(c, s, const ScannerScreen()),
    ),
  ],
);

// ── Root widget ───────────────────────────────────────────────────────────────

class SolidrowApp extends StatelessWidget {
  const SolidrowApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp.router(
      title: 'Solidrow Staff',
      debugShowCheckedModeBanner: false,
      routerConfig: _router,
      theme: _buildTheme(),
      scrollBehavior: const _SmoothScrollBehavior(),
    );
  }

  ThemeData _buildTheme() {
    final base = ThemeData.dark();
    final textTheme = GoogleFonts.interTextTheme(base.textTheme).apply(
      bodyColor: AppColors.textPrimary,
      displayColor: AppColors.textPrimary,
    );

    return base.copyWith(
      pageTransitionsTheme: const PageTransitionsTheme(
        builders: {
          TargetPlatform.android: FadeUpwardsPageTransitionsBuilder(),
          TargetPlatform.iOS: CupertinoPageTransitionsBuilder(),
        },
      ),
      scaffoldBackgroundColor: AppColors.navy,
      colorScheme: const ColorScheme.dark(
        primary:   AppColors.accent,
        secondary: AppColors.success,
        surface:   AppColors.navyCard,
        error:     AppColors.danger,
      ),
      textTheme: textTheme,
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.navyLight,
        hintStyle: const TextStyle(color: AppColors.textSecondary),
        labelStyle: const TextStyle(color: AppColors.textSecondary),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.accent, width: 1.5),
        ),
        errorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.danger),
        ),
        focusedErrorBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.danger, width: 1.5),
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 18, vertical: 16),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accent,
          foregroundColor: AppColors.navy,
          minimumSize: const Size(double.infinity, 54),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
          textStyle: GoogleFonts.inter(fontWeight: FontWeight.w700, fontSize: 16),
          elevation: 0,
        ),
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: Colors.transparent,
        elevation: 0,
        iconTheme: IconThemeData(color: AppColors.textPrimary),
        titleTextStyle: TextStyle(
          color: AppColors.textPrimary,
          fontSize: 18,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}

// ── Smooth scroll behaviour (bouncy physics everywhere) ───────────────────────

class _SmoothScrollBehavior extends ScrollBehavior {
  const _SmoothScrollBehavior();

  @override
  ScrollPhysics getScrollPhysics(BuildContext context) =>
      const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics());
}
