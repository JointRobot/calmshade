import json,urllib.request,concurrent.futures,subprocess,time
U='http://127.0.0.1:8099/fest.php?a='
KEY='test-desk-key-123456'
def call(a,body=None,admin=False,raw=None):
    data=raw if raw is not None else (json.dumps(body).encode() if body is not None else None)
    r=urllib.request.Request(U+a,data=data,headers={'Content-Type':'application/json',**({'X-Fest-Key':KEY} if admin else {})})
    try:
        with urllib.request.urlopen(r) as f: return f.status,json.load(f)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
def clear_hits(): subprocess.run(['php','-r',"$p=new PDO('sqlite:fest-data/fest.sqlite');$p->exec('DELETE FROM fest_hits');"],check=True)
def sql(q): subprocess.run(['php','-r',f"$p=new PDO('sqlite:fest-data/fest.sqlite');$p->exec(\"{q}\");"],check=True)
ok=0;bad=[]
def check(name,cond,info=''):
    global ok
    if cond: ok+=1
    else: bad.append(f'{name}: {info}')
g=lambda ph:{'name':'T','phone':ph}
st=lambda u,f,n,r=1,gu=2:{'unit':u,'from':f,'n':n,'rooms':r,'guests':gu}
c,j=call('state'); check('state',c==200 and j['ok'] and j['deskReady'],j)
# validation
for nm,b in [('unknown unit',{'stays':[st('nope','2027-01-26',1)],'passes':[]}),('zero rooms',{'stays':[st('calmshet','2027-01-26',1,0)],'passes':[]}),
  ('too long',{'stays':[st('calmshet','2027-01-26',50)],'passes':[]}),('before fest',{'stays':[st('calmshet','2027-01-20',2)],'passes':[]}),
  ('too many guests',{'stays':[st('calmshet','2027-01-26',1,1,5)],'passes':[]}),('bad date',{'stays':[st('calmshet','2027-02-30',1)],'passes':[]}),
  ('pass after',{'stays':[],'passes':[{'date':'2027-02-27','qty':1}]}),('empty',{'stays':[],'passes':[]}),('rooms > total',{'stays':[st('theeya','2027-01-26',1,5)],'passes':[]})]:
    c,j=call('book',{**b,'guest':g('9000000001')}); check(nm,c==409 and 'error' in j,(c,j))
