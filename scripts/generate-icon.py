from PIL import Image, ImageDraw, ImageFont
import math

size = 512
img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)

# Squircle background with rounded corners (macOS style)
r = 100
draw.rounded_rectangle([20, 20, 492, 492], radius=r, fill=(24, 24, 27, 255))

# Subtle inner gradient border
draw.rounded_rectangle([20, 20, 492, 492], radius=r, outline=(63, 63, 70, 255), width=4)

# Inner soft glow
draw.rounded_rectangle([32, 32, 480, 480], radius=r-10, fill=(39, 39, 42, 255))

# Golden Amber Duck body circle
# Duck head
draw.ellipse([180, 100, 332, 252], fill=(245, 158, 11, 255)) # amber-500
# Duck eye
draw.ellipse([270, 140, 290, 160], fill=(24, 24, 27, 255))
draw.ellipse([278, 144, 286, 152], fill=(255, 255, 255, 255))
# Duck bill / beak
draw.polygon([(320, 160), (410, 185), (320, 210)], fill=(234, 88, 12, 255)) # orange-600

# Duck body
draw.ellipse([120, 200, 392, 400], fill=(217, 119, 6, 255)) # amber-600
# Wing highlight
draw.arc([160, 230, 320, 360], start=30, end=170, fill=(251, 191, 36, 255), width=8)

# Markdown Document / Book overlay at bottom
book_box = [156, 290, 356, 450]
draw.rounded_rectangle(book_box, radius=16, fill=(254, 252, 246, 255), outline=(214, 202, 183, 255), width=3)

# Markdown icon / text lines on the book
# Blue M and down arrow
draw.rectangle([186, 320, 326, 330], fill=(217, 119, 6, 255))
draw.rectangle([186, 345, 300, 352], fill=(161, 161, 170, 255))
draw.rectangle([186, 365, 315, 372], fill=(161, 161, 170, 255))
draw.rectangle([186, 385, 260, 392], fill=(161, 161, 170, 255))

# Subtle bookmark ribbon
draw.polygon([(300, 290), (320, 290), (320, 350), (310, 338), (300, 350)], fill=(239, 68, 68, 255))

img.save("assets/icon.png", "PNG")
print("Generated assets/icon.png successfully")
