import asyncio,json,urllib.request,re,base64,io
from playwright.async_api import async_playwright
from PIL import Image
B='http://127.0.0.1:8099/index.html'
T='http://127.0.0.1:8099/appa/timetable/'
ok=0;bad=[]
def check(n,c,i=''):
    global ok
    if c: ok+=1
    else: bad.append(f'{n}: {i}')
def api(a,body=None,admin=False):
    r=urllib.request.Request('http://127.0.0.1:8099/fest.php?a='+a,data=json.dumps(body).encode() if body is not None else None,headers={'Content-Type':'application/json',**({'X-Fest-Key':'test-desk-key-123456'} if admin else {})})
    try:
        with urllib.request.urlopen(r) as f: return f.status,json.load(f)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
async def desk(pg):
    await pg.goto(B); await pg.wait_for_timeout(1000); await pg.evaluate("CS.go('login')"); await pg.wait_for_timeout(300)
    await pg.fill('#lg-id','karthik@xtrathin.in'); await pg.evaluate("CS.id()"); await pg.wait_for_timeout(1000)
    code=re.search(r'code: (\d{6})',open('../fest-data/mail.log').read().strip().splitlines()[-1]).group(1); await pg.click('.otp input'); await pg.keyboard.type(code,delay=40); await pg.wait_for_timeout(800)
    await pg.evaluate("CS.mode('fest')"); await pg.wait_for_timeout(1500)
async def main():
    # a small logo picture
    im=Image.new('RGBA',(120,60),(217,80,47,255)); buf=io.BytesIO(); im.save(buf,'PNG'); open('/tmp/appa-logo.png','wb').write(buf.getvalue())
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        for vw,vh in [(1366,860),(390,844)]:
            ctx=await b.new_context(viewport={'width':vw,'height':vh}); pg=await ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e)))
            await desk(pg)
            t=await pg.inner_text('.con')
            check(f'{vw} desk panels','Timetable · public page and passports' in t and 'Logos · the people behind APPA' in t and 'Sponsors · private tracker' in t,t[-400:])
            check(f'{vw} starting programme listed','Dashavatar exhibit' in t and 'Wench Film Festival' in t,'')
            if vw==1366:
                # timetable: a 3-day workshop at Shambhala, then edit its title
                await pg.select_option('#pps-d','2027-02-21'); await pg.wait_for_timeout(200)
                await pg.select_option('#pps-to','2027-02-23'); await pg.select_option('#pps-s','shambhala'); await pg.select_option('#pps-k','workshop')
                await pg.fill('#pps-t','10:00'); await pg.fill('#pps-ti','Carpentry with Ravi'); await pg.click('text=Add to timetable'); await pg.wait_for_timeout(1200)
                c,j=api('state'); it=[i for i in j['schedule'] if i['title']=='Carpentry with Ravi']
                check('ranged workshop saved',len(it)==1 and it[0]['to']=='2027-02-23' and it[0]['kind']=='workshop' and it[0]['spot']=='shambhala' and len(j['schedule'])==28,it)
                await pg.click(f"tr:has-text('Carpentry with Ravi') >> text=Edit"); await pg.wait_for_timeout(300)
                await pg.fill('#pps-ti','Carpentry workshop'); await pg.click('text=Save changes'); await pg.wait_for_timeout(1200)
                c,j=api('state'); check('edit replaces, not adds',sum(1 for i in j['schedule'] if i['title'].startswith('Carpentry'))==1 and any(i['title']=='Carpentry workshop' and i['to']=='2027-02-23' for i in j['schedule']),[i['title'] for i in j['schedule']][-5:])
                # logos: add a sponsor with a picture, a partner without
                await pg.fill('#lg-n','Hero Cycles'); await pg.select_option('#lg-g','sponsor'); await pg.fill('#lg-u','herocycles.com')
                await pg.set_input_files('#lg-i','/tmp/appa-logo.png'); await pg.wait_for_timeout(1500)
                check('logo uploaded','Picture added' in await pg.inner_text('.con'),'')
                await pg.click('text=Add logo'); await pg.wait_for_timeout(1200)
                c,j=api('state'); hs=[l for l in j['logos'] if l['name']=='Hero Cycles']
                check('sponsor logo saved',len(hs)==1 and hs[0]['group']=='sponsor' and hs[0]['img'].startswith('uploads/') and hs[0]['url']=='https://herocycles.com',hs)
                # sponsor tracker
                await pg.fill('#sp-n','Hero Cycles'); await pg.select_option('#sp-t','Title'); await pg.fill('#sp-w','Cycles at every venue'); await pg.select_option('#sp-s','In talks'); await pg.fill('#sp-v','2500000'); await pg.fill('#sp-c','Asha · 98xxxxxx'); await pg.click('text=Add sponsor'); await pg.wait_for_timeout(1200)
                c,j=api('admin',None,True); check('sponsor tracked',len(j['sponsors'])==1 and j['sponsors'][0]['value']==2500000 and j['sponsors'][0]['status']=='In talks',j.get('sponsors'))
                c,j=api('state'); check('sponsors never public','sponsors' not in j and 'Asha' not in json.dumps(j),'')
                t=await pg.inner_text('.con'); check('pipeline total','₹25,00,000' in t or '₹2,500,000' in t,'')
                # public timetable shows the workshop on all 3 days, sponsor beside the logo, partner tiles
                tp=await ctx.new_page(); tp.on('pageerror',lambda e: errs.append(str(e)))
                await tp.goto(T); await tp.wait_for_timeout(1500)
                tt=await tp.inner_text('body')
                check('public: workshop 3 days',tt.count('Carpentry workshop')==3,tt.count('Carpentry workshop'))
                check('public: runs all festival','running all 36 days' in tt.lower() and 'Dashavatar exhibit' in tt and 'at every venue' in tt.lower(),'')
                check('public: sponsor beside logo',await tp.evaluate("!!document.querySelector('#sponsors.on img.logo')"),'')
                check('public: logo panel','Sangoma Records' in tt and 'KRUNK' not in tt and 'curators & collectives' in tt.lower(),'')
                check('public: 12 big nights',await tp.evaluate("document.querySelectorAll('tr.big').length")==12,'')
                await tp.click('text=Big nights only'); await tp.wait_for_timeout(200)
                check('public: big nights filter',await tp.evaluate("document.querySelectorAll('.tt tbody tr').length")==12,'')
            else:
                check('phone desk no sideways page scroll',await pg.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),await pg.evaluate("document.documentElement.scrollWidth"))
                tp=await ctx.new_page(); await tp.goto(T); await tp.wait_for_timeout(1500)
                check('phone timetable no sideways scroll',await tp.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'')
                check('phone shows cards',await tp.evaluate("document.querySelectorAll('.dcard').length")==36,'')
            await ctx.close()
        check('no page errors',not errs,errs[:3])
        await b.close()
asyncio.run(main())
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',x) for x in bad]
