import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planRepair,target} from '../db/repair-bosque-eur-breakdown.mjs';
function fixture() {
  const balance={id:target.balance,punto_atencion_id:target.point,moneda_id:target.currency,cantidad:'1745.36',billetes:'1689.74',monedas_fisicas:'7.14',bancos:'0.00',version_text:target.rawUpdated};
  const opening={id:target.opening,estado:'ABIERTA',conteo_fisico:[{moneda_id:target.currency,total:1320.36,billetes:[{cantidad:13,denominacion:100},{cantidad:1,denominacion:5}],monedas:[{cantidad:6,denominacion:2},{cantidad:3,denominacion:0.5},{cantidad:2,denominacion:0.2},{cantidad:10,denominacion:0.1},{cantidad:9,denominacion:0.05},{cantidad:1,denominacion:0.01}]}]};
  const movements=[{referencia_id:target.sale,monto:-100,saldo_anterior:1320.36,saldo_nuevo:1220.36},{referencia_id:target.purchase,monto:525,saldo_anterior:1220.36,saldo_nuevo:1745.36}];
  const exchanges=[{id:target.sale,estado:'COMPLETADO',moneda_destino_id:target.currency,monto_destino:100,divisas_recibidas_billetes:100,divisas_recibidas_monedas:0},{id:target.purchase,estado:'COMPLETADO',moneda_origen_id:target.currency,monto_origen:525,divisas_entregadas_billetes:525,divisas_entregadas_monedas:0}];
  return [balance,opening,movements,exchanges];
}
test('restores recorded count plus later transactions without silently deducting ten cents',()=>{
  const p=planRepair(...fixture());assert.equal(p.alreadyApplied,false);
  assert.deepEqual(p.after,{cantidad:'1745.36',billetes:'1730.00',monedas_fisicas:'15.36',bancos:'0.00'});
  assert.equal(p.historicalDifferencePendingToday,'0.10');
});
test('recognizes applied repair without posting it twice',()=>{
  const f=fixture();f[0].billetes='1730.00';f[0].monedas_fisicas='15.36';f[0].updated_at=new Date();assert.equal(planRepair(...f).alreadyApplied,true);
});
for(const [label,change] of [
  ['changed balance',f=>f[0].cantidad='1750.36'],
  ['changed version',f=>f[0].version_text='2026-09-14 12:00:00'],
  ['wrong point',f=>f[0].punto_atencion_id='other'],
  ['new transaction',f=>f[2].push({...f[2][0]})],
  ['changed count',f=>f[1].conteo_fisico[0].monedas[0].cantidad=7],
  ['duplicate count',f=>f[1].conteo_fisico.push({...f[1].conteo_fisico[0]})],
  ['changed breakdown',f=>f[3][0].divisas_recibidas_monedas=1],
  ['broken ledger chain',f=>f[2][1].saldo_anterior=1200],
])test('rejects '+label,()=>{const f=fixture();change(f);assert.throws(()=>planRepair(...f));});
