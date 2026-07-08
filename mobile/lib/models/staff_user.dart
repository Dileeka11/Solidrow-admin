/// Represents the authenticated staff user.
class StaffUser {
  final int    id;
  final String name;
  final String email;
  final String role;

  const StaffUser({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
  });

  factory StaffUser.fromJson(Map<String, dynamic> json) {
    return StaffUser(
      id:    json['id'] as int? ?? 0,
      name:  json['name']  as String? ?? '',
      email: json['email'] as String? ?? '',
      role:  json['role']  as String? ?? 'Staff',
    );
  }

  /// Role badge colour label for UI.
  String get roleBadge {
    switch (role.toLowerCase()) {
      case 'admin':   return 'Admin';
      case 'manager': return 'Manager';
      default:        return role.isNotEmpty ? role : 'Staff';
    }
  }
}
