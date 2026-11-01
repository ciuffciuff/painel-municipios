"""Converte a malha municipal (TopoJSON, IBGE simplificada) em caminhos SVG já projetados."""
import os, json, math, pandas as pd
topo = json.load(open(os.path.join(os.environ.get('FONTES', 'fontes'), 'rais/docs/data/brasil.topo.json')))
sx, sy = topo['transform']['scale']; tx, ty = topo['transform']['translate']
arcs = []
for a in topo['arcs']:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy; pts.append((x * sx + tx, y * sy + ty))
    arcs.append(pts)
LON0, LAT0 = -54.0, -15.0
K = math.cos(math.radians(LAT0))
W = 1000
lons = [p[0] for a in arcs for p in a]; lats = [p[1] for a in arcs for p in a]
xmin, xmax = (min(lons) - LON0) * K, (max(lons) - LON0) * K
s = W / (xmax - xmin)
H = (max(lats) - min(lats)) * s
latmax = max(lats)
proj = lambda lon, lat: ((lon - LON0) * K * s - xmin * s, (latmax - lat) * s)
print('viewBox 0 0', W, round(H))

def ring(r):
    pts = []
    for i in r:
        a = arcs[i] if i >= 0 else arcs[~i][::-1]
        pts.extend(a if not pts else a[1:])
    out, last = [], None
    for lon, lat in pts:
        x, y = proj(lon, lat); p = (round(x, 1), round(y, 1))
        if p != last: out.append(p); last = p
    if len(out) < 3: return ''
    return 'M' + 'L'.join(f'{x:g},{y:g}' for x, y in out) + 'Z'

def path(geom):
    if geom['type'] == 'Polygon': polys = [geom['arcs']]
    elif geom['type'] == 'MultiPolygon': polys = geom['arcs']
    else: return ''
    return ''.join(ring(r) for p in polys for r in p)

mun = [{'cod': int(g['properties']['id']), 'd': path(g)} for g in topo['objects']['mun']['geometries']]
uf = [{'uf': g['properties']['uf'], 'd': path(g)} for g in topo['objects']['uf']['geometries']]
print(sum(1 for m in mun if not m['d']), 'vazios')
json.dump(mun, open('dados/malha_municipios.json', 'w'), separators=(',', ':'), ensure_ascii=False)
json.dump(uf, open('dados/malha_ufs.json', 'w'), separators=(',', ':'), ensure_ascii=False)
json.dump({'w': W, 'h': round(H)}, open('dados/viewbox.json', 'w'))
