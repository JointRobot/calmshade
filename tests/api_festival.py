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
import re as _re
_h=open('index.html').read(); _m=_re.search(r'const FX_UNITS0=(\[.*?\]);',_h)
c,j=call('state'); _srv={u['id']:(u['rooms'],u['cap'],u['rate'],u['rateWe'],u['extra']) for u in j['units'] if u['kind']!='partner'}
_pg={u['id']:(u['rooms'],u['cap'],u['rate'],u['rateWe'],u['extra']) for u in json.loads(_m.group(1))} if _m else {}
check('page fallback rooms match fest.php (set before any desk edits)',set(_pg)==set(_srv),(sorted(set(_pg)^set(_srv))))
c,j=call('state'); check('state',c==200 and j['ok'] and j['deskReady'],j)
# validation
for nm,b in [('unknown unit',{'stays':[st('nope','2027-02-16',1)],'passes':[]}),('zero rooms',{'stays':[st('calmshet.cottage','2027-02-16',1,0)],'passes':[]}),
  ('too long',{'stays':[st('calmshet.cottage','2027-02-16',50)],'passes':[]}),('before fest',{'stays':[st('calmshet.cottage','2027-02-10',2)],'passes':[]}),
  ('too many guests',{'stays':[st('calmshet.cottage','2027-02-16',1,1,5)],'passes':[]}),('bad date',{'stays':[st('calmshet.cottage','2027-02-30',1)],'passes':[]}),
  ('pass after',{'stays':[],'passes':[{'date':'2027-03-20','qty':1}]}),('empty',{'stays':[],'passes':[]}),('rooms > total',{'stays':[st('theeya.room','2027-02-16',1,5)],'passes':[]})]:
    c,j=call('book',{**b,'guest':g('9000000001')}); check(nm,c==409 and 'error' in j,(c,j))
