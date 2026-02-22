import hashlib

def generate_hash(text, voice, lang):
    raw_data = f"{text}|{voice}|{lang}"
    return hashlib.sha256(raw_data.encode('utf-8')).hexdigest()[:16]

test_cases = [
    ("Hello World", "vi-VN-Standard-A", "vi-VN"),
    ("Xin chào, hôm nay trời đẹp quá!", "vi-VN-Wavenet-B", "vi-VN"),
    ("Tiếng Việt có dấu phức tạp", "en-US-Standard-C", "en-US"),
]

print("--- Python Hash Output ---")
for text, voice, lang in test_cases:
    print(f"{generate_hash(text, voice, lang)}  <- '{text}'")
