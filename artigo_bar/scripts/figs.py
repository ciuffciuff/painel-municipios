import json, numpy as np, pandas as pd, matplotlib
matplotlib.use('Agg'); import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch, FancyArrowPatch
from PIL import Image
plt.rcParams.update({'font.family':'Liberation Sans','font.size':9,'axes.spines.top':False,'axes.spines.right':False})
O='/home/claude/bar/fig/'
def save(fig,name):
    fig.savefig(O+name+'.png',dpi=300,bbox_inches='tight',facecolor='white')
    fig.savefig(O+'tmp.png',dpi=600,bbox_inches='tight',facecolor='white')
    Image.open(O+'tmp.png').convert('L').save(O+name+'.tif',compression='tiff_lzw',dpi=(600,600))
    Image.open(O+name+'.png').convert('L').save(O+name+'.png')
    plt.close(fig)
# Figure 1 CRISP-DM
fig,ax=plt.subplots(figsize=(6.3,4.8)); ax.set_xlim(0,10); ax.set_ylim(-0.4,7.4); ax.axis('off')
ph=[('1. Business (policy)\nunderstanding','RQ1-RQ5; need-based\nallocation and\nimpersonality'),
    ('2. Data\nunderstanding','IBGE, DATASUS, INEP,\nTSE, CGU; 5,570\nmunicipalities'),
    ('3. Data\npreparation','12 indicators; percentile\nneeds; empirical-Bayes\ninfant mortality'),
    ('4. Modeling','TOPSIS; k-means (k = 6);\nlinear programming;\nOLS and spatial models'),
    ('5. Evaluation','Clustered SE; Moran\'s I;\nstate FE; WLS; VIF;\nsolver cross-check'),
    ('6. Deployment','Open dashboard and\nautomated collection\n(scheduled workflows)')]
cx,cy,R=5,3.5,2.95; ang=np.deg2rad([90,30,-30,-90,-150,150])
pos=[(cx+R*1.25*np.cos(a),cy+R*np.sin(a)) for a in ang]
for (t,s),(x,y) in zip(ph,pos):
    ax.add_patch(FancyBboxPatch((x-1.3,y-0.72),2.6,1.44,boxstyle='round,pad=0.05',fc='#e6e6e6',ec='black',lw=0.8))
    ax.text(x,y+0.33,t,ha='center',va='center',fontsize=8,fontweight='bold')
    ax.text(x,y-0.36,s,ha='center',va='center',fontsize=6.5)
for i in range(6):
    a,b=pos[i],pos[(i+1)%6]
    v=np.array(b)-np.array(a); u=v/np.linalg.norm(v)
    ax.add_patch(FancyArrowPatch(tuple(np.array(a)+u*1.25),tuple(np.array(b)-u*1.25),arrowstyle='-|>',mutation_scale=10,color='black',lw=0.8,connectionstyle='arc3,rad=-0.15'))
ax.add_patch(plt.Circle((cx,cy),0.95,fc='white',ec='black',lw=0.8,ls='--'))
ax.text(cx,cy,'Municipal\nneed data\n(open sources)',ha='center',va='center',fontsize=7.5)
save(fig,'Figure1_CRISPDM')
# Figure 2 quintiles (vote-weighted shares)
q22=[39.5,49.1,54.4,67.9,74.4]; q26=[40.6,50.3,55.3,66.6,72.4]
fig,ax=plt.subplots(figsize=(6.3,3.2)); x=np.arange(5); w=0.38
b1=ax.bar(x-w/2,q22,w,color='#b3b3b3',ec='black',lw=0.5,label='2022 (vs. Jair Bolsonaro)')
b2=ax.bar(x+w/2,q26,w,color='#4d4d4d',ec='black',lw=0.5,label='2026 (vs. Flávio Bolsonaro)')
for bs in (b1,b2):
    for b in bs: ax.text(b.get_x()+b.get_width()/2,b.get_height()+1,f'{b.get_height():.1f}',ha='center',fontsize=7)
ax.axhline(50,color='black',lw=0.6,ls=':')
ax.set_xticks(x); ax.set_xticklabels(['Q1\n(lowest need)','Q2','Q3','Q4','Q5\n(highest need)'])
ax.set_ylabel('Lula, % of valid votes\n(second round)'); ax.set_ylim(0,85); ax.legend(frameon=False,loc='upper left')
save(fig,'Figure2_Quintiles')
# Figure 3 coefficient plot
s=json.load(open('/home/claude/bar/stats.json')); e=json.load(open('/home/claude/bar/sem.json'))
var=['z_nec_renda','z_nec_educacao','z_nec_saude','z_nec_saneamento','z_lpop']
lab=['Income need','Education need','Health need','Sanitation need','Log population']
ser=[('OLS 2022',s['lula_22_2t'],'o','white'),('OLS 2026',s['lula_26_2t'],'s','black'),('Spatial error 2026',e['lula_26_2t'],'^','#808080')]
fig,ax=plt.subplots(figsize=(6.3,3.4)); y=np.arange(len(var))[::-1]
for k,(n,d,mk,fc) in enumerate(ser):
    off=(k-1)*0.22
    for j,v in enumerate(var):
        b,lo,hi=d[v]; ax.plot([lo,hi],[y[j]+off]*2,color='black',lw=0.8)
        ax.plot(b,y[j]+off,marker=mk,mfc=fc,mec='black',ms=5,ls='',label=n if j==0 else None)
ax.axvline(0,color='black',lw=0.6,ls=':'); ax.set_yticks(y); ax.set_yticklabels(lab)
ax.set_xlabel('Change in Lula\'s vote share (p.p.) per 1 SD of the predictor (95% CI)'); ax.legend(frameon=False,loc='lower right')
save(fig,'Figure3_Coefficients')
# Figure 4 allocation
fig,axs=plt.subplots(1,2,figsize=(6.3,2.9),sharey=True)
names=['No controls','Within region ×\nprofile','Within region ×\nprofile + TOPSIS']
for ax,(k,t) in zip(axs,[('aloc_equidade','Equity (maximin)'),('aloc_eficiencia','Efficiency')]):
    r=s[k]; yy=np.arange(3)[::-1]
    for i,(nm,b,lo,hi,p) in enumerate(r):
        ax.plot([lo,hi],[yy[i]]*2,color='black',lw=0.9); ax.plot(b,yy[i],'o',mfc='#4d4d4d',mec='black',ms=5)
        ax.text(hi+4,yy[i],f'{b:.1f}',va='center',fontsize=7)
    ax.axvline(0,color='black',lw=0.6,ls=':'); ax.set_title(t,fontsize=9); ax.set_xlim(-25,165)
    ax.set_xlabel('R$ per inhabitant, Lula-won minus\nFlávio-won municipalities (95% CI)')
axs[0].set_yticks(np.arange(3)[::-1]); axs[0].set_yticklabels(names)
save(fig,'Figure4_Allocation')
import os; os.remove(O+'tmp.png')
