import urllib.request
import urllib.parse
import json

sheet_id = '1h6--jU1VAjrNwHY1TcCfWn9En_gl464fvMaheNPxaTU'
sheet_name = 'บันทึก StockCard'
encoded_sheet_name = urllib.parse.quote(sheet_name)
url = f'https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:json&sheet={encoded_sheet_name}&tq=SELECT%20*'

print(f"Fetching: {url}")

try:
    with urllib.request.urlopen(url) as response:
        content = response.read().decode('utf-8')
        print(f"Status: {response.status}")
        print("Content Peek:")
        print(content[:500])
        
        # Check for HTML login page
        if '<!DOCTYPE html>' in content or 'google.com/accounts' in content:
             print("ERROR: Login Page Detected (Auth Required)")
        elif 'google.visualization.Query.setResponse' in content:
             print("SUCCESS: JSON Data received")
        else:
             print("UNKNOWN: content format")
             
except Exception as e:
    print(f"Error: {e}")
