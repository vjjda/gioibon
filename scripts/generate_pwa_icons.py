# Path: scripts/generate_pwa_icons.py
import os
from PIL import Image, ImageDraw

def create_disciplined_icon(size):
    # Tạo ảnh nền trong suốt
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Padding
    p = size * 0.05
    
    # Màu sắc
    bg_color = (128, 0, 0, 255)  # Maroon (Đỏ nâu)
    gold_color = (255, 215, 0, 255) # Gold (Vàng kim)
    
    # Vẽ hình tròn nền (bo góc lớn hoặc tròn hẳn)
    draw.ellipse([p, p, size-p, size-p], fill=bg_color)
    
    # Vẽ Bánh xe pháp (Dhammachakra) cách điệu
    center = size / 2
    outer_r = size * 0.35
    inner_r = size * 0.1
    stroke = size * 0.04
    
    # Vòng ngoài
    draw.ellipse([center-outer_r, center-outer_r, center+outer_r, center+outer_r], outline=gold_color, width=int(stroke))
    
    # Vòng trong
    draw.ellipse([center-inner_r, center-inner_r, center+inner_r, center+inner_r], outline=gold_color, width=int(stroke/1.5))
    
    # 8 Nan hoa (Nan hoa tượng trưng cho sự vững chãi của giới luật)
    import math
    for i in range(8):
        angle = math.radians(i * 45)
        start_x = center + inner_r * math.cos(angle)
        start_y = center + inner_r * math.sin(angle)
        end_x = center + outer_r * math.cos(angle)
        end_y = center + outer_r * math.sin(angle)
        draw.line([start_x, start_y, end_x, end_y], fill=gold_color, width=int(stroke))

    return image

def main():
    icons_dir = 'web/public/assets/icons'
    os.makedirs(icons_dir, exist_ok=True)
    
    targets = {
        'android-chrome-192x192.png': 192,
        'android-chrome-512x512.png': 512,
        'apple-touch-icon.png': 180,
        'favicon-32x32.png': 32,
        'favicon-16x16.png': 16,
        'favicon.ico': 64 # Pillow sẽ tự convert sang ico nếu đuôi là .ico
    }
    
    for filename, size in targets.items():
        img = create_disciplined_icon(size)
        path = os.path.join(icons_dir, filename)
        
        if filename.endswith('.ico'):
            # Convert sang RGB để lưu ICO
            img.convert('RGB').save(path, format='ICO', sizes=[(size, size)])
        else:
            img.save(path)
        print(f"✅ Generated {path}")

if __name__ == '__main__':
    main()
