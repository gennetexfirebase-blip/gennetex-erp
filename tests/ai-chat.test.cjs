const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync('supabase/functions/ai-chat/index.ts','utf8').replace(/^import .*;\r?\n/gm,'');
const output=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext},reportDiagnostics:true});
assert.equal((output.diagnostics||[]).length,0);
function setup(reviewed){
 let handler, sent, learned, filters=[];
 const match={question:'Компанийн үнэ?',answer:'Хуурамч үнэ 123'};
 const db={
  rpc:async()=>({data:[match]}),
  from(table){
   const q={
    select(){return q;},in(){return q;},eq(){return q;},order(){return q;},
    neq(key,value){filters.push([key,value]);return Promise.resolve({data:reviewed});},
    limit:async()=>({data:[]}),
    insert(value){if(table==='ai_knowledge')learned=value;return q;},
    update(){return q;},single:async()=>({data:{id:'test-id'}}),
    then(resolve){return Promise.resolve({data:null}).then(resolve);}
   };return q;
  }
 };
 const ctx={Deno:{env:{get:name=>({AI_LEARN:'on',SUPABASE_URL:'https://example.test',SUPABASE_SERVICE_ROLE_KEY:'test'}[name])},serve:fn=>handler=fn},createClient:()=>db,Response,AbortSignal,fetch:async(url,init)=>{sent=JSON.parse(init.body);return Response.json({choices:[{message:{content:'Мэдээллийг шалгаж байж хариулах шаардлагатай.'}}]});},console};
 vm.runInNewContext(output.outputText,ctx);
 return {run:()=>handler({method:'POST',headers:new Headers(),json:async()=>({message:'Компанийн үнэ хэд вэ?'})}),sent:()=>sent,learned:()=>learned,filters};
}
test('generated knowledge is excluded and new answers await review',async()=>{
 const ctx=setup([]);const res=await ctx.run();assert.equal(res.status,200);
 assert.ok(!ctx.sent().messages[0].content.includes('Хуурамч үнэ'));
 assert.equal(ctx.learned().approved,false);
 assert.deepEqual(ctx.filters,[['source','conversation']]);
});
test('reviewed matching knowledge reaches model',async()=>{
 const ctx=setup([{question:'Компанийн үнэ?',answer:'Хуурамч үнэ 123'}]);await ctx.run();
 assert.ok(ctx.sent().messages[0].content.includes('Хуурамч үнэ 123'));
 assert.equal(ctx.learned(),undefined);
});
test('changed knowledge does not reuse stale search results',async()=>{
 const ctx=setup([{question:'Компанийн үнэ?',answer:'Өөр шинэ утга'}]);await ctx.run();
 assert.ok(!ctx.sent().messages[0].content.includes('Хуурамч үнэ'));
});

