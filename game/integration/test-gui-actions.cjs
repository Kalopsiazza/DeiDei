const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertTargets}=require('./gui-actions.cjs');
test('UI targets cannot report success with a zero-match selector',async()=>{
 await assert.rejects(assertTargets({locator:()=>({count:async()=>0})},'.missing-target'),/No matching UI targets: \.missing-target/);
 assert.equal(await assertTargets({locator:()=>({count:async()=>33})},'.card'),33);
});
