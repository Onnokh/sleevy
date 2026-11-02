import re, math
src = open('../../apps/web/public/logo-mark.svg').read()
paths = re.findall(r'd="([^"]+)"', src)
def parse(d):
    toks = re.findall(r'[MCHVZ]|-?\d+(?:\.\d+)?', d)
    i=0; cur=None; segs=[]; pt=None; start=None
    while i < len(toks):
        t=toks[i]
        if t in 'MCHVZ': cur=t; i+=1
        if cur=='M': pt=(float(toks[i]),float(toks[i+1])); start=pt; i+=2
        elif cur=='C':
            c=[float(x) for x in toks[i:i+6]]; i+=6
            segs.append(('C',pt,(c[0],c[1]),(c[2],c[3]),(c[4],c[5]))); pt=(c[4],c[5])
        elif cur=='H': n=(float(toks[i]),pt[1]); i+=1; segs.append(('L',pt,n)); pt=n
        elif cur=='V': n=(pt[0],float(toks[i])); i+=1; segs.append(('L',pt,n)); pt=n
        elif cur=='Z': segs.append(('L',pt,start)); pt=start
    return segs
K = 4/3*(math.sqrt(2)-1)
for n,d in enumerate(paths,1):
    segs = parse(d)
    xs=[p[0] for s in segs for p in s[1:]]; ys=[p[1] for s in segs for p in s[1:]]
    print(f"bar {n}: x {min(xs)}..{max(xs)}  y {min(ys)}..{max(ys)}  h={max(ys)-min(ys)}")
    for s in segs:
        if s[0]=='C':
            p0,c1,c2,p3=s[1:]
            # quarter circle: centre is the corner opposite the tangent intersection
            r=abs(p3[0]-p0[0]); r2=abs(p3[1]-p0[1])
            # centre: for a quarter arc, centre shares x with one end and y with the other
            cands=[(p0[0],p3[1]),(p3[0],p0[1])]
            # pick candidate where both ends at distance r
            cen=min(cands,key=lambda c: abs(math.dist(c,p0)-r)+abs(math.dist(c,p3)-r) + (0 if math.dist(c,c1)>math.dist(c,p0)*0.9 else 1e3))
            k1=math.dist(p0,c1)/r; k2=math.dist(p3,c2)/r
            # max radial error along the bezier
            err=0
            for i in range(101):
                t=i/100; mt=1-t
                x=mt**3*p0[0]+3*mt*mt*t*c1[0]+3*mt*t*t*c2[0]+t**3*p3[0]
                y=mt**3*p0[1]+3*mt*mt*t*c1[1]+3*mt*t*t*c2[1]+t**3*p3[1]
                err=max(err,abs(math.dist((x,y),cen)-r))
            print(f"   arc {p0}->{p3}  r={r} (dy {r2})  centre={cen}  kappa={k1:.5f}/{k2:.5f} (ideal {K:.5f})  max radial dev={err:.3f}")
        else:
            p0,p1=s[1:]; print(f"   line {p0}->{p1}  len={math.dist(p0,p1)}")
