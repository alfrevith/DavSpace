import test from 'node:test';
import assert from 'node:assert/strict';
import passage from '../assets/js/creative-passage.js';

test('all directed trips and portfolio entrances use brief handoffs', () => {
  for (const from of passage.worlds) for (const to of passage.worlds) {
    const route = passage.route(from,to);
    if (from===to) { assert.equal(route,null); continue; }
    assert(route && route.duration<=120 && route.arrivalDuration<=160);
    assert.equal(route.id,from+'-'+to);
  }
  for (const to of passage.worlds) assert(passage.route('portfolio',to));
  assert.equal(passage.route('unknown','writing'),null);
});

test('handoffs reject stale, future, mismatched or unavailable session state', () => {
  const now=10000,record={from:'drawings',to:'writing',path:'/DavSpace/writing.html',at:now-200};
  const storage=value=>({getItem:()=>JSON.stringify(value)});
  assert.deepEqual(passage.pending(storage(record),record.path,now),record);
  assert.equal(passage.pending(storage(record),'/DavSpace/drawings.html',now),null);
  for (const patch of [{at:now-9000},{at:now+1},{to:'outside'},{from:'unknown'},{path:'/DavSpace/anything.html'}])
    assert.equal(passage.pending(storage({...record,...patch}),record.path,now),null);
  assert.equal(passage.pending({getItem(){throw Error('storage denied');}},record.path,now),null);
});
