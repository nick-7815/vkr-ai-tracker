/* Разбор BPMN через bpmn-moddle: предупреждения парсера, элементы без DI, висячие узлы.
   Запуск: node validate.js vkr-process-as-is.bpmn */
const fs = require('fs');
const file = process.argv[2] || 'vkr-process-as-is.bpmn';

(async () => {
  const mod = await import('bpmn-moddle');
  const BpmnModdle = mod.BpmnModdle || mod.default; // v9 отдаёт default, v10+ — именованный экспорт
  const moddle = new BpmnModdle();
  const { rootElement, warnings } = await moddle.fromXML(fs.readFileSync(file, 'utf8'));

  const proc = rootElement.rootElements.find(e => e.$type === 'bpmn:Process');
  const els = new Map();
  (function walk(el) {
    (el.flowElements || []).forEach(f => { els.set(f.id, f); walk(f); });
    (el.artifacts || []).forEach(a => els.set(a.id, a));
  })(proc);

  const diIds = new Set();
  rootElement.diagrams.forEach(d => d.plane.planeElement.forEach(pe => diIds.add(pe.bpmnElement.id)));
  const missingDI = [...els.keys()].filter(id => !diIds.has(id) && !id.startsWith('DataObject_'));

  const dangling = [...els.values()]
    .filter(e => /Task|Event|Gateway|SubProcess/.test(e.$type) && !e.$type.includes('Definition'))
    .filter(n => {
      if (n.$type === 'bpmn:SubProcess' && n.triggeredByEvent) return false; // событийный подпроцесс без потоков — норма
      if (n.$type === 'bpmn:BoundaryEvent') return (n.outgoing || []).length === 0; // граничное событие входящих не имеет
      const inc = (n.incoming || []).length, out = (n.outgoing || []).length;
      return (n.$type !== 'bpmn:StartEvent' && inc === 0) || (n.$type !== 'bpmn:EndEvent' && out === 0);
    })
    .map(n => `${n.id} (${n.$type})`);

  console.log(`${file}: элементов ${els.size}, предупреждений парсера ${warnings.length}`);
  warnings.slice(0, 10).forEach(w => console.log('  -', w.message));
  console.log('  без DI:', missingDI.join(', ') || 'нет');
  console.log('  висячие узлы:', dangling.join('; ') || 'нет');
  if (warnings.length || missingDI.length || dangling.length) process.exit(1);
})().catch(e => { console.error('ОШИБКА:', e.message); process.exit(1); });
