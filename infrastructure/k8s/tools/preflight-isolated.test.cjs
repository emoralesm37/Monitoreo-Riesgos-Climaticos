const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate } = require('./preflight-isolated.cjs');
const enough = () => ({ host: { availableMiB: 4096, diskFreeGiB: 40 }, docker: { availableMiB: 6144, cpus: 4 } });
test('allows a host with explicit headroom', () => assert.deepEqual(evaluate(enough()), []));
test('blocks host pressure even when Docker reports reclaimable memory', () => {
  const data = enough(); data.host.availableMiB = 523;
  assert.deepEqual(evaluate(data), ['HOST_MEMORY_BELOW_2048_MIB']);
});
test('blocks limited Linux memory despite a roomy Windows host', () => {
  const data = enough(); data.docker.availableMiB = 3950;
  assert.deepEqual(evaluate(data), ['LINUX_VM_MEMORY_BELOW_4096_MIB']);
});
test('blocks inadequate disk and CPU independently', () => {
  const data = enough(); data.host.diskFreeGiB = 3; data.docker.cpus = 1;
  assert.deepEqual(evaluate(data), ['HOST_DISK_BELOW_15_GIB', 'FEWER_THAN_2_CPUS']);
});
test('reports both memory constraints rather than hiding one', () => {
  const data = enough(); data.host.availableMiB = 500; data.docker.availableMiB = 3500;
  assert.equal(evaluate(data).length, 2);
});
