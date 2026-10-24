import test from 'node:test';
import assert from 'node:assert/strict';
import { loadSecretAchievement, saveSecretAchievement, saveBest, loadBest } from '../src/storage.ts';
const values=new Map<string,string>();
const store={getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)};
Object.defineProperty(globalThis,'localStorage',{value:store,configurable:true});
test('secret collection persists independently of best scores and validates stored values',()=>{
  for(const raw of ['null','{}','broken','{"duckWindow":"true"}','{"duckWindow":1}']){
    values.set('karcher-flight-achievements-v1',raw);assert.equal(loadSecretAchievement(),false);
  }
  const best={stars:1,clean:10,residents:0,elapsed:80,rescues:0,height:133};saveBest(best);
  assert.equal(saveSecretAchievement(),true);assert.equal(loadSecretAchievement(),true);
  assert.deepEqual(loadBest(),best);assert.equal(saveSecretAchievement(),true);
});
test('blocked achievement storage does not interrupt gameplay',()=>{
  Object.defineProperty(globalThis,'localStorage',{get(){throw new Error('blocked');},configurable:true});
  assert.equal(loadSecretAchievement(),false);assert.equal(saveSecretAchievement(),false);
  Object.defineProperty(globalThis,'localStorage',{value:store,configurable:true});
});
