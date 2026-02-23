import re
import os

INPUT_FILE = 'data/content/content_source.tsv'

def smarten_text_segment(text):
    if not text:
        return text

    # Double quotes
    # Open: Start of string or whitespace/brackets before "
    text = re.sub(r'(^|[\s(\[{])"', r'\1“', text)
    # Close: Any remaining "
    text = text.replace('"', '”')
    
    # Single quotes
    # Open: Start of string or whitespace/brackets before '
    text = re.sub(r"(^|[\s(\[{])'", r"\1‘", text)
    # Close: Any remaining '
    text = text.replace("'", "’")
    return text

def process_cell_content(text):
    if not text:
        return text
    
    # Split by tags to protect attributes
    # Capturing parentheses in re.split keep the separators
    parts = re.split(r'(<[^>]+>)', text)
    
    processed_parts = []
    for part in parts:
        if part.startswith('<') and part.endswith('>'):
            processed_parts.append(part)
        else:
            processed_parts.append(smarten_text_segment(part))
            
    return "".join(processed_parts)

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"File not found: {INPUT_FILE}")
        return

    processed_lines = []
    header_processed = False
    segment_idx = -1

    with open(INPUT_FILE, 'r', encoding='utf-8') as f:
        for line in f:
            # Strip trailing newline characters
            original_line_content = line.rstrip('\r\n')
            
            if not original_line_content:
                processed_lines.append(line) # Keep empty lines as is
                continue
                
            parts = original_line_content.split('\t')
            
            if not header_processed:
                # Assuming first non-empty line is header
                try:
                    segment_idx = parts.index('segment')
                    header_processed = True
                except ValueError:
                    print("Error: Column 'segment' not found in header.")
                    return
                processed_lines.append(line)
                continue
            
            # Process row
            if segment_idx != -1 and len(parts) > segment_idx:
                parts[segment_idx] = process_cell_content(parts[segment_idx])
            
            # Reconstruct line with newline
            processed_lines.append('\t'.join(parts) + '\n')

    # Write back to file
    with open(INPUT_FILE, 'w', encoding='utf-8') as f:
        f.writelines(processed_lines)
        
    print(f"Successfully processed {INPUT_FILE}")

if __name__ == "__main__":
    main()
