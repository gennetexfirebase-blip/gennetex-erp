window.mountManualFuelForm = function(container, client, vehicles, onSaved) {
  const escape = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today = new Date(Date.now()+28800000).toISOString().slice(0,10);
  let busy = false, requestId = null, requestPayload = null;
  container.innerHTML = `<details><summary style="cursor:pointer;font-weight:700;padding:12px 0">＋ Зарцуулалт бүртгэх / өнгөрсөн өдрөөр нөхөх</summary>
    <form style="display:grid;gap:16px;padding:16px 0">
      <p class="muted" style="margin:0">Машиныхаа бодит зарцуулалтыг оруулна уу. Бүртгэлийг таны нэрээр хадгална.</p>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px">
      <div><label for="mf-vehicle">Машин</label><select id="mf-vehicle" name="vehicle_id" required><option value="">Машин сонгох</option>${vehicles.map(v=>`<option value="${escape(v.id)}">${escape(v.plate_number)}</option>`).join('')}</select></div>
      <div><label for="mf-date">Огноо</label><input id="mf-date" name="consumed_on" type="date" required min="2000-01-01" max="${today}" value="${today}"></div>
      <div><label for="mf-liters">Зарцуулсан литр</label><input id="mf-liters" name="liters" type="number" inputmode="decimal" min="0.01" max="10000" step="0.01" required placeholder="25.00"></div>
      <div><label for="mf-cost">Нийт үнэ (₮)</label><input id="mf-cost" name="cost" type="number" inputmode="decimal" min="0.01" max="100000000" step="0.01" required placeholder="75000"></div>
      <div><label for="mf-distance">Явсан км (заавал биш)</label><input id="mf-distance" name="distance_km" type="number" inputmode="decimal" min="0" max="100000" step="0.01" placeholder="100"></div></div>
      <div><label for="mf-note">Тайлбар</label><textarea id="mf-note" name="note" maxlength="500" rows="2" placeholder="Аялал, зориулалт…"></textarea></div>
      <p role="status" data-status style="margin:0"></p>
      <div style="display:flex;gap:10px"><button type="submit" class="btn btn-primary">Хадгалах</button><button type="reset" class="btn btn-ghost">Цэвэрлэх</button></div>
    </form></details>`;
  const form=container.querySelector('form'),status=form.querySelector('[data-status]'),save=form.querySelector('[type=submit]');
  form.addEventListener('reset',event=>{if(busy){event.preventDefault();return;}requestId=null;requestPayload=null;status.textContent='';});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(busy||!form.reportValidity())return;
    busy=true;save.disabled=true;save.textContent='Хадгалж байна…';status.textContent='';
    try{
      const raw=Object.fromEntries(new FormData(form));
      const payload={vehicle_id:raw.vehicle_id,consumed_on:raw.consumed_on,liters:Number(raw.liters),cost:Number(raw.cost),distance_km:Number(raw.distance_km||0),note:String(raw.note||'').trim()};
      const date=new Date(payload.consumed_on+'T00:00:00Z');
      if(!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==payload.consumed_on||payload.consumed_on>new Date(Date.now()+28800000).toISOString().slice(0,10))throw new Error('Огноо буруу байна. Ирээдүйн огноо оруулах боломжгүй.');
      if(!vehicles.some(v=>v.id===payload.vehicle_id))throw new Error('Машинаа сонгоно уу.');
      if(!Number.isFinite(payload.liters)||payload.liters<0.01||payload.liters>10000||!Number.isFinite(payload.cost)||payload.cost<0.01||payload.cost>100000000||!Number.isFinite(payload.distance_km)||payload.distance_km<0||payload.distance_km>100000||payload.note.length>500)throw new Error('Литр, үнэ, км болон тайлбараа шалгана уу.');
      const fingerprint=JSON.stringify(payload);
      if(requestPayload&&requestPayload!==fingerprint)throw new Error('Өмнөх илгээлтийн хариу тодорхойгүй байна. Эхний утгаар дахин хадгалах эсвэл жагсаалтыг шалгаад формыг цэвэрлэнэ үү.');
      requestPayload=fingerprint;requestId=requestId||crypto.randomUUID();
      const {data:{user},error:authError}=await client.auth.getUser();if(authError)throw authError;if(!user)throw new Error('Дахин нэвтэрнэ үү.');
      const row={...payload,id:requestId,user_id:user.id};
      const {error}=await client.from('manual_fuel_entries').insert(row);
      if(error&&error.code!=='23505')throw error;
      if(error?.code==='23505'){
        const {data:existing,error:readError}=await client.from('manual_fuel_entries').select('*').eq('id',requestId).eq('user_id',user.id).single();
        if(readError)throw readError;
        if(!existing||existing.vehicle_id!==row.vehicle_id||existing.consumed_on!==row.consumed_on||Number(existing.liters)!==row.liters||Number(existing.cost)!==row.cost||Number(existing.distance_km)!==row.distance_km||existing.note!==row.note)throw new Error('Өмнөх бүртгэлтэй зөрсөн тул хадгалсангүй.');
      }
      busy=false;form.reset();status.textContent='Зарцуулалт хадгалагдлаа.';onSaved?.();
    }catch(error){status.textContent=['42P01','PGRST205'].includes(error.code)?'Шатахууны бүртгэлийн migration серверт хийгдээгүй байна.':error.message;}
    finally{busy=false;save.disabled=false;save.textContent='Хадгалах';}
  });
};
