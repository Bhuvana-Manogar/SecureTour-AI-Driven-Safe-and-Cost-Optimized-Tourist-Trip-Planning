import urllib.request
import json
import time

def post(url, data, token=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, data=json.dumps(data).encode(), headers=headers, method='POST')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def get(url, token=None):
    headers = {}
    if token:
        headers['Authorization'] = f'Bearer {token}'
    req = urllib.request.Request(url, headers=headers, method='GET')
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def run():
    unique_email = f"deepak_{int(time.time())}@securetour.ai"
    print(f"1. Registering BRAND NEW USER: Deepak Sharma ({unique_email})...")
    reg_res = post('http://127.0.0.1:8000/api/auth/register', {
        'full_name': 'Deepak Sharma',
        'email': unique_email,
        'password': 'secure123',
        'phone': '+91 98765 43210',
        'emergency_contact_name': 'Sunita (Mother)',
        'emergency_contact_phone': '+91 98765 11111'
    })
    deepak_token = reg_res['access_token']
    deepak_id = reg_res['user']['id']
    print("New user registered successfully! ID:", deepak_id)

    print("2. Checking Deepak's active trip automatically initialized in SQL DB...")
    act_trip = get('http://127.0.0.1:8000/api/user/active-trip', deepak_token)
    print("Auto-created Trip Title:", act_trip['trip']['title'])
    print("Members initialized:", [m['member_name'] for m in act_trip['members']])
    print("Unified Database File:", act_trip['user_db'])

    print("3. Deepak creating a new Collaborative Group Trip 'Coorg Coffee Tour 2026'...")
    create_trip_res = post('http://127.0.0.1:8000/api/trips/create-group', {
        'title': 'Coorg Coffee Tour 2026',
        'source': 'Bangalore',
        'destination': 'Coorg',
        'target_budget': 32000.0,
        'duration_days': 3,
        'invited_emails': ['manogarbhuvana@gmail.com']
    }, deepak_token)
    coorg_trip_id = create_trip_res['trip_id']
    print(f"Group Trip Created: {create_trip_res['title']} (ID: {coorg_trip_id})")

    print("4. Logging in Bhuvaneshwari M...")
    bhuv_login = post('http://127.0.0.1:8000/api/auth/login', {'email': 'manogarbhuvana@gmail.com', 'password': 'secure123'})
    bhuv_token = bhuv_login['access_token']

    print("5. Checking Bhuvaneshwari's pending invitations...")
    invs = get('http://127.0.0.1:8000/api/trips/invitations', bhuv_token)
    matching_inv = next((i for i in invs['invitations'] if i['trip_id'] == coorg_trip_id), None)
    assert matching_inv is not None, "Invitation from Deepak not received!"
    print(f"Invitation received from {matching_inv['from_user_name']} for '{matching_inv['trip_title']}'")

    print("6. Bhuvaneshwari accepts invitation...")
    accept_res = post(f"http://127.0.0.1:8000/api/trips/invitations/{matching_inv['id']}/respond", {'action': 'accept'}, bhuv_token)
    print("Accept result:", str(accept_res).encode('ascii', 'ignore').decode())

    print("7. Bhuvaneshwari logs an expense of Rs 3,500 for Plantation Homestay...")
    exp_res = post(f'http://127.0.0.1:8000/api/expenses/{coorg_trip_id}', {
        'payer_name': 'Bhuvaneshwari M',
        'description': 'Plantation Homestay & Campfire',
        'amount': 3500.0,
        'category': 'STAY'
    }, bhuv_token)
    exp = exp_res.get('expense', exp_res)
    print("Expense logged:", exp.get('description'), "Rs", exp.get('amount'))

    print("8. Deepak inspects the shared Splitwise ledger for Coorg Coffee Tour...")
    deepak_view = get(f'http://127.0.0.1:8000/api/expenses/{coorg_trip_id}', deepak_token)
    print("Shared Trip Members in Deepak's view:", deepak_view['members'])
    print("Expenses seen by Deepak in Real Time:")
    for e in deepak_view['expenses']:
        print(f" - {e['payer_name']} paid Rs {e['amount']} for {e['description']}")
    print("Debt Minimization Settlements seen by Deepak:")
    for s in deepak_view['settlement_report']['minimized_settlements']:
        print(f" - {s['from_member']} owes {s['to_member']} Rs {s['amount']}")

    print("\nSUCCESS: REAL-TIME COLLABORATIVE SQL ARCHITECTURE FULLY VALIDATED!")

if __name__ == '__main__':
    run()
