"""
Generates high-fidelity shaded Evil Queen character avatars with supersampling,
3D gradient lighting, ornate crown, sculpted hair, glossy eyes, and expressive mouths.
Downscaled with Lanczos filtering for smooth, crisp rendering.
"""
from PIL import Image, ImageDraw, ImageFilter
import math
import os

OUT = os.path.join(os.path.dirname(__file__), "src", "assets", "mouths")
os.makedirs(OUT, exist_ok=True)

SUPER = 2
FINAL_SIZE = 512
SIZE = FINAL_SIZE * SUPER # 1024x1024 internal resolution

def create_base():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # 1. High Royal Collar (Deep obsidian/purple with gold trim)
    collar_poly = [
        (200*SUPER, 480*SUPER),
        (130*SUPER, 280*SUPER),
        (250*SUPER, 370*SUPER),
        (512//2*SUPER, 390*SUPER),
        (SIZE - 250*SUPER, 370*SUPER),
        (SIZE - 130*SUPER, 280*SUPER),
        (SIZE - 200*SUPER, 480*SUPER)
    ]
    # Collar shadow
    d.polygon(collar_poly, fill=(22, 12, 28, 255))
    d.line([collar_poly[1], collar_poly[2], (SIZE//2, 390*SUPER), collar_poly[4], collar_poly[5]], fill=(212, 175, 55, 255), width=6*SUPER)

    # 2. Slender Regal Neck with soft shadow
    neck_box = [205*SUPER, 360*SUPER, 307*SUPER, 460*SUPER]
    d.rounded_rectangle(neck_box, radius=25*SUPER, fill=(210, 168, 145, 255))
    # Neck shadow gradient
    for i in range(25):
        alpha = int(140 * (1.0 - i/25.0))
        d.rectangle([205*SUPER, (360+i)*SUPER, 307*SUPER, (361+i)*SUPER], fill=(130, 80, 80, alpha))

    # 3. Head (Oval with 3D porcelain skin tone)
    head_box = [135*SUPER, 115*SUPER, 377*SUPER, 415*SUPER]
    d.ellipse(head_box, fill=(238, 202, 180, 255))
    
    # 3D Cheek Contour & Shadowing
    contour = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    cd = ImageDraw.Draw(contour)
    cd.ellipse([125*SUPER, 160*SUPER, 180*SUPER, 380*SUPER], fill=(185, 130, 115, 110))
    cd.ellipse([332*SUPER, 160*SUPER, 387*SUPER, 380*SUPER], fill=(185, 130, 115, 110))
    # Chin highlight
    cd.ellipse([225*SUPER, 365*SUPER, 287*SUPER, 405*SUPER], fill=(255, 230, 215, 90))
    # Forehead highlight
    cd.ellipse([200*SUPER, 150*SUPER, 312*SUPER, 230*SUPER], fill=(255, 240, 230, 80))
    contour = contour.filter(ImageFilter.GaussianBlur(14*SUPER))
    img = Image.alpha_composite(img, contour)
    d = ImageDraw.Draw(img)

    # 4. Sculpted Dark Regal Hair
    # Back cowl / hair
    d.ellipse([115*SUPER, 85*SUPER, 397*SUPER, 390*SUPER], outline=(20, 12, 22, 255), width=8*SUPER)
    # Front styled widow's peak bangs
    bangs = [
        (135*SUPER, 200*SUPER),
        (170*SUPER, 140*SUPER),
        (256*SUPER, 185*SUPER), # Widow's peak
        (342*SUPER, 140*SUPER),
        (377*SUPER, 200*SUPER),
        (385*SUPER, 100*SUPER),
        (256*SUPER, 85*SUPER),
        (127*SUPER, 100*SUPER)
    ]
    d.polygon(bangs, fill=(18, 14, 24, 255))
    # Hair gloss highlight
    d.arc([160*SUPER, 110*SUPER, 352*SUPER, 160*SUPER], 200, 340, fill=(75, 60, 95, 180), width=4*SUPER)

    # 5. Golden Queen Crown with Ruby Gems
    crown_pts = [
        (175*SUPER, 135*SUPER),
        (185*SUPER, 60*SUPER),   # Left peak
        (220*SUPER, 100*SUPER),
        (256*SUPER, 35*SUPER),   # High Center peak
        (292*SUPER, 100*SUPER),
        (327*SUPER, 60*SUPER),   # Right peak
        (337*SUPER, 135*SUPER),
        (256*SUPER, 145*SUPER)
    ]
    d.polygon(crown_pts, fill=(225, 180, 50, 255), outline=(140, 100, 20, 255))
    # Crown rim
    d.rounded_rectangle([170*SUPER, 125*SUPER, 342*SUPER, 145*SUPER], radius=4*SUPER, fill=(245, 205, 75, 255), outline=(130, 90, 15, 255), width=2*SUPER)
    # Gems
    d.ellipse([250*SUPER, 65*SUPER, 262*SUPER, 82*SUPER], fill=(180, 20, 35, 255), outline=(255, 200, 200, 200))
    d.ellipse([182*SUPER, 80*SUPER, 190*SUPER, 92*SUPER], fill=(60, 140, 220, 255))
    d.ellipse([322*SUPER, 80*SUPER, 330*SUPER, 92*SUPER], fill=(60, 140, 220, 255))

    # 6. Arched Regal Eyebrows
    d.line([(170*SUPER, 222*SUPER), (205*SUPER, 205*SUPER), (232*SUPER, 215*SUPER)], fill=(30, 20, 30, 255), width=5*SUPER, joint="curve")
    d.line([(342*SUPER, 222*SUPER), (307*SUPER, 205*SUPER), (280*SUPER, 215*SUPER)], fill=(30, 20, 30, 255), width=5*SUPER, joint="curve")

    # 7. Eyes (Expressive, almond-shaped, with purple eyeshadow & reflections)
    # Eyeshadow
    shadow_layer = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow_layer)
    sd.ellipse([162*SUPER, 212*SUPER, 238*SUPER, 245*SUPER], fill=(85, 35, 80, 90))
    sd.ellipse([274*SUPER, 212*SUPER, 350*SUPER, 245*SUPER], fill=(85, 35, 80, 90))
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(5*SUPER))
    img = Image.alpha_composite(img, shadow_layer)
    d = ImageDraw.Draw(img)

    # Eyeballs (almond shape)
    eye_l = [172*SUPER, 225*SUPER, 232*SUPER, 258*SUPER]
    eye_r = [280*SUPER, 225*SUPER, 340*SUPER, 258*SUPER]
    d.ellipse(eye_l, fill=(250, 250, 252, 255), outline=(40, 25, 35, 255), width=3*SUPER)
    d.ellipse(eye_r, fill=(250, 250, 252, 255), outline=(40, 25, 35, 255), width=3*SUPER)

    # Irises (Emerald Green with dark limbal ring)
    d.ellipse([188*SUPER, 226*SUPER, 216*SUPER, 257*SUPER], fill=(30, 130, 85, 255), outline=(15, 60, 40, 255), width=2*SUPER)
    d.ellipse([296*SUPER, 226*SUPER, 324*SUPER, 257*SUPER], fill=(30, 130, 85, 255), outline=(15, 60, 40, 255), width=2*SUPER)
    # Pupils
    d.ellipse([197*SUPER, 235*SUPER, 207*SUPER, 248*SUPER], fill=(12, 10, 15, 255))
    d.ellipse([305*SUPER, 235*SUPER, 315*SUPER, 248*SUPER], fill=(12, 10, 15, 255))
    # Specular Catchlights (Gives life to the eyes!)
    d.ellipse([194*SUPER, 230*SUPER, 201*SUPER, 237*SUPER], fill=(255, 255, 255, 240))
    d.ellipse([302*SUPER, 230*SUPER, 309*SUPER, 237*SUPER], fill=(255, 255, 255, 240))
    d.ellipse([204*SUPER, 244*SUPER, 208*SUPER, 248*SUPER], fill=(255, 255, 255, 180))
    d.ellipse([312*SUPER, 244*SUPER, 316*SUPER, 248*SUPER], fill=(255, 255, 255, 180))

    # Upper Eyelashes / Liner
    d.arc(eye_l, 190, 350, fill=(25, 15, 25, 255), width=5*SUPER)
    d.arc(eye_r, 190, 350, fill=(25, 15, 25, 255), width=5*SUPER)

    # 8. Sculpted Nose with subtle shadow and tip highlight
    d.line([(254*SUPER, 242*SUPER), (250*SUPER, 288*SUPER)], fill=(195, 140, 125, 255), width=3*SUPER)
    d.arc([244*SUPER, 282*SUPER, 268*SUPER, 298*SUPER], 30, 150, fill=(180, 120, 105, 255), width=3*SUPER)
    d.ellipse([252*SUPER, 287*SUPER, 258*SUPER, 292*SUPER], fill=(255, 245, 240, 160))

    return img

def export_png(img, filename):
    final = img.resize((FINAL_SIZE, FINAL_SIZE), resample=Image.Resampling.LANCZOS)
    final.save(os.path.join(OUT, f"{filename}.png"), "PNG")
    print(f"Saved {filename}.png (512x512 anti-aliased)")

LIP_RED = (185, 25, 45, 255)
LIP_DARK = (120, 15, 30, 255)
INNER_MOUTH = (50, 10, 20, 255)
TEETH = (250, 250, 250, 245)

def shape_closed():
    img = create_base()
    d = ImageDraw.Draw(img)
    # Upper Lip
    upper = [(222*SUPER, 332*SUPER), (242*SUPER, 326*SUPER), (256*SUPER, 329*SUPER), (270*SUPER, 326*SUPER), (290*SUPER, 332*SUPER), (256*SUPER, 334*SUPER)]
    d.polygon(upper, fill=LIP_RED)
    # Lower Lip with 3D fullness
    lower = [(222*SUPER, 332*SUPER), (256*SUPER, 334*SUPER), (290*SUPER, 332*SUPER), (276*SUPER, 346*SUPER), (256*SUPER, 348*SUPER), (236*SUPER, 346*SUPER)]
    d.polygon(lower, fill=LIP_RED)
    # Lip center seam & highlight
    d.line([(222*SUPER, 332*SUPER), (256*SUPER, 334*SUPER), (290*SUPER, 332*SUPER)], fill=LIP_DARK, width=2*SUPER)
    d.ellipse([246*SUPER, 338*SUPER, 266*SUPER, 344*SUPER], fill=(255, 120, 140, 130))
    export_png(img, "closed")

def shape_small_open():
    img = create_base()
    d = ImageDraw.Draw(img)
    # Open cavity
    d.rounded_rectangle([232*SUPER, 327*SUPER, 280*SUPER, 346*SUPER], radius=6*SUPER, fill=INNER_MOUTH, outline=LIP_DARK, width=2*SUPER)
    # Teeth line
    d.rounded_rectangle([237*SUPER, 328*SUPER, 275*SUPER, 335*SUPER], radius=3*SUPER, fill=TEETH)
    # Lips
    d.arc([224*SUPER, 318*SUPER, 288*SUPER, 338*SUPER], 180, 360, fill=LIP_RED, width=5*SUPER)
    d.arc([226*SUPER, 334*SUPER, 286*SUPER, 354*SUPER], 0, 180, fill=LIP_RED, width=6*SUPER)
    export_png(img, "small_open")

def shape_wide_open():
    img = create_base()
    d = ImageDraw.Draw(img)
    # Wide opening
    d.ellipse([220*SUPER, 322*SUPER, 292*SUPER, 362*SUPER], fill=INNER_MOUTH, outline=LIP_DARK, width=3*SUPER)
    # Upper & lower teeth
    d.rounded_rectangle([230*SUPER, 324*SUPER, 282*SUPER, 336*SUPER], radius=4*SUPER, fill=TEETH)
    d.rounded_rectangle([236*SUPER, 350*SUPER, 276*SUPER, 358*SUPER], radius=3*SUPER, fill=TEETH)
    # Lips outline
    d.arc([216*SUPER, 316*SUPER, 296*SUPER, 342*SUPER], 175, 365, fill=LIP_RED, width=6*SUPER)
    d.arc([218*SUPER, 340*SUPER, 294*SUPER, 370*SUPER], -5, 185, fill=LIP_RED, width=7*SUPER)
    export_png(img, "wide_open")

def shape_round_oh():
    img = create_base()
    d = ImageDraw.Draw(img)
    # Rounded O mouth
    d.ellipse([236*SUPER, 325*SUPER, 276*SUPER, 360*SUPER], fill=INNER_MOUTH, outline=LIP_RED, width=6*SUPER)
    d.ellipse([242*SUPER, 330*SUPER, 270*SUPER, 340*SUPER], fill=TEETH)
    export_png(img, "round_oh")

def shape_smile_talk():
    img = create_base()
    d = ImageDraw.Draw(img)
    # Curved laughing/smiling mouth
    pts = [
        (220*SUPER, 328*SUPER),
        (292*SUPER, 328*SUPER),
        (280*SUPER, 355*SUPER),
        (256*SUPER, 360*SUPER),
        (232*SUPER, 355*SUPER)
    ]
    d.polygon(pts, fill=INNER_MOUTH, outline=LIP_DARK)
    d.rounded_rectangle([226*SUPER, 328*SUPER, 286*SUPER, 338*SUPER], radius=4*SUPER, fill=TEETH)
    d.arc([214*SUPER, 322*SUPER, 298*SUPER, 364*SUPER], 0, 180, fill=LIP_RED, width=6*SUPER)
    export_png(img, "smile_talk")

def shape_blink():
    img = create_base()
    d = ImageDraw.Draw(img)
    # Paint skin over open eyes
    eye_cover_l = [168*SUPER, 218*SUPER, 236*SUPER, 260*SUPER]
    eye_cover_r = [276*SUPER, 218*SUPER, 344*SUPER, 260*SUPER]
    d.ellipse(eye_cover_l, fill=(235, 198, 178, 255))
    d.ellipse(eye_cover_r, fill=(235, 198, 178, 255))
    # Eyelashes closed downwards
    d.arc([172*SUPER, 226*SUPER, 232*SUPER, 252*SUPER], 10, 170, fill=(35, 20, 30, 255), width=5*SUPER)
    d.arc([280*SUPER, 226*SUPER, 340*SUPER, 252*SUPER], 10, 170, fill=(35, 20, 30, 255), width=5*SUPER)
    # Closed lips
    shape_closed_d = d
    upper = [(222*SUPER, 332*SUPER), (242*SUPER, 326*SUPER), (256*SUPER, 329*SUPER), (270*SUPER, 326*SUPER), (290*SUPER, 332*SUPER), (256*SUPER, 334*SUPER)]
    shape_closed_d.polygon(upper, fill=LIP_RED)
    lower = [(222*SUPER, 332*SUPER), (256*SUPER, 334*SUPER), (290*SUPER, 332*SUPER), (276*SUPER, 346*SUPER), (256*SUPER, 348*SUPER), (236*SUPER, 346*SUPER)]
    shape_closed_d.polygon(lower, fill=LIP_RED)
    shape_closed_d.line([(222*SUPER, 332*SUPER), (256*SUPER, 334*SUPER), (290*SUPER, 332*SUPER)], fill=LIP_DARK, width=2*SUPER)
    export_png(img, "blink")

if __name__ == "__main__":
    shape_closed()
    shape_small_open()
    shape_wide_open()
    shape_round_oh()
    shape_smile_talk()
    shape_blink()
    print("Successfully generated high-fidelity Evil Queen character assets!")
