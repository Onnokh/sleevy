"""Build three logo construction boards for the Sleevy mark as layered SVG.

All geometry is in logo units (the 462x587 viewBox of apps/web/public/logo-mark.svg)
and is mapped onto a 2560x1440 artboard, so stroke widths stay exact in artboard px.
"""
import json
import math
import re
import sys

AW, AH = 2560, 1440
S = 1.05                       # logo scale: 587 * 1.05 = 616 px = 42.8% of 1440
W, H, R = 462, 587, 128
MC = (231, 293.5)              # mark centre
OX, OY = AW / 2 - MC[0] * S, AH / 2 - MC[1] * S

BG = "#F5F5F5"
TIERS = {
    "aux": {"stroke": "#7E7E7E", "width": 1.3, "dash": None},
    "sec": {"stroke": "#5C5C5C", "width": 1.7, "dash": "9 6"},
    "pri": {"stroke": "#2B2B2B", "width": 2.4, "dash": None},
}
# A near-opaque veil: the mark reads as one solid shape and the guides read as behind it
LOGO_FILL, LOGO_FILL_OPACITY, LOGO_STROKE, LOGO_W = "#C0C0C0", 0.74, "#111111", 3.0
NODE_STROKE = "#2B2B2B"

# Measured geometry (see measure.py)
BARS = [(0, 176), (205, 381), (410, 587)]
CENTRES = {                     # arc centres, by bar and corner
    "b1tl": (128, 128), "b1br": (334, 48),
    "b2tr": (334, 333), "b2bl": (128, 253),
    "b3tl": (128, 538), "b3br": (334, 459),
}
TANGENTS = [(0, 128), (128, 0), (462, 48), (334, 176),
            (334, 205), (462, 333), (0, 253), (128, 381),
            (0, 538), (128, 410), (462, 459), (334, 587)]
BBOX = [(0, 0), (W, 0), (0, H), (W, H)]


def T(p):
    return (OX + S * p[0], OY + S * p[1])


