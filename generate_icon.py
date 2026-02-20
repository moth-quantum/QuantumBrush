from PIL import Image, ImageDraw

def generate_icon(path):
    # Create a reasonably high-res icon (512x512)
    size = (512, 512)
    image = Image.new("RGBA", size, (0, 0, 0, 0)) # Transparent background
    draw = ImageDraw.Draw(image)
    
    # Scale from 24 units in SVG to 512 pixels
    scale = 512 / 24
    def s(val): return val * scale

    brand_color = (138, 102, 255, 255) # Bright purple
    muted_color = (138, 102, 255, 153) # 60% opacity

    # Center circle (r=3)
    r_center = s(3)
    draw.ellipse([s(12)-r_center, s(12)-r_center, s(12)+r_center, s(12)+r_center], fill=brand_color)

    # Outer dashed ring (r=10)
    # PIL doesn't do dashes easily, so we draw segments
    r_ring = s(10)
    for i in range(0, 360, 20): # 18 segments
        draw.arc([s(12)-r_ring, s(12)-r_ring, s(12)+r_ring, s(12)+r_ring], start=i, end=i+10, fill=brand_color, width=int(s(1.5)))

    # Satellites (r=1.5)
    r_sat = s(1.5)
    # Top (12, 2)
    draw.ellipse([s(12)-r_sat, s(2)-r_sat, s(12)+r_sat, s(2)+r_sat], fill=muted_color)
    # Right (22, 12)
    draw.ellipse([s(22)-r_sat, s(12)-r_sat, s(22)+r_sat, s(12)+r_sat], fill=muted_color)
    # Bottom (12, 22)
    draw.ellipse([s(12)-r_sat, s(22)-r_sat, s(12)+r_sat, s(22)+r_sat], fill=muted_color)
    # Left (2, 12)
    draw.ellipse([s(2)-r_sat, s(12)-r_sat, s(2)+r_sat, s(12)+r_sat], fill=muted_color)

    image.save(path)
    print(f"Branded icon saved to {path}")

if __name__ == "__main__":
    import os
    os.makedirs("assets", exist_ok=True)
    generate_icon("assets/icon.png")
