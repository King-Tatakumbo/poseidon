import 'package:flutter/material.dart';
import 'transfer_screen.dart';
import 'crypto_screen.dart';
import 'bills_screen.dart';
import 'marketplace_screen.dart';
import 'pos_screen.dart';
import 'airtime_data_screen.dart';

class DashboardScreen extends StatefulWidget {
  final Map? user;
  DashboardScreen({this.user});

  @override
  _DashboardScreenState createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen> {
  int _index = 0;
  final _screens = <Widget>[
    TransferScreen(),
    CryptoScreen(),
    BillsScreen(),
    MarketplaceScreen(),
    PosScreen(),
    AirtimeDataScreen(),
  ];

  final _titles = ['Transfer', 'Crypto', 'Bills', 'Marketplace', 'POS', 'Airtime/Data'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_titles[_index]),
        centerTitle: true,
      ),
      body: _screens[_index],
      bottomNavigationBar: BottomNavigationBar(
        type: BottomNavigationBarType.fixed,
        currentIndex: _index,
        onTap: (i) => setState(() => _index = i),
        items: [
          BottomNavigationBarItem(icon: Icon(Icons.send), label: 'Transfer'),
          BottomNavigationBarItem(icon: Icon(Icons.currency_bitcoin), label: 'Crypto'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt), label: 'Bills'),
          BottomNavigationBarItem(icon: Icon(Icons.store), label: 'Market'),
          BottomNavigationBarItem(icon: Icon(Icons.point_of_sale), label: 'POS'),
          BottomNavigationBarItem(icon: Icon(Icons.phone_android), label: 'Airtime'),
        ],
      ),
    );
  }
}
