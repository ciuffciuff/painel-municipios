import json, re, numpy as np, pandas as pd, collections, warnings; warnings.filterwarnings('ignore')
import statsmodels.formula.api as smf
from libpysal.weights import W
from esda.moran import Moran
import spreg
m=pd.read_csv('dados/municipios.csv')
mesh=json.load(open('dados/malha_municipios.json'))
vert=collections.defaultdict(set); cent={}
for r in mesh:
    pts=[tuple(map(float,p.split(','))) for p in re.findall(r'-?\d+\.?\d*,-?\d+\.?\d*', r['d'])]
    cent[int(r['cod'])]=np.array(pts).mean(0)
    for p in pts: vert[p].add(int(r['cod']))
nb=collections.defaultdict(set)
for s in vert.values():
    for c in s: nb[c]|=s-{c}
d=m.set_index('cod').loc[[int(r['cod']) for r in mesh]].reset_index()
for c in d.cod:
    if not nb[c]:
        others=[o for o in d.cod if o!=c]; dist=[np.linalg.norm(cent[c]-cent[o]) for o in others]
        o=others[int(np.argmin(dist))]; nb[c].add(o); nb[o].add(c)
w=W({c:list(nb[c]) for c in d.cod}, id_order=list(d.cod)); w.transform='r'
z=lambda s:(s-s.mean())/s.std()
d['var']=d.lula_26_2t-d.lula_22_2t; d['lpop']=np.log(d.pop2025)
for c in ['nec_saude','nec_educacao','nec_saneamento','nec_renda','lpop','renda_pc','emprego_1000','bf_cob']: d['z_'+c]=z(d[c])
X='z_nec_saude+z_nec_educacao+z_nec_saneamento+z_nec_renda+z_lpop'
reg_d=pd.get_dummies(d.regiao,drop_first=True).astype(float)
cols=['z_nec_saude','z_nec_educacao','z_nec_saneamento','z_nec_renda','z_lpop']
Xm=np.column_stack([d[cols].values,reg_d.values]); names=cols+list(reg_d.columns)
res={}
for y in ['lula_26_2t','lula_22_2t','var']:
    r=spreg.ML_Error(d[[y]].values,Xm,w=w,name_x=names,name_y=y)
    b=np.asarray(r.betas).ravel(); se=np.sqrt(np.diag(r.vm))
    res[y]={n:[b[i],b[i]-1.96*se[i],b[i]+1.96*se[i]] for i,n in enumerate(['const']+names) if n.startswith('z_')}; res[y]['lambda']=b[-1]
    print(y,{k:np.round(v,3) for k,v in res[y].items()})
json.dump(res,open('/home/claude/bar/sem.json','w'),default=float)
