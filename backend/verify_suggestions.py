import urllib.request
import json
import time

url_base = "http://127.0.0.1:8001/api/suggestions"

def test_suggestions(query):
    url = f"{url_base}?query={query}"
    print(f"\n[TEST] Suggestion Query: '{query}'")
    try:
        with urllib.request.urlopen(url) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data:
                print(f"[PASS] Found {len(data)} results:")
                for item in data:
                    print(f" - {item['label']} (Val: {item['value']})")
            else:
                print(f"[WARN] No results found.")
    except Exception as e:
        print(f"[ERROR] {e}")

# Test 1: Typing "Pun" (Should match Pune)
test_suggestions("Pun")

# Test 2: Typing "400" (Should match Mumbai Pincodes)
test_suggestions("400")

# Test 3: Typing "xyz" (Should match nothing)
test_suggestions("xyz")
