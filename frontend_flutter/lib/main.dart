import 'package:flutter/material.dart';
import 'src/screens/login_screen.dart';
import 'src/screens/dashboard.dart';

void main() {
  runApp(PoseidonApp());
}

class PoseidonApp extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'POSEIDON',
      theme: ThemeData(
        primarySwatch: Colors.indigo,
        brightness: Brightness.dark,
      ),
      initialRoute: '/',
      routes: {
        '/': (ctx) => LoginScreen(),
        '/dashboard': (ctx) => DashboardScreen(),
      },
    );
  }
}
