import re

with open('E:/Meine Python/2026/Tretmann/Tretmann WEB-APP/app.js', 'r', encoding='utf-8') as f:
    js_content = f.read()

with open('E:/Meine Python/2026/Tretmann/Tretmann WEB-APP/index.html', 'r', encoding='utf-8') as f:
    html_content = f.read()

js_ids = set(re.findall(r"getElementById\(['\"]([^'\"]+)['\"]\)", js_content))
html_ids = set(re.findall(r'id=["\']([^"\']+)["\']', html_content))

missing = js_ids - html_ids
print("Missing IDs:", missing)
print("Total JS IDs:", len(js_ids))
print("Total HTML IDs:", len(html_ids))