c,j=call('book',raw=b'{not json'); check('malformed json',c==400,(c,j))
c,j=call('book',{'stays':[st('calmshet','2027-01-26',1)],'passes':[],'guest':{'name':'','phone':'9000000001'}}); check('no name',c==400,(c,j))
c,j=call('book',{'stays':[st('calmshet','2027-01-26',1)],'passes':[],'guest':{'name':'A','phone':'123'}}); check('short phone',c==400,(c,j))
c,j=call('book',{'stays':[st('calmshet','2027-01-26',1)],'passes':[],'guest':{'name':'A','phone':'9000000001','email':'x@'}}); check('bad email',c==400,(c,j))
# price guard
c,j=call('book',{'stays':[st('calmshet','2027-01-26',1)],'passes':[],'guest':g('9000000001'),'expectTotal':1}); check('stale price',c==409 and j.get('priceChanged'),(c,j))
clear_hits()
# race for theeya 2027-02-10: 6 parallel single-room bookings, 4 rooms
def one(i): return call('book',{'stays':[st('theeya','2027-02-10',1)],'passes':[],'guest':g(f'91000000{i:02d}')})
with concurrent.futures.ThreadPoolExecutor(6) as ex: res=list(ex.map(one,range(6)))
wins=[j for c,j in res if c==200]; check('race: exactly 4 win',len(wins)==4,[c for c,_ in res])
c,j=call('state'); check('race: occ 4',j['occ'].get('theeya',{}).get('2027-02-10')==4,j['occ'])
# surge: 5th room impossible; price of remaining nights unaffected
clear_hits()
# encore needs VIP
c,j=call('book',{'stays':[st('purrom','2027-02-26',2,1,1)],'passes':[],'guest':g('9200000001')}); check('encore blocked',c==409,(c,j))
c,j=call('book',{'stays':[st('purrom','2027-02-20',9,1,1)],'passes':[],'guest':g('9200000001')}); check('encore with vip',c==200 and j['tier']=='vip',(c,j))
vip=j
c,j=call('quote',{'stays':[st('lefarm','2027-01-25',30)],'passes':[]}); check('vvip quote',j['quote']['tier']=='vvip' and j['quote']['discount']==40000,j['quote'] and j['quote']['tier'])
# phone cap
clear_hits()
for i in range(3): call('book',{'stays':[st('ctheatre','2027-01-27',1)],'passes':[],'guest':g('9300000001')})
c,j=call('book',{'stays':[st('ctheatre','2027-01-27',1)],'passes':[],'guest':g('9300000001')}); check('phone cap',c==429,(c,j))
# ip throttle
clear_hits(); codes=[]
for i in range(11): codes.append(call('book',{'stays':[],'passes':[{'date':'2027-02-02','qty':1}],'guest':g(f'94000000{i:02d}')})[0])
check('ip throttle',codes[:10]==[200]*10 and codes[10]==429,codes)
clear_hits()
# find / mine / utr / cancel
c,j=call('find',{'ref':vip['ref'],'phone':'9999999999'}); check('find wrong phone',c==404,(c,j))
c,j=call('find',{'ref':vip['ref'].lower(),'phone':'+91 92000 00001'}); check('find ok',c==200 and j['token']==vip['token'],(c,j))
c,j=call('utr',{'ref':vip['ref'],'token':vip['token'],'utr':'12'}); check('utr short',c==400,(c,j))
c,j=call('utr',{'ref':vip['ref'],'token':'bad','utr':'123456789012'}); check('utr bad token',c==404,(c,j))
c,j=call('utr',{'ref':vip['ref'],'token':vip['token'],'utr':'123456789012, 223456789012'}); check('utr ok',c==200,(c,j))
c,j=call('mine',{'tickets':[{'ref':vip['ref'],'token':vip['token']},{'ref':vip['ref'],'token':'x'}]}); check('mine',len(j['bookings'])==1 and j['bookings'][0]['utrSent'],j)
w=wins[0]
c,j=call('cancel',{'ref':w['ref'],'token':w['token']}); c2,j2=call('cancel',{'ref':w['ref'],'token':w['token']}); check('cancel twice',c==200 and c2==200,(c,j,c2,j2))
c,j=call('state'); check('cancel frees room',j['occ']['theeya']['2027-02-10']==3,j['occ'].get('theeya'))
# admin
c,j=call('admin'); check('admin no key',c==403,(c,j))
c,j=call('status',{'ref':vip['ref'],'status':'confirmed'},True); check('confirm',c==200,(c,j))
c,j=call('cancel',{'ref':vip['ref'],'token':vip['token']}); check('guest cannot cancel paid',c==400,(c,j))
# expired hold then room taken then revive -> 409
w2=wins[1]; sql(f"UPDATE fest_bookings SET created_at=created_at-200000 WHERE ref='{w2['ref']}'")
c,j=call('state'); check('expired frees room',j['occ']['theeya']['2027-02-10']==2,j['occ'].get('theeya'))
for i in range(2): call('book',{'stays':[st('theeya','2027-02-10',1)],'passes':[],'guest':g(f'95000000{i:02d}')})
c,j=call('status',{'ref':w2['ref'],'status':'confirmed'},True); check('revive clash 409',c==409,(c,j))
c,j=call('status',{'ref':wins[0]['ref'],'status':'confirmed'},True); check('revive cancelled clash 409',c==409,(c,j))
c,j=call('settings',{'settings':{'firstNight':'2027-13-01'}},True); check('bad setting',c==400,(c,j))
c,j=call('settings',{'settings':{'tents':25,'surgeMax':'15'}},True); check('settings ok',c==200 and j['settings']['tents']==25 and j['settings']['surgeMax']==15,(c,j))
# listing + approve -> bookable
c,j=call('list',{'property':{'name':'Pawna Camp','type':'Campsite','location':'Pawna','rooms':2,'maxGuests':3,'rate':4000},'contact':{'name':'Raj','phone':'9123456780'}}); lid=j.get('id'); check('listing',c==200,(c,j))
c,j=call('book',{'stays':[st('L-'+str(lid),'2027-01-30',1)],'passes':[],'guest':g('9600000001')}); check('unapproved not bookable',c==409,(c,j))
call('approve',{'id':lid,'status':'approved'},True)
c,j=call('book',{'stays':[st('L-'+str(lid),'2027-01-30',1,1,3)],'passes':[],'guest':g('9600000001')}); check('partner price 4000+3x1000',c==200 and j['total']==7000,(c,j))
c,j=call('admin',None,True); check('admin lists',c==200 and len(j['bookings'])>10 and len(j['listings'])==1,c)
c,j=call('nope'); check('unknown action',c==404,c)
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',b) for b in bad]
