import 'dart:convert';
import 'package:http/http.dart' as http;

class Api {
  static const base = String.fromEnvironment('API_URL', defaultValue: 'https://your-backend.example');

  static Future<Map<String, dynamic>?> login(String email, String password) async {
    try {
      final resp = await http.post(Uri.parse('$base/api/auth/login'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'email': email, 'password': password}));
      if (resp.statusCode == 200) return jsonDecode(resp.body) as Map<String, dynamic>;
      return null;
    } catch (err) {
      print('login error $err');
      return null;
    }
  }

  static Future<List> searchBanks(String q) async {
    final resp = await http.get(Uri.parse('$base/api/banks/search?q=${Uri.encodeComponent(q)}'));
    if (resp.statusCode == 200) return jsonDecode(resp.body) as List;
    return [];
  }
}
