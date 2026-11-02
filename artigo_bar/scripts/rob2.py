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
f=lambda r,k:f"{r.params[k]:.2f} [{r.conf_int().loc[k,0]:.2f}, {r.conf_int().loc[k,1]:.2f}]"
for y,k in [('lula_26_2t','z_nec_renda'),('lula_22_2t','z_nec_renda'),('var','z_nec_saneamento')]:
    r=smf.ols(f'{y} ~ {X}+C(uf)',d).fit(cov_type='cluster',cov_kwds={'groups':d.uf}); print('UF',y,f(r,k),round(r.rsquared,3))
    vv='votos_26_2t' if y!='lula_22_2t' else 'votos_22_2t'
    r=smf.wls(f'{y} ~ {X}+C(regiao)',d,weights=d[vv]).fit(cov_type='cluster',cov_kwds={'groups':d.uf}); print('WLS',y,f(r,k))
    r=spreg.ML_Lag(d[[y]].values,Xm,w=w,name_x=names,name_y=y); b=np.asarray(r.betas).ravel(); se=np.sqrt(np.diag(r.vm)); i=(['const']+names).index(k)
    print('LAG',y,f"{b[i]:.2f} [{b[i]-1.96*se[i]:.2f}, {b[i]+1.96*se[i]:.2f}] rho={b[-1]:.3f}")
