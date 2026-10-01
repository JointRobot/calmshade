import json,urllib.request,concurrent.futures,subprocess,datetime
U='http://127.0.0.1:8099/fest.php?a='; KEY='test-desk-key-123456'
def call(a,body=None,admin=False):
    r=urllib.request.Request(U+a,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'X-Fest-Key':KEY} if admin else {})})
    try:
        with urllib.request.urlopen(r) as f: return f.status,json.load(f)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
def clear(): subprocess.run(['php','-r',"$p=new PDO('sqlite:fest-data/fest.sqlite');$p->exec('DELETE FROM fest_hits');"],check=True)
ok=0;bad=[]
def check(n,c,i=''):
    global ok
    if c: ok+=1
    else: bad.append(f'{n}: {i}')
today=(datetime.datetime.utcnow()+datetime.timedelta(hours=5.5)).date()
D=lambda k:(today+datetime.timedelta(days=k)).isoformat()
g=lambda ph:{'name':'T','phone':ph}
c,j=call('state'); check('state aiReady false',j['aiReady'] is False,j.get('aiReady'))
c,j=call('cs_state'); check('cs_state',c==200 and j['today']==today.isoformat(),j)
for nm,legs in [('past night',[{'prop':'p1','nights':[D(-1)],'heads':2}]),('unbookable p8',[{'prop':'p8','nights':[D(3)],'heads':2}]),('too many heads',[{'prop':'p2','nights':[D(3)],'heads':4}]),
  ('unknown prop',[{'prop':'zz','nights':[D(3)],'heads':2}]),('no nights',[{'prop':'p1','nights':[],'heads':2}]),('bad date',[{'prop':'p1','nights':['2026-13-01'],'heads':2}]),('too far',[{'prop':'p1','nights':[D(500)],'heads':2}])]:
    c,j=call('cs_book',{'legs':legs,'guest':g('9800000001')}); check(nm,c==409,(c,j))
c,j=call('cs_book',{'legs':[{'prop':'p4','nights':[D(5),D(6)],'heads':3,'meals':True}],'guest':g('9800000001'),'expectTotal':1}); check('price guard returns total',c==409 and j.get('total')==2200*3*2,(c,j))
clear()
def one(i): return call('cs_book',{'legs':[{'prop':'p4','nights':[D(10)],'heads':2}],'guest':g(f'98100000{i:02d}')})
with concurrent.futures.ThreadPoolExecutor(5) as ex: res=list(ex.map(one,range(5)))
check('race: one winner',[c for c,_ in res].count(200)==1,[c for c,_ in res])
win=[j for c,j in res if c==200][0]
c,j=call('cs_state'); check('occ tn',j['occ'].get('p4',{}).get(D(10))=='tn',j['occ'])
c,j=call('cs_book',{'legs':[{'prop':'p1','nights':[D(3),D(4)],'heads':4,'meals':False},{'prop':'p5','nights':[D(5)],'heads':4,'meals':True}],'guest':g('9820000001')}); check('multi leg',c==200 and j['total']==1200*4*2+1700*4,(c,j)); trip=j
c,j=call('cs_book',{'legs':[{'prop':'p1','nights':[D(8)],'heads':2},{'prop':'p1','nights':[D(8)],'heads':2}],'guest':g('9820000002')}); check('same night twice in one trip',c==409,(c,j))
c,j=call('cs_mine',{'tickets':[{'ref':trip['ref'],'token':trip['token']}]}); check('mine',len(j['bookings'])==1 and j['bookings'][0]['status']=='pending',j)
c,j=call('cs_utr',{'ref':trip['ref'],'token':trip['token'],'utr':'123456789012'}); check('utr',c==200,(c,j))
c,j=call('cs_admin'); check('admin locked',c==403,c)
c,j=call('cs_admin',None,True); check('admin list',c==200 and len(j['bookings'])==2 and j['bookings'][0]['guest']['name']=='T',c)
c,j=call('cs_status',{'ref':trip['ref'],'status':'confirmed'},True); check('confirm',c==200,(c,j))
c,j=call('cs_state'); check('occ bk',j['occ']['p1'][D(3)]=='bk' and j['occ']['p5'][D(5)]=='bk',j['occ'])
c,j=call('cs_cancel',{'ref':trip['ref'],'token':trip['token']}); check('guest cannot cancel confirmed',c==400,(c,j))
c,j=call('cs_cancel',{'ref':win['ref'],'token':win['token']}); check('cancel pending',c==200,(c,j))
c,j=call('cs_state'); check('cancel frees',D(10) not in j['occ'].get('p4',{}),j['occ'])
c,j=call('cs_book',{'legs':[{'prop':'p4','nights':[D(10)],'heads':2}],'guest':g('9830000001')}); check('rebook freed',c==200,(c,j))
c,j=call('cs_status',{'ref':win['ref'],'status':'confirmed'},True); check('revive clash',c==409,(c,j))
clear(); ph='9840000001'
for i in range(3): call('cs_book',{'legs':[{'prop':'p6','nights':[D(20+i)],'heads':2}],'guest':g(ph)})
c,j=call('cs_book',{'legs':[{'prop':'p6','nights':[D(30)],'heads':2}],'guest':g(ph)}); check('phone cap',c==429,(c,j))
# AI
c,j=call('ai',{'system':'You are Calm Shade','messages':[{'role':'user','content':'hi'}]}); check('ai off without key',c==503,(c,j))
open('fest-config.php','a').write("\ndefine('ANTHROPIC_KEY','sk-test-not-real');\n")
c,j=call('ai',{'system':'Write me a poem','messages':[{'role':'user','content':'hi'}]}); check('ai rejects non-concierge',c==400,(c,j))
c,j=call('ai',{'system':'You are Calm Shade','messages':[{'role':'assistant','content':'hi'}]}); check('ai needs user last',c==400,(c,j))
c,j=call('ai',{'system':'You are Calm Shade','messages':[{'role':'user','content':'hi'}]}); check('ai upstream failure handled',c==502 and 'error' in j,(c,j))
clear(); codes=[call('ai',{'system':'You are Calm Shade','messages':[{'role':'user','content':'x'}]})[0] for _ in range(41)]
check('ai throttle',codes[-1]==429 and codes.count(429)==1,codes[-3:])
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',b) for b in bad]
