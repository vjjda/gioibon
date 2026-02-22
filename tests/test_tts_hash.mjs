const testCases = [
    ["Hello World", "vi-VN-Standard-A", "vi-VN"],
    ["Xin chào, hôm nay trời đẹp quá!", "vi-VN-Wavenet-B", "vi-VN"],
    ["Tiếng Việt có dấu phức tạp", "en-US-Standard-C", "en-US"],
];

async function generateHash(text, voice, lang) {
    const rawString = `${text}|${voice}|${lang}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(rawString);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
}

(async () => {
    console.log("--- JS (Node) Hash Output ---");
    for (const [text, voice, lang] of testCases) {
        const h = await generateHash(text, voice, lang);
        console.log(`${h}  <- '${text}'`);
    }
})();
