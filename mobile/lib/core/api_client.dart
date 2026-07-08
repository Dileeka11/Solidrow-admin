import 'package:dio/dio.dart';
import 'app_config.dart';
import 'auth_storage.dart';

/// Singleton Dio client pre-configured with the base URL and
/// an interceptor that attaches the Bearer token on every request.
class ApiClient {
  ApiClient._();

  static final Dio _dio = Dio(
    BaseOptions(
      baseUrl:        '${AppConfig.baseUrl}/api',
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      headers: {'Accept': 'application/json'},
    ),
  )..interceptors.add(_AuthInterceptor());

  static Dio get dio => _dio;

  // ── Convenience wrappers ─────────────────────────────────────────────────

  static Future<Response> post(String path, Map<String, dynamic> data) =>
      _dio.post(path, data: data);

  static Future<Response> get(String path) => _dio.get(path);
}

/// Reads the stored token and adds `Authorization: Bearer <token>` to
/// every outgoing request automatically.
class _AuthInterceptor extends Interceptor {
  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final token = await AuthStorage.getToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}
