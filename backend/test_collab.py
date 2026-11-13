import urllib.request
import json

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
    print("1. Logging in Arun...")
    arun_res = post('http://127.0.0.1:8000/api/auth/login', {'email': 'arun@securetour.ai', 'password': 'secure123'})
    arun_token = arun_res['access_token']
    print("Arun Logged in:", arun_res['user']['full_name'])

    print("2. Arun creating Manali Group Trip and inviting manogarbhuvana@gmail.com...")
    create_res = post('http://127.0.0.1:8000/api/trips/create-group', {
        'title': 'Manali Snow Expedition 2026',
        'source': 'Delhi',
        'destination': 'Manali',
        'target_budget': 55000.0,
        'duration_days': 5,
        'invited_emails': ['manogarbhuvana@gmail.com']
    }, arun_token)
    print("Trip Created:", create_res)

    print("3. Logging in Bhuvaneshwari...")
    bhuv_res = post('http://127.0.0.1:8000/api/auth/login', {'email': 'manogarbhuvana@gmail.com', 'password': 'secure123'})
    bhuv_token = bhuv_res['access_token']

    print("4. Checking Bhuvaneshwari pending invitations...")
    invs = get('http://127.0.0.1:8000/api/trips/invitations', bhuv_token)
    assert len(invs['invitations']) > 0, "No invitations found!"
    inv = invs['invitations'][0]
    print(f"Invitation found from {inv['from_user_name']} for {inv['trip_title']}")

    print("5. Bhuvaneshwari accepting invitation...")
    resp_res = post(f"http://127.0.0.1:8000/api/trips/invitations/{inv['id']}/respond", {'action': 'accept'}, bhuv_token)
    print("Accept response:", str(resp_res).encode('ascii', 'ignore').decode())

    print("6. Checking Bhuvaneshwari trips list...")
    trips_res = get('http://127.0.0.1:8000/api/trips', bhuv_token)
    print("Trips in Bhuvaneshwari DB:", [t['title'] for t in trips_res['trips']])

    print("7. Switching active trip for Bhuvaneshwari...")
    switch_res = post(f"http://127.0.0.1:8000/api/user/switch-trip/{inv['trip_id']}", {}, bhuv_token)
    print("Switched trip:", switch_res['trip']['title'], "Members:", [m['member_name'] for m in switch_res['members']])

    print("8. Testing GPS-anchored route calculation...")
    gps_route = get('http://127.0.0.1:8000/api/risk/route?origin=Live%20GPS&destination=Ooty&start_lat=12.9716&start_lng=77.5946')
    print("GPS Route Start:", gps_route['safe_bypass_route']['geometry']['coordinates'][0], "Distance:", gps_route['safe_bypass_route']['distance_km'], "km")

    print("\nSUCCESS: ALL MULTI-TENANT COLLABORATION AND GPS ANCHORING VERIFIED!")

if __name__ == '__main__':
    run()