c,j=call('book',raw=b'{not json'); check('malformed json',c==400,(c,j))
c,j=call('book',{'stays':[st('calmshet.cottage','2027-02-16',1)],'passes':[],'guest':{'name':'','phone':'9000000001'}}); check('no name',c==400,(c,j))
c,j=call('book',{'stays':[st('calmshet.cottage','2027-02-16',1)],'passes':[],'guest':{'name':'A','phone':'123'}}); check('short phone',c==400,(c,j))
c,j=call('book',{'stays':[st('calmshet.cottage','2027-02-16',1)],'passes':[],'guest':{'name':'A','phone':'9000000001','email':'x@'}}); check('bad email',c==400,(c,j))
# price guard
c,j=call('book',{'stays':[st('calmshet.cottage','2027-02-16',1)],'passes':[],'guest':g('9000000001'),'expectTotal':1}); check('stale price',c==409 and j.get('priceChanged'),(c,j))
clear_hits()
# race for theeya 2027-03-03: 6 parallel single-room bookings, 4 rooms
def one(i): return call('book',{'stays':[st('theeya.room','2027-03-03',1)],'passes':[],'guest':g(f'91000000{i:02d}')})
with concurrent.futures.ThreadPoolExecutor(6) as ex: res=list(ex.map(one,range(6)))
wins=[j for c,j in res if c==200]; check('race: exactly 4 win',len(wins)==4,[c for c,_ in res])
c,j=call('state'); check('race: occ 4',j['occ'].get('theeya.room',{}).get('2027-03-03')==4,j['occ'])
# surge: 5th room impossible; price of remaining nights unaffected
clear_hits()
# no Encore: the last nights are open to everyone; VIP from 6 nights (6% off), VVIP from 9 (9% off)
c,j=call('quote',{'stays':[st('shambhala.dorm','2027-03-18',2,1,1)],'passes':[]}); check('last nights open without VIP',j['ok'] and j['quote']['tier']=='' and j['quote']['discount']==0,j)
c,j=call('quote',{'stays':[st('shambhala.dorm','2027-03-12',5,1,1)],'passes':[]}); check('5 nights not VIP',j['ok'] and j['quote']['tier']=='',j)
c,j=call('quote',{'stays':[st('shambhala.dorm','2027-03-12',6,1,1)],'passes':[]}); x=j['quote']; check('6 nights = vip, 6% off',x['tier']=='vip' and x['discount']==round(x['stays']*6/100) and x['total']==x['stays']-x['discount'],x)
c,j=call('book',{'stays':[st('shambhala.dorm','2027-03-12',6,1,1)],'passes':[],'guest':g('9200000001')}); check('book vip',c==200 and j['tier']=='vip' and j['total']==x['total'],(c,j))
vip=j
# festival runs 12 Feb – 19 Mar 2027 (36 days); day passes every festival day
c,j=call('quote',{'stays':[st('shambhala.bedroom','2027-02-12',1)],'passes':[]}); check('opening night 12 Feb bookable',j['ok'],j)
c,j=call('quote',{'stays':[st('shambhala.bedroom','2027-02-11',1)],'passes':[]}); check('11 Feb outside festival',not j['ok'],j)
c,j=call('quote',{'stays':[],'passes':[{'date':'2027-03-19','qty':1}]}); check('day pass on 19 Mar',j['ok'],j)
c,j=call('quote',{'stays':[st('shambhala.dorm','2027-03-19',1,1,1)],'passes':[]}); check('19 Mar last night bookable',j['ok'],j)
c,j=call('quote',{'stays':[st('shambhala.dorm','2027-03-19',2,1,1)],'passes':[]}); check('20 Mar outside festival',not j['ok'],j)
# venue real rate + festival ticket per guest per night; venue paid exactly its real rate
q=lambda *a:call('quote',{'stays':[st(*a)],'passes':[]})[1]['quote']
# each place's own price + 3% Calm Shade fee (partner venues) + a festival ticket per guest per night; owner paid exactly its price
x=q('shambhala.bedroom','2027-02-16',1); check('shambhala weeknight 6510+3%+2x2000',x['total']==6510+195+4000 and x['payout']==6510 and x['fee']==195,x)
x=q('shambhala.bedroom','2027-02-19',1); check('shambhala friday 7560+3%+2x2000',x['total']==7560+227+4000 and x['payout']==7560,x)
x=q('shambhala.bedroom','2027-02-16',1,1,3); check('shambhala 3 adults +extra +3 tickets',x['total']==8505+255+3*2000 and x['payout']==8505,x)
x=q('purrom.mango','2027-02-16',1,1,1); check('purrom solo dome 4000+3%+1 ticket',x['total']==6120 and x['payout']==4000,x)
x=q('calmshet.cottage','2027-02-16',1); check('calmshet (own place, no fee) 8000 + 2 tickets',x['total']==12000 and x['payout']==0 and x['fee']==0,x)
x=q('calmshet.cottage','2027-02-16',1,1,3); check('calmshet 3 adults 8000+4000 + 3 tickets',x['total']==12000+6000,x)
x=q('calmshet.room1','2027-02-16',1,1,1); check('calmshet room for one still pays the room for two',x['total']==8000+2000,x)
c,j=call('quote',{'stays':[st('lefarm.bedroom','2027-02-15',9)],'passes':[]}); check('vvip quote: 9 nights, 9% off',j['quote']['tier']=='vvip' and j['quote']['discount']==round(j['quote']['stays']*9/100),j['quote'])
# phone cap
clear_hits()
for i in range(3): call('book',{'stays':[st('ctheatre.room','2027-02-17',1)],'passes':[],'guest':g('9300000001')})
c,j=call('book',{'stays':[st('ctheatre.room','2027-02-17',1)],'passes':[],'guest':g('9300000001')}); check('phone cap',c==429,(c,j))
# ip throttle
clear_hits(); codes=[]
for i in range(11): codes.append(call('book',{'stays':[],'passes':[{'date':'2027-02-23','qty':1}],'guest':g(f'94000000{i:02d}')})[0])
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
c,j=call('state'); check('cancel frees room',j['occ']['theeya.room']['2027-03-03']==3,j['occ'].get('theeya.room'))
# admin
c,j=call('admin'); check('admin no key',c==403,(c,j))
c,j=call('status',{'ref':vip['ref'],'status':'confirmed'},True); check('confirm',c==200,(c,j))
c,j=call('cancel',{'ref':vip['ref'],'token':vip['token']}); check('guest cannot cancel paid',c==400,(c,j))
# expired hold then room taken then revive -> 409
w2=wins[1]; sql(f"UPDATE fest_bookings SET created_at=created_at-200000 WHERE ref='{w2['ref']}'")
c,j=call('state'); check('expired frees room',j['occ']['theeya.room']['2027-03-03']==2,j['occ'].get('theeya.room'))
for i in range(2): call('book',{'stays':[st('theeya.room','2027-03-03',1)],'passes':[],'guest':g(f'95000000{i:02d}')})
c,j=call('status',{'ref':w2['ref'],'status':'confirmed'},True); check('revive clash 409',c==409,(c,j))
c,j=call('status',{'ref':wins[0]['ref'],'status':'confirmed'},True); check('revive cancelled clash 409',c==409,(c,j))
c,j=call('settings',{'settings':{'firstNight':'2027-13-01'}},True); check('bad setting',c==400,(c,j))
c,j=call('settings',{'settings':{'tents':25,'surgeMax':'15'}},True); check('settings ok',c==200 and j['settings']['tents']==25 and j['settings']['surgeMax']==15,(c,j))
# listing + approve -> bookable
c,j=call('list',{'property':{'name':'Pawna Camp','type':'Campsite','location':'Pawna','rooms':2,'maxGuests':3,'rate':4000},'contact':{'name':'Raj','phone':'9123456780'}}); lid=j.get('id'); check('listing',c==200,(c,j))
c,j=call('book',{'stays':[st('L-'+str(lid),'2027-02-20',1)],'passes':[],'guest':g('9600000001')}); check('unapproved not bookable',c==409,(c,j))
call('approve',{'id':lid,'status':'approved'},True)
c,j=call('book',{'stays':[st('L-'+str(lid),'2027-02-20',1,1,3)],'passes':[],'guest':g('9600000001')}); check('partner price 4000+3%+3x2000 ticket',c==200 and j['total']==10120,(c,j))
c,j=call('admin',None,True); check('admin lists',c==200 and len(j['bookings'])>10 and len(j['listings'])==1,c)
c,j=call('nope'); check('unknown action',c==404,c)
# adventures: ₹50 deposit per person now, balance at the venue; seats per slot; holds release like rooms
clear_hits()
c,j=call('state'); check('state has adventures',set(j['adv'])=={'kayak','paraglide','jeep'} and len(j['adv']['kayak']['slots'])==18,j.get('adv'))
c,j=call('quote',{'stays':[],'passes':[],'advs':[{'adv':'kayak','date':'2027-02-14','slot':'07:20','qty':2}]}); x=j['quote']
check('kayak quote: deposit now',j['ok'] and x['total']==100 and x['advs']==100 and x['balance']==600 and x['discount']==0,x)
c,j=call('quote',{'stays':[st('shambhala.dorm','2027-03-12',6,1,1)],'passes':[],'advs':[{'adv':'paraglide','date':'2027-03-13','slot':'wind','qty':1}]}); x=j['quote']
check('vip discount ignores deposits',x['tier']=='vip' and x['discount']==round(x['stays']*6/100) and x['total']==x['stays']-x['discount']+50 and x['balance']==3450,x)
for nm,a in [('bad slot',{'adv':'kayak','date':'2027-02-14','slot':'12:00','qty':1}),('bad adv',{'adv':'zip','date':'2027-02-14','slot':'wind','qty':1}),('outside fest',{'adv':'jeep','date':'2027-03-20','slot':'20:30','qty':1}),('zero people',{'adv':'jeep','date':'2027-02-14','slot':'20:30','qty':0})]:
    c,j=call('quote',{'stays':[],'passes':[],'advs':[a]}); check('adv '+nm,not j['ok'],j)
