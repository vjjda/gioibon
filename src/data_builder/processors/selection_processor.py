# Path: src/data_builder/processors/selection_processor.py
import re

__all__ = ["SelectionProcessor"]

class SelectionProcessor:
    """Xử lý các đoạn lựa chọn trong ngoặc vuông [...hoặc...] với logic block/stacked."""

    def process(self, text: str) -> str:
        if '[' not in text:
            return text

        # 1. Tìm tất cả các cụm ngoặc vuông và dấu câu theo sau ngay lập tức
        groups = []
        pattern = r'\[(.*?)\]([.,;!:\?]*)'
        for match in re.finditer(pattern, text):
            content = match.group(1).strip()
            suffix = match.group(2) 
            
            items = []
            if content.startswith("hoặc"):
                items = re.split(r',\s*(?=hoặc)', content)
            elif " hoặc " in content:
                items = content.split(" hoặc ")
            else:
                items = [content]
            
            if items and suffix:
                items[-1] = items[-1].strip() + suffix
            
            groups.append({
                'content': content,
                'items': items,
                'start': match.start(),
                'end': match.end(),
                'suffix': suffix
            })

        if not groups:
            return text

        # 2. Xác định các cụm cần được "stacked" hoặc "block"
        for i, g in enumerate(groups):
            num_items = len(g['items'])
            g['is_block'] = num_items >= 3
            g['is_stacked'] = False
            
            if num_items == 2:
                is_any_item_long = any(len(p.split()) >= 4 for p in g['items'])
                if is_any_item_long:
                    g['is_stacked'] = True
                else:
                    if i > 0:
                        prev_g = groups[i-1]
                        if len(prev_g['items']) == 2:
                            between = text[prev_g['end']:g['start']]
                            if between.strip() == "":
                                g['is_stacked'] = True
                                prev_g['is_stacked'] = True
                    
                    if i < len(groups) - 1:
                        next_g = groups[i+1]
                        if len(next_g['items']) == 2:
                            between = text[g['end']:next_g['start']]
                            if between.strip() == "":
                                g['is_stacked'] = True
                                next_g['is_stacked'] = True

        # 3. Thực hiện thay thế từ cuối lên đầu
        result = text
        for g in reversed(groups):
            is_block = g['is_block']
            is_stacked = g['is_stacked']
            should_wrap = is_block or is_stacked
            
            items = g['items']
            content = g['content']
            
            processed_parts = []
            if content.startswith("hoặc"):
                for p in items:
                    p = p.strip()
                    m = re.match(r'^(hoặc là|hoặc)\s*(.*)$', p)
                    if m:
                        inner_html = f"<span class='selection-or'>{m.group(1)}</span> <span class='selection-item'>{m.group(2)}</span>"
                    else:
                        inner_html = f"<span class='selection-item'>{p}</span>"
                    
                    if should_wrap:
                        processed_parts.append(f"<div class='selection-row'>{inner_html}</div>")
                    else:
                        processed_parts.append(inner_html)
            elif " hoặc " in content:
                for idx, p in enumerate(items):
                    item_text = p.strip()
                    item_html = f"<span class='selection-item'>{item_text}</span>"
                    if idx == 0:
                        inner_html = item_html
                    else:
                        inner_html = f"<span class='selection-or'>hoặc</span> {item_html}"
                    
                    if should_wrap:
                        processed_parts.append(f"<div class='selection-row'>{inner_html}</div>")
                    else:
                        processed_parts.append(inner_html)
            else:
                processed_parts = [f"<span class='selection-item'>{items[0]}</span>"]

            sep = "" if should_wrap else (", " if content.startswith("hoặc") else " ")
            inner_content = sep.join(processed_parts)
            
            tag = "div" if should_wrap else "span"
            classes = ["selection-group"]
            if is_block:
                classes.append("is-block")
            elif is_stacked:
                classes.append("is-stacked")
            
            replacement = f"<{tag} class='{' '.join(classes)}'>{inner_content}</{tag}>"
            result = result[:g['start']] + replacement + result[g['end']:]

        return result
