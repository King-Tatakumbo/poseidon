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

static Future<Map<String, dynamic>?> signup(String fullName, String email, String phone, String password) async {
  try {
    final resp = await http.post(Uri.parse('$base/api/auth/signup'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'fullName': fullName, 'email': email, 'phone': phone, 'password': password}));
    if (resp.statusCode == 200) return jsonDecode(resp.body);
    return null;
  } catch (err) {
    print('signup error $err');
    return null;
  }
}

static Future<void> submitKycTier1(String userId, String dob) async {
  await http.post(Uri.parse('$base/api/kyc/tier1'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'userId': userId, 'dob': dob}));
}

static Future<void> submitKycTier3(String userId, String bvn) async {
  await http.post(Uri.parse('$base/api/kyc/tier3'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'userId': userId, 'bvn': bvn}));
}

static Future<String?> resolveAccount(String accountNumber, String bankCode) async {
  final resp = await http.get(Uri.parse('$base/api/banks/resolve-account?account_number=$accountNumber&account_bank=$bankCode'));
  if (resp.statusCode == 200) {
    final data = jsonDecode(resp.body);
    return data['data']?['account_name'];
  }
  return null;
}