c,j=call('book',{'stays':[],'passes':[],'advs':[{'adv':'jeep','date':'2027-02-20','slot':'20:30','qty':4}],'guest':g('9700000001')}); check('book jeep 4',c==200 and j['total']==200 and not j['passOnly'],(c,j))
jeep=j
c,j=call('quote',{'stays':[],'passes':[],'advs':[{'adv':'jeep','date':'2027-02-20','slot':'20:30','qty':2}]}); check('jeep full: 1 left',not j['ok'] and 'only 1 place left' in j['errors'][0],j)
c,j=call('state'); check('advOcc counts the hold',j['advOcc'].get('jeep|2027-02-20|20:30')==4,j['advOcc'])
sql("UPDATE fest_bookings SET created_at=created_at-200000 WHERE ref='"+jeep['ref']+"'")
c,j=call('quote',{'stays':[],'passes':[],'advs':[{'adv':'jeep','date':'2027-02-20','slot':'20:30','qty':5}]}); check('unpaid adv hold releases',j['ok'],j)
c,j=call('admin',None,True); b=[x for x in j['bookings'] if x['ref']==jeep['ref']][0]; check('expired adv booking shows expired',b['status']=='expired',b['status'])
# timetable: starting programme until the desk saves its own; ranges and kinds; logo panel
c,j=call('state'); sc=j['schedule']
check('default programme',len(sc)==27 and sum(1 for i in sc if i['kind']=='dhol')==13 and all(i['date']>='2027-02-12' for i in sc),len(sc))
check('exhibits run all festival',sum(1 for i in sc if i['kind']=='exhibit' and i['to']=='2027-03-19')==10,[i['title'] for i in sc if i['kind']=='exhibit'])
check('default logos',len(j['logos'])==19 and [l['name'] for l in j['logos'] if l['group']=='curator']==['Sangoma Records','KRUNK','Bandish Project','Vani','National Permit','Animela','Wench Film Festival','Chabb','Wobble Creative','Marvel','Maval Comics'] and [l['name'] for l in j['logos'] if l['group']=='venue'][-1]=='Cloud Base' and [l['name'] for l in j['logos'] if l['group']=='partner']==['Calm Shade'],j['logos'])
# a list the desk saved before 26 Oct gets the three partners merged in once
import sqlite3; _c=sqlite3.connect('fest-data/fest.sqlite'); _c.execute('INSERT INTO fest_kv (k,v) VALUES (?,?)',('logos',json.dumps([{'id':'c1','name':'KRUNK','group':'curator','img':'','url':''}]))); _c.commit(); _c.close()
c,j=call('state'); check('old saved list: Sangoma first, then the 26 Oct additions',[l['name'] for l in j['logos']]==['Sangoma Records','KRUNK','Chabb','Wobble Creative','Marvel','Maval Comics','Cloud Base','Calm Shade'],j['logos'])
c,j=call('schedule_set',{'items':[{'date':'2027-02-14','to':'2027-02-16','time':'19:00','spot':'calmshet','title':'Run','kind':'workshop'},{'date':'2027-02-14','to':'2027-02-10','spot':'','title':'Bad range','kind':'zzz'}]},True)
T={i['title']:i for i in j.get('schedule',[])}; check('schedule ranges',c==200 and T['Run']['to']=='2027-02-16' and T['Run']['kind']=='workshop' and T['Bad range']['to']=='' and T['Bad range']['kind']=='show' and T['Run']['access']=='all',j)
c,j=call('schedule_set',{'items':[]}); check('schedule needs desk',c in (401,403),c)
c,j=call('logos_set',{'items':[{'name':'KRUNK','group':'curator','img':'uploads/202610/'+'a'*24+'.png','url':'https://krunk.in'},{'name':'X','group':'nope'},{'name':'Y','group':'sponsor','img':'javascript:alert(1)','url':'ftp://x'}]},True)
check('logos saved + cleaned',c==200 and len(j['logos'])==2 and j['logos'][0]['img'].startswith('uploads/') and j['logos'][1]['img']=='' and j['logos'][1]['url']=='',j)
c,j=call('logos_set',{'items':[]}); check('logos need desk',c in (401,403),c)
c,j=call('state'); check('state has saved logos',len(j['logos'])==2,j['logos'])

