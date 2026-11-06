# Calendar sync: Airbnb-style .ics in (blocks nights everywhere), Calm Shade feed out, failures keep the last good dates.
import json,urllib.request,threading,http.server,datetime
U='http://127.0.0.1:8099/fest.php?a='; KEY='test-desk-key-123456'
ok=0;bad=[]
def check(n,c,i=''):
    global ok
    if c: ok+=1
    else: bad.append(f'{n}: {i}')
def call(a,body=None,admin=False,hdr=None):
    r=urllib.request.Request(U+a,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'X-Fest-Key':KEY} if admin else {}),**(hdr or {})})
    try:
        with urllib.request.urlopen(r) as f: return f.status,json.load(f)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
today=datetime.date.today()
def D(n): return (today+datetime.timedelta(days=200+n)).isoformat()
def C(n): return D(n).replace('-','')
STATE={'body':'','code':200}
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        self.send_response(STATE['code']); self.send_header('Content-Type','text/calendar'); self.end_headers(); self.wfile.write(STATE['body'].encode())
    def log_message(self,*a): pass
srv=http.server.ThreadingHTTPServer(('127.0.0.1',8098),H); threading.Thread(target=srv.serve_forever,daemon=True).start()
FEED='http://127.0.0.1:8098/airbnb.ics'
def ics(*events): return 'BEGIN:VCALENDAR\r\nVERSION:2.0\r\n'+''.join(events)+'END:VCALENDAR\r\n'
def ev(s,e=None,extra=''): return 'BEGIN:VEVENT\r\nSUMMARY:Reserved\r\nDTSTART;VALUE=DATE:'+s+'\r\n'+(('DTEND;VALUE=DATE:'+e+'\r\n') if e else '')+extra+'END:VEVENT\r\n'
ROOM='calmshet.room1'
STATE['body']=ics(ev(C(0),C(2)), ev(C(10),C(12),'STATUS:CANCELLED\r\n'), ev(C(20)), 'BEGIN:VEVENT\r\nDTSTART:'+C(30)+'T150000Z\r\nDTEND:'+C(32)+'T\r\n 060000Z\r\nEND:VEVENT\r\n')
# who may connect
c,j=call('ical_set',{'unit':ROOM,'urls':FEED}); check('needs desk or host key',c in (401,403),(c,j))
c,j=call('ical_set',{'unit':ROOM,'urls':'not a link'},True); check('rejects a bad link',c==400,(c,j))
c,j=call('ical_set',{'unit':'nowhere.x','urls':FEED},True); check('unknown stay',c==404,(c,j))
c,j=call('ical_set',{'unit':ROOM,'urls':FEED},True); check('connected',c==200 and j['ok'] and j['cal']['blocked']==5,(c,j))   # 2 + 1 + 2 nights; cancelled ignored
# dates now blocked everywhere
c,j=call('cs_state'); o=j['occ'].get(ROOM,{})
check('external nights block the room',o.get(D(0))=='bk' and o.get(D(1))=='bk' and o.get(D(2))!='bk',o)
check('no-DTEND event = one night',o.get(D(20))=='bk' and o.get(D(21))!='bk',o)
check('cancelled event ignored',D(10) not in o and D(11) not in o,o)
check('date-time event: nights up to check-out day',o.get(D(30))=='bk' and o.get(D(31))=='bk' and o.get(D(32))!='bk',o)
c,j=call('cs_book',{'legs':[{'prop':ROOM,'nights':[D(1)],'rooms':1,'guests':2}],'guest':{'name':'Asha','phone':'9811112222'}}); check('guest cannot book an Airbnb-booked night',c==409,(c,j))
c,j=call('state'); check('festival board sees it too',(j['occ'].get(ROOM,{}).get(D(0)) or 0)>=1,j['occ'].get(ROOM))
c,b=call('cs_book',{'legs':[{'prop':ROOM,'nights':[D(2),D(3)],'rooms':1,'guests':2}],'guest':{'name':'Asha','phone':'9811112222'}}); check('free nights still bookable',c==200,(c,b))
# the Calm Shade feed that Airbnb imports
c,j=call('ical_list',None,True); link=j['cals'][ROOM]['export']; check('export link given',ROOM in j['cals'] and '&t=' in link,j['cals'].get(ROOM))
def fetch(url):
    try:
        with urllib.request.urlopen(url) as f: return f.status,f.headers.get('Content-Type',''),f.read().decode()
    except urllib.error.HTTPError as e: return e.code,'',''
c,t,txt=fetch(link); check('feed is a calendar with the booking',c==200 and 'text/calendar' in t and 'DTSTART;VALUE=DATE:'+C(2) in txt and 'DTEND;VALUE=DATE:'+C(4) in txt,(c,t,txt[:300]))
check('feed does not echo Airbnb blocks (no loop)',C(0) not in txt and C(20) not in txt,txt)
check('feed shows no guest details','Asha' not in txt and '9811112222' not in txt,txt)
c,t,txt=fetch(link[:-3]+'abc'); check('wrong token = 404',c==404,c)
# a flaky feed never frees dates
STATE['code']=500
c,j=call('ical_sync',{},True); check('sync reports',c==200,(c,j))
c,j=call('ical_list',None,True); cal=j['cals'][ROOM]
check('failed read keeps last good nights and says so',cal['blocked']==5 and cal['err'] and cal['okAt']>0,cal)
c,j=call('cs_state'); check('still blocked after a failure',j['occ'][ROOM].get(D(0))=='bk',j['occ'][ROOM])
# a changed feed frees nights that were cancelled on Airbnb
STATE['code']=200; STATE['body']=ics(ev(C(20)))
c,j=call('ical_sync',{},True); c,j=call('cs_state'); o=j['occ'][ROOM]
check('cancelled on Airbnb -> freed here',o.get(D(0))!='bk' and o.get(D(20))=='bk',o)
# disconnect
c,j=call('ical_set',{'unit':ROOM,'urls':''},True); c,j=call('cs_state'); check('disconnect frees everything',j['occ'][ROOM].get(D(20))!='bk',j['occ'][ROOM])
# hosts
c,j=call('ical_list',None,False,{'X-Host-Key':'x'*40}); check('host list needs a real host key',c==401,(c,j))
print('PASS',ok,'FAIL',len(bad))
for b in bad: print(' -',b)
