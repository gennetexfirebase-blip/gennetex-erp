const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

for (const path of ['admin-web/index.html', 'admin-web-v1/index.html']) {
  const html = fs.readFileSync(path, 'utf8');
  test(path + ': inline scripts parse', () => {
    for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (!match[1].includes('src=') && !match[1].includes('application/')) new vm.Script(match[2]);
    }
  });
  function setup(rpc) {
    const elements = Object.fromEntries(['refuel_date','refuel_amount','refuel_price','refuel_status','refuel_vehicle','okBtn'].map(id => [id, {value:'',focus(){}}]));
    let submit, reloads = 0;
    const context = { window:{},data:{vehicles:[{id:'car'}]},sb:{rpc},$:id=>elements[id],
      openModal(title,body,label,callback){submit=callback;},toast(){},loadAll:async()=>{reloads++;} };
    const start=html.indexOf('    window.refillVehicleFuel=async(id,plate)=>{');
    const end=html.indexOf('\n    };',start)+7;
    vm.runInNewContext(html.slice(start,end),context);
    context.window.refillVehicleFuel('car','1234');
    return {elements,submit:()=>submit(),reloads:()=>reloads};
  }
  test(path + ': rejects invalid amounts without saving', async () => {
    let calls=0;
    const form=setup(async()=>{calls++;});
    for(const amount of ['', '-1', 'NaN', 'Infinity']) {
      form.elements.refuel_amount.value=amount;
      assert.equal(await form.submit(),false);
    }
    form.elements.refuel_amount.value='50000';
    form.elements.refuel_price.value='-2';
    assert.equal(await form.submit(),false);
    assert.equal(calls,0);
  });
  test(path + ': saves partial refuel and discount through RPC, prevents duplicate clicks', async () => {
    let calls=0, finish, args;
    const form=setup((name,payload)=>{
      calls++;args=payload;assert.equal(name,'refuel_vehicle_by_amount');
      return new Promise(resolve=>{finish=resolve;});
    });
    form.elements.refuel_amount.value='50000';
    form.elements.refuel_price.value='2500';
    const pending=form.submit();
    assert.equal(form.elements.okBtn.disabled,true);
    assert.equal(await form.submit(),false);
    finish({data:[{liters:20,fuel_level_percent:65}],error:null});
    assert.equal(await pending,true);
    assert.equal(calls,1);
    assert.equal(args.p_amount_mnt,50000);
    assert.equal(args.p_price_per_liter,2500);
    assert.match(args.p_refueled_on,/^\d{4}-\d{2}-\d{2}$/);
    assert.equal(form.reloads(),1);
    assert.equal(form.elements.okBtn.disabled,false);
  });
  test(path + ': server errors remain visible and allow retry', async () => {
    let payload;
    const form=setup(async(name,args)=>{payload=args;return {error:{hint:'Үнэ бүртгэгдээгүй'}};});
    form.elements.refuel_amount.value='30000';
    assert.equal(await form.submit(),false);
    assert.equal(payload.p_price_per_liter,null);
    assert.equal(form.elements.refuel_status.textContent,'Үнэ бүртгэгдээгүй');
    assert.equal(form.elements.okBtn.disabled,false);
    assert.equal(form.reloads(),0);
  });
}

