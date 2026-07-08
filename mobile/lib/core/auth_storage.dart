import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Manages persisting the Sanctum bearer token and logged-in user data.
class AuthStorage {
  static const _storage = FlutterSecureStorage(
    aOptions: AndroidOptions(encryptedSharedPreferences: true),
  );

  static const _keyToken    = 'auth_token';
  static const _keyUserId   = 'user_id';
  static const _keyUserName = 'user_name';
  static const _keyUserRole = 'user_role';
  static const _keyUserEmail = 'user_email';

  // ── Write ────────────────────────────────────────────────────────────────

  static Future<void> saveSession({
    required String token,
    required int    userId,
    required String userName,
    required String userRole,
    required String userEmail,
  }) async {
    await Future.wait([
      _storage.write(key: _keyToken,     value: token),
      _storage.write(key: _keyUserId,    value: userId.toString()),
      _storage.write(key: _keyUserName,  value: userName),
      _storage.write(key: _keyUserRole,  value: userRole),
      _storage.write(key: _keyUserEmail, value: userEmail),
    ]);
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  static Future<String?> getToken()     => _storage.read(key: _keyToken);
  static Future<String?> getUserName()  => _storage.read(key: _keyUserName);
  static Future<String?> getUserRole()  => _storage.read(key: _keyUserRole);
  static Future<String?> getUserEmail() => _storage.read(key: _keyUserEmail);
  static Future<String?> getUserIdStr() => _storage.read(key: _keyUserId);

  static Future<bool> hasToken() async {
    final t = await _storage.read(key: _keyToken);
    return t != null && t.isNotEmpty;
  }

  // ── Delete ────────────────────────────────────────────────────────────────

  static Future<void> clearSession() async {
    await _storage.deleteAll();
  }
}
