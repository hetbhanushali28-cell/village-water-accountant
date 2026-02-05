import urllib.request
import json
import time

# Wait for server to start if needed (assuming it's already running)
# time.sleep(1)

url = "http://127.0.0.1:8001/api/water-balance"
headers = {'Content-Type': 'application/json'}

def test_sync(input_type, payload, expected_fields):
    print(f"\n[TEST] Input: {input_type} | Payload: {payload}")
    req = urllib.request.Request(url, data=json.dumps(payload).encode('utf-8'), headers=headers)
    try:
        with urllib.request.urlopen(req) as response:
            result = json.loads(response.read().decode('utf-8'))
            data = result['data']
            
            # Check availability of "Other Two"
            missing = []
            found = []
            
            if 'region' in expected_fields:
                if data.get('region'): found.append(f"Region: {data['region']}")
                else: missing.append("Region")
            
            if 'pincode' in expected_fields:
                if data.get('pincode'): found.append(f"Pincode: {data['pincode']}")
                else: missing.append("Pincode")

            if 'lat' in expected_fields:
                if data.get('lat') and data.get('lng'): found.append(f"Coords: {data['lat']}, {data['lng']}")
                else: missing.append("Coords")
            
            if not missing:
                print(f"[PASS] Retrieved: {', '.join(found)}")
            else:
                print(f"[FAIL] Missing: {', '.join(missing)}")

    except Exception as e:
        print(f"[ERROR] {e}")

# 1. Enter Pincode -> Want Region + Coords
test_sync("Pincode (411001)", {"pincode": "411001"}, ["region", "lat"])

# 2. Enter Name -> Want Pincode + Coords
test_sync("Name (Pune)", {"query": "Pune"}, ["pincode", "lat"])

# 3. Enter Coords -> Want Region + Pincode
test_sync("Coords (18.52, 73.85)", {"lat": 18.52, "lng": 73.85}, ["region", "pincode"])
