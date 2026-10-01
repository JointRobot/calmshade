import asyncio,json,urllib.request,subprocess
from playwright.async_api import async_playwright
B='http://127.0.0.1:8099/index.html'
ok=0;bad=[]
def check(n,c,i=''):
    global ok
    if c: ok+=1
    else: bad.append(f'{n}: {i}')
def api(a,body,admin=False):
    r=urllib.request.Request('http://127.0.0.1:8099/fest.php?a='+a,data=json.dumps(body).encode(),headers={'Content-Type':'application/json',**({'X-Fest-Key':'test-desk-key-123456'} if admin else {})})
    try:
        with urllib.request.urlopen(r) as f: return f.status,json.load(f)
    except urllib.error.HTTPError as e: return e.code,json.load(e)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(); errs=[]
        pg=await b.new_page(viewport={'width':1366,'height':860}); pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(B+'#appa'); await pg.wait_for_timeout(1500)
        await pg.evaluate("CS.fx('tab','pass')"); await pg.wait_for_timeout(200)
        await pg.click('.fx-day:has-text("30")'); await pg.click('.fx-day:has-text("31")'); await pg.evaluate("CS.fx('addPass')"); await pg.wait_for_timeout(300)
        t=await pg.inner_text('.fx-trip'); check('buy label','Buy day passes' in t and 'Book this trip' not in t,t[-200:])
        await pg.click('text=Buy day passes'); await pg.wait_for_timeout(200)
        t=await pg.inner_text('.fx-trip'); check('no hold wording in checkout','hold' not in t.lower() and 'Continue to payment' in t,t[-300:])
        await pg.fill('#fxg-name','Pass Buyer'); await pg.fill('#fxg-phone','9700000001'); await pg.click('text=Continue to payment'); await pg.wait_for_timeout(1800)
        t=await pg.inner_text('.fx-trip'); ref=await pg.inner_text('.fx-ref')
        check('payment screen','Pay for your passes' in t and 'Held until' not in t and 'ORDER REFERENCE' in t.upper() and '₹8,000' in t,t[:400])
        await pg.fill('#fxg-utr','412345678901'); await pg.click('text=Send payment reference'); await pg.wait_for_timeout(1200)
        await pg.click('text=Back to the board'); await pg.wait_for_timeout(300)
        t=await pg.inner_text('.fx-trip'); check('listed unpaid','UNPAID' in t.upper() and ref in t,t[-300:])
        # unpaid pass never expires
        subprocess.run(['php','-r',f"$p=new PDO('sqlite:fest-data/fest.sqlite');$p->exec(\"UPDATE fest_bookings SET created_at=created_at-500000 WHERE ref='{ref}'\");"])
        c,j=api('admin',{} ,True) if False else (None,None)
        r=urllib.request.Request('http://127.0.0.1:8099/fest.php?a=admin',headers={'X-Fest-Key':'test-desk-key-123456'}); j=json.load(urllib.request.urlopen(r))
        bk=[x for x in j['bookings'] if x['ref']==ref][0]; check('pass not expired after 48h',bk['status']=='pending' and bk['passOnly'],bk['status'])
        c,j=api('status',{'ref':ref,'status':'confirmed'},True); check('desk confirms',c==200,(c,j))
        await pg.reload(); await pg.wait_for_timeout(1800)
        await pg.click('button.fx-x:has-text("Ticket")'); await pg.wait_for_timeout(500)
        t=await pg.inner_text('.fx-trip'); check('ticket shows','Your ticket' in t and ref in t and 'Pass Buyer' in t and 'Day pass' in t and 'festival gate' in t,t[:400])
        check('ticket qr element',await pg.evaluate("!!document.querySelector('.fx-trip [data-qr^=\"APPA-\"]')"))
        await pg.screenshot(path='/tmp/ticket.png')
        # stays still use hold wording
        await pg.click('text=Back'); await pg.evaluate("CS.fx('tab','stay')"); await pg.click('[data-fxu="calmshet"][data-fxd="2027-02-15"]'); await pg.evaluate("CS.fx('add');CS.fx('checkout')"); await pg.wait_for_timeout(300)
        t=await pg.inner_text('.fx-trip'); check('stays keep hold','Hold my rooms' in t,t[-200:])
        print('ERR',errs); await b.close()
asyncio.run(main())
print(f'PASS {ok}  FAIL {len(bad)}'); [print(' -',x) for x in bad]
