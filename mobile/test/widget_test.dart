// Basic smoke test: builds the app and verifies it boots without crashing.

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:solidrow_staff_app/main.dart';

void main() {
  testWidgets('App boots and renders', (WidgetTester tester) async {
    // Build our app and trigger a frame.
    await tester.pumpWidget(const ProviderScope(child: SolidrowApp()));
    await tester.pump();

    // The router redirects to /login on first launch; the app shell renders.
    expect(find.byType(MaterialApp), findsOneWidget);
  });
}
