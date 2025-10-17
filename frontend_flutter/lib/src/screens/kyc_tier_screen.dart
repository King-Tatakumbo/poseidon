import 'package:flutter/material.dart';
import '../services/api.dart';
import 'dashboard.dart';

class KyCTierScreen extends StatefulWidget {
  final Map user;
  KyCTierScreen({required this.user});

  @override
  _KyCTierScreenState createState() => _KyCTierScreenState();
}

class _KyCTierScreenState extends State<KyCTierScreen> {
  int currentTier = 1;
  bool loading = false;

  final dobController = TextEditingController();
  final bvnController = TextEditingController();
  String idType = 'NIN';

  void _submitTier1() async {
    setState(() { loading = true; });
    await Api.submitKycTier1(widget.user['id'], dobController.text.trim());
    setState(() { loading = false; currentTier = 2; });
  }

  void _submitTier3() async {
    setState(() { loading = true; });
    await Api.submitKycTier3(widget.user['id'], bvnController.text.trim());
    setState(() { loading = false; });
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(builder: (_) => DashboardScreen(user: widget.user)),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('KYC Verification')),
      body: Padding(
        padding: EdgeInsets.all(20),
        child: Column(
          children: [
            Text('Tier $currentTier Verification', style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
            SizedBox(height: 16),
            if (currentTier == 1)
              Column(
                children: [
                  TextField(controller: dobController, decoration: InputDecoration(labelText: 'Date of Birth (YYYY-MM-DD)')),
                  SizedBox(height: 10),
                  ElevatedButton(onPressed: loading ? null : _submitTier1, child: Text('Submit Tier 1')),
                ],
              ),
            if (currentTier == 2)
              Column(
                children: [
                  DropdownButtonFormField<String>(
                    value: idType,
                    items: ['NIN', 'VOTERS CARD', 'INTERNATIONAL PASSPORT']
                        .map((v) => DropdownMenuItem(value: v, child: Text(v)))
                        .toList(),
                    onChanged: (v) => setState(() => idType = v ?? 'NIN'),
                  ),
                  SizedBox(height: 10),
                  ElevatedButton(
                    onPressed: () => setState(() => currentTier = 3),
                    child: Text('Simulate Upload ID & Continue'),
                  ),
                ],
              ),
            if (currentTier == 3)
              Column(
                children: [
                  TextField(controller: bvnController, decoration: InputDecoration(labelText: 'BVN')),
                  SizedBox(height: 10),
                  ElevatedButton(onPressed: loading ? null : _submitTier3, child: Text('Verify & Finish')),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
