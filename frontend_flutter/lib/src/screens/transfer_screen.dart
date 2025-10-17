import 'package:flutter/material.dart';
import '../services/api.dart';

class TransferScreen extends StatefulWidget {
  @override
  _TransferScreenState createState() => _TransferScreenState();
}

class _TransferScreenState extends State<TransferScreen> {
  final accountController = TextEditingController();
  final amountController = TextEditingController();
  String? selectedBankCode;
  String? resolvedName;
  bool loading = false;
  List banks = [];

  void _searchBanks(String query) async {
    final res = await Api.searchBanks(query);
    setState(() => banks = res);
  }

  void _resolveAccount() async {
    if (selectedBankCode == null || accountController.text.isEmpty) return;
    setState(() => loading = true);
    final name = await Api.resolveAccount(accountController.text.trim(), selectedBankCode!);
    setState(() {
      resolvedName = name;
      loading = false;
    });
  }

  void _transfer() async {
    if (resolvedName == null || amountController.text.isEmpty) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Transfer simulated — real API wired backend')));
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.all(16),
      child: SingleChildScrollView(
        child: Column(
          children: [
            TextField(
              controller: accountController,
              decoration: InputDecoration(labelText: 'Account Number'),
            ),
            SizedBox(height: 10),
            TextField(
              controller: amountController,
              keyboardType: TextInputType.number,
              decoration: InputDecoration(labelText: 'Amount (NGN)'),
            ),
            SizedBox(height: 10),
            TextField(
              onChanged: _searchBanks,
              decoration: InputDecoration(labelText: 'Search Bank'),
            ),
            if (banks.isNotEmpty)
              Container(
                height: 150,
                child: ListView.builder(
                  itemCount: banks.length,
                  itemBuilder: (_, i) {
                    final b = banks[i];
                    return ListTile(
                      title: Text(b['name']),
                      subtitle: Text(b['code']),
                      onTap: () => setState(() {
                        selectedBankCode = b['code'];
                        banks = [];
                      }),
                    );
                  },
                ),
              ),
            if (selectedBankCode != null)
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('Selected Bank: $selectedBankCode'),
                  SizedBox(height: 10),
                  ElevatedButton(onPressed: loading ? null : _resolveAccount, child: Text('Resolve Account')),
                ],
              ),
            if (resolvedName != null)
              Padding(
                padding: EdgeInsets.all(8.0),
                child: Text('Account Name: $resolvedName', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ),
            SizedBox(height: 16),
            ElevatedButton(onPressed: _transfer, child: Text('Send Money')),
          ],
        ),
      ),
    );
  }
}
