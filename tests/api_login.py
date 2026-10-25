import json,urllib.request,re,subprocess
U='http://127.0.0.1:8099/fest.php?a='
ok=0;bad=[]
def check(n,c,i=''):
    global ok
    if c: ok+=1
    else: bad.append(f'{n}: {i}')
def call(a,body=None,h=None):
    r=urllib.request.Request(U+a,data=json.dumps(body or {}).encode(),headers={'Content-Type':'application/json',**(h or {})})
    try:
        with urllib.request.urlopen(r) as f: return f.status,json.load(f)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
def last_code(to):
    for l in reversed(open('fest-data/mail.log').read().strip().splitlines()):
        m=json.loads(l)
        if m['to']==to: return re.search(r'code: (\d{6})',m['subject']).group(1)
def clear(): subprocess.run(['php','-r',"$p=new PDO('sqlite:fest-data/fest.sqlite');$p->exec('DELETE FROM fest_hits');"],check=True)
# owner by email and by phone -> code goes to karthik@xtrathin.in
c,j=call('login_start',{'id':'Karthik@xtrathin.in'}); check('owner code sent',c==200 and j['sentTo'].endswith('@xtrathin.in'),(c,j))
code=last_code('karthik@xtrathin.in')
c,j=call('login_verify',{'id':'karthik@xtrathin.in','code':'000000' if code!='000000' else '111111'}); check('wrong code',c==400,(c,j))
c,j=call('login_verify',{'id':'karthik@xtrathin.in','code':code}); check('owner signed in',c==200 and j['role']=='owner' and len(j['token'])==40,(c,j))
tok=j['token']
c,j=call('login_verify',{'id':'karthik@xtrathin.in','code':code}); check('code used once',c==400,(c,j))
c,j=call('admin',None,{'X-Fest-Key':tok}); check('owner session opens the desk',c==200 and 'bookings' in j,c)
c,j=call('login_me',{},{'X-Session':tok}); check('session remembered',c==200 and j['role']=='owner',(c,j))
c,j=call('login_start',{'id':'+91 96191 76007'}); check('owner phone -> owner email',c==200 and j['sentTo'].endswith('@xtrathin.in'),(c,j))
c,j=call('login_verify',{'id':'9619176007','code':last_code('karthik@xtrathin.in')}); check('owner by phone',c==200 and j['role']=='owner',(c,j))
# a guest: sees only their bookings, never the desk
clear()
c,b=call('book',{'stays':[],'passes':[{'date':'2027-02-20','qty':2}],'guest':{'name':'Asha','phone':'9811112222','email':'asha@example.com'}}); check('guest booking',c==200,(c,b))
c,j=call('login_start',{'id':'asha@example.com'}); c,j=call('login_verify',{'id':'asha@example.com','code':last_code('asha@example.com')})
check('guest signed in with their tickets',c==200 and j['role']=='guest' and [t['ref'] for t in j['tickets']['fest']]==[b['ref']],(c,j))
gt=j['token']
c,j=call('admin',None,{'X-Fest-Key':gt}); check('guest session is not the desk',c==403,(c,j))
c,j=call('login_start',{'id':'9811112222'}); check('guest phone -> email from booking',c==200 and j['sentTo'].endswith('@example.com'),(c,j))
c,j=call('login_start',{'id':'9800000000'}); check('unknown phone asks for email',c==404,(c,j))
c,j=call('login_start',{'id':'not an email'}); check('bad id',c==400,(c,j))
# three codes per 15 minutes per email
clear()
for i in range(2): call('login_start',{'id':'asha@example.com'})
c,j=call('login_start',{'id':'asha@example.com'}); check('code rate limit',c==429,(c,j))
c,j=call('logout',{},{'X-Session':gt}); c,j=call('login_me',{},{'X-Session':gt}); check('signed out',c==401,(c,j))
# five wrong tries burn the code
clear(); call('login_start',{'id':'bo@example.com'}); good=last_code('bo@example.com')
for i in range(5): call('login_verify',{'id':'bo@example.com','code':str((int(good)+1+i)%1000000).zfill(6)})
c,j=call('login_verify',{'id':'bo@example.com','code':good}); check('5 wrong tries -> expired',c==400,(c,j))
clear()
c,j=call('login_key',{'key':'wrong-key-000000'}); check('desk key sign-in: wrong key',c==403,(c,j))
c,j=call('login_key',{'key':'test-desk-key-123456'}); check('desk key sign-in: owner',c==200 and j['role']=='owner' and len(j['token'])==40,(c,j))
c,j2=call('admin',None,{'X-Fest-Key':j['token']}); check('desk key session opens desk',c==200,c)
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',x) for x in bad]
