import numpy as np, pandas as pd, statsmodels.formula.api as smf, json
m=pd.read_csv('dados/municipios.csv')
z=lambda s:(s-s.mean())/s.std()
m['lpop']=np.log(m.pop2025)
for c in ['nec_saude','nec_educacao','nec_saneamento','nec_renda','lpop']: m['z_'+c]=z(m[c])
X='z_nec_saude+z_nec_educacao+z_nec_saneamento+z_nec_renda+z_lpop'
out={}
for y in ['lula_22_2t','lula_26_2t']:
    r=smf.ols(f'{y} ~ {X}+C(regiao)',m).fit(cov_type='cluster',cov_kwds={'groups':m.uf})
    ci=r.conf_int(); out[y]={k:[r.params[k],ci.loc[k,0],ci.loc[k,1]] for k in r.params.index}
    print(y, round(r.rsquared,3)); print(pd.DataFrame(out[y],index=['b','lo','hi']).T.round(3))
m['q']=pd.qcut(m.topsis,5,labels=[1,2,3,4,5])
for y in ['lula_22_2t','lula_26_2t']:
    m['v']=m[y]/100*m['votos_'+y[5:]] if False else 0
print(m.groupby('q')[['lula_22_2t','lula_26_2t']].mean().round(1))
for f in ['equidade','eficiencia']:
    a=pd.read_csv(f'/tmp/aloc_{f}.csv')
    res=[]
    for nm,form in [('raw','aloc_pc ~ lula_win'),('gid','aloc_pc ~ lula_win + C(gid)'),('gid+topsis','aloc_pc ~ lula_win + C(gid) + topsis')]:
        r=smf.ols(form,a).fit(cov_type='cluster',cov_kwds={'groups':a.uf}); ci=r.conf_int().loc['lula_win']
        res.append([nm,r.params.lula_win,ci[0],ci[1],r.pvalues.lula_win])
    out['aloc_'+f]=res; print(f,pd.DataFrame(res).round(2))
    w=a.groupby('lula_win').apply(lambda g:(g.aloc_pc*g.pop2025).sum()/g.pop2025.sum()); print(w.round(1))
json.dump(out,open('/home/claude/bar/stats.json','w'),default=float)
