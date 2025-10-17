import 'package:flutter/material.dart';
import '../services/api.dart';
import 'signup_screen.dart';

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  bool loading = false;

  void _login() async {
    setState(() { loading = true; });
    final resp = await Api.login(emailController.text.trim(), passwordController.text);
    setState(() { loading = false; });
    if (resp != null && resp['token'] != null) {
      Navigator.pushReplacementNamed(context, '/dashboard', arguments: resp['user']);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Login failed')));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: Padding(
          padding: EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('POSEIDON', style: TextStyle(fontSize: 34, fontWeight: FontWeight.bold)),
              SizedBox(height: 24),
              TextField(controller: emailController, decoration: InputDecoration(labelText: 'Email')),
              TextField(controller: passwordController, decoration: InputDecoration(labelText: 'Password'), obscureText: true),
              SizedBox(height: 16),
              ElevatedButton(onPressed: loading ? null : _login, child: loading ? CircularProgressIndicator() : Text('Login')),
              TextButton(onPressed: () => Navigator.push(context, MaterialPageRoute(builder: (_) => SignupScreen())), child: Text('Sign up'))
            ],
          ),
        ),
      ),
    );
  }
}