# --- places & rooms, two-step payments, extras, tents, legacy bookings (25 Oct 2026) ---
clear_hits()
c,j=call('state'); ids={u['id'] for u in j['units']}
check('rooms on the board',{'calmshet.cottage','calmshet.room1','calmshet.room2','calmshet.triangle','calmshet.appacottage','lefarm.bedroom','shambhala.dorm','purrom.chickoo','tents'}<=ids and 'calmshet.appahouse' not in ids,sorted(ids))
c,j=call('book',{'stays':[st('lefarm.bedroom','2027-03-15',2,2,2)],'passes':[],'guest':g('9810000001')}); check('no owner UPI: one payment to Calm Shade',c==200 and j['pay']['hosts']==[] and j['pay']['calm']==j['total'],(c,j))
c,j=call('places_set',{'id':'lefarm','place':{'upi':'bad upi'}},True); check('bad UPI refused',c==400,(c,j))
c,j=call('places_set',{'id':'lefarm','place':{'upi':'lefarm@okhdfcbank','payee':'Le Farm'}},True); check('owner UPI saved',c==200,(c,j))
c,j=call('book',{'stays':[st('lefarm.bedroom','2027-03-15',1,1,2)],'passes':[],'extras':[{'id':'pickup','qty':1}],'guest':g('9810000002','')}) if False else call('book',{'stays':[st('lefarm.bedroom','2027-03-15',1,1,2)],'passes':[],'extras':[{'id':'pickup','qty':1}],'guest':g('9810000002')})
two=j; h=(j.get('pay') or {}).get('hosts') or [{}]
check('two steps: owner gets exactly its price',c==200 and h[0].get('upi')=='lefarm@okhdfcbank' and h[0]['amount']==6700 and j['pay']['calm']==j['total']-6700,(c,j))
check('extra added to step 1',any(i['kind']=='extra' and i['total']==1000 for i in j.get('items',[{'kind':'extra','total':1000}])) and j['total']==two['pay']['calm']+6700,j)
c,j=call('status',{'ref':two['ref'],'status':'confirmed'},True); check('step 1 confirmed -> part',c==200 and j['status']=='part',(c,j))
c,j=call('mine',{'tickets':[{'ref':two['ref'],'token':two['token']}]}); check('guest sees step 2',j['bookings'][0]['status']=='part' and j['bookings'][0]['pay']['hosts'][0]['amount']==6700,j)
c,j=call('utr',{'ref':two['ref'],'token':two['token'],'place':'lefarm','utr':'556677889900'}); check('step 2 reference',c==200,(c,j))
c,j=call('state'); check('part booking holds its room',j['occ']['lefarm.bedroom']['2027-03-15']==3,j['occ'].get('lefarm.bedroom'))
c,j=call('host_paid',{'ref':two['ref'],'place':'lefarm','paid':True},True); check('owner paid -> confirmed',c==200 and j['status']=='confirmed' and j['pay']['hosts'][0]['utr']=='556677889900',(c,j))
c,j=call('quote',{'stays':[],'passes':[],'extras':[{'id':'pickup','qty':1}]}); check('extras need a booking',not j['ok'],j)
c,j=call('quote',{'stays':[{**st('tents','2027-02-20',1),'spot':'theeya'}],'passes':[]}); x=j['quote']; check('tent: tickets included, spot kept',x['total']==9000 and x['items'][0]['spot']=='theeya',x)
c,j=call('state'); tu=[u for u in j['units'] if u['id']=='tents'] if isinstance(j.get('units'),list) else [j['units'].get('tents')]; check('tents are open-ended',tu and tu[0]['rooms']==999 and tu[0].get('open') is True,tu)
c,j=call('quote',{'stays':[st('purrom.chickoo','2027-02-16',1,1,5)],'passes':[]}); check('chickoo max 4',not j['ok'],j)
# a booking made before rooms existed (unit = the whole venue) still blocks rooms
import sqlite3; _d=sqlite3.connect('fest-data/fest.sqlite'); _d.execute("INSERT INTO fest_bookings (ref,token,status,created_at,tier,total,payout,items,guest) VALUES ('APPA-OLD01','t','confirmed',?,'',1,1,?,'{}')",(int(time.time()),json.dumps([{'kind':'stay','unit':'calmshet','nights':['2027-03-09'],'rooms':2,'guests':2}]))); _d.commit(); _d.close()
c,j=call('state'); o=j['occ']; check('legacy venue booking fills its rooms',o.get('calmshet.cottage',{}).get('2027-03-09')==1 and o.get('calmshet.room1',{}).get('2027-03-09')==1,{k:v.get('2027-03-09') for k,v in o.items() if k.startswith('calmshet')})
# calmshade.in: festival nights of festival rooms only with tickets; Appa Art House kept for the artist
c,j=call('cs_book',{'legs':[{'prop':'p4','nights':['2027-02-20'],'heads':2,'meals':True}],'guest':g('9820000001')}); check('Calmshet listing in festival: tickets only',c==409 and 'festival tickets' in j['error'],(c,j))
c,j=call('cs_book',{'legs':[{'prop':'p6','nights':['2027-03-01'],'heads':8,'meals':True}],'guest':g('9820000001')}); check('Appa Art House reserved',c==409 and 'artist' in j['error'],(c,j))
c,j=call('cs_book',{'legs':[{'prop':'lefarm.bedroom','nights':['2027-02-25'],'rooms':1,'guests':2}],'guest':g('9820000001')}); check('venue room in festival: tickets only',c==409,(c,j))
c,j=call('cs_book',{'legs':[{'prop':'lefarm.bedroom','nights':['2027-04-05','2027-04-06'],'rooms':6,'guests':3}],'guest':g('9820000001')}); x=j
check('venue room off-festival: per room + 3%, two steps',c==200 and x['total']==2*6*(6700+2360+272) and x['pay']['hosts'][0]['amount']==2*6*(6700+2360),(c,j))
c,j=call('cs_book',{'legs':[{'prop':'lefarm.bedroom','nights':['2027-04-05'],'rooms':1,'guests':2}],'guest':g('9820000002')}); check('all 6 rooms taken',c==409,(c,j))
c,j=call('cs_state'); check('calendar: full room, festival nights',j['occ']['lefarm.bedroom']['2027-04-05']=='bk' and j['occ']['p4']['2027-02-20']=='fx' and j['occ']['p6']['2027-03-01']=='ar',{k:j['occ'].get(k,{}).get('2027-04-05') for k in ['lefarm.bedroom']})
c,j=call('cs_props'); v=[p for p in j['props'] if p['id']=='v-shambhala']; check('venues are Calm Shade listings',len(v)==1 and len(v[0]['rooms'])==2 and v[0]['place']=='shambhala',[p['id'] for p in j['props']])
c,j=call('places_import',{'id':'theeya'},True); check('photo import: no website, clear message',c==400 and 'no website' in j['error'],(c,j))
c,j=call('places_import',{'id':'lefarm','links':['http://127.0.0.1:8099/index.html']},True); check('photo import refuses local addresses',c==404,(c,j))
c,j=call('places_import',{'id':'lefarm'}); check('photo import needs desk',c==403,(c,j))
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',b) for b in bad]