def f(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")


# ---------- elements (logo units in, artboard out) ----------

def line(a, b, ext=(0, 0)):
    """Segment a->b, extended by ext[0] units before a and ext[1] units past b."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy)
    ux, uy = dx / n, dy / n
    a2 = (a[0] - ux * ext[0], a[1] - uy * ext[0])
    b2 = (b[0] + ux * ext[1], b[1] + uy * ext[1])
    (x1, y1), (x2, y2) = T(a2), T(b2)
    return f'<line x1="{f(x1)}" y1="{f(y1)}" x2="{f(x2)}" y2="{f(y2)}"/>'


def circle(c, r):
    x, y = T(c)
    return f'<circle cx="{f(x)}" cy="{f(y)}" r="{f(r * S)}"/>'


def arc_in_band(c, r, y0, y1, rest=False):
    """The part of circle (c, r) inside the band y0..y1 (one side cut, one side tangent).

    With rest=True, the other part of the circle: the cap that leaves the band.
    """
    cx, cy = c
    if y1 < cy + r:             # cut at the bottom: arc runs over the top, left to right
        dx = math.sqrt(r * r - (y1 - cy) ** 2)
        a, b, cut = (cx - dx, y1), (cx + dx, y1), y1 - cy
    else:                       # cut at the top: arc runs under the bottom, right to left
        dx = math.sqrt(r * r - (y0 - cy) ** 2)
        a, b, cut = (cx + dx, y0), (cx - dx, y0), cy - y0
    large = 1 if cut > 0 else 0
    if rest:
        a, b, large = b, a, 1 - large
    (x1, y1_), (x2, y2) = T(a), T(b)
    return f'<path d="M{f(x1)} {f(y1_)} A{f(r * S)} {f(r * S)} 0 {large} 1 {f(x2)} {f(y2)}"/>'


def rect(x0, y0, x1, y1):
    (a, b), (c, d) = T((x0, y0)), T((x1, y1))
    return f'<rect x="{f(a)}" y="{f(b)}" width="{f(c - a)}" height="{f(d - b)}"/>'


def group(name, tier, items):
    t = TIERS[tier]
    dash = f' stroke-dasharray="{t["dash"]}"' if t["dash"] else ""
    body = "\n    ".join(items)
    return (f'  <g id="{name}" fill="none" stroke="{t["stroke"]}" '
            f'stroke-width="{t["width"]}"{dash}>\n    {body}\n  </g>')


# ---------- anchors ----------

def node(p, r=4.5):
    x, y = T(p)
    return f'<circle cx="{f(x)}" cy="{f(y)}" r="{r}"/>'


def corner_square(p, s=7):
    x, y = T(p)
    return f'<rect x="{f(x - s / 2)}" y="{f(y - s / 2)}" width="{s}" height="{s}"/>'


def centre_marker(p, arm=15, ring=6):
    x, y = T(p)
    return (f'<circle cx="{f(x)}" cy="{f(y)}" r="{ring}"/>'
            f'<line x1="{f(x - arm)}" y1="{f(y)}" x2="{f(x + arm)}" y2="{f(y)}"/>'
            f'<line x1="{f(x)}" y1="{f(y - arm)}" x2="{f(x)}" y2="{f(y + arm)}"/>')


def anchors_group(nodes=(), small=(), squares=BBOX, centre=MC):
    items = [node(p) for p in nodes] + [node(p, 3.4) for p in small]
    items += [corner_square(p) for p in squares]
    if centre:
        items.append(centre_marker(centre))
    body = "\n    ".join(items)
    return (f'  <g id="05 Anchors" fill="{BG}" stroke="{NODE_STROKE}" stroke-width="1.6">'
            f'\n    {body}\n  </g>')


# ---------- logo copy ----------

def logo_group():
    src = open("../../apps/web/public/logo-mark.svg").read()
    out = []
    for d in re.findall(r'd="([^"]+)"', src):
        toks = re.findall(r"[MCHVZ]|-?\d+(?:\.\d+)?", d)
        res, i, cur, pt = [], 0, None, (0, 0)
        while i < len(toks):
            if toks[i] in "MCHVZ":
                cur = toks[i]
                i += 1
                if cur == "Z":
                    res.append("Z")
                    continue
            if cur == "M":
                pt = (float(toks[i]), float(toks[i + 1])); i += 2
                x, y = T(pt); res.append(f"M{f(x)} {f(y)}")
            elif cur == "C":
                c = [float(v) for v in toks[i:i + 6]]; i += 6
                pts = [T((c[0], c[1])), T((c[2], c[3])), T((c[4], c[5]))]
                res.append("C" + " ".join(f"{f(a)} {f(b)}" for a, b in pts))
                pt = (c[4], c[5])
            elif cur == "H":
                pt = (float(toks[i]), pt[1]); i += 1
                res.append(f"H{f(T(pt)[0])}")
            elif cur == "V":
                pt = (pt[0], float(toks[i])); i += 1
                res.append(f"V{f(T(pt)[1])}")
        out.append(f'<path d="{"".join(res)}"/>')
    body = "\n    ".join(out)
    return (f'  <g id="04 Logo (copy)" fill="{LOGO_FILL}" fill-opacity="{LOGO_FILL_OPACITY}" '
            f'stroke="{LOGO_STROKE}" stroke-width="{LOGO_W}" stroke-linejoin="round">\n    {body}\n  </g>')


def board(name, aux, sec, pri, anchors):
    return "\n".join([
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{AW}" height="{AH}" viewBox="0 0 {AW} {AH}">',
        f'  <rect id="Background" width="{AW}" height="{AH}" fill="{BG}"/>',
        group("01 Auxiliary lines", "aux", aux),
        group("02 Secondary guides", "sec", sec),
        group("03 Primary construction", "pri", pri),
        logo_group(),
        anchors,
        "</svg>",
    ])


E = 56          # how far full-length guides reach past the bounding box
X0, X1, Y0, Y1 = -E, W + E, -E, H + E


# ---------- Direction 01: one radius on two columns ----------

def direction_01(split=False):
    # the corner circles of bar 1 BR and bar 3 TL reach 80 units past the box: frame them
    e = 96
    x0, x1, y0, y1 = -e, W + e, -e, H + e
    band = {"b1": BARS[0], "b2": BARS[1], "b3": BARS[2]}
    if split:
        pri = [arc_in_band(c, R, *band[k[:2]]) for k, c in CENTRES.items()]
    else:
        pri = [circle(c, R) for c in CENTRES.values()]
    pri += [line((128, y0), (128, y1)), line((334, y0), (334, y1))]
    sec = [line((x0, y), (x1, y)) for y in (0, 176, 205, 381, 410, 587)]
    sec += [line((0, y0), (0, y1)), line((W, y0), (W, y1))]
    if split:
        sec += [arc_in_band(c, R, *band[k[:2]], rest=True) for k, c in CENTRES.items()]
    # radius drawn from the side tangent point to the centre
    aux = [line((0 if c[0] < 231 else W, c[1]), c) for c in CENTRES.values()]
    aux += [line((231, y0), (231, y1))]
    anchors = anchors_group(nodes=CENTRES.values(), small=TANGENTS)
    return aux, sec, pri, anchors


# ---------- Direction 02: bar diagonal x corner bisector, half-turn ----------

def direction_02():
    diags = [((0, 176), (462, 0)), ((0, 205), (462, 381)), ((0, 587), (462, 410))]
    pri = [line(a, b) for a, b in diags]
    pri += [line((231, Y0), (231, Y1))]
    # rounded corner -> arc centre on the bar diagonal
    bis = [((0, 0), CENTRES["b1tl"]), ((462, 176), CENTRES["b1br"]),
           ((462, 205), CENTRES["b2tr"]), ((0, 381), CENTRES["b2bl"]),
           ((0, 410), CENTRES["b3tl"]), ((462, 587), CENTRES["b3br"])]
    sec = [line(a, b, (0, 24)) for a, b in bis]
    bar_centres = [(231, (a + b) / 2) for a, b in BARS]
    pairs = [("b1tl", "b1br"), ("b2tr", "b2bl"), ("b3tl", "b3br")]
    for bc, (p, q) in zip(bar_centres, pairs):
        sec.append(circle(bc, (math.dist(bc, CENTRES[p]) + math.dist(bc, CENTRES[q])) / 2))
    aux = [rect(0, a, W, b) for a, b in BARS]
    aux += [line((X0, MC[1]), (X1, MC[1]))]
    corners = [p for d in diags for p in d if p not in BBOX]
    anchors = anchors_group(nodes=list(CENTRES.values()),
                            small=[bar_centres[0], bar_centres[2]] + corners)
    return aux, sec, pri, anchors


# ---------- Direction 03: 45-degree rhythm between bars ----------

def direction_03():
    o = 40
    # 45-degree corner bisectors that run on from bar to bar (W - 2r = 206 ~ h + g = 205)
    chains = [((0, 0), (334, 334), o),      # B1 TL -> B2 TR (1 unit off its centre)
              ((0, 381), (334, 47), 0),     # B2 BL -> B1 BR (1 unit off its centre)
              ((462, 205), (128, 539), 0),  # B2 TR -> B3 TL (1 unit off its centre)
              ((462, 587), (128, 253), o)]  # B3 BR -> B2 BL (exact)
    pri = [line(a, b, (pre, o)) for a, b, pre in chains]
    squares = [(0, 0, 128, 128), (334, 48, 462, 176), (334, 205, 462, 333),
               (0, 253, 128, 381), (0, 410, 128, 538), (334, 459, 462, 587)]
    sec = [rect(*q) for q in squares]
    # gap centre lines: each bar is the mirror image of the next across them
    sec += [line((X0, 190.5), (X1, 190.5)), line((X0, 395.5), (X1, 395.5))]
    crossings = [(190.5, 190.5), (271, 396)]
    # circle about the mark centre through both crossings and both bar-2 arc centres
    ring = [crossings[0], crossings[1], CENTRES["b2tr"], CENTRES["b2bl"]]
    sec.append(circle(MC, sum(math.dist(MC, p) for p in ring) / len(ring)))
    aux = [line((462, 176), CENTRES["b1br"], (0, 24)), line((0, 410), CENTRES["b3tl"], (0, 24))]
    anchors = anchors_group(nodes=list(CENTRES.values()) + crossings)
    return aux, sec, pri, anchors


# ---------- Final board: Direction 01, reduced ----------

def minimal_board(fill="#C8C8C8", outline="#141414", outline_w=3, ink="#5E5E5E", width=1.6):
    """Logo plus its real structure, in one colour and one weight.

    Guides: the six corner circles, the two columns through their centres, and the logo's own
    straight edges (top and bottom of each bar, both sides) run past the mark.
    Layers: logo fill, then guides, then the logo outline, so a guide on an edge never breaks it.
    """
    e = 96          # the circles of bar 1 BR and bar 3 TL reach 80 units past the box
    guides = [circle(c, R) for c in CENTRES.values()]
    guides += [line((x, -e), (x, H + e)) for x in (0, 128, 334, W)]
    guides += [line((-e, y), (W + e, y)) for a, b in BARS for y in (a, b)]
    paths = [l.strip() for l in logo_group().splitlines() if l.strip().startswith("<path")]
    logo = "\n    ".join(paths)
    return "\n".join([
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{AW}" height="{AH}" viewBox="0 0 {AW} {AH}">',
        f'  <rect id="Background" width="{AW}" height="{AH}" fill="{BG}"/>',
        f'  <g id="Logo fill" fill="{fill}">\n    {logo}\n  </g>',
        f'  <g id="Construction" fill="none" stroke="{ink}" stroke-width="{width}">\n    '
        + "\n    ".join(guides) + "\n  </g>",
        f'  <g id="Logo outline" fill="none" stroke="{outline}" stroke-width="{outline_w}">\n    {logo}\n  </g>',
        "</svg>",
    ])


if __name__ == "__main__":
    open("Construction Grid — Direction 01.svg", "w").write(minimal_board())
    print("wrote Construction Grid — Direction 01 (final)")
    for n, fn in (("02", direction_02), ("03", direction_03)):
        name = f"Construction Grid — Direction {n}"
        open(f"{name}.svg", "w").write(board(name, *fn()))
        print("wrote", name, "(exploration)")
