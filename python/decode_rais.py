import os, gzip, json, struct, numpy as np, pandas as pd, sys
base=os.path.join(os.environ.get('FONTES', 'fontes'), 'rais/docs/data/')
raw=gzip.decompress(open(base+'mun/2024.bin.gz','rb').read())
hl=struct.unpack('<I',raw[:4])[0]; cab=json.loads(raw[4:4+hl]); body=raw[4+hl:]
n=cab['n']; out={}
T={'u8':np.uint8,'u16':np.uint16,'u32':np.uint32}
for c in cab['cols']:
    dt=np.dtype(T[c['t']]); sz=n*dt.itemsize; b=np.frombuffer(body[c['o']:c['o']+sz],dtype=np.uint8)
    if c.get('p'): b=b.reshape(4,-1).T.copy().reshape(-1)
    out[c['k']]=b.view(dt)
df=pd.DataFrame(out)
mun=json.loads(gzip.decompress(open(base+'municipios.json.gz','rb').read()))
df['ibge']=np.array(mun['mun'])[df.mi]
df['rem_tot']=df.rem_m.astype(float)*(df.ativos-df.rem_f)
g=df.groupby('ibge').agg(vinc=('ativos','sum'), rem=('rem_tot','sum'), comrem=('ativos','sum'))
priv=df[df.setor==2].groupby('ibge').ativos.sum().rename('vinc_priv')
g=g.join(priv)
g['rem_media']=df.assign(n=df.ativos-df.rem_f).groupby('ibge').apply(lambda x: x.rem_tot.sum()/max(x.n.sum(),1))
g=g.reset_index()
print(cab['cols'], n, g.shape, g.vinc.sum(), g.vinc_priv.sum()); print(g.describe())
g.to_csv('dados/rais2024_mun.csv',index=False)
